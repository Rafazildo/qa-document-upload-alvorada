/**
 * file-validation.spec.ts
 *
 * Tests client-side file validation:
 *   - Only PDF files accepted
 *   - File size limit enforced
 *   - Error messages are displayed correctly
 *   - Upload button state reflects selection validity
 */

import { test, expect } from '@playwright/test';
import {
  attachPdfFile,
  attachNonPdfFile,
  attachOversizedPdfFile,
} from './helpers/page-actions';

test.describe('File Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('upload button is disabled on page load with no file selected', async ({ page }) => {
    await expect(page.locator('[data-testid="upload-btn"]')).toBeDisabled();
  });

  test('accepts a valid PDF and enables the upload button', async ({ page }) => {
    await attachPdfFile(page, 'report.pdf');

    await expect(page.locator('[data-testid="upload-btn"]')).toBeEnabled();
    await expect(page.locator('[data-testid="file-error"]')).not.toBeVisible();
    // File name is displayed to the user
    await expect(page.locator('#file-name-display')).toContainText('report.pdf');
  });

  test('rejects a .txt file and shows an error', async ({ page }) => {
    await attachNonPdfFile(page, 'notes.txt');

    await expect(page.locator('[data-testid="file-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-error"]')).toContainText('Only PDF files are supported');
    await expect(page.locator('[data-testid="upload-btn"]')).toBeDisabled();
  });

  test('rejects a .docx file and shows an error', async ({ page }) => {
    await page.locator('[data-testid="file-input"]').setInputFiles({
      name: 'document.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: Buffer.from('PK\x03\x04'), // DOCX magic bytes
    });

    await expect(page.locator('[data-testid="file-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-error"]')).toContainText('Only PDF files are supported');
    await expect(page.locator('[data-testid="upload-btn"]')).toBeDisabled();
  });

  test('rejects an image file and shows an error', async ({ page }) => {
    await page.locator('[data-testid="file-input"]').setInputFiles({
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('\xFF\xD8\xFF'), // JPEG magic bytes
    });

    await expect(page.locator('[data-testid="file-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-error"]')).toContainText('Only PDF files are supported');
  });

  test('rejects an oversized PDF (> 10 MB) and shows a size error', async ({ page }) => {
    await attachOversizedPdfFile(page);

    await expect(page.locator('[data-testid="file-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-error"]')).toContainText('too large');
    await expect(page.locator('[data-testid="upload-btn"]')).toBeDisabled();
  });

  test('clears the error when a valid PDF is selected after an invalid file', async ({ page }) => {
    // First select an invalid file
    await attachNonPdfFile(page);
    await expect(page.locator('[data-testid="file-error"]')).toBeVisible();

    // Then select a valid PDF
    await attachPdfFile(page);
    await expect(page.locator('[data-testid="file-error"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="upload-btn"]')).toBeEnabled();
  });

  test('error message is accessible (role=alert)', async ({ page }) => {
    await attachNonPdfFile(page);

    const errorEl = page.locator('[data-testid="file-error"]');
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toHaveAttribute('role', 'alert');
  });
});
