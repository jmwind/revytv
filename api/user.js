// Vercel Serverless Function - User Config CRUD
// Stores per-user configuration (playlist, future preferences) in Redis

const storage = require('./lib/storage.js');
const { verifyAuth } = require('./lib/auth.js');

const DEFAULT_PLAYLIST = [
    { id: 'spJ5dqXi6ro', title: 'Big mountain' },
    { id: 'BsbMhTEoQiM', title: 'Famillia Fernie 2010' },
    { id: 'TPND631Dh-I', title: 'Famillia Spring Break 2010' },
    { id: 'IRwZN2JvtYc', title: 'Famillia Heli NZ 2013' }
];

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const auth = await verifyAuth(req);
    if (!auth) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const storageKey = `user:${auth.userId}`;

    if (req.method === 'GET') {
        let data = await storage.get(storageKey);
        if (!data) {
            const now = new Date().toISOString();
            data = {
                playlist: DEFAULT_PLAYLIST,
                createdAt: now,
                updatedAt: now
            };
            await storage.set(storageKey, data);
        }
        return res.status(200).json(data);
    }

    if (req.method === 'PUT') {
        const body = req.body;
        if (!body || typeof body !== 'object') {
            return res.status(400).json({ error: 'Invalid request body' });
        }

        // Validate playlist if provided
        if (body.playlist !== undefined) {
            if (!Array.isArray(body.playlist) || body.playlist.length > 50) {
                return res.status(400).json({ error: 'Playlist must be an array with max 50 items' });
            }
            for (const item of body.playlist) {
                if (!item.id || typeof item.id !== 'string' || !item.title || typeof item.title !== 'string') {
                    return res.status(400).json({ error: 'Each playlist item must have id and title strings' });
                }
            }
        }

        // Shallow-merge into existing doc
        const existing = await storage.get(storageKey);
        const now = new Date().toISOString();
        const updated = {
            playlist: DEFAULT_PLAYLIST,
            createdAt: now,
            ...existing,
            ...body,
            updatedAt: now
        };

        // Don't let client overwrite metadata
        delete updated.createdAt;
        updated.createdAt = existing?.createdAt || now;

        await storage.set(storageKey, updated);
        return res.status(200).json(updated);
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
