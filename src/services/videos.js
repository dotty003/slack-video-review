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
    videoName,
    videoType,
    teamId,
}) {
    // First try to update existing
    const existing = await getVideoByMessage(channelId, messageTs);

    if (existing) {
        const updateStmt = prepare(`
      UPDATE videos SET video_url = ?, video_name = ?, video_type = ?, team_id = COALESCE(?, team_id)
      WHERE channel_id = ? AND message_ts = ?
    `);
        await updateStmt.run(videoUrl || null, videoName || null, videoType, teamId || null, channelId, messageTs);
        return await getVideoByMessage(channelId, messageTs);
    }

    // Insert new
    const stmt = prepare(`
    INSERT INTO videos (channel_id, message_ts, thread_ts, uploader_id, video_url, video_name, video_type, team_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

    await stmt.run(
        channelId,
        messageTs,
        threadTs || null,
        uploaderId,
        videoUrl || null,
        videoName || null,
        videoType,
        teamId || null
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

/**
 * Update video status
 * @param {number} videoId - Video ID
 * @param {string} status - New status ('pending', 'approved', 'rejected')
 * @returns {object|null} - Updated video record
 */
async function updateVideoStatus(videoId, status) {
    const stmt = prepare('UPDATE videos SET status = ? WHERE id = ?');
    await stmt.run(status, videoId);
    return await getVideoById(videoId);
}

/**
 * Get all videos with comment statistics for the admin dashboard.
 */
async function getAllVideosWithStats() {
    const query = `
        SELECT 
            v.*,
            COUNT(c.id) as total_comments,
            SUM(CASE WHEN c.resolved = 0 THEN 1 ELSE 0 END) as open_comments,
            SUM(CASE WHEN c.resolved = 1 THEN 1 ELSE 0 END) as resolved_comments
        FROM videos v
        LEFT JOIN comments c ON v.id = c.video_id
        GROUP BY v.id
        ORDER BY v.created_at DESC
    `;
    const stmt = prepare(query);
    return await stmt.all();
}

/**
 * Get all videos for a specific team with comment statistics.
 * Used for the workspace video dashboard.
 * @param {string} teamId - Slack workspace ID
 */
async function getVideosByTeamWithStats(teamId) {
    const query = `
        SELECT 
            v.*,
            COUNT(c.id) as total_comments,
            SUM(CASE WHEN c.resolved = 0 THEN 1 ELSE 0 END) as open_comments,
            SUM(CASE WHEN c.resolved = 1 THEN 1 ELSE 0 END) as resolved_comments
        FROM videos v
        LEFT JOIN comments c ON v.id = c.video_id
        WHERE v.team_id = ?
        GROUP BY v.id
        ORDER BY v.created_at DESC
    `;
    const stmt = prepare(query);
    return await stmt.all(teamId);
}

module.exports = {
    isVideoFile,
    detectVideoUrl,
    registerVideo,
    getVideoByMessage,
    getVideoByThread,
    getVideoById,
    updateVideoStatus,
    getAllVideosWithStats,
    getVideosByTeamWithStats,
    VIDEO_EXTENSIONS,
};
