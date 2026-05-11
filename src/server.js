const app = require('./app');
const { env } = require('./config/env');

const server = app.listen(env.port, () => {
  console.log(`Server is running on http://localhost:${env.port}`);
});

process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
