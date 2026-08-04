// Vercel Serverless Function - Summer Forecast API
// Returns a multi-day daily temperature + sky-condition forecast for Revelstoke.
// Used by TV Summer mode (see /tv?summer). Source: Open-Meteo (free, no API key).

// Revelstoke Mountain Resort base area
const LATITUDE = 50.9583;
const LONGITUDE = -118.1804;
const RESORT_TIMEZONE = 'America/Vancouver';
const FORECAST_DAYS = 6;

// Map WMO weather codes to a simple sky condition category.
// https://open-meteo.com/en/docs -> "Weather variable documentation"
function codeToCondition(code) {
    if (code === 0) return 'sunny';
    if (code === 1 || code === 2) return 'partly cloudy';
    if (code === 3) return 'cloudy';
    if (code === 45 || code === 48) return 'fog';
    if (code >= 51 && code <= 67) return 'rain';
    if (code >= 71 && code <= 77) return 'snow';
    if (code >= 80 && code <= 82) return 'rain';
    if (code >= 85 && code <= 86) return 'snow';
    if (code >= 95) return 'storm';
    return 'cloudy';
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    // Cache at the edge for 30 min; serve stale for 10 more while revalidating.
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=600');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const url = new URL('https://api.open-meteo.com/v1/forecast');
        url.searchParams.set('latitude', LATITUDE);
        url.searchParams.set('longitude', LONGITUDE);
        url.searchParams.set('daily', 'weathercode,temperature_2m_max,temperature_2m_min');
        url.searchParams.set('timezone', RESORT_TIMEZONE);
        url.searchParams.set('forecast_days', FORECAST_DAYS);

        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RevyTV/1.0)' }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const daily = data.daily || {};
        const dates = daily.time || [];

        const forecast = dates.map((date, i) => {
            const code = daily.weathercode?.[i] ?? 0;
            const tempMax = daily.temperature_2m_max?.[i];
            const tempMin = daily.temperature_2m_min?.[i];
            return {
                date,
                tempMax: tempMax != null ? Math.round(tempMax) : null,
                tempMin: tempMin != null ? Math.round(tempMin) : null,
                weatherCode: code,
                condition: codeToCondition(code)
            };
        });

        return res.status(200).json({
            forecast,
            fetchedAt: new Date().toISOString(),
            source: 'open-meteo'
        });

    } catch (error) {
        console.error('Error fetching summer forecast:', error);
        return res.status(500).json({
            error: 'Failed to fetch summer forecast',
            message: error.message
        });
    }
};

module.exports.codeToCondition = codeToCondition;
