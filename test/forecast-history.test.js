const fs = require('fs');
const path = require('path');
const { extractForecast, dayNameToDateKey } = require('../api/snow-report');

const duplicateHtml = fs.readFileSync(
    path.join(__dirname, 'fixtures/forecast-duplicates.html'), 'utf8'
);

// --- dayNameToDateKey ---

describe('dayNameToDateKey', () => {
    // Use a fixed reference: Friday 2026-02-13
    const friday = new Date('2026-02-13T12:00:00Z');

    test('maps Today to current date with :day suffix', () => {
        const result = dayNameToDateKey('Today', friday);
        expect(result.date).toBe('2026-02-13');
        expect(result.key).toBe('2026-02-13:day');
    });

    test('maps Tonight to current date with :night suffix', () => {
        const result = dayNameToDateKey('Tonight', friday);
        expect(result.date).toBe('2026-02-13');
        expect(result.key).toBe('2026-02-13:night');
    });

    test('maps next day name to correct date', () => {
        // Friday -> next Saturday = Feb 14
        const result = dayNameToDateKey('Saturday', friday);
        expect(result.date).toBe('2026-02-14');
        expect(result.key).toBe('2026-02-14');
    });

    test('maps same day name to next week', () => {
        // Friday -> next Friday = Feb 20
        const result = dayNameToDateKey('Friday', friday);
        expect(result.date).toBe('2026-02-20');
    });

    test('weekOffset=1 adds 7 days for duplicate day names', () => {
        // Saturday with offset 0 = Feb 14
        const first = dayNameToDateKey('Saturday', friday, 0);
        expect(first.date).toBe('2026-02-14');

        // Saturday with offset 1 = Feb 21 (next week)
        const second = dayNameToDateKey('Saturday', friday, 1);
        expect(second.date).toBe('2026-02-21');
    });

    test('weekOffset=1 on Today/Tonight adds 7 days', () => {
        const today = dayNameToDateKey('Today', friday, 1);
        expect(today.date).toBe('2026-02-20');
        expect(today.key).toBe('2026-02-20:day');

        const tonight = dayNameToDateKey('Tonight', friday, 1);
        expect(tonight.date).toBe('2026-02-20');
        expect(tonight.key).toBe('2026-02-20:night');
    });

    test('returns null for invalid day name', () => {
        expect(dayNameToDateKey('Notaday', friday)).toBeNull();
    });
});

// --- extractForecast with duplicates ---

describe('extractForecast with 10-day forecast', () => {
    const forecast = extractForecast(duplicateHtml);

    test('extracts all entries including duplicates', () => {
        expect(forecast.length).toBe(11); // 9 unique + 2 duplicate
    });

    test('Saturday appears twice with different values', () => {
        const saturdays = forecast.filter(f => f.day === 'Saturday');
        expect(saturdays.length).toBe(2);
        expect(saturdays[0].amount).toBe(8);
        expect(saturdays[0].freezingLevel).toBe(1400);
        expect(saturdays[1].amount).toBe(15);
        expect(saturdays[1].freezingLevel).toBe(600);
    });

    test('Sunday appears twice with different values', () => {
        const sundays = forecast.filter(f => f.day === 'Sunday');
        expect(sundays.length).toBe(2);
        expect(sundays[0].amount).toBe(2);
        expect(sundays[1].amount).toBe(12);
    });

    test('does not include valley entries', () => {
        // Valley has a Saturday entry — should not be captured
        const saturdays = forecast.filter(f => f.day === 'Saturday');
        expect(saturdays.length).toBe(2); // only alpine ones
        expect(saturdays.every(s => s.freezingLevel !== null)).toBe(true);
    });
});

// --- Forecast history tracking with mocked storage ---

describe('trackForecastHistory', () => {
    let mockStorage;
    let handler;

    beforeEach(() => {
        // In-memory mock storage
        const store = {};
        mockStorage = {
            get: jest.fn(async (key) => store[key] || null),
            set: jest.fn(async (key, value) => { store[key] = JSON.parse(JSON.stringify(value)); }),
            getWithMock: jest.fn(async (key) => store[key] || null),
            useUpstash: jest.fn(() => false),
            getAllByPrefix: jest.fn(async (prefix) => {
                const results = {};
                for (const [k, v] of Object.entries(store)) {
                    if (k.startsWith(prefix)) results[k] = v;
                }
                return results;
            }),
            _store: store,
        };

        // Re-require with mocked storage
        jest.resetModules();
        jest.doMock('../api/lib/storage.js', () => mockStorage);
        handler = require('../api/snow-report');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    async function callHandler(html, fetchedAt) {
        // Mock fetch to return our HTML
        const originalFetch = global.fetch;
        global.fetch = jest.fn(async () => ({
            ok: true,
            text: async () => html,
        }));

        // Mock Date for consistent fetchedAt
        const originalDate = global.Date;
        const mockNow = new Date(fetchedAt);
        const OrigDate = Date;
        jest.spyOn(global, 'Date').mockImplementation((...args) => {
            if (args.length === 0) return mockNow;
            return new OrigDate(...args);
        });
        global.Date.prototype = OrigDate.prototype;
        global.Date.now = () => mockNow.getTime();

        const result = {};
        const req = { method: 'GET' };
        const res = {
            setHeader: jest.fn(),
            status: jest.fn(() => res),
            json: jest.fn((data) => { Object.assign(result, data); return res; }),
            end: jest.fn(),
        };

        await handler(req, res);

        global.fetch = originalFetch;
        jest.restoreAllMocks();

        return result;
    }

    test('duplicate day names get different date keys', async () => {
        // Simulate fetching on Friday 2026-02-13
        const result = await callHandler(duplicateHtml, '2026-02-13T12:00:00Z');

        const saturdays = result.forecast.filter(f => f.day === 'Saturday');
        expect(saturdays.length).toBe(2);

        // First Saturday = Feb 14, second Saturday = Feb 21
        expect(saturdays[0].actualDate).toBe('2026-02-14');
        expect(saturdays[1].actualDate).toBe('2026-02-21');
    });

    test('duplicate day names get separate storage records', async () => {
        await callHandler(duplicateHtml, '2026-02-13T12:00:00Z');

        // Check storage was written to different keys
        const feb14 = mockStorage._store['forecast:2026-02-14'];
        const feb21 = mockStorage._store['forecast:2026-02-21'];

        expect(feb14).toBeDefined();
        expect(feb21).toBeDefined();
        expect(feb14.history[0].amount).toBe(8);   // first Saturday
        expect(feb21.history[0].amount).toBe(15);  // second Saturday
    });

    test('repeated fetches with same data do not create duplicate history entries', async () => {
        // First fetch
        await callHandler(duplicateHtml, '2026-02-13T12:00:00Z');

        // Clear cache so it re-fetches
        delete mockStorage._store['snow-report:cache'];

        // Second fetch 20 minutes later — same forecast data
        await callHandler(duplicateHtml, '2026-02-13T12:20:00Z');

        // Saturday Feb 14 should still have exactly 1 history entry (data unchanged)
        const feb14 = mockStorage._store['forecast:2026-02-14'];
        expect(feb14.history.length).toBe(1);

        // Saturday Feb 21 also just 1 entry
        const feb21 = mockStorage._store['forecast:2026-02-21'];
        expect(feb21.history.length).toBe(1);
    });

    test('forecast change creates exactly one new history entry', async () => {
        // First fetch: Saturday = 8cm
        await callHandler(duplicateHtml, '2026-02-13T12:00:00Z');
        delete mockStorage._store['snow-report:cache'];

        // Updated HTML: Saturday changes from 8cm to 12cm
        const updatedHtml = duplicateHtml.replace(
            '<li>Snow: 8 cm</li><li>Freezing level: 1400 metres.</li>',
            '<li>Snow: 12 cm</li><li>Freezing level: 1400 metres.</li>'
        );

        await callHandler(updatedHtml, '2026-02-13T12:20:00Z');

        const feb14 = mockStorage._store['forecast:2026-02-14'];
        expect(feb14.history.length).toBe(2);
        expect(feb14.history[0].amount).toBe(8);
        expect(feb14.history[0].firstSeen).toBe('2026-02-13T12:00:00.000Z');
        expect(feb14.history[1].amount).toBe(12);
        expect(feb14.history[1].firstSeen).toBe('2026-02-13T12:20:00.000Z');
    });

    test('Today and Tonight get separate histories that do not cross-contaminate', async () => {
        await callHandler(duplicateHtml, '2026-02-13T12:00:00Z');

        const result = await callHandler(duplicateHtml, '2026-02-13T12:00:00Z');
        const today = result.forecast.find(f => f.day === 'Today');
        const tonight = result.forecast.find(f => f.day === 'Tonight');

        // Today's history should only contain the 3cm entry
        expect(today.history.every(h => h.amount === 3)).toBe(true);
        // Tonight's history should only contain the 5cm entry
        expect(tonight.history.every(h => h.amount === 5)).toBe(true);
    });

    test('no entries share the same firstSeen timestamp within a single key', async () => {
        // Fetch multiple times
        await callHandler(duplicateHtml, '2026-02-13T12:00:00Z');
        delete mockStorage._store['snow-report:cache'];
        await callHandler(duplicateHtml, '2026-02-13T12:20:00Z');
        delete mockStorage._store['snow-report:cache'];
        await callHandler(duplicateHtml, '2026-02-13T12:40:00Z');

        // Check every forecast key — no duplicate timestamps within a single record
        for (const [key, record] of Object.entries(mockStorage._store)) {
            if (!key.startsWith('forecast:') || !record.history) continue;

            const timestamps = record.history.map(h => h.firstSeen);
            const unique = new Set(timestamps);
            expect(unique.size).toBe(timestamps.length,
                `Key ${key} has duplicate timestamps: ${JSON.stringify(timestamps)}`);
        }
    });
});
