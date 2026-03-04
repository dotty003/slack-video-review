const { isVideoFile, detectVideoUrl, registerVideo, getVideoByMessage } = require('../services/videos');
const { generateReviewToken } = require('../middleware/auth');

/**
 * Handle file_shared events to detect video uploads
 * @param {object} params - { client, event, baseUrl, teamId }
 */
async function handleFileShared({ client, event, baseUrl, teamId }) {
    const { file_id, channel_id } = event;

    try {
        // Get file info
        const result = await client.files.info({ file: file_id });
        const file = result.file;

        if (!isVideoFile(file)) {
            return; // Not a video, ignore
        }

        // Find the message that contains this file
        const messageTs = file.shares?.public?.[channel_id]?.[0]?.ts ||
            file.shares?.private?.[channel_id]?.[0]?.ts;

        if (!messageTs) {
            console.log('Could not find message timestamp for file');
            return;
        }

        // Register the video
        const video = await registerVideo({
            channelId: channel_id,
            messageTs: messageTs,
            threadTs: messageTs,
            uploaderId: file.user,
            videoUrl: file.url_private,
            videoName: file.name,
            videoType: 'upload',
            teamId: teamId || null,
        });

        console.log(`🎬 Registered video upload: ${file.name}`);

        // React with 🎬 emoji to acknowledge
        try {
            await client.reactions.add({
                channel: channel_id,
                timestamp: messageTs,
                name: 'clapper',
            });
        } catch (reactionErr) {
            if (reactionErr.data?.error !== 'already_reacted') {
                console.log('Could not add reaction:', reactionErr.message);
            }
        }

        // Post the Review Video button
        if (video && baseUrl) {
            const reviewUrl = `${baseUrl}/review?video=${video.id}&token=${generateReviewToken(video.id)}`;

            await client.chat.postMessage({
                channel: channel_id,
                thread_ts: messageTs,
                text: `🎬 Video ready for review!`,
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `🎬 *Video ready for review!*\n\nClick the button below to open the video player and leave timestamp comments.`,
                        },
                    },
                    {
                        type: 'actions',
                        elements: [
                            {
                                type: 'button',
                                text: {
                                    type: 'plain_text',
                                    text: '🎬 Review Video',
                                    emoji: true,
                                },
                                value: JSON.stringify({ videoId: video.id, token: generateReviewToken(video.id) }),
                                action_id: 'review_video',
                                style: 'primary',
                            },
                        ],
                    },
                    {
                        type: 'context',
                        elements: [
                            {
                                type: 'mrkdwn',
                                text: `Or use \`@ReviewBot comment 0:30 "feedback"\` to add comments via chat`,
                            },
                        ],
                    },
                ],
            });
        }
    } catch (err) {
        console.error('Error handling file_shared:', err.message);
    }
}

/**
 * Handle message events to detect video URLs
 * @param {object} params - { client, event, teamId }
 */
async function handleMessage({ client, event, teamId }) {
    const { text, channel, ts, user, thread_ts } = event;

    // Skip bot messages and thread replies
    if (event.bot_id || thread_ts) {
        return;
    }

    // Detect video URL in message
    const videoInfo = detectVideoUrl(text);

    if (!videoInfo) {
        return; // No video URL found
    }

    // Register the video
    await registerVideo({
        channelId: channel,
        messageTs: ts,
        threadTs: ts,
        uploaderId: user,
        videoUrl: videoInfo.url,
        videoType: videoInfo.platform,
        teamId: teamId || null,
    });

    console.log(`🎬 Registered ${videoInfo.platform} video: ${videoInfo.url}`);

    // React with 🎬 emoji to acknowledge
    try {
        await client.reactions.add({
            channel: channel,
            timestamp: ts,
            name: 'clapper',
        });
    } catch (reactionErr) {
        if (reactionErr.data?.error !== 'already_reacted') {
            console.log('Could not add reaction:', reactionErr.message);
        }
    }
}

module.exports = {
    handleFileShared,
    handleMessage,
};
