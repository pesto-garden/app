import { expect, test, type Page } from "@playwright/test";

const DEFAULT_TIMEOUT = 200;

async function searchComplete(page: Page, expected: number, query: string) {
  let match = await page
    .getByTestId("matching-count")
    .locator("visible=true")
  
  await expect(match).toContainText(String(expected))
  await expect(match).toHaveAttribute("data-query", query)
}

async function noteSaved(page: Page) {
  await page.getByTestId("note-saved-ago").locator("visible=true").getByText("1 seconde").waitFor();
}

async function navigateTo(page: Page, text: string) {
  await toggleMenu(page);
  await page.locator("aside nav").getByText(text, { exact: true }).click();
  await expect(page.locator("aside nav").locator("visible=true")).toHaveCount(0);
}

async function toggleMenu(page: Page) {
  return await page.getByTestId("menu-toggle").locator("visible=true").click();
}

async function createNote(page: Page, params = { title: "", content: "" }) {
  await page.goto("/my/notes/add");
  if (params.title) {
    let title = page.getByLabel("Titre");
    await title.fill(params.title);
  }
  if (params.content) {
    let content = page.locator("form").getByLabel("Contenu", {exact: true});
    await content.fill(params.content);
  }
  await noteSaved(page);
}

test("home page has no notes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("journal est vide")).toBeVisible();
});

test("add note and render it as markdown", async ({ page }) => {
  await page.goto("/");
  await navigateTo(page, "Nouvelle note");

  const content = page.locator("form").getByLabel("Contenu", {exact: true});

  await content.fill("bonjour **le monde**");
  await noteSaved(page);
  await navigateTo(page, "Toutes les notes");

  const note = page.locator("article").getByText("bonjour");
  const html = await note.innerHTML();
  await expect(html).toBe("bonjour <strong>le monde</strong>");
});

test("add note and edit it", async ({ page }) => {
  await createNote(page, { content: "bonjour **le monde**" });
  await navigateTo(page, "Toutes les notes");

  // now edit it
  await page.locator("article").getByLabel("Éditer").click();

  let content = page.locator("form").getByLabel("Contenu", {exact: true});

  await content.fill("foo **bar**");
  await noteSaved(page);
  await page.waitForTimeout(DEFAULT_TIMEOUT);
  await page.getByTitle("Voir cette note", { exact: true }).click();
  await page.waitForTimeout(DEFAULT_TIMEOUT);

  const note = await page.locator("article .prose");
  await note.waitFor();
  const html = await note.innerHTML();
  await expect(html).toBe("<!----><p>foo <strong>bar</strong></p>\n<!---->");
});

test("search note", async ({ page }) => {
  await createNote(page, { content: "bonjour **le monde**" });
  await createNote(page, { content: "foo **bar**" });

  await navigateTo(page, "Toutes les notes");
  await searchComplete(page, 2, "");
  
  let search = await page.locator(`input[type="search"]`);
  await search.focus();
  await search.fill("foo");
  await search.press("Enter");
  await searchComplete(page, 1, "foo");

  expect(await page.locator("article").count()).toBe(1);
});

test("add note and delete it", async ({ page }) => {
  await createNote(page, { content: "bonjour **le monde**" });

  await navigateTo(page, "Toutes les notes");
  // now delete it
  await page
    .locator("article")
    .getByLabel("Éditer")
    .click();
  await page
    .locator("header")
    .getByLabel("Supprimer")
    .click();
  await page.getByTestId("dialog").locator("visible=true").getByText("Confirmer").click();

  expect(await page.locator("article").count()).toBe(0);
});

test("add note and fav/unfav it", async ({ page }) => {
  await createNote(page, { content: "bonjour **le monde**" });

  await navigateTo(page, "Favoris");
  expect(await page.locator("article").count()).toBe(0);

  await navigateTo(page, "Toutes les notes");

  await page
    .locator("article")
    .getByLabel("Ajouter aux favoris", { exact: true })
    .click();

  await navigateTo(page, "Favoris");
  await searchComplete(page, 1, "starred:true");
  expect(await page.locator("article").count()).toBe(1);

  await page
    .locator("article")
    .getByLabel("Retirer des favoris", { exact: true })
    .click();
  expect(await page.locator("article").count()).toBe(0);
});

test("hashtag rendering and search", async ({ page }) => {
  await createNote(page, { content: "#évènement +joyeux" });
  await createNote(page, { content: "#évènement -triste" });

  await navigateTo(page, "Toutes les notes");
  await searchComplete(page, 2, "");

  expect(await page.locator("article").count()).toBe(2);

  await page.locator("article").getByText("#évènement").first().click();
  await searchComplete(page, 2, "tag:évènement");

  expect(await page.locator("article").count()).toBe(2);
  expect(await page.locator(`input[type="search"]`)).toHaveValue("tag:évènement");

  await navigateTo(page, "Toutes les notes");
  await searchComplete(page, 2, "");
  expect(await page.locator("article").count()).toBe(2);

  await page.locator("article").getByText("-triste").first().click();
  await searchComplete(page, 1, "tag:triste");

  expect(await page.locator("article").count()).toBe(1);
  expect(await page.locator(`input[type="search"]`)).toHaveValue("tag:triste");
});

test("hashtag autocompletion", async ({ page }) => {
  await createNote(page, { content: "#évènement +joyeux #idée #idéal #autre" });

  await navigateTo(page, "Nouvelle note");
  const content = page.locator("form").getByLabel("Contenu", {exact: true});

  await content.fill("+j");

  expect(await page.getByTestId("autocomplete-option").count()).toBe(1);
  await page.getByTestId("autocomplete-option").getByText("+joyeux").click();

  expect(content).toHaveValue("+joyeux");

  await content.pressSequentially(" #id");
  expect(await page.getByTestId("autocomplete-option").count()).toBe(2);
  await content.press("ArrowDown");
  expect(content).toHaveValue("+joyeux #idée");
  await content.press("ArrowDown");
  expect(content).toHaveValue("+joyeux #idéal");

  // echap should close the dropdown
  await content.pressSequentially(" #id");
  await content.press("Escape");

  await expect(page.getByTestId("autocomplete-option").locator("visible=true")).toHaveCount(0);
});

test("note text editor unordered list", async ({ page }) => {
  await page.goto("/my/notes/add");
  const content = page.locator("form").getByLabel("Contenu", {exact: true});

  // unordered list
  await content.fill("- Bonjour");
  await content.press("Enter");

  // a new dash should have been added
  expect(content).toHaveValue(`- Bonjour\n- `);

  // new line on empty dash : removes the dash
  await content.press("Enter");
  expect(content).toHaveValue(`- Bonjour\n`);
});

test("note text editor ordered list", async ({ page }) => {
  await page.goto("/my/notes/add");
  const content = page.locator("form").getByLabel("Contenu", {exact: true});

  // unordered list
  await content.fill("1. Bonjour");
  await content.press("Enter");

  // a new dash should have been added
  expect(content).toHaveValue(`1. Bonjour\n2. `);

  // new line on empty dash : removes the dash
  await content.press("Enter");
  expect(content).toHaveValue(`1. Bonjour\n`);
});
