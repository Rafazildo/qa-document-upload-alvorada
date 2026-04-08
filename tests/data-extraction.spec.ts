/**
 * data-extraction.spec.ts
 *
 * Covers the behaviour after the upload API responds:
 *   - Partial extraction (only some fields returned by the API)
 *   - Field editing
 *   - Required-field validation before saving
 *   - Save failure (API returns 500)
 *   - Extraction failure (API returns 4xx/5xx) and the retry flow
 */

import { test, expect } from '@playwright/test';
import {
  mockUploadSuccess,
  mockUploadExtractionFailure,
  mockUploadServerError,
  mockSaveSuccess,
  mockSaveFailure,
  PARTIAL_DATA,
} from './helpers/api-mocks';
import { attachPdfFile, clickUpload, clickSave } from './helpers/page-actions';

// Reusable helper: reach the extracted-data form with a standard successful upload
async function uploadAndReachForm(page: Parameters<typeof attachPdfFile>[0]) {
  await attachPdfFile(page);
  await clickUpload(page);
  await expect(page.locator('[data-testid="data-form"]')).toBeVisible();
}

test.describe('Data Extraction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  // ── Extraction results ────────────────────────────────────────────────────

  test('populates only the fields that the API returned', async ({ page }) => {
    // Assumption: the API may return a partial result — this is valid, not an error.
    // The form should render with whatever came back, leaving the rest editable.
    await mockUploadSuccess(page, PARTIAL_DATA);
    await mockSaveSuccess(page);

    await uploadAndReachForm(page);

    await expect(page.locator('[data-testid="field-title"]')).toHaveValue(PARTIAL_DATA.title);
    // Fields not returned by the API should be empty, not broken or hidden
    await expect(page.locator('[data-testid="field-author"]')).toHaveValue('');
    await expect(page.locator('[data-testid="field-date"]')).toHaveValue('');
    await expect(page.locator('[data-testid="field-content"]')).toHaveValue('');
  });

  test('all extracted fields are editable by the user', async ({ page }) => {
    // Users must be able to correct any extraction mistake before saving
    await mockUploadSuccess(page);
    await mockSaveSuccess(page);

    await uploadAndReachForm(page);

    await page.locator('[data-testid="field-title"]').fill('My Edited Title');
    await page.locator('[data-testid="field-author"]').fill('New Author');

    await expect(page.locator('[data-testid="field-title"]')).toHaveValue('My Edited Title');
    await expect(page.locator('[data-testid="field-author"]')).toHaveValue('New Author');
  });

  // ── Save validation ───────────────────────────────────────────────────────

  test('blocks save and shows an error when Title is empty', async ({ page }) => {
    // Title is the only required field. Saving without it should fail client-side
    // so the user gets immediate feedback without waiting for an API round-trip.
    await mockUploadSuccess(page);
    await mockSaveSuccess(page);

    await uploadAndReachForm(page);
    await page.locator('[data-testid="field-title"]').clear();
    await clickSave(page);

    await expect(page.locator('[data-testid="save-error"]')).toContainText('Title is required');
    // The form must stay visible so the user can fix and retry
    await expect(page.locator('[data-testid="data-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-message"]')).not.toBeVisible();
  });

  test('shows an inline error when the save API fails', async ({ page }) => {
    // If the server rejects the save, the user must see an error on the form —
    // not lose their data or get a blank screen.
    await mockUploadSuccess(page);
    await mockSaveFailure(page);

    await uploadAndReachForm(page);
    await clickSave(page);

    await expect(page.locator('[data-testid="save-error"]')).toContainText('Save failed');
    await expect(page.locator('[data-testid="data-form"]')).toBeVisible();
  });

  // ── Upload/extraction errors ──────────────────────────────────────────────

  test('shows the error section when extraction fails (422)', async ({ page }) => {
    // A 422 means the file was received but the extractor could not process it.
    // The error message from the API is shown verbatim so the user understands why.
    await mockUploadExtractionFailure(page);

    await attachPdfFile(page);
    await clickUpload(page);

    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText(
      'Could not extract data from the document.',
    );
    // The data form must not appear — there is nothing to review
    await expect(page.locator('[data-testid="data-form"]')).not.toBeVisible();
  });

  test('shows a generic error message on a server error (500)', async ({ page }) => {
    // A 500 means something unexpected happened. We show a generic message —
    // raw server errors should never be exposed to the user.
    await mockUploadServerError(page);

    await attachPdfFile(page);
    await clickUpload(page);

    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="data-form"]')).not.toBeVisible();
  });

  test('"Try Again" returns to the upload form after an error', async ({ page }) => {
    // After any failure the user must be able to start over without refreshing the page
    await mockUploadExtractionFailure(page);

    await attachPdfFile(page);
    await clickUpload(page);
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();

    await page.locator('[data-testid="retry-btn"]').click();

    await expect(page.locator('[data-testid="upload-btn"]')).toBeVisible();
    // Upload button should be disabled — no file is selected after a reset
    await expect(page.locator('[data-testid="upload-btn"]')).toBeDisabled();
    await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();
  });
});
