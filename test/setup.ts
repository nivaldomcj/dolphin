// Tests wipe tables in beforeEach, so they must never open the real dolphin.db.
Bun.env.DOLPHIN_DB = ":memory:";
// Tests read the committed example, never your own dolphin.config.ts.
Bun.env.DOLPHIN_CONFIG = "dolphin.config.example.ts";
