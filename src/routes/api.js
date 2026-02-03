const express = require('express');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const commentsService = require('../services/comments');
const { getVideoById } = require('../services/videos');
const config = require('../config');

/**
 * Create API router
 * @param {object} slackClient - Slack client for posting messages
 */
function createApiRouter(slackClient) {
    const router = express.Router();

    // Get video info with comments
    router.get('/video/:id', async (req, res) => {
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
    router.get('/video/:id/stream', async (req, res) => {
        try {
            const videoId = parseInt(req.params.id, 10);
            const video = await getVideoById(videoId);

            if (!video || !video.video_url) {
                return res.status(404).send('Video not found');
            }

            const videoUrl = video.video_url;

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
                    'Authorization': `Bearer ${config.slack.botToken}`,
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
                            'Authorization': `Bearer ${config.slack.botToken}`,
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
    router.post('/video/:id/comments', async (req, res) => {
        try {
            const videoId = parseInt(req.params.id, 10);
            const { userId, userName, timestampSeconds, commentText, attachmentUrl } = req.body;

            if (!commentText || timestampSeconds === undefined) {
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
            });

            // Post to Slack thread
            if (slackClient && video.channel_id && video.message_ts) {
                try {
                    const minutes = Math.floor(timestampSeconds / 60);
                    const seconds = timestampSeconds % 60;
                    const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;

                    const messagePayload = {
                        channel: video.channel_id,
                        thread_ts: video.message_ts,
                        text: `📝 *[${timeStr}]* ${userName || 'Reviewer'}: "${commentText}"`,
                    };

                    // If there's an attachment (annotation screenshot), post it as an image block
                    if (attachmentUrl && attachmentUrl.startsWith('data:image')) {
                        // For base64 images, we note that there's an annotation
                        // Slack doesn't accept base64 directly; we'd need file upload for production
                        messagePayload.text += '\n📎 _[Annotation attached - view in web player]_';
                    }

                    await slackClient.chat.postMessage(messagePayload);
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
    router.patch('/comments/:id/resolve', async (req, res) => {
        try {
            const commentId = parseInt(req.params.id, 10);
            const success = await commentsService.resolveComment(commentId);

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

    // Unresolve comment
    router.patch('/comments/:id/unresolve', async (req, res) => {
        try {
            const commentId = parseInt(req.params.id, 10);
            const success = await commentsService.unresolveComment(commentId);

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

    // Delete comment
    router.delete('/comments/:id', async (req, res) => {
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
