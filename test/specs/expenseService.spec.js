// Spec file for ExpenseService — tasks 4.7 through 4.12
describe('ExpenseService', function () {

  // ── Helpers ─────────────────────────────────────────────────────────────────

  var DEFAULT_CATEGORIES = ['Food', 'Transport', 'Housing', 'Health', 'Entertainment', 'Other'];

  /** Today's date as YYYY-MM-DD (never in the future). */
  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  /** Yesterday's date as YYYY-MM-DD. */
  function yesterday() {
    var d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  /** Build a minimal valid expense fields object. */
  function validFields(overrides) {
    return Object.assign(
      { title: 'Test Expense', amount: 10.00, date: today(), category: 'Food' },
      overrides || {}
    );
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  beforeEach(function () {
    localStorage.clear();
  });

  afterEach(function () {
    localStorage.clear();
  });

  // ── 4.2 / 4.3: add() ────────────────────────────────────────────────────────

  describe('add()', function () {

    it('happy path: returns a saved Expense with all input fields', function () {
      var fields = validFields({ title: 'Lunch', amount: 12.50, date: today(), category: 'Food' });
      var expense = ExpenseService.add(fields);

      expect(expense.title).toBe('Lunch');
      expect(expense.amount).toBe(12.50);
      expect(expense.date).toBe(today());
      expect(expense.category).toBe('Food');
      expect(typeof expense.id).toBe('string');
      expect(expense.id.length).toBeGreaterThan(0);
    });

    it('persists the expense to storage', function () {
      var fields = validFields();
      var expense = ExpenseService.add(fields);

      var stored = JSON.parse(localStorage.getItem('ebv_expenses'));
      expect(Array.isArray(stored)).toBe(true);
      expect(stored.length).toBe(1);
      expect(stored[0].id).toBe(expense.id);
    });

    it('rejects a future date with ValidationError', function () {
      var future = new Date();
      future.setDate(future.getDate() + 1);
      var futureDate = future.toISOString().slice(0, 10);

      expect(function () {
        ExpenseService.add(validFields({ date: futureDate }));
      }).toThrowError(); // ValidationError
    });

    it('rejects amount below 0.01 with ValidationError', function () {
      expect(function () {
        ExpenseService.add(validFields({ amount: 0 }));
      }).toThrowError();
    });

    it('rejects amount above 999999.99 with ValidationError', function () {
      expect(function () {
        ExpenseService.add(validFields({ amount: 1000000 }));
      }).toThrowError();
    });

    it('rejects amount with more than 2 decimal places', function () {
      expect(function () {
        ExpenseService.add(validFields({ amount: '10.001' }));
      }).toThrowError();
    });

    it('does not mutate storage on ValidationError', function () {
      try { ExpenseService.add(validFields({ title: '' })); } catch (e) { /* expected */ }
      var stored = localStorage.getItem('ebv_expenses');
      // Either null or empty array — never a partially-written entry
      if (stored !== null) {
        expect(JSON.parse(stored).length).toBe(0);
      }
    });
  });

  // ── 4.3: update() ───────────────────────────────────────────────────────────

  describe('update()', function () {

    it('happy path: returns updated Expense and persists changes', function () {
      var added = ExpenseService.add(validFields({ title: 'Original', amount: 5.00 }));
      var updated = ExpenseService.update(added.id, validFields({ title: 'Changed', amount: 99.99 }));

      expect(updated.id).toBe(added.id);
      expect(updated.title).toBe('Changed');
      expect(updated.amount).toBe(99.99);

      var stored = JSON.parse(localStorage.getItem('ebv_expenses'));
      expect(stored[0].title).toBe('Changed');
    });

    it('changes only the target expense — other expenses untouched', function () {
      var e1 = ExpenseService.add(validFields({ title: 'Expense 1', amount: 1.00 }));
      var e2 = ExpenseService.add(validFields({ title: 'Expense 2', amount: 2.00 }));

      ExpenseService.update(e1.id, validFields({ title: 'Updated 1', amount: 1.11 }));

      var all = ExpenseService.getAll();
      var found2 = all.find(function (e) { return e.id === e2.id; });
      expect(found2.title).toBe('Expense 2');
      expect(found2.amount).toBe(2.00);
    });

    it('throws ValidationError when id is not found', function () {
      expect(function () {
        ExpenseService.update('nonexistent-id', validFields());
      }).toThrowError();
    });

    it('throws ValidationError on invalid fields (does not persist)', function () {
      var added = ExpenseService.add(validFields({ title: 'Original' }));
      expect(function () {
        ExpenseService.update(added.id, validFields({ title: '' }));
      }).toThrowError();

      // Original should still be there unchanged
      var all = ExpenseService.getAll();
      expect(all[0].title).toBe('Original');
    });
  });

  // ── 4.4: delete() ───────────────────────────────────────────────────────────

  describe('delete()', function () {

    it('removes only the target expense', function () {
      var e1 = ExpenseService.add(validFields({ title: 'Keep me', amount: 1.00 }));
      var e2 = ExpenseService.add(validFields({ title: 'Delete me', amount: 2.00 }));

      ExpenseService.delete(e2.id);

      var all = ExpenseService.getAll();
      expect(all.length).toBe(1);
      expect(all[0].id).toBe(e1.id);
    });

    it('results in storage no longer containing the deleted id', function () {
      var e = ExpenseService.add(validFields());
      ExpenseService.delete(e.id);

      var stored = JSON.parse(localStorage.getItem('ebv_expenses'));
      var found = stored.find(function (x) { return x.id === e.id; });
      expect(found).toBeUndefined();
    });

    it('deleting a non-existent id leaves storage unchanged', function () {
      var e = ExpenseService.add(validFields());
      ExpenseService.delete('does-not-exist');

      var all = ExpenseService.getAll();
      expect(all.length).toBe(1);
      expect(all[0].id).toBe(e.id);
    });
  });

  // ── 4.5: getAll() ───────────────────────────────────────────────────────────

  describe('getAll()', function () {

    it('returns [] when storage is empty', function () {
      expect(ExpenseService.getAll()).toEqual([]);
    });

    it('returns [] when storage key is absent (null read)', function () {
      localStorage.removeItem('ebv_expenses');
      expect(ExpenseService.getAll()).toEqual([]);
    });

    it('sorts expenses by date descending', function () {
      var older = ExpenseService.add(validFields({ title: 'Old', date: '2024-01-01', amount: 1 }));
      var newer = ExpenseService.add(validFields({ title: 'New', date: '2024-06-15', amount: 2 }));

      var all = ExpenseService.getAll();
      expect(all[0].id).toBe(newer.id);
      expect(all[1].id).toBe(older.id);
    });

    it('uses id descending as tiebreaker for same date', function () {
      // Seed storage directly so we control IDs for tiebreaking
      var expenses = [
        { id: 'aaa', title: 'A', amount: 1, date: '2024-03-10', category: 'Food' },
        { id: 'zzz', title: 'Z', amount: 2, date: '2024-03-10', category: 'Food' }
      ];
      localStorage.setItem('ebv_expenses', JSON.stringify(expenses));

      var all = ExpenseService.getAll();
      // 'zzz' > 'aaa' lexicographically → 'zzz' comes first
      expect(all[0].id).toBe('zzz');
      expect(all[1].id).toBe('aaa');
    });
  });

  // ── 4.6: getByMonth() ───────────────────────────────────────────────────────

  describe('getByMonth()', function () {

    it('returns only expenses matching the given year-month', function () {
      ExpenseService.add(validFields({ title: 'Jan', date: '2024-01-15', amount: 1 }));
      ExpenseService.add(validFields({ title: 'Feb', date: '2024-02-10', amount: 2 }));
      ExpenseService.add(validFields({ title: 'Jan again', date: '2024-01-28', amount: 3 }));

      var jan = ExpenseService.getByMonth('2024-01');
      expect(jan.length).toBe(2);
      jan.forEach(function (e) {
        expect(e.date.startsWith('2024-01')).toBe(true);
      });
    });

    it('returns [] when no expenses match the year-month', function () {
      ExpenseService.add(validFields({ title: 'March', date: '2024-03-01', amount: 5 }));

      var result = ExpenseService.getByMonth('2024-01');
      expect(result).toEqual([]);
    });

    it('results are still sorted date-descending', function () {
      ExpenseService.add(validFields({ title: 'Early', date: '2024-05-02', amount: 1 }));
      ExpenseService.add(validFields({ title: 'Late',  date: '2024-05-20', amount: 2 }));

      var may = ExpenseService.getByMonth('2024-05');
      expect(may[0].date).toBe('2024-05-20');
      expect(may[1].date).toBe('2024-05-02');
    });
  });

});
