describe('CategoryService', function () {

  beforeEach(function () {
    localStorage.clear();
  });

  afterEach(function () {
    localStorage.clear();
  });

  // ─── 1. Default categories ────────────────────────────────────────────────

  describe('DEFAULT_CATEGORIES', function () {
    it('contains all 6 expected default categories', function () {
      var defaults = CategoryService.DEFAULT_CATEGORIES;
      expect(defaults).toContain('Food');
      expect(defaults).toContain('Transport');
      expect(defaults).toContain('Housing');
      expect(defaults).toContain('Health');
      expect(defaults).toContain('Entertainment');
      expect(defaults).toContain('Other');
      expect(defaults.length).toBe(6);
    });

    it('is frozen (immutable)', function () {
      expect(Object.isFrozen(CategoryService.DEFAULT_CATEGORIES)).toBe(true);
    });
  });

  // ─── 2. add() happy path ──────────────────────────────────────────────────

  describe('add()', function () {
    it('adds a valid category so it appears in getAll()', function () {
      CategoryService.add('Groceries');
      var all = CategoryService.getAll();
      expect(all).toContain('Groceries');
    });

    it('persists the new category to localStorage under ebv_categories', function () {
      CategoryService.add('Vacation');
      var stored = JSON.parse(localStorage.getItem('ebv_categories'));
      expect(stored).toContain('Vacation');
    });

    it('trims whitespace before storing', function () {
      CategoryService.add('  Hobbies  ');
      var all = CategoryService.getAll();
      expect(all).toContain('Hobbies');
      expect(all).not.toContain('  Hobbies  ');
    });

    it('allows adding multiple custom categories', function () {
      CategoryService.add('Pets');
      CategoryService.add('Travel');
      var all = CategoryService.getAll();
      expect(all).toContain('Pets');
      expect(all).toContain('Travel');
    });

    // ─── 3. add() throws on empty name ─────────────────────────────────────

    it('throws ValidationError for an empty string', function () {
      expect(function () {
        CategoryService.add('');
      }).toThrowMatching(function (err) {
        return err.name === 'ValidationError';
      });
    });

    it('throws ValidationError for a whitespace-only name', function () {
      expect(function () {
        CategoryService.add('   ');
      }).toThrowMatching(function (err) {
        return err.name === 'ValidationError';
      });
    });

    // ─── 4. add() throws on name > 50 chars ────────────────────────────────

    it('throws ValidationError when name exceeds 50 characters', function () {
      var longName = 'A'.repeat(51);
      expect(function () {
        CategoryService.add(longName);
      }).toThrowMatching(function (err) {
        return err.name === 'ValidationError';
      });
    });

    it('does NOT throw when name is exactly 50 characters', function () {
      var exactName = 'B'.repeat(50);
      expect(function () {
        CategoryService.add(exactName);
      }).not.toThrow();
    });

    // ─── 5. add() throws on duplicate (case-insensitive) ───────────────────

    it('throws ValidationError when adding a name that matches a default category exactly', function () {
      expect(function () {
        CategoryService.add('Food');
      }).toThrowMatching(function (err) {
        return err.name === 'ValidationError';
      });
    });

    it('throws ValidationError when adding a name that matches a default category case-insensitively', function () {
      expect(function () {
        CategoryService.add('food');
      }).toThrowMatching(function (err) {
        return err.name === 'ValidationError';
      });
    });

    it('throws ValidationError when adding a duplicate custom category', function () {
      CategoryService.add('Shopping');
      expect(function () {
        CategoryService.add('Shopping');
      }).toThrowMatching(function (err) {
        return err.name === 'ValidationError';
      });
    });

    it('throws ValidationError when adding a duplicate custom category with different case', function () {
      CategoryService.add('Shopping');
      expect(function () {
        CategoryService.add('SHOPPING');
      }).toThrowMatching(function (err) {
        return err.name === 'ValidationError';
      });
    });
  });

  // ─── 6. delete() reassigns expenses ──────────────────────────────────────

  describe('delete()', function () {
    it('reassigns expenses in the deleted category to "Other" in storage', function () {
      // Seed expenses: two in 'Pets', one in 'Food'
      var expenses = [
        { id: '1', title: 'Dog food',   amount: 20,  date: '2024-01-10', category: 'Pets' },
        { id: '2', title: 'Cat toy',    amount: 10,  date: '2024-01-11', category: 'Pets' },
        { id: '3', title: 'Bread',      amount: 5,   date: '2024-01-12', category: 'Food' }
      ];
      localStorage.setItem('ebv_expenses', JSON.stringify(expenses));

      // Add the custom category first so it exists
      localStorage.setItem('ebv_categories', JSON.stringify(['Pets']));

      CategoryService.delete('Pets');

      var stored = JSON.parse(localStorage.getItem('ebv_expenses'));
      // Both Pets expenses should now be "Other"
      expect(stored[0].category).toBe('Other');
      expect(stored[1].category).toBe('Other');
      // Food expense should be unchanged
      expect(stored[2].category).toBe('Food');
    });

    it('removes the category from the custom categories list in storage', function () {
      localStorage.setItem('ebv_categories', JSON.stringify(['Pets', 'Travel']));
      localStorage.setItem('ebv_expenses', JSON.stringify([]));

      CategoryService.delete('Pets');

      var stored = JSON.parse(localStorage.getItem('ebv_categories'));
      expect(stored).not.toContain('Pets');
      expect(stored).toContain('Travel');
    });

    it('works cleanly when there are no expenses to reassign', function () {
      localStorage.setItem('ebv_categories', JSON.stringify(['Hobbies']));
      // No expenses in storage

      expect(function () {
        CategoryService.delete('Hobbies');
      }).not.toThrow();

      var storedCats = JSON.parse(localStorage.getItem('ebv_categories'));
      expect(storedCats).not.toContain('Hobbies');
    });
  });

  // ─── 7. getAffectedExpenses() returns correct subset ─────────────────────

  describe('getAffectedExpenses()', function () {
    it('returns only expenses whose category matches the given name', function () {
      var expenses = [
        { id: '1', title: 'Gym',       amount: 30, date: '2024-02-01', category: 'Health' },
        { id: '2', title: 'Bus pass',  amount: 15, date: '2024-02-02', category: 'Transport' },
        { id: '3', title: 'Vitamins',  amount: 12, date: '2024-02-03', category: 'Health' }
      ];
      localStorage.setItem('ebv_expenses', JSON.stringify(expenses));

      var result = CategoryService.getAffectedExpenses('Health');
      expect(result.length).toBe(2);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('3');
    });

    it('returns an empty array when no expenses match the category', function () {
      var expenses = [
        { id: '1', title: 'Rent', amount: 800, date: '2024-02-01', category: 'Housing' }
      ];
      localStorage.setItem('ebv_expenses', JSON.stringify(expenses));

      var result = CategoryService.getAffectedExpenses('Entertainment');
      expect(result).toEqual([]);
    });

    it('returns an empty array when there are no expenses at all', function () {
      // localStorage is clear from beforeEach
      var result = CategoryService.getAffectedExpenses('Food');
      expect(result).toEqual([]);
    });

    it('performs exact case-sensitive matching', function () {
      var expenses = [
        { id: '1', title: 'Apple', amount: 3, date: '2024-02-01', category: 'Food' }
      ];
      localStorage.setItem('ebv_expenses', JSON.stringify(expenses));

      // 'food' (lower-case) should NOT match 'Food'
      var result = CategoryService.getAffectedExpenses('food');
      expect(result).toEqual([]);

      // 'Food' should match
      var result2 = CategoryService.getAffectedExpenses('Food');
      expect(result2.length).toBe(1);
    });
  });

});

  // ─── P6: Valid custom category add round-trip (Property-Based) ───────────────

  // Feature: expense-budget-visualizer, Property 6: Valid custom category add round-trip
  describe('P6 — Valid custom category add round-trip', function () {

    /**
     * Generates a category name that is guaranteed to be unique by prefixing
     * with a fixed token, so it can never collide with DEFAULT_CATEGORIES
     * or other generated names within the same run.
     *
     * We use fc.string({ minLength: 1, maxLength: 40 }) and prefix with "C_"
     * (2 chars) to stay within the 50-char limit.
     */
    var uniqueCategoryArb = fc.string({ minLength: 1, maxLength: 40 }).map(function (s) {
      return 'C_' + s;
    });

    /**
     * Validates: Requirements 3.2
     *
     * After add(name), the name must appear in both getAll() and in the
     * raw 'ebv_categories' array persisted to localStorage.
     */
    it('after add(name), name appears in getAll() and in storage', function () {
      fc.assert(
        fc.property(uniqueCategoryArb, function (name) {
          // Reset storage each iteration to avoid duplicate-name collisions
          localStorage.clear();

          CategoryService.add(name);

          var all = CategoryService.getAll();
          expect(all).toContain(name);

          var stored = StorageService.read('ebv_categories');
          expect(Array.isArray(stored)).toBe(true);
          expect(stored).toContain(name);

          return true;
        }),
        { numRuns: 100 }
      );
    });

  });

  // ─── P7: Invalid or duplicate category name is rejected (Property-Based) ─────

  // Feature: expense-budget-visualizer, Property 7: Invalid or duplicate category name is rejected
  describe('P7 — Invalid or duplicate category name is rejected', function () {

    /**
     * Generates names that must always fail validation:
     *  - empty string
     *  - strings longer than 50 characters
     *  - names that match one of the default categories exactly
     */
    var invalidNameArb = fc.oneof(
      fc.constant(''),
      fc.string({ minLength: 51, maxLength: 100 }),
      fc.constantFrom.apply(fc, CategoryService.DEFAULT_CATEGORIES)
    );

    /**
     * Validates: Requirements 3.3
     *
     * add(name) must throw ValidationError and the category list length
     * must be identical before and after the failed call.
     */
    it('add(name) throws ValidationError and does not change the category list', function () {
      fc.assert(
        fc.property(invalidNameArb, function (name) {
          localStorage.clear();

          var before = CategoryService.getAll().length;
          var threw = false;
          var errorName = '';

          try {
            CategoryService.add(name);
          } catch (e) {
            threw = true;
            errorName = e.name;
          }

          expect(threw).toBe(true);
          expect(errorName).toBe('ValidationError');

          var after = CategoryService.getAll().length;
          expect(after).toBe(before);

          return true;
        }),
        { numRuns: 100 }
      );
    });

  });

  // ─── P8: Custom category deletion reassigns expenses to Other (Property-Based) ─

  // Feature: expense-budget-visualizer, Property 8: Custom category deletion reassigns all affected expenses to Other
  describe('P8 — Custom category deletion reassigns all affected expenses to Other', function () {

    /**
     * Generates a valid custom category name (1–20 chars, no whitespace-only,
     * not matching any default category name).
     */
    var customCategoryNameArb = fc.string({ minLength: 1, maxLength: 20 })
      .filter(function (s) {
        var trimmed = s.trim();
        if (trimmed.length === 0) { return false; }
        var defaults = CategoryService.DEFAULT_CATEGORIES;
        for (var i = 0; i < defaults.length; i++) {
          if (defaults[i].toLowerCase() === trimmed.toLowerCase()) { return false; }
        }
        return true;
      });

    /**
     * Generates a fake expense object assigned to the given category.
     * Uses fc.record for structured generation.
     */
    function expenseForCategoryArb(categoryName) {
      return fc.record({
        id:       fc.string({ minLength: 1, maxLength: 20 }),
        title:    fc.string({ minLength: 1, maxLength: 50 }),
        amount:   fc.float({ min: 0.01, max: 999.99, noNaN: true }),
        date:     fc.constant('2024-01-15'),
        category: fc.constant(categoryName)
      });
    }

    /**
     * Validates: Requirements 3.4, 3.6
     *
     * After CategoryService.delete(name):
     *  1. Every expense that was assigned to name has category === "Other" in storage
     *  2. name is no longer present in CategoryService.getAll()
     */
    it('after delete(name), affected expenses are reassigned to Other and name is gone', function () {
      fc.assert(
        fc.property(
          customCategoryNameArb.chain(function (catName) {
            return fc.tuple(
              fc.constant(catName),
              fc.array(expenseForCategoryArb(catName), { minLength: 1, maxLength: 10 })
            );
          }),
          function (pair) {
            var catName = pair[0];
            var expenses = pair[1];

            // Seed storage: custom category + expenses all assigned to catName
            localStorage.clear();
            StorageService.write('ebv_categories', [catName]);
            StorageService.write('ebv_expenses', expenses);

            // Delete the custom category
            CategoryService.delete(catName);

            // 1. Every previously-affected expense must now have category === "Other"
            var storedExpenses = StorageService.read('ebv_expenses');
            expect(Array.isArray(storedExpenses)).toBe(true);
            for (var i = 0; i < storedExpenses.length; i++) {
              expect(storedExpenses[i].category).toBe('Other');
            }

            // 2. catName must no longer appear in getAll()
            var allCategories = CategoryService.getAll();
            expect(allCategories).not.toContain(catName);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

  });

