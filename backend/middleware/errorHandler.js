const winston = require('winston');

// Logger
const logger = winston.createLogger({
    level: 'error',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'error.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Error handler middleware
const errorHandler = (err, req, res, next) => {
    // Log error
    logger.error({
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        user: req.user?.id
    });
    
    // Postgres unique constraint violation
    if (err.code === '23505') {
        return res.status(409).json({
            error: 'Duplicate entry',
            message: 'Запись с такими данными уже существует'
        });
    }
    
    // Postgres foreign key violation
    if (err.code === '23503') {
        return res.status(400).json({
            error: 'Invalid reference',
            message: 'Ссылка на несуществующую запись'
        });
    }
    
    // Postgres check constraint violation
    if (err.code === '23514') {
        return res.status(400).json({
            error: 'Constraint violation',
            message: 'Данные не соответствуют ограничениям'
        });
    }
    
    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: 'Invalid token',
            message: 'Недействительный токен'
        });
    }
    
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            error: 'Token expired',
            message: 'Токен истек'
        });
    }
    
    // Validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation error',
            message: 'Ошибка валидации данных',
            details: err.details
        });
    }
    
    // Default error response
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(err.status || 500).json({
        error: err.error || 'Internal server error',
        message: err.message || 'Произошла внутренняя ошибка сервера',
        ...(isDevelopment && { stack: err.stack })
    });
};

module.exports = errorHandler;