// Revelstoke Mountain Dashboard - Main Application

// Configuration
const CONFIG = {
    snowReportUrl: 'https://www.revelstokemountainresort.com/mountain/conditions/snow-report/',
    corsProxies: [
        // Try multiple CORS proxies in order - these are reliable free services
        { url: 'https://corsproxy.io/?', type: 'text' },
        { url: 'https://api.allorigins.win/get?url=', type: 'json', field: 'contents' },
        { url: 'https://api.codetabs.com/v1/proxy?quest=', type: 'text' }
    ],
    fetchTimeout: 15000, // 15 seconds timeout
    retryAttempts: 2, // Retry each proxy twice before moving to next
    webcams: {
        gnorm: 'https://www.revelstokemountainresort.com/uploads/gnorm/gnorm.jpg',
        kpmc: 'https://relay.ozolio.com/pub.api?cmd=poster&oid=EMB_KPMC000010BF',
        ripper: 'https://www.revelstokemountainresort.com/uploads/ripper/ripper-medium.jpg',
        pvwk: 'https://relay.ozolio.com/pub.api?cmd=poster&oid=EMB_PVWK000010B0'
    },
    refreshInterval: 600000 // 10 minutes in milliseconds
};

// State
let refreshTimer = null;
let snowReportData = null;
let forecastData = [];
let viewToggleTimer = null;
let currentView = 'dashboard'; // 'video' or 'dashboard'
let isTVMode = false; // Will be set based on query param

// DOM Elements
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
    // Video overlay elements
    videoView: document.querySelector('.video-view'),
    dashboardView: document.querySelector('.dashboard-view'),
    tickerContainer: document.querySelector('.ticker-container'),
    tickerContent: document.getElementById('ticker-content'),
    videoForecastContent: document.getElementById('video-forecast-content')
};

// Helper function to fetch with timeout
async function fetchWithTimeout(url, timeout = CONFIG.fetchTimeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            cache: 'no-cache'
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// Fetch and parse snow report page
async function fetchSnowReport() {
    try {
        console.log('=== FETCHING SNOW REPORT ===');
        console.log('URL:', CONFIG.snowReportUrl);

        let html = null;

        // Try direct fetch first (in case served from same domain)
        try {
            console.log('Attempting direct fetch...');
            const response = await fetchWithTimeout(CONFIG.snowReportUrl);

            if (response.ok) {
                html = await response.text();
                console.log('✓ Direct fetch successful, length:', html.length);
            }
        } catch (corsError) {
            console.log('✗ Direct fetch failed (expected):', corsError.message);
        }

        // If direct fetch failed, try each proxy with retries
        if (!html) {
            for (let i = 0; i < CONFIG.corsProxies.length; i++) {
                const proxy = CONFIG.corsProxies[i];

                // Try each proxy multiple times before giving up
                for (let attempt = 1; attempt <= CONFIG.retryAttempts; attempt++) {
                    try {
                        const attemptMsg = CONFIG.retryAttempts > 1 ? ` (attempt ${attempt}/${CONFIG.retryAttempts})` : '';
                        console.log(`Trying proxy ${i + 1}/${CONFIG.corsProxies.length}${attemptMsg}: ${proxy.url.substring(0, 30)}...`);

                        const proxyUrl = proxy.url + encodeURIComponent(CONFIG.snowReportUrl);
                        const proxyResponse = await fetchWithTimeout(proxyUrl);

                        if (!proxyResponse.ok) {
                            console.log(`  ✗ HTTP ${proxyResponse.status}`);
                            continue;
                        }

                        if (proxy.type === 'json') {
                            const jsonData = await proxyResponse.json();
                            html = jsonData[proxy.field];
                        } else {
                            html = await proxyResponse.text();
                        }

                        if (html && html.length > 100) { // Ensure we got actual content
                            console.log(`  ✓ Success! Received ${html.length} characters`);
                            break; // Success - exit retry loop
                        } else {
                            console.log(`  ✗ Response too short or empty`);
                            html = null;
                        }
                    } catch (proxyError) {
                        const errorMsg = proxyError.name === 'AbortError' ? 'Timeout' : proxyError.message;
                        console.log(`  ✗ Failed: ${errorMsg}`);

                        // Wait a bit before retrying
                        if (attempt < CONFIG.retryAttempts) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                }

                // If we got html, stop trying other proxies
                if (html) break;
            }
        }

        if (!html) {
            throw new Error('All fetch attempts failed - check console for details');
        }

        parseSnowReportHTML(html);

    } catch (error) {
        console.error('❌ Error fetching snow report:', error.message);
        console.log('Data may be incomplete - showing default values');
    }
}

// Parse snow report HTML to extract data
function parseSnowReportHTML(html) {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Extract all data from text
        const text = doc.body.textContent || doc.body.innerText;

        // ===== WEATHER DATA (from HTML) =====
        console.log('=== PARSING WEATHER DATA FROM HTML ===');

        // Look for "Alpine temperature: Low -4 °C" pattern in forecast
        const alpineTempMatch = text.match(/Alpine\s+temperature:\s+Low\s+(-?\d+)\s*°C/i);

        // Look for weather condition in forecast text
        const conditionMatch = text.match(/\b(Mainly\s+cloudy|Cloudy|Clear|Sunny|Snow|Snowing|Overcast|Partly\s+cloudy)\b/i);

        // Look for wind in forecast: "Ridge wind south: 15 km/h"
        const windMatch = text.match(/Ridge\s+wind\s+(\w+):\s+(\d+)\s+km\/h/i);

        console.log('Alpine temp match:', alpineTempMatch);
        console.log('Condition match:', conditionMatch);
        console.log('Wind match:', windMatch);

        // Set weather from forecast data
        if (alpineTempMatch) {
            elements.currentTemp.textContent = alpineTempMatch[1];
            console.log('✓ Temperature from forecast:', alpineTempMatch[1]);
        } else {
            elements.currentTemp.textContent = '--';
            console.log('✗ Temperature not found in HTML');
        }

        if (conditionMatch) {
            elements.weatherCondition.textContent = conditionMatch[1].toLowerCase();
            console.log('✓ Condition from forecast:', conditionMatch[1]);
        } else {
            elements.weatherCondition.textContent = '--';
            console.log('✗ Condition not found in HTML');
        }

        if (windMatch) {
            elements.windSpeed.textContent = `${windMatch[2]} km/h`;
            elements.windDirection.textContent = windMatch[1].charAt(0).toUpperCase() + windMatch[1].slice(1).toLowerCase();
            console.log('✓ Wind from forecast:', windMatch[2], 'km/h', windMatch[1]);
        } else {
            elements.windSpeed.textContent = '--';
            elements.windDirection.textContent = '--';
            console.log('✗ Wind not found in HTML');
        }

        // For subpeak and ripper, use approximate values based on alpine temp
        // (typically 1-2 degrees warmer at lower elevations)
        if (alpineTempMatch) {
            const alpineTemp = parseInt(alpineTempMatch[1]);
            elements.subpeakTemp.textContent = `${alpineTemp + 1}°C`;
            elements.ripperTemp.textContent = `${alpineTemp + 1}°C`;
            console.log('✓ Estimated Subpeak/Ripper temps based on alpine');
        } else {
            elements.subpeakTemp.textContent = '--°C';
            elements.ripperTemp.textContent = '--°C';
        }

        // ===== SNOW DATA =====
        console.log('=== PARSING SNOW DATA ===');        

        // Pattern matching for snowfall data
        // The page shows: "NEW SNOW", "LAST HOUR", "24 HOURS", "48 HOURS", "7 DAYS", "BASE DEPTH", "SEASON TOTAL"
        // Look for the label followed by the number and CM

        // More flexible regex patterns - match label, then any content (up to 100 chars), then number, then cm
        const newSnowMatch = text.match(/NEW\s+SNOW[\s\S]{0,100}?(\d+)\s*CM/i);
        const lastHourMatch = text.match(/LAST\s+HOUR[\s\S]{0,100}?(\d+)\s*CM/i);
        const twentyFourHourMatch = text.match(/24\s+HOURS[\s\S]{0,100}?(\d+)\s*CM/i);
        const fortyEightHourMatch = text.match(/48\s+HOURS[\s\S]{0,100}?(\d+)\s*CM/i);
        const sevenDayMatch = text.match(/7\s+DAYS[\s\S]{0,100}?(\d+)\s*CM/i);
        const baseDepthMatch = text.match(/BASE\s+DEPTH[\s\S]{0,100}?(\d+)\s*CM/i);
        const seasonMatch = text.match(/SEASON\s+TOTAL[\s\S]{0,100}?(\d+)\s*CM/i);       

        // Set all values
        if (newSnowMatch) {
            const newSnow = parseInt(newSnowMatch[1]) || 0;
            elements.snowNew.textContent = newSnow;
            console.log('✓ New snow:', newSnow);
        } else {
            elements.snowNew.textContent = 0;
            console.log('✗ New snow not found, defaulting to 0');
        }

        if (lastHourMatch) {
            const lastHour = parseInt(lastHourMatch[1]) || 0;
            elements.snowLastHour.textContent = lastHour;
            console.log('✓ Last hour:', lastHour);
        } else {
            elements.snowLastHour.textContent = 0;
            console.log('✗ Last hour not found, defaulting to 0');
        }

        if (twentyFourHourMatch) {
            const twentyFourHour = parseInt(twentyFourHourMatch[1]) || 0;
            elements.snow24h.textContent = twentyFourHour;
            console.log('✓ 24 hours:', twentyFourHour);
        } else {
            elements.snow24h.textContent = 0;
            console.log('✗ 24 hours not found, defaulting to 0');
        }

        if (fortyEightHourMatch) {
            const fortyEightHour = parseInt(fortyEightHourMatch[1]) || 0;
            elements.snow48h.textContent = fortyEightHour;
            console.log('✓ 48 hours:', fortyEightHour);
        } else {
            elements.snow48h.textContent = 0;
            console.log('✗ 48 hours not found, defaulting to 0');
        }

        if (sevenDayMatch) {
            const sevenDays = parseInt(sevenDayMatch[1]) || 0;
            elements.snow7days.textContent = sevenDays;
            console.log('✓ 7 days:', sevenDays);
        } else {
            elements.snow7days.textContent = 0;
            console.log('✗ 7 days not found, defaulting to 0');
        }

        if (baseDepthMatch) {
            const baseDepth = parseInt(baseDepthMatch[1]) || 0;
            elements.baseDepth.textContent = baseDepth;
            console.log('✓ Base depth:', baseDepth);
        } else {
            elements.baseDepth.textContent = 0;
            console.log('✗ Base depth not found, defaulting to 0');
        }

        if (seasonMatch) {
            const season = parseInt(seasonMatch[1]) || 0;
            elements.snowSeason.textContent = season;
            console.log('✓ Season total:', season);
        } else {
            elements.snowSeason.textContent = 0;
            console.log('✗ Season total not found, defaulting to 0');
        }

        // Extract forecast data
        extractForecastData(doc, text);

    } catch (error) {
        console.error('Error parsing snow report HTML:', error);
        // Set defaults
        elements.snow7days.textContent = 0;
        elements.snowSeason.textContent = 0;
        elements.baseDepth.textContent = 0;
    }
}

// Extract forecast data from snow report
function extractForecastData(doc, text) {
    try {
        console.log('=== EXTRACTING FORECAST DATA ===');
        const forecastData = [];

        // Look for day headings followed by "Snow: X cm" pattern
        // Include "Tonight" as a valid day
        const days = ['Tonight', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Today'];

        console.log('Searching for day headings with snow amounts...');

        // Find all headings (h1-h6)
        const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
        console.log(`Found ${headings.length} headings`);

        headings.forEach((heading, idx) => {
            const headingText = heading.textContent.trim();
            console.log(`Heading ${idx}: "${headingText}"`);

            // Check if this heading contains a day name
            const dayMatch = days.find(d => headingText.toLowerCase().includes(d.toLowerCase()));

            if (dayMatch) {
                console.log(`  ✓ Found day: ${dayMatch}`);

                // Check if we already have this day (avoid duplicates)
                const existing = forecastData.find(f => f.day === dayMatch);
                if (existing) {
                    console.log(`  ✗ ${dayMatch} already added, skipping`);
                    return;
                }

                // Look for "Snow: X cm" in the content following this heading
                // Get the parent element and search within it
                let searchElement = heading.parentElement;
                let searchText = searchElement ? searchElement.textContent : '';

                console.log(`  Searching in parent element for Snow: pattern`);
                console.log(`  Parent text (first 300 chars): ${searchText.substring(0, 300)}`);

                // Pattern: "Snow: 15 cm" or "Snow:15cm" (case insensitive)
                const snowMatch = searchText.match(/Snow:\s*(\d+)\s*cm/i);

                // Pattern: "Freezing level: 1000 metres" or "Freezing level at valley bottom"
                const freezingLevelMatch = searchText.match(/Freezing\s+level:\s*(\d+)\s*metres?/i) ||
                                          searchText.match(/Freezing\s+level\s+at\s+valley\s+bottom/i);

                if (snowMatch) {
                    const amount = parseInt(snowMatch[1]) || 0;
                    let freezingLevel = null;

                    if (freezingLevelMatch) {
                        if (freezingLevelMatch[1]) {
                            freezingLevel = parseInt(freezingLevelMatch[1]);
                        } else {
                            freezingLevel = 'valley bottom';
                        }
                    }

                    console.log(`  ✓ Found snow amount: ${amount} cm, freezing level: ${freezingLevel || 'not found'}`);
                    forecastData.push({
                        day: dayMatch,
                        amount: amount,
                        freezingLevel: freezingLevel
                    });
                    console.log(`  ✓ Added ${dayMatch}: ${amount} cm`);
                } else {
                    console.log(`  ✗ No "Snow: X cm" pattern found in parent element`);

                    // Try searching in sibling elements
                    let sibling = heading.nextElementSibling;
                    let attempts = 0;
                    let found = false;

                    while (sibling && attempts < 5) {
                        const siblingText = sibling.textContent;
                        console.log(`  Checking sibling ${attempts}: ${siblingText.substring(0, 100)}`);

                        const siblingSnowMatch = siblingText.match(/Snow:\s*(\d+)\s*cm/i);
                        const siblingFreezingMatch = siblingText.match(/Freezing\s+level:\s*(\d+)\s*metres?/i) ||
                                                     siblingText.match(/Freezing\s+level\s+at\s+valley\s+bottom/i);

                        if (siblingSnowMatch) {
                            const amount = parseInt(siblingSnowMatch[1]) || 0;
                            let freezingLevel = null;

                            if (siblingFreezingMatch) {
                                if (siblingFreezingMatch[1]) {
                                    freezingLevel = parseInt(siblingFreezingMatch[1]);
                                } else {
                                    freezingLevel = 'valley bottom';
                                }
                            }

                            console.log(`  ✓ Found in sibling: ${amount} cm, freezing level: ${freezingLevel || 'not found'}`);
                            forecastData.push({
                                day: dayMatch,
                                amount: amount,
                                freezingLevel: freezingLevel
                            });
                            console.log(`  ✓ Added ${dayMatch}: ${amount} cm`);
                            found = true;
                            break;
                        }

                        sibling = sibling.nextElementSibling;
                        attempts++;
                    }

                    // If no snow amount found after checking siblings, add with 0cm
                    if (!found) {
                        console.log(`  ✗ No snow amount found, adding ${dayMatch} with 0cm`);
                        forecastData.push({
                            day: dayMatch,
                            amount: 0,
                            freezingLevel: null
                        });
                    }
                }
            }
        });

        console.log('=== FINAL FORECAST DATA ===');
        console.log('Extracted forecast data:', forecastData);
        displayForecast(forecastData);
        updateVideoForecast(forecastData);

    } catch (error) {
        console.error('Error extracting forecast data:', error);
        displayForecast([]);
    }
}

// Display forecast data
function displayForecast(forecastData) {
    const container = elements.forecastContent;

    if (!forecastData || forecastData.length === 0) {
        container.innerHTML = '<div class="forecast-loading">No forecast data available</div>';
        return;
    }

    // Elevation reference points
    const elevations = {
        'Summit': 2225,
        'Ripper': 1950,
        'Top gon': 1713,
        'Mid gon': 800,
    };

    // Helper function to find closest elevation reference
    function getClosestElevation(freezingLevel) {
        if (!freezingLevel || freezingLevel === 'valley bottom') {
            return null;
        }

        let closest = null;
        let minDiff = Infinity;

        Object.entries(elevations).forEach(([name, elevation]) => {
            const diff = Math.abs(elevation - freezingLevel);
            if (diff < minDiff) {
                minDiff = diff;
                closest = { name, elevation };
            }
        });

        return closest;
    }

    // Add elevation reference line
    let html = '<div class="elevation-ref-line">Summit 2225m • Ripper 1950m • Top Gon 1713m • Mid Gon 800m</div>';

    // Don't sort - preserve the order from the website (chronological order)
    forecastData.forEach(forecast => {
        const amount = forecast.amount || 0;
        const hasSnow = amount > 0;
        const amountClass = hasSnow ? '' : 'zero';
        const dayClass = hasSnow ? 'has-snow' : 'no-snow';

        // Format freezing level display
        let freezingLevelText = '';
        if (forecast.freezingLevel !== null && forecast.freezingLevel !== undefined) {
            if (forecast.freezingLevel === 'valley bottom') {
                freezingLevelText = '<div class="forecast-freezing">Freezing at valley bottom</div>';
            } else {                
                freezingLevelText = `<div class="forecast-freezing">Freezing level: ${forecast.freezingLevel}m</div>`;                
            }
        }

        html += `
            <div class="forecast-day ${dayClass}">
                <div class="forecast-day-content">
                    <span class="forecast-date">${forecast.day}</span>
                    <span class="forecast-amount ${amountClass}">${amount} cm</span>
                </div>
                ${freezingLevelText}
            </div>
        `;
    });

    container.innerHTML = html;
}

// Update webcam images with cache-busting
function updateWebcams() {
    const timestamp = Date.now();

    Object.keys(CONFIG.webcams).forEach(camKey => {
        const img = elements.webcams[camKey];
        const baseUrl = CONFIG.webcams[camKey];
        const webcamItem = img.closest('.webcam-item');

        // Remove loaded class to show loading indicator
        if (webcamItem) {
            webcamItem.classList.remove('loaded');
        }

        // Add cache-busting parameter
        const separator = baseUrl.includes('?') ? '&' : '?';
        img.src = `${baseUrl}${separator}t=${timestamp}`;

        // Handle successful load
        img.onload = () => {
            if (webcamItem) {
                webcamItem.classList.add('loaded');
            }
        };

        // Handle load errors gracefully
        img.onerror = () => {
            console.warn(`Failed to load webcam: ${camKey}`);
            if (webcamItem) {
                webcamItem.classList.add('loaded');
                const loadingDiv = webcamItem.querySelector('.webcam-loading');
                if (loadingDiv) {
                    loadingDiv.textContent = 'Unavailable';
                }
            }
        };
    });
}

// Show error message
function showError(message) {
    console.error(message);
}

// Main refresh function - updates all data
async function refreshAllData() {
    console.log('Refreshing all data...');

    try {
        // Fetch weather, snow report, and forecast from HTML page
        await fetchSnowReport();

        // Update webcams
        updateWebcams();

        // Update ticker with latest data
        updateTicker();
    } catch (error) {
        console.error('Error during refresh:', error);
        showError('Failed to refresh data');
    }
}

// Initialize auto-refresh timer
function startAutoRefresh() {
    // Clear any existing timer
    if (refreshTimer) {
        clearInterval(refreshTimer);
    }

    // Set up new timer
    refreshTimer = setInterval(refreshAllData, CONFIG.refreshInterval);
    console.log(`Auto-refresh enabled (every ${CONFIG.refreshInterval / 60000} minutes)`);
}

// Update video forecast overlay
function updateVideoForecast(forecast) {
    if (!elements.videoForecastContent) {
        console.error('Video forecast content element not found!');
        return;
    }

    if (!forecast || forecast.length === 0) {
        elements.videoForecastContent.innerHTML = '<div style="color: #999; font-size: 1.2rem;">No forecast data available</div>';
        return;
    }

    // Store globally so we can use it later
    forecastData = forecast;

    let html = '';
    forecast.forEach(day => {
        const amount = day.amount || 0;
        const hasSnow = amount > 0;
        const dayClass = hasSnow ? 'has-snow' : 'no-snow';
        const amountClass = hasSnow ? '' : 'zero';

        // Format freezing level display
        let freezingLevelText = '';
        if (day.freezingLevel !== null && day.freezingLevel !== undefined) {
            if (day.freezingLevel === 'valley bottom') {
                freezingLevelText = '<div class="video-forecast-freezing">Valley bottom</div>';
            } else {
                freezingLevelText = `<div class="video-forecast-freezing">${day.freezingLevel}m</div>`;
            }
        }

        html += `
            <div class="video-forecast-day ${dayClass}">
                <div class="video-forecast-day-name">${day.day}</div>
                <div class="video-forecast-amount ${amountClass}">${amount} cm</div>
                ${freezingLevelText}
            </div>
        `;
    });

    elements.videoForecastContent.innerHTML = html;
}

// Update ticker with all dashboard data
function updateTicker() {
    if (!elements.tickerContent) {
        console.error('Ticker content element not found!');
        return;
    }

    const tickerItems = [];

    // Temperature and conditions
    tickerItems.push(`<span class="ticker-label">Temperature:</span><span class="ticker-value">${elements.currentTemp.textContent}°C</span>`);
    tickerItems.push(`<span class="ticker-label">Conditions:</span><span class="ticker-value">${elements.weatherCondition.textContent}</span>`);

    // Wind
    tickerItems.push(`<span class="ticker-label">Wind:</span><span class="ticker-value">${elements.windSpeed.textContent} ${elements.windDirection.textContent}</span>`);

    // Snow stats
    tickerItems.push(`<span class="ticker-label">New Snow:</span><span class="ticker-value">${elements.snowNew.textContent} cm</span>`);
    tickerItems.push(`<span class="ticker-label">Last Hour:</span><span class="ticker-value">${elements.snowLastHour.textContent} cm</span>`);
    tickerItems.push(`<span class="ticker-label">24 Hours:</span><span class="ticker-value">${elements.snow24h.textContent} cm</span>`);
    tickerItems.push(`<span class="ticker-label">48 Hours:</span><span class="ticker-value">${elements.snow48h.textContent} cm</span>`);
    tickerItems.push(`<span class="ticker-label">7 Days:</span><span class="ticker-value">${elements.snow7days.textContent} cm</span>`);
    tickerItems.push(`<span class="ticker-label">Base Depth:</span><span class="ticker-value">${elements.baseDepth.textContent} cm</span>`);
    tickerItems.push(`<span class="ticker-label">Season Total:</span><span class="ticker-value">${elements.snowSeason.textContent} cm</span>`);

    // Join with separators and duplicate for seamless loop
    const tickerHTML = tickerItems.map(item =>
        `<span class="ticker-item">${item}</span><span class="ticker-separator"></span>`
    ).join('');

    // Duplicate content for seamless scrolling
    elements.tickerContent.innerHTML = tickerHTML + tickerHTML;
}

// Toggle between video and dashboard views
function toggleView() {
    if (currentView === 'video') {
        // Switch to dashboard
        currentView = 'dashboard';
        elements.videoView.classList.remove('active');
        elements.dashboardView.classList.add('active');
        elements.tickerContainer.classList.remove('active');
        console.log('Switched to dashboard view');
    } else {
        // Switch to video
        currentView = 'video';
        elements.videoView.classList.add('active');
        elements.dashboardView.classList.remove('active');
        elements.tickerContainer.classList.add('active');
        updateTicker();
        console.log('Switched to video view');
    }
}

// Start view toggle timer (every 60 seconds)
function startViewToggle() {
    // Clear any existing timer
    if (viewToggleTimer) {
        clearInterval(viewToggleTimer);
    }

    // Start with video view
    currentView = 'video';
    elements.videoView.classList.add('active');
    elements.dashboardView.classList.remove('active');
    elements.tickerContainer.classList.add('active');
    updateTicker();

    // Toggle every 60 seconds
    viewToggleTimer = setInterval(toggleView, 60000);
    console.log('View toggle enabled (every 60 seconds)');
}

// Restart the toggle timer without changing current view
function restartToggleTimer() {
    // Clear any existing timer
    if (viewToggleTimer) {
        clearInterval(viewToggleTimer);
    }

    // Restart timer from current view
    viewToggleTimer = setInterval(toggleView, 60000);
    console.log('View toggle timer restarted');
}

// Initialize the application
async function init() {
    console.log('Initializing Revelstoke Mountain Dashboard...');

    // Check if TV mode is enabled via query parameter
    const urlParams = new URLSearchParams(window.location.search);
    isTVMode = urlParams.has('tv');

    console.log('TV Mode:', isTVMode);

    await refreshAllData();
    startAutoRefresh();

    if (isTVMode) {
        // Start in video view with auto-toggle
        startViewToggle();
    } else {
        // Start in dashboard view
        currentView = 'dashboard';
        elements.videoView.classList.remove('active');
        elements.dashboardView.classList.add('active');
        elements.tickerContainer.classList.remove('active');
    }

    console.log('Dashboard initialized successfully');
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (refreshTimer) {
        clearInterval(refreshTimer);
    }
    if (viewToggleTimer) {
        clearInterval(viewToggleTimer);
    }
});
