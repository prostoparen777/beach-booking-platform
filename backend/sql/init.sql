-- Beach Booking Platform Database Schema
-- This file is used for Docker initialization

-- Create database if not exists (run as superuser)
-- CREATE DATABASE beach_booking;
-- \c beach_booking;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'moderator', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE lounger_type AS ENUM ('standard', 'premium', 'vip');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create tables
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role user_role DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS beaches (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    description TEXT,
    amenities JSONB DEFAULT '{}',
    working_hours JSONB DEFAULT '{"open": "08:00", "close": "20:00"}',
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loungers (
    id SERIAL PRIMARY KEY,
    beach_id INTEGER REFERENCES beaches(id) ON DELETE CASCADE,
    number VARCHAR(50) NOT NULL,
    row INTEGER,
    col INTEGER,
    x DECIMAL(10,2),
    y DECIMAL(10,2),
    type lounger_type DEFAULT 'standard',
    price_per_hour DECIMAL(10,2) NOT NULL,
    min_booking_hours INTEGER DEFAULT 1,
    max_booking_hours INTEGER DEFAULT 8,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(beach_id, number)
);

CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    lounger_id INTEGER REFERENCES loungers(id),
    start_dt TIMESTAMP NOT NULL,
    end_dt TIMESTAMP NOT NULL,
    total_price DECIMAL(10,2),
    status booking_status DEFAULT 'pending',
    payment_status payment_status DEFAULT 'pending',
    payment_method VARCHAR(50),
    payment_details JSONB,
    cancellation_reason TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_booking_dates CHECK (end_dt > start_dt)
);

CREATE TABLE IF NOT EXISTS beach_managers (
    id SERIAL PRIMARY KEY,
    beach_id INTEGER REFERENCES beaches(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER REFERENCES users(id),
    UNIQUE(beach_id, user_id)
);

CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    beach_id INTEGER REFERENCES beaches(id) ON DELETE CASCADE,
    booking_id INTEGER REFERENCES bookings(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, booking_id)
);

CREATE TABLE IF NOT EXISTS beach_images (
    id SERIAL PRIMARY KEY,
    beach_id INTEGER REFERENCES beaches(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    caption TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_beaches_location ON beaches(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_beaches_active ON beaches(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_lounger ON bookings(lounger_id);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(start_dt, end_dt);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_loungers_beach ON loungers(beach_id);
CREATE INDEX IF NOT EXISTS idx_loungers_active ON loungers(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_reviews_beach ON reviews(beach_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT unnest(ARRAY['users', 'beaches', 'bookings', 'reviews'])
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON %s', t, t);
        EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
    END LOOP;
END;
$$;

-- Insert default admin user (password: admin123)
INSERT INTO users (email, password_hash, full_name, role, email_verified)
VALUES ('admin@beach-booking.com', '$2b$10$7xQXqKXhcFp9YgDZqT6cMO.BIN5Jm9LMxtqMJ5nfBLfXeQq9YqXLq', 'Admin User', 'admin', TRUE)
ON CONFLICT (email) DO NOTHING;

-- Insert sample data for development
INSERT INTO beaches (name, address, latitude, longitude, description, amenities)
VALUES 
    ('Солнечный пляж', 'ул. Приморская, 1, Сочи', 43.5852, 39.7203, 
     'Прекрасный песчаный пляж с чистой водой и современной инфраструктурой', 
     '{"wifi": true, "shower": true, "parking": true, "cafe": true, "lifeguard": true}'::jsonb),
    ('Лазурный берег', 'ул. Береговая, 15, Сочи', 43.5720, 39.7290, 
     'Уютный пляж с мелкой галькой и кристально чистой водой', 
     '{"shower": true, "parking": true, "lifeguard": true, "playground": true}'::jsonb),
    ('Пляж Ривьера', 'Парк Ривьера, Сочи', 43.5932, 39.7158, 
     'Популярный городской пляж в центре Сочи с развитой инфраструктурой', 
     '{"wifi": true, "shower": true, "cafe": true, "playground": true, "parking": false}'::jsonb)
ON CONFLICT DO NOTHING;

-- Create function to check lounger availability
CREATE OR REPLACE FUNCTION is_lounger_available(
    p_lounger_id INTEGER,
    p_start_dt TIMESTAMP,
    p_end_dt TIMESTAMP,
    p_exclude_booking_id INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM bookings
        WHERE lounger_id = p_lounger_id
        AND status IN ('confirmed', 'pending')
        AND id != COALESCE(p_exclude_booking_id, -1)
        AND (
            (p_start_dt BETWEEN start_dt AND end_dt) OR
            (p_end_dt BETWEEN start_dt AND end_dt) OR
            (start_dt BETWEEN p_start_dt AND p_end_dt) OR
            (end_dt BETWEEN p_start_dt AND p_end_dt)
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to get beach statistics
CREATE OR REPLACE FUNCTION get_beach_stats(
    p_beach_id INTEGER,
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    total_loungers BIGINT,
    total_bookings BIGINT,
    confirmed_bookings BIGINT,
    cancelled_bookings BIGINT,
    total_revenue DECIMAL,
    avg_booking_duration DECIMAL,
    occupancy_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT l.id)::BIGINT as total_loungers,
        COUNT(DISTINCT b.id)::BIGINT as total_bookings,
        COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'confirmed')::BIGINT as confirmed_bookings,
        COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'cancelled')::BIGINT as cancelled_bookings,
        COALESCE(SUM(b.total_price) FILTER (WHERE b.payment_status = 'paid'), 0) as total_revenue,
        COALESCE(AVG(EXTRACT(EPOCH FROM (b.end_dt - b.start_dt)) / 3600), 0) as avg_booking_duration,
        CASE 
            WHEN COUNT(DISTINCT l.id) > 0 THEN 
                (COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'confirmed')::DECIMAL / 
                (COUNT(DISTINCT l.id) * (p_end_date - p_start_date + 1))) * 100
            ELSE 0
        END as occupancy_rate
    FROM loungers l
    LEFT JOIN bookings b ON l.id = b.lounger_id 
        AND b.created_at BETWEEN p_start_date AND p_end_date + INTERVAL '1 day'
    WHERE l.beach_id = p_beach_id AND l.is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust as needed)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO beach_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO beach_app_user;