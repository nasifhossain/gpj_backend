const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-key';
const jwt = require('jsonwebtoken');

function generateToken(payload, options = {}) {
    return jwt.sign(payload, JWT_SECRET, options);
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        throw new Error('Invalid token');
    }
}

module.exports = {
    generateToken,
    verifyToken
};