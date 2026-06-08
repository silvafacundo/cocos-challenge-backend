import 'dotenv/config';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { drizzle } from 'drizzle-orm/node-postgres';
import Fastify, {
	type FastifyBaseLogger,
	type FastifyInstance,
	type RawReplyDefaultExpression,
	type RawRequestDefaultExpression,
	type RawServerDefault
} from 'fastify';
export type FastifyTypeBoxInstance = FastifyInstance<
	RawServerDefault,
	RawRequestDefaultExpression<RawServerDefault>,
	RawReplyDefaultExpression<RawServerDefault>,
	FastifyBaseLogger,
	TypeBoxTypeProvider
>;

import * as schema from '../db/schema';

import { PublicError } from '../errors/PublicError';

import InstrumentController from '../modules/instruments/instrument.controller';
import InstrumentService from '../modules/instruments/instrument.service';
import OrderController from '../modules/orders/orders.controller';
import OrderService from '../modules/orders/orders.service';
import UserController from '../modules/users/users.controller';
import UserService from '../modules/users/users.service';

export type DbTransaction = Parameters<Parameters<ReturnType<typeof drizzle>['transaction']>[0]>[0];

const PORT = process.env.PORT || 3000;

export default class Server {
	private static instance: Server;

	public readonly db: ReturnType<typeof drizzle>;

	public app: FastifyTypeBoxInstance;

	public readonly controllers: {
		users: UserController;
		instruments: InstrumentController;
		orders: OrderController;
	};

	public readonly services: {
		users: UserService;
		instruments: InstrumentService;
		orders: OrderService;
	};

	protected constructor() {
		Server.instance = this;

		this.db = drizzle(process.env.DATABASE_URL!);

		this.services = {
			users: new UserService(),
			instruments: new InstrumentService(),
			orders: new OrderService()
		};

		this.app = Fastify().withTypeProvider<TypeBoxTypeProvider>();

		// Support for "PublicError"
		this.app.setErrorHandler((error, _request, reply) => {
			if (error instanceof PublicError) {
				reply.status(400).send({ error: error.message });
				return;
			}
			if (
				error instanceof Error &&
				'code' in error &&
				error.code === 'FST_ERR_VALIDATION' &&
				'validation' in error
			) {
				reply.status(400).send({
					error: error.message,
					validation: (error as any).validation
				});
				return;
			}

			reply.status(500).send({ error: 'unexpected error' });
		});

		// root route
		this.app.get('/', (_req, res) => {
			res.send({ status: 'ok' });
		});

		// Register controllers
		this.controllers = {
			users: new UserController(),
			instruments: new InstrumentController(),
			orders: new OrderController()
		};
	}

	public async initialize() {
		// Test users
		const userCount = await this.db.$count(schema.users);
		console.log(`🟢[database]: Database connected. ${userCount} users`);

		await this.app.listen({ port: 3000 });
		console.log(`⚡️[server]: Server is running at http://localhost:${PORT}`);
	}

	public static getInstance() {
		if (!Server.instance) return new Server();
		return Server.instance;
	}
}
