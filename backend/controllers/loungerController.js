const { query, transaction } = require('../config/database');
const { validationResult } = require('express-validator');

// Get loungers for a beach
const getBeachLoungers = async (req, res, next) => {
    try {
        const { beachId } = req.params;
        const { type, available, date } = req.query;
        
        // Base query
        let queryText = `
            SELECT 
                l.*,
                CASE 
                    WHEN bk.id IS NOT NULL THEN false 
                    ELSE true 
                END as is_available,
                bk.end_dt as current_booking_end,
                bk.user_id as current_user_id
            FROM loungers l
            LEFT JOIN bookings bk ON l.id = bk.lounger_id 
                AND bk.status IN ('confirmed', 'pending')
                AND $2::timestamp BETWEEN bk.start_dt AND bk.end_dt
            WHERE l.beach_id = $1 AND l.is_active = true
        `;
        
        const params = [beachId, date || 'NOW()'];
        let paramIndex = 3;
        
        // Filter by type
        if (type) {
            queryText += ` AND l.type = $${paramIndex}`;
            params.push(type);
            paramIndex++;
        }
        
        // Filter by availability
        if (available === 'true') {
            queryText += ` AND bk.id IS NULL`;
        } else if (available === 'false') {
            queryText += ` AND bk.id IS NOT NULL`;
        }
        
        queryText += ` ORDER BY l.row, l.col`;
        
        const result = await query(queryText, params);
        
        res.json({
            loungers: result.rows,
            beach_id: beachId,
            date: date || new Date().toISOString()
        });
        
    } catch (error) {
        next(error);
    }
};

// Get single lounger details
const getLounger = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const result = await query(
            `SELECT l.*, b.name as beach_name, b.address as beach_address
             FROM loungers l
             JOIN beaches b ON l.beach_id = b.id
             WHERE l.id = $1`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Lounger not found',
                message: 'Лежак не найден'
            });
        }
        
        res.json(result.rows[0]);
        
    } catch (error) {
        next(error);
    }
};

// Get lounger availability
const getLoungerAvailability = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { date, days = 7 } = req.query;
        
        const startDate = date ? new Date(date) : new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + parseInt(days));
        
        // Get all bookings for this lounger in the date range
        const bookingsResult = await query(
            `SELECT 
                id,
                start_dt,
                end_dt,
                status
             FROM bookings
             WHERE lounger_id = $1
             AND status IN ('confirmed', 'pending')
             AND (
                (start_dt BETWEEN $2 AND $3) OR
                (end_dt BETWEEN $2 AND $3) OR
                (start_dt <= $2 AND end_dt >= $3)
             )
             ORDER BY start_dt`,
            [id, startDate.toISOString(), endDate.toISOString()]
        );
        
        // Generate availability slots
        const availability = [];
        const currentDate = new Date(startDate);
        
        while (currentDate < endDate) {
            const dayStart = new Date(currentDate);
            dayStart.setHours(8, 0, 0, 0); // Beach opens at 8 AM
            
            const dayEnd = new Date(currentDate);
            dayEnd.setHours(20, 0, 0, 0); // Beach closes at 8 PM
            
            const dayBookings = bookingsResult.rows.filter(booking => {
                const bookingStart = new Date(booking.start_dt);
                const bookingEnd = new Date(booking.end_dt);
                return bookingStart < dayEnd && bookingEnd > dayStart;
            });
            
            // Find available time slots
            const slots = [];
            let slotStart = dayStart;
            
            for (const booking of dayBookings) {
                const bookingStart = new Date(booking.start_dt);
                const bookingEnd = new Date(booking.end_dt);
                
                if (slotStart < bookingStart) {
                    slots.push({
                        start: slotStart.toISOString(),
                        end: bookingStart.toISOString(),
                        available: true
                    });
                }
                
                slots.push({
                    start: bookingStart.toISOString(),
                    end: bookingEnd.toISOString(),
                    available: false,
                    booking_id: booking.id
                });
                
                slotStart = new Date(Math.max(bookingEnd, slotStart));
            }
            
            if (slotStart < dayEnd) {
                slots.push({
                    start: slotStart.toISOString(),
                    end: dayEnd.toISOString(),
                    available: true
                });
            }
            
            availability.push({
                date: currentDate.toISOString().split('T')[0],
                slots: slots
            });
            
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        res.json({
            lounger_id: id,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            availability: availability
        });
        
    } catch (error) {
        next(error);
    }
};

// Create loungers (admin/manager)
const createLoungers = async (req, res, next) => {
    try {
        const { beachId } = req.params;
        const { loungers } = req.body;
        
        if (!Array.isArray(loungers) || loungers.length === 0) {
            return res.status(400).json({
                error: 'Invalid request',
                message: 'Необходимо указать массив лежаков'
            });
        }
        
        // Check if beach exists
        const beachResult = await query(
            'SELECT id FROM beaches WHERE id = $1',
            [beachId]
        );
        
        if (beachResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Beach not found',
                message: 'Пляж не найден'
            });
        }
        
        // Insert loungers in transaction
        const createdLoungers = await transaction(async (client) => {
            const results = [];
            
            for (const lounger of loungers) {
                const result = await client.query(
                    `INSERT INTO loungers 
                     (beach_id, number, row, col, x, y, type, price_per_hour) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
                     RETURNING *`,
                    [
                        beachId,
                        lounger.number,
                        lounger.row,
                        lounger.col,
                        lounger.x,
                        lounger.y,
                        lounger.type || 'standard',
                        lounger.price_per_hour
                    ]
                );
                results.push(result.rows[0]);
            }
            
            return results;
        });
        
        // Emit socket event for real-time update
        const io = req.app.get('io');
        io.to(`beach-${beachId}`).emit('loungers-added', {
            beachId,
            loungers: createdLoungers
        });
        
        res.status(201).json({
            message: 'Loungers created successfully',
            loungers: createdLoungers
        });
        
    } catch (error) {
        if (error.constraint === 'loungers_beach_id_number_key') {
            return res.status(409).json({
                error: 'Duplicate lounger number',
                message: 'Номер лежака уже существует на этом пляже'
            });
        }
        next(error);
    }
};

// Update lounger (admin/manager)
const updateLounger = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        // Build dynamic update query
        const allowedFields = ['number', 'row', 'col', 'x', 'y', 'type', 'price_per_hour', 'is_active'];
        const setClause = [];
        const values = [];
        let paramIndex = 1;
        
        for (const field of allowedFields) {
            if (updates.hasOwnProperty(field)) {
                setClause.push(`${field} = $${paramIndex}`);
                values.push(updates[field]);
                paramIndex++;
            }
        }
        
        if (setClause.length === 0) {
            return res.status(400).json({
                error: 'No fields to update',
                message: 'Нет полей для обновления'
            });
        }
        
        values.push(id);
        
        const queryText = `
            UPDATE loungers 
            SET ${setClause.join(', ')} 
            WHERE id = $${paramIndex} 
            RETURNING *, 
            (SELECT beach_id FROM loungers WHERE id = $${paramIndex}) as beach_id
        `;
        
        const result = await query(queryText, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Lounger not found',
                message: 'Лежак не найден'
            });
        }
        
        const updatedLounger = result.rows[0];
        
        // Emit socket event for real-time update
        const io = req.app.get('io');
        io.to(`beach-${updatedLounger.beach_id}`).emit('lounger-updated', {
            beachId: updatedLounger.beach_id,
            lounger: updatedLounger
        });
        
        res.json({
            message: 'Lounger updated successfully',
            lounger: updatedLounger
        });
        
    } catch (error) {
        if (error.constraint === 'loungers_beach_id_number_key') {
            return res.status(409).json({
                error: 'Duplicate lounger number',
                message: 'Номер лежака уже существует на этом пляже'
            });
        }
        next(error);
    }
};

// Delete lounger (admin/manager)
const deleteLounger = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        // Check if lounger has active bookings
        const checkResult = await query(
            `SELECT 
                l.id,
                l.beach_id,
                COUNT(b.id) as active_bookings
             FROM loungers l
             LEFT JOIN bookings b ON l.id = b.lounger_id 
                AND b.status IN ('confirmed', 'pending')
                AND b.end_dt > NOW()
             WHERE l.id = $1
             GROUP BY l.id, l.beach_id`,
            [id]
        );
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Lounger not found',
                message: 'Лежак не найден'
            });
        }
        
        const loungerInfo = checkResult.rows[0];
        
        if (parseInt(loungerInfo.active_bookings) > 0) {
            return res.status(409).json({
                error: 'Cannot delete lounger',
                message: 'Невозможно удалить лежак с активными бронированиями'
            });
        }
        
        // Delete lounger
        await query('DELETE FROM loungers WHERE id = $1', [id]);
        
        // Emit socket event for real-time update
        const io = req.app.get('io');
        io.to(`beach-${loungerInfo.beach_id}`).emit('lounger-deleted', {
            beachId: loungerInfo.beach_id,
            loungerId: id
        });
        
        res.json({
            message: 'Lounger deleted successfully'
        });
        
    } catch (error) {
        next(error);
    }
};

// Batch update loungers positions (for drag-and-drop in admin panel)
const updateLoungersPositions = async (req, res, next) => {
    try {
        const { beachId } = req.params;
        const { positions } = req.body;
        
        if (!Array.isArray(positions) || positions.length === 0) {
            return res.status(400).json({
                error: 'Invalid request',
                message: 'Необходимо указать массив позиций'
            });
        }
        
        // Update positions in transaction
        await transaction(async (client) => {
            for (const pos of positions) {
                await client.query(
                    `UPDATE loungers 
                     SET x = $1, y = $2, row = $3, col = $4 
                     WHERE id = $5 AND beach_id = $6`,
                    [pos.x, pos.y, pos.row, pos.col, pos.id, beachId]
                );
            }
        });
        
        // Emit socket event for real-time update
        const io = req.app.get('io');
        io.to(`beach-${beachId}`).emit('loungers-repositioned', {
            beachId,
            positions
        });
        
        res.json({
            message: 'Lounger positions updated successfully'
        });
        
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getBeachLoungers,
    getLounger,
    getLoungerAvailability,
    createLoungers,
    updateLounger,
    deleteLounger,
    updateLoungersPositions
};