// Скрипт для проверки настройки проекта
const { Pool } = require('pg');
const redis = require('redis');

async function testSetup() {
    console.log('🔍 Проверка настройки Beach Lounger...\n');
    
    // 1. Проверка PostgreSQL
    console.log('1. Проверка PostgreSQL...');
    const pgPool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'beach_booking',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
    });
    
    try {
        const client = await pgPool.connect();
        const result = await client.query('SELECT COUNT(*) FROM beaches');
        console.log(`✅ PostgreSQL работает! Найдено пляжей: ${result.rows[0].count}`);
        
        if (result.rows[0].count == 0) {
            console.log('⚠️  Нет данных в БД. Выполните backend/sql/init.sql');
        }
        
        client.release();
    } catch (error) {
        console.log('❌ PostgreSQL не работает:', error.message);
        console.log('   Проверьте: запущен ли PostgreSQL, создана ли БД beach_booking');
    }
    
    // 2. Проверка Redis
    console.log('\n2. Проверка Redis...');
    const redisClient = redis.createClient({
        socket: {
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
        }
    });
    
    try {
        await redisClient.connect();
        await redisClient.ping();
        console.log('✅ Redis работает!');
        await redisClient.quit();
    } catch (error) {
        console.log('❌ Redis не работает:', error.message);
        console.log('   Запустите Redis или Memurai');
    }
    
    // 3. Проверка портов
    console.log('\n3. Проверка портов...');
    const net = require('net');
    
    const checkPort = (port, name) => {
        return new Promise((resolve) => {
            const tester = net.createServer()
                .once('error', () => {
                    console.log(`✅ Порт ${port} занят (${name} возможно работает)`);
                    resolve(true);
                })
                .once('listening', () => {
                    tester.close();
                    console.log(`⚠️  Порт ${port} свободен (${name} не запущен)`);
                    resolve(false);
                })
                .listen(port);
        });
    };
    
    await checkPort(5432, 'PostgreSQL');
    await checkPort(6379, 'Redis');
    await checkPort(5000, 'Backend');
    
    console.log('\n📝 Следующие шаги:');
    console.log('1. Убедитесь что PostgreSQL и Redis запущены');
    console.log('2. Создайте файл backend/.env (см. SETUP.md)');
    console.log('3. Выполните SQL из backend/sql/init.sql');
    console.log('4. Запустите backend: cd backend && node server.js');
    console.log('5. Запустите frontend на порту 8080');
    
    process.exit(0);
}

// Загружаем переменные окружения
require('dotenv').config({ path: 'backend/.env' });

testSetup();