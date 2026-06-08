import { describe, expect, it } from 'vitest';
import Server from '../../structures/Server';
import type UserService from '../users/users.service';
import { OrderSide, OrderType } from './types';

describe('Orders', async () => {
	const server = Server.getInstance();
	const userService = server.services.users;
	const instrumentService = server.services.instruments;
	const orderService = server.services.orders;

	const [ypfInstrument] = await instrumentService.searchInstruments('', { ticker: 'YPFD' });

	const ypfPrice = ypfInstrument.close!;

	let testUser: Awaited<ReturnType<UserService['createTestUser']>>;

	describe('Buy Operations (MARKET / LIMIT)', async () => {
		it('should deduct the trade value from the balance for a MARKET type operation', async () => {
			const startingBalance = ypfPrice * 10;
			testUser = await userService.createTestUser(startingBalance);

			const order = await orderService.placeOrder(
				testUser.id,
				ypfInstrument.id,
				OrderType.MARKET,
				OrderSide.BUY,
				{ size: 2 }
			);
			expect(order.status).toBe('FILLED');

			const userBalance = await userService.getUserCashBalance(testUser.id);

			expect(userBalance).toBe(startingBalance - ypfPrice * 2);

			await userService.deleteUser(testUser.id);
		});
		it('should deduct the trade value from the balance for a LIMIT type operation', async () => {
			const bidPrice = 500;
			const startingBalance = bidPrice * 2;
			testUser = await userService.createTestUser(startingBalance);

			const order = await orderService.placeOrder(testUser.id, ypfInstrument.id, OrderType.LIMIT, OrderSide.BUY, {
				size: 2,
				bidPrice
			});
			expect(order.status).toBe('NEW');

			const userBalance = await userService.getUserCashBalance(testUser.id);

			expect(userBalance).toBe(startingBalance - bidPrice * 2);

			await userService.deleteUser(testUser.id);
		});
	});

	describe('Rejection Scenarios', async () => {
		it('should reject a BUY order if the user has insufficient balance', async () => {
			const startingBalance = Math.floor(ypfPrice) - 1;
			testUser = await userService.createTestUser(startingBalance);

			const order = await orderService.placeOrder(
				testUser.id,
				ypfInstrument.id,
				OrderType.MARKET,
				OrderSide.BUY,
				{ size: 1 }
			);
			expect(order.status).toBe('REJECTED');

			const userBalance = await userService.getUserCashBalance(testUser.id);
			expect(userBalance).toBe(startingBalance);

			await userService.deleteUser(testUser.id);
		});

		it('should reject a SELL order if the user has insufficient shares', async () => {
			testUser = await userService.createTestUser(0);

			const order = await orderService.placeOrder(
				testUser.id,
				ypfInstrument.id,
				OrderType.MARKET,
				OrderSide.SELL,
				{ size: 1 }
			);
			expect(order.status).toBe('REJECTED');

			await userService.deleteUser(testUser.id);
		});
	});

	describe('Sell Operations', async () => {
		it('should deduct the shares and increase cash balance for a successful MARKET SELL operation', async () => {
			testUser = await userService.createTestUser(1000, [{ instrumentId: ypfInstrument.id, size: 5 }]);

			const order = await orderService.placeOrder(
				testUser.id,
				ypfInstrument.id,
				OrderType.MARKET,
				OrderSide.SELL,
				{ size: 2 }
			);
			expect(order.status).toBe('FILLED');

			const userBalance = await userService.getUserCashBalance(testUser.id);
			expect(userBalance).toBe(1000 + ypfPrice * 2);

			const portfolio = await userService.getUserPortfolio(testUser.id);
			const ypfAsset = portfolio.assets.find(a => a.ticker === 'YPFD');
			expect(ypfAsset).toBeDefined();
			expect(ypfAsset!.size).toBe(3);

			await userService.deleteUser(testUser.id);
		});
	});

	describe('Cancellation Operations', async () => {
		it('should release the locked balance when a LIMIT BUY order is cancelled', async () => {
			const bidPrice = 500;
			const startingBalance = bidPrice * 2;
			testUser = await userService.createTestUser(startingBalance);

			const order = await orderService.placeOrder(testUser.id, ypfInstrument.id, OrderType.LIMIT, OrderSide.BUY, {
				size: 2,
				bidPrice
			});
			expect(order.status).toBe('NEW');

			let userBalance = await userService.getUserCashBalance(testUser.id);
			expect(userBalance).toBe(startingBalance - bidPrice * 2);

			const cancelledOrder = await orderService.cancelUserOrder(order.id, testUser.id);
			expect(cancelledOrder.status).toBe('CANCELLED');

			userBalance = await userService.getUserCashBalance(testUser.id);
			expect(userBalance).toBe(startingBalance);

			await userService.deleteUser(testUser.id);
		});
	});

	describe('Concurrency / Race Conditions', async () => {
		it('should only fill one order and reject the rest when placing multiple concurrent orders with balance for only one', async () => {
			const startingBalance = Math.ceil(ypfPrice);
			testUser = await userService.createTestUser(startingBalance);

			// Place 15 concurrent MARKET BUY orders for 1 share each
			const orderPromises = Array.from({ length: 15 }).map(() =>
				orderService.placeOrder(testUser.id, ypfInstrument.id, OrderType.MARKET, OrderSide.BUY, { size: 1 })
			);

			const results = await Promise.all(orderPromises);

			const filledOrders = results.filter(o => o.status === 'FILLED');
			const rejectedOrders = results.filter(o => o.status === 'REJECTED');

			expect(filledOrders.length).toBe(1);
			expect(rejectedOrders.length).toBe(14);

			// After 1 filled order, balance should reflect the deduction
			const userBalance = await userService.getUserCashBalance(testUser.id);
			expect(userBalance).toBe(startingBalance - ypfPrice);

			await userService.deleteUser(testUser.id);
		});
	});

	describe('Validation Errors', () => {
		it('should return validation errors when request body is invalid', async () => {
			const response = await server.app.inject({
				method: 'POST',
				url: '/order',
				headers: {
					'user-id': '1'
				},
				payload: {
					type: OrderType.MARKET,
					side: OrderSide.BUY
				}
			});

			expect(response.statusCode).toBe(400);
			const body = JSON.parse(response.body);
			expect(body.error).toBeDefined();
			expect(body.validation).toBeDefined();
			expect(body.validation.length).toBeGreaterThan(0);
		});
	});

	describe('Cash Value Operations', async () => {
		it('should calculate the size and deduct the correct trade value from balance for a MARKET BUY order using cashValue', async () => {
			const startingBalance = Math.floor(ypfPrice * 10);
			testUser = await userService.createTestUser(startingBalance);

			const cashValue = ypfPrice * 2.5;
			const order = await orderService.placeOrder(
				testUser.id,
				ypfInstrument.id,
				OrderType.MARKET,
				OrderSide.BUY,
				{ cashValue }
			);

			expect(order.status).toBe('FILLED');
			expect(order.size).toBe(2);

			const userBalance = await userService.getUserCashBalance(testUser.id);
			expect(userBalance).toBe(startingBalance - ypfPrice * 2);

			await userService.deleteUser(testUser.id);
		});

		it('should calculate the size and increase the balance for a MARKET SELL order using cashValue', async () => {
			testUser = await userService.createTestUser(0, [{ instrumentId: ypfInstrument.id, size: 5 }]);

			const cashValue = ypfPrice * 2;
			const order = await orderService.placeOrder(
				testUser.id,
				ypfInstrument.id,
				OrderType.MARKET,
				OrderSide.SELL,
				{ cashValue }
			);

			expect(order.status).toBe('FILLED');
			expect(order.size).toBe(2);

			const userBalance = await userService.getUserCashBalance(testUser.id);
			expect(userBalance).toBe(ypfPrice * 2);

			const portfolio = await userService.getUserPortfolio(testUser.id);
			const ypfAsset = portfolio.assets.find(a => a.ticker === 'YPFD');
			expect(ypfAsset).toBeDefined();
			expect(ypfAsset!.size).toBe(3);

			await userService.deleteUser(testUser.id);
		});

		it('should reject a MARKET BUY order using cashValue if the user has insufficient balance', async () => {
			const startingBalance = Math.floor(ypfPrice * 1.5);
			testUser = await userService.createTestUser(startingBalance);

			const cashValue = ypfPrice * 2;
			const order = await orderService.placeOrder(
				testUser.id,
				ypfInstrument.id,
				OrderType.MARKET,
				OrderSide.BUY,
				{ cashValue }
			);

			expect(order.status).toBe('REJECTED');

			const userBalance = await userService.getUserCashBalance(testUser.id);
			expect(userBalance).toBe(startingBalance);

			await userService.deleteUser(testUser.id);
		});

		it('should throw an error if the cashValue is less than the price of a single share', async () => {
			testUser = await userService.createTestUser(Math.floor(ypfPrice * 10));

			const cashValue = ypfPrice - 1;

			await expect(
				orderService.placeOrder(testUser.id, ypfInstrument.id, OrderType.MARKET, OrderSide.BUY, { cashValue })
			).rejects.toThrow('The desired "cashValue" is less than a share.');

			await userService.deleteUser(testUser.id);
		});

		it('should throw an error if the cashValue is less than or equal to 0', async () => {
			testUser = await userService.createTestUser(Math.floor(ypfPrice * 10));

			await expect(
				orderService.placeOrder(testUser.id, ypfInstrument.id, OrderType.MARKET, OrderSide.BUY, {
					cashValue: 0
				})
			).rejects.toThrow('"cashValue" should be greater than 0');

			await expect(
				orderService.placeOrder(testUser.id, ypfInstrument.id, OrderType.MARKET, OrderSide.BUY, {
					cashValue: -100
				})
			).rejects.toThrow('"cashValue" should be greater than 0');

			await userService.deleteUser(testUser.id);
		});
	});

	describe('Service-Level Parameter Validations', async () => {
		it('should throw an error for MARKET operation if neither size nor cashValue is specified', async () => {
			testUser = await userService.createTestUser(Math.floor(ypfPrice * 10));

			await expect(
				orderService.placeOrder(testUser.id, ypfInstrument.id, OrderType.MARKET, OrderSide.BUY, {})
			).rejects.toThrow('for MARKET operations "size" or "cashValue" are required');

			await userService.deleteUser(testUser.id);
		});

		it('should throw an error for MARKET operation if size is <= 0', async () => {
			testUser = await userService.createTestUser(Math.floor(ypfPrice * 10));

			await expect(
				orderService.placeOrder(testUser.id, ypfInstrument.id, OrderType.MARKET, OrderSide.BUY, { size: 0 })
			).rejects.toThrow('"size" should be greater than 0');

			await expect(
				orderService.placeOrder(testUser.id, ypfInstrument.id, OrderType.MARKET, OrderSide.BUY, { size: -5 })
			).rejects.toThrow('"size" should be greater than 0');

			await userService.deleteUser(testUser.id);
		});

		it('should throw an error for LIMIT operation if bidPrice is missing', async () => {
			testUser = await userService.createTestUser(Math.floor(ypfPrice * 10));

			await expect(
				orderService.placeOrder(testUser.id, ypfInstrument.id, OrderType.LIMIT, OrderSide.BUY, { size: 2 })
			).rejects.toThrow('"bidPrice" is required for LIMIT operations');

			await userService.deleteUser(testUser.id);
		});

		it('should throw an error for LIMIT operation if bidPrice is <= 0', async () => {
			testUser = await userService.createTestUser(Math.floor(ypfPrice * 10));

			await expect(
				orderService.placeOrder(testUser.id, ypfInstrument.id, OrderType.LIMIT, OrderSide.BUY, {
					size: 2,
					bidPrice: 0
				})
			).rejects.toThrow('"bidPrice" should be greater than 0');

			await expect(
				orderService.placeOrder(testUser.id, ypfInstrument.id, OrderType.LIMIT, OrderSide.BUY, {
					size: 2,
					bidPrice: -100
				})
			).rejects.toThrow('"bidPrice" should be greater than 0');

			await userService.deleteUser(testUser.id);
		});

		it('should throw an error for LIMIT operation if size is missing', async () => {
			testUser = await userService.createTestUser(Math.floor(ypfPrice * 10));

			await expect(
				orderService.placeOrder(testUser.id, ypfInstrument.id, OrderType.LIMIT, OrderSide.BUY, {
					bidPrice: 500
				})
			).rejects.toThrow('"size" is required for LIMIT operations');

			await userService.deleteUser(testUser.id);
		});

		it('should throw an error for LIMIT operation if size is <= 0', async () => {
			testUser = await userService.createTestUser(Math.floor(ypfPrice * 10));

			await expect(
				orderService.placeOrder(testUser.id, ypfInstrument.id, OrderType.LIMIT, OrderSide.BUY, {
					size: 0,
					bidPrice: 500
				})
			).rejects.toThrow('"size" should be greater than 0');

			await expect(
				orderService.placeOrder(testUser.id, ypfInstrument.id, OrderType.LIMIT, OrderSide.BUY, {
					size: -2,
					bidPrice: 500
				})
			).rejects.toThrow('"size" should be greater than 0');

			await userService.deleteUser(testUser.id);
		});
	});
});
