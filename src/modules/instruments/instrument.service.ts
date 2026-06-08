import { and, eq, ilike, inArray, max, or, sql } from 'drizzle-orm';
import * as schema from '../../db/schema';
import BaseComponent from '../../structures/BaseComponent';

export default class InstrumentService extends BaseComponent {
	public latestMarketdataQuery(filterInstruments?: number[]) {
		// Group latest row of each instrument
		const groupedMarketQuery = this.db
			.select({
				instrumentid: schema.marketdata.instrumentid,
				max_date: max(schema.marketdata.date).as('max_date')
			})
			.from(schema.marketdata)
			.groupBy(schema.marketdata.instrumentid)
			.where(
				Array.isArray(filterInstruments) && filterInstruments?.length > 0
					? inArray(schema.marketdata.instrumentid, filterInstruments)
					: undefined
			)
			.as('market_max');

		// market data query
		return this.db
			.select({
				instrumentId: schema.marketdata.instrumentid,
				close: schema.marketdata.close,
				high: schema.marketdata.high,
				low: schema.marketdata.low,
				open: schema.marketdata.open,
				previousClose: schema.marketdata.previousclose,
				date: schema.marketdata.date
			})
			.from(schema.marketdata)
			.innerJoin(
				groupedMarketQuery,
				and(
					eq(groupedMarketQuery.instrumentid, schema.marketdata.instrumentid),
					eq(groupedMarketQuery.max_date, schema.marketdata.date)
				)
			)
			.as('marketByInstrument');
	}

	public async searchInstruments(
		query: string,
		{ type, ticker, name }: { type?: string[]; ticker?: string; name?: string } = {}
	) {
		// Improvements: Pagination (?)

		// Filter instruments
		const conditions: Parameters<typeof and> = [];
		if (query) {
			conditions.push(
				or(ilike(schema.instruments.ticker, `%${query}%`), ilike(schema.instruments.name, `%${query}%`))
			);
		}

		// Filter by exact ticker
		if (ticker) {
			conditions.push(ilike(schema.instruments.ticker, ticker));
		}

		// Filter by exact name
		if (name) {
			conditions.push(ilike(schema.instruments.name, name));
		}

		if (Array.isArray(type) && type.length > 0) {
			conditions.push(inArray(schema.instruments.type, type));
		}

		const marketdata = this.latestMarketdataQuery();
		const instruments = await this.db
			.select({
				id: schema.instruments.id,
				ticker: schema.instruments.ticker,
				name: schema.instruments.name,
				type: schema.instruments.type,

				price: marketdata.close,

				open: marketdata.open,
				close: marketdata.close,

				high: marketdata.high,
				low: marketdata.low,

				daily_return: sql`((${marketdata.close} - ${marketdata.previousClose}) / ${marketdata.previousClose}) * 100`
			})
			.from(schema.instruments)
			.innerJoin(marketdata, eq(marketdata.instrumentId, schema.instruments.id))
			.where(and(...conditions));

		return instruments.map(instrument => ({
			...instrument,
			daily_return: parseFloat((instrument.daily_return as string | null) ?? '0')
		}));
	}
}
