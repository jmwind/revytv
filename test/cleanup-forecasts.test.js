describe('cleanup-forecasts', () => {
    let mockStorage;
    let handler;

    beforeEach(() => {
        const store = {};
        mockStorage = {
            get: jest.fn(async (key) => store[key] || null),
            set: jest.fn(async (key, value) => { store[key] = JSON.parse(JSON.stringify(value)); }),
            getAllByPrefix: jest.fn(async (prefix) => {
                const results = {};
                for (const [k, v] of Object.entries(store)) {
                    if (k.startsWith(prefix)) results[k] = v;
                }
                return results;
            }),
            _store: store,
        };

        jest.resetModules();
        jest.doMock('../api/lib/storage.js', () => mockStorage);
        handler = require('../api/cleanup-forecasts');
    });

    afterEach(() => jest.restoreAllMocks());

    function makeRes() {
        const res = {
            setHeader: jest.fn(),
            status: jest.fn(() => res),
            json: jest.fn((data) => { res._json = data; return res; }),
        };
        return res;
    }

    // Seed the mock store with corrupted data matching the real Upstash pattern
    function seedCorruptedData() {
        mockStorage._store['forecast:2026-02-17'] = {
            date: '2026-02-17',
            key: '2026-02-17',
            history: [
                { firstSeen: '2026-02-10T12:05:19.062Z', amount: 6, freezingLevel: 1200 },
                { firstSeen: '2026-02-10T12:05:19.062Z', amount: 2, freezingLevel: 800 },  // duplicate
                { firstSeen: '2026-02-10T12:25:19.146Z', amount: 6, freezingLevel: 1200 },
                { firstSeen: '2026-02-10T12:25:19.146Z', amount: 2, freezingLevel: 800 },  // duplicate
                { firstSeen: '2026-02-10T15:45:19.288Z', amount: 3, freezingLevel: 800 },  // legit change
            ]
        };
        mockStorage._store['forecast:2026-02-12'] = {
            date: '2026-02-12',
            key: '2026-02-12',
            history: [
                { firstSeen: '2026-02-11T18:35:19.193Z', amount: 0, freezingLevel: 1200 },
                { firstSeen: '2026-02-11T22:45:19.417Z', amount: 1, freezingLevel: 1200 },
                { firstSeen: '2026-02-11T22:45:19.417Z', amount: 8, freezingLevel: 1300 },  // duplicate
                { firstSeen: '2026-02-11T23:05:29.440Z', amount: 1, freezingLevel: 1200 },
                { firstSeen: '2026-02-11T23:05:29.440Z', amount: 8, freezingLevel: 1300 },  // duplicate
            ]
        };
        // Clean record — should not be touched
        mockStorage._store['forecast:2026-02-15'] = {
            date: '2026-02-15',
            key: '2026-02-15',
            history: [
                { firstSeen: '2026-02-10T12:00:00.000Z', amount: 4, freezingLevel: 1100 },
                { firstSeen: '2026-02-11T12:00:00.000Z', amount: 6, freezingLevel: 1200 },
            ]
        };
    }

    test('rejects non-POST requests', async () => {
        const res = makeRes();
        await handler({ method: 'GET', query: {} }, res);
        expect(res.status).toHaveBeenCalledWith(405);
    });

    test('dry run reports corrupted keys without modifying storage', async () => {
        seedCorruptedData();
        const res = makeRes();

        await handler({ method: 'POST', query: {} }, res);

        expect(res._json.dryRun).toBe(true);
        expect(res._json.checked).toBe(3);
        expect(res._json.cleaned).toBe(2); // feb-17 and feb-12
        expect(res._json.entriesRemoved).toBe(4); // 2 from feb-17 + 2 from feb-12

        // Storage should NOT have been written to
        expect(mockStorage.set).not.toHaveBeenCalled();

        // Original data should be untouched
        expect(mockStorage._store['forecast:2026-02-17'].history.length).toBe(5);
        expect(mockStorage._store['forecast:2026-02-12'].history.length).toBe(5);
    });

    test('dryRun=false removes duplicates and writes back', async () => {
        seedCorruptedData();
        const res = makeRes();

        await handler({ method: 'POST', query: { dryRun: 'false' } }, res);

        expect(res._json.dryRun).toBe(false);
        expect(res._json.entriesRemoved).toBe(4);

        // Feb 17: 5 entries → 3 (removed 2 duplicates)
        const feb17 = mockStorage._store['forecast:2026-02-17'];
        expect(feb17.history.length).toBe(3);
        expect(feb17.history.map(h => h.amount)).toEqual([6, 6, 3]);

        // Feb 12: 5 entries → 3 (removed 2 duplicates)
        const feb12 = mockStorage._store['forecast:2026-02-12'];
        expect(feb12.history.length).toBe(3);
        expect(feb12.history.map(h => h.amount)).toEqual([0, 1, 1]);
    });

    test('keeps first entry when timestamps collide, discards second', async () => {
        seedCorruptedData();
        const res = makeRes();
        await handler({ method: 'POST', query: { dryRun: 'false' } }, res);

        // For feb-17 at 12:05 — kept amount=6 (first/this-week), discarded amount=2 (next-week ghost)
        const feb17 = mockStorage._store['forecast:2026-02-17'];
        const entry = feb17.history.find(h => h.firstSeen === '2026-02-10T12:05:19.062Z');
        expect(entry.amount).toBe(6);
        expect(entry.freezingLevel).toBe(1200);
    });

    test('does not modify clean records', async () => {
        seedCorruptedData();
        const res = makeRes();
        await handler({ method: 'POST', query: { dryRun: 'false' } }, res);

        // Feb 15 had no duplicates — should be unchanged
        const feb15 = mockStorage._store['forecast:2026-02-15'];
        expect(feb15.history.length).toBe(2);

        // Verify it wasn't included in the cleaned list
        const cleanedKeys = res._json.details.map(d => d.key);
        expect(cleanedKeys).not.toContain('forecast:2026-02-15');
    });

    test('details include before/after counts per key', async () => {
        seedCorruptedData();
        const res = makeRes();
        await handler({ method: 'POST', query: {} }, res);

        const feb17Detail = res._json.details.find(d => d.key === 'forecast:2026-02-17');
        expect(feb17Detail).toEqual({
            key: 'forecast:2026-02-17',
            before: 5,
            after: 3,
            removed: 2,
        });
    });

    test('handles empty store gracefully', async () => {
        const res = makeRes();
        await handler({ method: 'POST', query: { dryRun: 'false' } }, res);

        expect(res._json.checked).toBe(0);
        expect(res._json.cleaned).toBe(0);
        expect(res._json.entriesRemoved).toBe(0);
    });

    test('handles records with empty or missing history', async () => {
        mockStorage._store['forecast:2026-02-20'] = { date: '2026-02-20', history: [] };
        mockStorage._store['forecast:2026-02-21'] = { date: '2026-02-21' };
        mockStorage._store['forecast:2026-02-22'] = null;

        const res = makeRes();
        await handler({ method: 'POST', query: { dryRun: 'false' } }, res);

        expect(res._json.checked).toBe(0);
        expect(res._json.cleaned).toBe(0);
    });
});
