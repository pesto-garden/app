import { expect, test } from '@playwright/test';

const DEFAULT_TIMEOUT = 200
test('home page has no notes', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByText('0 notes trouvées')).toBeVisible();
});

test('navigation add note and render it as markdown', async ({ page }) => {
	await page.goto('/');
	const link = await page.locator("a").getByText('Nouvelle note', {exact: true})
	await link.click()
	const content = page.getByLabel('Contenu');
	
	await content.fill("Hello **world**");
	await page.waitForTimeout(DEFAULT_TIMEOUT);
	await page.getByText('Enregistrer', {exact: true}).click()

	const note = page.locator("article").getByText("Hello");
	const html = await note.innerHTML()
	await expect(html).toBe("Hello <strong>world</strong>")
	
});