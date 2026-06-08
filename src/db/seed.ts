import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';

const db = drizzle(process.env.DATABASE_URL!);

async function runSeed() {
	console.log('Seeding database from seed.sql...');

	const sqlPath = path.join(__dirname, 'seed.sql');
	const sqlContent = fs.readFileSync(sqlPath, 'utf8');

	// Clean up database tables and reset serial IDs to make the seed run idempotent
	await db.execute(sql.raw('TRUNCATE TABLE orders, marketdata, users, instruments RESTART IDENTITY CASCADE;'));

	await db.execute(sql.raw(sqlContent));

	console.log('Database seeded successfully from seed.sql!');
	await db.$client.end();
	process.exit(0);
}

runSeed().catch(err => {
	console.error('Seeding failed:', err);
	process.exit(1);
});
