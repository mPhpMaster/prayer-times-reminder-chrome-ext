// mysql.mjs — store for MySQL 8+ / MariaDB. Needs the optional `mysql2`
// package and DATABASE_URL (mysql://user:pass@host:3306/db).

import fs from "node:fs";
import { sqlStore } from "./sql.mjs";

export async function createMysqlStore(url) {
  const mysql = await import("mysql2/promise");
  const pool = mysql.createPool({ uri: url, connectionLimit: 5, charset: "utf8mb4", supportBigNumbers: true });
  const q = async (sql, params = []) => (await pool.query(sql, params))[0];
  return sqlStore({
    kind: "mysql",
    q,
    insertIgnore: (body) => `INSERT IGNORE INTO ${body}`,
    likePrefix: (col) => `${col} LIKE CONCAT(?, '%')`,
    bool: (v) => (v ? "1" : "0"),
    isUniqueViolation: (e) => e && e.code === "ER_DUP_ENTRY",
    migrate: async () => {
      const statements = fs
        .readFileSync(new URL("../../sql/mysql.sql", import.meta.url), "utf8")
        .split(/;\s*$/m)
        .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
        .filter(Boolean);
      for (const s of statements) await pool.query(s);
    },
    close: () => pool.end(),
  });
}
