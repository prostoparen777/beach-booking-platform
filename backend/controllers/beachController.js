const { query, transaction } = require('../config/database');
const { validationResult } = require('express-validator');

// Get all beaches with filters
const getBeaches = async (req, res, next) => {
    try {
        const { 
            search, 
            amenities, 
            limit = 20, 
            offset = 0,
            sort = 'name'
        } = req.query;
        
        let queryText = `
            SELECT 
                b.*,
                COUNT(DISTINCT l.id) as total_loungers,
                COUNT(DISTINCT l.id) FILTER (WHERE l.id NOT IN (
                    SELECT lounger_id FROM bookings 
                    WHERE status IN ('confirmed', 'pending') 
                    AND NOW() BETWEEN start_dt AND end_dt
                )) as available_loungers,
                COALESCE(MIN(l.price_per_hour), 0) as min_price,
                COALESCE(AVG(l.price_per_hour), 0) as avg_price
            FROM beaches b
            LEFT JOIN loungers l ON b.id = l.beach_id AND l.is_active = true
            WHERE 1=1
        `;
        
        const params = [];
        let paramIndex = 1;
        
        // Search filter
        if (search) {
            queryText += ` AND (b.name ILIKE $${paramIndex} OR b.address ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }
        
        // Amenities filter
        if (amenities) {
            const amenityList = amenities.split(',');
            const amenityConditions = amenityList.map(amenity => {
                params.push(amenity);
                return `b.amenities->>'${amenity}' = 'true'`;
            });
            queryText += ` AND (${amenityConditions.join(' AND ')})`;
        }
        
        queryText += ` GROUP BY b.id`;
        
        // Sorting
        const allowedSorts = ['name', 'created_at', 'min_price', 'available_loungers'];
        if (allowedSorts.includes(sort)) {
            queryText += ` ORDER BY ${sort}`;
        }
        
        // Pagination
        queryText += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(parseInt(limit), parseInt(offset));
        
        const result = await query(queryText, params);
        
        // Get total count
        let countQuery = 'SELECT COUNT(*) FROM beaches WHERE 1=1';
        const countParams = [];
        
        if (search) {
            countQuery += ' AND (name ILIKE $1 OR address ILIKE $1)';
            countParams.push(`%${search}%`);
        }
        
        const countResult = await query(countQuery, countParams);
        const totalCount = parseInt(countResult.rows[0].count);
        
        res.json({
            beaches: result.rows,
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

// Get nearby beaches
const getNearbyBeaches = async (req, res, next) => {
    try {
        const { lat, lng, radius = 10 } = req.query;
        
        if (!lat || !lng) {
            return res.status(400).json({
                error: 'Missing coordinates',
                message: 'Необходимо указать координаты'
            });
        }
        
        // Calculate distance using Haversine formula
        const queryText = `
            SELECT 
                b.*,
                COUNT(DISTINCT l.id) as total_loungers,
                COUNT(DISTINCT l.id) FILTER (WHERE l.id NOT IN (
                    SELECT lounger_id FROM bookings 
                    WHERE status IN ('confirmed', 'pending') 
                    AND NOW() BETWEEN start_dt AND end_dt
                )) as available_loungers,
                COALESCE(MIN(l.price_per_hour), 0) as min_price,
                (
                    6371 * acos(
                        cos(radians($1)) * cos(radians(b.latitude)) * 
                        cos(radians(b.longitude) - radians($2)) + 
                        sin(radians($1)) * sin(radians(b.latitude))
                    )
                ) as distance
            FROM beaches b
            LEFT JOIN loungers l ON b.id = l.beach_id AND l.is_active = true
            WHERE (
                6371 * acos(
                    cos(radians($1)) * cos(radians(b.latitude)) * 
                    cos(radians(b.longitude) - radians($2)) + 
                    sin(radians($1)) * sin(radians(b.latitude))
                )
            ) <= $3
            GROUP BY b.id
            ORDER BY distance ASC
        `;
        
        const result = await query(queryText, [
            parseFloat(lat), 
            parseFloat(lng), 
            parseFloat(radius)
        ]);
        
        res.json({
            beaches: result.rows
        });
        
    } catch (error) {
        next(error);
    }
};

// Get single beach with details
const getBeach = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const queryText = `
            SELECT 
                b.*,
                COUNT(DISTINCT l.id) as total_loungers,
                COUNT(DISTINCT l.id) FILTER (WHERE l.id NOT IN (
                    SELECT lounger_id FROM bookings 
                    WHERE status IN ('confirmed', 'pending') 
                    AND NOW() BETWEEN start_dt AND end_dt
                )) as available_loungers,
                COALESCE(MIN(l.price_per_hour), 0) as min_price,
                COALESCE(AVG(l.price_per_hour), 0) as avg_price,
                COALESCE(MAX(l.price_per_hour), 0) as max_price,
                json_agg(DISTINCT jsonb_build_object(
                    'type', l.type,
                    'count', (SELECT COUNT(*) FROM loungers WHERE beach_id = b.id AND type = l.type)
                )) FILTER (WHERE l.type IS NOT NULL) as lounger_types
            FROM beaches b
            LEFT JOIN loungers l ON b.id = l.beach_id AND l.is_active = true
            WHERE b.id = $1
            GROUP BY b.id
        `;
        
        const result = await query(queryText, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Beach not found',
                message: 'Пляж не найден'
            });
        }
        
        res.json(result.rows[0]);
        
    } catch (error) {
        next(error);
    }
};

// Create new beach (admin only)
const createBeach = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const { 
            name, 
            address, 
            latitude, 
            longitude, 
            description, 
            amenities 
        } = req.body;
        
        const result = await query(
            `INSERT INTO beaches 
             (name, address, latitude, longitude, description, amenities, created_by) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING *`,
            [
                name, 
                address, 
                latitude, 
                longitude, 
                description, 
                JSON.stringify(amenities || {}), 
                req.user.id
            ]
        );
        
        res.status(201).json({
            message: 'Beach created successfully',
            beach: result.rows[0]
        });
        
    } catch (error) {
        next(error);
    }
};

// Update beach (admin only)
const updateBeach = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        // Build dynamic update query
        const allowedFields = ['name', 'address', 'latitude', 'longitude', 'description', 'amenities'];
        const setClause = [];
        const values = [];
        let paramIndex = 1;
        
        for (const field of allowedFields) {
            if (updates.hasOwnProperty(field)) {
                setClause.push(`${field} = $${paramIndex}`);
                values.push(field === 'amenities' ? JSON.stringify(updates[field]) : updates[field]);
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
            UPDATE beaches 
            SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP 
            WHERE id = $${paramIndex} 
            RETURNING *
        `;
        
        const result = await query(queryText, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Beach not found',
                message: 'Пляж не найден'
            });
        }
        
        res.json({
            message: 'Beach updated successfully',
            beach: result.rows[0]
        });
        
    } catch (error) {
        next(error);
    }
};

// Delete beach (admin only)
const deleteBeach = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        // Check if beach exists and has active bookings
        const checkResult = await query(
            `SELECT 
                b.id,
                COUNT(bk.id) as active_bookings
             FROM beaches b
             LEFT JOIN loungers l ON b.id = l.beach_id
             LEFT JOIN bookings bk ON l.id = bk.lounger_id 
                AND bk.status IN ('confirmed', 'pending')
                AND bk.end_dt > NOW()
             WHERE b.id = $1
             GROUP BY b.id`,
            [id]
        );
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Beach not found',
                message: 'Пляж не найден'
            });
        }
        
        if (parseInt(checkResult.rows[0].active_bookings) > 0) {
            return res.status(409).json({
                error: 'Cannot delete beach',
                message: 'Невозможно удалить пляж с активными бронированиями'
            });
        }
        
        // Delete beach (loungers and bookings will be cascade deleted)
        await query('DELETE FROM beaches WHERE id = $1', [id]);
        
        res.json({
            message: 'Beach deleted successfully'
        });
        
    } catch (error) {
        next(error);
    }
};

// Get beach statistics (admin/manager)
const getBeachStats = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { period = 'day' } = req.query;
        
        // Define period for statistics
        let periodCondition;
        switch (period) {
            case 'day':
                periodCondition = "DATE(bk.created_at) = CURRENT_DATE";
                break;
            case 'week':
                periodCondition = "bk.created_at >= CURRENT_DATE - INTERVAL '7 days'";
                break;
            case 'month':
                periodCondition = "bk.created_at >= CURRENT_DATE - INTERVAL '30 days'";
                break;
            default:
                periodCondition = "1=1";
        }
        
        const statsQuery = `
            SELECT 
                COUNT(DISTINCT bk.id) as total_bookings,
                COUNT(DISTINCT bk.id) FILTER (WHERE bk.status = 'confirmed') as confirmed_bookings,
                COUNT(DISTINCT bk.id) FILTER (WHERE bk.status = 'cancelled') as cancelled_bookings,
                COALESCE(SUM(bk.total_price) FILTER (WHERE bk.payment_status = 'paid'), 0) as total_revenue,
                COUNT(DISTINCT bk.user_id) as unique_customers,
                AVG(EXTRACT(EPOCH FROM (bk.end_dt - bk.start_dt)) / 3600)::numeric(10,1) as avg_booking_hours,
                (
                    SELECT COUNT(*) FROM loungers 
                    WHERE beach_id = $1 AND is_active = true
                ) as total_loungers,
                (
                    SELECT COUNT(*) FROM loungers l
                    WHERE l.beach_id = $1 
                    AND l.is_active = true
                    AND l.id NOT IN (
                        SELECT lounger_id FROM bookings 
                        WHERE status IN ('confirmed', 'pending') 
                        AND NOW() BETWEEN start_dt AND end_dt
                    )
                ) as available_loungers
            FROM beaches b
            LEFT JOIN loungers l ON b.id = l.beach_id
            LEFT JOIN bookings bk ON l.id = bk.lounger_id AND ${periodCondition}
            WHERE b.id = $1
            GROUP BY b.id
        `;
        
        const result = await query(statsQuery, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Beach not found',
                message: 'Пляж не найден'
            });
        }
        
        // Get popular times
        const popularTimesQuery = `
            SELECT 
                EXTRACT(HOUR FROM bk.start_dt) as hour,
                COUNT(*) as bookings_count
            FROM bookings bk
            JOIN loungers l ON bk.lounger_id = l.id
            WHERE l.beach_id = $1 
            AND bk.status = 'confirmed'
            AND bk.created_at >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY hour
            ORDER BY hour
        `;
        
        const popularTimes = await query(popularTimesQuery, [id]);
        
        res.json({
            stats: result.rows[0],
            popularTimes: popularTimes.rows,
            period
        });
        
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getBeaches,
    getNearbyBeaches,
    getBeach,
    createBeach,
    updateBeach,
    deleteBeach,
    getBeachStats
};