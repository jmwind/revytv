// Revelstoke Mountain Dashboard

// Generate detailed SVG chart for popup
function generateDetailedChart(history, width = 400, height = 150) {
    if (!history || history.length < 2) return '<div class="no-history">Not enough data for chart</div>';

    const amounts = history.map(h => h.amount);
    const min = Math.min(...amounts, 0);
    const max = Math.max(...amounts);
    const range = max - min || 1;
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const points = amounts.map((val, i) => {
        const x = padding.left + (i / (amounts.length - 1)) * chartWidth;
        const y = padding.top + chartHeight - ((val - min) / range) * chartHeight;
        return `${x},${y}`;
    }).join(' ');

    const circles = amounts.map((val, i) => {
        const x = padding.left + (i / (amounts.length - 1)) * chartWidth;
        const y = padding.top + chartHeight - ((val - min) / range) * chartHeight;
        return `<circle cx="${x}" cy="${y}" r="4" fill="#00ff88" stroke="#0a0a0a" stroke-width="2"/>`;
    }).join('');

    const yLabels = [min, Math.round((min + max) / 2), max].map((val, i) => {
        const y = padding.top + chartHeight - (i / 2) * chartHeight;
        return `<text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" fill="#888" font-size="11">${val}</text>`;
    }).join('');

    const xLabelIndices = [0, Math.floor(history.length / 2), history.length - 1];
    const xLabels = xLabelIndices.map(i => {
        const x = padding.left + (i / (amounts.length - 1)) * chartWidth;
        const date = new Date(history[i].firstSeen);
        const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `<text x="${x}" y="${height - 5}" text-anchor="middle" fill="#888" font-size="10">${label}</text>`;
    }).join('');

    const trend = calculateTrend(history);

    return `
        <svg class="detailed-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
            <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + chartHeight}" stroke="#333" stroke-width="1"/>
            <line x1="${padding.left}" y1="${padding.top + chartHeight}" x2="${padding.left + chartWidth}" y2="${padding.top + chartHeight}" stroke="#333" stroke-width="1"/>
            <polyline fill="none" stroke="${trend.color}" stroke-width="2" points="${points}" />
            ${circles}
            ${yLabels}
            ${xLabels}
            <text x="${padding.left - 8}" y="${padding.top - 8}" text-anchor="end" fill="#666" font-size="10">cm</text>
        </svg>
    `;
}

function formatDateTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

// Show forecast detail popup
function showForecastPopup(day) {
    closeForecastPopup();

    const hasHistory = day.history?.length > 0;
    const trend = calculateTrend(day.history);

    let historyTableHtml = '';
    if (hasHistory) {
        const rows = day.history.map((h, i) => {
            const prevAmount = i > 0 ? day.history[i - 1].amount : h.amount;
            const change = h.amount - prevAmount;
            const changeStr = i === 0 ? '-' : (change > 0 ? `+${change}` : change.toString());
            const changeClass = change > 0 ? 'change-up' : (change < 0 ? 'change-down' : '');
            const freezing = h.freezingLevel === 'valley bottom' ? 'Valley' : (h.freezingLevel ? `${h.freezingLevel}m` : '-');

            return `
                <tr>
                    <td>${formatDateTime(h.firstSeen)}</td>
                    <td class="amount-cell">${h.amount} cm</td>
                    <td class="change-cell ${changeClass}">${changeStr}</td>
                    <td>${freezing}</td>
                </tr>
            `;
        }).join('');

        historyTableHtml = `
            <table class="history-table">
                <thead>
                    <tr>
                        <th>Recorded</th>
                        <th>Amount</th>
                        <th>Change</th>
                        <th>Freezing</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    const popup = document.createElement('div');
    popup.className = 'forecast-popup-overlay';
    popup.innerHTML = `
        <div class="forecast-popup">
            <div class="popup-header">
                <h3>${day.day}${day.actualDate ? ` <span class="popup-date">(${day.actualDate})</span>` : ''}</h3>
                <button class="popup-close" aria-label="Close">&times;</button>
            </div>
            <div class="popup-summary">
                <div class="popup-amount ${day.amount > 0 ? 'has-snow' : ''}">${day.amount} cm</div>
                ${trend.direction !== 'none' ? `<div class="popup-trend" style="color: ${trend.color}">${trend.direction === 'up' ? '▲' : '▼'} ${Math.abs(trend.change)} cm since first forecast</div>` : ''}
                ${day.freezingLevel ? `<div class="popup-freezing">Freezing level: ${day.freezingLevel === 'valley bottom' ? 'Valley bottom' : day.freezingLevel + 'm'}</div>` : ''}
            </div>
            ${hasHistory && day.history.length > 1 ? `
                <div class="popup-chart">
                    <h4>Forecast History</h4>
                    ${generateDetailedChart(day.history)}
                </div>
            ` : ''}
            ${hasHistory ? `
                <div class="popup-history">
                    <h4>All Recorded Values (${day.history.length})</h4>
                    ${historyTableHtml}
                </div>
            ` : '<div class="popup-no-history">No historical data yet</div>'}
        </div>
    `;

    document.body.appendChild(popup);

    popup.querySelector('.popup-close').addEventListener('click', closeForecastPopup);
    popup.addEventListener('click', (e) => {
        if (e.target === popup) closeForecastPopup();
    });

    document.addEventListener('keydown', handlePopupEscape);
    requestAnimationFrame(() => popup.classList.add('active'));
}

function closeForecastPopup() {
    const popup = document.querySelector('.forecast-popup-overlay');
    if (popup) {
        popup.classList.remove('active');
        setTimeout(() => popup.remove(), 200);
    }
    document.removeEventListener('keydown', handlePopupEscape);
}

function handlePopupEscape(e) {
    if (e.key === 'Escape') closeForecastPopup();
}

const CONFIG = {
    snowReportApi: '/api/snow-report',
    webcams: {
        gnorm: 'https://www.revelstokemountainresort.com/uploads/gnorm/gnorm.jpg',
        kpmc: 'https://relay.ozolio.com/pub.api?cmd=poster&oid=EMB_KPMC000010BF',
        ripper: 'https://www.revelstokemountainresort.com/uploads/ripper/ripper-medium.jpg',
        pvwk: 'https://relay.ozolio.com/pub.api?cmd=poster&oid=EMB_PVWK000010B0'
    },
    refreshInterval: 600000
};

let refreshTimer = null;

const elements = {
    currentTemp: document.getElementById('current-temp'),
    weatherCondition: document.getElementById('weather-condition'),
    windSpeed: document.getElementById('wind-speed'),
    windDirection: document.getElementById('wind-direction'),
    subpeakTemp: document.getElementById('subpeak-temp'),
    ripperTemp: document.getElementById('ripper-temp'),
    snowNew: document.getElementById('snow-new'),
    snowLastHour: document.getElementById('snow-lasthour'),
    snow24h: document.getElementById('snow-24h'),
    snow48h: document.getElementById('snow-48h'),
    snow7days: document.getElementById('snow-7days'),
    snowSeason: document.getElementById('snow-season'),
    baseDepth: document.getElementById('base-depth'),
    forecastContent: document.getElementById('forecast-content'),
    webcams: {
        gnorm: document.getElementById('webcam-gnorm'),
        kpmc: document.getElementById('webcam-kpmc'),
        ripper: document.getElementById('webcam-ripper'),
        pvwk: document.getElementById('webcam-pvwk')
    }
};

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        document.body.classList.remove('is-loading');
        window.scrollTo(0, 0);
    }
}

async function fetchSnowReport() {
    try {
        const response = await fetch(CONFIG.snowReportApi);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (data.error) throw new Error(data.message);

        updateUI(data);
        hideLoading();
    } catch (error) {
        console.error('Error fetching snow report:', error.message);
        hideLoading();
    }
}

function updateUI(data) {
    elements.currentTemp.textContent = data.weather.alpineTemp ?? '--';
    elements.weatherCondition.textContent = data.weather.condition ?? '--';
    elements.windSpeed.textContent = data.weather.windSpeed ? `${data.weather.windSpeed} km/h` : '--';
    elements.windDirection.textContent = data.weather.windDirection ?? '--';
    elements.subpeakTemp.textContent = data.weather.subpeakTemp ? `${data.weather.subpeakTemp}°C` : '--°C';
    elements.ripperTemp.textContent = data.weather.ripperTemp ? `${data.weather.ripperTemp}°C` : '--°C';

    elements.snowNew.textContent = data.snow.newSnow ?? 0;
    elements.snowLastHour.textContent = data.snow.lastHour ?? 0;
    elements.snow24h.textContent = data.snow.twentyFourHour ?? 0;
    elements.snow48h.textContent = data.snow.fortyEightHour ?? 0;
    elements.snow7days.textContent = data.snow.sevenDay ?? 0;
    elements.baseDepth.textContent = data.snow.baseDepth ?? 0;
    elements.snowSeason.textContent = data.snow.seasonTotal ?? 0;

    displayForecast(data.forecast);
}

function displayForecast(forecast) {
    if (!forecast?.length) {
        elements.forecastContent.innerHTML = '<div class="forecast-loading">No forecast data</div>';
        return;
    }

    let html = '';

    forecast.forEach((day, index) => {
        const amount = day.amount || 0;
        const hasSnow = amount > 0;

        let freezingText = '';
        if (day.freezingLevel != null) {
            freezingText = day.freezingLevel === 'valley bottom'
                ? '<div class="forecast-freezing">Freezing at valley bottom</div>'
                : `<div class="forecast-freezing">${day.freezingLevel}m</div>`;
        }

        const hasHistory = day.history?.length > 1;
        const trendArrow = hasHistory ? generateTrendArrow(day.history) : '';
        const sparkline = hasHistory ? `
            <div class="forecast-sparkline" title="Forecast history: ${day.history.map(h => h.amount + 'cm').join(' → ')}">
                ${generateSparkline(day.history, 100, 20)}
            </div>
        ` : '';

        html += `
            <div class="forecast-day ${hasSnow ? 'has-snow' : 'no-snow'}" data-forecast-index="${index}" role="button" tabindex="0">
                <div class="forecast-day-content">
                    <span class="forecast-date">${day.day}</span>
                    <span class="forecast-amount ${hasSnow ? '' : 'zero'}">${amount} cm ${trendArrow}</span>
                </div>
                ${sparkline}
                ${freezingText}
            </div>
        `;
    });

    html += '<div class="elevation-ref-line">Summit 2225m • Ripper 1950m • Top Gon 1713m • Mid Gon 800m</div>';

    elements.forecastContent.innerHTML = html;

    elements.forecastContent.querySelectorAll('.forecast-day').forEach(card => {
        const index = parseInt(card.dataset.forecastIndex, 10);
        const handler = () => showForecastPopup(forecast[index]);
        card.addEventListener('click', handler);
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handler();
            }
        });
    });
}

function showWebcamPopup(imgSrc, alt) {
    closeWebcamPopup();
    const overlay = document.createElement('div');
    overlay.className = 'webcam-popup-overlay';
    overlay.innerHTML = `
        <div class="webcam-popup">
            <div class="webcam-popup-header">
                <span class="webcam-popup-title">${alt}</span>
                <button class="popup-close" aria-label="Close">&times;</button>
            </div>
            <img src="${imgSrc}" alt="${alt}" class="webcam-popup-img">
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('.popup-close').addEventListener('click', closeWebcamPopup);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeWebcamPopup();
    });
    document.addEventListener('keydown', handleWebcamEscape);
    requestAnimationFrame(() => overlay.classList.add('active'));
}

function closeWebcamPopup() {
    const overlay = document.querySelector('.webcam-popup-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 200);
    }
    document.removeEventListener('keydown', handleWebcamEscape);
}

function handleWebcamEscape(e) {
    if (e.key === 'Escape') closeWebcamPopup();
}

function setupWebcamClicks() {
    document.querySelectorAll('.webcam-item').forEach(item => {
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => {
            const img = item.querySelector('.webcam-img');
            if (img && img.src) showWebcamPopup(img.src, img.alt);
        });
    });
}

function updateWebcams() {
    const timestamp = Date.now();

    Object.entries(CONFIG.webcams).forEach(([key, baseUrl]) => {
        const img = elements.webcams[key];
        if (!img) return;

        const webcamItem = img.closest('.webcam-item');
        webcamItem?.classList.remove('loaded');

        const separator = baseUrl.includes('?') ? '&' : '?';
        img.src = `${baseUrl}${separator}t=${timestamp}`;

        img.onload = () => webcamItem?.classList.add('loaded');
        img.onerror = () => {
            webcamItem?.classList.add('loaded');
            const loading = webcamItem?.querySelector('.webcam-loading');
            if (loading) loading.textContent = 'Unavailable';
        };
    });
}

async function init() {
    await fetchSnowReport();
    updateWebcams();
    setupWebcamClicks();
    refreshTimer = setInterval(() => {
        fetchSnowReport();
        updateWebcams();
    }, CONFIG.refreshInterval);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

window.addEventListener('beforeunload', () => clearInterval(refreshTimer));
