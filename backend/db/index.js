import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('CRITICAL: DATABASE_URL is not set in backend/.env');
}

const sql = neon(databaseUrl);
export const db = drizzle(sql, { schema });
