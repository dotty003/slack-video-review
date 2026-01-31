# Deploying ReviewBot to Render

Follow these steps to deploy your Slack Video Review bot to Render.

---

## Step 1: Prepare Your Code for GitHub

First, initialize a git repository and push to GitHub:

```bash
cd "/Users/dotty/Desktop/CLAUDE/Slack Video review/slack-video-review"

# Initialize git
git init

# Create .gitignore
echo "node_modules/
.env
data/
*.db" > .gitignore

# Add all files
git add .

# Commit
git commit -m "Initial commit: ReviewBot with video player"
```

Then create a new repository on [GitHub](https://github.com/new) and push:

```bash
git remote add origin https://github.com/YOUR_USERNAME/slack-video-review.git
git branch -M main
git push -u origin main
```

---

## Step 2: Create Render Account & Service

1. Go to [render.com](https://render.com) and sign up/login
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account
4. Select your `slack-video-review` repository

---

## Step 3: Configure Render Settings

Use these settings:

| Setting | Value |
|---------|-------|
| **Name** | `reviewbot` (or any name you like) |
| **Region** | Choose closest to your team |
| **Branch** | `main` |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | Free (or Starter for production) |

---

## Step 4: Add Environment Variables

In the Render dashboard, go to **Environment** and add these variables:

| Key | Value |
|-----|-------|
| `SLACK_BOT_TOKEN` | Your Bot Token (starts with `xoxb-`) |
| `SLACK_SIGNING_SECRET` | Your Signing Secret (from App Credentials) |
| `SLACK_APP_TOKEN` | Your App Token (starts with `xapp-`) |
| `PORT` | `3000` |
| `BASE_URL` | `https://your-app-name.onrender.com` (your Render URL) |

> ⚠️ **Important:** Replace `reviewbot` in BASE_URL with your actual Render service name.

---

## Step 5: Deploy

1. Click **"Create Web Service"**
2. Wait for the build to complete (2-3 minutes)
3. Once deployed, you'll see a URL like `https://reviewbot.onrender.com`

---

## Step 6: Update Slack App Settings (Optional)

If you're not using Socket Mode, you'll need to update your Slack app:

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Select your app
3. Under **Event Subscriptions**, set Request URL to:
   ```
   https://reviewbot.onrender.com/slack/events
   ```

> **Note:** Since we're using Socket Mode, this step is **not required**. Socket Mode connects directly to Slack without needing a public URL for events.

---

## Step 7: Test the Deployment

1. Upload a video to your Slack workspace
2. You should see the "🎬 Review Video" button
3. Click it to open the video player (now hosted on Render)
4. Add comments and verify they sync to Slack

---

## Troubleshooting

### Bot not responding?
- Check Render logs for errors
- Verify environment variables are set correctly
- Make sure the bot is added to the channel

### Video not loading?
- Check that `BASE_URL` is set correctly
- Verify the video proxy is working in logs

### Free tier sleeping?
- Render's free tier sleeps after 15 minutes of inactivity
- The bot will wake up when a request comes in (may take 30-60 seconds)
- For production, upgrade to **Starter** ($7/month) for always-on

---

## Production Recommendations

1. **Upgrade to Starter tier** - Always-on, no sleep
2. **Add persistent storage** - For SQLite database to persist across deploys
3. **Set up monitoring** - Use Render's built-in metrics or add error tracking

---

## Quick Reference

| Resource | URL |
|----------|-----|
| Render Dashboard | [dashboard.render.com](https://dashboard.render.com) |
| Slack App Settings | [api.slack.com/apps](https://api.slack.com/apps) |
| Your Video Player | `https://YOUR-APP.onrender.com/review?video=ID` |
