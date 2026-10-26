module.exports = {
  apps: [
    {
      name: 'netpulse-noc-server',
      script: './server/server.js',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        DATA_DIR: './data'
      }
    }
  ]
};
