const { App, ExpressReceiver } = require('@slack/bolt');
const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { getDb } = require('./database/db');
const { handleCommand } = require('./handlers/commands');
const { handleFileShared, handleMessage } = require('./handlers/events');
const { createApiRouter } = require('./routes/api');
const {
    storeInstallation,
    fetchInstallation,
    deleteInstallation,
} = require('./database/installationStore');

// ================================================
// Determine mode: OAuth (multi-workspace) vs Legacy (single-workspace)
// ================================================
const isOAuthMode = !!(config.slack.clientId && config.slack.clientSecret);

// Get base URL from environment or default
const port = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${port}`;

let app;
let expressApp;

if (isOAuthMode) {
    // ================================================
    // OAuth Mode: Multi-workspace support
    // Uses ExpressReceiver — Slack events are received via HTTP
    // ================================================
    console.log('🔐 Starting in OAuth mode (multi-workspace)');

    const receiver = new ExpressReceiver({
        signingSecret: config.slack.signingSecret,
        clientId: config.slack.clientId,
        clientSecret: config.slack.clientSecret,
        stateSecret: config.slack.stateSecret,
        scopes: [
            'channels:history',
            'channels:read',
            'chat:write',
            'files:read',
            'files:write',
            'users:read',
            'app_mentions:read',
            'reactions:write',
            'reactions:read',
        ],
        installationStore: {
            storeInstallation: async (installation) => {
                await storeInstallation(installation);
            },
            fetchInstallation: async (installQuery) => {
                return await fetchInstallation(installQuery);
            },
            deleteInstallation: async (installQuery) => {
                await deleteInstallation(installQuery);
            },
        },
        installerOptions: {
            directInstall: true,
        },
    });

    app = new App({ receiver });
    expressApp = receiver.app;

} else {
    // ================================================
    // Legacy Mode: Single-workspace (Socket Mode)
    // Uses hardcoded tokens from .env — for development or existing setups
    // ================================================
    console.log('🔧 Starting in Legacy mode (single-workspace, Socket Mode)');

    if (!config.slack.botToken || !config.slack.signingSecret || !config.slack.appToken) {
        console.error('❌ Missing required environment variables!');
        console.error('For multi-workspace: set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET');
        console.error('For single-workspace: set SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, SLACK_APP_TOKEN');
        process.exit(1);
    }

    app = new App({
        token: config.slack.botToken,
        signingSecret: config.slack.signingSecret,
        socketMode: true,
        appToken: config.slack.appToken,
    });

    expressApp = express();
}

// ================================================
// Middleware (applied in both modes)
// ================================================
expressApp.use(cors());
expressApp.use(express.json({ limit: '50mb' }));
expressApp.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files (video player UI)
expressApp.use(express.static(path.join(__dirname, '../public')));

// ================================================
// API & Page Routes
// ================================================

// Mount API routes (pass Slack app for posting messages)
expressApp.use('/api', createApiRouter(app));

// Review page route
expressApp.get('/review', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Privacy Policy page
expressApp.get('/privacy', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages/privacy.html'));
});

// Terms of Service page
expressApp.get('/terms', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages/terms.html'));
});

// Health check for Render
expressApp.get('/health', (req, res) => {
    res.json({ status: 'ok', mode: isOAuthMode ? 'oauth' : 'legacy' });
});

// ================================================
// Slack Event Handlers
// ================================================

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
app.event('file_shared', async ({ client, event, body }) => {
    try {
        const teamId = body?.team_id || event?.team || null;
        await handleFileShared({ client, event, baseUrl: BASE_URL, teamId });
    } catch (err) {
        console.error('Error handling file_shared:', err);
    }
});

// Handle messages (for video URL detection)
app.event('message', async ({ client, event, body }) => {
    // Ignore message_changed, message_deleted, etc.
    if (event.subtype) return;

    try {
        const teamId = body?.team_id || event?.team || null;
        await handleMessage({ client, event, teamId });
    } catch (err) {
        console.error('Error handling message:', err);
    }
});

// ================================================
// Start Server
// ================================================
(async () => {
    // Initialize database first
    await getDb();

    if (isOAuthMode) {
        // ExpressReceiver handles its own HTTP server
        await app.start(port);
        console.log('');
        console.log('🎬 ================================================');
        console.log('   ReviewBot is running! (OAuth Mode)');
        console.log(`   Web Player: ${BASE_URL}/review?video=ID`);
        console.log(`   Install:    ${BASE_URL}/slack/install`);
        console.log(`   OAuth CB:   ${BASE_URL}/slack/oauth_redirect`);
        console.log('================================================ 🎬');
        console.log('');
    } else {
        // Legacy mode: separate Express server + Socket Mode
        expressApp.listen(port, () => {
            console.log(`🌐 Web server running on port ${port}`);
        });

        await app.start();
        console.log('');
        console.log('🎬 ================================================');
        console.log('   ReviewBot is running! (Legacy Mode)');
        console.log(`   Web Player: ${BASE_URL}/review?video=ID`);
        console.log('================================================ 🎬');
        console.log('');
    }
})();
