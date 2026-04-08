/**
 * page-actions.ts
 *
 * Reusable helpers for common UI interactions.
 * Keeping these here avoids repeating low-level Playwright calls in every test
 * and makes the test files read like plain English.
 */

import { Page } from '@playwright/test';

// Minimal valid PDF content (~680 bytes).
// Using a programmatic buffer means we don't need to commit a binary fixture file.
const MINIMAL_PDF = Buffer.from(
  '%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj ' +
  '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj ' +
  '3 0 obj<</Type/Page/MediaBox[0 0 612 792]>>endobj\n' +
  'xref\n0 4\n' +
  '0000000000 65535 f \n' +
  '0000000009 00000 n \n' +
  '0000000058 00000 n \n' +
  '0000000115 00000 n \n' +
  'trailer<</Size 4/Root 1 0 R>>\n' +
  'startxref\n190\n%%EOF',
);

/** Attach a valid PDF to the (hidden) file input. */
export async function attachPdfFile(page: Page, fileName = 'test-document.pdf') {
  await page.locator('[data-testid="file-input"]').setInputFiles({
    name: fileName,
    mimeType: 'application/pdf',
    buffer: MINIMAL_PDF,
  });
}

/** Attach a plain-text file — used to trigger the "wrong file type" validation path. */
export async function attachNonPdfFile(page: Page, fileName = 'document.txt') {
  await page.locator('[data-testid="file-input"]').setInputFiles({
    name: fileName,
    mimeType: 'text/plain',
    buffer: Buffer.from('This is not a PDF.'),
  });
}

/** Attach a PDF that exceeds the 10 MB size limit — triggers the size validation path. */
export async function attachOversizedPdfFile(page: Page) {
  // Allocate 10 MB + 1 byte and prepend a PDF header so only the size check fails
  const oversized = Buffer.alloc(10 * 1024 * 1024 + 1, 0);
  oversized.write('%PDF-1.0', 0, 'ascii');

  await page.locator('[data-testid="file-input"]').setInputFiles({
    name: 'oversized.pdf',
    mimeType: 'application/pdf',
    buffer: oversized,
  });
}

/** Click the Upload button. */
export async function clickUpload(page: Page) {
  await page.locator('[data-testid="upload-btn"]').click();
}

/** Click the Save button. */
export async function clickSave(page: Page) {
  await page.locator('[data-testid="save-btn"]').click();
}
