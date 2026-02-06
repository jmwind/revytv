// Vercel Serverless Function - User Config CRUD
// Stores per-user configuration (playlist, future preferences) in Redis

const storage = require('./lib/storage.js');
const { verifyAuth } = require('./lib/auth.js');
const { VALID_THEMES } = require('../theme.js');

const VALID_WEBCAM_SIZES = ['large', 'medium', 'small', 'hidden'];
const VALID_FORECAST_SIZES = ['small', 'medium', 'large'];
const VALID_TICKER_OPTIONS = ['show', 'hidden'];
const MAX_WATERMARK_LENGTH = 40;

const DEFAULT_PLAYLIST = [
    { id: 'spJ5dqXi6ro', title: 'Big mountain' },
    { id: 'BsbMhTEoQiM', title: 'Famillia Fernie 2010' },
    { id: 'TPND631Dh-I', title: 'Famillia Spring Break 2010' },
    { id: 'IRwZN2JvtYc', title: 'Famillia Heli NZ 2013' }
];

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
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

        // Validate theme if provided
        if (body.theme !== undefined) {
            if (!VALID_THEMES.includes(body.theme)) {
                return res.status(400).json({ error: 'Invalid theme' });
            }
        }

        // Validate tvWebcamSize if provided
        if (body.tvWebcamSize !== undefined) {
            if (!VALID_WEBCAM_SIZES.includes(body.tvWebcamSize)) {
                return res.status(400).json({ error: 'Invalid webcam size' });
            }
        }

        // Validate tvForecastSize if provided
        if (body.tvForecastSize !== undefined) {
            if (!VALID_FORECAST_SIZES.includes(body.tvForecastSize)) {
                return res.status(400).json({ error: 'Invalid forecast size' });
            }
        }

        // Validate tvTicker if provided
        if (body.tvTicker !== undefined) {
            if (!VALID_TICKER_OPTIONS.includes(body.tvTicker)) {
                return res.status(400).json({ error: 'Invalid ticker option' });
            }
        }

        // Validate tvWatermark if provided
        if (body.tvWatermark !== undefined) {
            if (typeof body.tvWatermark !== 'string' || body.tvWatermark.length > MAX_WATERMARK_LENGTH) {
                return res.status(400).json({ error: 'Watermark must be a string, max 40 characters' });
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

    if (req.method === 'POST') {
        const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        let token;
        // Generate unique 4-char token
        for (let attempts = 0; attempts < 10; attempts++) {
            token = '';
            for (let i = 0; i < 4; i++) {
                token += CHARS[Math.floor(Math.random() * CHARS.length)];
            }
            const existing = await storage.get(`tvtoken:${token}`);
            if (!existing) break;
        }

        // Remove old token if exists
        const userData = await storage.get(storageKey);
        if (userData?.tvToken) {
            await storage.del(`tvtoken:${userData.tvToken}`);
        }

        // Store reverse lookup
        await storage.set(`tvtoken:${token}`, auth.userId);

        // Update user doc
        const now = new Date().toISOString();
        const updated = {
            ...userData,
            tvToken: token,
            updatedAt: now
        };
        await storage.set(storageKey, updated);

        return res.status(200).json({ tvToken: token });
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
