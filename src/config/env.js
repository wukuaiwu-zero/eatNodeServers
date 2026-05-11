require('dotenv').config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  useMockDb: process.env.USE_MOCK_DB === 'true',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'node_servers',
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10
  }
};

module.exports = { env };
