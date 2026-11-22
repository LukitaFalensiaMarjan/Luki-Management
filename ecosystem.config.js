module.exports = {
  apps: [
    {
      name: 'luki-management',
      script: 'server/index.js',
      node_args: '--disable-warning=ExperimentalWarning',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '350M',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',
        TRUST_PROXY: '1',
        COOKIE_SECURE: '1'
      },
      error_file: 'data/pm2-error.log',
      out_file: 'data/pm2-out.log',
      time: true
    }
  ]
};
