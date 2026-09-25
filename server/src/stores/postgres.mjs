// postgres.mjs — store for any PostgreSQL: Neon, Supabase, self-hosted.
// Needs the optional `pg` package and DATABASE_URL (use the provider's pooled
// connection string; both Neon and Supabase require TLS).

import fs from "node:fs";
import { sqlStore } from "./sql.mjs";

export async function createPostgresStore(url) {
  const { default: pg } = await import("pg");
  // TLS with certificate verification (Neon/Supabase certs are publicly issued);
  // only a local dev URL with sslmode=disable connects in plain text.
  const ssl = /sslmode=disable/.test(url) ? false : { rejectUnauthorized: true };
  const pool = new pg.Pool({ connectionString: url, ssl, max: 5 });
  let n;
  const q = async (sql, params = []) => {
    n = 0;
    const text = sql.replace(/\?/g, () => `$${++n}`);
    return (await pool.query(text, params)).rows;
  };
  return sqlStore({
    kind: "postgres",
    q,
    insertIgnore: (body, keys) => `INSERT INTO ${body} ON CONFLICT (${keys}) DO NOTHING`,
    likePrefix: (col) => `${col} LIKE (? || '%')`,
    bool: (v) => (v ? "TRUE" : "FALSE"),
    isUniqueViolation: (e) => e && e.code === "23505",
    migrate: async () => pool.query(fs.readFileSync(new URL("../../sql/postgres.sql", import.meta.url), "utf8")),
    close: () => pool.end(),
  });
}
