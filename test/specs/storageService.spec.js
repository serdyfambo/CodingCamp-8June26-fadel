/**
 * storageService.spec.js
 * Unit tests (task 2.6) and property-based test P14 (task 2.7) for StorageService.
 *
 * Runs in the browser via the Jasmine + fast-check test runner (test/runner.html).
 * StorageService, StorageError, and ValidationError are exposed as globals by app.js.
 */

describe('StorageService', function () {

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /** Unique key prefix to avoid cross-test pollution */
  var TEST_KEY = '__test_storage_service__';

  beforeEach(function () {
    // Start every test with the test key absent
    localStorage.removeItem(TEST_KEY);
  });

  afterEach(function () {
    // Clean up after each test
    localStorage.removeItem(TEST_KEY);
    // Restore any spies that may have been installed
    if (localStorage.setItem.and) {
      localStorage.setItem.and.callThrough();
    }
  });

  // ─── isAvailable() ──────────────────────────────────────────────────────────

  describe('isAvailable()', function () {

    it('returns a boolean', function () {
      var result = StorageService.isAvailable();
      expect(typeof result).toBe('boolean');
    });

    it('returns true in a normal browser environment', function () {
      expect(StorageService.isAvailable()).toBe(true);
    });

    it('returns false when localStorage.setItem throws', function () {
      spyOn(localStorage, 'setItem').and.throwError('QuotaExceededError');
      expect(StorageService.isAvailable()).toBe(false);
    });

    it('returns false when localStorage.getItem throws', function () {
      spyOn(localStorage, 'getItem').and.throwError('SecurityError');
      expect(StorageService.isAvailable()).toBe(false);
    });

  });

  // ─── read() ─────────────────────────────────────────────────────────────────

  describe('read()', function () {

    it('returns null for a key that does not exist', function () {
      expect(StorageService.read('__nonexistent_key_xyz__')).toBeNull();
    });

    it('returns null when the stored value is corrupt (invalid JSON)', function () {
      localStorage.setItem(TEST_KEY, '{ not valid json ,,, }');
      expect(StorageService.read(TEST_KEY)).toBeNull();
    });

    it('returns null when localStorage.getItem throws', function () {
      spyOn(localStorage, 'getItem').and.throwError('SecurityError');
      expect(StorageService.read(TEST_KEY)).toBeNull();
    });

    it('returns the parsed value for a valid JSON string', function () {
      var data = { foo: 'bar', count: 42 };
      localStorage.setItem(TEST_KEY, JSON.stringify(data));
      expect(StorageService.read(TEST_KEY)).toEqual(data);
    });

    it('returns the parsed value for a stored array', function () {
      var arr = [1, 2, 3];
      localStorage.setItem(TEST_KEY, JSON.stringify(arr));
      expect(StorageService.read(TEST_KEY)).toEqual(arr);
    });

  });

  // ─── write() ────────────────────────────────────────────────────────────────

  describe('write()', function () {

    it('returns true on success', function () {
      expect(StorageService.write(TEST_KEY, { x: 1 })).toBe(true);
    });

    it('round-trip: write then read produces an equal value (object)', function () {
      var original = { name: 'Grocery run', amount: 45.50, category: 'Food' };
      StorageService.write(TEST_KEY, original);
      expect(StorageService.read(TEST_KEY)).toEqual(original);
    });

    it('round-trip: write then read produces an equal value (array)', function () {
      var original = ['Food', 'Transport', 'Housing'];
      StorageService.write(TEST_KEY, original);
      expect(StorageService.read(TEST_KEY)).toEqual(original);
    });

    it('round-trip: write then read preserves nested structure', function () {
      var original = { expenses: [{ id: '1', amount: 10 }], budgets: { Food: 400 } };
      StorageService.write(TEST_KEY, original);
      expect(StorageService.read(TEST_KEY)).toEqual(original);
    });

    it('throws StorageError when localStorage.setItem throws (storage full)', function () {
      spyOn(localStorage, 'setItem').and.throwError('QuotaExceededError');
      expect(function () {
        StorageService.write(TEST_KEY, { any: 'value' });
      }).toThrowError('Unable to save data. Your storage may be full.');
    });

    it('throws an instance of StorageError (not a plain Error)', function () {
      spyOn(localStorage, 'setItem').and.throwError('QuotaExceededError');
      var caught = null;
      try {
        StorageService.write(TEST_KEY, { any: 'value' });
      } catch (e) {
        caught = e;
      }
      expect(caught).not.toBeNull();
      expect(caught.name).toBe('StorageError');
    });

    it('throws StorageError with a user-safe message (no raw browser error text)', function () {
      spyOn(localStorage, 'setItem').and.throwError('QuotaExceededError: DOM Exception 22');
      var caught = null;
      try {
        StorageService.write(TEST_KEY, {});
      } catch (e) {
        caught = e;
      }
      expect(caught).not.toBeNull();
      // Message must not expose internal browser error strings
      expect(caught.message).not.toContain('QuotaExceededError');
      expect(caught.message).not.toContain('DOM Exception');
      expect(caught.message.length).toBeGreaterThan(0);
    });

  });

  // ─── remove() ───────────────────────────────────────────────────────────────

  describe('remove()', function () {

    it('removes an existing key so that read() returns null afterwards', function () {
      StorageService.write(TEST_KEY, { keep: false });
      StorageService.remove(TEST_KEY);
      expect(StorageService.read(TEST_KEY)).toBeNull();
    });

    it('does not throw when removing a key that does not exist', function () {
      expect(function () {
        StorageService.remove('__definitely_missing_key__');
      }).not.toThrow();
    });

    it('silently swallows exceptions thrown by localStorage.removeItem', function () {
      spyOn(localStorage, 'removeItem').and.throwError('SecurityError');
      expect(function () {
        StorageService.remove(TEST_KEY);
      }).not.toThrow();
    });

  });

  // ─── StorageError & ValidationError classes ─────────────────────────────────

  describe('StorageError', function () {

    it('has name === "StorageError"', function () {
      var e = new StorageError('test');
      expect(e.name).toBe('StorageError');
    });

    it('carries the supplied message', function () {
      var e = new StorageError('custom msg');
      expect(e.message).toBe('custom msg');
    });

    it('uses a default user-safe message when none is supplied', function () {
      var e = new StorageError();
      expect(e.message.length).toBeGreaterThan(0);
    });

  });

  describe('ValidationError', function () {

    it('has name === "ValidationError"', function () {
      var e = new ValidationError('bad input');
      expect(e.name).toBe('ValidationError');
    });

    it('carries the supplied message', function () {
      var e = new ValidationError('field required');
      expect(e.message).toBe('field required');
    });

  });

  // ─── P14: Storage Round-Trip (Property-Based Test) ──────────────────────────

  describe('P14 — Storage round-trip preserves all data', function () {

    var P14_KEY = '__p14_state__';

    afterEach(function () {
      localStorage.removeItem(P14_KEY);
    });

    /**
     * Arbitrary for a single expense record (mirrors the Expense typedef).
     * Using fc.float with reasonable bounds to avoid NaN / Infinity edge cases.
     */
    var expenseArb = fc.record({
      id:       fc.string({ minLength: 1 }),
      title:    fc.string({ minLength: 1, maxLength: 100 }),
      amount:   fc.float({ min: 0.01, max: 999999.99, noNaN: true }),
      date:     fc.string({ minLength: 10, maxLength: 10 }),
      category: fc.string({ minLength: 1 })
    });

    /**
     * Arbitrary for a full application state snapshot containing expenses,
     * a budgets map, and custom categories.
     */
    var appStateArb = fc.record({
      expenses:         fc.array(expenseArb),
      budgets:          fc.dictionary(
                          fc.string({ minLength: 1 }),
                          fc.float({ min: 0.01, noNaN: true })
                        ),
      customCategories: fc.array(fc.string({ minLength: 1, maxLength: 50 }))
    });

    // Feature: expense-budget-visualizer, Property 14: Storage round-trip preserves all data
    it('write → read produces a deep-equal result for any valid app state', function () {
      fc.assert(
        fc.property(appStateArb, function (state) {
          StorageService.write(P14_KEY, state);
          var retrieved = StorageService.read(P14_KEY);
          // Deep equality: retrieved must match the original state exactly
          expect(retrieved).toEqual(state);
          // Cleanup for next iteration
          localStorage.removeItem(P14_KEY);
          return true;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Validates: Requirements 7.1, 7.2
     *
     * Specifically checks that:
     *  - The expenses array round-trips without loss or type coercion
     *  - The budgets map round-trips without key reordering that changes values
     *  - The customCategories array round-trips completely
     */
    it('preserves expenses array length and field values after round-trip', function () {
      fc.assert(
        fc.property(appStateArb, function (state) {
          StorageService.write(P14_KEY, state);
          var retrieved = StorageService.read(P14_KEY);

          // Array length must be preserved
          expect(retrieved.expenses.length).toBe(state.expenses.length);
          expect(retrieved.customCategories.length).toBe(state.customCategories.length);

          // Each expense field must be value-equal
          for (var i = 0; i < state.expenses.length; i++) {
            expect(retrieved.expenses[i].id).toBe(state.expenses[i].id);
            expect(retrieved.expenses[i].title).toBe(state.expenses[i].title);
            expect(retrieved.expenses[i].amount).toBe(state.expenses[i].amount);
            expect(retrieved.expenses[i].date).toBe(state.expenses[i].date);
            expect(retrieved.expenses[i].category).toBe(state.expenses[i].category);
          }

          // Budget values must be preserved per key
          var budgetKeys = Object.keys(state.budgets);
          for (var j = 0; j < budgetKeys.length; j++) {
            var k = budgetKeys[j];
            expect(retrieved.budgets[k]).toBe(state.budgets[k]);
          }

          localStorage.removeItem(P14_KEY);
          return true;
        }),
        { numRuns: 100 }
      );
    });

  });

});
