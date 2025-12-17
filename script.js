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
function getCachedData() {
    try {
        const cached = localStorage.getItem(CONFIG.cacheKey);
        if (!cached) return null;
        
        const { data, timestamp } = JSON.parse(cached);
        const now = Date.now();
        const age = now - timestamp;
        
        // Check if cache is expired
        if (age > CONFIG.cacheExpiry) {
            localStorage.removeItem(CONFIG.cacheKey);
            return null;
        }
        
        return data;
    } catch (error) {
        console.warn('Error reading cache:', error);
        localStorage.removeItem(CONFIG.cacheKey);
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
    return urlParams.has('refresh') || urlParams.has('nocache');
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
    // Check cache first (unless bypassed by URL param)
    if (!shouldBypassCache()) {
        const cachedData = getCachedData();
        if (cachedData) {
            console.log('Using cached forecast data');
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
        updateSnowReport(data);
    } catch (error) {
        console.error('Error fetching snow report:', error);
        
        // If fetch fails, try to use cached data as fallback
        const cachedData = getCachedData();
        if (cachedData) {
            console.log('Fetch failed, using cached data as fallback');
            updateSnowReport(cachedData);
            return;
        }
        
        const errorMessage = error.name === 'AbortError' 
            ? 'Request timed out. The service may be slow to respond. Please try refreshing in a moment.'
            : 'Error loading snow report. Please refresh the page.';
        document.getElementById('snow-data').innerHTML = `<div style="text-align: center; padding: 2rem; color: #fff;">${errorMessage}</div>`;
    }
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
                    return `
                        <div class="forecast-card ${highlightClass}">
                            <div class="forecast-fill" style="height: ${fillPercentage}%"></div>
                            <div class="forecast-day">${day.date}</div>
                            <div class="forecast-amount">${snowAmount} cm</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    snowData.innerHTML = stats + forecast;
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