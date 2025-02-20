<script lang="ts">
  import { _, _n } from "$lib/i18n/index.svelte";
  import { preventDefault } from "svelte/legacy";
  import IconaMoonClose from "virtual:icons/iconamoon/close";

  interface Props {
    anchorClass: string;
    anchorText?: string;
    anchorLabel?: string;
    title: string;
    anchor: import("svelte").Snippet;
    children: import("svelte").Snippet;
    onsubmit: Function;
    onopen?: Function;
  }

  let { anchorClass, anchorText, anchorLabel, children, anchor, onsubmit, title, onopen }: Props =
    $props();
  let dialog: HTMLDialogElement;
  let isOpen = $state(false);
</script>

<button
  type="button"
  class={anchorClass}
  aria-label={anchorLabel}
  title={anchorLabel}
  onclick={() => {
    onopen ? onopen() : null;
    isOpen = true;
    dialog.showModal();
  }}
>
  {@render anchor?.()}
  {anchorText}
</button>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog bind:this={dialog} aria-labelledby="dialog-title" aria-describedby="dialog-description" data-testid="dialog">
  <div class="scroll__wrapper">
    <header class="flex__row flex__justify-between flex__align-center p__inline-3">
      <h2 id="dialog-title" class="m__block-0">{title}</h2>

      <button
        type="button"
        class="button__icon"
        aria-label={$_("Fermer la fenêtre", "")}
        title={$_("Fermer la fenêtre", "")}
        onclick={() => {
          dialog.close();
          isOpen = false;
        }}
      >
        <IconaMoonClose
          role="presentation"
          class=" icon__size-3"
          height="none"
          width="none"
          alt=""
        />
      </button>
    </header>
    <form
      class="scroll"
      onsubmit={(e) => {
        e.preventDefault();
        onsubmit(e);
      }}
    >
      <div id="dialog-description">
        <div class="p__inline-2 | flow">
          {#if isOpen}
            {@render children?.()}
          {/if}
        </div>
      </div>
      <hr />
      <button
        type="submit"
        onclick={(e) => {
          dialog.close();
          isOpen = false;
        }}>{$_("Confirmer", "")}</button
      >
    </form>
  </div>
</dialog>
