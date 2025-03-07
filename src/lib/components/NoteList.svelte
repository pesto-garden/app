<script lang="ts">
  import { _, _n } from "$lib/i18n/index.svelte";

  import IconaMoonTrash from "virtual:icons/iconamoon/trash";
  import IconaMoonEdit from "virtual:icons/iconamoon/edit";

  import DialogForm from "$lib/components/DialogForm.svelte";
  import CollectionForm from "$lib/components/CollectionForm.svelte";
  import RenderedNote from "$lib/components/RenderedNote.svelte";
  import LoadingState from "$lib/components/LoadingState.svelte";
  import {
    type DocumentDocument,
    globals,
    getById,
    type DocumentType,
    getNoteSelector,
    removeDocument,
  } from "$lib/db";
  import { clearSubscriptions } from "$lib/ui";
  import { onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import cloneDeep from "lodash/cloneDeep";
  interface Props {
    searchQuery: string;
    orderQuery: string;
    collection?: DocumentType;
    onorderchange?: Function;
  }

  let { searchQuery = $bindable(), orderQuery = $bindable(), collection, onorderchange }: Props = $props();

  let notes: DocumentDocument[] = $state([]);
  let matchingCount: number = $state(0);
  let isLoading = $state(false);
  let currentCollection = $state(cloneDeep(collection));
  let editedCollection = $state(cloneDeep(currentCollection));
  let countSubscription = null;
  let subscriptions = [];
  const PAGE_SIZE = 20;
  function getSortFromOrderQuery(o: string) {
    let field, direction;
    [field, direction] = o.split(":");
    let sort = {};
    sort[field] = direction;
    return sort;
  }

  function loadNotes(q: string, o: string) {
    isLoading = true;
    matchingCount = 0;
    notes = [];
    return globals.db.documents
      .find({
        limit: PAGE_SIZE,
        sort: [getSortFromOrderQuery(o)],
        selector: { type: "note", ...getNoteSelector(q, currentCollection) }
      })
      .$.subscribe((documents) => {
        isLoading = false;
        notes = documents;
        clearSubscriptions([countSubscription]);
        countSubscription = globals.db.documents
          .count({
            selector: { type: "note", ...getNoteSelector(q, currentCollection) }
          })
          .$.subscribe((count) => {
            matchingCount = count;
          });
      });
  }
  $effect(() => {
    clearSubscriptions(subscriptions);
    clearSubscriptions([countSubscription]);
    subscriptions = loadNotes(searchQuery, orderQuery);
  });

  onDestroy(() => {
    clearSubscriptions(subscriptions);
    clearSubscriptions([countSubscription]);
  });
</script>

<div class="wrapper" role="list" aria-live="polite" aria-busy={isLoading}>
  {#if !isLoading}
    <header class="p__block-3 p__inline-3 | flex__row flex__align-center flex__justify-between">
      <div class="flex__grow">
        {#if collection}
          <strong>
            {currentCollection.data.emoji || "📋️"}
            {currentCollection.title}
          </strong>

          {#snippet editCollectionIcon()}
            <IconaMoonEdit
              role="presentation"
              class=" icon__size-2"
              height="none"
              width="none"
              alt=""
            />
          {/snippet}
          <DialogForm
            anchorClass="button__icon"
            anchorLabel="Edit collection"
            anchor={editCollectionIcon}
            title="Edit collection"
            onopen={(e) => {
              editedCollection = cloneDeep(currentCollection);
            }}
            onsubmit={async (e: SubmitEvent) => {
              e.preventDefault();
              await globals.db.documents.upsert(cloneDeep(editedCollection));
              currentCollection = editedCollection;
              clearSubscriptions(subscriptions);
              subscriptions = loadNotes(searchQuery, orderQuery);
            }}
          >
            <CollectionForm bind:collection={editedCollection}></CollectionForm>
          </DialogForm>
          {#snippet trashIcon()}
            <IconaMoonTrash
              role="presentation"
              class=" icon__size-2"
              height="none"
              width="none"
              alt=""
            />
          {/snippet}
          <DialogForm
            anchorClass="button__icon"
            anchorLabel={$_("Supprimer la collection %0", "", [collection.title])}
            anchor={trashIcon}
            title={$_("Supprimer la collection %0", "", [collection.title])}
            onsubmit={async (e: SubmitEvent) => {
              await globals.db.documents
                .find({ selector: { col: collection.id } })
                .patch({ col: null });
              let document = await getById(globals.db.documents, collection.id);
              await removeDocument(document);
              goto("/my");
              return e.preventDefault();
            }}
          >
            <p>
              {$_(
                "Souhaitez vous supprimer cette collection ? Les notes et données associées seront conservées. Cette action est irréversible.",
                ""
              )}
            </p>
          </DialogForm>
          <br>
        {/if}
        {#if matchingCount >= notes.length}
          <span data-testid="matching-count">
            {$_n(`1 note trouvée`, `%n notes trouvées`, matchingCount)}
          </span>
        {/if}
      </div>
      <div class="form__field">
        <select
          name="order"
          id="order"
          value={orderQuery}
          aria-label={$_("Trier par", "")}
          title={$_("Trier par", "")}
          oninput={(e) => {
            onorderchange?.(e.target.value)
          }}
        >
          <option value="id:desc">{$_("Date ↓", "")}</option> 
          <option value="id:asc">{$_("Date ↑", "")}</option> 
          <option value="modified_at:desc">{$_("Modifié ↓", "")}</option> 
          <option value="modified_at:asc">{$_("Modifié ↑", "")}</option> 
         </select>
      </div>
    </header>
  {/if}
  <LoadingState {isLoading}>{$_("Chargement des notes…", "")}</LoadingState>
  {#each notes as note}
    {#key note._rev}
      <RenderedNote
        {note}
        includeHeader={true}
        limitSize={true}
        class="diary__note flow | p__block-3 p__inline-3"
        role="listitem"
      ></RenderedNote>
    {/key}
  {/each}
  {#if notes.length < matchingCount && !isLoading}
    <div class="flex__row flex__center m__block-4 hide-for-print">
      <button
        class="button__secondary"
        onclick={async (e) => {
          let newNotes = await globals.db.documents
            .find({
              limit: PAGE_SIZE,
              sort: [getSortFromOrderQuery(orderQuery)],
              selector: {
                type: "note",
                id: { $lt: notes.slice(-1)[0].id },
                ...getNoteSelector(searchQuery, collection)
              }
            })
            .exec();
          notes = [...notes, ...newNotes];
        }}>{$_("Afficher plus de notes", "")}</button
      >
    </div>
  {/if}
</div>
