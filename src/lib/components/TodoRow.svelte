<script lang="ts">
  import { _, _n } from "$lib/i18n/index.svelte";
  import { preventDefault } from "svelte/legacy";

  import { createEventDispatcher, onMount } from "svelte";
  import IconaMoonClose from "virtual:icons/iconamoon/close";

  import { type TodoType } from "$lib/db";
  import { ignoreTab, renderMarkdown, getRandomId } from "$lib/ui";

  const dispatch = createEventDispatcher<{
    update: { todo: TodoType };
    delete: {};
  }>();

  interface Props {
    todo: TodoType;
    editText: boolean;
    autofocus: boolean;
    showDelete: boolean;
    onfocus: Function;
    onblur: Function;
  }

  let { todo, editText, autofocus = false, onblur, onfocus, showDelete }: Props = $props();
  let id = $state(getRandomId());
  let textarea: HTMLTextAreaElement;
  function handleChange(args = {}) {
    dispatch("update", { todo: { ...todo, ...args } });
  }
  onMount(() => {
    if (autofocus) {
      textarea.focus();
    }
  });
</script>

<div class="flex__row flex__align-start">
  <div class="flex__row flex__align-start p__block-1">
    {#key todo.text.trim() + todo.done}
      <input
        type="checkbox"
        id={`todo-${id}-done`}
        checked={todo.text.trim() && todo.done}
        onchange={(e) => {
          handleChange({ done: e.target.checked });
        }}
        disabled={!todo.text.trim()}
        aria-labelledby={editText ? `todo-${id}-text` : undefined}
      />
    {/key}
  </div>
  {#if editText}
    <textarea
      class="flex__grow | input__discrete autoresize"
      type="text"
      id={`todo-${id}-text`}
      bind:this={textarea}
      value={todo.text || ""}
      oninput={ignoreTab((e) => {
        handleChange({ text: e.target.value });
      })}
      placeholder={$_("Ajouter une nouvelle tâche…", "")}
      rows="1"
      aria-label={$_("Ajouter une nouvelle tâche…", "")}
      {onblur}
      {onfocus}
    ></textarea>
  {:else}
    <label class="flex__grow flow" for={`todo-${id}-done`}>
      {@html renderMarkdown(todo.text || "")}
    </label>
  {/if}
  {#if editText && showDelete}
    <button
      class="button__icon"
      onclick={preventDefault((e) => {
        dispatch("delete");
      })}
      aria-label={$_("Supprimer la tâche", "")}
      title={$_("Supprimer la tâche", "")}
    >
      <IconaMoonClose class="icon__size-3" height="none" width="none" role="presentation" alt="" />
    </button>
  {/if}
</div>
