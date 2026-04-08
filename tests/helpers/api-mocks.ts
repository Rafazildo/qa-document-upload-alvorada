/**
 * api-mocks.ts
 *
 * Intercepts HTTP calls to /api/upload and /api/save using Playwright's
 * page.route() so the tests run without a real backend.
 *
 * Each helper registers a route handler for a specific scenario.
 * Call the relevant mock at the start of a test, before navigating or
 * clicking Upload, so the handler is in place when the request fires.
 */

import { Page, Route } from '@playwright/test';

// ── Sample data returned by a successful extraction ───────────────────────

export const EXTRACTED_DATA = {
  title:   'QA engineering for interviews',
  author:  'Rafael Oliveira',
  date:    '2026-04-08',
  content: 'This document describes how to do your best in QA interviews.',
};

// Represents a partial extraction — the API returned only the title
export const PARTIAL_DATA = {
  title:   'Untitled Document',
  author:  '',
  date:    '',
  content: '',
};

// ── Upload mocks ──────────────────────────────────────────────────────────

/** Successful upload: the API extracted data and returned it as JSON. */
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

/** Extraction failure: the file was received but could not be processed (422). */
export async function mockUploadExtractionFailure(page: Page) {
  await page.route('**/api/upload', (route: Route) => {
    route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Could not extract data from the document.' }),
    });
  });
}

/** Server error: something unexpected happened on the backend (500). */
export async function mockUploadServerError(page: Page) {
  await page.route('**/api/upload', (route: Route) => {
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Internal server error' }),
    });
  });
}

// ── Save mocks ────────────────────────────────────────────────────────────

/** Successful save: the API accepted and stored the data. */
export async function mockSaveSuccess(page: Page) {
  await page.route('**/api/save', (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
}

/** Save failure: the server rejected the request (500). */
export async function mockSaveFailure(page: Page) {
  await page.route('**/api/save', (route: Route) => {
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Save failed. Please try again.' }),
    });
  });
}
