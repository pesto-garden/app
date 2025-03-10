<script lang="ts">
  import { _, _n } from "$lib/i18n/index.svelte";
  import IconaMoonSettings from "virtual:icons/iconamoon/settings";
  import IconaMoonSignPlusCircle from "virtual:icons/iconamoon/sign-plus-circle";

  import MainNavigation from "$lib/components/MainNavigation.svelte";
  import TodoCard from "$lib/components/TodoCard.svelte";
  import MainNavigationToggle from "$lib/components/MainNavigationToggle.svelte";
  import LoadingState from "$lib/components/LoadingState.svelte";
  import DialogForm from "$lib/components/DialogForm.svelte";
  import { type RxDocument } from "rxdb";
  import {
    globals,
    getNewNote,
    getNewTodoListFragment,
    createOrUpdateSetting,
    getNewTodo,
    removeDocument
  } from "$lib/db";
  import type { MangoQuerySelector } from "rxdb";

  import { flip } from "svelte/animate";
  import { dragHandle, dragHandleZone, SHADOW_ITEM_MARKER_PROPERTY_NAME } from "svelte-dnd-action";
  import { title } from "$lib/store";
  title.set($_("Tableau", ""));
  async function handleDndConsider(e, column: BoardColumn) {
    column.cards = e.detail.items;
  }
  async function handleDndFinalize(e, column: BoardColumn) {
    column.cards = e.detail.items;
    let newColumnIndex = parseInt(e.target.dataset.target);
    let updatedCards = e.detail.items.filter((c) => {
      return c.note.fragments.todolist.column != newColumnIndex;
    });
    let selector = {
      $or: updatedCards.map((c) => {
        return { id: c.note.id };
      })
    };
    let updateData = {
      modified_at: new Date().toISOString(),
      "fragments.todolist.column": newColumnIndex,
      "fragments.todolist.done": newColumnIndex === -1 ? true : false
    };
    await globals.db?.documents.find({ selector }).update({
      $set: updateData
    });
  }
  type BoardColumn = {
    name: string;
    cards: [];
    index: number;
    limit: number;
    selector: MangoQuerySelector<DocumentDocType>;
    isLoading: boolean;
  };

  type SettingsBoard = DocumentType & {
    id: "settings:board";
    data: {
      columns: string[];
    };
  };

  const FIRST_COLUMN_SELECTOR = {
    "fragments.todolist.done": { $eq: false },
    $or: [
      { "fragments.todolist.column": { $eq: 0 } },
      { "fragments.todolist.column": { $exists: false } }
    ]
  };
  const DONE_COLUMN_SELECTOR = { "fragments.todolist.done": { $eq: true } };
  const DEFAULT_COLUMN_SIZE = 25;
  function getColumnSelector(i: number) {
    return { "fragments.todolist.done": { $eq: false }, "fragments.todolist.column": { $eq: i } };
  }

  let columns: BoardColumn[] = $state([]);
  let boardColumnsConfig: string[] = $state([]);

  let autofocusKey: string = $state("noop");

  globals.db?.documents
    .findOne({ selector: { id: "settings:board" } })
    .$.subscribe((settings: RxDocument<SettingsBoard> | null) => {
      if (!settings) {
        // we use the default settings
        columns = [
          {
            name: $_("À faire", "Colonne du tableau"),
            cards: [],
            index: 0,
            limit: DEFAULT_COLUMN_SIZE,
            selector: FIRST_COLUMN_SELECTOR,
            isLoading: true
          },
          {
            name: $_("En cours", "Colonne du tableau"),
            cards: [],
            index: 1,
            limit: DEFAULT_COLUMN_SIZE,
            selector: getColumnSelector(1),
            isLoading: true
          },
          {
            name: $_("Terminé", "Colonne du tableau"),
            cards: [],
            index: -1,
            limit: DEFAULT_COLUMN_SIZE,
            selector: DONE_COLUMN_SELECTOR,
            isLoading: true
          }
        ];
      } else {
        settings.data.columns.forEach((v, i) => {
          let c: BoardColumn = {
            name: v,
            cards: [],
            index: i,
            selector: getColumnSelector(i),
            isLoading: true,
            limit: DEFAULT_COLUMN_SIZE
          };
          if (i === 0) {
            // unassign entries go to the first column
            c.selector = FIRST_COLUMN_SELECTOR;
          }
          if (i === settings.data.columns.length - 1) {
            // the last column automatically gets done entries
            c.selector = DONE_COLUMN_SELECTOR;
            c.index = -1;
            c.isLoading = true;
          }
          columns = [...columns, c];
        });
      }
      boardColumnsConfig = columns.map((c) => c.name);

      columns.forEach((v, i) => {
        globals.db.documents
          .find({
            limit: v.limit,
            sort: [v.index === -1 ? { modified_at: "desc" } : { created_at: "desc" }],
            selector: v.selector
          })
          .$.subscribe((notes) => {
            v.isLoading = false;
            v.cards = notes.map((n) => {
              return {
                id: n.id,
                note: n
              };
            });
          });
      });
    });

  async function saveBoard() {
    return await createOrUpdateSetting("settings:board", { columns: boardColumnsConfig });
  }
</script>

<div class="my__layout">
  <MainNavigation />
  <main>
    <div class="with_sticky_header">
      <header>
        <div class="wrapper wrapper__fluid flex__row flex__justify-between flex__align-center">

          <MainNavigationToggle class="layout__multi-hidden" />
          <h2 class="flex__grow">{$_("Tableau", "")}</h2>
          {#snippet settingsIcon()}
            <IconaMoonSettings
              role="presentation"
              class=" icon__size-3"
              height="none"
              width="none"
              alt=""
            />
          {/snippet}
  
          <DialogForm
            anchorClass="button__icon"
            anchorLabel={$_("Réglages du tableau", "")}
            anchor={settingsIcon}
            title={$_("Réglages du tableau", "")}
            onsubmit={async (e: SubmitEvent) => {
              saveBoard();
              e.preventDefault();
              location.reload();
            }}
          >
            {#each boardColumnsConfig as column, i (i)}
              <div class="form__field">
                <label for={`column-${i}`}>{$_("Colonne %0", "Tableau", [i + 1])}</label>
                <input
                  type="text"
                  id={`column-${i}`}
                  name={`column-${i}`}
                  bind:value={boardColumnsConfig[i]}
                />
                {#if i < boardColumnsConfig.length - 1 && i > 0}
                  <button
                    type="button"
                    onclick={() => {
                      boardColumnsConfig.splice(i, 1);
                      boardColumnsConfig = [...boardColumnsConfig];
                    }}>{$_("Supprimer", "")}</button
                  >
                {/if}
              </div>
            {/each}
            <button
              type="button"
              onclick={() => {
                boardColumnsConfig = [
                  ...boardColumnsConfig.slice(0, boardColumnsConfig.length - 1),
                  "New column",
                  ...boardColumnsConfig.slice(-1)
                ];
              }}>{$_("Ajouter une colonne", "")}</button
            >
          </DialogForm>
        </div>
      </header>
      <div class="scroll background__secondary">
        <div class="flex__row | wrapper wrapper__fluid">
          {#each columns as column}
            <section
              class="flex__column | board__column"
              aria-busy={column.isloading}
              aria-live="polite"
            >
              <div class="p__block-3 flex__row flex__justify-between flex__align-center">
                <h3 class="m__block-0">{column.name}</h3>

                <button
                  class="button__icon"
                  type="button"
                  aria-label={`Add todo in ${column.name}`}
                  title={`Add todo in ${column.name}`}
                  style={column.index === -1 ? "visibility: hidden" : ""}
                  onclick={async (e) => {
                    let note = getNewNote();
                    note.fragments.todolist = getNewTodoListFragment();
                    note.fragments.todolist.column = column.index;
                    note.fragments.todolist.todos.push(getNewTodo());
                    autofocusKey = note.id;
                    await globals.db?.documents.insert(note);
                  }}
                >
                  <IconaMoonSignPlusCircle
                    role="presentation"
                    class=" icon__size-3"
                    height="none"
                    width="none"
                    alt=""
                  />
                </button>
              </div>
              <LoadingState isLoading={column.isLoading}>Loading data…</LoadingState>
              <ol
                class="flex__grow | p__block-0 p__inline-0 | flow"
                use:dragHandleZone={{
                  items: column.cards,
                  flipDurationMs: 100,
                  dropTargetStyle: {}
                }}
                onconsider={async (e) => handleDndConsider(e, column)}
                onfinalize={async (e) => handleDndFinalize(e, column)}
                data-target={column.index}
              >
                {#each column.cards as item (item.id)}
                  <li class="card" animate:flip={{ duration: 100 }}>
                    <TodoCard
                      {dragHandle}
                      autofocus={autofocusKey === item.id}
                      note={item.note}
                      on:delete={(e) => {
                        removeDocument(e.detail.note);
                      }}
                    />
                    {#if item[SHADOW_ITEM_MARKER_PROPERTY_NAME]}
                      <div class="dnd__shadow-item">{$_("Déposer ici", "Tableau")}</div>
                    {/if}
                  </li>
                {/each}
              </ol>
              {#if column.index === -1 && column.cards.length > 0}
                <button
                  onclick={async (e) => {
                    let newCards = await globals.db.documents
                      .find({
                        limit: column.limit,
                        sort: [{ modified_at: "desc" }],
                        selector: {
                          id: { $lt: column.cards.slice(-1)[0].id },
                          ...column.selector
                        }
                      })
                      .exec();
                    column.cards = [
                      ...column.cards,
                      ...newCards.map((n) => {
                        return { id: n.id, note: n };
                      })
                    ];
                  }}>{$_("Afficher plus", "")}</button
                >
              {/if}
            </section>
          {/each}
        </div>
      </div>
    </div>
  </main>
</div>
