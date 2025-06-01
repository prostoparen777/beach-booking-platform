const express = require('express');
const { body, param, query } = require('express-validator');
const loungerController = require('../controllers/loungerController');
const { authenticateToken, requireRole, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const createLoungersValidation = [
    body('loungers')
        .isArray({ min: 1 })
        .withMessage('Необходимо указать массив лежаков'),
    body('loungers.*.number')
        .trim()
        .notEmpty()
        .withMessage('Номер лежака обязателен'),
    body('loungers.*.row')
        .isInt({ min: 1 })
        .withMessage('Ряд должен быть положительным числом'),
    body('loungers.*.col')
        .isInt({ min: 1 })
        .withMessage('Колонка должна быть положительным числом'),
    body('loungers.*.x')
        .isFloat({ min: 0 })
        .withMessage('Координата X должна быть положительным числом'),
    body('loungers.*.y')
        .isFloat({ min: 0 })
        .withMessage('Координата Y должна быть положительным числом'),
    body('loungers.*.type')
        .optional()
        .isIn(['standard', 'premium', 'vip'])
        .withMessage('Неверный тип лежака'),
    body('loungers.*.price_per_hour')
        .isFloat({ min: 0 })
        .withMessage('Цена должна быть положительным числом')
];

const updateLoungerValidation = [
    body('number')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Номер лежака не может быть пустым'),
    body('row')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Ряд должен быть положительным числом'),
    body('col')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Колонка должна быть положительным числом'),
    body('x')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Координата X должна быть положительным числом'),
    body('y')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Координата Y должна быть положительным числом'),
    body('type')
        .optional()
        .isIn(['standard', 'premium', 'vip'])
        .withMessage('Неверный тип лежака'),
    body('price_per_hour')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Цена должна быть положительным числом'),
    body('is_active')
        .optional()
        .isBoolean()
        .withMessage('is_active должно быть булевым значением')
];

const updatePositionsValidation = [
    body('positions')
        .isArray({ min: 1 })
        .withMessage('Необходимо указать массив позиций'),
    body('positions.*.id')
        .isInt()
        .withMessage('ID лежака должен быть числом'),
    body('positions.*.x')
        .isFloat({ min: 0 })
        .withMessage('Координата X должна быть положительным числом'),
    body('positions.*.y')
        .isFloat({ min: 0 })
        .withMessage('Координата Y должна быть положительным числом'),
    body('positions.*.row')
        .isInt({ min: 1 })
        .withMessage('Ряд должен быть положительным числом'),
    body('positions.*.col')
        .isInt({ min: 1 })
        .withMessage('Колонка должна быть положительным числом')
];

// Public routes
router.get('/beaches/:beachId/loungers', optionalAuth, loungerController.getBeachLoungers);
router.get('/:id', optionalAuth, loungerController.getLounger);
router.get('/:id/availability', optionalAuth, loungerController.getLoungerAvailability);

// Protected routes (admin/moderator/manager)
router.post('/beaches/:beachId/loungers',
    authenticateToken,
    requireRole(['admin', 'moderator']),
    createLoungersValidation,
    loungerController.createLoungers
);

router.put('/:id',
    authenticateToken,
    requireRole(['admin', 'moderator']),
    updateLoungerValidation,
    loungerController.updateLounger
);

router.delete('/:id',
    authenticateToken,
    requireRole(['admin', 'moderator']),
    loungerController.deleteLounger
);

router.put('/beaches/:beachId/positions',
    authenticateToken,
    requireRole(['admin', 'moderator']),
    updatePositionsValidation,
    loungerController.updateLoungersPositions
);

module.exports = router;