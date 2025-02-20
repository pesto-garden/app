import { expect, test, type Page } from '@playwright/test';

const DEFAULT_TIMEOUT = 200
async function toggleMenu(page: Page) {
	return await page.getByTestId('menu-toggle').locator('visible=true').click()
}

async function createNote(page: Page, params = {title: null, content: null, }) {
	await page.goto('/my/notes/add');
	if (params.title) {
		let title = page.getByLabel('Titre');
		await title.fill(params.title);
	}
	if (params.content) {
		let content = page.getByLabel('Contenu');
		await content.fill(params.content);
	}
	await page.waitForTimeout(DEFAULT_TIMEOUT);
	await page.getByText('Enregistrer', {exact: true}).click()
}
test('home page has no notes', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByText('0 notes trouvées')).toBeVisible();
});

test('navigation add note and render it as markdown', async ({ page }) => {
	await page.goto('/');
	await toggleMenu(page)
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

test('navigation add note and edit it', async ({ page }) => {
	await page.goto('/');
	await createNote(page, {content: "hellow **world**"})
	
	// now edit it
	page.locator("article").getByTestId("dropdown-anchor").click();
	page.locator("article").getByTestId("dropdown-content").getByText("Éditer cette note").click();
	
	let content = page.getByLabel('Contenu');
	
	await content.fill("foo **bar**");
	await page.waitForTimeout(DEFAULT_TIMEOUT);
	await page.getByTitle('Voir cette note', {exact: true}).click()
	
	const note = page.locator("article .prose")
	const html = await note.innerHTML()
	await expect(html).toBe("<!----><p>foo <strong>bar</strong></p>\n<!---->")
});