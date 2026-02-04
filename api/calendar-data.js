// Vercel Serverless Function - Calendar Data API
// Returns all historical forecast data for calendar view

const storage = require('./lib/storage.js');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const year = parseInt(req.query.year) || new Date().getFullYear();

        // Get all forecast records from storage
        const allRecords = await storage.getAllByPrefix('forecast:');

        // Filter and process for requested year
        const yearData = {};

        for (const [key, record] of Object.entries(allRecords)) {
            if (!record || !record.history || record.history.length === 0) continue;

            // Extract date from key (format: forecast:YYYY-MM-DD or forecast:YYYY-MM-DD:night)
            const dateMatch = key.match(/forecast:(\d{4}-\d{2}-\d{2})/);
            if (!dateMatch) continue;

            const dateStr = dateMatch[1];
            const recordYear = parseInt(dateStr.substring(0, 4));

            if (recordYear !== year) continue;

            // Check if this is a night entry
            const isNight = key.includes(':night');
            const displayKey = isNight ? `${dateStr}:night` : dateStr;

            // Calculate delta (last - first amount)
            const history = record.history;
            const firstAmount = history[0].amount;
            const lastAmount = history[history.length - 1].amount;
            const delta = lastAmount - firstAmount;

            yearData[displayKey] = {
                date: dateStr,
                isNight: isNight,
                history: history,
                firstAmount: firstAmount,
                lastAmount: lastAmount,
                delta: delta,
                historyCount: history.length
            };
        }

        return res.status(200).json({
            year: year,
            data: yearData,
            count: Object.keys(yearData).length,
            fetchedAt: new Date().toISOString(),
            storageMode: storage.useUpstash() ? 'upstash-redis' : 'local-json'
        });

    } catch (error) {
        console.error('Error fetching calendar data:', error);
        return res.status(500).json({
            error: 'Failed to fetch calendar data',
            message: error.message
        });
    }
};
