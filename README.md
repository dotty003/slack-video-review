# 🎬 ReviewBot - Slack Video Review Tool

A Slack bot that enables timestamp-based video comments for marketing agency teams. Inspired by Frame.io's collaborative review workflow.

## Features

- **Video Detection**: Automatically detects video uploads and video URLs (YouTube, Vimeo, Loom, Google Drive, Dropbox)
- **Timestamp Comments**: Add feedback at specific video timestamps
- **Comment Resolution**: Mark comments as resolved/unresolved
- **Threaded Discussions**: All comments stay organized in video threads
- **Uploader Notifications**: Video uploaders get notified of new comments

## Setup

### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name it "ReviewBot" and select your workspace

### 2. Configure Bot Permissions

Go to **OAuth & Permissions** and add these Bot Token Scopes:
- `app_mentions:read` - Respond to @mentions
- `channels:history` - Read channel messages
- `channels:read` - Access channel info
- `chat:write` - Post messages
- `files:read` - Access uploaded files
- `reactions:write` - Add emoji reactions
- `users:read` - Get user info
- `im:write` - Send DMs (for notifications)

### 3. Enable Socket Mode

1. Go to **Socket Mode** and enable it
2. Generate an App-Level Token with `connections:write` scope
3. Save the token (starts with `xapp-`)

### 4. Enable Events

Go to **Event Subscriptions** and subscribe to:
- `app_mention`
- `file_shared`
- `message.channels`

### 5. Install the App

1. Go to **Install App** and click "Install to Workspace"
2. Authorize the permissions
3. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

### 6. Get Signing Secret

Go to **Basic Information** and copy the **Signing Secret**

### 7. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token
```

### 8. Install & Run

```bash
npm install
npm start
```

## Usage

### Add ReviewBot to a Channel

Invite the bot: `/invite @ReviewBot`

### Commands

| Command | Description |
|---------|-------------|
| `@ReviewBot comment 1:32 "Your feedback"` | Add a timestamp comment |
| `@ReviewBot list` | List all comments on a video |
| `@ReviewBot resolve 1` | Mark comment #1 as resolved |
| `@ReviewBot unresolve 1` | Reopen comment #1 |
| `@ReviewBot status` | Show open/resolved counts |
| `@ReviewBot help` | Show available commands |

### Workflow

1. Upload a video or share a video URL in a channel
2. Bot reacts with 🎬 to confirm detection
3. Reply in thread: `@ReviewBot comment 0:45 "Adjust color here"`
4. View all feedback: `@ReviewBot list`
5. Mark as done: `@ReviewBot resolve 1`

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Bolt for Slack
- **Database**: SQLite (better-sqlite3)
- **Mode**: Socket Mode (no public endpoint needed)

## License

MIT
