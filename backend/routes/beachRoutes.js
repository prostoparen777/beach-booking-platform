const express = require('express');
const { body, query } = require('express-validator');
const beachController = require('../controllers/beachController');
const { authenticateToken, requireRole, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const createBeachValidation = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Название пляжа обязательно'),
    body('address')
        .trim()
        .notEmpty()
        .withMessage('Адрес обязателен'),
    body('latitude')
        .isFloat({ min: -90, max: 90 })
        .withMessage('Некорректная широта'),
    body('longitude')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Некорректная долгота'),
    body('description')
        .optional()
        .trim(),
    body('amenities')
        .optional()
        .isObject()
        .withMessage('Удобства должны быть объектом')
];

const nearbyBeachesValidation = [
    query('lat')
        .isFloat({ min: -90, max: 90 })
        .withMessage('Некорректная широта'),
    query('lng')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Некорректная долгота'),
    query('radius')
        .optional()
        .isFloat({ min: 0.1, max: 100 })
        .withMessage('Радиус должен быть от 0.1 до 100 км')
];

// Public routes
router.get('/', optionalAuth, beachController.getBeaches);
router.get('/nearby', nearbyBeachesValidation, beachController.getNearbyBeaches);
router.get('/:id', optionalAuth, beachController.getBeach);

// Protected routes (admin/moderator only)
router.post('/', 
    authenticateToken, 
    requireRole(['admin', 'moderator']), 
    createBeachValidation,
    beachController.createBeach
);

router.put('/:id', 
    authenticateToken, 
    requireRole(['admin', 'moderator']), 
    beachController.updateBeach
);

router.delete('/:id', 
    authenticateToken, 
    requireRole('admin'), 
    beachController.deleteBeach
);

// Statistics (admin/moderator/manager)
router.get('/:id/stats', 
    authenticateToken, 
    requireRole(['admin', 'moderator', 'manager']), 
    beachController.getBeachStats
);

module.exports = router;