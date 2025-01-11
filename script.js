const CONFIG = {
    refreshInterval: 30 * 60 * 1000, // 30 minutes
    maxSnowflakes: 50,
    snowflakeInterval: 200,
    endpoints: {
        snowReport: 'https://www.revelstokemountainresort.com/mountain/conditions/snow-report/',
        weather: 'https://www.revelstokemountainresort.com/snow-weather-json/'
    }
};

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
async function fetchSnowReport() {
    try {
        const [snowReportRes, weatherRes] = await Promise.all([
            fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(CONFIG.endpoints.snowReport)),
            fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(CONFIG.endpoints.weather))
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

        updateSnowReport(data);
    } catch (error) {
        console.error('Error fetching snow report:', error);
        document.getElementById('snow-data').innerHTML = 'Error loading snow report. Please refresh the page.';
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

    const forecast = `
        <div class="forecast-ticker">
            <div class="forecast-ticker-content">
                ${data.forecast.map(day => `
                    <span class="forecast-item">
                        ${day.date}:<strong>${day.snow}</strong>
                        ${day.snow !== '0' ? '😊' : '❌'}
                    </span>
                `).join('')}
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