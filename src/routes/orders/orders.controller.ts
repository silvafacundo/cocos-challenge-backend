import { eq } from 'drizzle-orm';

import Type from 'typebox';

import * as schema from '../../db/schema';

import { PublicError } from '../../errors/PublicError';
import BaseComponent from '../../structures/BaseComponent';

import getUserFromHeader from '../../utils/getUserFromHeader';
import { OrderSide, OrderType } from './types';

export default class OrderController extends BaseComponent {
	public constructor() {
		super();

		this.server.app.post(
			'/order',
			{
				schema: {
					body: Type.Object({
						ticker: Type.String(),
						type: Type.Enum(OrderType),
						side: Type.Enum(OrderSide),
						size: Type.Optional(Type.Number()),
						bidPrice: Type.Optional(Type.Number()),
						cashValue: Type.Optional(Type.Number())
					})
				}
			},
			async req => {
				const userId = getUserFromHeader(req);
				const { ticker, type, side, size, bidPrice, cashValue } = req.body;

				// Validate ticker
				const [instrument] = await this.db
					.select()
					.from(schema.instruments)
					.where(eq(schema.instruments.ticker, ticker))
					.limit(1);
				if (!instrument) throw new PublicError('Invalid ticker');

				const order = await this.services.orders.placeOrder(userId, instrument.id, type, side, {
					size,
					bidPrice,
					cashValue
				});

				return order;
			}
		);

		this.server.app.delete(
			'/order/:orderId',
			{
				schema: {
					params: Type.Object({
						orderId: Type.String()
					})
				}
			},
			async req => {
				const userId = getUserFromHeader(req);
				const orderId = parseInt(req.params.orderId, 10);

				const order = await this.services.orders.cancelUserOrder(orderId, userId);
				return order;
			}
		);
	}
}
