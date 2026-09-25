// index.mjs — pick the store from the environment. Switching databases is a
// config change only:
//   DB_KIND=memory                                  (default; data lost on restart)
//   DB_KIND=postgres DATABASE_URL=postgres://...    (Neon, Supabase, any Postgres)
//   DB_KIND=mysql    DATABASE_URL=mysql://...

import { createMemoryStore } from "./memory.mjs";

export async function createStore(env = process.env) {
  const kind = (env.DB_KIND || "memory").toLowerCase();
  if (kind === "memory") return createMemoryStore();
  if (!env.DATABASE_URL) throw new Error(`DB_KIND=${kind} needs DATABASE_URL`);
  if (kind === "postgres" || kind === "neon" || kind === "supabase") {
    const { createPostgresStore } = await import("./postgres.mjs");
    return createPostgresStore(env.DATABASE_URL);
  }
  if (kind === "mysql" || kind === "mariadb") {
    const { createMysqlStore } = await import("./mysql.mjs");
    return createMysqlStore(env.DATABASE_URL);
  }
  throw new Error(`unknown DB_KIND: ${kind}`);
}
