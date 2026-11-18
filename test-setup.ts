// Tests wipe tables in beforeEach, so they must never open the real dolphin.db.
Bun.env.DOLPHIN_DB = ":memory:";
