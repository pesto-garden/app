<script lang="ts">
  import { _, _n } from "$lib/i18n/index.svelte";
  import { timeAgo } from "$lib/db";
  import type { HTMLTimeAttributes } from "svelte/elements";
  import { onDestroy, onMount } from "svelte";
  interface Props extends HTMLTimeAttributes {
    date: string;
    anchor?: string;
  }

  let key = $state(0)
  let interval = null
  let { date, anchor, ...restProps }: Props = $props();
  onMount(() => {
    interval = setInterval(() => {
      key += 1
    }, 10000)
  })
  onDestroy(() => {
    clearInterval(interval)
  })
</script>

{#key key}
  <time datetime={date} {...restProps}>
    {#if anchor}
      {anchor.replace('%ago', timeAgo(date))}
    {:else}
      {timeAgo(date)}
    {/if}
  </time>
{/key}