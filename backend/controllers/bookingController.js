const { query, transaction, redisClient } = require('../config/database');
const { validationResult } = require('express-validator');

// Create new booking
const createBooking = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const { lounger_id, start_dt, end_dt } = req.body;
        const userId = req.user.id;
        
        // Validate dates
        const startDate = new Date(start_dt);
        const endDate = new Date(end_dt);
        const now = new Date();
        
        if (startDate < now) {
            return res.status(400).json({
                error: 'Invalid date',
                message: 'Дата начала не может быть в прошлом'
            });
        }
        
        if (endDate <= startDate) {
            return res.status(400).json({
                error: 'Invalid date',
                message: 'Дата окончания должна быть после даты начала'
            });
        }
        
        // Create booking in transaction
        const booking = await transaction(async (client) => {
            // Lock lounger row to prevent race conditions
            const loungerResult = await client.query(
                `SELECT l.*, b.name as beach_name 
                 FROM loungers l
                 JOIN beaches b ON l.beach_id = b.id
                 WHERE l.id = $1 
                 FOR UPDATE`,
                [lounger_id]
            );
            
            if (loungerResult.rows.length === 0) {
                throw new Error('Lounger not found');
            }
            
            const lounger = loungerResult.rows[0];
            
            if (!lounger.is_active) {
                throw new Error('Lounger is not active');
            }
            
            // Check if lounger is available for the requested time
            const conflictResult = await client.query(
                `SELECT id FROM bookings 
                 WHERE lounger_id = $1 
                 AND status IN ('confirmed', 'pending')
                 AND (
                    ($2 BETWEEN start_dt AND end_dt) OR
                    ($3 BETWEEN start_dt AND end_dt) OR
                    (start_dt BETWEEN $2 AND $3) OR
                    (end_dt BETWEEN $2 AND $3)
                 )`,
                [lounger_id, start_dt, end_dt]
            );
            
            if (conflictResult.rows.length > 0) {
                throw new Error('Lounger is not available for the selected time');
            }
            
            // Calculate total price
            const hours = Math.ceil((endDate - startDate) / (1000 * 60 * 60));
            const totalPrice = hours * parseFloat(lounger.price_per_hour);
            
            // Create booking
            const bookingResult = await client.query(
                `INSERT INTO bookings 
                 (user_id, lounger_id, start_dt, end_dt, total_price, status, payment_status) 
                 VALUES ($1, $2, $3, $4, $5, 'pending', 'pending') 
                 RETURNING *`,
                [userId, lounger_id, start_dt, end_dt, totalPrice]
            );
            
            return {
                booking: bookingResult.rows[0],
                lounger: lounger
            };
        });
        
        // Clear cache for this beach
        await redisClient.del(`beach:${booking.lounger.beach_id}:loungers`);
        
        // Emit socket event
        const io = req.app.get('io');
        io.to(`beach-${booking.lounger.beach_id}`).emit('lounger-status-changed', {
            beachId: booking.lounger.beach_id,
            loungerId: lounger_id,
            isAvailable: false,
            endTime: end_dt,
            number: booking.lounger.number,
            price: booking.lounger.price_per_hour
        });
        
        res.status(201).json({
            message: 'Booking created successfully',
            booking: {
                ...booking.booking,
                beach_name: booking.lounger.beach_name,
                lounger_number: booking.lounger.number,
                lounger_type: booking.lounger.type
            }
        });
        
    } catch (error) {
        if (error.message === 'Lounger not found') {
            return res.status(404).json({
                error: 'Lounger not found',
                message: 'Лежак не найден'
            });
        }
        if (error.message === 'Lounger is not active') {
            return res.status(400).json({
                error: 'Lounger unavailable',
                message: 'Лежак недоступен для бронирования'
            });
        }
        if (error.message === 'Lounger is not available for the selected time') {
            return res.status(409).json({
                error: 'Time conflict',
                message: 'Лежак уже забронирован на выбранное время'
            });
        }
        next(error);
    }
};

// Get user's bookings
const getMyBookings = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { status, period, limit = 20, offset = 0 } = req.query;
        
        let queryText = `
            SELECT 
                b.*,
                l.number as lounger_number,
                l.type as lounger_type,
                l.price_per_hour,
                beach.name as beach_name,
                beach.address as beach_address
            FROM bookings b
            JOIN loungers l ON b.lounger_id = l.id
            JOIN beaches beach ON l.beach_id = beach.id
            WHERE b.user_id = $1
        `;
        
        const params = [userId];
        let paramIndex = 2;
        
        // Filter by status
        if (status) {
            queryText += ` AND b.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }
        
        // Filter by period
        if (period === 'upcoming') {
            queryText += ` AND b.start_dt > NOW()`;
        } else if (period === 'past') {
            queryText += ` AND b.end_dt < NOW()`;
        } else if (period === 'active') {
            queryText += ` AND NOW() BETWEEN b.start_dt AND b.end_dt`;
        }
        
        queryText += ` ORDER BY b.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(parseInt(limit), parseInt(offset));
        
        const result = await query(queryText, params);
        
        // Get total count
        let countQuery = 'SELECT COUNT(*) FROM bookings WHERE user_id = $1';
        const countParams = [userId];
        
        if (status) {
            countQuery += ' AND status = $2';
            countParams.push(status);
        }
        
        const countResult = await query(countQuery, countParams);
        const totalCount = parseInt(countResult.rows[0].count);
        
        res.json({
            bookings: result.rows,
            pagination: {
                total: totalCount,
                limit: parseInt(limit),
                offset: parseInt(offset),
                pages: Math.ceil(totalCount / limit)
            }
        });
        
    } catch (error) {
        next(error);
    }
};

// Get single booking details
const getBooking = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        const result = await query(
            `SELECT 
                b.*,
                l.number as lounger_number,
                l.type as lounger_type,
                l.price_per_hour,
                l.x,
                l.y,
                beach.name as beach_name,
                beach.address as beach_address,
                beach.latitude,
                beach.longitude,
                beach.amenities
            FROM bookings b
            JOIN loungers l ON b.lounger_id = l.id
            JOIN beaches beach ON l.beach_id = beach.id
            WHERE b.id = $1 AND (b.user_id = $2 OR $3 = 'admin')`,
            [id, userId, req.user.role]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Booking not found',
                message: 'Бронирование не найдено'
            });
        }
        
        res.json(result.rows[0]);
        
    } catch (error) {
        next(error);
    }
};

// Cancel booking
const cancelBooking = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        const booking = await transaction(async (client) => {
            // Get booking with lock
            const bookingResult = await client.query(
                `SELECT 
                    b.*,
                    l.beach_id,
                    l.number as lounger_number,
                    l.price_per_hour
                 FROM bookings b
                 JOIN loungers l ON b.lounger_id = l.id
                 WHERE b.id = $1 AND (b.user_id = $2 OR $3 = 'admin')
                 FOR UPDATE`,
                [id, userId, req.user.role]
            );
            
            if (bookingResult.rows.length === 0) {
                throw new Error('Booking not found');
            }
            
            const booking = bookingResult.rows[0];
            
            if (booking.status === 'cancelled') {
                throw new Error('Booking already cancelled');
            }
            
            if (booking.status === 'completed') {
                throw new Error('Cannot cancel completed booking');
            }
            
            // Check cancellation policy (e.g., can't cancel within 2 hours)
            const startTime = new Date(booking.start_dt);
            const now = new Date();
            const hoursUntilStart = (startTime - now) / (1000 * 60 * 60);
            
            if (hoursUntilStart < 2 && hoursUntilStart > 0) {
                throw new Error('Cannot cancel within 2 hours of start time');
            }
            
            // Update booking status
            const updateResult = await client.query(
                `UPDATE bookings 
                 SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
                 WHERE id = $1 
                 RETURNING *`,
                [id]
            );
            
            // Handle refund if payment was made
            if (booking.payment_status === 'paid') {
                // TODO: Implement refund logic
                await client.query(
                    `UPDATE bookings 
                     SET payment_status = 'refunded' 
                     WHERE id = $1`,
                    [id]
                );
            }
            
            return {
                booking: updateResult.rows[0],
                beachId: booking.beach_id,
                loungerId: booking.lounger_id,
                loungerNumber: booking.lounger_number,
                price: booking.price_per_hour
            };
        });
        
        // Clear cache
        await redisClient.del(`beach:${booking.beachId}:loungers`);
        
        // Emit socket event if cancellation makes lounger available
        const now = new Date();
        const startTime = new Date(booking.booking.start_dt);
        const endTime = new Date(booking.booking.end_dt);
        
        if (now >= startTime && now <= endTime) {
            const io = req.app.get('io');
            io.to(`beach-${booking.beachId}`).emit('lounger-status-changed', {
                beachId: booking.beachId,
                loungerId: booking.loungerId,
                isAvailable: true,
                number: booking.loungerNumber,
                price: booking.price
            });
        }
        
        res.json({
            message: 'Booking cancelled successfully',
            booking: booking.booking
        });
        
    } catch (error) {
        if (error.message === 'Booking not found') {
            return res.status(404).json({
                error: 'Booking not found',
                message: 'Бронирование не найдено'
            });
        }
        if (error.message === 'Booking already cancelled') {
            return res.status(400).json({
                error: 'Already cancelled',
                message: 'Бронирование уже отменено'
            });
        }
        if (error.message === 'Cannot cancel completed booking') {
            return res.status(400).json({
                error: 'Cannot cancel',
                message: 'Невозможно отменить завершенное бронирование'
            });
        }
        if (error.message === 'Cannot cancel within 2 hours of start time') {
            return res.status(400).json({
                error: 'Too late to cancel',
                message: 'Отмена невозможна менее чем за 2 часа до начала'
            });
        }
        next(error);
    }
};

// Confirm booking (after payment)
const confirmBooking = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { payment_method, payment_details } = req.body;
        
        // TODO: Implement payment processing
        
        const result = await query(
            `UPDATE bookings 
             SET status = 'confirmed', 
                 payment_status = 'paid',
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = $1 AND user_id = $2 AND status = 'pending'
             RETURNING *`,
            [id, req.user.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Booking not found',
                message: 'Бронирование не найдено или уже подтверждено'
            });
        }
        
        res.json({
            message: 'Booking confirmed successfully',
            booking: result.rows[0]
        });
        
    } catch (error) {
        next(error);
    }
};

// Get all bookings (admin)
const getAllBookings = async (req, res, next) => {
    try {
        const { 
            beach_id, 
            status, 
            date_from, 
            date_to, 
            limit = 50, 
            offset = 0 
        } = req.query;
        
        let queryText = `
            SELECT 
                b.*,
                u.email as user_email,
                u.full_name as user_name,
                l.number as lounger_number,
                l.type as lounger_type,
                beach.name as beach_name
            FROM bookings b
            JOIN users u ON b.user_id = u.id
            JOIN loungers l ON b.lounger_id = l.id
            JOIN beaches beach ON l.beach_id = beach.id
            WHERE 1=1
        `;
        
        const params = [];
        let paramIndex = 1;
        
        if (beach_id) {
            queryText += ` AND beach.id = $${paramIndex}`;
            params.push(beach_id);
            paramIndex++;
        }
        
        if (status) {
            queryText += ` AND b.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }
        
        if (date_from) {
            queryText += ` AND b.start_dt >= $${paramIndex}`;
            params.push(date_from);
            paramIndex++;
        }
        
        if (date_to) {
            queryText += ` AND b.end_dt <= $${paramIndex}`;
            params.push(date_to);
            paramIndex++;
        }
        
        queryText += ` ORDER BY b.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(parseInt(limit), parseInt(offset));
        
        const result = await query(queryText, params);
        
        res.json({
            bookings: result.rows
        });
        
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createBooking,
    getMyBookings,
    getBooking,
    cancelBooking,
    confirmBooking,
    getAllBookings
};