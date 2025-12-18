const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key';
const jwt = require('jsonwebtoken');

function generateToken(payload, options = {}) {
    return jwt.sign(payload, JWT_SECRET, options);
}

module.exports = generateToken;