const { Pool } = require('pg');
const redis = require('redis');
const winston = require('winston');

// Logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// PostgreSQL configuration
const pgPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'beach_booking',
    user: process.env.DB_USER || 'beach_admin',
    password: process.env.DB_PASSWORD || 'beach_secure_pass',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Redis configuration
const redisClient = redis.createClient({
    socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
    },
    password: process.env.REDIS_PASSWORD || undefined,
});

// Redis connection events
redisClient.on('error', (err) => {
    logger.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
    logger.info('Redis Client Connected');
});

// Connect to Redis
async function connectRedis() {
    try {
        await redisClient.connect();
    } catch (error) {
        logger.error('Failed to connect to Redis:', error);
    }
}

// Database initialization
async function initializeDatabase() {
    try {
        // Test PostgreSQL connection
        const client = await pgPool.connect();
        await client.query('SELECT NOW()');
        client.release();
        logger.info('PostgreSQL connected successfully');
        
        // Create tables if they don't exist
        await createTables();
        
        // Connect to Redis
        await connectRedis();
        
        return true;
    } catch (error) {
        logger.error('Database initialization failed:', error);
        throw error;
    }
}

// Create database tables
async function createTables() {
    const client = await pgPool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Create users table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create beaches table
        await client.query(`
            CREATE TABLE IF NOT EXISTS beaches (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                address TEXT,
                latitude DECIMAL(10,8) NOT NULL,
                longitude DECIMAL(11,8) NOT NULL,
                description TEXT,
                amenities JSONB,
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create loungers table
        await client.query(`
            CREATE TABLE IF NOT EXISTS loungers (
                id SERIAL PRIMARY KEY,
                beach_id INTEGER REFERENCES beaches(id) ON DELETE CASCADE,
                number VARCHAR(50) NOT NULL,
                row INTEGER,
                col INTEGER,
                x DECIMAL(10,2),
                y DECIMAL(10,2),
                type VARCHAR(20) DEFAULT 'standard' CHECK (type IN ('standard', 'premium', 'vip')),
                price_per_hour DECIMAL(10,2) NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(beach_id, number)
            )
        `);
        
        // Create bookings table
        await client.query(`
            CREATE TABLE IF NOT EXISTS bookings (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                lounger_id INTEGER REFERENCES loungers(id),
                start_dt TIMESTAMP NOT NULL,
                end_dt TIMESTAMP NOT NULL,
                total_price DECIMAL(10,2),
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
                payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create beach_managers table
        await client.query(`
            CREATE TABLE IF NOT EXISTS beach_managers (
                id SERIAL PRIMARY KEY,
                beach_id INTEGER REFERENCES beaches(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(beach_id, user_id)
            )
        `);
        
        // Create indexes
        await client.query('CREATE INDEX IF NOT EXISTS idx_beaches_location ON beaches(latitude, longitude)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_bookings_lounger ON bookings(lounger_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(start_dt, end_dt)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_loungers_beach ON loungers(beach_id)');
        
        // Create update trigger for updated_at
        await client.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';
        `);
        
        // Apply trigger to tables with updated_at
        const tablesWithUpdatedAt = ['users', 'beaches', 'bookings'];
        for (const table of tablesWithUpdatedAt) {
            await client.query(`
                DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
                CREATE TRIGGER update_${table}_updated_at
                BEFORE UPDATE ON ${table}
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
            `);
        }
        
        await client.query('COMMIT');
        logger.info('Database tables created successfully');
        
        // Insert sample data in development
        if (process.env.NODE_ENV !== 'production') {
            await insertSampleData();
        }
        
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Insert sample data for development
async function insertSampleData() {
    const client = await pgPool.connect();
    
    try {
        // Check if data already exists
        const { rows } = await client.query('SELECT COUNT(*) FROM beaches');
        if (rows[0].count > 0) {
            return;
        }
        
        await client.query('BEGIN');
        
        // Insert sample beaches
        const beachesResult = await client.query(`
            INSERT INTO beaches (name, address, latitude, longitude, description, amenities)
            VALUES 
                ('Солнечный пляж', 'ул. Приморская, 1', 43.5852, 39.7203, 'Прекрасный песчаный пляж с чистой водой', '{"wifi": true, "shower": true, "parking": true, "cafe": true}'::jsonb),
                ('Лазурный берег', 'ул. Береговая, 15', 43.5720, 39.7290, 'Уютный пляж с галькой и прозрачной водой', '{"shower": true, "parking": true, "lifeguard": true}'::jsonb),
                ('Пляж Ривьера', 'Парк Ривьера', 43.5932, 39.7158, 'Городской пляж в центре Сочи', '{"wifi": true, "shower": true, "cafe": true, "playground": true}'::jsonb)
            RETURNING id
        `);
        
        // Insert sample loungers for each beach
        for (let i = 0; i < beachesResult.rows.length; i++) {
            const beachId = beachesResult.rows[i].id;
            const loungers = [];
            
            // Generate loungers grid
            for (let row = 1; row <= 5; row++) {
                for (let col = 1; col <= 8; col++) {
                    const number = `${String.fromCharCode(64 + row)}${col}`;
                    const type = col <= 2 ? 'vip' : col <= 5 ? 'premium' : 'standard';
                    const price = type === 'vip' ? 500 : type === 'premium' ? 300 : 150;
                    
                    loungers.push(`(${beachId}, '${number}', ${row}, ${col}, ${col * 80}, ${row * 100}, '${type}', ${price})`);
                }
            }
            
            await client.query(`
                INSERT INTO loungers (beach_id, number, row, col, x, y, type, price_per_hour)
                VALUES ${loungers.join(', ')}
            `);
        }
        
        await client.query('COMMIT');
        logger.info('Sample data inserted successfully');
        
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Failed to insert sample data:', error);
    } finally {
        client.release();
    }
}

// Database query helper
async function query(text, params) {
    const start = Date.now();
    const res = await pgPool.query(text, params);
    const duration = Date.now() - start;
    logger.info('Executed query', { text, duration, rows: res.rowCount });
    return res;
}

// Transaction helper
async function transaction(callback) {
    const client = await pgPool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    pgPool,
    redisClient,
    initializeDatabase,
    query,
    transaction
};