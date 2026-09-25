// migrate.mjs — create the tables for the configured DB_KIND (idempotent).
import { createStore } from "./stores/index.mjs";

const store = await createStore();
await store.migrate();
console.log(`migrated (${store.kind})`);
await store.close();
