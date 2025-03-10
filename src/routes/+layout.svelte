<script>
  import "../style.css";
  import { afterNavigate } from "$app/navigation";
  import { trackRouteChange } from "$lib/plausible";
  import { page } from "$app/stores";
  import { dev } from "$app/environment";
  import { globals } from "$lib/db";
  import { languagesById, defaultLanguage } from "$lib/i18n";
  import { onMount } from "svelte";
  import { title } from "$lib/store";

  import { lang, parsedTranslations } from "$lib/i18n/stores";
  title.set("");
  /**
   * @typedef {Object} Props
   * @property {import('svelte').Snippet} [children]
   */

  /** @type {Props} */
  let { children } = $props();

  let telemetryEnabled = $state(true);

  afterNavigate(() => {
    globals.uiState.set("currentPage", () => null);
    if (telemetryEnabled) {
      console.debug("Tracking page view");
      trackRouteChange($page);
    }
  });

  function setBodyClass(e) {
    let vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    if (vw < 700) {
      document.body.setAttribute("data-layout", "single-column");
    } else {
      document.body.setAttribute("data-layout", "multi-columns");
    }
  }
  window.addEventListener("resize", setBodyClass);

  setBodyClass();

  // to avoid firefox crashing locally because service worker can't register
  onMount(async () => {
    $lang = globals.uiState.language || window.navigator.language;
    if (!languagesById[$lang]) {
      $lang = defaultLanguage;
    }
    globals.uiState.get$("telemetryEnabled").subscribe((value) => {
      telemetryEnabled = value === undefined ? true : value;
    });
    if (dev) {
      console.warn("Will not register service worker in dev mode.");
    } else {
      if ("serviceWorker" in navigator) {
        console.info("Registering service worker…");
        navigator.serviceWorker.register("/service-worker.js", {
          type: dev ? "module" : "classic"
        });
      }
    }
  });
  $effect(() => {
    if ($lang != defaultLanguage) {
      import(`../lib/i18n/messages/${$lang}.po.json`).then((r) => {
        $parsedTranslations[$lang] = r;
      });
    }
    document.documentElement.setAttribute("lang", $lang);
  });
</script>

<svelte:head>
  <title>{$title}</title>
</svelte:head>

{@render children?.()}
