# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application built with HTML, CSS, and Vanilla JavaScript. It enables users to track personal expenses, set budgets per category, and visualize spending patterns through charts and summaries — all without a backend server. All data is persisted in the browser's Local Storage. The app supports custom categories, a monthly summary view, and a dark/light mode toggle.

---

## Glossary

- **App**: The Expense & Budget Visualizer web application.
- **Expense**: A single spending record consisting of a title, amount, date, and category.
- **Budget**: A user-defined maximum spending limit for a given category within a month.
- **Category**: A label grouping expenses (e.g., Food, Transport). May be a default or a user-defined custom category.
- **Custom_Category**: A user-created category not present in the default list.
- **Transaction_List**: The scrollable UI panel that displays all recorded expenses.
- **Budget_Panel**: The UI panel where users configure per-category budgets.
- **Summary_View**: The monthly overview panel displaying total expenses and budget adherence per category.
- **Chart**: An SVG or Canvas-based visual representation of spending data.
- **Local_Storage**: The browser's `localStorage` API used for all client-side data persistence.
- **Theme**: The visual color scheme of the App, either "light" or "dark".
- **Theme_Toggle**: The UI control that switches the active Theme.

---

## Requirements

### Requirement 1: Add Expense

**User Story:** As a user, I want to add a new expense with a title, amount, date, and category, so that I can record my spending.

#### Acceptance Criteria

1. THE App SHALL provide a form with fields for: expense title (plain text, maximum 100 characters), amount (positive decimal number between 0.01 and 999,999.99 inclusive, up to 2 decimal places), date (a calendar date not in the future), and category (selected from the available predefined and custom category list).
2. WHEN the user submits the expense form with all required fields filled and valid, THE App SHALL save the expense to Local_Storage and add it to the Transaction_List without requiring a separate explicit confirmation step.
3. IF the user submits the expense form with any required field empty, THEN THE App SHALL display an inline validation error message identifying the missing field and SHALL NOT save the expense.
4. IF the user enters a value in the amount field that is non-numeric, less than 0.01, greater than 999,999.99, or has more than 2 decimal places, THEN THE App SHALL display an inline validation error indicating the valid range and format and SHALL NOT save the expense.
5. WHEN an expense is successfully saved, THE App SHALL clear the form fields and keep focus on the title field.
6. IF Local_Storage throws an error when saving a new expense, THEN THE App SHALL display an inline error message indicating the save failed and SHALL NOT add the expense to the Transaction_List.

---

### Requirement 2: View and Manage Expenses

**User Story:** As a user, I want to view, edit, and delete my recorded expenses, so that I can keep my records accurate.

#### Acceptance Criteria

1. THE App SHALL display all recorded expenses in the Transaction_List, ordered by date descending by default.
2. WHEN the user selects an expense in the Transaction_List, THE App SHALL populate the expense form with that expense's data for editing and SHALL change the form's submit button label to indicate edit mode (e.g., "Update Expense").
3. WHILE an existing expense is loaded for editing, WHEN the user submits the expense form with all fields valid, THE App SHALL update the corresponding expense in Local_Storage and refresh the Transaction_List; IF the update fails validation, THEN THE App SHALL display the relevant inline error and SHALL NOT persist the change.
4. WHEN the user clicks the delete action on an expense, THE App SHALL display a confirmation prompt; IF the user confirms, THEN THE App SHALL remove that expense from Local_Storage and from the Transaction_List.
5. WHILE no expenses have been recorded, THE App SHALL display a placeholder message in the Transaction_List indicating that no expenses exist yet.
6. WHEN an expense is successfully updated, THE App SHALL clear the form fields and reset the submit button label to its add-mode label (e.g., "Add Expense").

---

### Requirement 3: Category Management

**User Story:** As a user, I want to use default categories and create custom categories, so that I can organize my expenses the way I prefer.

#### Acceptance Criteria

1. THE App SHALL provide a set of default categories: Food, Transport, Housing, Health, Entertainment, and Other.
2. WHEN the user submits a new custom category name (plain text, 1–50 characters), THE App SHALL add the Custom_Category to the category list, persist it in Local_Storage, and make it immediately selectable in the category selector.
3. IF the user submits a Custom_Category name that is empty, exceeds 50 characters, or duplicates an existing category name (case-insensitive), THEN THE App SHALL display a validation error and SHALL NOT add the duplicate or invalid entry.
4. WHEN a Custom_Category is deleted and the user confirms the deletion, THE App SHALL remove it from Local_Storage and from the category selector.
5. IF the user attempts to delete a Custom_Category that has expenses assigned to it, THEN THE App SHALL display a confirmation prompt informing the user that existing expenses in that category will be reassigned to "Other".
6. IF the user confirms deletion of a Custom_Category with assigned expenses, THEN THE App SHALL reassign all expenses in that category to "Other", persist the updated expenses to Local_Storage, and remove the Custom_Category.
7. IF the user cancels the deletion confirmation prompt, THEN THE App SHALL take no action and the Custom_Category SHALL remain unchanged.

---

### Requirement 4: Budget Configuration

**User Story:** As a user, I want to set a monthly budget for each category, so that I can monitor and control my spending limits.

#### Acceptance Criteria

1. THE App SHALL display the Budget_Panel listing all categories with their current monthly budget amounts.
2. WHEN the user sets a budget amount for a category that differs from the previously stored value and saves, THE App SHALL save the updated budget value to Local_Storage.
3. IF the user enters a budget value that is non-numeric, zero, negative, or greater than 999,999,999.99, THEN THE App SHALL display a validation error and SHALL NOT save the invalid value.
4. WHILE the total expenses for a category in the current calendar month exceed that category's set budget, THE App SHALL display a dedicated warning icon or a visually differentiated background color consistently next to that category in the Budget_Panel.
5. WHERE a budget has not been set for a category, THE App SHALL treat that category's budget as unlimited and omit the over-budget indicator for it.
6. IF the user enters a budget amount for a category that is identical to the previously stored value and saves, THEN THE App SHALL take no action and SHALL NOT perform a Local_Storage write.

---

### Requirement 5: Expense Visualization

**User Story:** As a user, I want to see charts of my spending, so that I can quickly understand where my money goes.

#### Acceptance Criteria

1. THE App SHALL render a Chart showing the breakdown of total expenses by category for the currently selected month, using a pie or donut chart style.
2. WHEN the user changes the selected month, THE App SHALL begin updating the Chart within 100ms and SHALL display a loading indicator if the Chart update has not completed within 300ms.
3. THE App SHALL render a second Chart showing the total spending trend across the most recent 6 calendar months (including months with zero spending), using a bar or line chart style.
4. WHEN an expense is added, edited, or deleted, THE App SHALL update all Charts to reflect the change within 300ms without requiring a page reload.
5. WHILE no expenses exist for the selected month, THE App SHALL display an empty-state message in place of the category breakdown Chart; the 6-month trend Chart SHALL remain visible and show zero for months without expenses.
6. WHEN the user hovers over or taps a Chart data point or segment, THE App SHALL display a tooltip showing the category name and exact amount.

---

### Requirement 6: Monthly Summary View

**User Story:** As a user, I want a monthly summary view, so that I can review my total expenses and budget performance for any given month.

#### Acceptance Criteria

1. THE App SHALL provide a Summary_View accessible from the main navigation.
2. WHEN the user opens the Summary_View, THE App SHALL display the total expenses for the selected month (defaulting to the current calendar month), grouped by category.
3. WHEN the user opens the Summary_View, THE App SHALL display each category's spent amount alongside its configured budget and the remaining balance (budget minus spent; shown as negative if over budget).
4. WHEN the user changes the selected month in the Summary_View, THE App SHALL begin refreshing the displayed totals and category breakdown within 100ms and SHALL display a loading indicator if the refresh has not completed within 300ms; the refresh SHALL complete within 5000ms.
5. IF total expenses for a category exceed its budget in the Summary_View, THEN THE App SHALL visually differentiate that category row using a distinct indicator, such as a colored background or icon, to indicate the budget has been exceeded.
6. IF a category has a budget of zero and any expenses exist for that category in the selected month, THEN THE App SHALL apply the same distinct visual indicator to that category row in the Summary_View as defined in criterion 5.
7. WHILE no expenses exist for the selected month in the Summary_View, THE App SHALL display a message stating there are no expenses for that period.
8. IF the user attempts to navigate to a month after the current calendar month in the Summary_View, THEN THE App SHALL prevent the navigation and SHALL NOT display data for a future month.

---

### Requirement 7: Data Persistence

**User Story:** As a user, I want my data to persist between sessions, so that I don't lose my expense records when I close the browser.

#### Acceptance Criteria

1. THE App SHALL store all expenses, budgets, and Custom_Categories in Local_Storage using a structured JSON format.
2. WHEN the App is loaded, THE App SHALL read all expenses, budgets, and Custom_Categories from Local_Storage and restore the application state; IF the read fails or Local_Storage is unavailable, THEN THE App SHALL initialize with an empty application state.
3. WHEN an expense, budget, or Custom_Category is created, updated, or deleted, THE App SHALL write the updated state to Local_Storage before displaying a success indication to the user; IF the write fails, THEN THE App SHALL block the operation and SHALL NOT update the in-memory application state.
4. IF Local_Storage is unavailable or throws an error on read or write, THEN THE App SHALL display a persistent error banner notifying the user that data cannot be saved or loaded.
5. IF the data read from Local_Storage on load is corrupted or cannot be parsed as valid JSON, THEN THE App SHALL discard the corrupted data, initialize with an empty application state, and display a persistent error banner notifying the user that stored data was unreadable and has been reset.

---

### Requirement 8: Dark/Light Mode Toggle

**User Story:** As a user, I want to switch between dark and light mode, so that I can use the app comfortably in different lighting environments.

#### Acceptance Criteria

1. THE App SHALL provide a Theme_Toggle control that is rendered and interactive at all supported viewport widths within the main navigation bar.
2. WHEN the user activates the Theme_Toggle, THE App SHALL switch the active Theme between "light" and "dark".
3. WHEN the Theme is changed, THE App SHALL update all UI elements to reflect the new Theme without a page reload.
4. WHEN the App is loaded with no saved Theme in Local_Storage, THE App SHALL apply the user's OS-level color scheme preference (via `prefers-color-scheme`); IF the OS preference is unavailable or not set, THEN THE App SHALL default to the "light" Theme.
5. IF the Theme value read from Local_Storage on load is not "light" or "dark" (e.g., corrupted or unrecognized), THEN THE App SHALL discard the invalid value and apply the OS-preference fallback chain as defined in criterion 4.
6. WHEN the user activates the Theme_Toggle, THE App SHALL persist the resulting Theme value to Local_Storage; IF the Local_Storage write fails, THEN THE App SHALL still apply the Theme change for the current session without displaying an error.

---

### Requirement 9: Performance and Responsiveness

**User Story:** As a user, I want the app to load fast and respond without lag, so that I can use it efficiently on any connection.

#### Acceptance Criteria

1. THE App SHALL complete initial load and render within 2 seconds on a standard broadband connection (minimum 10 Mbps) and within 5 seconds on a slow connection (minimum 3G / ~1 Mbps).
2. WHEN the user interacts with any UI control (buttons, forms, selectors), THE App SHALL reflect the result of that interaction within 200ms.
3. THE App SHALL render correctly on viewport widths from 320px to 2560px without horizontal scrolling or overlapping elements.
4. WHERE the App is used as a browser extension, THE App SHALL render correctly within an extension popup viewport of at least 400px × 600px.
5. THE App SHALL use only a single CSS file (located in `css/`) and a single JavaScript file (located in `js/`) to maintain a minimal asset footprint and fast load time.
