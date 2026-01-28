const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2) {
        return res.status(401).json({ error: 'Token error' });
    }

    const [scheme, token] = parts;

    if (!/^Bearer$/i.test(scheme)) {
        return res.status(401).json({ error: 'Token malformatted' });
    }

    try {
        const decoded = jwt.verify(token, jwtConfig.secret);
        req.userId = decoded.id;
        req.userRole = decoded.role;
        return next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// Middleware para verificar se é admin
const adminMiddleware = (req, res, next) => {
    if (req.userRole !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

module.exports = { authMiddleware, adminMiddleware };
