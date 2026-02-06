// TV Mode - Auth-gated video display with forecast overlay

const TV_CONFIG = {
    snowReportApi: '/api/snow-report',
    userApi: '/api/user',
    webcams: {
        gnorm: 'https://www.revelstokemountainresort.com/uploads/gnorm/gnorm.jpg',
        kpmc: 'https://relay.ozolio.com/pub.api?cmd=poster&oid=EMB_KPMC000010BF',
        ripper: 'https://www.revelstokemountainresort.com/uploads/ripper/ripper-medium.jpg',
        pvwk: 'https://relay.ozolio.com/pub.api?cmd=poster&oid=EMB_PVWK000010B0'
    },
    refreshInterval: 600000,
    defaultPlaylist: [
        { id: 'spJ5dqXi6ro', title: 'Big mountain' },
        { id: 'BsbMhTEoQiM', title: 'Famillia Fernie 2010' },
        { id: 'TPND631Dh-I', title: 'Famillia Spring Break 2010' },
        { id: 'IRwZN2JvtYc', title: 'Famillia Heli NZ 2013' }
    ]
};

let playlist = [...TV_CONFIG.defaultPlaylist];
let currentVideoIndex = 0;
let isVideoSelectorOpen = false;
let refreshTimer = null;
let snowData = null;

const elements = {
    videoForecastContent: document.getElementById('video-forecast-content'),
    tickerContent: document.getElementById('ticker-content'),
    webcams: {
        gnorm: document.getElementById('video-webcam-gnorm'),
        kpmc: document.getElementById('video-webcam-kpmc'),
        ripper: document.getElementById('video-webcam-ripper'),
        pvwk: document.getElementById('video-webcam-pvwk')
    },
    videoSelector: document.getElementById('video-selector'),
    videoSelectorToggle: document.getElementById('video-selector-toggle'),
    videoSelectorList: document.getElementById('video-selector-list'),
    youtubePlayer: document.getElementById('youtube-player')
};

// Fetch snow report for ticker and forecast overlay
async function fetchSnowReport() {
    try {
        const response = await fetch(TV_CONFIG.snowReportApi);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (data.error) throw new Error(data.message);

        snowData = data;
        updateVideoForecast(data.forecast);
        updateTicker(data);
        return data;
    } catch (error) {
        console.error('Error fetching snow report:', error.message);
    }
}

// Display forecast in TV overlay
function updateVideoForecast(forecast) {
    if (!elements.videoForecastContent) return;

    if (!forecast?.length) {
        elements.videoForecastContent.innerHTML = '<div style="color: var(--text-muted);">No forecast data</div>';
        return;
    }

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

        const hasHistory = day.history?.length > 1;
        const trendArrow = hasHistory ? generateTrendArrow(day.history) : '';
        const sparkline = hasHistory ? `
            <div class="video-forecast-sparkline">
                ${generateSparkline(day.history, 36, 14)}
            </div>
        ` : '';

        html += `
            <div class="video-forecast-day ${hasSnow ? 'has-snow' : 'no-snow'}">
                <div class="video-forecast-day-name">${day.day}</div>
                <div class="video-forecast-amount ${hasSnow ? '' : 'zero'}">${amount} cm ${trendArrow}</div>
                ${sparkline}
                ${freezingText}
            </div>
        `;
    });

    elements.videoForecastContent.innerHTML = html;
}

// Update ticker with snow data
function updateTicker(data) {
    if (!elements.tickerContent || !data) return;

    elements.tickerContent.closest('.ticker-container')?.classList.add('loaded');

    const items = [
        ['Temperature', data.weather.alpineTemp != null ? `${data.weather.alpineTemp}°C` : '--'],
        ['Conditions', data.weather.condition ?? '--'],
        ['Wind', data.weather.windSpeed ? `${data.weather.windSpeed} km/h ${data.weather.windDirection ?? ''}` : '--'],
        ['New Snow', `${data.snow.newSnow ?? 0} cm`],
        ['Last Hour', `${data.snow.lastHour ?? 0} cm`],
        ['24 Hours', `${data.snow.twentyFourHour ?? 0} cm`],
        ['48 Hours', `${data.snow.fortyEightHour ?? 0} cm`],
        ['7 Days', `${data.snow.sevenDay ?? 0} cm`],
        ['Base Depth', `${data.snow.baseDepth ?? 0} cm`],
        ['Season Total', `${data.snow.seasonTotal ?? 0} cm`]
    ];

    const html = items.map(([label, value]) =>
        `<span class="ticker-item"><span class="ticker-label">${label}:</span><span class="ticker-value">${value}</span></span><span class="ticker-separator"></span>`
    ).join('');

    elements.tickerContent.innerHTML = html + html;
}

// Build YouTube embed URL
function buildPlaylistUrl(startIndex) {
    const videoIds = playlist.map(v => v.id);
    const reorderedIds = [...videoIds.slice(startIndex), ...videoIds.slice(0, startIndex)];
    const firstVideoId = reorderedIds[0];
    const playlistParam = reorderedIds.join(',');
    return `https://www.youtube-nocookie.com/embed/${firstVideoId}?autoplay=1&mute=1&loop=1&playlist=${playlistParam}&controls=0`;
}

function playVideoByIndex(index) {
    if (index < 0 || index >= playlist.length) return;

    currentVideoIndex = index;
    if (elements.youtubePlayer) {
        elements.youtubePlayer.src = buildPlaylistUrl(index);
    }
    updateVideoSelectorCurrent();
    closeVideoSelector();
}

function updateVideoSelectorCurrent() {
    const items = elements.videoSelectorList?.querySelectorAll('.video-selector-item');
    items?.forEach((item, i) => {
        item.classList.toggle('active', i === currentVideoIndex);
    });
}

function populateVideoSelector() {
    if (!elements.videoSelectorList) return;

    const settingsHtml = `<a href="/settings" class="video-menu-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            Settings</a>
        <div class="video-menu-separator"></div>`;

    const videoHtml = playlist.map((video, index) => `
        <button class="video-selector-item ${index === currentVideoIndex ? 'active' : ''}" data-index="${index}">
            <span class="video-number">${index + 1}</span>
            <span class="video-title">${video.title}</span>
        </button>
    `).join('');

    elements.videoSelectorList.innerHTML = settingsHtml + videoHtml;

    elements.videoSelectorList.querySelectorAll('.video-selector-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.index, 10);
            playVideoByIndex(index);
        });
    });
}

function toggleVideoSelector() {
    isVideoSelectorOpen = !isVideoSelectorOpen;
    elements.videoSelector?.classList.toggle('open', isVideoSelectorOpen);
}

function closeVideoSelector() {
    isVideoSelectorOpen = false;
    elements.videoSelector?.classList.remove('open');
}

function setupVideoSelector() {
    if (!elements.videoSelectorToggle) return;

    elements.videoSelectorToggle.addEventListener('click', toggleVideoSelector);

    document.addEventListener('click', (e) => {
        if (isVideoSelectorOpen && !elements.videoSelector?.contains(e.target)) {
            closeVideoSelector();
        }
    });

    populateVideoSelector();
    updateVideoSelectorCurrent();
}

// Update webcams with cache-busting
function updateWebcams() {
    const timestamp = Date.now();

    Object.entries(TV_CONFIG.webcams).forEach(([key, baseUrl]) => {
        const img = elements.webcams[key];
        if (!img) return;

        const wrapper = img.closest('.video-webcam-wrapper');
        const separator = baseUrl.includes('?') ? '&' : '?';
        img.src = `${baseUrl}${separator}t=${timestamp}`;
        img.onload = () => {
            img.style.opacity = '1';
            wrapper?.classList.remove('skeleton-webcam');
        };
        img.onerror = () => {
            // Keep skeleton visible on error
        };
    });
}

// Load user config via Clerk auth
async function loadUserConfig() {
    try {
        const token = await getAuthToken();
        if (!token) return;

        const response = await fetch(TV_CONFIG.userApi, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!response.ok) return;

        const config = await response.json();
        if (config.playlist && config.playlist.length > 0) {
            playlist = config.playlist;
        }
    } catch (e) {
        console.error('Failed to load user config, using defaults:', e.message);
    }
}

// Load user config via TV token
async function loadUserConfigByToken(tvToken) {
    try {
        const response = await fetch(`/api/tv-auth?token=${encodeURIComponent(tvToken)}`);
        if (!response.ok) return false;

        const config = await response.json();
        if (config.playlist && config.playlist.length > 0) {
            playlist = config.playlist;
        }
        return true;
    } catch (e) {
        console.error('Failed to load config via token:', e.message);
        return false;
    }
}

async function refreshAll() {
    await fetchSnowReport();
    updateWebcams();
}

// Initialize TV mode
async function init() {
    // Check for TV token in URL first
    const params = new URLSearchParams(window.location.search);
    const tvToken = params.get('token');

    if (tvToken) {
        const valid = await loadUserConfigByToken(tvToken);
        if (!valid) {
            window.location.href = '/sign-in.html?redirect_url=' + encodeURIComponent('/tv.html');
            return;
        }
    } else {
        const signedIn = await isSignedIn();
        if (!signedIn) {
            window.location.href = '/sign-in.html?redirect_url=' + encodeURIComponent('/tv.html');
            return;
        }
        await loadUserConfig();
    }

    // Start video
    if (elements.youtubePlayer && playlist.length > 0) {
        elements.youtubePlayer.src = buildPlaylistUrl(0);
    }

    setupVideoSelector();
    await refreshAll();
    refreshTimer = setInterval(refreshAll, TV_CONFIG.refreshInterval);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

window.addEventListener('beforeunload', () => clearInterval(refreshTimer));
