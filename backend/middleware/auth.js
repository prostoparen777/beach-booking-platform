const jwt = require('jsonwebtoken');

// Verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
        return res.status(401).json({
            error: 'Access denied',
            message: 'Требуется авторизация'
        });
    }
    
    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        req.user = verified;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token expired',
                message: 'Токен истек'
            });
        }
        
        return res.status(403).json({
            error: 'Invalid token',
            message: 'Недействительный токен'
        });
    }
};

// Check if user has required role
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Access denied',
                message: 'Требуется авторизация'
            });
        }
        
        const userRole = req.user.role;
        const allowedRoles = Array.isArray(roles) ? roles : [roles];
        
        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Недостаточно прав доступа'
            });
        }
        
        next();
    };
};

// Optional authentication - doesn't fail if no token
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        req.user = null;
        return next();
    }
    
    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        req.user = verified;
    } catch (error) {
        req.user = null;
    }
    
    next();
};

// Check if user owns the resource or is admin
const requireOwnershipOrAdmin = (getResourceOwnerId) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    error: 'Access denied',
                    message: 'Требуется авторизация'
                });
            }
            
            // Admins can access everything
            if (req.user.role === 'admin') {
                return next();
            }
            
            // Get the owner ID of the resource
            const ownerId = await getResourceOwnerId(req);
            
            if (ownerId !== req.user.id) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'Нет доступа к этому ресурсу'
                });
            }
            
            next();
        } catch (error) {
            next(error);
        }
    };
};

module.exports = {
    authenticateToken,
    requireRole,
    optionalAuth,
    requireOwnershipOrAdmin
};