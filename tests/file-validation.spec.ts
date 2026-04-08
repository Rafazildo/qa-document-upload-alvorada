/**
 * file-validation.spec.ts
 *
 * Covers client-side file validation before the upload even hits the API.
 * All checks happen in the browser as soon as the user selects a file,
 * so no API mock is needed here.
 */

import { test, expect } from '@playwright/test';
import { attachPdfFile, attachNonPdfFile, attachOversizedPdfFile } from './helpers/page-actions';

test.describe('File Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('upload button is disabled until a file is selected', async ({ page }) => {
    // On initial load there is no file — the button must be disabled
    // to prevent the user from triggering an empty upload request.
    await expect(page.locator('[data-testid="upload-btn"]')).toBeDisabled();
  });

  test('accepts a valid PDF and enables the upload button', async ({ page }) => {
    await attachPdfFile(page, 'report.pdf');

    // The selected file name should be shown so the user can confirm their choice
    await expect(page.locator('#file-name-display')).toContainText('report.pdf');
    await expect(page.locator('[data-testid="upload-btn"]')).toBeEnabled();
    await expect(page.locator('[data-testid="file-error"]')).not.toBeVisible();
  });

  test('rejects a non-PDF file and shows an error', async ({ page }) => {
    // We test with .txt as a representative non-PDF type.
    // The same validation logic applies to .docx, .jpg, etc.
    await attachNonPdfFile(page, 'notes.txt');

    await expect(page.locator('[data-testid="file-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-error"]')).toContainText('Only PDF files are supported');
    // Button must stay disabled — the user cannot proceed with an invalid file
    await expect(page.locator('[data-testid="upload-btn"]')).toBeDisabled();
  });

  test('rejects an oversized PDF and shows a size error', async ({ page }) => {
    // Anything over 10 MB should be caught before reaching the server
    await attachOversizedPdfFile(page);

    await expect(page.locator('[data-testid="file-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-error"]')).toContainText('too large');
    await expect(page.locator('[data-testid="upload-btn"]')).toBeDisabled();
  });

  test('clears the error when a valid PDF replaces an invalid file', async ({ page }) => {
    // Users should be able to recover from a wrong selection without refreshing
    await attachNonPdfFile(page);
    await expect(page.locator('[data-testid="file-error"]')).toBeVisible();

    await attachPdfFile(page);
    await expect(page.locator('[data-testid="file-error"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="upload-btn"]')).toBeEnabled();
  });
});
