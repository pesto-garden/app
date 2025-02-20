<script lang="ts">
  import { onMount } from "svelte";
  import type { HTMLBaseAttributes } from "svelte/elements";
  interface Props extends HTMLBaseAttributes {
    children: import("svelte").Snippet;
    control: import("svelte").Snippet;
    controlClass?: string;
  }
  let el;
  let { children, control, controlClass, ...restProps }: Props = $props();
</script>

<details
  bind:this={el}
  class={"hide-for-print dropdown " + (restProps.class || "")}
  onfocusout={(event) => {
    if (el.contains(event.relatedTarget)) return;
    el.open = false;
  }}
  data-testid="dropdown"
>
  <summary class={controlClass} data-testid="dropdown-anchor">
    {@render control?.()}
  </summary>
  <ul data-testid="dropdown-content">
    {@render children?.()}
  </ul>
</details>
