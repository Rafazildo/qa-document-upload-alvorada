# Test Strategy — Document Upload & Data Extraction

## 1. Overview

This document describes the test strategy for the **Document Upload & Data Extraction** feature. The feature allows users to upload PDF files, have structured data extracted automatically by the system, review and edit that extracted data, and save it to be consumed by downstream product workflows.

The strategy is structured in two main blocks:

1. **Manual Testing** — exploratory, acceptance, and cross-cutting concerns that benefit from human judgment
2. **Test Automation** — regression safety net built with Playwright covering the highest-value scenarios

---

## 2. Scope

### In Scope

| Area | Coverage |
|---|---|
| PDF file upload (UI) | File selection, drag-and-drop, type and size validation |
| Upload API (`POST /api/upload`) | Success response, error codes, payload contract |
| Processing state | Spinner visibility, section transitions, timeout feedback |
| Data extraction results | Full extraction, partial extraction, empty result |
| Extracted data editing | Field editability, required field validation |
| Save API (`POST /api/save`) | Success, server failure, network failure |
| Error handling | Inline errors, error section, retry flow |
| Navigation flows | Upload another, post-save state, return after error |

### Out of Scope

- Authentication and authorisation (assumed handled by a separate auth layer)
- PDF rendering or in-browser preview
- Downstream systems that consume the saved data
- Mobile native applications (web responsive layout only)
- Performance benchmarks beyond basic upload-to-extraction timing in staging

---

## 3. Assumptions

1. The application runs a **web frontend** (HTML/JS/CSS) backed by a **REST API**.
2. PDF processing may take **up to 30 seconds**; the UI reflects this with a visible loading state.
3. The API can return **partial extractions** (some fields populated, others empty) — this is a valid success state, not an error.
4. The maximum allowed file size is **10 MB**, enforced both client-side and server-side.
5. Authentication is out of scope; user sessions are assumed to be valid during all test executions.
6. API extraction failures return a structured JSON body: `{ "message": "..." }`.
7. The primary browser target is **latest stable Chrome**; Firefox and Safari are validated at release time.

---

## 4. Identified Risks

Understanding risks early drives both the test scenarios chosen and the automation priorities.

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Extraction returns incorrect or partial data silently (no error raised) | High | High | Validate structured output against a schema; surface low-confidence extractions to the user |
| Large files cause upload timeouts with no feedback | Medium | High | Enforce size limit client-side before upload; show upload progress; implement chunked upload on backend |
| Malicious PDF uploads (embedded scripts, zip bombs, path traversal) | Medium | Critical | Server-side content-type validation; antivirus scan before processing; sandbox the extractor process |
| Processing service unavailable | Low | High | Circuit breaker with user-facing error and retry; queue-based processing with status polling |
| User navigates away mid-extraction and loses context | High | Medium | `beforeunload` warning; consider persisting draft state |
| API contract drift — frontend and backend become out of sync | Medium | High | OpenAPI spec as source of truth; contract tests (Pact) |
| Extracted data auto-saved without explicit user review | Low | Medium | Require explicit Save action; never auto-commit without confirmation |

---

---

## Part 1 — Manual Testing

---

## 5. Manual Testing Strategy

Manual testing focuses on areas where human judgment adds value beyond what automation covers: exploratory investigation, edge cases that are hard to simulate programmatically, visual and UX quality, accessibility, and security.

### 5.1 When to Run Manual Tests

| Phase | Activity |
|---|---|
| Feature development | Developer smoke test before raising a PR |
| Code review / QA entry | QA engineer validates acceptance criteria |
| Staging deployment | Full exploratory session with real backend |
| Pre-release | Cross-browser check + final acceptance |
| Post-release | Spot check on production (critical happy path only) |

### 5.2 Test Types Covered Manually

| Type | Approach | Rationale |
|---|---|---|
| Exploratory testing | Unscripted sessions in staging against real API | Uncovers unexpected behaviours that scripted tests miss |
| Acceptance testing | Scripted test cases (this document) | Validates feature meets requirements |
| Accessibility | Manual + screen reader (NVDA / VoiceOver) + axe DevTools | WCAG 2.1 AA compliance |
| Visual / UX review | Human judgment on layout, copy, interaction feedback | Cannot be fully captured by pixel comparison alone |
| Security | Manual file upload of malicious payloads in staging | Verifies server-side defences |
| Cross-browser | Chrome, Firefox, Safari — final release sign-off | Catches rendering and API handling differences |
| Exploratory with real PDFs | Various real-world PDF documents | Validates extraction quality beyond mocked responses |

---

## 6. Manual Test Cases

> **Conventions**
>
> - **Given** = precondition
> - **When** = action performed
> - **Then** = expected observable result
> - **Priority:** P0 = must pass for release · P1 = should pass · P2 = nice to have

---

### TC-HP — Happy Path

---

**TC-HP-01 — Successful upload and full data extraction**
Priority: P0

> Given the user is on the upload page
> When they click the upload area, select a valid PDF (< 10 MB), and click "Upload & Process"
> Then a processing spinner is displayed with the message "Processing your document…"
> And after processing completes, the Extracted Data form appears
> And the Title, Author, Date, and Content Summary fields are populated with extracted values
> And no error message is shown

---

**TC-HP-02 — User edits extracted fields before saving**
Priority: P0

> Given the Extracted Data form is displayed with pre-populated values
> When the user clears the Author field and types a different name
> And the user updates the Content Summary
> Then both fields reflect the new values immediately
> And no validation error is triggered

---

**TC-HP-03 — Successful save after extraction**
Priority: P0

> Given the Extracted Data form is filled with at least a Title
> When the user clicks "Save Data"
> Then a success message "Data saved successfully!" is shown
> And the form is no longer visible
> And no error is displayed

---

**TC-HP-04 — Upload another document after successful save**
Priority: P0

> Given the success message is displayed
> When the user clicks "Upload Another Document"
> Then the upload section is shown again
> And the Upload button is disabled (no file selected)
> And the previously filled form fields are cleared

---

**TC-HP-05 — Drag and drop a valid PDF**
Priority: P1

> Given the user is on the upload page
> When they drag a valid PDF file and drop it onto the drop area
> Then the file name is shown below the drop area
> And the Upload button becomes enabled
> And no error is shown

---

### TC-FV — File Validation

---

**TC-FV-01 — Upload button disabled with no file selected**
Priority: P0

> Given the user is on the upload page with no file selected
> Then the "Upload & Process" button is visibly disabled and cannot be clicked

---

**TC-FV-02 — Select a non-PDF file (e.g. .txt)**
Priority: P0

> Given the user is on the upload page
> When they select a `.txt` file via the file picker
> Then an error message "Only PDF files are supported. Please select a valid PDF file." is shown
> And the Upload button remains disabled

---

**TC-FV-03 — Select a non-PDF file (e.g. .docx)**
Priority: P1

> Given the user is on the upload page
> When they select a `.docx` file via the file picker
> Then the same unsupported-format error is shown
> And the Upload button remains disabled

---

**TC-FV-04 — Select a PDF file over 10 MB**
Priority: P0

> Given the user is on the upload page
> When they select a PDF file whose size exceeds 10 MB
> Then an error message "File is too large. Maximum size is 10 MB." is shown
> And the Upload button remains disabled

---

**TC-FV-05 — Recover after selecting an invalid file**
Priority: P1

> Given an error is shown because an invalid file was selected
> When the user selects a valid PDF in its place
> Then the error message disappears
> And the file name is shown
> And the Upload button becomes enabled

---

**TC-FV-06 — Drag and drop a non-PDF file**
Priority: P1

> Given the user is on the upload page
> When they drag a `.jpg` or `.docx` file and drop it onto the drop area
> Then the unsupported-format error message is shown
> And the Upload button remains disabled

---

### TC-PS — Processing State

---

**TC-PS-01 — Spinner is visible while processing**
Priority: P0

> Given the user has selected a valid PDF and clicked Upload
> Then while the API call is in progress, the spinner and "Processing your document…" text are visible
> And the upload form is hidden (the user cannot interact with it during processing)

---

**TC-PS-02 — Spinner disappears after successful extraction**
Priority: P0

> Given the processing spinner is visible
> When the API returns a successful extraction response
> Then the spinner disappears
> And the Extracted Data form becomes visible with populated fields

---

**TC-PS-03 — Processing state is communicated clearly for slow responses**
Priority: P1

> Given the API takes more than 5 seconds to respond (staging condition)
> Then the spinner remains visible throughout
> And the secondary message "This may take a few seconds" is shown
> And the UI does not appear frozen or broken

---

### TC-PE — Partial Extraction

---

**TC-PE-01 — API returns only the Title field populated**
Priority: P1

> Given a PDF is uploaded
> When the API returns a response with only `title` populated and all other fields empty
> Then the Title field shows the extracted value
> And Author, Date, and Content Summary fields are empty but editable
> And the form is shown (not an error state)

---

**TC-PE-02 — API returns all fields empty**
Priority: P1

> Given a PDF is uploaded
> When the API returns a response with all fields as empty strings
> Then the Extracted Data form is displayed with all fields empty
> And the user can fill in values manually
> And the system does not treat this as an error

---

**TC-PE-03 — User manually completes a partial extraction and saves**
Priority: P1

> Given the form has a partially extracted result (e.g. only Title is populated)
> When the user fills in Author, Date, and Content Summary manually
> And clicks Save
> Then the save succeeds
> And the success message is displayed

---

### TC-EF — Extraction Failure & Error Handling

---

**TC-EF-01 — API returns 422 (extraction failed)**
Priority: P0

> Given the user has uploaded a PDF
> When the API responds with HTTP 422 and the message "Could not extract data from the document."
> Then the error section is displayed with the API's message
> And the Extracted Data form is not shown
> And the "Try Again" button is visible

---

**TC-EF-02 — API returns 500 (server error)**
Priority: P0

> Given the user has uploaded a PDF
> When the API responds with HTTP 500
> Then a user-friendly error message is displayed (not a raw stack trace or technical detail)
> And the "Try Again" button is visible

---

**TC-EF-03 — Network failure during upload**
Priority: P1

> Given the user has clicked Upload
> When the network connection is lost or times out before the API responds
> Then an appropriate error message is shown to the user
> And the "Try Again" button is visible
> And the page does not crash or show an unhandled exception

---

**TC-EF-04 — "Try Again" returns to the upload state**
Priority: P0

> Given an error message is displayed after a failed upload
> When the user clicks "Try Again"
> Then the upload section is shown again
> And the error message is hidden
> And the Upload button is disabled (no file selected yet)

---

### TC-DV — Data Editing & Save Validation

---

**TC-DV-01 — Save with empty Title field**
Priority: P0

> Given the Extracted Data form is shown with all fields pre-populated
> When the user clears the Title field and clicks "Save Data"
> Then a validation error "Title is required before saving." is displayed inline
> And the Title field receives focus
> And the user remains on the form (no navigation away)
> And the success message is not shown

---

**TC-DV-02 — Save succeeds after correcting the Title**
Priority: P0

> Given a validation error is shown because Title was empty
> When the user types a valid title and clicks "Save Data" again
> Then the error disappears
> And the save succeeds
> And the success message is shown

---

**TC-DV-03 — Save API returns 500**
Priority: P1

> Given the Extracted Data form is filled with valid data
> When the save API returns HTTP 500
> Then an inline error is shown within the form
> And the user remains on the form so they can retry
> And their edited values are preserved

---

### TC-ACC — Accessibility

---

**TC-ACC-01 — Error messages are announced by screen readers**
Priority: P1

> Given a screen reader (NVDA on Windows / VoiceOver on macOS) is active
> When an error message appears (file validation, extraction failure, save error)
> Then the screen reader announces the error without requiring the user to navigate to it
> (Verified by the `role="alert"` attribute on error elements)

---

**TC-ACC-02 — All interactive elements are keyboard-accessible**
Priority: P1

> Given the user navigates using only the keyboard (Tab, Enter, Space)
> Then they can: open the file picker, trigger upload, fill all form fields, and click Save
> Without requiring a mouse at any point

---

**TC-ACC-03 — No critical axe violations**
Priority: P1

> Given the page is open in any of its states (upload, processing, extracted, error, success)
> When an automated axe audit is run (via browser extension or axe-playwright)
> Then zero critical or serious WCAG 2.1 AA violations are reported

---

### TC-SEC — Security (Staging Only)

---

**TC-SEC-01 — Upload a file with a malicious extension disguised as PDF**
Priority: P1

> Given a file named `exploit.pdf` that is actually executable content
> When it is uploaded to the staging environment
> Then the server rejects the file based on content inspection (not just extension/MIME)
> And no error leak or server information is exposed in the response

---

**TC-SEC-02 — Upload an extremely large file to test zip bomb / resource exhaustion**
Priority: P1

> Given a file that expands massively during processing (e.g. a decompression bomb)
> When uploaded to the staging environment
> Then the system gracefully rejects or limits processing
> And the server remains responsive to other requests

---

---

## Part 2 — Test Automation

---

## 7. Automation Strategy

Automation targets **regression safety** for the scenarios that are well-defined, stable, and would be expensive to re-run manually on every pull request. It complements — not replaces — the manual work above.

### 7.1 Testing Pyramid

```
         /\
        /E2E\          ← Playwright — implemented in this repo
       /------\
      /  Integ  \      ← API contract tests (recommended: Supertest / Pact)
     /------------\
    /  Unit Tests   \  ← Validation logic, utilities (recommended: Vitest)
   /----------------\
```

The current suite sits at the **E2E layer**, exercising the full browser-to-API flow with a mocked backend. This gives maximum confidence in user-facing behaviour with minimal infrastructure.

### 7.2 What to Automate First (Priority Order)

| Priority | Scenario group | Reason |
|---|---|---|
| P0 | Happy path — upload, extract, edit, save | Core business flow; must never regress |
| P0 | File type and size validation | Pure frontend logic; fast to run; high defect probability |
| P0 | Extraction failure and retry flow | User trust depends on clear error feedback |
| P1 | Partial extraction handling | Edge case that is hard to reproduce manually with a real API |
| P1 | Save failure inline error | Regression-prone; easily broken by UI refactors |
| P2 | Cross-browser (Firefox, WebKit) | Adds confidence at low cost once Chromium suite is stable |
| P2 | Accessibility (axe-playwright) | Prevents silent regressions in ARIA attributes |

### 7.3 Tooling

| Tool | Role |
|---|---|
| **Playwright** | E2E browser automation framework |
| `page.route()` | Network-level API mocking — no backend required |
| **GitHub Actions** | CI pipeline — runs on every PR |
| Playwright HTML Reporter | Test result visualisation |
| axe-playwright *(future)* | Automated accessibility auditing |
| Supertest / Pact *(future)* | API integration and contract testing |

### 7.4 API Mocking Rationale

Real PDF processing is slow (seconds), non-deterministic, and requires backend infrastructure. By intercepting all API calls at the network layer with `page.route()`, the suite:

- Runs in **< 30 seconds** for 28 tests
- Is **fully deterministic** — no flakiness from real extraction variability
- Exercises the **complete frontend logic** including state transitions, error handling, and form population
- Requires **zero backend setup** — any developer can run it immediately after `npm install`

Real API integration is validated separately (recommended: Supertest in staging CI).

### 7.5 Selector Strategy

All automated tests use `data-testid` attributes as selectors. This decouples tests from CSS class names and DOM structure, meaning UI refactors do not break the test suite unless observable behaviour actually changes.

---

## 8. Automated Test Suite Overview

The suite is organised into three spec files, each with a focused responsibility.

### 8.1 `upload-flow.spec.ts` — Happy Path (7 tests)

Covers the end-to-end user journey from file selection through to the success state.

| Test | What it validates |
|---|---|
| Shows upload section on initial load | Entry state is correct |
| Upload button disabled until file selected | Button state driven by selection |
| Shows processing state while API is in-flight | Intermediate loading state is visible |
| Populates form with extracted data | All fields receive correct values from API |
| Saves data and shows success message | Save flow completes successfully |
| Returns to upload state via "Upload Another" | Navigation after extraction works |
| Returns to upload state after save | Navigation after save works |
| Verifies save request payload | Edited values are correctly sent to the API |

### 8.2 `file-validation.spec.ts` — File Validation (7 tests)

Covers all client-side validation rules for file selection.

| Test | What it validates |
|---|---|
| Upload button disabled on load | Initial disabled state |
| Accepts valid PDF — button enabled | Happy path selection |
| Rejects `.txt` file | Non-PDF type rejection |
| Rejects `.docx` file | Non-PDF type rejection (different MIME) |
| Rejects `.jpg` file | Non-PDF type rejection (image) |
| Rejects oversized PDF (> 10 MB) | Size limit enforcement |
| Clears error when valid PDF replaces invalid | Error recovery UX |
| Error element has `role="alert"` | Accessibility contract |

### 8.3 `data-extraction.spec.ts` — Extraction, Editing & Errors (14 tests)

Covers partial extractions, field editing, save validation, and all error paths.

| Test | What it validates |
|---|---|
| Partial extraction — only title populated | Form handles partial API response |
| All-empty extraction | Form displayed even with no data |
| All fields are editable | No read-only locks on extracted data |
| Edited values sent on save | Form values reflected in save payload |
| Save blocked when title is empty | Required-field validation |
| Error clears after valid title entered | Validation error recovery |
| Save API 500 — inline error shown | Save failure does not lose the form |
| Upload API 422 — error section shown | Extraction failure state |
| Upload API 500 — generic error shown | Server error state |
| Network failure — error shown | Network error state |
| "Try Again" returns to upload | Error recovery navigation |
| Error element has `role="alert"` | Accessibility contract |

---

## 9. Test Data Strategy

| Data | Source | Rationale |
|---|---|---|
| Valid PDF | Programmatic buffer (PDF magic bytes) | No binary committed to the repo; works offline |
| Invalid file types | Programmatic buffers with correct MIME/extension | Covers `.txt`, `.docx`, `.jpg` scenarios |
| Oversized PDF | 10 MB + 1 byte buffer with PDF header | Avoids storing large files in the repo |
| API success response | `page.route()` fulfil with fixture JSON | Deterministic; tests field-population logic |
| API error responses | `page.route()` fulfil with specific HTTP codes | Controlled simulation of 422, 500, network abort |
| Edge-case strings | Hard-coded in test (long titles, special chars) | No external dependency |

---

## 10. Running the Tests

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Run full suite (headless)
npm test

# Run with visible browser
npm run test:headed

# Open interactive Playwright UI
npm run test:ui

# View HTML report after a run
npm run report
```

Playwright automatically starts the mock app server before running and shuts it down after.

---

## 11. Quality / Release Readiness Criteria

The feature is considered **release-ready** when all of the following are met:

### Automated gates (must pass in CI)

- [ ] All P0 automated E2E tests pass — 0 failures, 0 flaky tests
- [ ] No open P0 or P1 defects

### Manual sign-off (must be completed in staging)

- [ ] All TC-HP, TC-FV, TC-PS, TC-EF, and TC-DV test cases pass
- [ ] Exploratory session completed against real API with at least 5 different real PDF documents
- [ ] Accessibility audit passes — 0 critical or serious axe violations
- [ ] Cross-browser check passed on Chrome, Firefox, and Safari
- [ ] Security review signed off (malicious upload scenarios)

### Process gates

- [ ] API contract matches frontend expectations
- [ ] Code review approved
- [ ] Product Owner has accepted the feature in staging
- [ ] Average upload-to-extraction time < 5 s for typical documents (measured in staging)

---

## 12. Test Environments

| Environment | Purpose | Backend |
| --- | --- | --- |
| Local | Developer smoke test; automated suite | Mocked via `page.route()` |
| Staging | Integration, exploratory, performance, security | Real API |
| CI (GitHub Actions) | Automated regression on every PR | Mocked via `page.route()` |

---

*Last updated: 2026-04-07*
