const { parseCommand, parseTimestamp } = require('../utils/parsers');
const {
    formatCommentList,
    formatStatus,
    formatHelp,
    formatError,
    formatSuccess,
    formatComment,
} = require('../utils/formatters');
const { getVideoByThread } = require('../services/videos');
const commentsService = require('../services/comments');

/**
 * Handle bot mention commands
 * @param {object} params - { client, event, say }
 */
async function handleCommand({ client, event, say }) {
    const { text, channel, thread_ts, ts, user } = event;

    // Parse the command
    const command = parseCommand(text);

    if (!command) {
        await say({
            ...formatHelp(),
            thread_ts: thread_ts || ts,
        });
        return;
    }

    // Get the thread context (for video lookup)
    const threadTs = thread_ts || ts;

    switch (command.action) {
        case 'comment':
            await handleCommentCommand({
                client,
                say,
                channel,
                threadTs,
                user,
                command,
            });
            break;

        case 'list':
            await handleListCommand({ say, channel, threadTs });
            break;

        case 'resolve':
            await handleResolveCommand({ client, say, channel, threadTs, command });
            break;

        case 'unresolve':
            await handleUnresolveCommand({ say, channel, threadTs, command });
            break;

        case 'status':
            await handleStatusCommand({ say, channel, threadTs });
            break;

        case 'help':
            await say({
                ...formatHelp(),
                thread_ts: threadTs,
            });
            break;

        default:
            await say({
                ...formatError(
                    'Unknown command. Type `@reviewbot help` for available commands.'
                ),
                thread_ts: threadTs,
            });
    }
}

/**
 * Handle the comment command
 */
async function handleCommentCommand({
    client,
    say,
    channel,
    threadTs,
    user,
    command,
}) {
    // Find the video for this thread
    const video = getVideoByThread(channel, threadTs);

    if (!video) {
        await say({
            ...formatError(
                'No video found in this thread. Make sure to comment on a thread containing a video.'
            ),
            thread_ts: threadTs,
        });
        return;
    }

    // Parse timestamp
    const timestampSeconds = parseTimestamp(command.timestamp);

    if (timestampSeconds === null) {
        await say({
            ...formatError(
                'Invalid timestamp format. Use formats like `1:32` or `1:32:45`.'
            ),
            thread_ts: threadTs,
        });
        return;
    }

    // Add the comment
    const comment = commentsService.addComment({
        videoId: video.id,
        userId: user,
        timestampSeconds,
        commentText: command.message,
    });

    // Format and post the comment
    await say({
        text: `New comment at ${command.timestamp}`,
        blocks: [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `📝 *New Comment*\n${formatComment(comment)}`,
                },
            },
        ],
        thread_ts: threadTs,
    });

    // Notify the video uploader if it's not the commenter
    if (video.uploader_id !== user) {
        try {
            await client.chat.postMessage({
                channel: video.uploader_id,
                text: `New comment on your video at ${command.timestamp}: "${command.message}"`,
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `🔔 *New comment on your video*\n\n${formatComment(comment)}\n\n<https://slack.com/archives/${channel}/p${threadTs.replace('.', '')}|View in thread>`,
                        },
                    },
                ],
            });
        } catch (err) {
            console.error('Failed to notify uploader:', err.message);
        }
    }
}

/**
 * Handle the list command
 */
async function handleListCommand({ say, channel, threadTs }) {
    const video = getVideoByThread(channel, threadTs);

    if (!video) {
        await say({
            ...formatError('No video found in this thread.'),
            thread_ts: threadTs,
        });
        return;
    }

    const comments = commentsService.getComments(video.id);
    await say({
        ...formatCommentList(comments),
        thread_ts: threadTs,
    });
}

/**
 * Handle the resolve command
 */
async function handleResolveCommand({ client, say, channel, threadTs, command }) {
    const video = getVideoByThread(channel, threadTs);

    if (!video) {
        await say({
            ...formatError('No video found in this thread.'),
            thread_ts: threadTs,
        });
        return;
    }

    // Check if comment exists and belongs to this video
    if (!commentsService.commentBelongsToVideo(command.commentId, video.id)) {
        await say({
            ...formatError(`Comment #${command.commentId} not found on this video.`),
            thread_ts: threadTs,
        });
        return;
    }

    const success = commentsService.resolveComment(command.commentId);

    if (success) {
        await say({
            ...formatSuccess(`Comment #${command.commentId} marked as resolved.`),
            thread_ts: threadTs,
        });
    } else {
        await say({
            ...formatError(`Failed to resolve comment #${command.commentId}.`),
            thread_ts: threadTs,
        });
    }
}

/**
 * Handle the unresolve command
 */
async function handleUnresolveCommand({ say, channel, threadTs, command }) {
    const video = getVideoByThread(channel, threadTs);

    if (!video) {
        await say({
            ...formatError('No video found in this thread.'),
            thread_ts: threadTs,
        });
        return;
    }

    if (!commentsService.commentBelongsToVideo(command.commentId, video.id)) {
        await say({
            ...formatError(`Comment #${command.commentId} not found on this video.`),
            thread_ts: threadTs,
        });
        return;
    }

    const success = commentsService.unresolveComment(command.commentId);

    if (success) {
        await say({
            ...formatSuccess(`Comment #${command.commentId} reopened.`),
            thread_ts: threadTs,
        });
    } else {
        await say({
            ...formatError(`Failed to unresolve comment #${command.commentId}.`),
            thread_ts: threadTs,
        });
    }
}

/**
 * Handle the status command
 */
async function handleStatusCommand({ say, channel, threadTs }) {
    const video = getVideoByThread(channel, threadTs);

    if (!video) {
        await say({
            ...formatError('No video found in this thread.'),
            thread_ts: threadTs,
        });
        return;
    }

    const status = commentsService.getStatus(video.id);
    await say({
        ...formatStatus(status),
        thread_ts: threadTs,
    });
}

module.exports = {
    handleCommand,
};
