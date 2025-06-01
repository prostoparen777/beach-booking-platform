const express = require('express');
const { body, query } = require('express-validator');
const bookingController = require('../controllers/bookingController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const createBookingValidation = [
    body('lounger_id')
        .isInt()
        .withMessage('ID лежака должен быть числом'),
    body('start_dt')
        .isISO8601()
        .withMessage('Неверный формат даты начала'),
    body('end_dt')
        .isISO8601()
        .withMessage('Неверный формат даты окончания')
        .custom((value, { req }) => {
            if (new Date(value) <= new Date(req.body.start_dt)) {
                throw new Error('Дата окончания должна быть после даты начала');
            }
            return true;
        })
];

const confirmBookingValidation = [
    body('payment_method')
        .optional()
        .isIn(['card', 'cash', 'online'])
        .withMessage('Неверный способ оплаты'),
    body('payment_details')
        .optional()
        .isObject()
        .withMessage('Детали оплаты должны быть объектом')
];

// User routes
router.get('/my', 
    authenticateToken, 
    bookingController.getMyBookings
);

router.post('/', 
    authenticateToken,
    createBookingValidation,
    bookingController.createBooking
);

router.get('/:id', 
    authenticateToken, 
    bookingController.getBooking
);

router.put('/:id/cancel', 
    authenticateToken, 
    bookingController.cancelBooking
);

router.put('/:id/confirm',
    authenticateToken,
    confirmBookingValidation,
    bookingController.confirmBooking
);

// Admin routes
router.get('/admin/all',
    authenticateToken,
    requireRole(['admin', 'moderator']),
    bookingController.getAllBookings
);

module.exports = router;