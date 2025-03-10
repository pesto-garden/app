<script lang="ts">
  import { _, _n } from "$lib/i18n/index.svelte";
  import { type DocumentDocument, formatDate, getNoteUpdateData, removeDocument } from "$lib/db";
  import { noteToText } from "$lib/ui";
  import MainNavigationToggle from "$lib/components/MainNavigationToggle.svelte";

  import IconaMoonEdit from "virtual:icons/iconamoon/edit";
  import IconaMoonCopy from "virtual:icons/iconamoon/copy";
  import IconaMoonStar from "virtual:icons/iconamoon/star";
  import IconaMoonStarFill from "virtual:icons/iconamoon/star-fill";

  interface Props {
    note: DocumentDocument;
    pageHeader: boolean;
  }

  let { note = $bindable(), pageHeader }: Props = $props();
  let iconClass = $state(pageHeader ? "icon__size-3" : "icon__size-2")
</script>

<header>
  <div class="wrapper flex__row flex__justify-between flex__align-center">
    {#if pageHeader}
      <MainNavigationToggle class="layout__multi-hidden" />
    {/if}
  
    <h2 class="flex__grow m__block-0">
      <a href={`/my/notes/${note.id}`}>
        {#if note.title?.trim()}
          {note.title}
        {:else}
          <time datetime={note.created_at}>{formatDate(note.created_at)}</time>
        {/if}
      </a>
    </h2>
    <div>

      <a 
        class="button__icon" 
        title={$_("Éditer cette note", "")}
        aria-label={$_("Éditer cette note", "")}
        href={`/my/notes/${note.id}?view=edit`}>
        <IconaMoonEdit
          role="presentation"
          alt=""
          class={`icon ${iconClass}`}
          height="none"
          width="none"
        />
      </a>
      <button
        class="button__icon"
        type="button"
        title={$_("Copier le contenu", "")}
        aria-label={$_("Copier le contenu", "")}
        onclick={(e) => {
          navigator.clipboard.writeText(noteToText(note));
        }}
      >
        <IconaMoonCopy
          role="presentation"
          alt=""
          class={`icon ${iconClass}`}
          height="none"
          width="none"
        />
      </button>
      <button
        class="button__icon"
        type="button"
        title={note.starred ? $_("Retirer des favoris", "") : $_("Ajouter aux favoris", "")}
        aria-label={note.starred ? $_("Retirer des favoris", "") : $_("Ajouter aux favoris", "")}
        onclick={async (e) => {
          await note.incrementalUpdate({
            $set: getNoteUpdateData(note, { starred: !note.starred })
          });
          note = await note.getLatest()
        }}
      >
        {#if note.starred}
          <IconaMoonStarFill
            role="presentation"
            alt=""
            class={`icon ${iconClass}`}
            height="none"
            width="none"
          />
        {:else}
          <IconaMoonStar
            role="presentation"
            alt=""
            class={`icon ${iconClass}`}
            height="none"
            width="none"
          />
        {/if}
      </button>
    </div>
  </div>
</header>
