/** Writes today's backup now, replacing one made earlier today. Usage: bun run backup */
import { backup } from "../core/backup";

const target = await backup({ force: true });
console.log(target ? `Backup written to ${target}` : "Backups are off (backup: false in dolphin.config.ts).");
