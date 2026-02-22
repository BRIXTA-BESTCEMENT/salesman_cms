import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// This finds your .env file
dotenv.config({ path: '.env.local' }); 

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn('⚠️ DATABASE_URL is not set. Using a dummy connection string for build phase.');
}

export default defineConfig({
  // This tells Drizzle where to find your schema
  schema: './drizzle/schema.ts',
  
  // This tells Drizzle where to put the migration files
  out: './drizzle/migrations', 
  dialect: 'postgresql',
  dbCredentials: {
    url: DATABASE_URL || "postgres://dummy:dummy@localhost:5432/dummy",
  },
  verbose: true,
  strict: true,
});