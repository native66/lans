import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

// Note: In production, ensure DATABASE_URL is set securely.
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/lans_db';

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export const getDb = () => {
  if (!dbInstance) {
    try {
      const client = postgres(connectionString, { prepare: false });
      dbInstance = drizzle(client, { schema });
      console.log("Database initialized");
    } catch (e) {
      console.warn("Failed to initialize database, ignoring in mock environment:", e);
    }
  }
  return dbInstance;
};

// Exporting a lazy initialized instance
export const db = new Proxy({} as any, {
  get: (target, prop) => {
    const instance = getDb();
    if (instance) {
      return (instance as any)[prop];
    }
    return undefined;
  }
});
