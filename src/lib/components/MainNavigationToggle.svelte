<script lang="ts">
  import { _, _n } from "$lib/i18n/index.svelte";
  import type { HTMLBaseAttributes } from "svelte/elements";

  import { globals } from "$lib/db";
  import IconaMoonMenuBurgerHorizontal from "virtual:icons/iconamoon/menu-burger-horizontal";
  import IconaMoonClose from "virtual:icons/iconamoon/close";
  import { tick } from "svelte";
  interface Props extends HTMLBaseAttributes {}
  let { ...restProps } = $props();
  let sidebarFullpage = $state(false);

  const observable = globals.uiState.get$("currentPage");
  observable.subscribe(async (newValue: string) => {
    sidebarFullpage = newValue === "mainMenu";
    if (sidebarFullpage) {
      await tick();
      window.scrollTo(0, 0);
    }
  });
</script>

<button
  type="button"
  class={"button__transparent button__icon " + restProps.class || ""}
  aria-label={sidebarFullpage
    ? $_("Fermer le menu principal", "")
    : $_("Ouvrir le menu principal", "")}
  onclick={() => {
    if (sidebarFullpage) {
      globals.uiState.set("currentPage", () => null);
    } else {
      globals.uiState.set("currentPage", () => "mainMenu");
    }
  }}
>
  {#if sidebarFullpage}
    <IconaMoonClose role="presentation" alt="" />
  {:else}
    <IconaMoonMenuBurgerHorizontal role="presentation" alt="" />
  {/if}
</button>
