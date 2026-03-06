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
     * Resolve a Google Drive share URL to a direct download URL.
     * Makes a lightweight HEAD/GET to extract the uuid from the virus scan page,
     * then returns the final direct URL. Does NOT download the video data.
     */
    function resolveGoogleDriveUrl(fileId) {
        return new Promise((resolve, reject) => {
            const initialUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;

            function followUrl(url, redirectsLeft) {
                if (redirectsLeft <= 0) return reject(new Error('Too many redirects'));

                const parsedUrl = new URL(url);
                const options = {
                    hostname: parsedUrl.hostname,
                    port: 443,
                    path: parsedUrl.pathname + parsedUrl.search,
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    },
                };

                const req = https.request(options, (res) => {
                    // Follow redirects
                    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                        return followUrl(res.headers.location, redirectsLeft - 1);
                    }

                    const contentType = res.headers['content-type'] || '';

                    // If we already got the video, this URL is the direct URL
                    if (!contentType.includes('text/html')) {
                        // Abort the download — we only wanted to confirm the URL works
                        res.destroy();
                        return resolve(url);
                    }

                    // HTML = virus scan page, parse it for uuid
                    let html = '';
                    res.on('data', chunk => html += chunk);
                    res.on('end', () => {
                        const uuidMatch = html.match(/name="uuid"\s+value="([^"]+)"/);
                        const idMatch = html.match(/name="id"\s+value="([^"]+)"/);

                        if (uuidMatch && idMatch) {
                            const directUrl = `https://drive.usercontent.google.com/download?id=${idMatch[1]}&export=download&confirm=t&uuid=${uuidMatch[1]}`;
                            console.log(`🔗 Google Drive: resolved direct URL for file ${idMatch[1]}`);
                            return resolve(directUrl);
                        }

                        reject(new Error('Could not parse Google Drive virus scan page'));
                    });
                });

                req.on('error', reject);
                req.end();
            }

            followUrl(initialUrl, 5);
        });
    }

    /**
     * Proxy an external video URL (Dropbox, direct links).
     * For Google Drive, use resolveGoogleDriveUrl + redirect instead.
     */
    function proxyExternalVideo(sourceUrl, req, res, maxRedirects = 5) {
        const parsedUrl = new URL(sourceUrl);
        const isHttps = parsedUrl.protocol === 'https:';
        const httpModule = isHttps ? https : http;

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        };

        // Forward Range header for seek support
        if (req.headers.range) {
            headers['Range'] = req.headers.range;
        }

        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers,
        };

        const proxyReq = httpModule.request(options, (proxyRes) => {
            // Follow redirects
            if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
                if (maxRedirects <= 0) {
                    return res.status(502).send('Too many redirects');
                }
                return proxyExternalVideo(proxyRes.headers.location, req, res, maxRedirects - 1);
            }

            // Set response headers
            const contentType = proxyRes.headers['content-type'] || 'video/mp4';
            res.setHeader('Content-Type', contentType);
            if (proxyRes.headers['content-length']) {
                res.setHeader('Content-Length', proxyRes.headers['content-length']);
            }
            if (proxyRes.headers['content-range']) {
                res.setHeader('Content-Range', proxyRes.headers['content-range']);
            }
            res.setHeader('Accept-Ranges', 'bytes');

            res.status(proxyRes.statusCode === 206 ? 206 : 200);
            proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
            console.error('External video proxy error:', err.message);
            if (!res.headersSent) {
                res.status(502).send('Error fetching external video');
            }
        });

        proxyReq.end();
    }

    /**
     * Get a Slack WebClient for a specific video's workspace.
     * In OAuth mode, fetches the workspace token from the installations table.
     * In legacy mode, uses the default app client.
     */
    async function getSlackClientForVideo(videoId) {
        const video = await getVideoById(videoId);
        if (!video) return null;

        // If video has a team_id, get the workspace-specific token
        if (video.team_id) {
            try {
                const token = await getBotTokenForTeam(video.team_id);
                if (token) return new WebClient(token);
            } catch (e) {
                console.error('Error getting workspace token:', e.message);
            }
        }

        // Fallback: try any available installation
        try {
            const installations = require('../database/installationStore');
            const allInstalls = await installations.getAllInstallations();
            if (allInstalls.length > 0) {
                const token = await installations.getBotTokenForTeam(allInstalls[0].team_id);
                if (token) return new WebClient(token);
            }
        } catch (e) {
            // No installations — fall back
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
    // For external sources (Google Drive, Dropbox), redirect to direct URL
    router.get('/video/:id/stream', requireReviewAuth, async (req, res) => {
        try {
            const videoId = parseInt(req.params.id, 10);
            const video = await getVideoById(videoId);

            if (!video || !video.video_url) {
                return res.status(404).send('Video not found');
            }

            const videoUrl = video.video_url;
            const videoType = video.video_type || 'upload';

            // ============================================
            // External video sources — proxy through server
            // Google Drive/Dropbox need server-side proxy because
            // their redirects and cookies block <video> tag loading
            // ============================================

            if (videoType === 'google_drive') {
                const fileIdMatch = videoUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                if (!fileIdMatch) {
                    return res.status(400).send('Invalid Google Drive URL');
                }
                try {
                    // Resolve the direct download URL (lightweight — only fetches the ~2KB virus scan page)
                    const directUrl = await resolveGoogleDriveUrl(fileIdMatch[1]);
                    console.log(`🚀 Google Drive: redirecting client directly to Google CDN`);
                    // Redirect browser to load video directly from Google (fast!)
                    return res.redirect(directUrl);
                } catch (err) {
                    console.error('Google Drive resolve error:', err.message);
                    return res.status(502).send('Could not access Google Drive video — make sure sharing is set to "Anyone with the link"');
                }
            }

            if (videoType === 'dropbox') {
                const directUrl = videoUrl.replace('www.dropbox.com', 'dl.dropboxusercontent.com')
                    .replace('?dl=0', '?dl=1')
                    .replace('&dl=0', '&dl=1');
                return proxyExternalVideo(directUrl, req, res);
            }

            if (videoType === 'direct') {
                return proxyExternalVideo(videoUrl, req, res);
            }

            if (['youtube', 'vimeo', 'loom'].includes(videoType)) {
                // These need embed iframes, not direct streaming — not supported yet
                return res.status(400).send('YouTube/Vimeo/Loom videos require embed support (coming soon)');
            }

            // ============================================
            // Slack uploads — proxy with auth token
            // ============================================

            let botToken = config.slack.botToken; // Legacy fallback

            // Use the video's team_id to get the correct workspace token
            if (video.team_id) {
                try {
                    const token = await getBotTokenForTeam(video.team_id);
                    if (token) botToken = token;
                } catch (e) {
                    console.error('Error getting team token for proxy:', e.message);
                }
            }

            // If still no token, try any available installation
            if (!botToken) {
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

    // ================================================
    // Premiere Pro Markers Export
    // ================================================

    // Export comments as Premiere Pro compatible markers XML
    router.get('/video/:id/export/premiere', requireReviewAuth, async (req, res) => {
        try {
            const videoId = parseInt(req.params.id, 10);
            const video = await getVideoById(videoId);

            if (!video) {
                return res.status(404).json({ error: 'Video not found' });
            }

            const comments = await commentsService.getComments(videoId);

            if (!comments || comments.length === 0) {
                return res.status(404).json({ error: 'No comments to export' });
            }

            // Helper: convert seconds to SMPTE timecode (HH:MM:SS:FF)
            const fps = parseInt(req.query.fps) || 24;
            function toTimecode(totalSeconds) {
                const h = Math.floor(totalSeconds / 3600);
                const m = Math.floor((totalSeconds % 3600) / 60);
                const s = Math.floor(totalSeconds % 60);
                const f = Math.round((totalSeconds % 1) * fps);
                return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
            }

            // Helper: convert seconds to frame count
            function toFrames(seconds) {
                return Math.round(seconds * fps);
            }

            // XML escape helper
            function xmlEscape(str) {
                if (!str) return '';
                return str.replace(/[<>&"']/g, c =>
                    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
            }

            const videoName = video.video_name || `PinPoint Review ${videoId}`;
            const safeVideoName = xmlEscape(videoName);

            // Calculate sequence duration from the last comment + buffer
            const maxTimestamp = Math.max(...comments.map(c => c.timestamp_seconds || 0));
            const durationFrames = toFrames(maxTimestamp + 30);

            // Build markers at sequence level using correct DB field names
            // Construct review URL base for linking to annotations
            const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
            const token = req.query.token || '';

            let markersXml = '';
            comments.forEach((comment) => {
                const tc = toTimecode(comment.timestamp_seconds || 0);
                const frame = toFrames(comment.timestamp_seconds || 0);
                const author = xmlEscape(comment.user_id || 'Anonymous');
                const text = xmlEscape(comment.comment_text || '');

                // Build the comment content
                let commentContent = `${author}: ${text}`;

                // If comment has an attachment (annotation or media file), add a link
                if (comment.attachment_url || comment.attachment_filename) {
                    const hasAnnotation = comment.attachment_filename && comment.attachment_filename.startsWith('annotation-');
                    const label = hasAnnotation ? 'View annotation' : `View attachment: ${xmlEscape(comment.attachment_filename || 'file')}`;
                    const reviewLink = `${baseUrl}/review?video=${videoId}&amp;token=${encodeURIComponent(token)}`;
                    commentContent += ` | ${label}: ${reviewLink}`;
                }

                markersXml += `
		<marker>
			<comment>${commentContent}</comment>
			<name>${author} @ ${tc}</name>
			<in>${frame}</in>
			<out>-1</out>
		</marker>`;
            });

            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
	<sequence>
		<name>${safeVideoName} - PinPoint Comments</name>
		<duration>${durationFrames}</duration>
		<rate>
			<timebase>${fps}</timebase>
			<ntsc>FALSE</ntsc>
		</rate>
		<timecode>
			<rate>
				<timebase>${fps}</timebase>
				<ntsc>FALSE</ntsc>
			</rate>
			<string>00:00:00:00</string>
			<frame>0</frame>
			<displayformat>NDF</displayformat>
		</timecode>${markersXml}
		<media>
			<video>
				<format>
					<samplecharacteristics>
						<width>1920</width>
						<height>1080</height>
					</samplecharacteristics>
				</format>
				<track/>
			</video>
			<audio>
				<track/>
			</audio>
		</media>
	</sequence>
</xmeml>`;

            const filename = `${videoName.replace(/[^a-zA-Z0-9]/g, '_')}_PinPoint_Markers.xml`;
            res.set({
                'Content-Type': 'application/xml',
                'Content-Disposition': `attachment; filename="${filename}"`,
            });
            res.send(xml);
        } catch (err) {
            console.error('Premiere export error:', err);
            res.status(500).json({ error: 'Export failed' });
        }
    });

    // ================================================
    // Admin Workspace Management Endpoints
    // ================================================

    /**
     * Admin auth middleware — checks X-Admin-Secret header
     */
    function requireAdmin(req, res, next) {
        const secret = req.headers['x-admin-secret'];
        if (!secret || secret !== config.admin.secret) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        next();
    }

    /**
     * GET /api/admin/workspaces
     * List all installed workspaces with their active status.
     */
    router.get('/admin/workspaces', requireAdmin, async (req, res) => {
        try {
            const installations = require('../database/installationStore');
            const workspaces = await installations.getAllInstallations();
            res.json({ workspaces });
        } catch (err) {
            console.error('Admin list workspaces error:', err);
            res.status(500).json({ error: 'Failed to list workspaces' });
        }
    });

    /**
     * PATCH /api/admin/workspaces/:teamId
     * Toggle workspace active status.
     * Body: { active: true/false }
     */
    router.patch('/admin/workspaces/:teamId', requireAdmin, async (req, res) => {
        try {
            const { teamId } = req.params;
            const { active } = req.body;

            if (typeof active !== 'boolean') {
                return res.status(400).json({ error: 'active must be a boolean' });
            }

            const installations = require('../database/installationStore');
            await installations.setWorkspaceActive(teamId, active);

            res.json({ success: true, teamId, active });
        } catch (err) {
            console.error('Admin toggle workspace error:', err);
            res.status(500).json({ error: 'Failed to update workspace' });
        }
    });

    /**
     * DELETE /api/admin/workspaces/:teamId
     * Permanently remove a workspace installation.
     */
    router.delete('/admin/workspaces/:teamId', requireAdmin, async (req, res) => {
        try {
            const { teamId } = req.params;
            const installations = require('../database/installationStore');
            await installations.deleteInstallation({ teamId });

            res.json({ success: true, teamId, deleted: true });
        } catch (err) {
            console.error('Admin delete workspace error:', err);
            res.status(500).json({ error: 'Failed to delete workspace' });
        }
    });

    return router;
}

module.exports = { createApiRouter };
