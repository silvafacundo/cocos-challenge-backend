import type { FastifyRequest } from 'fastify';
export default function getUserFromHeader(req: FastifyRequest) {
	if (typeof req.headers['user-id'] === 'string') {
		return parseInt(req.headers['user-id'], 10);
	}

	return 1;
}
