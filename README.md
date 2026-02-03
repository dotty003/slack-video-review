# Slack Video Review Bot

## 1. High-Level Overview

**Slack Video Review Bot** is a strict, collaborative video feedback tool designed to streamline the review process for marketing agencies and creative teams directly within Slack.

Instead of scattering feedback across emails, external platforms (Frame.io), and chat messages, this application brings a professional, timestamp-based review workflow into your existing Slack channels.

### Core Value Proposition
*   **For Submitters**: Upload a video once. Receive centralized, timestamped feedback without leaving Slack.
*   **For Reviewers & Business Owners**: Click one button to watch the video and leave Frame.io-style comments linked to specific seconds.
*   **Primary Problem Solved**: Eliminates the "at 0:42 there's a typo" friction by providing a precise, dedicated player that syncs comments back to the Slack thread.

### Why Slack?
Slack is the operating system for modern agencies. This bot turns Slack into a lightweight Video Review platform, removing the need for external logins or context switching.

---

## 2. Feature Breakdown

### 2.1 Video Detection & Submission
**Status**: Implemented
*   **What it does**: Automatically detects video files or supported video links shared in a channel.
*   **Trigger**:
    *   **Direct Upload**: Drag & drop a video file (`.mp4`, `.mov`, etc.) into a channel.
    *   **External Links**: Post a URL from YouTube, Vimeo, or Loom.
*   **Behind the Scenes**:
    *   The bot listens to `file_shared` and `message` events.
    *   It validates the file type or URL pattern.
    *   If valid, it registers the video in its database and replies with a "🎬 Review Video" button.

### 2.2 In-Slack Video Preview
**Status**: Implemented
*   **What it does**: Provides a seamless "Review" button that opens a dedicated web player.
*   **How it works**:
    *   User clicks "Review Video" in the Slack thread.
    *   A web browser opens the `ReviewBot` player.
    *   **Video Streaming**: For direct uploads, the bot authenticates with Slack on the backend to securely proxy the video stream to the browser without requiring the user to download it manually.

### 2.3 Timestamped Commenting
**Status**: Implemented (Core Feature)
*   **What it does**: Allows reviewers to frame-accurately pinpoint feedback.
*   **Workflow**:
    1.  User pauses the video player at a specific moment (e.g., `0:45`).
    2.  User clicks "Leave Comment."
    3.  User types feedback (e.g., "Logo is misaligned here").
    4.  **Sync**: The comment is immediately saved to the database AND posted back to the original Slack thread as: `📝 [0:45] Reviewer Name: "Logo is misaligned here"`.

### 2.4 Comment Management & Resolution
**Status**: Implemented
*   **What it does**: Tracks the lifecycle of feedback.
*   **Resolution Workflow**:
    *   **Open Comments**: appear on the timeline as markers.
    *   **Resolving**: A user (editor/admin) clicks "Resolve" in the web player.
    *   **Result**: The marker turns green/fades, and the status count updates.
    *   **Slack Sync**: "Resolve" actions are updated in the web UI. (Note: Currently, resolution status is primarily tracked in the Web UI database, not updated in the Slack message text itself).

### 2.5 Notifications
**Status**: Implemented
*   **What it does**: Ensures the uploader never misses feedback.
*   **Logic**: When a comment is added, the bot tags the original uploader in the Slack thread notification unless the uploader made the comment themselves.

---

## 3. Slack Integration Details

### 3.1 App Configuration
The bot operates as a **classic Slack App** using **Socket Mode** for secure, firewall-friendly communication (no public IP required for events).

### 3.2 OAuth Scopes
The app requires the following granular scopes to function:

| Scope | Reason |
|-------|--------|
| `channels:history` | To detect video links in messages. |
| `channels:read` | To look up channel names and context. |
| `chat:write` | To post increased thread replies and feedback. |
| `files:read` | **Critical**: To access and stream the raw video file content for the player. |
| `files:write` | To potentially upload assets (future proofing). |
| `users:read` | To display real user names in the web player. |
| `app_mentions:read` | To respond to `@ReviewBot help` commands. |

### 3.3 Event Subscriptions
The app subscribes to the Slack Events API:
*   `file_shared`: Triggers the video registration workflow for uploads.
*   `message.channels`: Triggers detection for link-based videos.
*   `app_mention`: handles commands like `@ReviewBot help` or `@ReviewBot status`.

### 3.4 Interactive Components
*   **Block Kit**: Used for the "Review Video" button and formatted comment notifications.
*   **Deep Linking**: The web player accepts `?video={id}` parameters to load the correct context.

---

## 4. User Roles & Permissions

Currently, the application operates on a **Collaborative Trust Model** ideal for small-to-medium teams.

### 4.1 Team Members (Submitters)
*   **Capabilities**: Upload videos, view comments, resolve comments on their own videos.
*   **Permissions**: Can trigger the bot by uploading files.

### 4.2 Reviewers / Business Owners
*   **Capabilities**: View videos, add comments, resolve threads.
*   **Distinction**: Currently, any user with access to the Slack channel can access the review link. There is no hard "Admin" role enforced in the codebase; security relies on Slack channel membership.

---

## 5. End-to-End Workflows

### Workflow A: The Creative Review Cycle
1.  **Direct Upload**: Editor drags `draft_v1.mp4` into the `#creative-reviews` channel.
2.  **Detection**: Bot adds a 🎬 reaction and replies: *"Video ready for review! [Review Video Button]"*.
3.  **Feedback**: Creative Director clicks the button.
    *   Watches video in browser.
    *   At `0:15`, types "Cut this scene".
    *   At `1:30`, types "Music too loud".
4.  **Sync**: Slack thread populates with 2 new messages from the bot detailing the feedback timestamps.
5.  **Action**: Editor sees notifications, opens the web player.
    *   Clicks the timeline marker at `0:15` to jump to the exact frame.
    *   Makes the fix.
    *   Clicks "Resolve" on the comment.
6.  **Completion**: When all comments are resolved, the video is effectively "Approved".

---

## 6. System Architecture

The application is a monolithic Node.js service containing both the Bot Logic and the Web Player.

```
[ Slack Platform ]  <--(Socket Mode)-->  [ Node.js Application ]
                                        |
       (User Browser)  <--(HTTP)-->     +-- [ Express Web Server ]
                                        |      |-- Serves /public (UI)
                                        |      +-- API Routes (/api/video)
                                        |
                                        +-- [ SQLite Database ] (Local File)
```

### Key Components
1.  **Bolt.js Adapter**: Handles all incoming Slack events and outgoing messages.
2.  **Express Server**: Serves the `public/` frontend and provides REST endpoints for the video player.
3.  **Video Proxy**: A specialized route (`/api/video/:id/stream`) that pipes the video stream from Slack's private URL to the user's browser, handling the authorization header injection automatically.

---

## 7. Data Model

### 7.1 Videos
| Field | Type | Description |
|-------|------|-------------|
| `id` | Integer | Internal ID |
| `channel_id` | String | Slack Channel ID |
| `message_ts` | String | Timestamp of original post (used for threading) |
| `video_url` | String | Slack private file URL or external link |
| `uploader_id` | String | Slack User ID of submitter |

### 7.2 Comments
| Field | Type | Description |
|-------|------|-------------|
| `video_id` | Integer | FK to Videos |
| `timestamp_seconds` | Float | Precise time of comment |
| `comment_text` | String | The feedback |
| `resolved` | Boolean | Status tracking (0 = Open, 1 = Resolved) |

---

## 8. Configuration & Environment

The application requires a `.env` file for secrets.

```bash
# Slack Identity
SLACK_BOT_TOKEN=xoxb-...          # Bot User OAuth Token
SLACK_SIGNING_SECRET=...          # App Signing Secret
SLACK_APP_TOKEN=xapp-...          # App-level Token (for Socket Mode)

# Web Server Configuration
PORT=3000                         # Internal port
BASE_URL=https://your-app.com     # Public URL for generating links
```

### 8.1 Database Path
The SQLite database is stored at `data/reviews.sqlite`.

---

## 9. Deployment & Operations

### 9.1 Hosting Assumptions
*   **Platform**: Designed for PaaS providers like **Render** or Heroku.
*   **Persistence**: Currently uses a file-based SQLite database.
    *   *Warning*: On ephemeral filesystems (like standard Heroku/Render free tiers), the database will reset on redeploy. Use a persistent disk mount or upgrade to PostgreSQL for production.

### 9.2 Operations
*   **Startup**: `npm start` initializes the table schema (`schema.sql`) automatically if missing.
*   **Health Check**: GET `/health` returns `200 OK`.

---

## 10. Security & Privacy

### 10.1 Access Control
*   **Slack-First Security**: The bot does not implement independent user accounts. It assumes that if a user has access to the Slack channel and can see the "Review" button, they are authorized to review the video.
*   **Proxy Streaming**: The video URL is hidden behind the backend proxy. This prevents leakage of Slack's private file tokens to the client-side browser.

### 10.2 Data Retention
*   Video files are **not** stored by the bot; they remain hosted on Slack/External providers. The bot only stores metadata and text comments.

---

## 11. Limitations & Known Constraints

1.  **Video Approval State**: There is currently no global "Approve Video" button. Approval is implied by resolving all comments.
2.  **User Authentication**: The web player separates users by name input or basic context. It does not perform a full "Log in with Slack" OAuth flow for the web player, meaning user attribution in the web UI relies on trust.
3.  **Persistence**: Default SQLite implementation requires a persistent disk on cloud providers.

---

## 12. Future Improvements
*   [ ] **PostgreSQL Migration**: For robust persistent storage.
*   [ ] **Slack Login**: Strict "Sign in with Slack" for the web player to enforce identity.
*   [ ] **PDF Export**: Generate a "Change Log" PDF of all comments for editors.
*   [ ] **Approvals**: Add an explicit "Approve / Reject" state workflow.
