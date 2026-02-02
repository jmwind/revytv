// Revelstoke Mountain Dashboard

const CONFIG = {
    snowReportApi: '/api/snow-report',
    webcams: {
        gnorm: 'https://www.revelstokemountainresort.com/uploads/gnorm/gnorm.jpg',
        kpmc: 'https://relay.ozolio.com/pub.api?cmd=poster&oid=EMB_KPMC000010BF',
        ripper: 'https://www.revelstokemountainresort.com/uploads/ripper/ripper-medium.jpg',
        pvwk: 'https://relay.ozolio.com/pub.api?cmd=poster&oid=EMB_PVWK000010B0'
    },
    refreshInterval: 600000 // 10 minutes
};

let refreshTimer = null;
let isTVMode = false;

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
    },
    videoView: document.querySelector('.video-view'),
    dashboardView: document.querySelector('.dashboard-view'),
    tickerContainer: document.querySelector('.ticker-container'),
    tickerContent: document.getElementById('ticker-content'),
    videoForecastContent: document.getElementById('video-forecast-content'),
    videoWebcams: {
        gnorm: document.getElementById('video-webcam-gnorm'),
        kpmc: document.getElementById('video-webcam-kpmc'),
        ripper: document.getElementById('video-webcam-ripper'),
        pvwk: document.getElementById('video-webcam-pvwk')
    }
};

// Hide loading overlay
function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.add('hidden');
}

// Fetch snow report from API
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
        hideLoading(); // Hide loading even on error
    }
}

// Update UI with API data
function updateUI(data) {
    // Weather
    elements.currentTemp.textContent = data.weather.alpineTemp ?? '--';
    elements.weatherCondition.textContent = data.weather.condition ?? '--';
    elements.windSpeed.textContent = data.weather.windSpeed ? `${data.weather.windSpeed} km/h` : '--';
    elements.windDirection.textContent = data.weather.windDirection ?? '--';
    elements.subpeakTemp.textContent = data.weather.subpeakTemp ? `${data.weather.subpeakTemp}°C` : '--°C';
    elements.ripperTemp.textContent = data.weather.ripperTemp ? `${data.weather.ripperTemp}°C` : '--°C';

    // Snow
    elements.snowNew.textContent = data.snow.newSnow ?? 0;
    elements.snowLastHour.textContent = data.snow.lastHour ?? 0;
    elements.snow24h.textContent = data.snow.twentyFourHour ?? 0;
    elements.snow48h.textContent = data.snow.fortyEightHour ?? 0;
    elements.snow7days.textContent = data.snow.sevenDay ?? 0;
    elements.baseDepth.textContent = data.snow.baseDepth ?? 0;
    elements.snowSeason.textContent = data.snow.seasonTotal ?? 0;

    // Forecast
    displayForecast(data.forecast);
    if (isTVMode) {
        updateVideoForecast(data.forecast);
        updateTicker();
    }
}

// Display forecast in dashboard view
function displayForecast(forecast) {
    if (!forecast?.length) {
        elements.forecastContent.innerHTML = '<div class="forecast-loading">No forecast data</div>';
        return;
    }

    let html = '<div class="elevation-ref-line">Summit 2225m • Ripper 1950m • Top Gon 1713m • Mid Gon 800m</div>';

    forecast.forEach(day => {
        const amount = day.amount || 0;
        const hasSnow = amount > 0;

        let freezingText = '';
        if (day.freezingLevel != null) {
            freezingText = day.freezingLevel === 'valley bottom'
                ? '<div class="forecast-freezing">Freezing at valley bottom</div>'
                : `<div class="forecast-freezing">Freezing level: ${day.freezingLevel}m</div>`;
        }

        html += `
            <div class="forecast-day ${hasSnow ? 'has-snow' : 'no-snow'}">
                <div class="forecast-day-content">
                    <span class="forecast-date">${day.day}</span>
                    <span class="forecast-amount ${hasSnow ? '' : 'zero'}">${amount} cm</span>
                </div>
                ${freezingText}
            </div>
        `;
    });

    elements.forecastContent.innerHTML = html;
}

// Display forecast in TV/video view
function updateVideoForecast(forecast) {
    if (!elements.videoForecastContent) return;

    if (!forecast?.length) {
        elements.videoForecastContent.innerHTML = '<div style="color: #999;">No forecast data</div>';
        return;
    }

    // Add compact class for 9+ days to prevent overlap with webcams
    elements.videoForecastContent.classList.toggle('compact', forecast.length > 8);

    let html = '';
    forecast.forEach(day => {
        const amount = day.amount || 0;
        const hasSnow = amount > 0;

        let freezingText = '';
        if (day.freezingLevel != null) {
            freezingText = day.freezingLevel === 'valley bottom'
                ? '<div class="video-forecast-freezing">Bottom</div>'
                : `<div class="video-forecast-freezing">${day.freezingLevel}m</div>`;
        }

        html += `
            <div class="video-forecast-day ${hasSnow ? 'has-snow' : 'no-snow'}">
                <div class="video-forecast-day-name">${day.day}</div>
                <div class="video-forecast-amount ${hasSnow ? '' : 'zero'}">${amount} cm</div>
                ${freezingText}
            </div>
        `;
    });

    elements.videoForecastContent.innerHTML = html;
}

// Update webcams with cache-busting
function updateWebcams(webcamElements = elements.webcams) {
    const timestamp = Date.now();

    Object.entries(CONFIG.webcams).forEach(([key, baseUrl]) => {
        const img = webcamElements[key];
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

// Update ticker with current data
function updateTicker() {
    if (!elements.tickerContent) return;

    const items = [
        ['Temperature', `${elements.currentTemp.textContent}°C`],
        ['Conditions', elements.weatherCondition.textContent],
        ['Wind', `${elements.windSpeed.textContent} ${elements.windDirection.textContent}`],
        ['New Snow', `${elements.snowNew.textContent} cm`],
        ['Last Hour', `${elements.snowLastHour.textContent} cm`],
        ['24 Hours', `${elements.snow24h.textContent} cm`],
        ['48 Hours', `${elements.snow48h.textContent} cm`],
        ['7 Days', `${elements.snow7days.textContent} cm`],
        ['Base Depth', `${elements.baseDepth.textContent} cm`],
        ['Season Total', `${elements.snowSeason.textContent} cm`]
    ];

    const html = items.map(([label, value]) =>
        `<span class="ticker-item"><span class="ticker-label">${label}:</span><span class="ticker-value">${value}</span></span><span class="ticker-separator"></span>`
    ).join('');

    // Duplicate for seamless scrolling
    elements.tickerContent.innerHTML = html + html;
}

// Refresh all data
async function refreshAllData() {
    await fetchSnowReport();
    updateWebcams();
    if (isTVMode) {
        updateWebcams(elements.videoWebcams);
    }
}

// Initialize
async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    isTVMode = urlParams.has('tv');

    await refreshAllData();
    refreshTimer = setInterval(refreshAllData, CONFIG.refreshInterval);

    if (isTVMode) {
        elements.videoView?.classList.add('active');
        elements.dashboardView?.classList.remove('active');
        elements.tickerContainer?.classList.add('active');
    } else {
        elements.videoView?.classList.remove('active');
        elements.dashboardView?.classList.add('active');
        elements.tickerContainer?.classList.remove('active');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

window.addEventListener('beforeunload', () => clearInterval(refreshTimer));
