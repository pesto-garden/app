<script lang="ts">
  import { _, _n } from "$lib/i18n/index.svelte";
  import debounce from "lodash/debounce";
  import TextFragmentEditor from "./TextFragmentEditor.svelte";
  import FormRendered from "./FormRendered.svelte";
  import SelectDocument from "./SelectDocument.svelte";
  import TodoListFragmentEditor from "./TodoListFragmentEditor.svelte";
  import {
    globals,
    buildUniqueId,
    getNewNote,
    getNewTextFragment,
    getNewTodoListFragment,
    getNoteUpdateData,
    type DocumentDocument,
    type DocumentType,
    type TextType,
    type TodolistType,
    type Database
  } from "$lib/db";
  import {forms} from '$lib/store-db'
  import { clearSubscriptions, getTodoListFromMarkdown } from "$lib/ui";
  import { createEventDispatcher, onDestroy } from "svelte";
  const dispatch = createEventDispatcher<{
    update: { note: DocumentDocument };
  }>();

  interface Props {
    note: DocumentDocument | null;
    collection: string | null;
    columns: string[] | null;
  }

  let { note = $bindable(), columns, collection }: Props = $props();
  let id: string = note ? note.id : buildUniqueId();
  let db = globals.db;
  let todolistKey = $state(0);
  let todolistFromText: TodolistType | null = $state(
    getTodoListFromMarkdown(note?.fragments?.text?.content || "", buildUniqueId)
  );
  let subscriptions = [];

  async function updateTitle(title: string) {
    if (!note && !title.trim()) {
      return;
    }
    if (!note) {
      let noteData = getNewNote({ collection });
      noteData.id = id;
      note = await db.documents.insert(noteData);
    }
    let updateData = {};
    updateData["title"] = title || null;
    updateData[`modified_at`] = new Date().toISOString();
    await note.incrementalUpdate({
      $set: getNoteUpdateData(note, updateData)
    });
    note = await note.getLatest();
    dispatch("update", { note });
  }
  async function updateCollection(collection: string) {
    if (!note) {
      let noteData = getNewNote({ collection });
      noteData.id = id;
      note = await db.documents.insert(noteData);
    }
    let updateData = {};
    updateData["col"] = collection || null;
    await note.incrementalUpdate({
      $set: getNoteUpdateData(note, updateData)
    });
    note = await note.getLatest();
    dispatch("update", { note });
  }
  async function updateFragment(
    fragmentType: string,
    fragment: TodolistType | TextType | FormType | undefined
  ) {
    if (!note) {
      let noteData = getNewNote({ collection });
      noteData.id = id;
      note = await db.documents.insert(noteData);
    }
    let updateData = {};
    updateData[`fragments.${fragmentType}`] = fragment;
    updateData[`modified_at`] = new Date().toISOString();
    await note.incrementalUpdate({
      $set: getNoteUpdateData(note, updateData)
    });
    note = await note.getLatest();
    dispatch("update", { note });
  }
  onDestroy(() => {
    clearSubscriptions(subscriptions);
  });
</script>

<div class="flow">
  <div class="form__field">
    <label for="note-title">{$_("Titre", "")}</label>
    <input
      type="text"
      id="note-title"
      name="note-title"
      value={note?.title || ""}
      oninput={debounce(async (e) => {
        await updateTitle(e.target.value);
      }, 300)}
    />
  </div>
  <div class="form__field">
    <label for="note-collection">{$_("Collection", "")}</label>
    <SelectDocument
      id="note-collection"
      name="note-collection"
      value={note?.col || collection}
      onchange={async (e) => {
        await updateCollection(e.target.value);
      }}
      findOptions={{ selector: { type: "collection" }, sort: [{ title: "asc" }] }}
      choiceConverter={(c) => {
        return { value: c.id, text: `${c.data.emoji || "📋️"} ${c.title}` };
      }}
    ></SelectDocument>
  </div>

  {#if note?.fragments?.form?.id && forms[note.fragments.form.id]}
    <FormRendered
      elClass="flow"
      form={forms[note.fragments.form.id]}
      id={note.fragments.form.id}
      ignoredEntryId={note.id}
      onsubmit={async (values: object) => {
        updateFragment("form", {
          id: note.fragments.form.id,
          data: values,
          annotations: note.fragments.form.annotations || {}
        });
      }}
      values={note?.fragments?.form?.data}
      showActions={false}
    ></FormRendered>
  {/if}
  <TextFragmentEditor
    fragment={note?.fragments?.text || getNewTextFragment()}
    fieldId={`note-text-${id}`}
    on:update={debounce((event) => {
      updateFragment("text", event.detail.fragment);
      if (!note?.fragments?.todolist) {
        todolistFromText = getTodoListFromMarkdown(event.detail.fragment.content, buildUniqueId);
      }
    }, 200)}
    on:delete={(event) => updateFragment("text", undefined)}
  />

  {#if todolistFromText && !note?.fragments?.todolist}
    <button
      type="button"
      class="button__link"
      onclick={async () => {
        await updateFragment("todolist", todolistFromText);
        todolistKey += 1;
      }}
    >
      {$_("Charger la liste de tâche depuis le texte", "")}
    </button>
  {/if}
  {#key todolistKey}
    <TodoListFragmentEditor
      {columns}
      editText={true}
      fragment={note?.fragments?.todolist || getNewTodoListFragment()}
      autofocus={false}
      on:update={debounce((event) => updateFragment("todolist", event.detail.fragment), 200)}
      on:delete={(event) => updateFragment("todolist", undefined)}
    />
  {/key}
</div>
