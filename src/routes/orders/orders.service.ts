import { and, eq, sql, sum } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { PublicError } from '../../errors/PublicError';
import BaseComponent from '../../structures/BaseComponent';
import { OrderSide, OrderType, type PlaceOrderParams } from './types';

export default class OrderService extends BaseComponent {
	public async placeOrder(
		userId: number,
		instrumentId: number,
		type: OrderType,
		side: OrderSide,
		{ size, bidPrice, cashValue }: PlaceOrderParams
	) {
		let price: number;
		let realSize: number;

		if (type === OrderType.MARKET) {
			// Fetch marketdata price
			const [marketdata] = await this.db
				.select()
				.from(this.services.instruments.latestMarketdataQuery([instrumentId]));
			if (!marketdata) throw new PublicError('Instrument not found');
			if (!marketdata.close) throw new PublicError('Invalid instrument');

			// Calculate the operation size
			if (typeof size === 'undefined' && typeof cashValue === 'undefined') {
				throw new PublicError('for MARKET operations "size" or "cashValue" are required');
			} else if (typeof size === 'undefined' && typeof cashValue === 'number') {
				// If cashValue is provided then we calculate the amount of shares by dividing by the current price
				if (cashValue <= 0) throw new PublicError('"cashValue" should be greater than 0');

				// Calculate operation size by the cashValue
				realSize = Math.floor(cashValue / marketdata.close);

				if (realSize <= 0) throw new PublicError('The desired "cashValue" is less than a share.');
			} else if (typeof size === 'number') {
				// Otherwise we use the provided size
				realSize = size;
			} else {
				throw new Error('Unexpected error');
			}

			price = marketdata.close;
		} else {
			// type === LIMIT

			// Validate required parameters
			if (typeof bidPrice !== 'number') throw new PublicError('"bidPrice" is required for LIMIT operations');
			if (bidPrice <= 0) throw new PublicError('"bidPrice" should be greater than 0');

			if (typeof size !== 'number') throw new PublicError('"size" is required for LIMIT operations');

			realSize = size;
			price = bidPrice;
		}

		if (realSize <= 0) throw new PublicError('"size" should be greater than 0');

		// Calculate the total order price
		const totalPrice = price * realSize;

		const order = await this.db.transaction(async trx => {
			// Lock user for transaction
			await trx.select().from(schema.users).where(eq(schema.users.id, userId)).for('update');

			let hasAvailable = false;

			if (side === OrderSide.BUY) {
				// Check if has the required balance for the operation
				const balance = await this.services.users.getUserCashBalance(userId, trx);
				hasAvailable = balance >= totalPrice;
			} else {
				// IF size === 'SELL'
				// Check if has the required stocks available for the operation
				const orders = await trx
					.select({
						size: sum(
							sql`
								case when ${schema.orders.side} = 'BUY' then ${schema.orders.size}
								when ${schema.orders.side} = 'SELL' then -${schema.orders.size}
								else 0
								END
							`
						)
					})
					.from(schema.orders)
					.where(
						and(
							eq(schema.orders.userid, userId),
							eq(schema.orders.instrumentid, instrumentId),
							eq(schema.orders.status, 'FILLED')
						)
					)
					.limit(1);

				hasAvailable = parseInt(orders[0]?.size ?? '0', 10) >= realSize;
			}

			let status: 'FILLED' | 'REJECTED' | 'NEW' = type === OrderType.MARKET ? 'FILLED' : 'NEW';

			if (!hasAvailable) status = 'REJECTED';

			const [order] = await trx
				.insert(schema.orders)
				.values({
					instrumentid: instrumentId,
					userid: userId,
					size: realSize,
					price,
					type,
					side,
					status,
					datetime: new Date().toISOString()
				})
				.returning();

			return order;
		});

		return order;
	}

	public async cancelUserOrder(orderId: number, userId: number) {
		const [order] = await this.db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
		if (!order) throw new PublicError('order not found');

		// Validate that the order is from the user
		if (order.userid !== userId) throw new PublicError('order not found');

		if (order.status !== 'NEW') throw new PublicError('Only "NEW" orders can be cancelled');

		const [updatedOrder] = await this.db
			.update(schema.orders)
			.set({
				status: 'CANCELLED'
			})
			.where(eq(schema.orders.id, orderId))
			.returning();

		return updatedOrder;
	}
}
