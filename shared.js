// Shared utilities for dashboard and TV mode

function calculateTrend(history) {
    if (!history || history.length < 2) return { direction: 'none', change: 0 };

    const amounts = history.map(h => h.amount);
    const firstVal = amounts[0];
    const lastVal = amounts[amounts.length - 1];
    const change = lastVal - firstVal;

    if (change > 0) return { direction: 'up', change, color: 'var(--trend-up, #4ade80)' };
    if (change < 0) return { direction: 'down', change, color: 'var(--trend-down, #f87171)' };
    return { direction: 'none', change: 0, color: 'var(--trend-neutral, #94a3b8)' };
}

function generateTrendArrow(history) {
    const trend = calculateTrend(history);
    if (trend.direction === 'none') return '';

    const arrow = trend.direction === 'up' ? '▲' : '▼';
    const absChange = Math.abs(trend.change);

    return `<span class="trend-arrow" style="color: ${trend.color}" title="Changed ${trend.direction === 'up' ? '+' : ''}${trend.change}cm">${arrow} ${absChange}</span>`;
}

function getWeatherIcon(description, amount) {
    const desc = (description || '').toLowerCase();
    if (amount >= 5) {
        // Heavy snow
        return `<svg class="weather-icon weather-icon-snow" viewBox="0 0 20 20" fill="none">
            <path d="M5 10.5a2.5 2.5 0 01.4-5 4 4 0 017.7-.5A2.8 2.8 0 0116 10.5H5z" fill="currentColor"/>
            <circle cx="6.5" cy="13.5" r="1" fill="currentColor"/><circle cx="10" cy="14.5" r="1" fill="currentColor"/><circle cx="13.5" cy="13.5" r="1" fill="currentColor"/>
            <circle cx="8" cy="17.5" r="1" fill="currentColor"/><circle cx="12" cy="17.5" r="1" fill="currentColor"/>
        </svg>`;
    }
    if (amount > 0) {
        // Flurries / light snow
        return `<svg class="weather-icon weather-icon-flurries" viewBox="0 0 20 20" fill="none">
            <path d="M5 10.5a2.5 2.5 0 01.4-5 4 4 0 017.7-.5A2.8 2.8 0 0116 10.5H5z" fill="currentColor"/>
            <circle cx="7" cy="14" r="0.9" fill="currentColor"/><circle cx="10.5" cy="15" r="0.9" fill="currentColor"/><circle cx="14" cy="13.5" r="0.9" fill="currentColor"/>
        </svg>`;
    }
    if (/sun|clear/i.test(desc)) {
        // Sunny / clear
        return `<svg class="weather-icon weather-icon-sun" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="3.5" fill="currentColor"/>
            <line x1="10" y1="2" x2="10" y2="4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="10" y1="15.5" x2="10" y2="18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="2" y1="10" x2="4.5" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="15.5" y1="10" x2="18" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="4.3" y1="4.3" x2="6.1" y2="6.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="13.9" y1="13.9" x2="15.7" y2="15.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="15.7" y1="4.3" x2="13.9" y2="6.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="6.1" y1="13.9" x2="4.3" y2="15.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>`;
    }
    // Default: cloud
    return `<svg class="weather-icon weather-icon-cloud" viewBox="0 0 20 20" fill="none">
        <path d="M5 13a2.5 2.5 0 01.4-5 4 4 0 017.7-.5A2.8 2.8 0 0116 13H5z" fill="currentColor"/>
    </svg>`;
}

// Summer sky-condition icon, keyed off Open-Meteo condition string
// (see api/summer-forecast.js codeToCondition). Reuses the sun/cloud marks
// from getWeatherIcon and adds a rain variant.
function getSummerWeatherIcon(condition) {
    const cond = (condition || '').toLowerCase();

    if (cond === 'sunny') {
        return getWeatherIcon('sunny', 0);
    }

    if (cond === 'partly cloudy') {
        // Sun peeking behind a cloud
        return `<svg class="weather-icon weather-icon-sun" viewBox="0 0 20 20" fill="none">
            <circle cx="7" cy="7" r="2.6" fill="currentColor"/>
            <line x1="7" y1="1.5" x2="7" y2="3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            <line x1="1.5" y1="7" x2="3" y2="7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            <line x1="3.2" y1="3.2" x2="4.3" y2="4.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            <line x1="10.8" y1="3.2" x2="9.7" y2="4.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            <path d="M6 15a2.5 2.5 0 01.4-5 4 4 0 017.7-.5A2.8 2.8 0 0117 15H6z" fill="currentColor"/>
        </svg>`;
    }

    if (cond === 'rain' || cond === 'storm') {
        return `<svg class="weather-icon weather-icon-cloud" viewBox="0 0 20 20" fill="none">
            <path d="M5 11a2.5 2.5 0 01.4-5 4 4 0 017.7-.5A2.8 2.8 0 0116 11H5z" fill="currentColor"/>
            <line x1="7" y1="13" x2="6" y2="17" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            <line x1="10.5" y1="13" x2="9.5" y2="17" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            <line x1="14" y1="13" x2="13" y2="17" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>`;
    }

    if (cond === 'snow') {
        return getWeatherIcon('', 5);
    }

    // cloudy / fog / fallback
    return getWeatherIcon('', 0);
}

function generateSparkline(history, width = 50, height = 20) {
    if (!history || history.length < 2) return '';

    const amounts = history.map(h => h.amount);
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    const range = max - min || 1;

    const points = amounts.map((val, i) => {
        const x = (i / (amounts.length - 1)) * width;
        const y = height - ((val - min) / range) * (height - 4) - 2;
        return `${x},${y}`;
    }).join(' ');

    const trend = calculateTrend(history);

    return `
        <svg class="sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
            <polyline fill="none" stroke="${trend.color}" stroke-width="1.5" points="${points}" />
            <circle cx="${width}" cy="${height - ((amounts[amounts.length - 1] - min) / range) * (height - 4) - 2}" r="2" fill="${trend.color}" />
        </svg>
    `;
}
