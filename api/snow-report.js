// Vercel Serverless Function - Snow Report API
// Fetches, parses, and tracks historical forecast changes

const storage = require('./lib/storage.js');

const SNOW_REPORT_URL = 'https://www.revelstokemountainresort.com/mountain/conditions/snow-report/';

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const response = await fetch(SNOW_REPORT_URL, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RevyTV/1.0)' }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const html = await response.text();
        const data = parseSnowReport(html);
        const fetchedAt = new Date().toISOString();

        // Convert day names to dates and track history
        data.forecast = await trackForecastHistory(data.forecast, fetchedAt);

        data.fetchedAt = fetchedAt;
        data.source = SNOW_REPORT_URL;
        data.storageMode = storage.useUpstash() ? 'upstash-redis' : 'local-json';

        return res.status(200).json(data);

    } catch (error) {
        console.error('Error fetching snow report:', error);
        return res.status(500).json({
            error: 'Failed to fetch snow report',
            message: error.message
        });
    }
};

// Convert day name to actual date
function dayNameToDate(dayName, referenceDate = new Date()) {
    const today = new Date(referenceDate);
    today.setHours(0, 0, 0, 0);

    if (dayName === 'Today') {
        return formatDate(today);
    }

    if (dayName === 'Tonight') {
        return formatDate(today); // Same date as today
    }

    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayIndex = today.getDay();
    const targetIndex = weekdays.indexOf(dayName);

    if (targetIndex === -1) return null;

    let daysUntil = targetIndex - todayIndex;
    if (daysUntil <= 0) daysUntil += 7; // Next week

    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + daysUntil);

    return formatDate(targetDate);
}

function formatDate(date) {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

// Track forecast history - only store changes
async function trackForecastHistory(forecasts, fetchedAt) {
    const updatedForecasts = [];

    for (const forecast of forecasts) {
        const actualDate = dayNameToDate(forecast.day);
        if (!actualDate) {
            updatedForecasts.push(forecast);
            continue;
        }

        const storageKey = `forecast:${actualDate}`;
        // Use getWithMock for local dev to generate test sparkline data
        let record = await storage.getWithMock(storageKey, forecast.amount, actualDate);

        if (!record) {
            // First time seeing this date
            record = {
                date: actualDate,
                dayName: forecast.day,
                history: []
            };
        }

        // Check if forecast changed from last entry
        const lastEntry = record.history[record.history.length - 1];
        const hasChanged = !lastEntry ||
            lastEntry.amount !== forecast.amount ||
            lastEntry.freezingLevel !== forecast.freezingLevel;

        if (hasChanged) {
            record.history.push({
                firstSeen: fetchedAt,
                amount: forecast.amount,
                freezingLevel: forecast.freezingLevel
            });

            // Keep only last 30 entries per date to limit storage
            if (record.history.length > 30) {
                record.history = record.history.slice(-30);
            }

            await storage.set(storageKey, record);
        }

        // Add history and date to forecast response
        updatedForecasts.push({
            ...forecast,
            actualDate: actualDate,
            history: record.history
        });
    }

    return updatedForecasts;
}

function parseSnowReport(html) {
    const result = {
        weather: {},
        snow: {},
        forecast: []
    };

    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

    // Weather data
    const alpineTempMatch = text.match(/Alpine\s+temperature:\s+Low\s+(-?\d+)\s*°C/i);
    const conditionMatch = text.match(/\b(Mainly\s+cloudy|Cloudy|Clear|Sunny|Snow|Snowing|Overcast|Partly\s+cloudy|Flurries)\b/i);
    const windMatch = text.match(/Ridge\s+wind\s+(\w+):\s+(\d+)\s+km\/h/i);

    if (alpineTempMatch) {
        result.weather.alpineTemp = parseInt(alpineTempMatch[1]);
        result.weather.subpeakTemp = result.weather.alpineTemp + 1;
        result.weather.ripperTemp = result.weather.alpineTemp + 1;
    }

    if (conditionMatch) {
        result.weather.condition = conditionMatch[1].toLowerCase();
    }

    if (windMatch) {
        result.weather.windSpeed = parseInt(windMatch[2]);
        result.weather.windDirection = windMatch[1].charAt(0).toUpperCase() + windMatch[1].slice(1).toLowerCase();
    }

    // Snow data
    const newSnowMatch = text.match(/NEW\s+SNOW[\s\S]{0,100}?(\d+)\s*CM/i);
    const lastHourMatch = text.match(/LAST\s+HOUR[\s\S]{0,100}?(\d+)\s*CM/i);
    const twentyFourHourMatch = text.match(/24\s+HOURS[\s\S]{0,100}?(\d+)\s*CM/i);
    const fortyEightHourMatch = text.match(/48\s+HOURS[\s\S]{0,100}?(\d+)\s*CM/i);
    const sevenDayMatch = text.match(/7\s+DAYS[\s\S]{0,100}?(\d+)\s*CM/i);
    const baseDepthMatch = text.match(/BASE\s+DEPTH[\s\S]{0,100}?(\d+)\s*CM/i);
    const seasonMatch = text.match(/SEASON\s+TOTAL[\s\S]{0,100}?(\d+)\s*CM/i);

    result.snow.newSnow = newSnowMatch ? parseInt(newSnowMatch[1]) : 0;
    result.snow.lastHour = lastHourMatch ? parseInt(lastHourMatch[1]) : 0;
    result.snow.twentyFourHour = twentyFourHourMatch ? parseInt(twentyFourHourMatch[1]) : 0;
    result.snow.fortyEightHour = fortyEightHourMatch ? parseInt(fortyEightHourMatch[1]) : 0;
    result.snow.sevenDay = sevenDayMatch ? parseInt(sevenDayMatch[1]) : 0;
    result.snow.baseDepth = baseDepthMatch ? parseInt(baseDepthMatch[1]) : 0;
    result.snow.seasonTotal = seasonMatch ? parseInt(seasonMatch[1]) : 0;

    result.forecast = extractForecast(html);

    return result;
}

function extractForecast(html) {
    const forecast = [];
    const days = ['Today', 'Tonight', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const addedDays = new Set();

    for (const day of days) {
        if (addedDays.has(day)) continue;

        const dayPattern = new RegExp(
            `<h[1-6][^>]*>\\s*${day}\\s*</h[1-6]>([\\s\\S]*?)(?=<h[1-6]|$)`,
            'i'
        );
        const dayMatch = html.match(dayPattern);

        if (dayMatch) {
            const sectionHtml = dayMatch[1];
            const sectionText = sectionHtml.replace(/<[^>]*>/g, ' ');

            const snowMatch = sectionText.match(/Snow:\s*(\d+)\s*cm/i);
            const amount = snowMatch ? parseInt(snowMatch[1]) : 0;

            let freezingLevel = null;
            const freezingMatch = sectionText.match(/Freezing\s+level:\s*(\d+)\s*metres?/i);
            const valleyMatch = sectionText.match(/Freezing\s+level\s+at\s+valley\s+bottom/i);

            if (freezingMatch) {
                freezingLevel = parseInt(freezingMatch[1]);
            } else if (valleyMatch) {
                freezingLevel = 'valley bottom';
            }

            const descMatch = sectionText.match(/^\s*([A-Z][^.]*\.)/);
            const description = descMatch ? descMatch[1].trim() : null;

            forecast.push({ day, amount, freezingLevel, description });
            addedDays.add(day);
        }
    }

    // Sort forecast
    const todayIndex = new Date().getDay();
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    forecast.sort((a, b) => {
        const sortOrder = (d) => {
            if (d === 'Today') return 0;
            if (d === 'Tonight') return 1;
            const dayIndex = weekdays.indexOf(d);
            if (dayIndex === -1) return 99;
            let daysFromToday = dayIndex - todayIndex;
            if (daysFromToday <= 0) daysFromToday += 7;
            return 1 + daysFromToday;
        };
        return sortOrder(a.day) - sortOrder(b.day);
    });

    return forecast;
}
