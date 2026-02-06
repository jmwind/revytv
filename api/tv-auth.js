// Vercel Serverless Function - TV Token Authentication
// Validates a TV token and returns user config without Clerk auth

const storage = require('./lib/storage.js');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const token = req.query.token;
    if (!token || typeof token !== 'string' || token.length !== 4) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = await storage.get(`tvtoken:${token.toUpperCase()}`);
    if (!userId) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    const data = await storage.get(`user:${userId}`);
    if (!data) {
        return res.status(401).json({ error: 'User not found' });
    }

    return res.status(200).json(data);
};
