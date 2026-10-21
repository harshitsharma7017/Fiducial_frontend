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

// N1: the GPA list opens from the Employee Benefits group; in demo mode it reads no live data.
test('opens the GPA cases page from Employee Benefits in demo mode', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const nav = page.getByRole('navigation', { name: 'Main' });
  await nav.getByRole('link', { name: 'GPA (Personal Accident)' }).click();
  await expect(page).toHaveURL(/\/eb\/gpa$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Not available in demo mode')).toBeVisible();

  expect(pageErrors).toEqual([]);
});

// N4: the Age Band Master opens from Masters; in demo mode it reads no live data.
test('opens Masters → Age bands in demo mode', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto('/masters/age-bands');
  await expect(page.getByText('Not available in demo mode')).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Age bands' })).toBeVisible();

  expect(pageErrors).toEqual([]);
});
