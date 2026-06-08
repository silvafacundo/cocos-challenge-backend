import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import express, { type Express, type Request } from 'express';
import InstrumentController from './controllers/InstrumentController';
import UserController from './controllers/UserController';
import * as schema from './db/schema';
import { PublicError } from './errors/PublicError';

export type DbTransaction = Parameters<Parameters<ReturnType<typeof drizzle>['transaction']>[0]>[0];

const app: Express = express();
const PORT = process.env.PORT || 3000;

function getUserId(req: Request) {
	if (typeof req.headers['user-id'] === 'string') {
		return parseInt(req.headers['user-id'], 10);
	}

	return 1;
}

export default class Server {
	private static instance: Server;

	public readonly db: ReturnType<typeof drizzle>;

	private app: Express;

	public readonly controllers: {
		users: UserController;
		instruments: InstrumentController;
	};

	protected constructor() {
		Server.instance = this;

		this.db = drizzle(process.env.DATABASE_URL!);

		this.controllers = {
			users: new UserController(),
			instruments: new InstrumentController()
		};

		this.app = express();
		app.use(express.json());

		// Register routes

		app.get('/', (_req, res) => {
			res.json({
				status: 'ok'
			});
		});

		app.get('/portfolio', async (req, res) => {
			const userId = getUserId(req);
			const portfolio = await this.controllers.users.getUserPortfolio(userId);
			return res.json(portfolio);
		});

		app.get('/search', async (req, res) => {
			const { query, type, ticker, name } = req.query;

			const instruments = await this.controllers.instruments.searchInstruments(query?.toString() || '', {
				type: typeof type === 'string' ? [type] : undefined,
				ticker: ticker?.toString(),
				name: name?.toString()
			});

			return res.json(instruments);
		});

		app.post('/order', async (req, res) => {
			try {
				const userId = getUserId(req);

				const { type, side, ticker, size, bidPrice, cashValue } = req.body;

				if (!['MARKET', 'LIMIT'].includes(type)) throw new PublicError('Invalid order type');
				if (!['BUY', 'SELL'].includes(side)) throw new PublicError('Invalid order side');

				// Validate ticker
				if (typeof ticker !== 'string') throw new PublicError('Missing ticker parameter');
				const [instrument] = await this.db
					.select()
					.from(schema.instruments)
					.where(eq(schema.instruments.ticker, ticker))
					.limit(1);
				if (!instrument) throw new PublicError('Invalid ticker');

				if (typeof size !== 'undefined' && typeof size !== 'number')
					throw new PublicError('"size" should be a number');
				if (typeof bidPrice !== 'undefined' && typeof bidPrice !== 'number')
					throw new PublicError('"bidPrice" should be a number');
				if (typeof cashValue !== 'undefined' && typeof cashValue !== 'number')
					throw new PublicError('"cashValue" should be a number');

				const order = await this.controllers.users.placeOrder(userId, instrument.id, type, side, {
					size,
					bidPrice,
					cashValue
				});

				return res.json({ ...order });
			} catch (error) {
				return this.handleError(res, error, 'Error creating order');
			}
		});

		app.delete('/order/:orderId', async (req, res) => {
			const userId = getUserId(req);
			const orderId = parseInt(req.params.orderId, 10);
			try {
				const order = await this.controllers.users.cancelUserOrder(orderId, userId);

				return res.json({ ...order });
			} catch (error) {
				return this.handleError(res, error, 'Error canceling order');
			}
		});
	}

	public async initialize() {
		// Test users
		const userCount = await this.db.$count(schema.users);
		console.log(`🟢[database]: Database connected. ${userCount} users`);

		return new Promise<void>((res, rej) => {
			app.listen(PORT, error => {
				if (error) rej(error);
				console.log(`⚡️[server]: Server is running at http://localhost:${PORT}`);
				res();
			});
		});
	}

	public static getInstance() {
		if (!Server.instance) return new Server();
		return Server.instance;
	}

	private handleError(res: express.Response, error: unknown, contextMessage: string) {
		if (error instanceof PublicError) {
			return res.status(400).json({ error: error.message });
		}
		console.error(`${contextMessage}:`, error);
		return res.status(500).json({ error: 'unexpected error' });
	}
}
