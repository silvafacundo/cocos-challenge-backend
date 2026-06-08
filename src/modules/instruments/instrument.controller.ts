import Type from 'typebox';
import BaseComponent from '../../structures/BaseComponent';

export default class InstrumentController extends BaseComponent {
	public constructor() {
		super();

		this.server.app.get(
			'/search',
			{
				schema: {
					querystring: Type.Object({
						query: Type.String(),
						ticker: Type.Optional(Type.String()),
						name: Type.Optional(Type.String()),
						type: Type.Optional(Type.String())
					})
				}
			},
			async req => {
				const search = await this.services.instruments.searchInstruments(req.query.query, {
					type: req.query.type ? [req.query.type] : undefined,
					name: req.query.name,
					ticker: req.query.ticker
				});
				return search;
			}
		);
	}
}
