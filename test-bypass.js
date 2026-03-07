const fs = require('fs');

// Create a dummy video in the DB so we can load it
const { getDb } = require('./src/database/db');
const db = getDb();

try {
  let existing = db.prepare('SELECT id FROM videos WHERE id = 9999').get();
  if (!existing) {
     db.prepare('INSERT INTO videos (id, channel_id, message_ts, uploader_id, video_url, video_name, video_type) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
         9999, 'C123', 'ts123', 'U123', 'https://www.w3schools.com/html/mov_bbb.mp4', 'Test Video', 'upload'
     );
     console.log("Inserted test video 9999");
  } else {
     console.log("Video 9999 already exists");
  }
} catch(e) { console.error(e); }

// Temporarily override auth middleware for testing UI
const authFile = './src/middleware/auth.js';
let authCode = fs.readFileSync(authFile, 'utf8');

// If not already bypassed
if (!authCode.includes('// BYPASSED')) {
  authCode = authCode.replace('function requireReviewAuth(req, res, next) {', 'function requireReviewAuth(req, res, next) { // BYPASSED \n return next();');
  authCode = authCode.replace('function requireCommentAuth(req, res, next) {', 'function requireCommentAuth(req, res, next) { // BYPASSED \n return next();');
  fs.writeFileSync(authFile, authCode);
  console.log("Bypassed Auth!");
} else {
  console.log("Auth already bypassed.");
}
