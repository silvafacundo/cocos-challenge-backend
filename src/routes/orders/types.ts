export enum OrderType {
	MARKET = 'MARKET',
	LIMIT = 'LIMIT'
}

export enum OrderSide {
	BUY = 'BUY',
	SELL = 'SELL'
}

export interface PlaceOrderParams {
	size?: number;
	bidPrice?: number;
	cashValue?: number;
}
