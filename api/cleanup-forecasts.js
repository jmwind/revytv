// One-time cleanup endpoint to fix corrupted forecast history data
// Removes duplicate entries that share the same firstSeen timestamp
// (caused by 10-day forecasts with repeated day names writing to the same key)

const storage = require('./lib/storage.js');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'POST only' });
    }

    const dryRun = req.query.dryRun !== 'false'; // default to dry run

    try {
        const allForecasts = await storage.getAllByPrefix('forecast:');
        const results = { checked: 0, cleaned: 0, entriesRemoved: 0, details: [] };

        for (const [key, record] of Object.entries(allForecasts)) {
            if (!record || !record.history || record.history.length === 0) continue;
            results.checked++;

            const seen = new Set();
            const cleaned = [];
            let removed = 0;

            for (const entry of record.history) {
                // For entries with the same timestamp, keep only the first
                if (seen.has(entry.firstSeen)) {
                    removed++;
                    continue;
                }
                seen.add(entry.firstSeen);
                cleaned.push(entry);
            }

            if (removed > 0) {
                results.cleaned++;
                results.entriesRemoved += removed;
                results.details.push({
                    key,
                    before: record.history.length,
                    after: cleaned.length,
                    removed
                });

                if (!dryRun) {
                    record.history = cleaned;
                    await storage.set(key, record);
                }
            }
        }

        return res.status(200).json({
            dryRun,
            message: dryRun
                ? 'Dry run complete. POST with ?dryRun=false to apply changes.'
                : 'Cleanup complete.',
            ...results
        });
    } catch (error) {
        console.error('Cleanup error:', error);
        return res.status(500).json({ error: error.message });
    }
};
