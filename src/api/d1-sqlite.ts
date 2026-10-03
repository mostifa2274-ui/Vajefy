import { DatabaseSync, type StatementSync } from "node:sqlite";

/** Cloudflare D1's interface over Node's SQLite, so tests run the real SQL. Tests only. */
export function sqliteD1(): D1DatabaseLike {
  const sqlite = new DatabaseSync(":memory:");
  const statement = (sql: string, values: unknown[] = []): D1PreparedStatementLike & { exec: () => unknown } => {
    const prepared = (): StatementSync => sqlite.prepare(sql);
    const args = values as (string | number | null)[];
    return {
      bind: (...next: unknown[]) => statement(sql, next),
      first: async <T>() => (prepared().get(...args) as T | undefined) ?? null,
      all: async <T>() => ({ results: prepared().all(...args) as T[] }),
      run: async () => prepared().run(...args),
      exec: () => prepared().run(...args),
    };
  };
  return {
    prepare: (sql) => statement(sql),
    batch: async (statements) => {
      sqlite.exec("BEGIN");
      try {
        const results = statements.map((item) => (item as ReturnType<typeof statement>).exec());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
