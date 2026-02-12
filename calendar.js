// Revelstoke Mountain - Forecast History Calendar

const LOADING_MESSAGES = [
    "Digging through the snow archives...",
    "Asking the mountain for its secrets...",
    "Counting snowflakes from the past...",
    "Waking up the forecast gnomes...",
    "Consulting the powder gods...",
    "Interrogating old storm cycles...",
    "Dusting off historical dumps...",
    "Bribing the weather station...",
    "Reading ancient lift reports...",
    "Summoning data from the cloud (the actual cloud)..."
];

let loadingInterval = null;

function startLoadingAnimation() {
    const loading = document.getElementById('loading-indicator');
    const textEl = loading.querySelector('.loading-text');
    loading.classList.add('active');

    let index = Math.floor(Math.random() * LOADING_MESSAGES.length);
    textEl.textContent = LOADING_MESSAGES[index];

    loadingInterval = setInterval(() => {
        index = (index + 1) % LOADING_MESSAGES.length;
        textEl.textContent = LOADING_MESSAGES[index];
    }, 2000);
}

function stopLoadingAnimation() {
    const loading = document.getElementById('loading-indicator');
    loading.classList.remove('active');
    if (loadingInterval) {
        clearInterval(loadingInterval);
        loadingInterval = null;
    }
}

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Render season total graph
function renderSnowfallChart(year) {
    const container = document.getElementById('chart-container');
    const totalEl = document.getElementById('chart-total');
    const chartEl = document.getElementById('snowfall-chart');

    // Convert snowfall data to sorted array (API returns full season including prior fall)
    const dataPoints = Object.values(snowfallData)
        .sort((a, b) => a.date.localeCompare(b.date));

    if (dataPoints.length === 0) {
        chartEl.style.display = 'none';
        return;
    }

    chartEl.style.display = 'block';

    // Show latest total
    const latestTotal = dataPoints[dataPoints.length - 1].seasonTotal;
    totalEl.textContent = `${latestTotal} cm`;

    // Chart dimensions
    const width = container.clientWidth || 800;
    const height = 120;
    const padding = { top: 10, right: 15, bottom: 25, left: 45 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Calculate scales
    const minDate = new Date(dataPoints[0].date);
    const maxDate = new Date(dataPoints[dataPoints.length - 1].date);
    const dateRange = maxDate - minDate || 1;

    const maxVal = Math.max(...dataPoints.map(d => d.seasonTotal));
    const minVal = 0;
    const valRange = maxVal - minVal || 1;

    // Generate path points with daily change
    const points = dataPoints.map((d, i) => {
        const date = new Date(d.date);
        const x = padding.left + ((date - minDate) / dateRange) * chartWidth;
        const y = padding.top + chartHeight - ((d.seasonTotal - minVal) / valRange) * chartHeight;
        const prev = i > 0 ? dataPoints[i - 1].seasonTotal : d.seasonTotal;
        const change = d.seasonTotal - prev;
        return { x, y, date: d.date, value: d.seasonTotal, change };
    });

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    // Generate area fill
    const areaD = pathD + ` L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

    // Generate Y axis labels
    const yLabels = [0, Math.round(maxVal / 2), maxVal].map(val => {
        const y = padding.top + chartHeight - ((val - minVal) / valRange) * chartHeight;
        return `<text x="${padding.left - 8}" y="${y + 4}" class="chart-label">${val}</text>`;
    }).join('');

    // Generate month labels on X axis
    const monthLabels = [];
    const seenMonths = new Set();
    points.forEach(p => {
        const month = parseInt(p.date.split('-')[1]) - 1;
        if (!seenMonths.has(month)) {
            seenMonths.add(month);
            monthLabels.push(`<text x="${p.x}" y="${height - 5}" class="chart-label">${SHORT_MONTHS[month]}</text>`);
        }
    });

    // Render SVG + tooltip
    container.innerHTML = `
        <div class="chart-tooltip" id="chart-tooltip"></div>
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
            <defs>
                <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#4ade80;stop-opacity:0.3"/>
                    <stop offset="100%" style="stop-color:#4ade80;stop-opacity:0.05"/>
                </linearGradient>
            </defs>
            <path d="${areaD}" fill="url(#areaGradient)" />
            <path d="${pathD}" fill="none" stroke="#4ade80" stroke-width="2" />
            ${points.map((p, i) => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#4ade80" class="chart-point" data-idx="${i}"></circle>`).join('')}
            ${yLabels}
            ${monthLabels.join('')}
        </svg>
    `;

    // Attach tooltip events
    const tooltip = container.querySelector('#chart-tooltip');
    container.querySelectorAll('.chart-point').forEach(circle => {
        const idx = parseInt(circle.dataset.idx);
        const p = points[idx];
        const dateObj = new Date(p.date + 'T00:00:00');
        const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const changeStr = p.change > 0 ? `+${p.change}` : p.change === 0 ? '—' : String(p.change);

        circle.addEventListener('mouseenter', (e) => {
            tooltip.innerHTML = `<strong>${label}</strong><br>${p.value} cm <span class="chart-tooltip-change">${changeStr}</span>`;
            tooltip.classList.add('visible');
        });
        circle.addEventListener('mousemove', (e) => {
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            tooltip.style.left = `${x}px`;
            tooltip.style.top = `${y - 40}px`;
        });
        circle.addEventListener('mouseleave', () => {
            tooltip.classList.remove('visible');
        });
    });
}

let currentYear = new Date().getFullYear();
let calendarData = {};
let snowfallData = {};
let newSnowData = {};

// Fetch calendar data from API
async function fetchCalendarData(year) {
    try {
        const response = await fetch(`/api/calendar-data?year=${year}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        snowfallData = result.snowfall || {};
        newSnowData = result.newSnow || {};
        return result.data || {};
    } catch (error) {
        console.error('Error fetching calendar data:', error);
        snowfallData = {};
        newSnowData = {};
        return {};
    }
}

// Calculate delta direction
function getDeltaClass(delta) {
    if (delta > 0) return 'up';
    if (delta < 0) return 'down';
    return 'unchanged';
}

// Generate mini sparkline SVG
function generateMiniSparkline(history, width = 28, height = 10) {
    // Flat line for no data or single point
    if (!history || history.length < 2) {
        const y = height / 2;
        return `
            <svg class="mini-sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
                <line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#555" stroke-width="1.5" />
            </svg>
        `;
    }

    const amounts = history.map(h => h.amount);
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    const range = max - min || 1;

    const points = amounts.map((val, i) => {
        const x = (i / (amounts.length - 1)) * width;
        const y = height - ((val - min) / range) * (height - 2) - 1;
        return `${x},${y}`;
    }).join(' ');

    const delta = amounts[amounts.length - 1] - amounts[0];
    let color = '#94a3b8'; // unchanged
    if (delta > 0) color = '#4ade80'; // up
    if (delta < 0) color = '#f87171'; // down

    return `
        <svg class="mini-sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
            <polyline fill="none" stroke="${color}" stroke-width="1.5" points="${points}" />
        </svg>
    `;
}

// Format delta for display
function formatDelta(delta) {
    if (delta === 0) return '0';
    return delta > 0 ? `+${delta}` : `${delta}`;
}

// Render a single day cell
function renderDayCell(year, month, day, data) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // Data is now merged by date in the API
    const effectiveData = data[dateStr];
    const actual = newSnowData[dateStr];
    const actualHtml = actual
        ? `<span class="actual-snow">${actual.newSnow}<span class="cm">cm</span></span>`
        : '';
    const flatSparkline = generateMiniSparkline(null);
    const hasForecast = effectiveData && effectiveData.history && effectiveData.history.length > 0;

    if (!hasForecast && !actual) {
        return `
            <div class="day-cell no-data">
                <span class="day-number">${day}</span>
                <span class="snow-amount">-<span class="cm">cm</span></span>
                ${flatSparkline}
                <span class="delta-badge">-</span>
            </div>
        `;
    }

    if (!hasForecast) {
        // Actual snow only, no forecast
        return `
            <div class="day-cell has-actual">
                <span class="day-number">${day}</span>
                ${actualHtml}
                <span class="snow-amount">-<span class="cm">cm</span></span>
                ${flatSparkline}
                <span class="delta-badge">-</span>
            </div>
        `;
    }

    const deltaClass = getDeltaClass(effectiveData.delta);
    const sparkline = generateMiniSparkline(effectiveData.history);
    const deltaText = formatDelta(effectiveData.delta);
    const lastAmount = effectiveData.lastAmount;
    const actualTitle = actual ? ` | Actual: ${actual.newSnow}cm` : '';
    const title = `${dateStr}: ${effectiveData.firstAmount}cm → ${lastAmount}cm (${effectiveData.historyCount} updates)${actualTitle}`;

    return `
        <div class="day-cell ${deltaClass}" title="${title}">
            <span class="day-number">${day}</span>
            ${actualHtml}
            <span class="snow-amount">${lastAmount}<span class="cm">cm</span></span>
            ${sparkline}
            <span class="delta-badge">${deltaText}</span>
        </div>
    `;
}

// Render a single month
function renderMonth(year, month, data) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let daysHtml = '';

    // Day headers
    DAYS.forEach(day => {
        daysHtml += `<div class="day-header">${day}</div>`;
    });

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
        daysHtml += '<div class="day-cell empty"></div>';
    }

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
        daysHtml += renderDayCell(year, month, day, data);
    }

    // Empty cells after last day to complete the grid
    const totalCells = firstDay + daysInMonth;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let i = 0; i < remainingCells; i++) {
        daysHtml += '<div class="day-cell empty"></div>';
    }

    return `
        <div class="month-card">
            <div class="month-header">${MONTHS[month]}</div>
            <div class="days-grid">
                ${daysHtml}
            </div>
        </div>
    `;
}

// Check if a month has any data (forecast, snowfall, or new snow)
function monthHasData(year, month, data) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (data[dateStr] || snowfallData[dateStr] || newSnowData[dateStr]) {
            return true;
        }
    }
    return false;
}

// Check if month is in the future (no data possible yet)
function isMonthInFuture(year, month) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    if (year > currentYear) return true;
    if (year === currentYear && month > currentMonth) return true;
    return false;
}

// Render full year
function renderYear(year, data) {
    const grid = document.getElementById('calendar-grid');

    // Render snowfall chart
    renderSnowfallChart(year);

    let html = '';
    for (let month = 0; month < 12; month++) {
        // Skip future months that have no data
        if (isMonthInFuture(year, month) && !monthHasData(year, month, data)) {
            continue;
        }
        html += renderMonth(year, month, data);
    }

    // If no months have data, show a message
    if (html === '') {
        html = '<div class="no-data-message">No forecast data for this year</div>';
    }

    grid.innerHTML = html;
    document.getElementById('current-year').textContent = year;
}

// Navigate to year
async function navigateToYear(year) {
    startLoadingAnimation();

    currentYear = year;
    calendarData = await fetchCalendarData(year);
    renderYear(year, calendarData);

    stopLoadingAnimation();

    // Update URL without reload
    const url = new URL(window.location);
    url.searchParams.set('year', year);
    window.history.replaceState({}, '', url);
}

// Initialize
async function init() {
    // Check URL for year parameter
    const urlParams = new URLSearchParams(window.location.search);
    const yearParam = urlParams.get('year');
    if (yearParam) {
        currentYear = parseInt(yearParam);
    }

    // Setup navigation
    document.getElementById('prev-year').addEventListener('click', () => {
        navigateToYear(currentYear - 1);
    });

    document.getElementById('next-year').addEventListener('click', () => {
        navigateToYear(currentYear + 1);
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') navigateToYear(currentYear - 1);
        if (e.key === 'ArrowRight') navigateToYear(currentYear + 1);
    });

    // Initial load
    await navigateToYear(currentYear);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
