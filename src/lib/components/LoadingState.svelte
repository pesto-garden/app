<script lang="ts">
  import IconaMoonSettings from "virtual:icons/iconamoon/settings";

  interface Props {
    children: import("svelte").Snippet;
    isLoading: boolean;
  }

  let { children, isLoading = $bindable() }: Props = $props();
</script>

{#if isLoading}
  <div class="flex__column flex__align-center p__block-2">
    <IconaMoonSettings
      role="presentation"
      alt=""
      height="none"
      width="none"
      class="rotating icon__size-4"
    />
    <em>{@render children?.()}</em>
  </div>
{/if}
