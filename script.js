const CONFIG = {
    refreshInterval: 60 * 60 * 1000, // 1 hour
    cacheKey: 'revytv_forecast_cache',
    cacheExpiry: 60 * 60 * 1000, // 1 hour in milliseconds
    maxSnowflakes: 50,
    snowflakeInterval: 200,
    endpoints: {
        snowReport: 'https://www.revelstokemountainresort.com/mountain/conditions/snow-report/',
        weather: 'https://www.revelstokemountainresort.com/snow-weather-json/'
    }
};

// Cache Management Functions
function getCachedData(allowExpired = false) {
    try {
        const cached = localStorage.getItem(CONFIG.cacheKey);
        if (!cached) return null;
        
        const { data, timestamp } = JSON.parse(cached);
        const now = Date.now();
        const age = now - timestamp;
        
        // Check if cache is expired
        if (age > CONFIG.cacheExpiry) {
            console.log(`Cache expired (age: ${Math.round(age / 1000 / 60)} minutes, max: ${CONFIG.cacheExpiry / 1000 / 60} minutes)`);
            if (!allowExpired) {
                localStorage.removeItem(CONFIG.cacheKey);
                return null;
            }
        }
        
        return data;
    } catch (error) {
        console.warn('Error reading cache:', error);
        localStorage.removeItem(CONFIG.cacheKey);
        return null;
    }
}

function getCachedTimestamp() {
    try {
        const cached = localStorage.getItem(CONFIG.cacheKey);
        if (!cached) return null;
        
        const { timestamp } = JSON.parse(cached);
        return timestamp;
    } catch (error) {
        console.warn('Error reading cache timestamp:', error);
        return null;
    }
}

function setCachedData(data) {
    try {
        const cacheEntry = {
            data: data,
            timestamp: Date.now()
        };
        localStorage.setItem(CONFIG.cacheKey, JSON.stringify(cacheEntry));
    } catch (error) {
        console.warn('Error writing cache:', error);
    }
}

function shouldBypassCache() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has('refresh') || urlParams.has('nocache') || urlParams.has('bypass');
}

// Helper Functions
function createStatCard(title, value, unit) {
    return `
        <div class="snow-stat">
            <h3>${title}</h3>
            <div class="snow-value">${value}<span class="unit">${unit}</span></div>
        </div>
    `;
}

function getText(doc, selector) {
    const element = doc.querySelector(selector);
    return element?.textContent?.trim().replace('cm', '') || '0';
}

function parseForecast(doc) {
    const forecast = [];
    const forecastElements = doc.querySelectorAll('#alpine > div > section > div')[0]?.children || [];
    
    for (const day of forecastElements) {
        const snow = day.querySelector('div.weather-forecast__description > ul > li:nth-child(1)')?.textContent.trim() || '0';
        const date = day.querySelector('h3')?.textContent.trim() || '';
        forecast.push({
            date: date,
            snow: snow.includes('Snow') ? snow.split('  ')[1] : '0'
        });
    }
    return forecast;
}

// Snow Report Functions
async function fetchWithRetry(url, retries = 3, timeout = 15000) {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const response = await fetch(url, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return response;
        } catch (error) {
            const isLastAttempt = attempt === retries - 1;
            
            if (isLastAttempt) {
                throw error;
            }
            
            // Exponential backoff: wait 1s, 2s, 4s before retrying
            const delay = Math.min(1000 * Math.pow(2, attempt), 4000);
            console.warn(`Fetch attempt ${attempt + 1} failed, retrying in ${delay}ms...`, error.message);
            
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

async function fetchSnowReport() {
    const bypassCache = shouldBypassCache();
    
    if (bypassCache) {
        console.log('Cache bypass requested via URL parameter');
        // Clear cache when bypass is requested
        localStorage.removeItem(CONFIG.cacheKey);
    }
    
    // Check cache first (unless bypassed by URL param)
    if (!bypassCache) {
        const cachedData = getCachedData();
        if (cachedData) {
            const timestamp = getCachedTimestamp();
            const age = timestamp ? Math.round((Date.now() - timestamp) / 1000 / 60) : 0;
            console.log(`Using cached forecast data (age: ${age} minutes)`);
            updateSnowReport(cachedData);
            return;
        }
    }
    console.log('Fetching snow report...');
    
    try {
        const [snowReportRes, weatherRes] = await Promise.all([
            fetchWithRetry('https://api.allorigins.win/raw?url=' + encodeURIComponent(CONFIG.endpoints.snowReport)),
            fetchWithRetry('https://api.allorigins.win/raw?url=' + encodeURIComponent(CONFIG.endpoints.weather))
        ]);

        const html = await snowReportRes.text();
        const weatherData = await weatherRes.json();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        
        const data = {
            snow: {
                new: getText(doc, '.snow-report__new .snow-report__data .value'),
                lastHour: getText(doc, '#main .snow-report__amounts div:nth-child(1) .value'),
                last24Hours: getText(doc, '#main .snow-report__amounts div:nth-child(2) .value'),
                last48Hours: getText(doc, '#main .snow-report__amounts .amount3 .value'),
                last7Days: getText(doc, '#main .snow-report__amounts .amount4 .value')
            },
            temperatures: {
                base: weatherData.weather.temperature,
                ripper: weatherData.summit.temperature,
                subpeak: weatherData.subpeak.temperature
            },
            wind: {
                speed: weatherData.summit.wind,
                direction: weatherData.summit.direction
            },
            forecast: parseForecast(doc)
        };

        // Cache the data
        setCachedData(data);
        console.log('Snow report fetched and cached successfully');
        updateSnowReport(data);
    } catch (error) {
        console.error('Error fetching snow report:', error);
        
        // If fetch fails, only use cached data as fallback if it's NOT expired
        // This prevents showing stale data after expiry
        const cachedData = getCachedData(false); // Explicitly disallow expired cache
        if (cachedData) {
            const timestamp = getCachedTimestamp();
            const age = timestamp ? Math.round((Date.now() - timestamp) / 1000 / 60) : 0;
            console.log(`Fetch failed, using non-expired cached data as fallback (age: ${age} minutes)`);
            updateSnowReport(cachedData);
            return;
        }
        
        // If no valid cache, show error
        const errorMessage = error.name === 'AbortError' 
            ? 'Request timed out. The service may be slow to respond. Please try refreshing in a moment.'
            : 'Error loading snow report. Please refresh the page.';
        document.getElementById('snow-data').innerHTML = `<div style="text-align: center; padding: 2rem; color: #fff;">${errorMessage}</div>`;
    }
}

// Generate unique snow curve path for each forecast card
function generateSnowCurveSVG(index, fillPercentage) {
    // Use index as seed for consistent but varied curves
    const seed = index * 17 + 23;
    const random = (multiplier) => {
        const x = Math.sin(seed * multiplier) * 10000;
        return x - Math.floor(x);
    };
    
    const width = 100;
    const height = 100;
    
    // In SVG, y=0 is top, y=100 is bottom
    // fillPercentage is the height percentage, so the curve top should be at y = 100 - fillPercentage
    const baseY = 100 - fillPercentage;
    
    // Generate wave parameters for organic snow-like curves
    // Each card gets different wave characteristics
    const wave1 = {
        amplitude: 4 + random(1) * 8, // 4-12px variation
        frequency: 0.4 + random(2) * 1.2, // 0.4-1.6 waves
        phase: random(3) * Math.PI * 2
    };
    
    const wave2 = {
        amplitude: 3 + random(4) * 5, // 3-8px variation
        frequency: 1.2 + random(5) * 1.8, // 1.2-3 waves
        phase: random(6) * Math.PI * 2
    };
    
    const wave3 = {
        amplitude: 1.5 + random(7) * 3, // 1.5-4.5px variation
        frequency: 2.5 + random(8) * 2.5, // 2.5-5 waves
        phase: random(9) * Math.PI * 2
    };
    
    // Create path points along the top edge (snow surface)
    const points = [];
    const numPoints = 30; // More points for smoother curves
    
    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const x = t * width;
        
        // Combine multiple waves for natural snow accumulation look
        // Subtract from baseY to create waves that go up and down from the fill level
        const waveOffset = 
            Math.sin(t * wave1.frequency * Math.PI * 2 + wave1.phase) * wave1.amplitude +
            Math.sin(t * wave2.frequency * Math.PI * 2 + wave2.phase) * wave2.amplitude +
            Math.sin(t * wave3.frequency * Math.PI * 2 + wave3.phase) * wave3.amplitude;
        
        // Ensure curve doesn't go below bottom or above top
        const y = Math.max(0, Math.min(100, baseY - waveOffset));
        
        points.push({ x, y });
    }
    
    // Create smooth curve path using cubic bezier for natural flow
    // Start from bottom-left, go up to first point, then follow the curve
    let path = `M 0,${height}`;
    
    // Draw line up to first curve point
    path += ` L 0,${points[0].y}`;
    
    // Create smooth bezier curves through all points
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        
        if (i === 0) {
            // First curve - use smooth control points
            const cp1x = p0.x;
            const cp1y = p0.y;
            const cp2x = p0.x + (p1.x - p0.x) * 0.4;
            const cp2y = p0.y + (p1.y - p0.y) * 0.4;
            path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p1.x},${p1.y}`;
        } else if (i < points.length - 2) {
            // Smooth continuation - reflect previous control point
            const prev = points[i - 1];
            const next = points[i + 2] || p1;
            const dx1 = p0.x - prev.x;
            const dy1 = p0.y - prev.y;
            const dx2 = next.x - p1.x;
            const dy2 = next.y - p1.y;
            
            const cp1x = p0.x + dx1 * 0.3;
            const cp1y = p0.y + dy1 * 0.3;
            const cp2x = p1.x - dx2 * 0.3;
            const cp2y = p1.y - dy2 * 0.3;
            path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p1.x},${p1.y}`;
        } else {
            // Last curve
            const prev = points[i - 1];
            const dx = p0.x - prev.x;
            const dy = p0.y - prev.y;
            const cp1x = p0.x + dx * 0.3;
            const cp1y = p0.y + dy * 0.3;
            path += ` S ${p1.x},${p1.y} ${p1.x},${p1.y}`;
        }
    }
    
    // Close the path by going to bottom-right and back to start
    path += ` L ${width},${height} Z`;
    
    // Generate unique gradient ID for each card
    const gradientId = `snowGradient-${index}`;
    
    return {
        path,
        gradientId
    };
}

// Generate skull SVG for no-snow days
function generateSkullSVG() {
    // Create a stylized skull that fits the retro/cyberpunk aesthetic
    // Skull head outline - more rounded and stylized
    const skullHead = `M 50,12 
        C 38,12 28,18 25,28
        C 22,36 24,44 30,50
        C 30,58 36,64 42,66
        C 42,70 46,72 50,72
        C 54,72 58,70 58,66
        C 64,64 70,58 70,50
        C 76,44 78,36 75,28
        C 72,18 62,12 50,12 Z`;
    
    // Left eye socket - larger and more menacing
    const leftEye = `M 40,30
        C 37,30 35,32 35,35
        C 35,38 37,40 40,40
        C 43,40 45,38 45,35
        C 45,32 43,30 40,30 Z`;
    
    // Right eye socket
    const rightEye = `M 60,30
        C 57,30 55,32 55,35
        C 55,38 57,40 60,40
        C 63,40 65,38 65,35
        C 65,32 63,30 60,30 Z`;
    
    // Nose cavity - inverted triangle
    const nose = `M 50,44
        L 46,52
        L 54,52
        Z`;
    
    // Jaw/teeth area - wider and more pronounced
    const jaw = `M 35,58
        C 32,58 30,60 30,63
        C 30,66 32,68 35,68
        L 65,68
        C 68,68 70,66 70,63
        C 70,60 68,58 65,58
        L 35,58 Z`;
    
    // Teeth lines - more defined
    const teeth1 = `M 42,58 L 42,68`;
    const teeth2 = `M 50,58 L 50,68`;
    const teeth3 = `M 58,58 L 58,68`;
    
    return {
        head: skullHead,
        leftEye,
        rightEye,
        nose,
        jaw,
        teeth1,
        teeth2,
        teeth3
    };
}

function updateSnowReport(data) {
    const snowData = document.getElementById('snow-data');
    
    const stats = `
        <div class="snow-stats">
            ${createStatCard('New Snow', data.snow.new, 'cm')}
            ${createStatCard('Last Hour', data.snow.lastHour, 'cm')}
            ${createStatCard('Last 24h', data.snow.last24Hours, 'cm')}
            ${createStatCard('Last 48h', data.snow.last48Hours, 'cm')}
            ${createStatCard('Last 7d', data.snow.last7Days, 'cm')}
            ${createStatCard('Base Temp', data.temperatures.base, '°C')}
            ${createStatCard('Ripper Temp', data.temperatures.ripper, '°C')}
            ${createStatCard('Subpeak Temp', data.temperatures.subpeak, '°C')}
            ${createStatCard('Wind', data.wind.speed, `km/h ${data.wind.direction}`)}
        </div>
    `;

    // Calculate max snow for percentage fill
    const snowAmounts = data.forecast.map(day => {
        const amount = day.snow.replace(/[^0-9]/g, '');
        return parseInt(amount) || 0;
    });
    const maxSnow = Math.max(...snowAmounts, 1); // Use 1 as minimum to avoid division by zero

    const forecast = `
        <div class="forecast-section">            
            <div class="forecast-grid">
                ${data.forecast.map((day, index) => {
                    const snowAmount = day.snow.replace(/[^0-9]/g, '');
                    const snowValue = parseInt(snowAmount) || 0;
                    const fillPercentage = maxSnow > 0 ? (snowValue / maxSnow) * 100 : 0;
                    const isToday = index === 0;
                    const highlightClass = isToday ? 'highlight' : '';
                    const hasNoSnow = snowValue === 0;
                    
                    if (hasNoSnow) {
                        // Show skull for no-snow days
                        const skull = generateSkullSVG();
                        const skullGradientId = `skullGradient-${index}`;
                        return `
                            <div class="forecast-card ${highlightClass} no-snow">
                                <div class="forecast-skull">
                                    <svg class="skull-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                                        <defs>
                                            <linearGradient id="${skullGradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
                                                <stop offset="0%" style="stop-color:#ff4444;stop-opacity:0.8" />
                                                <stop offset="50%" style="stop-color:#cc0000;stop-opacity:0.9" />
                                                <stop offset="100%" style="stop-color:#990000;stop-opacity:0.8" />
                                            </linearGradient>
                                            <filter id="skullGlow-${index}">
                                                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                                                <feMerge>
                                                    <feMergeNode in="coloredBlur"/>
                                                    <feMergeNode in="SourceGraphic"/>
                                                </feMerge>
                                            </filter>
                                        </defs>
                                        <path class="skull-head" d="${skull.head}" fill="url(#${skullGradientId})" stroke="#ff6666" stroke-width="0.5" filter="url(#skullGlow-${index})" />
                                        <path class="skull-eye" d="${skull.leftEye}" fill="#000" />
                                        <path class="skull-eye" d="${skull.rightEye}" fill="#000" />
                                        <path class="skull-nose" d="${skull.nose}" fill="#000" />
                                        <path class="skull-jaw" d="${skull.jaw}" fill="url(#${skullGradientId})" stroke="#ff6666" stroke-width="0.5" />
                                        <path class="skull-teeth" d="${skull.teeth1}" stroke="#fff" stroke-width="0.8" />
                                        <path class="skull-teeth" d="${skull.teeth2}" stroke="#fff" stroke-width="0.8" />
                                        <path class="skull-teeth" d="${skull.teeth3}" stroke="#fff" stroke-width="0.8" />
                                    </svg>
                                </div>
                                <div class="forecast-day">${day.date}</div>
                                <div class="forecast-amount no-snow-text">NO SNOW</div>
                            </div>
                        `;
                    } else {
                        // Show normal snow fill with curve
                        const { path, gradientId } = generateSnowCurveSVG(index, fillPercentage);
                        const gradientVariation = (index % 3) * 0.05;
                        return `
                            <div class="forecast-card ${highlightClass}">
                                <div class="forecast-fill" style="--fill-height: ${fillPercentage}%">
                                    <svg class="snow-curve-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                                        <defs>
                                            <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
                                                <stop offset="0%" style="stop-color:rgba(77, 208, 196, ${0.55 + gradientVariation});stop-opacity:1" />
                                                <stop offset="25%" style="stop-color:rgba(77, 208, 196, ${0.5 + gradientVariation});stop-opacity:1" />
                                                <stop offset="50%" style="stop-color:rgba(58, 145, 136, ${0.65 + gradientVariation});stop-opacity:1" />
                                                <stop offset="75%" style="stop-color:rgba(58, 145, 136, ${0.55 + gradientVariation});stop-opacity:1" />
                                                <stop offset="100%" style="stop-color:rgba(58, 145, 136, ${0.45 + gradientVariation});stop-opacity:1" />
                                            </linearGradient>
                                        </defs>
                                        <path class="snow-curve-path" d="${path}" fill="url(#${gradientId})" />
                                    </svg>
                                </div>
                                <div class="forecast-day">${day.date}</div>
                                <div class="forecast-amount">${snowAmount} cm</div>
                            </div>
                        `;
                    }
                }).join('')}
            </div>
        </div>
    `;

    // Get and format the last update timestamp
    const timestamp = getCachedTimestamp();
    let lastUpdate = '';
    if (timestamp) {
        const updateDate = new Date(timestamp);
        const formattedTime = updateDate.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        lastUpdate = `<div class="last-update">Last updated: ${formattedTime}</div>`;
    }

    snowData.innerHTML = stats + forecast + lastUpdate;
}

// Snowfall Animation
function createSnowflake() {
    const snowflake = document.createElement('div');
    snowflake.classList.add('snowflake');
    snowflake.innerHTML = '❄';
    
    snowflake.style.left = Math.random() * 100 + 'vw';
    snowflake.style.fontSize = (Math.random() * 20 + 20) + 'px';
    snowflake.style.animationDuration = (Math.random() * 5 + 5) + 's';
    snowflake.style.transform = `rotate(${Math.random() * 50 - 25}deg)`;
    
    document.body.appendChild(snowflake);
    
    setTimeout(() => snowflake.remove(), parseFloat(snowflake.style.animationDuration) * 1000);
}

function startSnowfall() {
    // Create initial batch of snowflakes
    for(let i = 0; i < 20; i++) {
        setTimeout(createSnowflake, Math.random() * 3000);
    }
    
    // Continue creating snowflakes
    setInterval(() => {
        if(document.querySelectorAll('.snowflake').length < CONFIG.maxSnowflakes) {
            createSnowflake();
        }
    }, CONFIG.snowflakeInterval);
}

// Initialize
function init() {
    fetchSnowReport();
    startSnowfall();
    setInterval(fetchSnowReport, CONFIG.refreshInterval);
}

// Start the application
init(); 