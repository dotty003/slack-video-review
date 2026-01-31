const { App } = require('@slack/bolt');
const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { getDb } = require('./database/db');
const { handleCommand } = require('./handlers/commands');
const { handleFileShared, handleMessage } = require('./handlers/events');
const { createApiRouter } = require('./routes/api');

// Validate required environment variables
if (!config.slack.botToken || !config.slack.signingSecret || !config.slack.appToken) {
    console.error('❌ Missing required environment variables!');
    console.error('Please create a .env file based on .env.example with your Slack credentials.');
    process.exit(1);
}

// Initialize the Bolt app with Socket Mode
const app = new App({
    token: config.slack.botToken,
    signingSecret: config.slack.signingSecret,
    socketMode: true,
    appToken: config.slack.appToken,
});

// Create separate Express server for web UI
const expressApp = express();

// Middleware
expressApp.use(cors());
expressApp.use(express.json());

// Serve static files (video player UI)
expressApp.use(express.static(path.join(__dirname, '../public')));

// Get base URL from environment or default
const port = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${port}`;

// Mount API routes (pass Slack client for posting messages)
expressApp.use('/api', createApiRouter(app.client));

// Review page route
expressApp.get('/review', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Health check for Render
expressApp.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Handle bot mentions
app.event('app_mention', async ({ client, event, say }) => {
    try {
        await handleCommand({ client, event, say });
    } catch (err) {
        console.error('Error handling app_mention:', err);
        await say({
            text: '❌ An error occurred processing your command.',
            thread_ts: event.thread_ts || event.ts,
        });
    }
});

// Handle file shared events (for video uploads)
app.event('file_shared', async ({ client, event }) => {
    try {
        await handleFileShared({ client, event, baseUrl: BASE_URL });
    } catch (err) {
        console.error('Error handling file_shared:', err);
    }
});

// Handle messages (for video URL detection)
app.event('message', async ({ client, event }) => {
    // Ignore message_changed, message_deleted, etc.
    if (event.subtype) return;

    try {
        await handleMessage({ client, event });
    } catch (err) {
        console.error('Error handling message:', err);
    }
});

// Start both servers
(async () => {
    // Initialize database first
    await getDb();

    // Start Express web server
    expressApp.listen(port, () => {
        console.log(`🌐 Web server running on port ${port}`);
    });

    // Start Bolt app (Socket Mode)
    await app.start();

    console.log('');
    console.log('🎬 ================================================');
    console.log('   ReviewBot is running!');
    console.log(`   Web Player: ${BASE_URL}/review?video=ID`);
    console.log('================================================ 🎬');
    console.log('');
})();
