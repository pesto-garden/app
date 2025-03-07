<script lang="ts">
  import { _, _n } from "$lib/i18n/index.svelte";
  import { getRandomId } from "$lib/ui";
  import type { HTMLBaseAttributes } from "svelte/elements";
  interface Props extends HTMLBaseAttributes {
    children: import("svelte").Snippet;
    expanded?: boolean;
    limitSize?: boolean;
  }

  let id = getRandomId();
  let { children, expanded = false, limitSize = true, ...restProps }: Props = $props();
</script>

<div class={restProps.class} data-expanded={!limitSize || expanded} {id}>
  {@render children?.()}
</div>
{#if limitSize}
  <button
    aria-expanded={expanded}
    aria-controls={id}
    class="button__secondary hide-for-print"
    type="button"
    onclick={() => (expanded = !expanded)}
  >
    {#if expanded}{$_("Replier", "")}{:else}{$_("Déplier", "")}{/if}
  </button>
{/if}
