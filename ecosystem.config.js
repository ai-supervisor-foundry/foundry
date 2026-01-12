module.exports = {
  apps: [
    {
      name: 'supervisor',
      script: 'npm',
      args: 'run cli -- start --redis-host localhost --redis-port 6499 --state-key supervisor:state --queue-name tasks --queue-db 2 --sandbox-root ./sandbox',
      cwd: '/home/ahmedhaider/work/projects/auto-layer/supervisor',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,  // DO NOT auto-restart - operator controls lifecycle via halt/resume/start commands
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/supervisor-error.log',
      out_file: './logs/supervisor-out.log',
      log_file: './logs/supervisor-combined.log',
      time: true,
      merge_logs: true,
    },
    {
      name: 'ui-backend',
      script: 'dist/server.js',
      cwd: './UI/backend',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '../../logs/ui-backend-error.log',
      out_file: '../../logs/ui-backend-out.log',
      time: true
    },
    {
      name: 'ui-frontend',
      script: 'npm',
      args: 'run preview -- --port 5173 --host',
      cwd: './UI/frontend',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      error_file: '../../logs/ui-frontend-error.log',
      out_file: '../../logs/ui-frontend-out.log',
      time: true
    }
  ],
};

