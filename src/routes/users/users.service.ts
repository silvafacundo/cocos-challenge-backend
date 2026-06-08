import { and, eq, inArray, notInArray, or, sql, sum } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema';
import BaseComponent from '../../structures/BaseComponent';
import type { DbTransaction } from '../../structures/Server';

export interface Asset {
	ticker: string | null;
	name: string | null;
	type: string | null;
	price: number | null;
	size: number;
	position_value: number;
	absolute_return: number;
	roi: number;
}

export interface Portfolio {
	cash_balance: number;
	assets: Asset[];
	total_asset_value: number;
	total_portfolio_value: number;
}

export default class UserService extends BaseComponent {
	public async getUserCashBalance(userId: number, trx?: DbTransaction | ReturnType<typeof drizzle>): Promise<number> {
		if (!trx) trx = this.db;

		/**
		 * Add cash when selling or cash in
		 * Subtract when buy or cash out
		 *
		 * Select only requried orders:
		 * For BUY and CASH_OUT operations status -> FILLED, NEW (That money shouldn't be available)
		 * For SELL and CASH_IN status -> FILLED
		 */
		const query = trx
			.select({
				balance: sum(
					sql`
						case
							when ${schema.orders.side} in ('SELL', 'CASH_IN') then
								(${schema.orders.size} * ${schema.orders.price})
							when side in ('BUY', 'CASH_OUT') then
								-(${schema.orders.size} * ${schema.orders.price})
							ELSE 0
						END
					`
				).as('balance')
			})
			.from(schema.orders)
			.where(
				and(
					or(
						// Decrease balance
						and(
							inArray(schema.orders.side, ['BUY', 'CASH_OUT']),
							inArray(schema.orders.status, ['FILLED', 'NEW'])
						),
						// Increase balance
						and(inArray(schema.orders.side, ['SELL', 'CASH_IN']), eq(schema.orders.status, 'FILLED'))
					),
					eq(schema.orders.userid, userId)
				)
			)
			.limit(1);

		const [balance] = await query;

		// Maybe throw an error? Should we verify user existance?
		if (!balance?.balance) return 0;

		return parseFloat(balance.balance);
	}

	public async getUserInstruments(userId: number): Promise<Asset[]> {
		const marketByInstrumentQuery = this.services.instruments.latestMarketdataQuery();

		const userInstruments = this.db
			.select({
				instrumentId: schema.orders.instrumentid,
				size: sum(
					sql`
						case when ${schema.orders.side} = 'BUY' then ${schema.orders.size}
						when ${schema.orders.side} = 'SELL' then -${schema.orders.size}
						else 0 END
					`
				).as('size'),
				total_invested: sum(
					sql`
						case when ${schema.orders.side} = 'BUY' then ${schema.orders.size} * ${schema.orders.price}
						else 0 END
					`
				).as('total_invested'),
				total_proceeds: sum(
					sql`
						case when ${schema.orders.side} = 'SELL' then ${schema.orders.size} * ${schema.orders.price}
						else 0 END
					`
				).as('total_proceeds'),

				net_cash_flow: sql`
					SUM(case when ${schema.orders.side} = 'SELL' THEN ${schema.orders.size} * ${schema.orders.price} ELSE 0 END) -
					SUM(CASE WHEN ${schema.orders.side} = 'BUY' THEN ${schema.orders.size} * ${schema.orders.price} ELSE 0 END)
				`.as('net_cash_flow')
			})
			.from(schema.orders)
			.where(
				and(
					eq(schema.orders.userid, userId),
					eq(schema.orders.status, 'FILLED'),
					notInArray(schema.orders.side, ['CASH_IN', 'CASH_OUT'])
				)
			)
			.groupBy(schema.orders.instrumentid)
			.as('userInstruments');

		const instruments = await this.db
			.select({
				ticker: schema.instruments.ticker,
				name: schema.instruments.name,
				type: schema.instruments.type,
				size: userInstruments.size,
				total_invested: userInstruments.total_invested,
				price: marketByInstrumentQuery.close,
				position_value: sql`${userInstruments.size} * ${marketByInstrumentQuery.close}`.as('position_value'),
				absolute_return:
					sql`${userInstruments.net_cash_flow} + (${userInstruments.size} * ${marketByInstrumentQuery.close})`.as(
						'absolute_return'
					),
				roi: sql`
					CASE WHEN ${userInstruments.total_invested} > 0 THEN
						(
							(${userInstruments.net_cash_flow} + (${userInstruments.size} * ${marketByInstrumentQuery.close})) 
							/ ${userInstruments.total_invested}
						) * 100
					ELSE 0
					END
				`
			})
			.from(schema.instruments)
			.innerJoin(userInstruments, eq(userInstruments.instrumentId, schema.instruments.id))
			.innerJoin(marketByInstrumentQuery, eq(marketByInstrumentQuery.instrumentId, schema.instruments.id));

		return instruments
			.map(asset => ({
				...asset,

				size: parseInt(asset.size ?? '0', 10),

				position_value: parseFloat((asset.position_value as string | null) ?? '0'),

				total_invested: parseFloat(asset.total_invested ?? '0'),
				absolute_return: parseFloat((asset.absolute_return as string | null) ?? '0'),
				roi: parseFloat((asset.roi as string | null) ?? '0')
			}))
			.filter(asset => asset.size !== 0);
	}

	public async getUserPortfolio(userId: number): Promise<Portfolio> {
		const assets = await this.getUserInstruments(userId);

		const balance = await this.getUserCashBalance(userId);

		const assetValue = assets.reduce((acc, asset) => acc + asset.position_value, 0);

		return {
			cash_balance: balance,
			total_asset_value: assetValue,
			total_portfolio_value: assetValue + balance,
			assets
		};
	}

	/**
	 * Testing methods
	 */

	public async createTestUser(initBalance?: number, shares?: { instrumentId: number; size: number }[]) {
		const [user] = await this.db
			.insert(schema.users)
			.values({
				email: `test_${Date.now().toString(32)}@test.com`,
				accountnumber: Date.now().toString()
			})
			.returning();

		const orders: any[] = [];

		if (initBalance) {
			orders.push({
				userid: user.id,
				side: 'CASH_IN',
				type: 'MARKET',
				size: initBalance,
				price: 1,
				status: 'FILLED',
				datetime: new Date().toISOString()
			});
		}

		for (const share of shares || []) {
			orders.push({
				instrumentid: share.instrumentId,
				size: share.size,
				price: 0,
				userid: user.id,
				type: 'MARKET',
				side: 'BUY',
				status: 'FILLED',
				datetime: new Date().toISOString()
			});
		}

		if (orders.length > 0) {
			await this.db.insert(schema.orders).values(orders);
		}

		return user;
	}

	public async deleteUser(userId: number) {
		await this.db.delete(schema.orders).where(eq(schema.orders.userid, userId));
		await this.db.delete(schema.users).where(eq(schema.users.id, userId));
	}
}
