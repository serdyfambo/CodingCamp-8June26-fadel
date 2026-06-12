# Design Document: Expense & Budget Visualizer

## Overview

The Expense & Budget Visualizer is a fully client-side single-page application (SPA) built with plain HTML, CSS, and Vanilla JavaScript — no frameworks, no build tools, no server. All application state is persisted in the browser's `localStorage`. The app allows users to record expenses, configure per-category monthly budgets, visualize spending via charts, and review monthly summaries.

### Key Design Goals

- **Zero dependencies**: no external libraries for core logic; charts may use a lightweight SVG approach inline
- **Single-file assets**: one CSS file (`css/style.css`), one JS file (`js/app.js`), one HTML entry point (`index.html`)
- **Offline-first**: all data operations are synchronous localStorage reads/writes
- **Accessible & responsive**: works from 320 px to 2560 px, supports keyboard navigation, ARIA labels
- **Theme-aware**: respects `prefers-color-scheme` at first load, persists user override

### Technology Choices

| Concern | Choice | Rationale |
|---|---|---|
| Core language | Vanilla JS (ES2020) | No build step, runs anywhere |
| Charts | Inline SVG drawn by JS | Zero dependency, fully controllable styling |
| Persistence | `localStorage` | Requirement constraint |
| Styling | CSS custom properties + single file | Easy theme switching without JS class toggling |
| Testing | Jasmine (browser-runnable) + fast-check (PBT) | No Node required; fast-check for property tests |

---

## Architecture

The app follows a **layered architecture** with clear separation between storage, domain logic, and UI rendering:

```
┌─────────────────────────────────────────────────────┐
│                   UI Layer (DOM)                      │
│  ExpenseForm │ TransactionList │ BudgetPanel │        │
│  SummaryView │ ChartPanel │ NavBar │ ErrorBanner      │
└──────────────────┬──────────────────────────────────┘
                   │ events / callbacks
┌──────────────────▼──────────────────────────────────┐
│               Controller / App State                  │
│   AppController  ─  manages state, orchestrates      │
│   ThemeController ─  theme toggle + persistence      │
└──────────┬─────────────────────┬────────────────────┘
           │                     │
┌──────────▼──────────┐  ┌───────▼────────────────────┐
│  Domain / Services  │  │    Chart Service            │
│  ExpenseService     │  │  drawPieChart(data, el)     │
│  BudgetService      │  │  drawBarChart(data, el)     │
│  CategoryService    │  │  drawTooltip(event, data)   │
└──────────┬──────────┘  └────────────────────────────┘
           │
┌──────────▼──────────┐
│  Storage Layer      │
│  StorageService     │
│  (localStorage r/w) │
└─────────────────────┘
```

### Data Flow

1. User interaction triggers a UI event handler
2. The handler calls a **Service** method (validate → transform → persist)
3. On success, `AppController` updates in-memory state and calls UI render functions
4. Charts are re-drawn synchronously (< 300 ms) after any state change

### Module Breakdown

```
index.html
css/
  style.css          ← all styles, CSS custom properties for themes
js/
  app.js             ← entire application (all modules IIFE-scoped)
```

All JavaScript lives in `app.js`, organized into logical sections using IIFE closures or plain object namespaces to keep globals minimal.

---

## Components and Interfaces

### StorageService

Wraps `localStorage` with error handling and typed access.

```js
StorageService = {
  // Returns parsed object or null on failure
  read(key: string): object | null,

  // Returns true on success; throws StorageError on failure
  write(key: string, value: object): boolean,

  // Removes the key; silent failure
  remove(key: string): void,

  // Returns true if localStorage is available and writable
  isAvailable(): boolean,
}
```

**Storage keys:**
| Key | Type | Description |
|---|---|---|
| `ebv_expenses` | `Expense[]` | All expense records |
| `ebv_budgets` | `Record<string, number>` | Category → monthly budget amount |
| `ebv_categories` | `string[]` | Custom category names |
| `ebv_theme` | `"light" \| "dark"` | Persisted theme choice |

### ExpenseService

Domain logic for expense CRUD.

```js
ExpenseService = {
  // Validates fields, writes to storage, returns saved Expense or throws ValidationError/StorageError
  add(fields: ExpenseInput): Expense,

  // Updates existing expense by id; throws if not found or invalid
  update(id: string, fields: ExpenseInput): Expense,

  // Removes expense by id after caller confirms; throws StorageError on failure
  delete(id: string): void,

  // Returns all expenses sorted date-descending
  getAll(): Expense[],

  // Returns expenses for a specific year-month "YYYY-MM"
  getByMonth(yearMonth: string): Expense[],
}
```

### BudgetService

```js
BudgetService = {
  // Validates and saves budget; no-op if value identical to stored; throws ValidationError
  set(category: string, amount: number): void,

  // Returns budget for category, or Infinity if unset
  get(category: string): number,

  // Returns all budgets as a plain object
  getAll(): Record<string, number>,

  // Returns true if total monthly expenses for category exceed budget
  isOverBudget(category: string, yearMonth: string): boolean,
}
```

### CategoryService

```js
CategoryService = {
  DEFAULT_CATEGORIES: string[],  // ["Food","Transport","Housing","Health","Entertainment","Other"]

  // Returns combined default + custom list
  getAll(): string[],

  // Validates and adds; throws ValidationError on duplicate/empty/too-long
  add(name: string): void,

  // Reassigns all expenses in category to "Other", then removes category
  delete(name: string): void,

  // Returns expenses that would be reassigned on deletion
  getAffectedExpenses(name: string): Expense[],
}
```

### ChartService

Pure rendering functions — no state.

```js
ChartService = {
  // Draws pie/donut SVG inside `container`; data = [{label, value, color}]
  drawPieChart(container: HTMLElement, data: ChartSegment[]): void,

  // Draws bar SVG inside `container`; data = [{label, value}] (6 months)
  drawBarChart(container: HTMLElement, data: BarPoint[]): void,

  // Attaches tooltip show/hide to chart SVG elements
  attachTooltips(container: HTMLElement): void,
}
```

### AppController

Orchestrates state and wires UI events to services.

```js
AppController = {
  state: AppState,

  init(): void,              // Load storage, build UI, attach events
  refreshAll(): void,        // Re-render transaction list, charts, summary
  refreshCharts(): void,     // Re-draw only charts (< 300 ms)
  showError(msg: string): void,
  clearError(): void,
}
```

### ThemeController

```js
ThemeController = {
  apply(theme: "light" | "dark"): void,   // Sets data-theme on <html>
  toggle(): void,                          // Flips + persists
  loadInitial(): void,                     // Reads storage / OS pref
}
```

### UI Components (DOM Functions)

Each UI area has a dedicated render function that accepts current state and mutates the relevant DOM node:

| Function | Responsibility |
|---|---|
| `renderTransactionList(expenses)` | Renders all expense rows; empty placeholder if none |
| `renderBudgetPanel(categories, budgets, expenses, yearMonth)` | Renders budget rows with over-budget indicators |
| `renderSummaryView(expenses, budgets, yearMonth)` | Renders summary table with spent/budget/remaining |
| `renderNavBar(activeView, theme)` | Renders nav links + theme toggle |
| `renderExpenseForm(expense?)` | Renders form (add or edit mode) |
| `renderCategoryManager(categories)` | Renders category list + add form |
| `showErrorBanner(msg)` | Renders/updates persistent error banner |
| `hideErrorBanner()` | Removes banner |

---

## Data Models

### Expense

```js
/**
 * @typedef {Object} Expense
 * @property {string}  id        - UUID-like unique id (crypto.randomUUID or timestamp fallback)
 * @property {string}  title     - 1–100 characters
 * @property {number}  amount    - 0.01–999999.99, stored as number (2 dp)
 * @property {string}  date      - ISO date string "YYYY-MM-DD", not in the future
 * @property {string}  category  - Must exist in categories list at time of save
 */
```

### Budget

```js
/**
 * Stored as a flat object mapping category name to monthly limit.
 * Missing key = no budget (unlimited).
 * @typedef {Record<string, number>} BudgetMap
 * Key:   category name (string)
 * Value: positive number, up to 2 dp, max 999999999.99
 */
```

### AppState (in-memory)

```js
/**
 * @typedef {Object} AppState
 * @property {Expense[]}           expenses        - All expenses, sorted date-desc
 * @property {BudgetMap}           budgets         - Category → monthly budget
 * @property {string[]}            customCategories - User-defined category names
 * @property {"light"|"dark"}      theme           - Active theme
 * @property {string}              selectedMonth   - "YYYY-MM" for summary/chart filter
 * @property {"expenses"|"summary"|"budgets"|"categories"} activeView
 * @property {string|null}         editingExpenseId - null when in add mode
 */
```

### Validation Rules (summary)

| Field | Rule |
|---|---|
| `title` | Required, 1–100 chars, plain text |
| `amount` | Required, numeric, 0.01–999999.99, max 2 dp |
| `date` | Required, valid date, not in the future |
| `category` | Required, must be in current category list |
| `budgetAmount` | Numeric, positive, max 999999999.99 |
| `categoryName` | 1–50 chars, case-insensitive unique |

### LocalStorage JSON Schema

```json
// ebv_expenses
[
  {
    "id": "1717000000000",
    "title": "Grocery run",
    "amount": 45.50,
    "date": "2025-06-01",
    "category": "Food"
  }
]

// ebv_budgets
{
  "Food": 400,
  "Transport": 150
}

// ebv_categories
["Gym", "Subscriptions"]

// ebv_theme
"dark"
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Valid Expense Add Round-Trip

*For any* valid expense input (title within 1–100 chars, amount in 0.01–999,999.99 with at most 2 decimal places, date not in the future, category from the current list), calling `ExpenseService.add()` SHALL cause the expense to appear in `ExpenseService.getAll()` and be readable from `StorageService` with all fields equal to the input.

**Validates: Requirements 1.2**

---

### Property 2: Invalid Expense Input Is Rejected Without Side Effects

*For any* expense input where at least one required field is empty/null OR the amount is non-numeric, less than 0.01, greater than 999,999.99, or has more than 2 decimal places, calling `ExpenseService.add()` SHALL throw a `ValidationError` and the list of stored expenses SHALL remain identical to its state before the call.

**Validates: Requirements 1.3, 1.4**

---

### Property 3: Expense List Is Always Sorted Date-Descending

*For any* non-empty array of expenses with distinct or identical dates, `ExpenseService.getAll()` SHALL return the expenses sorted by date in descending order (most recent first).

**Validates: Requirements 2.1**

---

### Property 4: Valid Expense Update Persists Correctly

*For any* existing expense and any valid updated field values, calling `ExpenseService.update(id, fields)` SHALL cause `ExpenseService.getAll()` and `StorageService` to reflect the new field values for that expense, while all other expenses remain unchanged.

**Validates: Requirements 2.3**

---

### Property 5: Expense Deletion Removes Exactly the Target

*For any* set of expenses, deleting one by id SHALL cause that expense to no longer appear in `ExpenseService.getAll()` or in `StorageService`, and all other expenses SHALL remain present and unchanged.

**Validates: Requirements 2.4**

---

### Property 6: Valid Custom Category Add Round-Trip

*For any* category name that is between 1 and 50 characters and does not duplicate an existing category name (case-insensitively), calling `CategoryService.add()` SHALL cause the name to appear in `CategoryService.getAll()` and in `StorageService`.

**Validates: Requirements 3.2**

---

### Property 7: Invalid or Duplicate Category Name Is Rejected

*For any* category name that is empty, exceeds 50 characters, or matches an existing category name case-insensitively, calling `CategoryService.add()` SHALL throw a `ValidationError` and `CategoryService.getAll()` SHALL remain identical to its prior state.

**Validates: Requirements 3.3**

---

### Property 8: Custom Category Deletion Reassigns All Affected Expenses to "Other"

*For any* custom category that has one or more expenses assigned to it, after `CategoryService.delete()` is called and confirmed, every expense that previously belonged to that category SHALL have its `category` field set to `"Other"` in both the in-memory state and `StorageService`, and the deleted category SHALL not appear in `CategoryService.getAll()`.

**Validates: Requirements 3.4, 3.6**

---

### Property 9: Valid Budget Save Round-Trip

*For any* category and any valid budget amount (numeric, positive, ≤ 999,999,999.99) that differs from the currently stored value, calling `BudgetService.set()` SHALL cause `BudgetService.get()` and `StorageService` to return the new amount for that category.

**Validates: Requirements 4.2**

---

### Property 10: Invalid Budget Value Is Rejected Without Side Effects

*For any* budget input that is non-numeric, zero, negative, or greater than 999,999,999.99, calling `BudgetService.set()` SHALL throw a `ValidationError` and the stored budget for that category SHALL remain unchanged.

**Validates: Requirements 4.3**

---

### Property 11: Budget Idempotence — Identical Value Write Is a No-Op

*For any* category that already has a saved budget amount, calling `BudgetService.set()` with the exact same amount SHALL NOT invoke `StorageService.write()`.

**Validates: Requirements 4.6**

---

### Property 12: Over-Budget Detection Is Correct for All Expense and Budget Combinations

*For any* category, any set of expenses for a given year-month, and any budget value (including zero and unset/unlimited), `BudgetService.isOverBudget(category, yearMonth)` SHALL return `true` if and only if the arithmetic sum of expense amounts for that category in that month is strictly greater than the configured budget (treating unset budget as `Infinity`, meaning it can never be over-budget).

**Validates: Requirements 4.4, 4.5, 6.6**

---

### Property 13: Summary View Category Totals Match Arithmetic Sum

*For any* set of expenses and budgets for a given year-month, the Summary_View SHALL display each category's total as exactly the arithmetic sum of all expense amounts in that category for the month, and each category's remaining balance SHALL equal its configured budget minus its total spent (which is negative when over budget).

**Validates: Requirements 6.2, 6.3**

---

### Property 14: Storage Round-Trip Preserves All Data

*For any* valid application state (expenses array, budgets map, custom categories array), writing it to `StorageService` and reading it back SHALL produce a structurally and value-equivalent state — no data loss, no type coercion, no field reordering that changes meaning.

**Validates: Requirements 7.1, 7.2**

---

### Property 15: Write-Failure Leaves In-Memory State Unchanged

*For any* mutation operation (add expense, update expense, delete expense, set budget, add category, delete category) where `StorageService.write()` throws a `StorageError`, the in-memory `AppState` SHALL remain identical to its state before the call and no success indication SHALL be displayed.

**Validates: Requirements 7.3**

---

### Property 16: Theme Toggle Idempotence

*For any* initial theme value (`"light"` or `"dark"`), activating `ThemeController.toggle()` twice in succession SHALL result in the active theme being equal to the original theme. A single activation SHALL produce the opposite theme.

**Validates: Requirements 8.2**

---

### Property 17: Chart Tooltip Displays Correct Label and Amount

*For any* array of chart data segments (each with a label and a numeric value), after `ChartService.drawPieChart()` or `ChartService.drawBarChart()` renders the chart and a hover/tap event is simulated on a segment, the displayed tooltip SHALL contain both the segment's label and its exact numeric value.

**Validates: Requirements 5.6**

---

## Error Handling

### Categories of Errors

| Error Type | Trigger | Behavior |
|---|---|---|
| `ValidationError` | Invalid form input | Inline error message near the offending field; no storage write |
| `StorageError` | `localStorage` throws on read | Persistent error banner; app initializes with empty state |
| `StorageError` | `localStorage` throws on write | Inline error message; operation blocked; in-memory state rolled back |
| `ParseError` | Corrupted JSON in localStorage | Discard data; empty state; persistent error banner |
| Theme write failure | localStorage throws on theme persist | Silent failure; theme applied in-session only |

### Error Display Rules

1. **Inline errors** appear directly below the relevant field or action button and are cleared when the user corrects the input or navigates away.
2. **Persistent error banner** appears at the top of the viewport, is not dismissible if `localStorage` is unavailable, and remains for the session duration.
3. **Confirmation prompts** use the native `window.confirm()` for delete operations to avoid custom modal complexity.
4. Errors never expose raw exception messages to the user — all user-facing strings are predefined.

### Graceful Degradation

- If `localStorage` is entirely unavailable (e.g., Safari private mode, quota exceeded): the app loads with empty state, all read/write operations fail silently for theme but noisily for data, and the persistent banner is shown.
- If the app is used with no internet (already the intended offline-first case): everything works normally — there are no network calls.

---

## Testing Strategy

### Framework Choice

- **Jasmine** (loaded via CDN in a `test/` HTML runner) for unit and integration tests — no Node.js required
- **fast-check** (loaded via CDN) for property-based tests — generates random inputs and shrinks counterexamples
- Each property-based test runs **minimum 100 iterations**

### Test Organization

```
test/
  runner.html          ← opens in browser to run all tests
  specs/
    storageService.spec.js
    expenseService.spec.js
    budgetService.spec.js
    categoryService.spec.js
    chartService.spec.js
    appController.spec.js
    themeController.spec.js
    summaryView.spec.js
```

### Unit Tests (Example-Based)

Focus on:
- Form rendering in add vs edit mode
- Placeholder/empty-state rendering
- Navigation to Summary_View
- Error banner display/hide
- Theme loading from OS preference / fallback chain
- Confirmation prompt on delete
- Correct chart segment count
- Correct 6-month data points (always exactly 6)
- Future month navigation blocked

### Property-Based Tests

Each property from the Correctness Properties section gets exactly one property-based test tagged with:

```js
// Feature: expense-budget-visualizer, Property N: <property_text>
fc.assert(fc.property(arbitraries, (input) => { ... }), { numRuns: 100 });
```

| Property | Arbitraries Used |
|---|---|
| P1 Valid expense add round-trip | `fc.record({ title: fc.string({minLength:1,maxLength:100}), amount: fc.float({min:0.01,max:999999.99}), date: fc.date({max: new Date()}), category: fc.constantFrom(...categories) })` |
| P2 Invalid input rejected | `fc.oneof(emptyFieldArb, outOfRangeAmountArb, futureDateArb)` |
| P3 Sort date-descending | `fc.array(expenseArb, {minLength: 1})` |
| P4 Valid update persists | `expenseArb` + `validUpdateFieldsArb` |
| P5 Delete removes target | `fc.array(expenseArb, {minLength: 1})` |
| P6 Valid category add | `fc.string({minLength:1,maxLength:50})` (unique) |
| P7 Invalid category rejected | `fc.oneof(fc.constant(""), longStringArb, duplicateNameArb)` |
| P8 Category delete reassigns | `categoryNameArb` + `fc.array(expenseArb, {minLength:1})` |
| P9 Budget round-trip | `fc.record({category: fc.string(), amount: validBudgetAmountArb})` |
| P10 Invalid budget rejected | `fc.oneof(fc.constant(0), negativeNumberArb, tooLargeArb)` |
| P11 Budget idempotence | `categoryArb` + `validBudgetAmountArb` |
| P12 Over-budget detection | `fc.array(expenseArb)` + `fc.option(validBudgetAmountArb)` |
| P13 Summary arithmetic | `fc.array(expenseArb)` + `budgetMapArb` |
| P14 Storage round-trip | `appStateArb` |
| P15 Write-failure rollback | Any mutation + mocked `StorageService.write` throwing |
| P16 Theme toggle idempotence | `fc.constantFrom("light", "dark")` |
| P17 Tooltip correctness | `fc.array(chartSegmentArb, {minLength:1})` |

### Integration / Smoke Tests

| Test | Type |
|---|---|
| Default categories present | Smoke |
| Single CSS + single JS in index.html | Smoke |
| App loads within performance budget | Smoke (Lighthouse) |
| Responsive layout at 320px, 768px, 1440px, 2560px | Example |
| localStorage unavailable → banner shown, empty state | Example |
| Corrupted localStorage → banner + empty state | Example |

### Testing Advice

- Mock `StorageService` at the boundary for all service unit tests to isolate from real `localStorage`
- Use `fc.date({ max: new Date() })` to guarantee non-future dates in generators
- Amount arbitraries must round to 2 decimal places: `Math.round(raw * 100) / 100`
- Chart tooltip tests simulate `mouseover` / `pointerover` events on rendered SVG elements
- Theme tests should reset `document.documentElement.dataset.theme` after each spec
