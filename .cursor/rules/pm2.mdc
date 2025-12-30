---
description: Using pm2.
alwaysApply: false
---
1. PM2 logs check is always non-streamed, non-interactive.

2. Supervisor PM2 Management:
   - Supervisor runs via `npm run cli -- start` (uses tsx to run TypeScript directly, NOT a compiled binary)
   - Start: `pm2 start ecosystem.config.js` (NOT `pm2 start dist/index.js`)
   - Stop: First `npm run cli -- halt`, then `pm2 stop supervisor`, then `pm2 delete supervisor`
   - Restart: `pm2 restart supervisor` (after halt if needed)
   - The supervisor script is defined in ecosystem.config.js and uses npm/tsx, not a compiled dist file

3. On ANY error when starting/stopping supervisor, immediately halt and stop:
   - `npm run cli -- halt --redis-host localhost --redis-port 6499 --state-key supervisor:state --queue-name tasks --queue-db 2`
   - `pm2 stop supervisor`
   - `pm2 delete supervisor`