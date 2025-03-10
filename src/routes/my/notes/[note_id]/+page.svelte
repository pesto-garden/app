<script lang="ts">
  import { _, _n } from "$lib/i18n/index.svelte";
  import RenderedNote from "$lib/components/RenderedNote.svelte";
  import RenderedNoteHeader from "$lib/components/RenderedNoteHeader.svelte";
  import NoteForm from "$lib/components/NoteForm.svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { formatDate, type DocumentDocument } from "$lib/db.js";
  import { title } from "$lib/store";
  let { data } = $props();

  let note: DocumentDocument = $state(data.note);
  let viewQuery: "detail" | "edit" = $state("detail");

  title.set(note.title || formatDate(note.created_at));
  $effect(() => {
    viewQuery = $page.url.searchParams.get("view") || "detail";
  });
</script>

{#if note}
  <main class="flex__grow">
    {#if viewQuery === "edit"}
      <NoteForm
        {note}
        collection={null}
        on:update={(e) => {
          note = e.detail.note;
        }}
        on:delete={(e) => {
          goto("/my");
        }}
      />
    {:else}
      <div class="with_sticky_header background__secondary">
        {#key note._rev}
          <RenderedNoteHeader {note} pageHeader={true} onDelete={() => goto("/my")} />
        {/key}

        <div class="scroll">
          {#key note._rev}
            <div class="wrapper p__inline-3 p__block-3">
              <RenderedNote
                {note}
                limitSize={false}
                class="diary__note card flow"
                onDelete={() => goto("/my")}
                includeHeader={false}
              ></RenderedNote>
            </div>
          {/key}
        </div>
      </div>
    {/if}
  </main>
{:else}
  <main class="wrapper p__inline-3 | flex__grow">
    <p>{$_("Cette note n'existe pas.", "")}</p>
  </main>
{/if}
