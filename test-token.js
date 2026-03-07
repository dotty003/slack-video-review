const { generateReviewToken, validateReviewToken } = require('./src/middleware/auth');

const token = generateReviewToken(1);
console.log("Token:", token);
const isValid = validateReviewToken(token, 1);
console.log("IsValid 1:", isValid);
const isValidString = validateReviewToken(token, "1");
console.log("IsValid '1':", isValidString);

