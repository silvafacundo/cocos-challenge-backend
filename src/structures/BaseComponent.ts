import Server from './Server';
export default class BaseComponent {
	protected readonly server: Server;

	public constructor() {
		this.server = Server.getInstance();
	}

	protected get db() {
		return this.server.db;
	}

	protected get controllers() {
		return this.server.controllers;
	}

	protected get services() {
		return this.server.services;
	}
}
