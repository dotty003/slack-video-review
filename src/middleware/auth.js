const crypto = require('crypto');
const config = require('../config');

/**
 * Generate an HMAC-signed review token for a video.
 * Token format: <hex_signature>.<expiry_timestamp>
 * 
 * @param {number} videoId - The video ID to generate a token for
 * @returns {string} - The signed token
 */
function generateReviewToken(videoId) {
    const secret = config.auth.tokenSecret;
    const ttl = config.auth.tokenTTL;
    const expiry = Math.floor(Date.now() / 1000) + ttl;
    const payload = `${videoId}.${expiry}`;
    const signature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

    return `${signature}.${expiry}`;
}

/**
 * Validate an HMAC-signed review token for a specific video.
 * 
 * @param {string} token - The token to validate
 * @param {number} videoId - The video ID the token should be valid for
 * @returns {boolean} - Whether the token is valid
 */
function validateReviewToken(token, videoId) {
    if (!token || !videoId) return false;

    const secret = config.auth.tokenSecret;
    const parts = token.split('.');

    if (parts.length !== 2) return false;

    const [signature, expiryStr] = parts;
    const expiry = parseInt(expiryStr, 10);

    if (isNaN(expiry)) return false;

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (now > expiry) return false;

    // Verify signature
    const payload = `${videoId}.${expiry}`;
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
    );
}

/**
 * Express middleware that validates the review token.
 * 
 * Expects:
 *   - Video ID from req.params.id OR req.params.videoId
 *   - Token from req.query.token OR req.headers['x-review-token']
 * 
 * On failure: returns 401 JSON response.
 * On success: calls next().
 */
function requireReviewAuth(req, res, next) {
    const videoId = parseInt(req.params.id || req.params.videoId, 10);
    const token = req.query.token || req.headers['x-review-token'];

    if (!token) {
        return res.status(401).json({
            error: 'Authentication required',
            message: 'A valid review token is required to access this resource.',
        });
    }

    if (!videoId || isNaN(videoId)) {
        return res.status(400).json({
            error: 'Invalid request',
            message: 'A valid video ID is required.',
        });
    }

    try {
        const isValid = validateReviewToken(token, videoId);

        if (!isValid) {
            return res.status(401).json({
                error: 'Invalid or expired token',
                message: 'This review link has expired or is invalid. Please request a new review link from Slack.',
            });
        }

        // Attach videoId to request for downstream use
        req.reviewVideoId = videoId;
        next();
    } catch (err) {
        console.error('Auth middleware error:', err.message);
        return res.status(401).json({
            error: 'Authentication failed',
            message: 'Could not validate review token.',
        });
    }
}

/**
 * Middleware for comment endpoints where videoId is not in the URL.
 * The token + videoId must be provided as query params.
 */
function requireCommentAuth(req, res, next) {
    const token = req.query.token || req.headers['x-review-token'];
    const videoId = parseInt(req.query.videoId || req.headers['x-review-video-id'], 10);

    if (!token || !videoId || isNaN(videoId)) {
        return res.status(401).json({
            error: 'Authentication required',
            message: 'A valid review token and video ID are required.',
        });
    }

    try {
        const isValid = validateReviewToken(token, videoId);

        if (!isValid) {
            return res.status(401).json({
                error: 'Invalid or expired token',
                message: 'This review link has expired or is invalid.',
            });
        }

        req.reviewVideoId = videoId;
        next();
    } catch (err) {
        console.error('Auth middleware error:', err.message);
        return res.status(401).json({
            error: 'Authentication failed',
            message: 'Could not validate review token.',
        });
    }
}

module.exports = {
    generateReviewToken,
    validateReviewToken,
    requireReviewAuth,
    requireCommentAuth,
};
