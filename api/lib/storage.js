// Storage abstraction - Upstash Redis in production, JSON file locally
const fs = require('fs');
const path = require('path');

const LOCAL_STORAGE_PATH = path.join(process.cwd(), 'data', 'forecast-history.json');

// Lazy-load Redis client
let redis = null;
function getRedis() {
    if (!redis && useUpstash()) {
        const { Redis } = require('@upstash/redis');
        redis = Redis.fromEnv();
    }
    return redis;
}

// Check if we're using Upstash Redis (environment variables set)
function useUpstash() {
    const redis = getRedis();
    return redis !== null;
}

// Generate mock history for local testing
function generateMockHistory(currentAmount, date) {
    const history = [];
    const numEntries = 3 + Math.floor(Math.random() * 5); // 3-7 entries
    const now = new Date();

    for (let i = numEntries - 1; i >= 0; i--) {
        const daysAgo = i;
        const timestamp = new Date(now);
        timestamp.setDate(timestamp.getDate() - daysAgo);
        timestamp.setHours(8 + Math.floor(Math.random() * 4), 0, 0, 0);

        // Vary the amount around the current value
        let amount;
        if (i === 0) {
            amount = currentAmount; // Last entry is current
        } else {
            // Random variation: ±5cm from current, min 0
            const variation = Math.floor(Math.random() * 11) - 5;
            amount = Math.max(0, currentAmount + variation);
        }

        history.push({
            firstSeen: timestamp.toISOString(),
            amount: amount,
            freezingLevel: 1200 + Math.floor(Math.random() * 5) * 100
        });
    }

    return history;
}

// Local file storage
function ensureLocalStorage() {
    const dir = path.dirname(LOCAL_STORAGE_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(LOCAL_STORAGE_PATH)) {
        fs.writeFileSync(LOCAL_STORAGE_PATH, '{}');
    }
}

function localGet(key) {
    ensureLocalStorage();
    try {
        const data = JSON.parse(fs.readFileSync(LOCAL_STORAGE_PATH, 'utf8'));
        return data[key] || null;
    } catch (e) {
        return null;
    }
}

function localSet(key, value) {
    ensureLocalStorage();
    const data = JSON.parse(fs.readFileSync(LOCAL_STORAGE_PATH, 'utf8'));
    data[key] = value;
    fs.writeFileSync(LOCAL_STORAGE_PATH, JSON.stringify(data, null, 2));
}

function localGetAll() {
    ensureLocalStorage();
    try {
        return JSON.parse(fs.readFileSync(LOCAL_STORAGE_PATH, 'utf8'));
    } catch (e) {
        return {};
    }
}

// Get with mock data generation for local dev
function localGetWithMock(key, currentAmount, date) {
    const existing = localGet(key);
    if (existing && existing.history && existing.history.length > 1) {
        return existing;
    }

    // Generate mock history for testing sparklines
    // Only generate for dates within 5 days - further out dates have no history yet
    if (currentAmount !== undefined && date) {
        const targetDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysOut = Math.floor((targetDate - today) / (1000 * 60 * 60 * 24));

        // No mock history for dates 5+ days out (simulates new forecast entries)
        if (daysOut >= 5) {
            return {
                date: date,
                history: [{ firstSeen: new Date().toISOString(), amount: currentAmount, freezingLevel: 1400 }],
                _isMock: true
            };
        }

        const mockRecord = {
            date: date,
            history: generateMockHistory(currentAmount, date),
            _isMock: true
        };
        return mockRecord;
    }

    return existing;
}

// Upstash Redis storage using SDK
async function redisGet(key) {
    const client = getRedis();
    const result = await client.get(key);
    return result || null;
}

async function redisSet(key, value) {
    const client = getRedis();
    await client.set(key, value);
}

async function redisGetByPrefix(prefix) {
    const client = getRedis();
    const keys = await client.keys(`${prefix}*`);

    const results = {};
    for (const key of keys) {
        results[key] = await redisGet(key);
    }
    return results;
}

// Public API
async function get(key) {
    if (useUpstash()) {
        return await redisGet(key);
    }
    return localGet(key);
}

async function set(key, value) {
    if (useUpstash()) {
        return await redisSet(key, value);
    }
    return localSet(key, value);
}

async function getAllByPrefix(prefix) {
    if (useUpstash()) {
        return await redisGetByPrefix(prefix);
    }
    // Local: filter keys by prefix
    const all = localGetAll();
    const results = {};
    for (const [key, value] of Object.entries(all)) {
        if (key.startsWith(prefix)) {
            results[key] = value;
        }
    }
    return results;
}

// Get with optional mock data for local testing
async function getWithMock(key, currentAmount, date) {
    if (useUpstash()) {
        return await redisGet(key);
    }
    return localGetWithMock(key, currentAmount, date);
}

module.exports = { get, set, getAllByPrefix, useUpstash, getWithMock };
