require('dotenv').config();
const crypto = require('crypto');

module.exports = {
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    appToken: process.env.SLACK_APP_TOKEN,
    clientId: process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_CLIENT_SECRET,
    stateSecret: process.env.SLACK_STATE_SECRET || crypto.randomBytes(16).toString('hex'),
  },
  database: {
    // PostgreSQL connection string (used in production)
    url: process.env.DATABASE_URL,
    // SQLite path (used for local development)
    path: process.env.DATABASE_PATH || './data/reviews.db',
  },
  auth: {
    // Secret for HMAC-signing review tokens.
    // If REVIEW_TOKEN_SECRET is not set, we derive a stable fallback from the Slack signing secret
    // to prevent all review links from becoming invalid every time the server restarts on Render.
    tokenSecret: process.env.REVIEW_TOKEN_SECRET || crypto.createHash('sha256').update(process.env.SLACK_SIGNING_SECRET || crypto.randomBytes(32).toString('hex')).digest('hex'),
    // Token TTL in seconds (default: 7 days)
    tokenTTL: parseInt(process.env.REVIEW_TOKEN_TTL, 10) || 604800,
  },
  admin: {
    // Password for accessing the admin dashboard
    secret: process.env.ADMIN_SECRET || 'changeme',
  },
};
