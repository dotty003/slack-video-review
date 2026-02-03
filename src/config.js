require('dotenv').config();

module.exports = {
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    appToken: process.env.SLACK_APP_TOKEN,
  },
  database: {
    // PostgreSQL connection string (used in production)
    url: process.env.DATABASE_URL,
    // SQLite path (used for local development)
    path: process.env.DATABASE_PATH || './data/reviews.db',
  },
};
