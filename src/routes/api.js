const express = require('express');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { WebClient } = require('@slack/web-api');
const commentsService = require('../services/comments');
const { getVideoById } = require('../services/videos');
const config = require('../config');
const { requireReviewAuth, requireCommentAuth } = require('../middleware/auth');
const { getBotTokenForTeam } = require('../database/installationStore');

/**
 * Create API router
 * @param {object} slackApp - Bolt.js App instance
 */
function createApiRouter(slackApp) {
    const router = express.Router();

    /**
     * Get a Slack WebClient for a specific video's workspace.
     * In OAuth mode, fetches the workspace token from the installations table.
     * In legacy mode, uses the default app client.
     */
    async function getSlackClientForVideo(videoId) {
        const video = await getVideoById(videoId);
        if (!video) return null;

        // Try to get workspace-specific token
        // We need team_id — look it up from the video's channel context
        // For now, try the installations table; fall back to the app's default client
        try {
            const { WebClient } = require('@slack/web-api');
            // Try to find the installation for this video's workspace
            const installations = require('../database/installationStore');
            const allInstalls = await installations.getAllInstallations();
            // If we have installations, use the first matching one
            // In a full implementation, videos would store team_id
            if (allInstalls.length > 0) {
                const token = await installations.getBotTokenForTeam(allInstalls[0].team_id);
                if (token) return new WebClient(token);
            }
        } catch (e) {
            // WebClient not available or no installations — fall back
        }

        // Fallback: use the Bolt app's default client (legacy mode)
        return slackApp.client || null;
    }

    // Get video info with comments
    router.get('/video/:id', requireReviewAuth, async (req, res) => {
        try {
            const videoId = parseInt(req.params.id, 10);
            const video = await getVideoById(videoId);

            if (!video) {
                return res.status(404).json({ error: 'Video not found' });
            }

            const comments = await commentsService.getComments(videoId);
            const status = await commentsService.getStatus(videoId);

            // Return video with proxy URL instead of direct Slack URL
            res.json({
                video: {
                    ...video,
                    // Use our proxy endpoint for the video
                    video_url: `/api/video/${videoId}/stream`,
                },
                comments,
                status,
            });
        } catch (err) {
            console.error('API error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Proxy video stream from Slack (handles authentication)
    router.get('/video/:id/stream', requireReviewAuth, async (req, res) => {
        try {
            const videoId = parseInt(req.params.id, 10);
            const video = await getVideoById(videoId);

            if (!video || !video.video_url) {
                return res.status(404).send('Video not found');
            }

            const videoUrl = video.video_url;

            // Get workspace-specific bot token for Slack file auth
            let botToken = config.slack.botToken; // Legacy fallback
            try {
                const installations = require('../database/installationStore');
                const allInstalls = await installations.getAllInstallations();
                if (allInstalls.length > 0) {
                    const token = await installations.getBotTokenForTeam(allInstalls[0].team_id);
                    if (token) botToken = token;
                }
            } catch (e) {
                // Fall back to config token
            }

            if (!botToken) {
                return res.status(500).send('No bot token available for video streaming');
            }

            // Parse the URL
            const parsedUrl = new URL(videoUrl);
            const isHttps = parsedUrl.protocol === 'https:';
            const httpModule = isHttps ? https : http;

            // Make request to Slack with auth token
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (isHttps ? 443 : 80),
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${botToken}`,
                },
            };

            const proxyReq = httpModule.request(options, (proxyRes) => {
                // Handle redirects
                if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
                    // Follow the redirect
                    const redirectUrl = new URL(proxyRes.headers.location);
                    const redirectHttps = redirectUrl.protocol === 'https:';
                    const redirectModule = redirectHttps ? https : http;

                    const redirectOptions = {
                        hostname: redirectUrl.hostname,
                        port: redirectUrl.port || (redirectHttps ? 443 : 80),
                        path: redirectUrl.pathname + redirectUrl.search,
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${botToken}`,
                        },
                    };

                    const redirectReq = redirectModule.request(redirectOptions, (redirectRes) => {
                        // Set content headers
                        res.setHeader('Content-Type', redirectRes.headers['content-type'] || 'video/mp4');
                        if (redirectRes.headers['content-length']) {
                            res.setHeader('Content-Length', redirectRes.headers['content-length']);
                        }
                        res.setHeader('Accept-Ranges', 'bytes');

                        // Pipe the video
                        redirectRes.pipe(res);
                    });

                    redirectReq.on('error', (err) => {
                        console.error('Redirect proxy error:', err);
                        res.status(500).send('Error streaming video');
                    });

                    redirectReq.end();
                    return;
                }

                // Set content headers
                res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'video/mp4');
                if (proxyRes.headers['content-length']) {
                    res.setHeader('Content-Length', proxyRes.headers['content-length']);
                }
                res.setHeader('Accept-Ranges', 'bytes');

                // Pipe the video stream
                proxyRes.pipe(res);
            });

            proxyReq.on('error', (err) => {
                console.error('Proxy error:', err);
                res.status(500).send('Error streaming video');
            });

            proxyReq.end();
        } catch (err) {
            console.error('Stream error:', err);
            res.status(500).send('Error streaming video');
        }
    });

    // Add comment from web UI
    router.post('/video/:id/comments', requireReviewAuth, async (req, res) => {
        try {
            const videoId = parseInt(req.params.id, 10);
            const { userId, userName, timestampSeconds, commentText, attachmentUrl, attachmentFilename } = req.body;

            if ((!commentText && !attachmentUrl) || timestampSeconds === undefined) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const video = await getVideoById(videoId);
            if (!video) {
                return res.status(404).json({ error: 'Video not found' });
            }

            // Add comment to database with optional attachment
            // Use userName as userId for web comments so it displays correctly
            const comment = await commentsService.addComment({
                videoId,
                userId: userId || userName || 'web-user',
                timestampSeconds: parseInt(timestampSeconds, 10),
                commentText,
                attachmentUrl: attachmentUrl || null,
                attachmentFilename: attachmentFilename || null,
            });

            // Post to Slack thread
            if (video.channel_id && video.message_ts) {
                try {
                    const slackClient = await getSlackClientForVideo(videoId);
                    if (slackClient) {
                        const minutes = Math.floor(timestampSeconds / 60);
                        const seconds = timestampSeconds % 60;
                        const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;

                        const messagePayload = {
                            channel: video.channel_id,
                            thread_ts: video.message_ts,
                            text: `📝 *[${timeStr}]* ${userName || 'Reviewer'}: "${commentText}"`,
                        };

                        // If there's an attachment (annotation screenshot), note it
                        if (attachmentUrl && attachmentUrl.startsWith('data:image')) {
                            messagePayload.text += '\n📎 _[Annotation attached - view in web player]_';
                        }

                        const slackResult = await slackClient.chat.postMessage(messagePayload);

                        // Store the Slack message info for later reactions
                        if (slackResult.ok && slackResult.ts) {
                            await commentsService.updateSlackMessageInfo(
                                comment.id,
                                slackResult.ts,
                                video.channel_id
                            );
                        }
                    }
                } catch (slackErr) {
                    console.error('Failed to post to Slack:', slackErr.message);
                }
            }

            res.json({ success: true, comment });
        } catch (err) {
            console.error('API error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Resolve comment
    router.patch('/comments/:id/resolve', requireCommentAuth, async (req, res) => {
        try {
            const commentId = parseInt(req.params.id, 10);

            // Get comment first to retrieve Slack info for reaction
            const comment = await commentsService.getCommentById(commentId);
            if (!comment) {
                return res.status(404).json({ error: 'Comment not found' });
            }

            const success = await commentsService.resolveComment(commentId);

            if (success) {
                // Add ✅ reaction to Slack message if we have the Slack info
                if (comment.slack_message_ts && comment.slack_channel_id) {
                    try {
                        const slackClient = await getSlackClientForVideo(comment.video_id);
                        if (slackClient) {
                            await slackClient.reactions.add({
                                channel: comment.slack_channel_id,
                                timestamp: comment.slack_message_ts,
                                name: 'white_check_mark',
                            });
                        }
                    } catch (slackErr) {
                        // Ignore if reaction already exists or other Slack errors
                        if (!slackErr.message?.includes('already_reacted')) {
                            console.error('Failed to add Slack reaction:', slackErr.message);
                        }
                    }
                }
                res.json({ success: true });
            } else {
                res.status(404).json({ error: 'Comment not found' });
            }
        } catch (err) {
            console.error('API error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Unresolve comment
    router.patch('/comments/:id/unresolve', requireCommentAuth, async (req, res) => {
        try {
            const commentId = parseInt(req.params.id, 10);

            // Get comment first to retrieve Slack info for removing reaction
            const comment = await commentsService.getCommentById(commentId);
            if (!comment) {
                return res.status(404).json({ error: 'Comment not found' });
            }

            const success = await commentsService.unresolveComment(commentId);

            if (success) {
                // Remove ✅ reaction from Slack message if we have the Slack info
                if (comment.slack_message_ts && comment.slack_channel_id) {
                    try {
                        const slackClient = await getSlackClientForVideo(comment.video_id);
                        if (slackClient) {
                            await slackClient.reactions.remove({
                                channel: comment.slack_channel_id,
                                timestamp: comment.slack_message_ts,
                                name: 'white_check_mark',
                            });
                        }
                    } catch (slackErr) {
                        // Ignore if reaction doesn't exist or other Slack errors
                        if (!slackErr.message?.includes('no_reaction')) {
                            console.error('Failed to remove Slack reaction:', slackErr.message);
                        }
                    }
                }
                res.json({ success: true });
            } else {
                res.status(404).json({ error: 'Comment not found' });
            }
        } catch (err) {
            console.error('API error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Delete comment
    router.delete('/comments/:id', requireCommentAuth, async (req, res) => {
        try {
            const commentId = parseInt(req.params.id, 10);
            const success = await commentsService.deleteComment(commentId);

            if (success) {
                res.json({ success: true });
            } else {
                res.status(404).json({ error: 'Comment not found' });
            }
        } catch (err) {
            console.error('API error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    return router;
}

module.exports = { createApiRouter };
