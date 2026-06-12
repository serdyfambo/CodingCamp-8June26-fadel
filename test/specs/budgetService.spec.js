// Spec file for BudgetService
// Tests for tasks 5.5 through 5.9

describe('BudgetService', function () {

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  var originalRead, originalWrite, originalRemove;

  beforeEach(function () {
    // Clear ebv_budgets and ebv_expenses before each test
    localStorage.removeItem('ebv_budgets');
    localStorage.removeItem('ebv_expenses');
  });

  // ─── Task 5.5: Unit Tests ─────────────────────────────────────────────────────

  describe('get(category)', function () {
    it('returns Infinity for a category with no stored budget', function () {
      expect(BudgetService.get('Food')).toBe(Infinity);
    });

    it('returns Infinity when ebv_budgets is missing from storage', function () {
      localStorage.removeItem('ebv_budgets');
      expect(BudgetService.get('Transport')).toBe(Infinity);
    });

    it('returns the stored amount for a known category', function () {
      localStorage.setItem('ebv_budgets', JSON.stringify({ Food: 500 }));
      expect(BudgetService.get('Food')).toBe(500);
    });

    it('returns Infinity for a category not present in the stored object', function () {
      localStorage.setItem('ebv_budgets', JSON.stringify({ Food: 300 }));
      expect(BudgetService.get('Housing')).toBe(Infinity);
    });
  });

  describe('getAll()', function () {
    it('returns {} when no budgets are stored', function () {
      expect(BudgetService.getAll()).toEqual({});
    });

    it('returns the full stored budget object', function () {
      var budgets = { Food: 300, Transport: 150 };
      localStorage.setItem('ebv_budgets', JSON.stringify(budgets));
      expect(BudgetService.getAll()).toEqual(budgets);
    });

    it('returns {} when stored value is corrupted JSON', function () {
      localStorage.setItem('ebv_budgets', '{invalid json}');
      expect(BudgetService.getAll()).toEqual({});
    });
  });

  describe('set(category, amount)', function () {
    it('stores a valid budget and get() reflects it', function () {
      BudgetService.set('Food', 400);
      expect(BudgetService.get('Food')).toBe(400);
    });

    it('writes to ebv_budgets in localStorage', function () {
      BudgetService.set('Transport', 200);
      var stored = JSON.parse(localStorage.getItem('ebv_budgets'));
      expect(stored['Transport']).toBe(200);
    });

    it('throws ValidationError for amount = 0', function () {
      expect(function () { BudgetService.set('Food', 0); }).toThrowError(ValidationError);
    });

    it('throws ValidationError for negative amount', function () {
      expect(function () { BudgetService.set('Food', -50); }).toThrowError(ValidationError);
    });

    it('throws ValidationError for amount exceeding 999999999.99', function () {
      expect(function () { BudgetService.set('Food', 1e12); }).toThrowError(ValidationError);
    });

    it('throws ValidationError for NaN', function () {
      expect(function () { BudgetService.set('Food', NaN); }).toThrowError(ValidationError);
    });

    it('is a no-op when the same amount is set twice (does not mutate unnecessarily)', function () {
      BudgetService.set('Food', 300);
      var writeSpy = spyOn(StorageService, 'write').and.callThrough();
      BudgetService.set('Food', 300);
      expect(writeSpy).not.toHaveBeenCalled();
    });

    it('updates an existing budget to a new value', function () {
      BudgetService.set('Food', 300);
      BudgetService.set('Food', 500);
      expect(BudgetService.get('Food')).toBe(500);
    });
  });

  describe('isOverBudget(category, yearMonth)', function () {
    var YEAR_MONTH = '2024-01';

    function seedExpenses(expenses) {
      localStorage.setItem('ebv_expenses', JSON.stringify(expenses));
    }

    it('returns false when no budget is set (Infinity)', function () {
      seedExpenses([
        { id: '1', title: 'Lunch', amount: 50, date: '2024-01-10', category: 'Food' }
      ]);
      expect(BudgetService.isOverBudget('Food', YEAR_MONTH)).toBe(false);
    });

    it('returns true when total expenses exceed the budget', function () {
      BudgetService.set('Food', 100);
      seedExpenses([
        { id: '1', title: 'Lunch', amount: 60, date: '2024-01-10', category: 'Food' },
        { id: '2', title: 'Dinner', amount: 50, date: '2024-01-15', category: 'Food' }
      ]);
      expect(BudgetService.isOverBudget('Food', YEAR_MONTH)).toBe(true);
    });

    it('returns false when total expenses equal the budget exactly', function () {
      BudgetService.set('Food', 110);
      seedExpenses([
        { id: '1', title: 'Lunch', amount: 60, date: '2024-01-10', category: 'Food' },
        { id: '2', title: 'Dinner', amount: 50, date: '2024-01-15', category: 'Food' }
      ]);
      expect(BudgetService.isOverBudget('Food', YEAR_MONTH)).toBe(false);
    });

    it('returns false when total expenses are under the budget', function () {
      BudgetService.set('Food', 200);
      seedExpenses([
        { id: '1', title: 'Lunch', amount: 60, date: '2024-01-10', category: 'Food' }
      ]);
      expect(BudgetService.isOverBudget('Food', YEAR_MONTH)).toBe(false);
    });

    it('only sums expenses for the matching category', function () {
      BudgetService.set('Food', 80);
      seedExpenses([
        { id: '1', title: 'Lunch', amount: 50, date: '2024-01-10', category: 'Food' },
        { id: '2', title: 'Bus', amount: 200, date: '2024-01-10', category: 'Transport' }
      ]);
      // 50 < 80, should not be over budget despite Transport being huge
      expect(BudgetService.isOverBudget('Food', YEAR_MONTH)).toBe(false);
    });

    it('only sums expenses in the matching yearMonth', function () {
      BudgetService.set('Food', 80);
      seedExpenses([
        { id: '1', title: 'Lunch', amount: 50, date: '2024-01-10', category: 'Food' },
        { id: '2', title: 'Dinner', amount: 200, date: '2024-02-05', category: 'Food' }
      ]);
      // Only Jan: 50 < 80
      expect(BudgetService.isOverBudget('Food', YEAR_MONTH)).toBe(false);
    });

    it('returns false for a category with no expenses in that month', function () {
      BudgetService.set('Food', 100);
      seedExpenses([]);
      expect(BudgetService.isOverBudget('Food', YEAR_MONTH)).toBe(false);
    });
  });

  // ─── Task 5.6: P9 — Valid Budget Save Round-Trip ─────────────────────────────
  // Feature: expense-budget-visualizer, Property 9: Valid budget save round-trip
  describe('P9 — Valid Budget Save Round-Trip', function () {
    it('BudgetService.set then get returns the same amount, and storage reflects it (100 runs)', function () {
      // **Validates: Requirements 4.2**
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.float({ min: 0.01, max: 999999999.99, noNaN: true, noDefaultInfinity: true }),
          function (category, amount) {
            // Reset storage before each iteration
            localStorage.removeItem('ebv_budgets');

            BudgetService.set(category, amount);
            var retrieved = BudgetService.get(category);
            var stored = StorageService.read('ebv_budgets');

            expect(retrieved).toBe(amount);
            expect(stored[category]).toBe(amount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ─── Task 5.7: P10 — Invalid Budget Value Is Rejected Without Side Effects ────
  // Feature: expense-budget-visualizer, Property 10: Invalid budget value is rejected without side effects
  describe('P10 — Invalid Budget Value Is Rejected Without Side Effects', function () {
    it('set() throws ValidationError for invalid amounts and leaves budget unchanged (100 runs)', function () {
      // **Validates: Requirements 4.3**
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.oneof(
            fc.constant(0),
            fc.float({ max: -0.001, noNaN: true, noDefaultInfinity: true }),
            fc.constant(1e12),
            fc.constant(NaN),
            fc.constant(-Infinity),
            fc.constant(Infinity)
          ),
          function (category, invalidAmount) {
            localStorage.removeItem('ebv_budgets');
            var before = BudgetService.get(category);

            var threw = false;
            try {
              BudgetService.set(category, invalidAmount);
            } catch (e) {
              if (e instanceof ValidationError) {
                threw = true;
              }
            }

            expect(threw).toBe(true);
            expect(BudgetService.get(category)).toBe(before);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ─── Task 5.8: P11 — Budget Idempotence ──────────────────────────────────────
  // Feature: expense-budget-visualizer, Property 11: Budget idempotence — identical value write is a no-op
  describe('P11 — Budget Idempotence', function () {
    it('calling set() with the same amount twice does NOT call StorageService.write on the second call (100 runs)', function () {
      // **Validates: Requirements 4.6**
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.float({ min: 0.01, max: 999999999.99, noNaN: true, noDefaultInfinity: true }),
          function (category, amount) {
            localStorage.removeItem('ebv_budgets');

            // First set — must write
            BudgetService.set(category, amount);

            // Spy for second call
            var writeSpy = spyOn(StorageService, 'write').and.callThrough();
            BudgetService.set(category, amount);
            expect(writeSpy).not.toHaveBeenCalled();

            // Restore spy
            writeSpy.and.callThrough();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ─── Task 5.9: P12 — Over-Budget Detection Is Correct ────────────────────────
  // Feature: expense-budget-visualizer, Property 12: Over-budget detection is correct for all expense and budget combinations
  describe('P12 — Over-Budget Detection Is Correct', function () {
    it('isOverBudget returns true iff sum > budget; false when no budget set (100 runs)', function () {
      // **Validates: Requirements 4.4, 4.5, 6.6**
      var YEAR_MONTH = '2024-03';

      // Arbitrary for a single expense amount (positive, up to 10000 to keep sums manageable)
      var amountArb = fc.float({ min: 0.01, max: 10000, noNaN: true, noDefaultInfinity: true });

      fc.assert(
        fc.property(
          fc.array(amountArb, { minLength: 0, maxLength: 10 }),
          fc.option(fc.float({ min: 0.01, max: 999999999.99, noNaN: true, noDefaultInfinity: true }), { nil: undefined }),
          function (expenseAmounts, budgetAmount) {
            localStorage.removeItem('ebv_budgets');
            localStorage.removeItem('ebv_expenses');

            // Seed expenses
            var expenses = expenseAmounts.map(function (amt, idx) {
              return { id: String(idx), title: 'Test', amount: amt, date: '2024-03-10', category: 'Food' };
            });
            localStorage.setItem('ebv_expenses', JSON.stringify(expenses));

            // Set or leave budget unset
            if (budgetAmount !== undefined) {
              BudgetService.set('Food', budgetAmount);
            }

            var result = BudgetService.isOverBudget('Food', YEAR_MONTH);
            var total = expenseAmounts.reduce(function (s, a) { return s + a; }, 0);

            if (budgetAmount === undefined) {
              // No budget set → never over
              expect(result).toBe(false);
            } else {
              expect(result).toBe(total > budgetAmount);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

});
