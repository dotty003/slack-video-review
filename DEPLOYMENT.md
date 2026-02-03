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

## Step 2: Create Render PostgreSQL Database

> ⚠️ **Important:** This step ensures your video data persists across deploys.

1. Go to [render.com](https://render.com) and sign up/login
2. Click **"New +"** → **"PostgreSQL"**
3. Configure the database:
   | Setting | Value |
   |---------|-------|
   | **Name** | `reviewbot-db` |
   | **Region** | Same as your web service |
   | **Instance Type** | Free |

4. Click **"Create Database"**
5. Wait for creation, then copy the **Internal Database URL** (starts with `postgres://`)

---

## Step 3: Create Render Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub account
3. Select your `slack-video-review` repository

Use these settings:

| Setting | Value |
|---------|-------|
| **Name** | `reviewbot` (or any name you like) |
| **Region** | Same as your database |
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
| `DATABASE_URL` | Your PostgreSQL Internal URL (from Step 2) |
| `PORT` | `3000` |
| `BASE_URL` | `https://your-app-name.onrender.com` (your Render URL) |

> ⚠️ **Important:** The `DATABASE_URL` must use the **Internal Database URL** for best performance.

---

## Step 5: Deploy

1. Click **"Create Web Service"**
2. Wait for the build to complete (2-3 minutes)
3. Check logs for "📦 PostgreSQL database initialized"
4. Once deployed, you'll see a URL like `https://reviewbot.onrender.com`

---

## Step 6: Test the Deployment

1. Upload a video to your Slack workspace
2. You should see the "🎬 Review Video" button
3. Click it to open the video player (now hosted on Render)
4. Add comments and verify they sync to Slack
5. **Verify persistence:** Redeploy and confirm old videos are still accessible

---

## Database Modes

The application automatically detects which database to use:

| Mode | Condition | Database |
|------|-----------|----------|
| **Production** | `DATABASE_URL` is set | PostgreSQL |
| **Development** | `DATABASE_URL` not set | SQLite (file-based) |

For local development, you don't need to configure anything - SQLite is used automatically.

---

## Troubleshooting

### Bot not responding?
- Check Render logs for errors
- Verify environment variables are set correctly
- Make sure the bot is added to the channel

### Video not loading?
- Check that `BASE_URL` is set correctly
- Verify the video proxy is working in logs

### "Video not found" error?
- Ensure `DATABASE_URL` is set correctly
- Check that PostgreSQL database was created successfully
- Look for "📦 PostgreSQL database initialized" in logs

### Free tier sleeping?
- Render's free tier sleeps after 15 minutes of inactivity
- The bot will wake up when a request comes in (may take 30-60 seconds)
- For production, upgrade to **Starter** ($7/month) for always-on

---

## Production Recommendations

1. **Upgrade to Starter tier** - Always-on, no sleep
2. **Use PostgreSQL** - Already configured for data persistence
3. **Set up monitoring** - Use Render's built-in metrics or add error tracking

---

## Quick Reference

| Resource | URL |
|----------|-----|
| Render Dashboard | [dashboard.render.com](https://dashboard.render.com) |
| Slack App Settings | [api.slack.com/apps](https://api.slack.com/apps) |
| Your Video Player | `https://YOUR-APP.onrender.com/review?video=ID` |

