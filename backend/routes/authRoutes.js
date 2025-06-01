const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const registerValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Введите корректный email'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Пароль должен содержать минимум 6 символов'),
    body('full_name')
        .trim()
        .notEmpty()
        .withMessage('Введите полное имя'),
    body('phone')
        .optional()
        .isMobilePhone('ru-RU')
        .withMessage('Введите корректный номер телефона')
];

const loginValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Введите корректный email'),
    body('password')
        .notEmpty()
        .withMessage('Введите пароль')
];

const changePasswordValidation = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Введите текущий пароль'),
    body('newPassword')
        .isLength({ min: 6 })
        .withMessage('Новый пароль должен содержать минимум 6 символов')
];

// Routes
router.post('/register', registerValidation, authController.register);
router.post('/login', loginValidation, authController.login);
router.post('/logout', authController.logout);
router.get('/me', authenticateToken, authController.getMe);
router.put('/profile', authenticateToken, authController.updateProfile);
router.put('/change-password', authenticateToken, changePasswordValidation, authController.changePassword);
router.post('/refresh-token', authenticateToken, authController.refreshToken);

module.exports = router;