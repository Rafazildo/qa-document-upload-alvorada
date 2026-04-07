# Test Strategy — Document Upload & Data Extraction

## 1. Overview

This document describes the test strategy for the **Document Upload & Data Extraction** feature. The feature allows users to upload PDF files, have structured data extracted automatically, review and edit that data, and save it into downstream workflows.

---

## 2. Scope

### In Scope

| Area | Coverage |
|---|---|
| PDF file upload (UI) | File selection, drag-and-drop, type/size validation |
| Upload API (`POST /api/upload`) | Success response, error codes, payload validation |
| Processing state | Loading indicator visibility, timeout handling |
| Data extraction | Field population, partial extractions, empty results |
| Data editing | Field editability, input constraints |
| Save API (`POST /api/save`) | Success, failure, required-field validation |
| Error handling | Network errors, extraction failures, server errors |
| Navigation flows | Retry, upload another, post-save state |

### Out of Scope

- Authentication / authorisation (assumed handled by a separate auth layer)
- PDF rendering or preview inside the browser
- Downstream systems that consume saved data
- Mobile native apps (web responsive only)
- Performance benchmarks beyond basic load time assertions

---

## 3. Assumptions

1. The application runs a **web frontend** (HTML/JS/CSS) against a **REST API**.
2. PDF processing is **asynchronous** and may take up to 30 seconds; the UI polls or awaits a response.
3. The API can return partial extractions (some fields populated, others empty) — this is a valid success state.
4. File size limit is **10 MB**; the API enforces this server-side as well.
5. No authentication is required for the scope of this test plan; user sessions are assumed valid.
6. Extraction failures return a structured JSON error body: `{ "message": "..." }`.
7. The target browser baseline is the **latest stable Chromium**; Firefox and Safari are included for regression.

---

## 4. Testing Approach

### 4.1 Testing Pyramid

```
         /\
        /E2E\          ← Playwright (this suite)
       /------\
      /  Integ  \      ← API-level tests (future: Supertest / Pactum)
     /------------\
    /  Unit Tests   \  ← Business logic, validators (future: Jest/Vitest)
   /----------------\
```

For this deliverable the focus is **E2E tests** that exercise the full browser-to-mock-API flow, which provides the highest confidence in the user-facing behaviour with the least setup overhead.

### 4.2 Types of Testing

| Type | Tool / Approach | Priority |
|---|---|---|
| **End-to-end (E2E)** | Playwright | P0 — implemented in this repo |
| **API integration** | Supertest / Pactum | P1 — recommended next step |
| **Unit** | Jest / Vitest | P2 — for utility/validation functions |
| **Visual regression** | Playwright snapshots | P2 — after UI stabilises |
| **Accessibility** | axe-playwright | P1 — WCAG 2.1 AA compliance |
| **Performance** | Playwright tracing + Core Web Vitals | P2 |
| **Security** | OWASP ZAP / manual | P1 — file upload attack surface |
| **Load / stress** | k6 | P2 — for upload endpoint |

### 4.3 Manual vs. Automated

| Scenario | Manual | Automated |
|---|---|---|
| Happy path upload and save | ✓ (smoke) | ✓ (regression) |
| File type/size validation | ✗ | ✓ |
| Processing spinner visibility | ✓ (first time) | ✓ |
| Extraction failure messages | ✓ (exploratory) | ✓ |
| Editing extracted fields | ✗ | ✓ |
| Large or malformed PDFs | ✓ | Partial (fixture-based) |
| Cross-browser visual check | ✓ (release) | ✓ (Playwright multi-project) |
| Accessibility audit | ✓ | ✓ (axe) |
| Security (malicious files) | ✓ | Partial |

---

## 5. Key Test Scenarios

### 5.1 Happy Path

| # | Scenario | Expected Result |
|---|---|---|
| HP-01 | User selects a valid PDF and clicks Upload | Processing spinner appears |
| HP-02 | API returns extracted data | Form populated with title, author, date, content |
| HP-03 | User edits an extracted field | Field reflects new value |
| HP-04 | User clicks Save with valid data | Success message displayed |
| HP-05 | User clicks "Upload Another" | Returns to initial upload state |

### 5.2 File Validation

| # | Scenario | Expected Result |
|---|---|---|
| FV-01 | No file selected — Upload clicked | Error: "Please select a file" |
| FV-02 | Non-PDF file selected (e.g. `.txt`, `.docx`) | Error: "Only PDF files are supported" |
| FV-03 | PDF file > 10 MB | Error: "File is too large" |
| FV-04 | Valid PDF selected | File name shown; Upload button enabled |
| FV-05 | Drag & drop a valid PDF | Same as FV-04 |
| FV-06 | Drag & drop a non-PDF file | Error shown inline |

### 5.3 Processing State

| # | Scenario | Expected Result |
|---|---|---|
| PS-01 | Upload started | Spinner and "Processing…" text visible |
| PS-02 | Upload section hidden during processing | Upload form not visible |
| PS-03 | API responds — spinner disappears | Extracted data section becomes visible |

### 5.4 Extraction Failure

| # | Scenario | Expected Result |
|---|---|---|
| EF-01 | API returns 422 (extraction failed) | Error message displayed with API message |
| EF-02 | API returns 500 (server error) | Generic error message shown |
| EF-03 | Network timeout / no response | Timeout error message shown |
| EF-04 | User clicks "Try Again" after error | Returns to upload state |

### 5.5 Partial Extraction

| # | Scenario | Expected Result |
|---|---|---|
| PE-01 | API returns only `title` (others empty) | Title populated; other fields empty and editable |
| PE-02 | API returns all empty fields | All fields empty; form still displayed |
| PE-03 | User fills in missing fields manually | Save succeeds with user-entered values |

### 5.6 Data Editing & Validation

| # | Scenario | Expected Result |
|---|---|---|
| DV-01 | Save with empty required `title` field | Error: "Title is required" |
| DV-02 | Clear pre-filled title and save | Same error as DV-01 |
| DV-03 | Modify all fields before saving | All modified values saved |

### 5.7 Save Failure

| # | Scenario | Expected Result |
|---|---|---|
| SF-01 | Save API returns 500 | Inline error shown; user stays on form |
| SF-02 | Save API returns network error | Inline error shown |

---

## 6. Test Data Strategy

| Data Type | Source | Notes |
|---|---|---|
| Valid PDF fixture | `fixtures/sample.pdf` | Minimal valid PDF, < 1 KB |
| Invalid file types | Generated in tests via Buffer | `.txt`, `.docx`, `.jpg` |
| Oversized PDF | Generated in tests (10 MB + 1 byte Buffer) | Avoids large binary in repo |
| API responses (success) | Mocked via `page.route()` | Deterministic extraction data |
| API responses (error) | Mocked via `page.route()` | Controlled error scenarios |
| Edge-case strings | Hard-coded in test | Very long title, special chars, Unicode |

**Why mocking?** Real PDF processing can be slow (seconds), non-deterministic, and requires infrastructure. Mocking the API at the network layer (Playwright `route()`) keeps tests fast, isolated, and reliable while still exercising the full frontend logic.

---

## 7. Quality / Release Readiness Criteria

The feature is considered **release-ready** when:

- [ ] All P0 automated E2E tests pass in CI (0 failures, 0 flaky tests)
- [ ] API contract matches frontend expectations (validated by integration tests)
- [ ] No open P0/P1 bugs
- [ ] Error messages are user-friendly and actionable (manual review)
- [ ] Accessibility audit passes (WCAG 2.1 AA — 0 critical violations)
- [ ] Average upload-to-extraction time < 5 s for typical documents (measured in staging)
- [ ] The feature works correctly in Chrome, Firefox, and Safari
- [ ] Code review approved with security considerations sign-off
- [ ] Product Owner has accepted the feature in staging

---

## 8. Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Extraction returns incorrect/partial data silently | High | High | Validate structured output against a schema; alert on low-confidence extractions |
| Large files cause upload timeouts | Medium | High | Enforce size limit client-side + server-side; show progress indicator; implement chunked upload |
| Malicious PDF uploads (e.g. embedded scripts, zip bombs) | Medium | Critical | Server-side content-type validation; antivirus scan before processing; sandbox the extractor |
| Processing service unavailable | Low | High | Circuit breaker pattern; user-facing error with retry; queue-based processing with status polling |
| Data loss if user navigates away during extraction | High | Medium | Warn user on beforeunload; consider auto-save draft |
| Flaky E2E tests due to timing issues | Medium | Medium | Use `waitFor` assertions; avoid hard-coded sleeps; mock async delays |
| API contract drift (frontend/backend desync) | Medium | High | Contract tests (e.g. Pact); share OpenAPI spec as source of truth |
| Extracted data saved without user review | Low | Medium | Require explicit Save action; never auto-save without user confirmation |

---

## 9. Test Environment

| Environment | Purpose |
|---|---|
| Local (mocked API) | Developer testing; this Playwright suite |
| Staging (real API) | Integration, exploratory, and performance testing |
| CI (GitHub Actions) | Automated regression on every PR |

---

## 10. Automation Tooling

| Tool | Role |
|---|---|
| **Playwright** | E2E browser automation |
| `page.route()` | API mocking at the network layer |
| GitHub Actions | CI pipeline |
| Playwright HTML Reporter | Test result visualisation |

---

*Last updated: 2026-04-07*
