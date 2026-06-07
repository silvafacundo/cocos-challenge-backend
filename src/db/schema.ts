import { date, foreignKey, integer, numeric, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';

export const instruments = pgTable('instruments', {
	id: serial().primaryKey().notNull(),
	ticker: varchar({ length: 10 }),
	name: varchar({ length: 255 }),
	type: varchar({ length: 10 })
});

export const orders = pgTable(
	'orders',
	{
		id: serial().primaryKey().notNull(),
		instrumentid: integer(),
		userid: integer(),
		size: integer(),
		price: numeric({ precision: 10, scale: 2, mode: 'number' }),
		type: varchar({ length: 10 }),
		side: varchar({ length: 10 }),
		status: varchar({ length: 20 }),
		datetime: timestamp({ mode: 'string' })
	},
	table => [
		foreignKey({
			columns: [table.instrumentid],
			foreignColumns: [instruments.id],
			name: 'orders_instrumentid_fkey'
		}),
		foreignKey({
			columns: [table.userid],
			foreignColumns: [users.id],
			name: 'orders_userid_fkey'
		})
	]
);

export const users = pgTable('users', {
	id: serial().primaryKey().notNull(),
	email: varchar({ length: 255 }),
	accountnumber: varchar({ length: 20 })
});

export const marketdata = pgTable(
	'marketdata',
	{
		id: serial().primaryKey().notNull(),
		instrumentid: integer(),
		high: numeric({ precision: 10, scale: 2, mode: 'number' }),
		low: numeric({ precision: 10, scale: 2, mode: 'number' }),
		open: numeric({ precision: 10, scale: 2, mode: 'number' }),
		close: numeric({ precision: 10, scale: 2, mode: 'number' }),
		previousclose: numeric({ precision: 10, scale: 2, mode: 'number' }),
		date: date()
	},
	table => [
		foreignKey({
			columns: [table.instrumentid],
			foreignColumns: [instruments.id],
			name: 'marketdata_instrumentid_fkey'
		})
	]
);
