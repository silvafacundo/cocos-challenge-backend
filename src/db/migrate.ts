import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const db = drizzle(process.env.DATABASE_URL!);

async function runMigrations() {
	console.log('Running migrations...');

	await migrate(db, { migrationsFolder: './src/db' });

	console.log('Migrations applied successfully!');

	await db.$client.end();
	process.exit(0);
}

runMigrations().catch(err => {
	console.error('Migration failed:', err);
	process.exit(1);
});
