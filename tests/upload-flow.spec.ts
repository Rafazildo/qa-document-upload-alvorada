/**
 * upload-flow.spec.ts
 *
 * Tests the end-to-end happy path:
 *   select PDF → upload → processing state → extracted data shown → edit → save → success
 */

import { test, expect } from '@playwright/test';
import {
  mockUploadSuccess,
  mockSaveSuccess,
  EXTRACTED_DATA,
} from './helpers/api-mocks';
import {
  attachPdfFile,
  clickUpload,
  clickSave,
} from './helpers/page-actions';

test.describe('Upload Flow — Happy Path', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows upload section on initial load', async ({ page }) => {
    await expect(page.locator('[data-testid="upload-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-input"]')).toBeAttached();
    await expect(page.locator('[data-testid="processing-section"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="data-form"]')).not.toBeVisible();
  });

  test('upload button is disabled until a file is selected', async ({ page }) => {
    await expect(page.locator('[data-testid="upload-btn"]')).toBeDisabled();

    await attachPdfFile(page);

    await expect(page.locator('[data-testid="upload-btn"]')).toBeEnabled();
  });

  test('shows processing state while the API call is in-flight', async ({ page }) => {
    // Delay the API response so we can assert the intermediate state
    await page.route('**/api/upload', async (route) => {
      await new Promise(r => setTimeout(r, 300));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EXTRACTED_DATA),
      });
    });
    await mockSaveSuccess(page);

    await attachPdfFile(page);
    await clickUpload(page);

    await expect(page.locator('[data-testid="processing-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="processing-status"]')).toContainText('Processing');

    // Upload section should be hidden during processing
    await expect(page.locator('[data-testid="upload-btn"]')).not.toBeVisible();
  });

  test('populates form with extracted data after successful upload', async ({ page }) => {
    await mockUploadSuccess(page);
    await mockSaveSuccess(page);

    await attachPdfFile(page);
    await clickUpload(page);

    await expect(page.locator('[data-testid="data-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="field-title"]')).toHaveValue(EXTRACTED_DATA.title);
    await expect(page.locator('[data-testid="field-author"]')).toHaveValue(EXTRACTED_DATA.author);
    await expect(page.locator('[data-testid="field-date"]')).toHaveValue(EXTRACTED_DATA.date);
    await expect(page.locator('[data-testid="field-content"]')).toHaveValue(EXTRACTED_DATA.content);
  });

  test('saves data and shows success message', async ({ page }) => {
    await mockUploadSuccess(page);
    await mockSaveSuccess(page);

    await attachPdfFile(page);
    await clickUpload(page);

    await expect(page.locator('[data-testid="data-form"]')).toBeVisible();
    await clickSave(page);

    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-message"]')).toContainText('saved successfully');
  });

  test('returns to upload state when "Upload Another" is clicked', async ({ page }) => {
    await mockUploadSuccess(page);
    await mockSaveSuccess(page);

    await attachPdfFile(page);
    await clickUpload(page);

    await expect(page.locator('[data-testid="data-form"]')).toBeVisible();
    await page.locator('[data-testid="upload-another-btn"]').click();

    await expect(page.locator('[data-testid="upload-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="upload-btn"]')).toBeDisabled();
    await expect(page.locator('[data-testid="data-form"]')).not.toBeVisible();
  });

  test('returns to upload state after successful save via "Upload Another Document"', async ({ page }) => {
    await mockUploadSuccess(page);
    await mockSaveSuccess(page);

    await attachPdfFile(page);
    await clickUpload(page);
    await expect(page.locator('[data-testid="data-form"]')).toBeVisible();
    await clickSave(page);

    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();

    await page.locator('[data-testid="new-upload-btn"]').click();

    await expect(page.locator('[data-testid="upload-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="data-form"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="success-message"]')).not.toBeVisible();
  });

  test('intercepts and verifies the save request payload', async ({ page }) => {
    await mockUploadSuccess(page);

    let capturedPayload: Record<string, string> | null = null;
    await page.route('**/api/save', async (route) => {
      capturedPayload = JSON.parse(route.request().postData() ?? '{}');
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await attachPdfFile(page);
    await clickUpload(page);
    await expect(page.locator('[data-testid="data-form"]')).toBeVisible();

    // Edit one field before saving
    await page.locator('[data-testid="field-author"]').fill('Updated Author');

    await clickSave(page);
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();

    expect(capturedPayload).toMatchObject({
      title:  EXTRACTED_DATA.title,
      author: 'Updated Author',
      date:   EXTRACTED_DATA.date,
    });
  });
});
