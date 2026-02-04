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

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

let currentYear = new Date().getFullYear();
let calendarData = {};

// Fetch calendar data from API
async function fetchCalendarData(year) {
    try {
        const response = await fetch(`/api/calendar-data?year=${year}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        return result.data || {};
    } catch (error) {
        console.error('Error fetching calendar data:', error);
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
    const dayData = data[dateStr];
    const nightData = data[`${dateStr}:night`];

    // Combine day and night data - use day data primarily
    const effectiveData = dayData || nightData;
    const flatSparkline = generateMiniSparkline(null);

    if (!effectiveData || !effectiveData.history || effectiveData.history.length === 0) {
        return `
            <div class="day-cell no-data">
                <span class="day-number">${day}</span>
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
    const title = `${dateStr}: ${effectiveData.firstAmount}cm → ${lastAmount}cm (${effectiveData.historyCount} updates)`;

    return `
        <div class="day-cell ${deltaClass}" title="${title}">
            <span class="day-number">${day}</span>
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

// Check if a month has any data
function monthHasData(year, month, data) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (data[dateStr] || data[`${dateStr}:night`]) {
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
