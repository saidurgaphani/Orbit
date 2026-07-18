import { db } from '../db/index.js';
import * as schema from '../db/schema.js';

async function main() {
  console.log('Checking database connection & schema tables...');
  try {
    const res = await db.select().from(schema.aiMemories).limit(1);
    console.log('Success! ai_memories table is accessible. Found records:', res.length);
  } catch (err) {
    console.error('Error selecting from ai_memories:', err.message);
    console.log('Attempting db:push...');
  }
}

main().catch(err => console.error(err));
