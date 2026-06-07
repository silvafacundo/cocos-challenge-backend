import { describe, expect, it } from 'vitest';
import type UserController from '../controllers/UserController';
import Server from '../Server';

describe('Orders', async () => {
	const server = Server.getInstance();
	const userController = server.controllers.users;
	const instrumentController = server.controllers.instruments;

	const [ypfInstrument] = await instrumentController.searchInstruments('', { ticker: 'YPFD' });

	const ypfPrice = ypfInstrument.close!;

	let testUser: Awaited<ReturnType<UserController['createTestUser']>>;

	describe('Buy Operations (MARKET / LIMIT)', async () => {
		it('should deduct the trade value from the balance for a MARKET type operation', async () => {
			const startingBalance = ypfPrice * 10;
			testUser = await userController.createTestUser(startingBalance);

			const order = await userController.placeOrder(testUser.id, ypfInstrument.id, 'MARKET', 'BUY', { size: 2 });
			expect(order.status).toBe('FILLED');

			const userBalance = await userController.getUserCashBalance(testUser.id);

			expect(userBalance).toBe(startingBalance - ypfPrice * 2);

			await userController.deleteUser(testUser.id);
		});
		it('should deduct the trade value from the balance for a LIMIT type operation', async () => {
			const bidPrice = 500;
			const startingBalance = bidPrice * 2;
			testUser = await userController.createTestUser(startingBalance);

			const order = await userController.placeOrder(testUser.id, ypfInstrument.id, 'LIMIT', 'BUY', {
				size: 2,
				bidPrice
			});
			expect(order.status).toBe('NEW');

			const userBalance = await userController.getUserCashBalance(testUser.id);

			expect(userBalance).toBe(startingBalance - bidPrice * 2);

			await userController.deleteUser(testUser.id);
		});
	});

	describe('Rejection Scenarios', async () => {
		it('should reject a BUY order if the user has insufficient balance', async () => {
			const startingBalance = Math.floor(ypfPrice) - 1;
			testUser = await userController.createTestUser(startingBalance);

			const order = await userController.placeOrder(testUser.id, ypfInstrument.id, 'MARKET', 'BUY', { size: 1 });
			expect(order.status).toBe('REJECTED');

			const userBalance = await userController.getUserCashBalance(testUser.id);
			expect(userBalance).toBe(startingBalance);

			await userController.deleteUser(testUser.id);
		});

		it('should reject a SELL order if the user has insufficient shares', async () => {
			testUser = await userController.createTestUser(0);

			const order = await userController.placeOrder(testUser.id, ypfInstrument.id, 'MARKET', 'SELL', { size: 1 });
			expect(order.status).toBe('REJECTED');

			await userController.deleteUser(testUser.id);
		});
	});

	describe('Sell Operations', async () => {
		it('should deduct the shares and increase cash balance for a successful MARKET SELL operation', async () => {
			testUser = await userController.createTestUser(1000, [{ instrumentId: ypfInstrument.id, size: 5 }]);

			const order = await userController.placeOrder(testUser.id, ypfInstrument.id, 'MARKET', 'SELL', { size: 2 });
			expect(order.status).toBe('FILLED');

			const userBalance = await userController.getUserCashBalance(testUser.id);
			expect(userBalance).toBe(1000 + ypfPrice * 2);

			const portfolio = await userController.getUserPortfolio(testUser.id);
			const ypfAsset = portfolio.assets.find(a => a.ticker === 'YPFD');
			expect(ypfAsset).toBeDefined();
			expect(ypfAsset!.size).toBe(3);

			await userController.deleteUser(testUser.id);
		});
	});

	describe('Cancellation Operations', async () => {
		it('should release the locked balance when a LIMIT BUY order is cancelled', async () => {
			const bidPrice = 500;
			const startingBalance = bidPrice * 2;
			testUser = await userController.createTestUser(startingBalance);

			const order = await userController.placeOrder(testUser.id, ypfInstrument.id, 'LIMIT', 'BUY', {
				size: 2,
				bidPrice
			});
			expect(order.status).toBe('NEW');

			let userBalance = await userController.getUserCashBalance(testUser.id);
			expect(userBalance).toBe(startingBalance - bidPrice * 2);

			const cancelledOrder = await userController.cancelUserOrder(order.id, testUser.id);
			expect(cancelledOrder.status).toBe('CANCELLED');

			userBalance = await userController.getUserCashBalance(testUser.id);
			expect(userBalance).toBe(startingBalance);

			await userController.deleteUser(testUser.id);
		});
	});

	describe('Concurrency / Race Conditions', async () => {
		it('should only fill one order and reject the rest when placing multiple concurrent orders with balance for only one', async () => {
			const startingBalance = Math.ceil(ypfPrice);
			testUser = await userController.createTestUser(startingBalance);

			// Place 10 concurrent MARKET BUY orders for 1 share each
			const orderPromises = Array.from({ length: 15 }).map(() =>
				userController.placeOrder(testUser.id, ypfInstrument.id, 'MARKET', 'BUY', { size: 1 })
			);

			const results = await Promise.all(orderPromises);

			const filledOrders = results.filter(o => o.status === 'FILLED');
			const rejectedOrders = results.filter(o => o.status === 'REJECTED');

			expect(filledOrders.length).toBe(1);
			expect(rejectedOrders.length).toBe(14);

			// After 1 filled order, balance should reflect the deduction
			const userBalance = await userController.getUserCashBalance(testUser.id);
			expect(userBalance).toBe(startingBalance - ypfPrice);

			await userController.deleteUser(testUser.id);
		});
	});
});
