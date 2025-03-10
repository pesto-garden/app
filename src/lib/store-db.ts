import { writable } from "svelte/store";
import { globals } from "./db";

function createDb() {
  const { subscribe, set } = writable(null);
  return {
    subscribe,
    set
  };
}

function createForms() {
  const { subscribe, set } = writable({});
  db.subscribe(($db) => {
    if (!$db) {
      return;
    }
    console.debug("[store] forms init", globals.db.documents);
    globals.db.documents
      .find({
        limit: 20000,
        selector: { type: "form" }
      })
      .$.subscribe((v) => {
        let d = {};
        for (const document of v) {
          d[document.data.id] = document.data;
        }
        set(d);
      });
  });

  return {
    subscribe,
    set,
    clear: () => {
      set({});
    }
  };
}

export const db = createDb();
export const forms = createForms();
