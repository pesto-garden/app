<script lang="ts">
  import { _, _n } from "$lib/i18n/index.svelte";

  import IconaMoonTrash from "virtual:icons/iconamoon/trash";
  import IconaMoonEye from "virtual:icons/iconamoon/eye";
  import FragmentEditor from "./FragmentEditor.svelte";
  import TimeAgo from "./TimeAgo.svelte";
  import IconaMoonFileDocument from "virtual:icons/iconamoon/file-document";
  import MainNavigationToggle from "./MainNavigationToggle.svelte";
  import { createEventDispatcher, onDestroy } from "svelte";
  import {
    type DocumentDocument,
    type DocumentType,
    globals,
    getNewNote,
    buildUniqueId,
    getNewFormFragment,
    getNoteUpdateData,
    formatTimeShort,
  } from "$lib/db";
  import sortBy from "lodash/sortBy";
  import DialogForm from "./DialogForm.svelte";
  import { clearSubscriptions } from "$lib/ui";

  const dispatch = createEventDispatcher<{
    update: { note: DocumentDocument };
    delete: { note: DocumentDocument };
  }>();

  interface Props {
    note: DocumentDocument | null;
    collection: string | null;
    children?: import("svelte").Snippet;
    onSubmitHandler?: Function;
  }

  let { note, collection, children, onSubmitHandler }: Props = $props();
  let columns: string[] = $state([]);
  let forms: DocumentType[] = $state([]);
  let localNote: DocumentDocument | null = $state(note);
  let selectedForm: null | undefined | string = $state(undefined);
  $effect(() => {
    selectedForm = localNote?.fragments?.form?.id;
  });
  function handleUpdate(n: DocumentDocument) {
    dispatch("update", { note: n });
  }

  let subscriptions = [
    globals.db?.documents
      .findOne({ selector: { id: "settings:board" } })
      .$.subscribe((settings) => {
        columns = settings?.data.columns || [
          $_("À faire", "Colonne du tableau"),
          $_("En cours", "Colonne du tableau"),
          $_("Terminé", "Colonne du tableau")
        ];
      }),
    globals.db.documents
      .find({
        limit: 20000,
        selector: { type: "form" }
      })
      .$.subscribe((documents) => {
        forms = sortBy(
          documents.map((d) => {
            return d.toMutableJSON();
          }),
          ["data.name"]
        );
      })
  ];

  onDestroy(clearSubscriptions(subscriptions));
</script>

<div class="scroll__wrapper">
  <header class="flex__row flex__justify-between flex__align-center p__inline-3">
    <MainNavigationToggle class="layout__multi-hidden" />
    <h2 class="flex__grow">
      {#if localNote}
        {$_("Éditer cette note", "")}
      {:else}
        {$_("Nouvelle note", "")}
      {/if}
    </h2>

    <div>
      {#if localNote}
        <a
          class="button__icon button layout__multi-hidden"
          href={`/my/notes/${localNote.id}?view=detail`}
          aria-label={$_("Voir cette note", "")}
          title={$_("Voir cette note", "")}
        >
          <IconaMoonEye
            role="presentation"
            alt=""
            class=" icon__size-3"
            height="none"
            width="none"
          />
        </a>
      {/if}
      {#if forms.length > 0}
        {#snippet formIcon()}
          <IconaMoonFileDocument
            role="presentation"
            class=" icon__size-3"
            height="none"
            width="none"
            alt=""
          />
        {/snippet}
        <DialogForm
          anchorClass="button__icon"
          anchorLabel={$_("Ajouter un formulaire", "")}
          anchor={formIcon}
          title={$_("Ajouter un formulaire", "")}
          onsubmit={async (e: SubmitEvent) => {
            if (!localNote) {
              let noteData = getNewNote();
              noteData.id = buildUniqueId();
              localNote = await globals.db.documents.insert(noteData);
            }
            let updateData = {
              fragments: { ...(localNote.fragments || {}) }
            };
            if (selectedForm) {
              updateData.fragments.form = getNewFormFragment(selectedForm, {}, {});
            } else {
              updateData.fragments.form = undefined;
            }
            await localNote.incrementalUpdate({
              $set: getNoteUpdateData(localNote, updateData)
            });
            localNote = await localNote.getLatest();
            e.preventDefault();
          }}
        >
          <div class="form__field">
            <label for="form-id">{$_("Formulaire", "")}</label>
            <select name="form-id" id="form-id" bind:value={selectedForm}>
              <option value={undefined}>---</option>
              {#each forms as form}
                <option value={form.data.id}>{form.data.name}</option>
              {/each}
            </select>
          </div>
          <p>{$_("Attacher ce formulaire à la note.", "")}</p>
        </DialogForm>
      {/if}
      {#if localNote}
        {#snippet trashIcon()}
          <IconaMoonTrash
            role="presentation"
            class=" icon__size-3"
            height="none"
            width="none"
            alt=""
          />
        {/snippet}
        <DialogForm
          anchorClass="button__icon"
          anchorLabel={$_("Supprimer cette note", "")}
          anchor={trashIcon}
          title={$_("Supprimer cette note ?", "")}
          onsubmit={(e: SubmitEvent) => {
            e.preventDefault();
            localNote.remove();
            dispatch("delete", { note: localNote });
          }}
        >
          <p>This will remove the note from your diary. This action is irreversible.</p>
        </DialogForm>
      {/if}
    </div>
  </header>
  <form class="flow | scroll" onsubmit={(e) => onSubmitHandler?.(e)}>
    <div class="wrapper p__inline-3  p__block-3">
      <FragmentEditor
        note={localNote}
        {columns}
        {collection}
        on:update={(e) => {
          handleUpdate(e.detail.note);
          localNote = e.detail.note;
        }}
      />
      <div class="flex__row flex__justify-between flex__align-center">
        {@render children?.()}
        {#if localNote?.modified_at}
          <TimeAgo 
            class="text__discrete text__size-80" 
            data-testid="note-saved-ago"
            date={localNote.modified_at} 
            anchor={$_("Enregistré %ago", "")}></TimeAgo>
        {/if}
      </div>
    </div>
  </form>
</div>
