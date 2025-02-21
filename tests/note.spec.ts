import { expect, test, type Page } from '@playwright/test';

const DEFAULT_TIMEOUT = 200

async function navigateTo(page: Page, text: string) {
	await toggleMenu(page)
	await page.locator("aside nav").getByText(text, {exact: true}).click()
	await page.waitForTimeout(DEFAULT_TIMEOUT);
}

async function toggleMenu(page: Page) {
	return await page.getByTestId('menu-toggle').locator('visible=true').click()
}

async function createNote(page: Page, params = {title: "", content: "" }) {
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

test('add note and render it as markdown', async ({ page }) => {
	await page.goto('/');
	await navigateTo(page, 'Nouvelle note')
	
	const content = page.getByLabel('Contenu');
	
	await content.fill("bonjour **le monde**");
	await page.waitForTimeout(DEFAULT_TIMEOUT);
	await page.getByText('Enregistrer', {exact: true}).click()

	const note = page.locator("article").getByText("bonjour");
	const html = await note.innerHTML()
	await expect(html).toBe("bonjour <strong>le monde</strong>")
});

test('add note and edit it', async ({ page }) => {
	await createNote(page, {content: "bonjour **le monde**"})
	
	// now edit it
	page.locator("article").getByTestId("dropdown-anchor").click();
	page.locator("article").getByTestId("dropdown-content").getByText("Éditer cette note").click();
	
	let content = page.getByLabel('Contenu');
	
	await content.fill("foo **bar**");
	await page.waitForTimeout(DEFAULT_TIMEOUT);
	await page.getByTitle('Voir cette note', {exact: true}).click()
	
	const note = await page.locator("article .prose")
	const html = await note.innerHTML()
	await expect(html).toBe("<!----><p>foo <strong>bar</strong></p>\n<!---->")
});


test('search note', async ({ page }) => {
	await createNote(page, {content: "bonjour **le monde**"})
	await createNote(page, {content: "foo **bar**"})
	
	await navigateTo(page, 'Toutes les notes')
	await page.waitForTimeout(DEFAULT_TIMEOUT);
	let search = await page.locator(`input[type="search"]`)
	await search.focus()
	await search.fill("foo")
	await search.press("Enter")
	await page.waitForTimeout(DEFAULT_TIMEOUT);
	
	expect(await page.locator("article").count()).toBe(1)
	
});


test('add note and delete it', async ({ page }) => {
	await createNote(page, {content: "bonjour **le monde**"})
	
	await navigateTo(page, "Toutes les notes")
	// now delete it
	await page.locator("article").getByTestId("dropdown-anchor").click();
	await page.locator("article").getByTestId("dropdown-content").getByText("Supprimer", {exact: true}).click();
	await page.getByTestId("dialog").locator('visible=true').getByText("Confirmer").click();
	
	expect(await page.locator("article").count()).toBe(0)

});

test('add note and fav/unfav it', async ({ page }) => {
	await createNote(page, {content: "bonjour **le monde**"})
	
	await navigateTo(page, "Favoris")
	expect(await page.locator("article").count()).toBe(0)

	await navigateTo(page, "Toutes les notes")

	await page.locator("article").getByTestId("dropdown-anchor").click();
	await page.locator("article").getByTestId("dropdown-content").getByText("Ajouter aux favoris", {exact: true}).click();
	
	await navigateTo(page, "Favoris")
	expect(await page.locator("article").count()).toBe(1)
	
	await page.locator("article").getByTestId("dropdown-anchor").click();
	await page.locator("article").getByTestId("dropdown-content").getByText("Retirer des favoris", {exact: true}).click();
	expect(await page.locator("article").count()).toBe(0)
	
});