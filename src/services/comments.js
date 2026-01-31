const { prepare } = require('../database/db');

/**
 * Add a new comment to a video
 * @param {object} params - Comment parameters
 * @returns {object} - Created comment record
 */
function addComment({ videoId, userId, timestampSeconds, commentText }) {
  const stmt = prepare(`
    INSERT INTO comments (video_id, user_id, timestamp_seconds, comment_text)
    VALUES (?, ?, ?, ?)
  `);

  const result = stmt.run(videoId, userId, timestampSeconds, commentText);

  // Return a constructed comment object instead of refetching
  // This avoids issues with sql.js lastInsertRowid
  return {
    id: result.lastInsertRowid || Date.now(), // Fallback ID
    video_id: videoId,
    user_id: userId,
    timestamp_seconds: timestampSeconds,
    comment_text: commentText,
    resolved: 0,
    created_at: new Date().toISOString(),
  };
}

/**
 * Get a comment by ID
 * @param {number} commentId - Comment ID
 * @returns {object|null} - Comment record or null
 */
function getCommentById(commentId) {
  const stmt = prepare('SELECT * FROM comments WHERE id = ?');
  return stmt.get(commentId);
}

/**
 * Get all comments for a video
 * @param {number} videoId - Video ID
 * @returns {object[]} - Array of comment records
 */
function getComments(videoId) {
  const stmt = prepare(`
    SELECT * FROM comments 
    WHERE video_id = ?
    ORDER BY timestamp_seconds ASC
  `);

  return stmt.all(videoId);
}

/**
 * Resolve a comment
 * @param {number} commentId - Comment ID
 * @returns {boolean} - Success
 */
function resolveComment(commentId) {
  const stmt = prepare(`
    UPDATE comments 
    SET resolved = 1 
    WHERE id = ?
  `);

  const result = stmt.run(commentId);
  return result.changes > 0;
}

/**
 * Unresolve a comment
 * @param {number} commentId - Comment ID
 * @returns {boolean} - Success
 */
function unresolveComment(commentId) {
  const stmt = prepare(`
    UPDATE comments 
    SET resolved = 0 
    WHERE id = ?
  `);

  const result = stmt.run(commentId);
  return result.changes > 0;
}

/**
 * Get status summary for a video
 * @param {number} videoId - Video ID
 * @returns {object} - { open, resolved, total }
 */
function getStatus(videoId) {
  const stmt = prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN resolved = 1 THEN 1 ELSE 0 END) as resolved,
      SUM(CASE WHEN resolved = 0 THEN 1 ELSE 0 END) as open
    FROM comments 
    WHERE video_id = ?
  `);

  const result = stmt.get(videoId);

  return {
    open: result?.open || 0,
    resolved: result?.resolved || 0,
    total: result?.total || 0,
  };
}

/**
 * Check if a comment belongs to a specific video
 * @param {number} commentId - Comment ID
 * @param {number} videoId - Video ID
 * @returns {boolean}
 */
function commentBelongsToVideo(commentId, videoId) {
  const comment = getCommentById(commentId);
  return comment && comment.video_id === videoId;
}

module.exports = {
  addComment,
  getCommentById,
  getComments,
  resolveComment,
  unresolveComment,
  getStatus,
  commentBelongsToVideo,
};
