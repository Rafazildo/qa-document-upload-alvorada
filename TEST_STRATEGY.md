# Test Strategy — Document Upload & Data Extraction

## 1. Overview

This document covers the test strategy for the **Document Upload & Data Extraction** feature. Users can upload PDF files, have structured data extracted automatically, review and edit that data, and save it to downstream workflows.

The strategy is split into two blocks:

1. **Manual Testing** — acceptance test cases, exploratory testing, and cross-cutting concerns
2. **Test Automation** — Playwright E2E suite covering the highest-value regression scenarios

---

## 2. Scope

### In scope

| Area | What we test |
|---|---|
| PDF file upload (UI) | File selection, type and size validation |
| Upload API (`POST /api/upload`) | Success, extraction failure, server error |
| Processing state | Spinner visibility while the API call is pending |
| Extracted data form | Field population (full and partial), editing, required-field validation |
| Save API (`POST /api/save`) | Success and failure |
| Error handling | Inline errors, error section, retry flow |

### Out of scope

- Authentication (assumed handled by a separate auth layer)
- PDF rendering/preview inside the browser
- Downstream systems that consume the saved data
- Mobile native apps

---

## 3. Assumptions

1. The app has a web frontend backed by a REST API.
2. PDF processing may take up to 30 seconds; the UI shows a loading state while waiting.
3. The API may return **partial extractions** — some fields populated, others empty. This is valid, not an error.
4. File size limit is **10 MB**, enforced client-side and server-side.
5. API extraction failures return `{ "message": "..." }` with a 4xx/5xx status.
6. User sessions are assumed valid; authentication is not tested here.

---

## 4. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Extraction returns incorrect data silently | High | High | Validate output against a schema; surface low-confidence results to the user |
| Large files cause timeouts with no feedback | Medium | High | Enforce size limit before upload; show progress |
| Processing service unavailable | Low | High | User-facing error with retry; queue-based fallback |
| User navigates away mid-extraction | High | Medium | `beforeunload` warning; consider draft persistence |
| API contract drift (frontend/backend desync) | Medium | High | Share OpenAPI spec; add contract tests when the API stabilises |

---

---

## Part 1 — Manual Testing

---

## 5. When and What to Test Manually

Manual testing covers areas where human judgment adds value: exploratory investigation, UX quality, cross-browser rendering, and real PDF documents that automated mocks cannot replicate.

| When | Activity |
|---|---|
| Before raising a PR | Developer smoke test on the happy path |
| QA entry | Run the test cases below against staging |
| Pre-release | Cross-browser check (Chrome, Firefox, Safari) |
| Post-release | Spot check the happy path on production |

| Type | Approach |
|---|---|
| Acceptance | Scripted test cases in this document |
| Exploratory | Unscripted sessions in staging with real PDFs |
| Visual / UX | Human review of layout, copy, and interaction feedback |
| Cross-browser | Chrome, Firefox, Safari at release time |

---

## 6. Manual Test Cases

> **Given** = precondition · **When** = action · **Then** = expected result
> **P0** = must pass for release · **P1** = should pass

---

### TC-HP — Happy Path

**TC-HP-01 — Full upload and extraction flow** `P0`

> Given the user is on the upload page
>
> When they select a valid PDF and click "Upload & Process"
>
> Then a processing spinner appears with the text "Processing your document…"
>
> And once complete, the Extracted Data form appears with Title, Author, Date, and Content populated

**TC-HP-02 — Edit extracted fields and save** `P0`

> Given the Extracted Data form is visible with pre-filled values
>
> When the user edits any field and clicks "Save Data"
>
> Then the success message "Data saved successfully!" is shown
>
> And the form is no longer visible

**TC-HP-03 — Upload another document** `P0`

> Given the success message is displayed
>
> When the user clicks "Upload Another Document"
>
> Then the upload section reappears, the Upload button is disabled, and the form is cleared

**TC-HP-04 — Drag and drop a valid PDF** `P1`

> Given the user is on the upload page
>
> When they drag a valid PDF onto the drop area
>
> Then the file name appears and the Upload button becomes enabled

---

### TC-FV — File Validation

**TC-FV-01 — No file selected** `P0`

> Given the user is on the upload page with no file selected
>
> Then the Upload button is disabled and cannot be clicked

**TC-FV-02 — Non-PDF file selected** `P0`

> Given the user selects a `.txt` or `.docx` file
>
> Then the error "Only PDF files are supported" appears and the Upload button stays disabled

**TC-FV-03 — PDF exceeds 10 MB** `P0`

> Given the user selects a PDF larger than 10 MB
>
> Then the error "File is too large. Maximum size is 10 MB." appears and Upload stays disabled

**TC-FV-04 — Recover after invalid selection** `P1`

> Given an error is shown for an invalid file
>
> When the user selects a valid PDF
>
> Then the error disappears and the Upload button becomes enabled

---

### TC-PS — Processing State

**TC-PS-01 — Spinner visible during processing** `P0`

> Given the user clicks Upload with a valid PDF
>
> Then the spinner and processing message are visible while the API responds
>
> And the upload form is hidden so the user cannot re-trigger it

**TC-PS-02 — Spinner disappears after extraction** `P0`

> Given the processing spinner is visible
>
> When the API returns successfully
>
> Then the spinner disappears and the Extracted Data form is shown

---

### TC-PE — Partial Extraction

**TC-PE-01 — API returns only some fields** `P1`

> Given a PDF is uploaded and the API returns only the Title populated
>
> Then the Title field shows the extracted value, and the other fields are empty but editable
>
> And the form is displayed (not an error)

**TC-PE-02 — All fields empty** `P1`

> Given the API returns all fields as empty strings
>
> Then the form still displays with all fields empty
>
> And the user can fill them in manually and save

---

### TC-EF — Extraction Failure & Errors

**TC-EF-01 — Extraction fails (422)** `P0`

> Given the user uploads a PDF and the API returns 422
>
> Then the error section shows the API's message and a "Try Again" button

**TC-EF-02 — Server error (500)** `P0`

> Given the API returns 500
>
> Then a user-friendly error is displayed — no raw stack traces or technical details

**TC-EF-03 — "Try Again" resets the flow** `P0`

> Given the error section is visible
>
> When the user clicks "Try Again"
>
> Then the upload section reappears with the Upload button disabled

---

### TC-DV — Data Editing & Save Validation

**TC-DV-01 — Save blocked without a Title** `P0`

> Given the Extracted Data form is visible
>
> When the user clears the Title field and clicks Save
>
> Then the validation error "Title is required" is shown inline and the user stays on the form

**TC-DV-02 — Save API fails** `P1`

> Given the save API returns 500
>
> Then an inline error appears on the form
>
> And the user's edited values are preserved so they can retry

---

---

## Part 2 — Test Automation

---

## 7. Automation Approach

The automated suite targets **regression safety** — scenarios that are well-defined, stable, and too slow to re-run manually on every PR. It complements manual testing; it doesn't replace it.

```
     /\
    /E2E\        ← Playwright (this repo)
   /------\
  / Integ  \     ← API contract tests (future: Supertest)
 /----------\
/ Unit Tests  \  ← Validators, utilities (future: Vitest)
```

**Why API mocking?** Real PDF processing is slow and non-deterministic. By intercepting HTTP calls with `page.route()`, the suite runs in under 30 seconds, needs no backend, and produces deterministic results. Real API integration is validated separately in staging.

**Selectors:** All tests use `data-testid` attributes, decoupling them from CSS and DOM structure.

---

## 8. Test Files

| File | Focus |
|---|---|
| `upload-flow.spec.ts` | Full happy path: select → upload → extract → edit → save |
| `file-validation.spec.ts` | Client-side file type and size validation |
| `data-extraction.spec.ts` | Partial extraction, field editing, save validation, error handling |

---

## 9. Test Data

| Data | How it's created |
|---|---|
| Valid PDF | Programmatic buffer with PDF magic bytes — no binary in the repo |
| Invalid file types | Small buffer with the correct MIME/extension for each type |
| Oversized PDF | 10 MB + 1 byte buffer with a PDF header |
| API responses | `page.route()` with fixture JSON or specific HTTP status codes |

---

## 10. Release Readiness

The feature is ready to ship when:

### Automated (CI gate)

- [ ] All E2E tests pass with 0 failures
- [ ] No open P0 bugs

### Manual (staging sign-off)

- [ ] All P0 test cases above pass
- [ ] Exploratory session run with at least 3 real PDF documents
- [ ] Cross-browser check passed on Chrome, Firefox, and Safari
- [ ] Average upload-to-extraction time is acceptable (< 10 s for typical documents)

### Process

- [ ] Code review approved
- [ ] Product Owner accepted in staging

---

*Last updated: 2026-04-08*
