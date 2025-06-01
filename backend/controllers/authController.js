const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { query } = require('../config/database');

// Generate JWT token
const generateToken = (user) => {
    return jwt.sign(
        { 
            id: user.id, 
            email: user.email,
            role: user.role 
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { 
            expiresIn: '7d' 
        }
    );
};

// Register new user
const register = async (req, res, next) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const { email, password, full_name, phone } = req.body;
        
        // Check if user already exists
        const existingUser = await query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );
        
        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                error: 'User already exists',
                message: 'Пользователь с таким email уже существует'
            });
        }
        
        // Hash password
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);
        
        // Create user
        const result = await query(
            `INSERT INTO users (email, password_hash, full_name, phone) 
             VALUES ($1, $2, $3, $4) 
             RETURNING id, email, full_name, phone, role, created_at`,
            [email, password_hash, full_name, phone]
        );
        
        const user = result.rows[0];
        
        // Generate token
        const token = generateToken(user);
        
        res.status(201).json({
            message: 'Registration successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                phone: user.phone,
                role: user.role
            }
        });
        
    } catch (error) {
        next(error);
    }
};

// Login user
const login = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const { email, password } = req.body;
        
        // Find user
        const result = await query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({
                error: 'Invalid credentials',
                message: 'Неверный email или пароль'
            });
        }
        
        const user = result.rows[0];
        
        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        
        if (!isPasswordValid) {
            return res.status(401).json({
                error: 'Invalid credentials',
                message: 'Неверный email или пароль'
            });
        }
        
        // Generate token
        const token = generateToken(user);
        
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                phone: user.phone,
                role: user.role
            }
        });
        
    } catch (error) {
        next(error);
    }
};

// Get current user
const getMe = async (req, res, next) => {
    try {
        const result = await query(
            'SELECT id, email, full_name, phone, role, created_at FROM users WHERE id = $1',
            [req.user.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'User not found',
                message: 'Пользователь не найден'
            });
        }
        
        res.json(result.rows[0]);
        
    } catch (error) {
        next(error);
    }
};

// Update user profile
const updateProfile = async (req, res, next) => {
    try {
        const { full_name, phone } = req.body;
        const userId = req.user.id;
        
        const result = await query(
            `UPDATE users 
             SET full_name = $1, phone = $2, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $3 
             RETURNING id, email, full_name, phone, role`,
            [full_name, phone, userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'User not found',
                message: 'Пользователь не найден'
            });
        }
        
        res.json({
            message: 'Profile updated successfully',
            user: result.rows[0]
        });
        
    } catch (error) {
        next(error);
    }
};

// Change password
const changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;
        
        // Get current password hash
        const userResult = await query(
            'SELECT password_hash FROM users WHERE id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                error: 'User not found',
                message: 'Пользователь не найден'
            });
        }
        
        // Verify current password
        const isPasswordValid = await bcrypt.compare(
            currentPassword, 
            userResult.rows[0].password_hash
        );
        
        if (!isPasswordValid) {
            return res.status(401).json({
                error: 'Invalid password',
                message: 'Неверный текущий пароль'
            });
        }
        
        // Hash new password
        const saltRounds = 10;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
        
        // Update password
        await query(
            'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [newPasswordHash, userId]
        );
        
        res.json({
            message: 'Password changed successfully'
        });
        
    } catch (error) {
        next(error);
    }
};

// Logout (optional - for token blacklisting if implemented)
const logout = async (req, res) => {
    // In a stateless JWT setup, logout is typically handled client-side
    // by removing the token. If you implement token blacklisting,
    // add the logic here.
    
    res.json({
        message: 'Logged out successfully'
    });
};

// Refresh token
const refreshToken = async (req, res, next) => {
    try {
        // Get current user from token
        const user = req.user;
        
        // Generate new token
        const token = generateToken(user);
        
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        });
        
    } catch (error) {
        next(error);
    }
};

module.exports = {
    register,
    login,
    getMe,
    updateProfile,
    changePassword,
    logout,
    refreshToken
};