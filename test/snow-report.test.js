const fs = require('fs');
const path = require('path');
const { extractForecast, parseSnowReport } = require('../api/snow-report');

const html = fs.readFileSync(path.join(__dirname, 'fixtures/snow-report.html'), 'utf8');

describe('extractForecast', () => {
    const forecast = extractForecast(html);

    test('returns forecast entries', () => {
        expect(forecast.length).toBeGreaterThan(0);
    });

    test('first entry is Today or Tonight', () => {
        expect(['Today', 'Tonight']).toContain(forecast[0].day);
    });

    test('each entry has required fields', () => {
        for (const entry of forecast) {
            expect(entry).toHaveProperty('day');
            expect(entry).toHaveProperty('amount');
            expect(typeof entry.amount).toBe('number');
            expect(entry).toHaveProperty('freezingLevel');
        }
    });

    test('only contains valid day names', () => {
        const validDays = ['Today', 'Tonight', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        for (const entry of forecast) {
            expect(validDays).toContain(entry.day);
        }
    });

    test('allows duplicate day names for 10+ day forecasts', () => {
        const saturdays = forecast.filter(f => f.day === 'Saturday');
        expect(saturdays.length).toBe(2);
    });

    test('duplicate days have distinct data', () => {
        const saturdays = forecast.filter(f => f.day === 'Saturday');
        // First Saturday: 14cm, second Saturday (user-added): 44cm
        expect(saturdays[0].amount).toBe(14);
        expect(saturdays[1].amount).toBe(44);
        expect(saturdays[1].freezingLevel).toBe(400);
    });

    test('duplicate days appear in document order', () => {
        const dayNames = forecast.map(f => f.day);
        const firstSatIdx = dayNames.indexOf('Saturday');
        const lastSatIdx = dayNames.lastIndexOf('Saturday');
        // Second Saturday should be after Friday (the last weekday before it)
        const fridayIdx = dayNames.indexOf('Friday');
        expect(firstSatIdx).toBeLessThan(fridayIdx);
        expect(lastSatIdx).toBeGreaterThan(fridayIdx);
    });

    test('does not include valley forecast entries (alpine only)', () => {
        // Alpine section has ~10 entries, valley would double it
        expect(forecast.length).toBeLessThanOrEqual(12);
    });

    test('entries are in document order (not re-sorted)', () => {
        const dayNames = forecast.map(f => f.day);
        expect(dayNames).toEqual([
            'Today', 'Tonight', 'Saturday', 'Sunday', 'Monday',
            'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
        ]);
    });
});

describe('parseSnowReport', () => {
    const data = parseSnowReport(html);

    test('parses snow data', () => {
        expect(data.snow).toBeDefined();
        expect(typeof data.snow.newSnow).toBe('number');
        expect(typeof data.snow.seasonTotal).toBe('number');
        expect(typeof data.snow.baseDepth).toBe('number');
    });

    test('parses weather data', () => {
        expect(data.weather).toBeDefined();
    });

    test('forecast is populated', () => {
        expect(data.forecast.length).toBeGreaterThan(0);
    });
});
