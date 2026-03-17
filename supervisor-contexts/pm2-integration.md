---
description: PM2 daemon configuration and lifecycle management
---

# PM2 Integration

The supervisor can be run as a daemon using PM2:

```bash
# Start supervisor with PM2
pm2 start npm --name supervisor -- run cli -- start --redis-host localhost --redis-port 6499 --state-key supervisor:state --queue-name tasks --queue-db 2

# View logs (use --nostream for historical logs)
pm2 logs supervisor --nostream

# Stop supervisor
pm2 stop supervisor

# Restart supervisor
pm2 restart supervisor
```
