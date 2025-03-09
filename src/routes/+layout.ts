import { goto } from "$app/navigation";
import { getDb, globals, launchReplications } from "$lib/db";
import { db as $db } from "$lib/store-db";

export const ssr = false;
export const prerender = false;

export async function load() {
  console.debug("Loading db…")
  const { db, uiState } = await getDb();
  console.debug("Db loaded!")
  $db.set(db)
  if ((await db?.collections.documents.migrationNeeded()) && window.location.pathname != "/") {
    await goto("/");
  }
  globals.db = db;
  globals.uiState = uiState;
  let migrationNeeded = await db?.collections.documents.migrationNeeded()
  console.log("Migration needed: ", migrationNeeded, globals.db);
  if (!migrationNeeded) {
    launchReplications(globals.uiState, globals.db);
  }

  return {
    db: globals.db
  };
}
