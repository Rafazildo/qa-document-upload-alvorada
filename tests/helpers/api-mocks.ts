import { Page, Route } from '@playwright/test';

// ── Canonical mock responses ──────────────────────────────────────────────

export const EXTRACTED_DATA = {
  title:   'Technical Specification v2.1',
  author:  'Jane Smith',
  date:    '2024-03-15',
  content: 'This document describes the architecture of the new data pipeline.',
};

export const PARTIAL_DATA = {
  title:   'Untitled Document',
  author:  '',
  date:    '',
  content: '',
};

// ── Route helpers ─────────────────────────────────────────────────────────

/** Mock a successful upload → extraction. */
export async function mockUploadSuccess(
  page: Page,
  data: typeof EXTRACTED_DATA = EXTRACTED_DATA,
) {
  await page.route('**/api/upload', (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });
  });
}

/** Mock an extraction failure (422 Unprocessable Entity). */
export async function mockUploadExtractionFailure(page: Page) {
  await page.route('**/api/upload', (route: Route) => {
    route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Could not extract data from the document.' }),
    });
  });
}

/** Mock a server error on upload (500). */
export async function mockUploadServerError(page: Page) {
  await page.route('**/api/upload', (route: Route) => {
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Internal server error' }),
    });
  });
}

/** Mock a network-level failure (no response). */
export async function mockUploadNetworkError(page: Page) {
  await page.route('**/api/upload', (route: Route) => {
    route.abort('failed');
  });
}

/** Mock a successful save. */
export async function mockSaveSuccess(page: Page) {
  await page.route('**/api/save', (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
}

/** Mock a save failure (500). */
export async function mockSaveFailure(page: Page) {
  await page.route('**/api/save', (route: Route) => {
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Save failed. Please try again.' }),
    });
  });
}
