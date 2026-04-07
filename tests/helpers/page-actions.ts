import { Page } from '@playwright/test';

// Minimal valid PDF bytes (≈ 680 bytes)
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

/**
 * Attach a synthetic PDF file to the hidden file input.
 */
export async function attachPdfFile(
  page: Page,
  fileName = 'test-document.pdf',
): Promise<void> {
  await page.locator('[data-testid="file-input"]').setInputFiles({
    name: fileName,
    mimeType: 'application/pdf',
    buffer: MINIMAL_PDF,
  });
}

/**
 * Attach a non-PDF file (plain text) to the file input.
 */
export async function attachNonPdfFile(
  page: Page,
  fileName = 'document.txt',
): Promise<void> {
  await page.locator('[data-testid="file-input"]').setInputFiles({
    name: fileName,
    mimeType: 'text/plain',
    buffer: Buffer.from('This is not a PDF.'),
  });
}

/**
 * Attach an oversized file (> 10 MB) to the file input.
 */
export async function attachOversizedPdfFile(page: Page): Promise<void> {
  const tenMbPlusOne = Buffer.alloc(10 * 1024 * 1024 + 1, 0);
  // Prepend PDF header so the name/mime passes the PDF check
  tenMbPlusOne.write('%PDF-1.0', 0, 'ascii');

  await page.locator('[data-testid="file-input"]').setInputFiles({
    name: 'oversized.pdf',
    mimeType: 'application/pdf',
    buffer: tenMbPlusOne,
  });
}

/**
 * Click Upload and wait for the processing section to appear.
 */
export async function clickUpload(page: Page): Promise<void> {
  await page.locator('[data-testid="upload-btn"]').click();
}

/**
 * Click Save and wait for a result.
 */
export async function clickSave(page: Page): Promise<void> {
  await page.locator('[data-testid="save-btn"]').click();
}
