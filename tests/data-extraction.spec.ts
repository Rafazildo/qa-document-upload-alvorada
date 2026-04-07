/**
 * data-extraction.spec.ts
 *
 * Tests extraction outcomes and the editing/save flow:
 *   - Partial extractions (only some fields populated)
 *   - Fully empty extraction
 *   - Field editability
 *   - Required-field validation on save
 *   - Save failure handling
 *   - Extraction failure and network error handling
 *   - Retry flow after error
 */

import { test, expect } from '@playwright/test';
import {
  mockUploadSuccess,
  mockUploadExtractionFailure,
  mockUploadServerError,
  mockUploadNetworkError,
  mockSaveSuccess,
  mockSaveFailure,
  EXTRACTED_DATA,
  PARTIAL_DATA,
} from './helpers/api-mocks';
import {
  attachPdfFile,
  clickUpload,
  clickSave,
} from './helpers/page-actions';

// Reach the extracted-data form in one step
async function uploadAndExtract(page: Parameters<typeof attachPdfFile>[0]) {
  await attachPdfFile(page);
  await clickUpload(page);
  await expect(page.locator('[data-testid="data-form"]')).toBeVisible();
}

test.describe('Data Extraction — Partial & Empty Results', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('displays only the title when extraction is partial', async ({ page }) => {
    await mockUploadSuccess(page, PARTIAL_DATA);
    await mockSaveSuccess(page);

    await uploadAndExtract(page);

    await expect(page.locator('[data-testid="field-title"]')).toHaveValue(PARTIAL_DATA.title);
    await expect(page.locator('[data-testid="field-author"]')).toHaveValue('');
    await expect(page.locator('[data-testid="field-date"]')).toHaveValue('');
    await expect(page.locator('[data-testid="field-content"]')).toHaveValue('');
  });

  test('shows the form even when all extracted fields are empty', async ({ page }) => {
    await mockUploadSuccess(page, { title: '', author: '', date: '', content: '' });
    await mockSaveSuccess(page);

    await attachPdfFile(page);
    await clickUpload(page);

    await expect(page.locator('[data-testid="data-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="field-title"]')).toHaveValue('');
  });
});

test.describe('Data Extraction — Field Editing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await mockUploadSuccess(page);
    await mockSaveSuccess(page);
  });

  test('all extracted fields are editable', async ({ page }) => {
    await uploadAndExtract(page);

    await page.locator('[data-testid="field-title"]').fill('My Edited Title');
    await page.locator('[data-testid="field-author"]').fill('New Author');
    await page.locator('[data-testid="field-date"]').fill('2025-06-01');
    await page.locator('[data-testid="field-content"]').fill('Updated summary.');

    await expect(page.locator('[data-testid="field-title"]')).toHaveValue('My Edited Title');
    await expect(page.locator('[data-testid="field-author"]')).toHaveValue('New Author');
    await expect(page.locator('[data-testid="field-date"]')).toHaveValue('2025-06-01');
    await expect(page.locator('[data-testid="field-content"]')).toHaveValue('Updated summary.');
  });

  test('edited values are preserved when save is successful', async ({ page }) => {
    let savedBody: Record<string, string> = {};

    await page.route('**/api/save', async (route) => {
      savedBody = JSON.parse(route.request().postData() ?? '{}');
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await uploadAndExtract(page);

    await page.locator('[data-testid="field-title"]').fill('Custom Title');
    await page.locator('[data-testid="field-author"]').fill('Custom Author');
    await clickSave(page);

    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    expect(savedBody.title).toBe('Custom Title');
    expect(savedBody.author).toBe('Custom Author');
  });
});

test.describe('Data Extraction — Save Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await mockUploadSuccess(page);
    await mockSaveSuccess(page);
  });

  test('shows error when saving with an empty title', async ({ page }) => {
    await uploadAndExtract(page);

    await page.locator('[data-testid="field-title"]').clear();
    await clickSave(page);

    await expect(page.locator('[data-testid="save-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="save-error"]')).toContainText('Title is required');
    // Should stay on the form, not navigate away
    await expect(page.locator('[data-testid="data-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-message"]')).not.toBeVisible();
  });

  test('clears save error when a valid title is entered and saved', async ({ page }) => {
    await uploadAndExtract(page);

    // Trigger validation error
    await page.locator('[data-testid="field-title"]').clear();
    await clickSave(page);
    await expect(page.locator('[data-testid="save-error"]')).toBeVisible();

    // Fix the title and save again
    await page.locator('[data-testid="field-title"]').fill('A Valid Title');
    await clickSave(page);

    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="save-error"]')).not.toBeVisible();
  });
});

test.describe('Data Extraction — Save Failure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows inline error when the save API returns 500', async ({ page }) => {
    await mockUploadSuccess(page);
    await mockSaveFailure(page);

    await uploadAndExtract(page);
    await clickSave(page);

    await expect(page.locator('[data-testid="save-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="save-error"]')).toContainText('Save failed');
    // User stays on the form so they can retry
    await expect(page.locator('[data-testid="data-form"]')).toBeVisible();
  });
});

test.describe('Extraction Failure & Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows error section on 422 extraction failure', async ({ page }) => {
    await mockUploadExtractionFailure(page);

    await attachPdfFile(page);
    await clickUpload(page);

    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText(
      'Could not extract data from the document.',
    );
    await expect(page.locator('[data-testid="data-form"]')).not.toBeVisible();
  });

  test('shows a generic error on 500 server error', async ({ page }) => {
    await mockUploadServerError(page);

    await attachPdfFile(page);
    await clickUpload(page);

    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    // Should not expose raw stack traces to the user
    await expect(page.locator('[data-testid="data-form"]')).not.toBeVisible();
  });

  test('shows an error when there is a network failure', async ({ page }) => {
    await mockUploadNetworkError(page);

    await attachPdfFile(page);
    await clickUpload(page);

    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="data-form"]')).not.toBeVisible();
  });

  test('"Try Again" button after error returns to the upload section', async ({ page }) => {
    await mockUploadExtractionFailure(page);

    await attachPdfFile(page);
    await clickUpload(page);

    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();

    await page.locator('[data-testid="retry-btn"]').click();

    await expect(page.locator('[data-testid="upload-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();
    // Upload button should be disabled again (no file selected)
    await expect(page.locator('[data-testid="upload-btn"]')).toBeDisabled();
  });

  test('error message element has role=alert for accessibility', async ({ page }) => {
    await mockUploadExtractionFailure(page);

    await attachPdfFile(page);
    await clickUpload(page);

    const errorEl = page.locator('[data-testid="error-message"]');
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toHaveAttribute('role', 'alert');
  });
});
