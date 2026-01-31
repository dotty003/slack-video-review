/**
 * Format seconds into a readable timestamp
 * @param {number} seconds - Total seconds
 * @returns {string} - Formatted timestamp (MM:SS or HH:MM:SS)
 */
function formatTimestamp(seconds) {
    if (typeof seconds !== 'number' || seconds < 0) return '0:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    return `${minutes}:${String(secs).padStart(2, '0')}`;
}

/**
 * Format a single comment for display
 * @param {object} comment - Comment object from database
 * @param {string} username - User's display name
 * @returns {string} - Formatted comment string
 */
function formatComment(comment, username = 'Unknown') {
    const timestamp = formatTimestamp(comment.timestamp_seconds);
    const status = comment.resolved ? '✅' : '⏳';
    const resolvedText = comment.resolved ? ' _(resolved)_' : '';

    return `${status} *[${timestamp}]* <@${comment.user_id}>: "${comment.comment_text}"${resolvedText} _(#${comment.id})_`;
}

/**
 * Format a list of comments for display
 * @param {object[]} comments - Array of comment objects
 * @returns {object} - Slack Block Kit message
 */
function formatCommentList(comments) {
    if (!comments || comments.length === 0) {
        return {
            text: 'No comments yet on this video.',
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: '📝 *No comments yet on this video.*\n\nUse `@reviewbot comment <timestamp> "your message"` to add one!',
                    },
                },
            ],
        };
    }

    // Sort by timestamp
    const sorted = [...comments].sort(
        (a, b) => a.timestamp_seconds - b.timestamp_seconds
    );

    const commentLines = sorted.map((c) => formatComment(c)).join('\n');

    return {
        text: `${comments.length} comment(s) on this video`,
        blocks: [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `📝 *Video Comments (${comments.length})*`,
                },
            },
            {
                type: 'divider',
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: commentLines,
                },
            },
        ],
    };
}

/**
 * Format status summary
 * @param {object} status - { open, resolved, total }
 * @returns {object} - Slack Block Kit message
 */
function formatStatus(status) {
    const { open, resolved, total } = status;

    return {
        text: `Video review status: ${resolved}/${total} resolved`,
        blocks: [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `📊 *Review Status*\n\n⏳ Open: *${open}*\n✅ Resolved: *${resolved}*\n📝 Total: *${total}*`,
                },
            },
        ],
    };
}

/**
 * Format help message
 * @returns {object} - Slack Block Kit message
 */
function formatHelp() {
    return {
        text: 'ReviewBot Help',
        blocks: [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: '🎬 *ReviewBot Commands*',
                },
            },
            {
                type: 'divider',
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text:
                        '*Add a comment:*\n`@reviewbot comment 1:32 "Your feedback here"`\n\n' +
                        '*List all comments:*\n`@reviewbot list`\n\n' +
                        '*Resolve a comment:*\n`@reviewbot resolve 1`\n\n' +
                        '*Unresolve a comment:*\n`@reviewbot unresolve 1`\n\n' +
                        '*View status:*\n`@reviewbot status`\n\n' +
                        '*Show this help:*\n`@reviewbot help`',
                },
            },
            {
                type: 'context',
                elements: [
                    {
                        type: 'mrkdwn',
                        text: '💡 _Tip: Use these commands in a thread under a video message_',
                    },
                ],
            },
        ],
    };
}

/**
 * Format error message
 * @param {string} message - Error message
 * @returns {object} - Slack message
 */
function formatError(message) {
    return {
        text: `Error: ${message}`,
        blocks: [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `❌ ${message}`,
                },
            },
        ],
    };
}

/**
 * Format success message
 * @param {string} message - Success message
 * @returns {object} - Slack message
 */
function formatSuccess(message) {
    return {
        text: message,
        blocks: [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `✅ ${message}`,
                },
            },
        ],
    };
}

module.exports = {
    formatTimestamp,
    formatComment,
    formatCommentList,
    formatStatus,
    formatHelp,
    formatError,
    formatSuccess,
};
