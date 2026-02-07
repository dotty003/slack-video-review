const { prepare } = require('../database/db');

/**
 * Add a new comment to a video
 * @param {object} params - Comment parameters
 * @returns {object} - Created comment record
 */
async function addComment({ videoId, userId, timestampSeconds, commentText, attachmentUrl = null, attachmentFilename = null }) {
  const stmt = prepare(`
    INSERT INTO comments (video_id, user_id, timestamp_seconds, comment_text, attachment_url, attachment_filename)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = await stmt.run(videoId, userId, timestampSeconds, commentText, attachmentUrl, attachmentFilename);

  // Return a constructed comment object
  return {
    id: result.lastInsertRowid || Date.now(),
    video_id: videoId,
    user_id: userId,
    timestamp_seconds: timestampSeconds,
    comment_text: commentText,
    attachment_url: attachmentUrl,
    attachment_filename: attachmentFilename,
    resolved: 0,
    created_at: new Date().toISOString(),
  };
}

/**
 * Get a comment by ID
 * @param {number} commentId - Comment ID
 * @returns {object|null} - Comment record or null
 */
async function getCommentById(commentId) {
  const stmt = prepare('SELECT * FROM comments WHERE id = ?');
  return await stmt.get(commentId);
}

/**
 * Get all comments for a video
 * @param {number} videoId - Video ID
 * @returns {object[]} - Array of comment records
 */
async function getComments(videoId) {
  const stmt = prepare(`
    SELECT * FROM comments 
    WHERE video_id = ?
    ORDER BY timestamp_seconds ASC
  `);

  return await stmt.all(videoId);
}

/**
 * Resolve a comment
 * @param {number} commentId - Comment ID
 * @returns {boolean} - Success
 */
async function resolveComment(commentId) {
  const stmt = prepare(`
    UPDATE comments 
    SET resolved = 1 
    WHERE id = ?
  `);

  const result = await stmt.run(commentId);
  return result.changes > 0;
}

/**
 * Unresolve a comment
 * @param {number} commentId - Comment ID
 * @returns {boolean} - Success
 */
async function unresolveComment(commentId) {
  const stmt = prepare(`
    UPDATE comments 
    SET resolved = 0 
    WHERE id = ?
  `);

  const result = await stmt.run(commentId);
  return result.changes > 0;
}

/**
 * Get status summary for a video
 * @param {number} videoId - Video ID
 * @returns {object} - { open, resolved, total }
 */
async function getStatus(videoId) {
  const stmt = prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN resolved = 1 THEN 1 ELSE 0 END) as resolved,
      SUM(CASE WHEN resolved = 0 THEN 1 ELSE 0 END) as open
    FROM comments 
    WHERE video_id = ?
  `);

  const result = await stmt.get(videoId);

  return {
    open: parseInt(result?.open) || 0,
    resolved: parseInt(result?.resolved) || 0,
    total: parseInt(result?.total) || 0,
  };
}

/**
 * Check if a comment belongs to a specific video
 * @param {number} commentId - Comment ID
 * @param {number} videoId - Video ID
 * @returns {boolean}
 */
async function commentBelongsToVideo(commentId, videoId) {
  const comment = await getCommentById(commentId);
  return comment && comment.video_id === videoId;
}

/**
 * Delete a comment
 * @param {number} commentId - Comment ID
 * @returns {boolean} - Success
 */
async function deleteComment(commentId) {
  const stmt = prepare(`
    DELETE FROM comments 
    WHERE id = ?
  `);

  const result = await stmt.run(commentId);
  return result.changes > 0;
}

module.exports = {
  addComment,
  getCommentById,
  getComments,
  resolveComment,
  unresolveComment,
  getStatus,
  commentBelongsToVideo,
  deleteComment,
};
