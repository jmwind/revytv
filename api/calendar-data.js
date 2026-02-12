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

        // Group records by date (merging plain, :day, :night)
        const dateGroups = {};

        for (const [key, record] of Object.entries(allRecords)) {
            if (!record || !record.history || record.history.length === 0) continue;

            // Extract date from key (format: forecast:YYYY-MM-DD or forecast:YYYY-MM-DD:day/night)
            const dateMatch = key.match(/forecast:(\d{4}-\d{2}-\d{2})/);
            if (!dateMatch) continue;

            const dateStr = dateMatch[1];
            const recordYear = parseInt(dateStr.substring(0, 4));

            if (recordYear !== year) continue;

            // Initialize group for this date
            if (!dateGroups[dateStr]) {
                dateGroups[dateStr] = { plain: null, day: null, night: null };
            }

            // Categorize by suffix
            if (key.includes(':day')) {
                dateGroups[dateStr].day = record.history;
            } else if (key.includes(':night')) {
                dateGroups[dateStr].night = record.history;
            } else {
                dateGroups[dateStr].plain = record.history;
            }
        }

        // Merge histories for each date and calculate stats
        const yearData = {};

        for (const [dateStr, group] of Object.entries(dateGroups)) {
            // Merge histories in order: plain (future forecasts) -> day -> night
            const mergedHistory = [
                ...(group.plain || []),
                ...(group.day || []),
                ...(group.night || [])
            ].sort((a, b) => new Date(a.firstSeen) - new Date(b.firstSeen));

            if (mergedHistory.length === 0) continue;

            const firstAmount = mergedHistory[0].amount;
            const lastAmount = mergedHistory[mergedHistory.length - 1].amount;
            const delta = lastAmount - firstAmount;

            yearData[dateStr] = {
                date: dateStr,
                history: mergedHistory,
                firstAmount: firstAmount,
                lastAmount: lastAmount,
                delta: delta,
                historyCount: mergedHistory.length
            };
        }

        // Get snowfall history for the full ski season (Oct of prior year through current year)
        const allSnowfall = await storage.getAllByPrefix('snowfall:');
        const snowfallData = {};

        const seasonStartMonth = 10; // October
        for (const [key, record] of Object.entries(allSnowfall)) {
            if (!record || !record.date) continue;

            const recordYear = parseInt(record.date.substring(0, 4));
            const recordMonth = parseInt(record.date.substring(5, 7));

            // Include: current year's data OR previous year's Oct-Dec (season start)
            const isCurrentYear = recordYear === year;
            const isPreviousFall = recordYear === year - 1 && recordMonth >= seasonStartMonth;
            if (!isCurrentYear && !isPreviousFall) continue;

            snowfallData[record.date] = {
                date: record.date,
                seasonTotal: record.seasonTotal,
                recordedAt: record.recordedAt
            };
        }

        return res.status(200).json({
            year: year,
            data: yearData,
            snowfall: snowfallData,
            count: Object.keys(yearData).length,
            snowfallCount: Object.keys(snowfallData).length,
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
