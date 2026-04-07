# QA Engineer Take-Home — Document Upload & Data Extraction

Automated test suite for the **Document Upload & Data Extraction** feature, built with [Playwright](https://playwright.dev).

---

## Project Structure

```
.
├── mock-app/
│   └── index.html              # Simulated web app (served locally)
├── tests/
│   ├── helpers/
│   │   ├── api-mocks.ts        # Playwright route mocks for /api/upload and /api/save
│   │   └── page-actions.ts     # Reusable actions (attach file, click upload, etc.)
│   ├── upload-flow.spec.ts     # End-to-end happy-path tests
│   ├── file-validation.spec.ts # Client-side file type & size validation tests
│   └── data-extraction.spec.ts # Extraction results, editing, save & error tests
├── TEST_STRATEGY.md            # Full test strategy document (Part 1)
├── playwright.config.ts
└── package.json
```

---

## How to Run the Tests

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9

### 1. Install dependencies

```bash
npm install
```

### 2. Install Playwright browsers

```bash
npx playwright install chromium
```

### 3. Run the full test suite (headless)

```bash
npm test
```

Playwright automatically starts a local web server serving `mock-app/` on port 3000 before running the tests.

### 4. Run tests with a visible browser

```bash
npm run test:headed
```

### 5. Run tests with the interactive Playwright UI

```bash
npm run test:ui
```

### 6. View the HTML report after a run

```bash
npm run report
```

---

## Assumptions

1. **No real backend required.** All API calls (`POST /api/upload`, `POST /api/save`) are intercepted and mocked at the network layer using Playwright's `page.route()`. This keeps the suite fast, deterministic, and infrastructure-free.

2. **PDF validation is client-side.** The mock app checks the file MIME type and extension before calling the API. Server-side validation (e.g., content inspection) is assumed to exist but is not exercised in this suite.

3. **File size limit is 10 MB.** Enforced client-side in the mock app. The oversized-file test generates a buffer programmatically to avoid committing large binaries.

4. **Extraction may return partial data.** The API is allowed to return a success response with some fields empty — the form still renders and the user can fill in missing values manually.

5. **"Title" is the only required field for saving.** All other fields (author, date, content) are optional.

6. **Processing is synchronous from the test's perspective.** The mock fulfills the upload request immediately unless a test explicitly delays it to verify the intermediate loading state.

7. **Single browser target for this suite.** Tests run on Chromium. Cross-browser coverage (Firefox, WebKit) is straightforward to add in `playwright.config.ts` and is discussed in the test strategy.

---

## Technical Decisions

| Decision | Rationale |
|---|---|
| **Playwright** | First-class TypeScript support, built-in network interception, auto-wait, and an excellent developer experience. Ideal for testing UI + API together. |
| **`page.route()` mocking** | Decouples the test suite from backend infrastructure. Tests run in milliseconds and are fully deterministic. Real API integration is better validated at a lower level (Supertest/Pact). |
| **`data-testid` attributes** | Stable selectors that are independent of CSS classes or DOM structure, reducing test brittleness. |
| **Inline mock app (no framework)** | A plain HTML/JS page is sufficient to demonstrate the feature behaviour without adding framework overhead. |
| **Helper modules** | `api-mocks.ts` and `page-actions.ts` eliminate duplication and make test intent immediately clear. |
| **`role=alert`** | Error elements are marked with ARIA roles so both tests and assistive technologies can detect them reliably. |

---

## Test Strategy

See [TEST_STRATEGY.md](./TEST_STRATEGY.md) for the full test strategy including scope, risk analysis, manual vs automated breakdown, and release readiness criteria.
