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
