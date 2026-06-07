import { relations } from 'drizzle-orm/relations';
import { instruments, marketdata, orders, users } from './schema';

export const ordersRelations = relations(orders, ({ one }) => ({
	instrument: one(instruments, {
		fields: [orders.instrumentid],
		references: [instruments.id]
	}),
	user: one(users, {
		fields: [orders.userid],
		references: [users.id]
	})
}));

export const instrumentsRelations = relations(instruments, ({ many }) => ({
	orders: many(orders),
	marketdata: many(marketdata)
}));

export const usersRelations = relations(users, ({ many }) => ({
	orders: many(orders)
}));

export const marketdataRelations = relations(marketdata, ({ one }) => ({
	instrument: one(instruments, {
		fields: [marketdata.instrumentid],
		references: [instruments.id]
	})
}));
