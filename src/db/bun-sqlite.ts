import type { Database } from "bun:sqlite";
import type { SqliteDatabase } from "kysely";

/**
 * Adapts `bun:sqlite` to the better-sqlite3 shape that Kysely's built-in SqliteDialect expects:
 * Kysely passes parameters as one array and reads a `reader` flag, while bun:sqlite takes spread
 * parameters and exposes `columnNames` instead.
 */
export function bunSqlite(raw: Database): SqliteDatabase {
  return {
    close: () => raw.close(),
    prepare(text) {
      const stmt = raw.prepare(text);
      const args = (p: ReadonlyArray<unknown>) => p as Parameters<typeof stmt.all>;
      return {
        reader: stmt.columnNames.length > 0,
        all: (p) => stmt.all(...args(p)),
        run: (p) => stmt.run(...args(p)),
        iterate: (p) => stmt.iterate(...args(p)),
      };
    },
  };
}
