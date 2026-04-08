/**
 * upload-flow.spec.ts
 *
 * Covers the end-to-end happy path:
 *   select PDF → upload → processing state → extracted data form → edit → save → success
 *
 * The API is mocked at the network layer so the suite runs without a real backend.
 */

import { test, expect } from '@playwright/test';
import { mockUploadSuccess, mockSaveSuccess, EXTRACTED_DATA } from './helpers/api-mocks';
import { attachPdfFile, clickUpload, clickSave } from './helpers/page-actions';

test.describe('Upload Flow — Happy Path', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows the upload form on initial load', async ({ page }) => {
    // Sanity check: the page should start in the upload state
    await expect(page.locator('[data-testid="upload-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="processing-section"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="data-form"]')).not.toBeVisible();
  });

  test('upload button is disabled until a file is selected', async ({ page }) => {
    await expect(page.locator('[data-testid="upload-btn"]')).toBeDisabled();

    await attachPdfFile(page);

    await expect(page.locator('[data-testid="upload-btn"]')).toBeEnabled();
  });

  test('shows a processing spinner while the upload is in progress', async ({ page }) => {
    // Delay the mock response slightly so we can assert the intermediate loading state
    await page.route('**/api/upload', async (route) => {
      await new Promise(r => setTimeout(r, 300));
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EXTRACTED_DATA) });
    });

    await attachPdfFile(page);
    await clickUpload(page);

    // The spinner must be visible and the upload form must be hidden during processing —
    // otherwise the user could submit a second upload by mistake
    await expect(page.locator('[data-testid="processing-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-btn"]')).not.toBeVisible();
  });

  test('populates the form with all extracted fields after a successful upload', async ({ page }) => {
    await mockUploadSuccess(page);

    await attachPdfFile(page);
    await clickUpload(page);

    // Every field returned by the API should be reflected in the form
    await expect(page.locator('[data-testid="data-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="field-title"]')).toHaveValue(EXTRACTED_DATA.title);
    await expect(page.locator('[data-testid="field-author"]')).toHaveValue(EXTRACTED_DATA.author);
    await expect(page.locator('[data-testid="field-date"]')).toHaveValue(EXTRACTED_DATA.date);
    await expect(page.locator('[data-testid="field-content"]')).toHaveValue(EXTRACTED_DATA.content);
  });

  test('saves the data and shows a success message', async ({ page }) => {
    await mockUploadSuccess(page);
    await mockSaveSuccess(page);

    await attachPdfFile(page);
    await clickUpload(page);
    await expect(page.locator('[data-testid="data-form"]')).toBeVisible();

    await clickSave(page);

    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-message"]')).toContainText('saved successfully');
  });

  test('returns to the upload state when "Upload Another" is clicked', async ({ page }) => {
    await mockUploadSuccess(page);
    await mockSaveSuccess(page);

    await attachPdfFile(page);
    await clickUpload(page);
    await expect(page.locator('[data-testid="data-form"]')).toBeVisible();

    await page.locator('[data-testid="upload-another-btn"]').click();

    // The page should be back to its initial state, ready for a new file
    await expect(page.locator('[data-testid="upload-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-btn"]')).toBeDisabled();
    await expect(page.locator('[data-testid="data-form"]')).not.toBeVisible();
  });
});
