# Implementation Plan: Expense & Budget Visualizer

## Overview

Implementation plan for the Expense & Budget Visualizer — a pure client-side SPA (HTML + CSS + Vanilla JS, no frameworks, no build tools). All persistence via `localStorage`. Tests run in the browser via Jasmine + fast-check.

## Notes

- Pure client-side SPA: HTML + CSS + Vanilla JS, no frameworks, no build tools
- Single JS file (`js/app.js`), single CSS file (`css/style.css`), entry point `index.html`
- All persistence via `localStorage`; tests run in the browser via Jasmine + fast-check (no Node required)
- All 17 correctness properties (P1–P17) defined in design.md must each have a corresponding property-based test
- Property-based tests run minimum 100 iterations each using fast-check
- Mock `StorageService` at the boundary for all service unit tests to isolate from real `localStorage`

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2"] },
    { "wave": 3, "tasks": ["3", "4"] },
    { "wave": 4, "tasks": ["5"] },
    { "wave": 5, "tasks": ["6", "7"] },
    { "wave": 6, "tasks": ["8"] },
    { "wave": 7, "tasks": ["9"] },
    { "wave": 8, "tasks": ["10"] },
    { "wave": 9, "tasks": ["11"] }
  ]
}
```

## Tasks

### Phase 1: Project Scaffolding

- [x] 1. Create project directory structure and entry point files
  - [x] 1.1 Create `index.html` with semantic HTML shell: `<html lang="en">`, `<head>` with charset/viewport/title, a `<link>` to `css/style.css`, a `<script defer>` to `js/app.js`, `data-theme="light"` attribute on `<html>`, and placeholder landmark regions (`<header>`, `<main>`, `<nav>`, `<footer>`)
  - [x] 1.2 Create `css/style.css` with CSS custom properties for light/dark themes (`--color-bg`, `--color-surface`, `--color-text`, `--color-primary`, `--color-danger`, `--color-warning`), base reset/normalize rules, and responsive layout scaffolding (flexbox/grid, `min-width: 320px`)
  - [x] 1.3 Create `js/app.js` as a single IIFE with clearly commented section headers for each module: `// === StorageService ===`, `// === CategoryService ===`, `// === ExpenseService ===`, `// === BudgetService ===`, `// === ChartService ===`, `// === ThemeController ===`, `// === AppController ===`, `// === UI Render Functions ===`, `// === Bootstrap ===`
  - [x] 1.4 Create `test/runner.html` that loads Jasmine (CDN), fast-check (CDN), all spec files via `<script>` tags, and a `<div id="jasmine-reporter">` for output
  - [x] 1.5 Create empty spec files: `test/specs/storageService.spec.js`, `test/specs/expenseService.spec.js`, `test/specs/budgetService.spec.js`, `test/specs/categoryService.spec.js`, `test/specs/chartService.spec.js`, `test/specs/themeController.spec.js`, `test/specs/appController.spec.js`, `test/specs/summaryView.spec.js`

---

### Phase 2: StorageService

- [x] 2. Implement `StorageService` in `js/app.js`
  - [x] 2.1 Implement `StorageService.isAvailable()` — attempts a test write/read/delete of a sentinel key; returns `true` if all succeed, `false` otherwise
  - [x] 2.2 Implement `StorageService.read(key)` — wraps `localStorage.getItem` + `JSON.parse`; returns the parsed object/array on success, `null` on any error (missing key, parse failure, or thrown exception)
  - [x] 2.3 Implement `StorageService.write(key, value)` — wraps `JSON.stringify` + `localStorage.setItem`; returns `true` on success; throws a `StorageError` with a predefined user-safe message on any failure (quota exceeded, security error, etc.)
  - [x] 2.4 Implement `StorageService.remove(key)` — wraps `localStorage.removeItem`; silently swallows any thrown exception
  - [x] 2.5 Define the custom `StorageError` and `ValidationError` error classes (extend `Error`, set `this.name`)
  - [x] 2.6 Write unit tests in `test/specs/storageService.spec.js` covering: `isAvailable()` returns boolean, `read()` returns null for missing/corrupt keys, `write()` round-trip (write then read equals original), `write()` throws `StorageError` when storage is full (mock `localStorage.setItem` to throw), `remove()` deletes the key
  - [x] 2.7 Write property-based test **P14 (Storage Round-Trip)** in `test/specs/storageService.spec.js`:
    - Tag: `// Feature: expense-budget-visualizer, Property 14: Storage round-trip preserves all data`
    - Arbitrary: `fc.record({ expenses: fc.array(expenseArb), budgets: fc.dictionary(fc.string(), fc.float({min:0.01})), customCategories: fc.array(fc.string({minLength:1,maxLength:50})) })`
    - Assert: `StorageService.write(key, state)` followed by `StorageService.read(key)` produces a deep-equal result
    - Runs: 100 iterations
    - **Validates: Requirements 7.1, 7.2**

---

### Phase 3: CategoryService

- [x] 3. Implement `CategoryService` in `js/app.js`
  - [x] 3.1 Define `CategoryService.DEFAULT_CATEGORIES` as a frozen array: `["Food", "Transport", "Housing", "Health", "Entertainment", "Other"]`
  - [x] 3.2 Implement `CategoryService.getAll()` — reads custom categories from `StorageService` using key `ebv_categories`; returns `DEFAULT_CATEGORIES` concatenated with the custom list; returns only defaults if read fails or returns null
  - [x] 3.3 Implement `CategoryService.add(name)` — trims whitespace; validates: non-empty, ≤ 50 chars, not a case-insensitive duplicate of any existing category; on valid input writes the updated array to `ebv_categories`; throws `ValidationError` with a specific message on any validation failure
  - [x] 3.4 Implement `CategoryService.delete(name)` — reads all expenses (`ebv_expenses`), reassigns any expense whose `category` matches `name` to `"Other"`, writes updated expenses back to `ebv_expenses`, then removes `name` from the custom category array and writes to `ebv_categories`; throws `StorageError` if any write fails
  - [x] 3.5 Implement `CategoryService.getAffectedExpenses(name)` — returns the array of expenses whose `category` equals `name` (exact match, case-sensitive against stored value)
  - [x] 3.6 Write unit tests in `test/specs/categoryService.spec.js` covering: default categories present, `add()` happy path, `add()` throws on empty/long/duplicate name, `delete()` reassigns expenses, `getAffectedExpenses()` returns correct subset
  - [x] 3.7 Write property-based test **P6 (Valid Category Add Round-Trip)** in `test/specs/categoryService.spec.js`:
    - Tag: `// Feature: expense-budget-visualizer, Property 6: Valid custom category add round-trip`
    - Arbitrary: unique string 1–50 chars that is not in the current list
    - Assert: after `CategoryService.add(name)`, `CategoryService.getAll()` includes `name` and `StorageService.read("ebv_categories")` includes `name`
    - Runs: 100 iterations
    - **Validates: Requirements 3.2**
  - [x] 3.8 Write property-based test **P7 (Invalid or Duplicate Category Name Is Rejected)** in `test/specs/categoryService.spec.js`:
    - Tag: `// Feature: expense-budget-visualizer, Property 7: Invalid or duplicate category name is rejected`
    - Arbitrary: `fc.oneof(fc.constant(""), fc.string({minLength:51}), fc.constantFrom(...existingCategories))`
    - Assert: `CategoryService.add(name)` throws `ValidationError` and `CategoryService.getAll()` is identical before and after
    - Runs: 100 iterations
    - **Validates: Requirements 3.3**
  - [x] 3.9 Write property-based test **P8 (Category Delete Reassigns Expenses)** in `test/specs/categoryService.spec.js`:
    - Tag: `// Feature: expense-budget-visualizer, Property 8: Custom category deletion reassigns all affected expenses to Other`
    - Arbitrary: a custom category name + array of expenses (minLength 1) all assigned to that category
    - Assert: after `CategoryService.delete(name)`, every previously-affected expense has `category === "Other"` in storage and in-memory, and `name` is absent from `CategoryService.getAll()`
    - Runs: 100 iterations
    - **Validates: Requirements 3.4, 3.6**

---

### Phase 4: ExpenseService

- [x] 4. Implement `ExpenseService` in `js/app.js`
  - [x] 4.1 Implement a private `validateExpenseFields(fields)` helper — validates: `title` is non-empty and ≤ 100 chars; `amount` is numeric, between 0.01 and 999999.99 inclusive, at most 2 decimal places; `date` is a valid date string not in the future; `category` is in `CategoryService.getAll()`; throws `ValidationError` with a per-field message on first failure
  - [x] 4.2 Implement `ExpenseService.add(fields)` — calls `validateExpenseFields`, generates a unique `id` (`crypto.randomUUID()` with `Date.now().toString()` fallback), writes updated expenses array to `ebv_expenses` via `StorageService.write`; returns the saved `Expense` object; throws `ValidationError` or `StorageError` without mutating state on failure
  - [x] 4.3 Implement `ExpenseService.update(id, fields)` — reads expenses, finds by `id` (throws `ValidationError` if not found), calls `validateExpenseFields`, merges fields, writes; returns updated `Expense`; rolls back on `StorageError`
  - [x] 4.4 Implement `ExpenseService.delete(id)` — reads expenses, filters out the target id, writes; throws `StorageError` on write failure (does not mutate if write fails)
  - [x] 4.5 Implement `ExpenseService.getAll()` — reads `ebv_expenses`; returns array sorted by `date` descending (then by `id` descending as tiebreaker); returns `[]` if read returns null
  - [x] 4.6 Implement `ExpenseService.getByMonth(yearMonth)` — returns `getAll()` filtered to records where `date.startsWith(yearMonth)`
  - [x] 4.7 Write unit tests in `test/specs/expenseService.spec.js` covering: `add()` happy path, `add()` rejects future date, `add()` rejects amount out of range, `update()` changes only target, `delete()` removes only target, `getAll()` returns `[]` on empty storage, `getByMonth()` filters correctly
  - [x] 4.8 Write property-based test **P1 (Valid Expense Add Round-Trip)** in `test/specs/expenseService.spec.js`:
    - Tag: `// Feature: expense-budget-visualizer, Property 1: Valid expense add round-trip`
    - Arbitrary: `fc.record({ title: fc.string({minLength:1,maxLength:100}), amount: validAmountArb, date: fc.date({max: new Date()}).map(d => d.toISOString().slice(0,10)), category: fc.constantFrom(...DEFAULT_CATEGORIES) })`
    - Assert: after `ExpenseService.add(fields)`, `ExpenseService.getAll()` contains an entry with all fields equal to input, and `StorageService.read("ebv_expenses")` also contains it
    - Runs: 100 iterations
    - **Validates: Requirements 1.2**
  - [x] 4.9 Write property-based test **P2 (Invalid Expense Input Is Rejected Without Side Effects)** in `test/specs/expenseService.spec.js`:
    - Tag: `// Feature: expense-budget-visualizer, Property 2: Invalid expense input is rejected without side effects`
    - Arbitrary: `fc.oneof(emptyTitleArb, invalidAmountArb, futureDateArb, emptyCategoryArb)`
    - Assert: `ExpenseService.add(fields)` throws `ValidationError`, and expense list count is unchanged
    - Runs: 100 iterations
    - **Validates: Requirements 1.3, 1.4**
  - [x] 4.10 Write property-based test **P3 (Expense List Is Always Sorted Date-Descending)** in `test/specs/expenseService.spec.js`:
    - Tag: `// Feature: expense-budget-visualizer, Property 3: Expense list is always sorted date-descending`
    - Arbitrary: `fc.array(expenseArb, {minLength:1, maxLength:20})`
    - Assert: after seeding storage with the array, `ExpenseService.getAll()` returns them in non-increasing date order for all adjacent pairs
    - Runs: 100 iterations
    - **Validates: Requirements 2.1**
  - [x] 4.11 Write property-based test **P4 (Valid Expense Update Persists Correctly)** in `test/specs/expenseService.spec.js`:
    - Tag: `// Feature: expense-budget-visualizer, Property 4: Valid expense update persists correctly`
    - Arbitrary: existing expense id + valid update fields; other expenses unchanged
    - Assert: `ExpenseService.update(id, fields)` causes `getAll()` and storage to reflect new fields for that id; all other expense ids/fields are untouched
    - Runs: 100 iterations
    - **Validates: Requirements 2.3**
  - [x] 4.12 Write property-based test **P5 (Expense Deletion Removes Exactly the Target)** in `test/specs/expenseService.spec.js`:
    - Tag: `// Feature: expense-budget-visualizer, Property 5: Expense deletion removes exactly the target`
    - Arbitrary: `fc.array(expenseArb, {minLength:1, maxLength:20})` + pick one id to delete
    - Assert: after `ExpenseService.delete(id)`, the id is absent from `getAll()` and storage; all other ids are present and unchanged
    - Runs: 100 iterations
    - **Validates: Requirements 2.4**

---

### Phase 5: BudgetService

- [ ] 5. Implement `BudgetService` in `js/app.js`
  - [ ] 5.1 Implement `BudgetService.get(category)` — reads `ebv_budgets`; returns the stored number for `category`, or `Infinity` if the key is absent or read fails
  - [ ] 5.2 Implement `BudgetService.getAll()` — reads `ebv_budgets`; returns the plain object or `{}` on failure
  - [ ] 5.3 Implement `BudgetService.set(category, amount)` — validates: numeric, > 0, ≤ 999999999.99; throws `ValidationError` on invalid; reads current budgets and compares to stored value — if identical, returns without writing (no-op); otherwise writes updated budget map to `ebv_budgets`
  - [ ] 5.4 Implement `BudgetService.isOverBudget(category, yearMonth)` — sums amounts from `ExpenseService.getByMonth(yearMonth)` where `expense.category === category`; returns `true` if sum > `BudgetService.get(category)` (treats `Infinity` as never over-budget)
  - [ ] 5.5 Write unit tests in `test/specs/budgetService.spec.js` covering: `get()` returns `Infinity` for unset category, `set()` happy path, `set()` rejects zero/negative/too-large, `isOverBudget()` true when over, false when under, false when no budget set
  - [ ] 5.6 Write property-based test **P9 (Valid Budget Save Round-Trip)** in `test/specs/budgetService.spec.js`:
    - Tag: `// Feature: expense-budget-visualizer, Property 9: Valid budget save round-trip`
    - Arbitrary: `fc.record({ category: fc.string({minLength:1}), amount: fc.float({min:0.01, max:999999999.99}) })` where amount differs from stored
    - Assert: after `BudgetService.set(category, amount)`, `BudgetService.get(category)` returns `amount` and `StorageService.read("ebv_budgets")[category]` equals `amount`
    - Runs: 100 iterations
    - **Validates: Requirements 4.2**
  - [ ] 5.7 Write property-based test **P10 (Invalid Budget Value Is Rejected Without Side Effects)** in `test/specs/budgetService.spec.js`:
    - Tag: `// Feature: expense-budget-visualizer, Property 10: Invalid budget value is rejected without side effects`
    - Arbitrary: `fc.oneof(fc.constant(0), fc.float({max:-0.001}), fc.constant(1e12), fc.constant(NaN))`
    - Assert: `BudgetService.set(cat, amount)` throws `ValidationError`; `BudgetService.get(cat)` is unchanged
    - Runs: 100 iterations
    - **Validates: Requirements 4.3**
  - [ ] 5.8 Write property-based test **P11 (Budget Idempotence)** in `test/specs/budgetService.spec.js`:
    - Tag: `// Feature: expense-budget-visualizer, Property 11: Budget idempotence — identical value write is a no-op`
    - Arbitrary: category + valid amount already stored; spy on `StorageService.write`
    - Assert: calling `BudgetService.set(category, sameAmount)` a second time does NOT call `StorageService.write()`
    - Runs: 100 iterations
    - **Validates: Requirements 4.6**
  - [ ] 5.9 Write property-based test **P12 (Over-Budget Detection Is Correct)** in `test/specs/budgetService.spec.js`:
    - Tag: `// Feature: expense-budget-visualizer, Property 12: Over-budget detection is correct for all expense and budget combinations`
    - Arbitrary: array of expense amounts for a category in a month + optional budget value (including `undefined` for unset)
    - Assert: `BudgetService.isOverBudget()` returns `true` iff sum of amounts > budget; returns `false` when budget is unset (Infinity)
    - Runs: 100 iterations
    - **Validates: Requirements 4.4, 4.5, 6.6**

---

### Phase 6: ChartService

- [ ] 6. Implement `ChartService` in `js/app.js`
  - [ ] 6.1 Implement `ChartService.drawPieChart(container, data)` — clears `container` innerHTML; creates an `<svg>` with a viewBox; draws pie/donut slices as `<path>` elements using trigonometry (cx=50, cy=50, r=40 in a 100×100 viewBox); each path gets `data-label` and `data-value` attributes; renders a legend below the chart; renders an empty-state `<p>` if `data` is empty or all values are 0
  - [ ] 6.2 Implement `ChartService.drawBarChart(container, data)` — clears `container` innerHTML; creates an `<svg>` with viewBox; draws exactly 6 bars as `<rect>` elements, each labeled with month abbreviation; each rect gets `data-label` and `data-value` attributes; bars scale proportionally to the max value; zero bars are still rendered (height 0 or 1px minimum)
  - [ ] 6.3 Implement `ChartService.attachTooltips(container)` — queries all `[data-label][data-value]` elements within `container`; on `mouseover`/`pointerover`, creates or updates a `<div id="chart-tooltip">` absolutely positioned near the event, showing `label: value`; on `mouseout`/`pointerout`, hides the tooltip
  - [ ] 6.4 Write unit tests in `test/specs/chartService.spec.js` covering: `drawPieChart()` creates correct number of path elements, `drawBarChart()` always produces exactly 6 bars, empty data renders empty-state message, `attachTooltips()` creates a tooltip element on mouseover
  - [ ] 6.5 Write property-based test **P17 (Chart Tooltip Displays Correct Label and Amount)** in `test/specs/chartService.spec.js`:
    - Tag: `// Feature: expense-budget-visualizer, Property 17: Chart tooltip displays correct label and amount`
    - Arbitrary: `fc.array(fc.record({ label: fc.string({minLength:1,maxLength:30}), value: fc.float({min:0.01,max:999999}), color: fc.hexaString({minLength:6,maxLength:6}).map(h => '#' + h) }), {minLength:1, maxLength:10})`
    - Assert: after `ChartService.drawPieChart(container, data)` and `ChartService.attachTooltips(container)`, simulating `mouseover` on each segment's path causes the tooltip to contain both `segment.label` and `String(segment.value)`
    - Runs: 100 iterations
    - **Validates: Requirements 5.6**

---

### Phase 7: ThemeController

- [ ] 7. Implement `ThemeController` in `js/app.js`
  - [ ] 7.1 Implement `ThemeController.apply(theme)` — validates `theme` is `"light"` or `"dark"`; sets `document.documentElement.dataset.theme = theme`; updates the toggle button's `aria-label` and icon
  - [ ] 7.2 Implement `ThemeController.toggle()` — reads current theme from `document.documentElement.dataset.theme`; computes opposite; calls `apply(newTheme)`; attempts `StorageService.write("ebv_theme", newTheme)` — silently swallows `StorageError` (theme applied in-session only)
  - [ ] 7.3 Implement `ThemeController.loadInitial()` — reads `ebv_theme` from storage; if value is `"light"` or `"dark"`, applies it; if missing/invalid, reads `window.matchMedia("(prefers-color-scheme: dark)").matches` and applies `"dark"` or `"light"` accordingly; falls back to `"light"` if media query also unavailable
  - [ ] 7.4 Write unit tests in `test/specs/themeController.spec.js` covering: `loadInitial()` applies stored theme, `loadInitial()` ignores invalid stored value and uses OS preference, `loadInitial()` defaults to light when OS preference unavailable, `toggle()` switches light→dark and dark→light, `toggle()` silently ignores storage write failure
  - [ ] 7.5 Write property-based test **P16 (Theme Toggle Idempotence)** in `test/specs/themeController.spec.js`:
    - Tag: `// Feature: expense-budget-visualizer, Property 16: Theme toggle idempotence`
    - Arbitrary: `fc.constantFrom("light", "dark")`
    - Assert: `ThemeController.apply(initial)` then `ThemeController.toggle()` then `ThemeController.toggle()` results in `document.documentElement.dataset.theme === initial`; a single `toggle()` from `initial` produces the opposite theme
    - Runs: 100 iterations
    - **Validates: Requirements 8.2**

---

### Phase 8: AppController & UI Render Functions

- [ ] 8. Implement `AppController` and all UI render functions in `js/app.js`
  - [ ] 8.1 Define `AppController.state` object with fields: `expenses`, `budgets`, `customCategories`, `theme`, `selectedMonth` (default current `"YYYY-MM"`), `activeView` (default `"expenses"`), `editingExpenseId` (default `null`)
  - [ ] 8.2 Implement `AppController.init()` — calls `ThemeController.loadInitial()`; reads all storage keys (`ebv_expenses`, `ebv_budgets`, `ebv_categories`) into state; handles corrupted JSON with `showErrorBanner`; calls `refreshAll()`; attaches all global event listeners (nav clicks, form submits, theme toggle)
  - [ ] 8.3 Implement `AppController.showError(msg)` / `AppController.clearError()` — delegates to `showErrorBanner` / `hideErrorBanner`
  - [ ] 8.4 Implement `AppController.refreshAll()` — calls all render functions with current state in dependency order: nav → expense form → transaction list → budget panel → summary view → charts; wraps in `requestAnimationFrame` for smooth update
  - [ ] 8.5 Implement `AppController.refreshCharts()` — calls only `ChartService.drawPieChart` and `ChartService.drawBarChart` with current filtered data; must complete within 300 ms
  - [ ] 8.6 Implement `renderNavBar(activeView, theme)` — renders navigation links for `"expenses"`, `"budgets"`, `"categories"`, `"summary"` views; marks the active link with `aria-current="page"`; renders the theme toggle `<button>` with accessible `aria-label`
  - [ ] 8.7 Implement `renderExpenseForm(expense?)` — renders form fields (title, amount, date, category `<select>`); if `expense` is provided, populates fields and sets submit button text to `"Update Expense"`; otherwise clears fields and sets text to `"Add Expense"`; attaches `input` listeners for inline validation; focuses title field on render
  - [ ] 8.8 Implement `renderTransactionList(expenses)` — renders a `<ul>` of expense rows (date, title, category, amount, edit button, delete button); if empty, renders placeholder `<p>` with message; edit button populates the form; delete button calls `window.confirm` then `ExpenseService.delete` then `refreshAll`
  - [ ] 8.9 Implement `renderBudgetPanel(categories, budgets, expenses, yearMonth)` — renders a row per category with a budget amount `<input>` and save `<button>`; shows over-budget warning icon (`aria-label="Over budget"`) when `BudgetService.isOverBudget()` is true; omits indicator for unset budgets
  - [ ] 8.10 Implement `renderCategoryManager(categories)` — renders the default categories as read-only labels; renders custom categories with a delete `<button>` each; renders an add-category `<input>` + `<button>`; delete button calls `window.confirm` (with reassignment warning when affected expenses exist) then `CategoryService.delete` then `refreshAll`
  - [ ] 8.11 Implement `renderExpenseForm` inline validation — on `blur` of each field, validate and show/clear the corresponding inline `<span class="field-error">` with specific messages; all inline errors are cleared on successful submit
  - [ ] 8.12 Implement `showErrorBanner(msg)` / `hideErrorBanner()` — creates/updates a `<div role="alert" id="error-banner">` at the top of `<body>`; `hideErrorBanner` removes it; if `localStorage` is unavailable, the banner is not dismissible
  - [ ] 8.13 Implement the form submit handler — distinguishes add vs edit mode via `AppController.state.editingExpenseId`; calls `ExpenseService.add` or `ExpenseService.update`; catches `ValidationError` (shows inline error) and `StorageError` (shows inline error, no state change); on success calls `refreshAll()` and clears edit state
  - [ ] 8.14 Write unit tests in `test/specs/appController.spec.js` covering: `init()` populates state from storage, `renderTransactionList()` shows placeholder when empty, `renderExpenseForm()` uses edit-mode label when expense provided, `renderBudgetPanel()` shows over-budget icon, `showErrorBanner()` creates accessible element, `hideErrorBanner()` removes it, delete confirm → cancel leaves list unchanged

---

### Phase 9: Summary View & Monthly Navigation

- [ ] 9. Implement the Summary View and monthly navigation controls
  - [ ] 9.1 Implement `renderSummaryView(expenses, budgets, yearMonth)` — for the given month, groups expenses by category, computes `spent` (sum), `budget` (from `BudgetService.get`), and `remaining` (budget − spent, possibly negative); renders a `<table>` with columns: Category, Spent, Budget, Remaining; highlights rows where `spent > budget` or (`budget === 0` and `spent > 0`) with a CSS class + icon; shows "No expenses for this period." message when no expenses exist
  - [ ] 9.2 Implement the `selectedMonth` navigation controls — renders `<button>` for previous/next month adjacent to a `<time>` display; disables or hides the next-month button when `selectedMonth` equals the current calendar month (prevents future navigation); updates `AppController.state.selectedMonth` and calls `refreshAll()` within 100ms of button press
  - [ ] 9.3 Implement the 100ms + 300ms loading indicator logic — on month change, immediately begin re-render; if re-render has not completed within 300ms, display a loading spinner `<div role="status" aria-live="polite">`; remove spinner when render completes; ensure total refresh completes within 5000ms
  - [ ] 9.4 Write unit tests in `test/specs/summaryView.spec.js` covering: total per category is sum of expenses, remaining is budget minus spent (negative when over), over-budget row has distinguishing class, `budget=0` + any spend triggers indicator, no-expenses message shown, future month navigation is blocked, default selected month is current calendar month
  - [ ] 9.5 Write property-based test **P13 (Summary View Category Totals Match Arithmetic Sum)** — note: P13 is a cross-cutting concern; add this test in `test/specs/summaryView.spec.js`:
    - Tag: `// Feature: expense-budget-visualizer, Property 13: Summary view category totals match arithmetic sum`
    - Arbitrary: `fc.array(expenseArb, {minLength:0, maxLength:30})` + `budgetMapArb` for a specific `yearMonth`
    - Assert: for every category present, `renderSummaryView` (or the underlying computation function) computes `spent === expenses.filter(e => e.category === cat && e.date.startsWith(yearMonth)).reduce((s,e) => s+e.amount, 0)` and `remaining === budget - spent`
    - Runs: 100 iterations
    - **Validates: Requirements 6.2, 6.3**

---

### Phase 10: Integration & Smoke Tests

- [ ] 10. Write integration and smoke tests
  - [ ] 10.1 Write smoke test: verify `index.html` contains exactly one `<link>` to a `.css` file and exactly one `<script>` to a `.js` file (validates Requirement 9.5)
  - [ ] 10.2 Write smoke test: verify all six default categories (`Food`, `Transport`, `Housing`, `Health`, `Entertainment`, `Other`) are present in `CategoryService.DEFAULT_CATEGORIES`
  - [ ] 10.3 Write integration test: `localStorage` unavailable scenario — mock `StorageService.isAvailable()` to return `false`; call `AppController.init()`; assert state is empty (`[]` expenses, `{}` budgets, `[]` custom categories) and the error banner is rendered in the DOM
  - [ ] 10.4 Write integration test: corrupted `localStorage` scenario — seed `localStorage.getItem("ebv_expenses")` with an invalid JSON string; call `AppController.init()`; assert state initializes to empty and the error banner is rendered
  - [ ] 10.5 Write integration test: full add-expense flow — call `ExpenseService.add()` with valid fields; assert the expense appears in `ExpenseService.getAll()`, in `StorageService.read("ebv_expenses")`, and (after `refreshAll`) a corresponding row exists in the rendered transaction list DOM
  - [ ] 10.6 Write integration test: category delete reassigns and cleans up — add a custom category, add expenses to it, delete the category (confirmed), assert affected expenses now show `category: "Other"` and the deleted category no longer appears in `CategoryService.getAll()` or the DOM category selector
  - [ ] 10.7 Write property-based test **P15 (Write-Failure Leaves In-Memory State Unchanged)** in `test/specs/appController.spec.js`:
    - Tag: `// Feature: expense-budget-visualizer, Property 15: Write-failure leaves in-memory state unchanged`
    - Arbitrary: any valid mutation input (add/update/delete expense, set budget, add/delete category); `StorageService.write` mocked to throw `StorageError`
    - Assert: `AppController.state` is deeply equal before and after the failed operation; no success indication is shown in DOM
    - Runs: 100 iterations
    - **Validates: Requirements 7.3**

---

### Phase 11: Final Polish — Responsiveness, Accessibility & Performance

- [ ] 11. Finalize CSS, accessibility attributes, and performance optimisations
  - [ ] 11.1 Complete `css/style.css` responsive layout — ensure no horizontal scrolling or overlapping elements at 320px, 768px, 1440px, 2560px; use `clamp()` or media queries; verify extension popup at 400px × 600px renders correctly
  - [ ] 11.2 Add ARIA attributes throughout `js/app.js` render functions — `aria-label` on icon-only buttons, `aria-required="true"` on form fields, `aria-invalid` toggled on validation error, `aria-live="polite"` on dynamic regions (transaction list, summary table), `role="alert"` on error banner
  - [ ] 11.3 Ensure full keyboard navigation — all interactive elements reachable via Tab in logical order; Enter/Space activates buttons; Escape cancels edit mode and clears form; focus is managed after add/edit/delete so focus doesn't get lost
  - [ ] 11.4 Implement the `[data-theme="dark"]` CSS custom property overrides in `css/style.css` so all colours, borders, shadows, and chart colours update automatically when `data-theme` is toggled on `<html>` — no inline `style` changes required
  - [ ] 11.5 Optimise chart rendering — `drawPieChart` and `drawBarChart` should avoid layout thrashing by building the full SVG DOM in a `DocumentFragment` before appending to `container`; time both functions with `performance.now()` and log a warning if > 100 ms
  - [ ] 11.6 Add `<meta>` tags to `index.html` — description, theme-color (matches CSS `--color-primary`), `apple-mobile-web-app-capable`, and `viewport` with `initial-scale=1`; ensure no render-blocking resources
  - [ ] 11.7 Write responsiveness example tests in `test/specs/appController.spec.js` — simulate viewport resizes to 320px and 1440px (set `document.documentElement.style.width`) and verify the main layout container does not overflow its parent (check `scrollWidth <= clientWidth`)
