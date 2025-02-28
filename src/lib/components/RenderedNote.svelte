<script lang="ts">
  import { type DocumentDocument, getNoteUpdateData, formatDate, removeDocument } from "$lib/db";
  import { renderMarkdown } from "$lib/ui";
  import FormDataFragment from "./FormDataFragment.svelte";
  import RenderedNoteHeader from "./RenderedNoteHeader.svelte";
  import TodoListFragmentEditor from "./TodoListFragmentEditor.svelte";
  import CollapsableContent from "./CollapsableContent.svelte";
  import isEmpty from "lodash/isEmpty";

  interface Props {
    note: DocumentDocument;
    limitSize: boolean;
    includeHeader: boolean;
    onDelete?: Function;
    [key: string]: any;
  }

  let { note = $bindable(), includeHeader, limitSize = true, onDelete, ...rest }: Props = $props();
</script>

<article {...rest}>
  {#if includeHeader}
    {#key note.id}
      <RenderedNoteHeader {note} pageHeader={false} {onDelete} />
    {/key}
  {/if}

  {#if note.title?.trim()}
    <p>
      <time datetime={note.created_at}>{formatDate(note.created_at)}</time>
    </p>
  {/if}

  {#if note.fragments.form}
    <FormDataFragment fragment={note.fragments.form} />
  {/if}
  {#if note.fragments.text}
    <CollapsableContent class="flow prose" {limitSize}>
      {@html renderMarkdown(note.fragments.text.content)}
    </CollapsableContent>
  {/if}
  {#if note.fragments.todolist}
    <TodoListFragmentEditor
      fragment={note.fragments.todolist}
      editText={false}
      on:update={async (e) => {
        await note.incrementalUpdate({
          $set: getNoteUpdateData(note, { "fragments.todolist": e.detail.fragment })
        });
      }}
      on:delete={async (e) => {
        await note.incrementalUpdate({
          $set: getNoteUpdateData(note, { "fragments.todolist": undefined })
        });
        note = await note.getLatest();
        note.toJSON().fragments;
        let fragments = note.toMutableJSON().fragments;
        delete fragments.todolist;
        if (isEmpty(fragments)) {
          await removeDocument(note);
          onDelete?.();
        }
      }}
    />
  {/if}
</article>
