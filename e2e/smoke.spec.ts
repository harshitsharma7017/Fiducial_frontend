import { expect, test, type Page } from '@playwright/test';

// Mock mode's demo admin (src/lib/server/mock-mode.ts).
const ADMIN = {
  email: 'demo.admin@example.com',
  password: 'Fiducial-demo-2026',
  firstName: 'Asha',
};

async function expectDashboard(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toContainText(ADMIN.firstName);
  await expect(page.getByText('Open proposals')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Proposals' })).toBeVisible();
  // The admin's permissions include the Admin group.
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Audit log' })).toBeVisible();
}

test('signs in as the demo admin and shows the dashboard in light and dark', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // The browser prefers light and the theme follows the system by default.
  await expectDashboard(page);
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);

  await page.getByRole('button', { name: 'Theme' }).click();
  await page.getByRole('menuitemradio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);

  // The choice is kept, and applied before the page paints: no light flash on reload.
  await page.reload({ waitUntil: 'domcontentloaded' });
  expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);
  await expectDashboard(page);

  expect(pageErrors).toEqual([]);
});

// Employee Benefits (GMC, GPA, GTLI), claims and their reports moved to fiducial-ghi-frontend,
// whose smoke test opens them; this app's navigation has none of them.
test('has no Employee Benefits or claims entries in the navigation', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Proposals' })).toBeVisible();
  for (const label of [
    'GMC (Group Health)',
    'GPA (Personal Accident)',
    'GTLI (Term Life)',
    'Claims',
    'Claims analysis',
    'Renewal analysis',
    'Family plans',
    'Age bands',
  ]) {
    await expect(nav.getByRole('link', { name: label, exact: true })).toHaveCount(0);
  }
});
