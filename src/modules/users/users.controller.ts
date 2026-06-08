import BaseComponent from '../../structures/BaseComponent';
import getUserFromHeader from '../../utils/getUserFromHeader';

export default class UserController extends BaseComponent {
	public constructor() {
		super();

		this.server.app.get('/portfolio', async req => {
			const userId = getUserFromHeader(req);

			const portfolio = await this.services.users.getUserPortfolio(userId);
			return portfolio;
		});
	}
}
