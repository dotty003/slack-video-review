const { prepare } = require('../database/db');
const { parseVideoUrl, extractUrls } = require('../utils/parsers');

/**
 * Supported video file extensions for direct uploads
 */
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'webm', 'mkv', 'm4v'];

/**
 * Check if a file is a video based on its mimetype or extension
 * @param {object} file - Slack file object
 * @returns {boolean}
 */
function isVideoFile(file) {
    if (!file) return false;

    // Check mimetype
    if (file.mimetype && file.mimetype.startsWith('video/')) {
        return true;
    }

    // Check file extension
    if (file.name) {
        const ext = file.name.split('.').pop().toLowerCase();
        return VIDEO_EXTENSIONS.includes(ext);
    }

    return false;
}

/**
 * Detect video URLs in a message
 * @param {string} text - Message text
 * @returns {object|null} - Video info or null
 */
function detectVideoUrl(text) {
    const urls = extractUrls(text);

    for (const url of urls) {
        const videoInfo = parseVideoUrl(url);
        if (videoInfo) {
            return videoInfo;
        }
    }

    return null;
}

/**
 * Register a video in the database
 * @param {object} params - Video parameters
 * @returns {object} - Created video record
 */
async function registerVideo({
    channelId,
    messageTs,
    threadTs,
    uploaderId,
    videoUrl,
    videoType,
}) {
    // First try to update existing
    const existing = await getVideoByMessage(channelId, messageTs);

    if (existing) {
        const updateStmt = prepare(`
      UPDATE videos SET video_url = ?, video_type = ?
      WHERE channel_id = ? AND message_ts = ?
    `);
        await updateStmt.run(videoUrl || null, videoType, channelId, messageTs);
        return await getVideoByMessage(channelId, messageTs);
    }

    // Insert new
    const stmt = prepare(`
    INSERT INTO videos (channel_id, message_ts, thread_ts, uploader_id, video_url, video_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

    await stmt.run(
        channelId,
        messageTs,
        threadTs || null,
        uploaderId,
        videoUrl || null,
        videoType
    );

    return await getVideoByMessage(channelId, messageTs);
}

/**
 * Get a video by its message timestamp
 * @param {string} channelId - Channel ID
 * @param {string} messageTs - Message timestamp
 * @returns {object|null} - Video record or null
 */
async function getVideoByMessage(channelId, messageTs) {
    const stmt = prepare(`
    SELECT * FROM videos 
    WHERE channel_id = ? AND message_ts = ?
  `);

    return await stmt.get(channelId, messageTs);
}

/**
 * Get a video by thread timestamp (for finding video from thread replies)
 * @param {string} channelId - Channel ID
 * @param {string} threadTs - Thread timestamp
 * @returns {object|null} - Video record or null
 */
async function getVideoByThread(channelId, threadTs) {
    // First try to find by message_ts (original video post)
    let video = await getVideoByMessage(channelId, threadTs);

    if (!video) {
        // Try to find by thread_ts
        const stmt = prepare(`
      SELECT * FROM videos 
      WHERE channel_id = ? AND thread_ts = ?
    `);
        video = await stmt.get(channelId, threadTs);
    }

    return video;
}

/**
 * Get video by ID
 * @param {number} videoId - Video ID
 * @returns {object|null} - Video record or null
 */
async function getVideoById(videoId) {
    const stmt = prepare('SELECT * FROM videos WHERE id = ?');
    return await stmt.get(videoId);
}

module.exports = {
    isVideoFile,
    detectVideoUrl,
    registerVideo,
    getVideoByMessage,
    getVideoByThread,
    getVideoById,
    VIDEO_EXTENSIONS,
};
