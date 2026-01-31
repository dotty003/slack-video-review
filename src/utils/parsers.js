/**
 * Parse a timestamp string into seconds
 * Supports formats: "1:32", "01:32", "1:32:45", "90" (seconds only)
 * @param {string} timestampStr - The timestamp string
 * @returns {number|null} - Seconds or null if invalid
 */
function parseTimestamp(timestampStr) {
    if (!timestampStr) return null;

    const cleaned = timestampStr.trim();

    // Pure seconds (e.g., "90")
    if (/^\d+$/.test(cleaned)) {
        return parseInt(cleaned, 10);
    }

    // MM:SS or HH:MM:SS format
    const parts = cleaned.split(':').map((p) => parseInt(p, 10));

    if (parts.some(isNaN)) return null;

    if (parts.length === 2) {
        // MM:SS
        const [minutes, seconds] = parts;
        if (seconds >= 60) return null;
        return minutes * 60 + seconds;
    }

    if (parts.length === 3) {
        // HH:MM:SS
        const [hours, minutes, seconds] = parts;
        if (minutes >= 60 || seconds >= 60) return null;
        return hours * 3600 + minutes * 60 + seconds;
    }

    return null;
}

/**
 * Parse a bot command from message text
 * @param {string} text - Full message text
 * @returns {object|null} - { action, args } or null
 */
function parseCommand(text) {
    if (!text) return null;

    // Remove the bot mention and clean up
    const cleaned = text.replace(/<@[A-Z0-9]+>/gi, '').trim();

    // Match: command timestamp "message" or command args
    const commentMatch = cleaned.match(
        /^(comment)\s+(\d+(?::\d+(?::\d+)?)?)\s+[""](.+)[""]$/i
    );
    if (commentMatch) {
        return {
            action: 'comment',
            timestamp: commentMatch[2],
            message: commentMatch[3],
        };
    }

    // Match: resolve/unresolve <id>
    const resolveMatch = cleaned.match(/^(resolve|unresolve)\s+(\d+)$/i);
    if (resolveMatch) {
        return {
            action: resolveMatch[1].toLowerCase(),
            commentId: parseInt(resolveMatch[2], 10),
        };
    }

    // Match: simple commands (list, status, help)
    const simpleMatch = cleaned.match(/^(list|status|help)$/i);
    if (simpleMatch) {
        return {
            action: simpleMatch[1].toLowerCase(),
        };
    }

    return null;
}

/**
 * Video URL patterns for supported platforms
 */
const VIDEO_URL_PATTERNS = [
    {
        platform: 'youtube',
        patterns: [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        ],
    },
    {
        platform: 'vimeo',
        patterns: [/vimeo\.com\/(\d+)/],
    },
    {
        platform: 'loom',
        patterns: [/loom\.com\/share\/([a-zA-Z0-9]+)/],
    },
    {
        platform: 'google_drive',
        patterns: [/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/],
    },
    {
        platform: 'dropbox',
        patterns: [/dropbox\.com\/.*\.(mp4|mov|avi|webm)/i],
    },
];

/**
 * Parse a video URL to identify the platform
 * @param {string} url - The URL to parse
 * @returns {object|null} - { platform, videoId, url } or null
 */
function parseVideoUrl(url) {
    if (!url) return null;

    for (const { platform, patterns } of VIDEO_URL_PATTERNS) {
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return {
                    platform,
                    videoId: match[1] || null,
                    url,
                };
            }
        }
    }

    return null;
}

/**
 * Extract all URLs from a message text
 * @param {string} text - Message text
 * @returns {string[]} - Array of URLs
 */
function extractUrls(text) {
    if (!text) return [];
    const urlRegex = /https?:\/\/[^\s<>]+/gi;
    return text.match(urlRegex) || [];
}

module.exports = {
    parseTimestamp,
    parseCommand,
    parseVideoUrl,
    extractUrls,
};
