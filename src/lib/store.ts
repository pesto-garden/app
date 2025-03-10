import { writable } from "svelte/store";

function createTitle() {
  const { subscribe, set, update } = writable("");

  return {
    subscribe,
    set: (value: string) => {
      let parts = [value, "Pesto", "Grow your own garden"].filter((p) => {
        return p && p.trim();
      });
      set(parts.join(" • "));
    },
    clear: () => {
      set("Pesto");
    }
  };
}

export const title = createTitle();
