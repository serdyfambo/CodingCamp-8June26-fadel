(function () {
  'use strict';

  // === Custom Error Classes ===

  /**
   * StorageError
   * Thrown by StorageService.write() when localStorage throws (e.g. quota exceeded,
   * security error). Always carries a user-safe message — never exposes raw
   * browser exception text.
   */
  function StorageError(message) {
    this.message = message || 'Unable to save data. Your storage may be full.';
    this.name = 'StorageError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, StorageError);
    } else {
      this.stack = (new Error(this.message)).stack;
    }
  }
  StorageError.prototype = Object.create(Error.prototype);
  StorageError.prototype.constructor = StorageError;

  /**
   * ValidationError
   * Thrown by service methods when user-supplied input fails validation rules
   * (e.g. empty title, amount out of range, duplicate category name).
   */
  function ValidationError(message) {
    this.message = message || 'Invalid input.';
    this.name = 'ValidationError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    } else {
      this.stack = (new Error(this.message)).stack;
    }
  }
  ValidationError.prototype = Object.create(Error.prototype);
  ValidationError.prototype.constructor = ValidationError;

  // === StorageService ===
  /**
   * StorageService
   * Wraps browser localStorage with typed read/write/remove access and
   * graceful error handling. All service modules depend on this layer.
   *
   * Public API:
   *   StorageService.isAvailable()        → boolean
   *   StorageService.read(key)            → object | null
   *   StorageService.write(key, value)    → boolean  (throws StorageError on failure)
   *   StorageService.remove(key)          → void
   */
  var STORAGE_SENTINEL_KEY = '__ebv_test__';
  var STORAGE_WRITE_ERROR_MSG = 'Unable to save data. Your storage may be full.';

  var StorageService = {
    /**
     * Returns true if localStorage is available and writable.
     * Performs a test write → read → delete cycle using a sentinel key.
     */
    isAvailable: function () {
      try {
        var sentinel = '__ebv_sentinel__';
        localStorage.setItem(STORAGE_SENTINEL_KEY, sentinel);
        var readBack = localStorage.getItem(STORAGE_SENTINEL_KEY);
        localStorage.removeItem(STORAGE_SENTINEL_KEY);
        return readBack === sentinel;
      } catch (e) {
        return false;
      }
    },

    /**
     * Reads and JSON-parses the value stored under `key`.
     * Returns the parsed value on success, or null if the key is missing,
     * the value is not valid JSON, or any exception is thrown.
     *
     * @param {string} key
     * @returns {*} parsed value or null
     */
    read: function (key) {
      try {
        var raw = localStorage.getItem(key);
        if (raw === null || raw === undefined) {
          return null;
        }
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    },

    /**
     * JSON-stringifies `value` and writes it to localStorage under `key`.
     * Returns true on success.
     * Throws StorageError (with a user-safe message) on any failure.
     *
     * @param {string} key
     * @param {*}      value
     * @returns {boolean}
     * @throws {StorageError}
     */
    write: function (key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        throw new StorageError(STORAGE_WRITE_ERROR_MSG);
      }
    },

    /**
     * Removes the entry for `key` from localStorage.
     * Silently swallows any thrown exception.
     *
     * @param {string} key
     */
    remove: function (key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        // Silent failure — callers do not need to handle storage removal errors
      }
    }
  };

  // === CategoryService ===
  /**
   * CategoryService
   * Manages the list of expense categories (built-in defaults + user-defined
   * custom categories). Handles add, delete, and reassignment of expenses
   * when a custom category is removed.
   *
   * Public API:
   *   CategoryService.DEFAULT_CATEGORIES  → string[]  (frozen)
   *   CategoryService.getAll()            → string[]
   *   CategoryService.add(name)           → void      (throws ValidationError)
   *   CategoryService.delete(name)        → void      (throws StorageError)
   *   CategoryService.getAffectedExpenses(name) → Expense[]
   */
  var CategoryService = {
    DEFAULT_CATEGORIES: Object.freeze(["Food", "Transport", "Housing", "Health", "Entertainment", "Other"]),

    /**
     * Returns the full list of categories: built-in defaults followed by any
     * user-defined custom categories stored under "ebv_categories".
     * Falls back to a copy of DEFAULT_CATEGORIES if the read fails or returns null.
     *
     * @returns {string[]}
     */
    getAll: function () {
      var custom = StorageService.read('ebv_categories');
      if (!Array.isArray(custom)) {
        return CategoryService.DEFAULT_CATEGORIES.slice();
      }
      return CategoryService.DEFAULT_CATEGORIES.concat(custom);
    },

    /**
     * Validates and adds a new custom category name.
     * Trims whitespace before validation. Throws ValidationError if the trimmed
     * name is empty, exceeds 50 characters, or duplicates an existing category
     * name (case-insensitive). On success, appends the trimmed name to the
     * custom categories array and writes it back to "ebv_categories".
     *
     * @param {string} name - The category name to add
     * @returns {void}
     * @throws {ValidationError} if name is empty, too long, or a duplicate
     * @throws {StorageError}    if the write to localStorage fails
     */
    add: function (name) {
      var trimmed = (name || '').trim();

      if (trimmed.length === 0) {
        throw new ValidationError('Category name cannot be empty.');
      }

      if (trimmed.length > 50) {
        throw new ValidationError('Category name cannot exceed 50 characters.');
      }

      var existing = CategoryService.getAll();
      var trimmedLower = trimmed.toLowerCase();
      for (var i = 0; i < existing.length; i++) {
        if (existing[i].toLowerCase() === trimmedLower) {
          throw new ValidationError('Category already exists.');
        }
      }

      var custom = StorageService.read('ebv_categories');
      if (!Array.isArray(custom)) {
        custom = [];
      }
      custom.push(trimmed);
      StorageService.write('ebv_categories', custom);
    },

    /**
     * Deletes a custom category by name.
     * Reassigns all expenses in that category to "Other", then removes the
     * category from the custom categories list. Throws StorageError if any
     * write to localStorage fails.
     *
     * @param {string} name - The category name to delete
     * @returns {void}
     * @throws {StorageError} if writing expenses or categories fails
     */
    delete: function (name) {
      // Step 1: Read all expenses and reassign affected ones
      var expenses = StorageService.read('ebv_expenses');
      if (!Array.isArray(expenses)) {
        expenses = [];
      }
      for (var i = 0; i < expenses.length; i++) {
        if (expenses[i].category === name) {
          expenses[i] = Object.assign({}, expenses[i], { category: 'Other' });
        }
      }
      // Write updated expenses back (even if unchanged, to stay consistent)
      StorageService.write('ebv_expenses', expenses);

      // Step 2: Remove category from custom categories list
      var custom = StorageService.read('ebv_categories');
      if (!Array.isArray(custom)) {
        custom = [];
      }
      custom = custom.filter(function (cat) { return cat !== name; });
      StorageService.write('ebv_categories', custom);
    },

    /**
     * Returns all expenses whose category matches the given name.
     * Performs an exact, case-sensitive match against expense.category.
     * Returns an empty array if no expenses exist or storage read fails.
     *
     * @param {string} name - The category name to filter by
     * @returns {Expense[]} Array of expenses in the specified category
     */
    getAffectedExpenses: function (name) {
      var expenses = StorageService.read('ebv_expenses');
      if (!Array.isArray(expenses)) {
        return [];
      }
      var affected = [];
      for (var i = 0; i < expenses.length; i++) {
        if (expenses[i].category === name) {
          affected.push(expenses[i]);
        }
      }
      return affected;
    }
  };

  // === ExpenseService ===
  /**
   * ExpenseService
   * Domain logic for expense CRUD operations. Validates all input, generates
   * unique IDs, and persists to/reads from StorageService. Guarantees
   * date-descending ordering on every read.
   *
   * Public API:
   *   ExpenseService.add(fields)          → Expense   (throws ValidationError | StorageError)
   *   ExpenseService.update(id, fields)   → Expense   (throws ValidationError | StorageError)
   *   ExpenseService.delete(id)           → void      (throws StorageError)
   *   ExpenseService.getAll()             → Expense[]
   *   ExpenseService.getByMonth(yearMonth)→ Expense[]
   */

  /**
   * validateExpenseFields (private helper)
   * Validates all required expense fields against business rules.
   * Throws ValidationError on the first validation failure encountered.
   *
   * @param {Object} fields - Object containing expense fields to validate
   * @param {string} fields.title - Expense title (required, non-empty, max 100 chars)
   * @param {number|string} fields.amount - Expense amount (required, numeric, 0.01-999999.99, max 2 decimals)
   * @param {string} fields.date - Expense date (required, valid date, not in future)
   * @param {string} fields.category - Expense category (required, must exist in CategoryService)
   * @throws {ValidationError} on first validation failure with a user-friendly message
   */
  function validateExpenseFields(fields) {
    // Validate title: non-empty and ≤ 100 characters
    if (!fields.title || typeof fields.title !== 'string' || fields.title.trim().length === 0) {
      throw new ValidationError('Expense title cannot be empty.');
    }
    if (fields.title.length > 100) {
      throw new ValidationError('Expense title cannot exceed 100 characters.');
    }

    // Validate amount: numeric, between 0.01 and 999999.99 inclusive, at most 2 decimal places
    var amount = parseFloat(fields.amount);
    if (isNaN(amount) || typeof fields.amount === 'boolean') {
      throw new ValidationError('Expense amount must be a valid number.');
    }
    if (amount < 0.01 || amount > 999999.99) {
      throw new ValidationError('Expense amount must be between 0.01 and 999,999.99.');
    }
    // Check for at most 2 decimal places
    var amountStr = String(fields.amount);
    var decimalMatch = amountStr.match(/\.(\d+)$/);
    if (decimalMatch && decimalMatch[1].length > 2) {
      throw new ValidationError('Expense amount cannot have more than 2 decimal places.');
    }

    // Validate date: valid date string, not in the future
    if (!fields.date || typeof fields.date !== 'string') {
      throw new ValidationError('Expense date is required.');
    }
    var expenseDate = new Date(fields.date);
    if (isNaN(expenseDate.getTime())) {
      throw new ValidationError('Expense date must be a valid date.');
    }
    // Compare dates at midnight to avoid time-of-day issues
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var expenseDateMidnight = new Date(expenseDate);
    expenseDateMidnight.setHours(0, 0, 0, 0);
    if (expenseDateMidnight > today) {
      throw new ValidationError('Expense date cannot be in the future.');
    }

    // Validate category: must be in CategoryService.getAll()
    if (!fields.category || typeof fields.category !== 'string') {
      throw new ValidationError('Expense category is required.');
    }
    var validCategories = CategoryService.getAll();
    var categoryFound = false;
    for (var i = 0; i < validCategories.length; i++) {
      if (validCategories[i] === fields.category) {
        categoryFound = true;
        break;
      }
    }
    if (!categoryFound) {
      throw new ValidationError('Expense category must be a valid category.');
    }
  }

  var ExpenseService = {
    /**
     * Adds a new expense after validation.
     * Generates a unique ID, writes to storage, and returns the saved expense.
     * Does not mutate state on failure.
     *
     * @param {Object} fields - The expense fields to validate and save
     * @param {string} fields.title - Expense title (1-100 chars)
     * @param {number|string} fields.amount - Expense amount (0.01-999999.99, max 2 decimals)
     * @param {string} fields.date - Expense date (ISO date string, not in future)
     * @param {string} fields.category - Expense category (must exist)
     * @returns {Expense} The saved expense object with generated ID
     * @throws {ValidationError} if any field is invalid
     * @throws {StorageError} if localStorage write fails
     */
    add: function (fields) {
      // Step 1: Validate all fields (throws ValidationError on failure)
      validateExpenseFields(fields);

      // Step 2: Generate unique ID
      var id;
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        try {
          id = crypto.randomUUID();
        } catch (e) {
          // Fallback if randomUUID fails
          id = Date.now().toString();
        }
      } else {
        // Fallback for environments without crypto.randomUUID
        id = Date.now().toString();
      }

      // Step 3: Read existing expenses from storage
      var expenses = StorageService.read('ebv_expenses');
      if (!Array.isArray(expenses)) {
        expenses = [];
      }

      // Step 4: Create the new expense object
      var newExpense = {
        id: id,
        title: fields.title,
        amount: parseFloat(fields.amount),
        date: fields.date,
        category: fields.category
      };

      // Step 5: Add to expenses array
      expenses.push(newExpense);

      // Step 6: Write to storage (throws StorageError on failure)
      // If this throws, the in-memory expenses array is not yet committed
      // to AppController state, so no state mutation occurs
      StorageService.write('ebv_expenses', expenses);

      // Step 7: Return the saved expense
      return newExpense;
    },

    /**
     * Updates an existing expense by ID after validation.
     * Reads the current expenses from storage, finds the target expense,
     * validates the new fields, merges them, writes back to storage,
     * and returns the updated expense. Rolls back (no mutation) on StorageError.
     *
     * @param {string} id - The ID of the expense to update
     * @param {Object} fields - The new expense fields to validate and merge
     * @param {string} fields.title - Expense title (1-100 chars)
     * @param {number|string} fields.amount - Expense amount (0.01-999999.99, max 2 decimals)
     * @param {string} fields.date - Expense date (ISO date string, not in future)
     * @param {string} fields.category - Expense category (must exist)
     * @returns {Expense} The updated expense object
     * @throws {ValidationError} if id not found or any field is invalid
     * @throws {StorageError} if localStorage write fails
     */
    update: function (id, fields) {
      // Step 1: Read current expenses from storage
      var expenses = StorageService.read('ebv_expenses');
      if (!Array.isArray(expenses)) {
        expenses = [];
      }

      // Step 2: Find the expense with matching id
      var targetIndex = -1;
      for (var i = 0; i < expenses.length; i++) {
        if (expenses[i].id === id) {
          targetIndex = i;
          break;
        }
      }
      if (targetIndex === -1) {
        throw new ValidationError('Expense not found.');
      }

      // Step 3: Validate the new field values (throws ValidationError on failure)
      validateExpenseFields(fields);

      // Step 4: Build the updated expense (shallow merge, keeping original id)
      var updatedExpense = Object.assign({}, expenses[targetIndex], {
        title: fields.title,
        amount: parseFloat(fields.amount),
        date: fields.date,
        category: fields.category
      });

      // Step 5: Build the updated expenses array (do NOT mutate the original yet)
      var updatedExpenses = expenses.slice();
      updatedExpenses[targetIndex] = updatedExpense;

      // Step 6: Attempt to write to storage; re-throw StorageError without
      // mutating in-memory state (rollback by not touching `expenses`)
      StorageService.write('ebv_expenses', updatedExpenses);

      // Step 7: Return the updated expense
      return updatedExpense;
    },

    /**
     * Deletes an expense by ID.
     * Reads the current expenses from storage, filters out the target id,
     * and writes the result. Does not mutate if write fails.
     *
     * @param {string} id - The ID of the expense to delete
     * @returns {void}
     * @throws {StorageError} if localStorage write fails
     */
    delete: function (id) {
      // Step 1: Read current expenses from storage
      var expenses = StorageService.read('ebv_expenses');
      if (!Array.isArray(expenses)) {
        expenses = [];
      }

      // Step 2: Build filtered array (target id excluded) without mutating original
      var filteredExpenses = expenses.filter(function (expense) {
        return expense.id !== id;
      });

      // Step 3: Write to storage — throws StorageError on failure,
      // leaving the original array in storage (no mutation on failure)
      StorageService.write('ebv_expenses', filteredExpenses);
    },

    /**
     * Returns all expenses sorted by date descending.
     * Uses id descending as tiebreaker for expenses with identical dates.
     * Returns an empty array if storage read returns null.
     *
     * @returns {Expense[]} All expenses, sorted date-descending (then id-descending)
     */
    getAll: function () {
      // Step 1: Read expenses from storage
      var expenses = StorageService.read('ebv_expenses');
      if (!Array.isArray(expenses)) {
        return [];
      }

      // Step 2: Sort by date descending, then id descending as tiebreaker
      var sorted = expenses.slice().sort(function (a, b) {
        if (a.date > b.date) return -1;
        if (a.date < b.date) return 1;
        // Dates are equal — tiebreak by id descending
        if (a.id > b.id) return -1;
        if (a.id < b.id) return 1;
        return 0;
      });

      return sorted;
    },

    /**
     * Returns all expenses for a specific year-month.
     * Filters results from getAll() to entries where date starts with yearMonth.
     *
     * @param {string} yearMonth - A year-month string in "YYYY-MM" format
     * @returns {Expense[]} Expenses for the given month, sorted date-descending
     */
    getByMonth: function (yearMonth) {
      return ExpenseService.getAll().filter(function (expense) {
        return expense.date.startsWith(yearMonth);
      });
    }
  };

  // === BudgetService ===
  /**
   * BudgetService
   * Manages per-category monthly budget limits. Validates budget amounts,
   * avoids unnecessary writes when values are unchanged (idempotence), and
   * provides over-budget detection for a given year-month period.
   *
   * Public API:
   *   BudgetService.get(category)                       → number  (Infinity if unset)
   *   BudgetService.getAll()                            → Record<string, number>
   *   BudgetService.set(category, amount)               → void    (throws ValidationError)
   *   BudgetService.isOverBudget(category, yearMonth)   → boolean
   */
  var BudgetService = {
    /**
     * Returns the budget amount stored for the given category.
     * Returns Infinity if the category has no stored budget or if the read fails.
     *
     * @param {string} category
     * @returns {number} stored budget or Infinity
     */
    get: function (category) {
      var budgets = StorageService.read('ebv_budgets');
      if (!budgets || typeof budgets !== 'object' || budgets === null) {
        return Infinity;
      }
      var value = budgets[category];
      if (typeof value !== 'number') {
        return Infinity;
      }
      return value;
    },

    /**
     * Returns the entire budget map as a plain object.
     * Returns {} if the read fails or the stored value is not an object.
     *
     * @returns {Record<string, number>}
     */
    getAll: function () {
      var budgets = StorageService.read('ebv_budgets');
      if (!budgets || typeof budgets !== 'object' || Array.isArray(budgets)) {
        return {};
      }
      return budgets;
    },

    /**
     * Validates and sets the budget for the given category.
     * Validation: numeric, > 0, ≤ 999999999.99.
     * No-op if the stored value is already identical to amount.
     * Throws ValidationError on invalid input.
     * Throws StorageError if write fails.
     *
     * @param {string} category
     * @param {number} amount
     * @returns {void}
     * @throws {ValidationError}
     * @throws {StorageError}
     */
    set: function (category, amount) {
      // Validate: must be numeric
      if (typeof amount === 'boolean' || isNaN(amount) || typeof amount !== 'number') {
        throw new ValidationError('Budget amount must be a valid number.');
      }
      // Validate: must be > 0
      if (amount <= 0) {
        throw new ValidationError('Budget amount must be greater than 0.');
      }
      // Validate: must be ≤ 999999999.99
      if (amount > 999999999.99) {
        throw new ValidationError('Budget amount cannot exceed 999,999,999.99.');
      }

      // Read current budgets
      var budgets = StorageService.read('ebv_budgets');
      if (!budgets || typeof budgets !== 'object' || Array.isArray(budgets)) {
        budgets = {};
      }

      // No-op if value is identical to stored value
      if (budgets[category] === amount) {
        return;
      }

      // Write updated budget map
      budgets[category] = amount;
      StorageService.write('ebv_budgets', budgets);
    },

    /**
     * Returns true if the total spending for the given category in yearMonth
     * exceeds the stored budget. Returns false if budget is unset (Infinity).
     *
     * @param {string} category
     * @param {string} yearMonth - "YYYY-MM" format
     * @returns {boolean}
     */
    isOverBudget: function (category, yearMonth) {
      var expenses = ExpenseService.getByMonth(yearMonth);
      var total = 0;
      for (var i = 0; i < expenses.length; i++) {
        if (expenses[i].category === category) {
          total += expenses[i].amount;
        }
      }
      var budget = BudgetService.get(category);
      // Infinity means no budget set — never over-budget
      if (!isFinite(budget)) {
        return false;
      }
      return total > budget;
    }
  };

  // === ChartService ===
  var CHART_COLORS = ['#4f46e5','#06b6d4','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#f97316'];

  var ChartService = {
    drawPieChart: function (container, data) {
      container.innerHTML = '';
      var total = data.reduce(function (s, d) { return s + d.value; }, 0);
      if (!data.length || total === 0) {
        var empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = 'No expenses this month.';
        container.appendChild(empty);
        return;
      }
      var ns = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', 'Spending by category');
      var cx = 50, cy = 50, r = 38;
      var startAngle = -Math.PI / 2;
      data.forEach(function (seg, i) {
        var slice = (seg.value / total) * 2 * Math.PI;
        var endAngle = startAngle + slice;
        var x1 = cx + r * Math.cos(startAngle);
        var y1 = cy + r * Math.sin(startAngle);
        var x2 = cx + r * Math.cos(endAngle);
        var y2 = cy + r * Math.sin(endAngle);
        var large = slice > Math.PI ? 1 : 0;
        var path = document.createElementNS(ns, 'path');
        var d = 'M ' + cx + ' ' + cy +
                ' L ' + x1 + ' ' + y1 +
                ' A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x2 + ' ' + y2 + ' Z';
        path.setAttribute('d', d);
        path.setAttribute('fill', CHART_COLORS[i % CHART_COLORS.length]);
        path.setAttribute('data-label', seg.label);
        path.setAttribute('data-value', seg.value.toFixed(2));
        svg.appendChild(path);
        startAngle = endAngle;
      });
      container.appendChild(svg);
      // Legend
      var legend = document.createElement('div');
      legend.className = 'chart-legend';
      data.forEach(function (seg, i) {
        var item = document.createElement('div');
        item.className = 'chart-legend-item';
        var swatch = document.createElement('span');
        swatch.className = 'chart-legend-swatch';
        swatch.style.backgroundColor = CHART_COLORS[i % CHART_COLORS.length];
        var label = document.createElement('span');
        label.textContent = seg.label + ' (' + seg.value.toFixed(2) + ')';
        item.appendChild(swatch);
        item.appendChild(label);
        legend.appendChild(item);
      });
      container.appendChild(legend);
      ChartService.attachTooltips(container);
    },

    drawBarChart: function (container, data) {
      container.innerHTML = '';
      // data: array of {label, value} for last 6 months
      var ns = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(ns, 'svg');
      var W = 300, H = 160, padL = 10, padB = 30, padT = 10, padR = 10;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', 'Spending over last 6 months');
      var maxVal = Math.max.apply(null, data.map(function (d) { return d.value; }));
      if (maxVal === 0) maxVal = 1;
      var barW = (W - padL - padR) / data.length;
      data.forEach(function (seg, i) {
        var barH = Math.max(1, ((seg.value / maxVal) * (H - padT - padB)));
        var x = padL + i * barW + barW * 0.1;
        var y = H - padB - barH;
        var rect = document.createElementNS(ns, 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', barW * 0.8);
        rect.setAttribute('height', barH);
        rect.setAttribute('fill', CHART_COLORS[i % CHART_COLORS.length]);
        rect.setAttribute('data-label', seg.label);
        rect.setAttribute('data-value', seg.value.toFixed(2));
        svg.appendChild(rect);
        // Month label
        var text = document.createElementNS(ns, 'text');
        text.setAttribute('x', padL + i * barW + barW / 2);
        text.setAttribute('y', H - padB + 14);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '9');
        text.setAttribute('fill', 'currentColor');
        text.textContent = seg.label;
        svg.appendChild(text);
      });
      container.appendChild(svg);
      ChartService.attachTooltips(container);
    },

    attachTooltips: function (container) {
      var targets = container.querySelectorAll('[data-label][data-value]');
      targets.forEach(function (el) {
        el.addEventListener('mouseover', function (e) {
          var tip = document.getElementById('chart-tooltip');
          if (!tip) {
            tip = document.createElement('div');
            tip.id = 'chart-tooltip';
            document.body.appendChild(tip);
          }
          tip.textContent = el.getAttribute('data-label') + ': ' + el.getAttribute('data-value');
          tip.style.display = 'block';
          tip.style.left = (e.pageX + 12) + 'px';
          tip.style.top = (e.pageY - 28) + 'px';
        });
        el.addEventListener('mousemove', function (e) {
          var tip = document.getElementById('chart-tooltip');
          if (tip) {
            tip.style.left = (e.pageX + 12) + 'px';
            tip.style.top = (e.pageY - 28) + 'px';
          }
        });
        el.addEventListener('mouseout', function () {
          var tip = document.getElementById('chart-tooltip');
          if (tip) tip.style.display = 'none';
        });
      });
    }
  };

  // === ThemeController ===
  var ThemeController = {
    apply: function (theme) {
      if (theme !== 'light' && theme !== 'dark') return;
      document.documentElement.setAttribute('data-theme', theme);
      var btn = document.getElementById('theme-toggle-btn');
      if (btn) {
        btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
        btn.textContent = theme === 'dark' ? '☀️' : '🌙';
      }
    },
    toggle: function () {
      var current = document.documentElement.getAttribute('data-theme') || 'light';
      var next = current === 'light' ? 'dark' : 'light';
      ThemeController.apply(next);
      try { StorageService.write('ebv_theme', next); } catch (e) { /* silent */ }
    },
    loadInitial: function () {
      var stored = StorageService.read('ebv_theme');
      if (stored === 'light' || stored === 'dark') {
        ThemeController.apply(stored);
        return;
      }
      var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      ThemeController.apply(prefersDark ? 'dark' : 'light');
    }
  };

  // === UI Render Functions ===

  function showErrorBanner(msg) {
    hideErrorBanner();
    var banner = document.createElement('div');
    banner.id = 'error-banner';
    banner.setAttribute('role', 'alert');
    var msgEl = document.createElement('span');
    msgEl.className = 'error-banner-message';
    msgEl.textContent = msg;
    banner.appendChild(msgEl);
    document.body.insertBefore(banner, document.body.firstChild);
  }

  function hideErrorBanner() {
    var el = document.getElementById('error-banner');
    if (el) el.parentNode.removeChild(el);
  }

  function getCurrentYearMonth() {
    var now = new Date();
    var y = now.getFullYear();
    var m = String(now.getMonth() + 1).padStart(2, '0');
    return y + '-' + m;
  }

  function formatYearMonth(ym) {
    var parts = ym.split('-');
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
  }

  function renderNavBar(activeView, theme) {
    var header = document.getElementById('app-header');
    var nav = document.getElementById('app-nav');
    if (!header || !nav) return;

    header.innerHTML = '';
    var title = document.createElement('span');
    title.className = 'header-title';
    title.textContent = '💰 Expense & Budget Visualizer';
    var themeBtn = document.createElement('button');
    themeBtn.id = 'theme-toggle-btn';
    themeBtn.className = 'btn-theme-toggle';
    var currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    themeBtn.setAttribute('aria-label', currentTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    themeBtn.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
    themeBtn.addEventListener('click', function () { ThemeController.toggle(); });
    header.appendChild(title);
    header.appendChild(themeBtn);

    nav.innerHTML = '';
    var views = [
      { id: 'expenses', label: '📝 Expenses' },
      { id: 'budgets',  label: '💼 Budgets' },
      { id: 'categories', label: '🏷️ Categories' },
      { id: 'summary', label: '📊 Summary' }
    ];
    views.forEach(function (v) {
      var btn = document.createElement('button');
      btn.className = 'nav-link';
      btn.textContent = v.label;
      if (v.id === activeView) btn.setAttribute('aria-current', 'page');
      btn.addEventListener('click', function () {
        AppController.state.activeView = v.id;
        AppController.refreshAll();
      });
      nav.appendChild(btn);
    });
  }

  function renderExpenseForm(expense) {
    var main = document.getElementById('app-main');
    var categories = CategoryService.getAll();
    var isEdit = !!expense;

    var html = '<div class="card mb-4">' +
      '<h2 class="section-title">' + (isEdit ? 'Edit Expense' : 'Add Expense') + '</h2>' +
      '<form id="expense-form" class="form">' +
        '<div class="form-row form-row-2">' +
          '<div class="field">' +
            '<label class="field-label" for="exp-title">Title <span class="required-mark">*</span></label>' +
            '<input id="exp-title" class="field-input" type="text" maxlength="100" aria-required="true" placeholder="e.g. Lunch" value="' + (isEdit ? escHtml(expense.title) : '') + '">' +
            '<span class="field-error" id="err-title"></span>' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label" for="exp-amount">Amount <span class="required-mark">*</span></label>' +
            '<input id="exp-amount" class="field-input" type="number" step="0.01" min="0.01" max="999999.99" aria-required="true" placeholder="0.00" value="' + (isEdit ? expense.amount : '') + '">' +
            '<span class="field-error" id="err-amount"></span>' +
          '</div>' +
        '</div>' +
        '<div class="form-row form-row-2">' +
          '<div class="field">' +
            '<label class="field-label" for="exp-date">Date <span class="required-mark">*</span></label>' +
            '<input id="exp-date" class="field-input" type="date" aria-required="true" max="' + getCurrentYearMonth().slice(0,7) + '-31" value="' + (isEdit ? expense.date : new Date().toISOString().slice(0,10)) + '">' +
            '<span class="field-error" id="err-date"></span>' +
          '</div>' +
          '<div class="field">' +
            '<label class="field-label" for="exp-category">Category <span class="required-mark">*</span></label>' +
            '<select id="exp-category" class="field-input" aria-required="true">' +
              categories.map(function (c) {
                return '<option value="' + escHtml(c) + '"' + (isEdit && expense.category === c ? ' selected' : '') + '>' + escHtml(c) + '</option>';
              }).join('') +
            '</select>' +
            '<span class="field-error" id="err-category"></span>' +
          '</div>' +
        '</div>' +
        '<div class="form-actions">' +
          (isEdit ? '<button type="button" class="btn btn-secondary" id="cancel-edit-btn">Cancel</button>' : '') +
          '<button type="submit" class="btn btn-primary">' + (isEdit ? 'Update Expense' : 'Add Expense') + '</button>' +
        '</div>' +
      '</form>' +
    '</div>';

    var section = document.getElementById('expense-form-section');
    if (!section) {
      section = document.createElement('div');
      section.id = 'expense-form-section';
      main.insertBefore(section, main.firstChild);
    }
    section.innerHTML = html;

    document.getElementById('expense-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var fields = {
        title: document.getElementById('exp-title').value,
        amount: document.getElementById('exp-amount').value,
        date: document.getElementById('exp-date').value,
        category: document.getElementById('exp-category').value
      };
      try {
        if (AppController.state.editingExpenseId) {
          ExpenseService.update(AppController.state.editingExpenseId, fields);
        } else {
          ExpenseService.add(fields);
        }
        AppController.state.editingExpenseId = null;
        AppController.refreshAll();
      } catch (err) {
        if (err.name === 'ValidationError') {
          document.getElementById('err-title').textContent = err.message;
        } else {
          showErrorBanner(err.message);
        }
      }
    });

    var cancelBtn = document.getElementById('cancel-edit-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        AppController.state.editingExpenseId = null;
        AppController.refreshAll();
      });
    }

    var titleInput = document.getElementById('exp-title');
    if (titleInput) titleInput.focus();
  }

  function renderTransactionList(expenses) {
    var section = document.getElementById('transaction-section');
    if (!section) return;

    if (!expenses.length) {
      section.innerHTML = '<div class="card"><h2 class="section-title">Transactions</h2><p class="empty-state">No expenses yet. Add one above!</p></div>';
      return;
    }

    var rows = expenses.map(function (e) {
      return '<li class="transaction-item">' +
        '<span class="transaction-date">' + e.date + '</span>' +
        '<div>' +
          '<div class="transaction-title">' + escHtml(e.title) + '</div>' +
          '<div class="transaction-category text-muted text-sm">' + escHtml(e.category) + '</div>' +
        '</div>' +
        '<span class="transaction-amount">$' + Number(e.amount).toFixed(2) + '</span>' +
        '<div class="transaction-actions">' +
          '<button class="btn btn-ghost btn-sm" data-edit="' + escHtml(e.id) + '" aria-label="Edit ' + escHtml(e.title) + '">✏️</button>' +
          '<button class="btn btn-ghost btn-sm" data-delete="' + escHtml(e.id) + '" aria-label="Delete ' + escHtml(e.title) + '">🗑️</button>' +
        '</div>' +
      '</li>';
    }).join('');

    section.innerHTML = '<div class="card"><h2 class="section-title">Transactions</h2><ul class="transaction-list" aria-live="polite">' + rows + '</ul></div>';

    section.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-edit');
        AppController.state.editingExpenseId = id;
        AppController.refreshAll();
      });
    });
    section.querySelectorAll('[data-delete]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-delete');
        if (!window.confirm('Delete this expense?')) return;
        try {
          ExpenseService.delete(id);
          AppController.refreshAll();
        } catch (err) {
          showErrorBanner(err.message);
        }
      });
    });
  }

  function renderBudgetPanel(categories, budgets, expenses, yearMonth) {
    var main = document.getElementById('app-main');
    main.innerHTML = '';

    var rows = categories.map(function (cat) {
      var over = BudgetService.isOverBudget(cat, yearMonth);
      var budget = budgets[cat] || '';
      return '<div class="budget-row">' +
        '<span class="budget-category-name">' + escHtml(cat) + '</span>' +
        '<div class="budget-input-group">' +
          '<input class="field-input budget-input" type="number" step="0.01" min="0.01" ' +
            'data-cat="' + escHtml(cat) + '" value="' + budget + '" placeholder="No limit" aria-label="Budget for ' + escHtml(cat) + '">' +
          '<button class="btn btn-primary btn-sm" data-save-cat="' + escHtml(cat) + '">Save</button>' +
        '</div>' +
        (over ? '<span class="over-budget-icon" aria-label="Over budget">⚠️</span>' : '<span></span>') +
      '</div>';
    }).join('');

    main.innerHTML = '<div class="card"><h2 class="section-title">Budgets — ' + formatYearMonth(yearMonth) + '</h2>' +
      '<div id="budget-error" class="field-error"></div>' +
      rows + '</div>';

    main.querySelectorAll('[data-save-cat]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cat = btn.getAttribute('data-save-cat');
        var input = main.querySelector('[data-cat="' + cat + '"]');
        var errEl = document.getElementById('budget-error');
        try {
          BudgetService.set(cat, parseFloat(input.value));
          AppController.refreshAll();
        } catch (err) {
          errEl.textContent = err.message;
        }
      });
    });
  }

  function renderCategoryManager(categories) {
    var main = document.getElementById('app-main');
    main.innerHTML = '';

    var defaultCats = CategoryService.DEFAULT_CATEGORIES;
    var customCats = categories.filter(function (c) { return defaultCats.indexOf(c) === -1; });

    var defaultItems = defaultCats.map(function (c) {
      return '<div class="category-item is-default"><span>' + escHtml(c) + '</span><small class="text-muted">default</small></div>';
    }).join('');

    var customItems = customCats.map(function (c) {
      return '<div class="category-item">' +
        '<span>' + escHtml(c) + '</span>' +
        '<button class="btn btn-danger btn-sm" data-del-cat="' + escHtml(c) + '" aria-label="Delete ' + escHtml(c) + '">Delete</button>' +
      '</div>';
    }).join('');

    main.innerHTML = '<div class="card">' +
      '<h2 class="section-title">Categories</h2>' +
      '<div class="category-list">' + defaultItems + customItems + '</div>' +
      '<div class="add-category-form">' +
        '<input id="new-cat-input" class="field-input" type="text" maxlength="50" placeholder="New category name" aria-label="New category name">' +
        '<button id="add-cat-btn" class="btn btn-primary">Add</button>' +
      '</div>' +
      '<span class="field-error" id="cat-error"></span>' +
    '</div>';

    main.querySelectorAll('[data-del-cat]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cat = btn.getAttribute('data-del-cat');
        var affected = CategoryService.getAffectedExpenses(cat);
        var msg = affected.length
          ? 'Delete "' + cat + '"? ' + affected.length + ' expense(s) will be reassigned to "Other".'
          : 'Delete category "' + cat + '"?';
        if (!window.confirm(msg)) return;
        try {
          CategoryService.delete(cat);
          AppController.refreshAll();
        } catch (err) {
          showErrorBanner(err.message);
        }
      });
    });

    document.getElementById('add-cat-btn').addEventListener('click', function () {
      var input = document.getElementById('new-cat-input');
      var errEl = document.getElementById('cat-error');
      try {
        CategoryService.add(input.value);
        input.value = '';
        errEl.textContent = '';
        AppController.refreshAll();
      } catch (err) {
        errEl.textContent = err.message;
      }
    });
  }

  function renderSummaryView(expenses, budgets, yearMonth) {
    var main = document.getElementById('app-main');
    main.innerHTML = '';

    var currentYM = getCurrentYearMonth();
    var isCurrentMonth = yearMonth === currentYM;

    // Month navigation
    var prevYM = (function () {
      var parts = yearMonth.split('-');
      var y = parseInt(parts[0], 10);
      var m = parseInt(parts[1], 10) - 1;
      if (m === 0) { m = 12; y -= 1; }
      return y + '-' + String(m).padStart(2, '0');
    })();
    var nextYM = (function () {
      var parts = yearMonth.split('-');
      var y = parseInt(parts[0], 10);
      var m = parseInt(parts[1], 10) + 1;
      if (m === 13) { m = 1; y += 1; }
      return y + '-' + String(m).padStart(2, '0');
    })();

    var monthFiltered = ExpenseService.getByMonth(yearMonth);
    var categories = CategoryService.getAll();

    // Group by category
    var byCategory = {};
    monthFiltered.forEach(function (e) {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    });

    var tableRows = categories.filter(function (cat) {
      return byCategory[cat] !== undefined || budgets[cat];
    }).map(function (cat) {
      var spent = byCategory[cat] || 0;
      var budget = BudgetService.get(cat);
      var remaining = isFinite(budget) ? budget - spent : null;
      var over = isFinite(budget) && spent > budget;
      var zeroOver = budget === 0 && spent > 0;
      var rowClass = (over || zeroOver) ? ' class="over-budget-row"' : '';
      return '<tr' + rowClass + '>' +
        '<td>' + escHtml(cat) + (over || zeroOver ? ' <span class="over-budget-icon" aria-label="Over budget">⚠️</span>' : '') + '</td>' +
        '<td>$' + spent.toFixed(2) + '</td>' +
        '<td>' + (isFinite(budget) ? '$' + budget.toFixed(2) : '—') + '</td>' +
        '<td' + (remaining !== null && remaining < 0 ? ' class="summary-amount-negative"' : '') + '>' +
          (remaining !== null ? '$' + remaining.toFixed(2) : '—') +
        '</td>' +
      '</tr>';
    }).join('');

    var noExpenses = monthFiltered.length === 0;

    main.innerHTML = '<div class="card">' +
      '<h2 class="section-title">Summary</h2>' +
      '<div class="month-nav">' +
        '<button class="btn btn-secondary btn-sm" id="prev-month-btn" aria-label="Previous month">‹</button>' +
        '<time>' + formatYearMonth(yearMonth) + '</time>' +
        '<button class="btn btn-secondary btn-sm" id="next-month-btn"' + (isCurrentMonth ? ' disabled aria-disabled="true"' : '') + ' aria-label="Next month">›</button>' +
      '</div>' +
      (noExpenses
        ? '<p class="empty-state">No expenses for this period.</p>'
        : '<table class="summary-table" aria-live="polite"><thead><tr><th>Category</th><th>Spent</th><th>Budget</th><th>Remaining</th></tr></thead><tbody>' + tableRows + '</tbody></table>'
      ) +
    '</div>';

    document.getElementById('prev-month-btn').addEventListener('click', function () {
      AppController.state.selectedMonth = prevYM;
      AppController.refreshAll();
    });
    document.getElementById('next-month-btn').addEventListener('click', function () {
      if (!isCurrentMonth) {
        AppController.state.selectedMonth = nextYM;
        AppController.refreshAll();
      }
    });
  }

  function renderCharts(expenses, yearMonth) {
    var main = document.getElementById('app-main');
    // Build pie data from current month
    var monthExp = ExpenseService.getByMonth(yearMonth);
    var pieMap = {};
    monthExp.forEach(function (e) {
      pieMap[e.category] = (pieMap[e.category] || 0) + e.amount;
    });
    var pieData = Object.keys(pieMap).map(function (k) { return { label: k, value: pieMap[k] }; });

    // Build bar data: last 6 months
    var barData = [];
    for (var i = 5; i >= 0; i--) {
      var d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      var ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      var monthTotal = ExpenseService.getByMonth(ym).reduce(function (s, e) { return s + e.amount; }, 0);
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      barData.push({ label: months[d.getMonth()], value: monthTotal });
    }

    var panel = document.createElement('div');
    panel.className = 'chart-panel mt-4';
    var pieContainer = document.createElement('div');
    pieContainer.className = 'chart-container';
    var barContainer = document.createElement('div');
    barContainer.className = 'chart-container';
    panel.appendChild(pieContainer);
    panel.appendChild(barContainer);
    main.appendChild(panel);

    ChartService.drawPieChart(pieContainer, pieData);
    ChartService.drawBarChart(barContainer, barData);
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // === AppController ===
  var AppController = {
    state: {
      expenses: [],
      budgets: {},
      customCategories: [],
      selectedMonth: getCurrentYearMonth(),
      activeView: 'expenses',
      editingExpenseId: null
    },

    init: function () {
      ThemeController.loadInitial();

      if (!StorageService.isAvailable()) {
        showErrorBanner('localStorage is unavailable. Data cannot be saved.');
      }

      // Load state from storage
      var expenses = StorageService.read('ebv_expenses');
      AppController.state.expenses = Array.isArray(expenses) ? expenses : [];
      var budgets = StorageService.read('ebv_budgets');
      AppController.state.budgets = (budgets && typeof budgets === 'object' && !Array.isArray(budgets)) ? budgets : {};
      var cats = StorageService.read('ebv_categories');
      AppController.state.customCategories = Array.isArray(cats) ? cats : [];

      AppController.refreshAll();
    },

    refreshAll: function () {
      var state = AppController.state;
      var main = document.getElementById('app-main');

      renderNavBar(state.activeView, document.documentElement.getAttribute('data-theme'));

      if (state.activeView === 'expenses') {
        main.innerHTML = '';
        // Form section placeholder
        var formSection = document.createElement('div');
        formSection.id = 'expense-form-section';
        main.appendChild(formSection);
        var txSection = document.createElement('div');
        txSection.id = 'transaction-section';
        main.appendChild(txSection);

        var editExpense = state.editingExpenseId
          ? ExpenseService.getAll().find(function (e) { return e.id === state.editingExpenseId; })
          : null;
        renderExpenseForm(editExpense || undefined);
        renderTransactionList(ExpenseService.getAll());
        renderCharts(state.expenses, state.selectedMonth);
      } else if (state.activeView === 'budgets') {
        renderBudgetPanel(CategoryService.getAll(), BudgetService.getAll(), state.expenses, state.selectedMonth);
      } else if (state.activeView === 'categories') {
        renderCategoryManager(CategoryService.getAll());
      } else if (state.activeView === 'summary') {
        renderSummaryView(state.expenses, BudgetService.getAll(), state.selectedMonth);
      }
    },

    refreshCharts: function () {
      renderCharts(AppController.state.expenses, AppController.state.selectedMonth);
    },

    showError: function (msg) { showErrorBanner(msg); },
    clearError: function () { hideErrorBanner(); }
  };

  // === Expose Globals for Testing ===
  // These globals allow browser-based Jasmine specs to access the services
  // without a module bundler. They are set inside the IIFE so the rest of
  // the application still has a clean global scope in production use.
  window.StorageService    = StorageService;
  window.StorageError      = StorageError;
  window.ValidationError   = ValidationError;
  window.CategoryService   = CategoryService;
  window.ExpenseService    = ExpenseService;
  window.BudgetService     = BudgetService;
  window.ChartService      = ChartService;
  window.ThemeController   = ThemeController;
  window.AppController     = AppController;

  // === Bootstrap ===
  /**
   * Bootstrap
   * Entry point — waits for the DOM to be fully parsed, then delegates
   * control to AppController.init() which loads persisted state, renders
   * the initial UI, and attaches all event listeners.
   */
  document.addEventListener('DOMContentLoaded', function () {
    if (typeof AppController.init === 'function') {
      AppController.init();
    }
  });

})();
