<script lang="ts">
  import { _, _n } from "$lib/i18n/index.svelte";
  import { globals, launchReplications, getNewCollection } from "$lib/db";
  import MainNavigationLink from "./MainNavigationLink.svelte";
  import DialogForm from "./DialogForm.svelte";
  import CollectionForm from "./CollectionForm.svelte";
  import MainNavigationToggle from "$lib/components/MainNavigationToggle.svelte";
  import IconaMoonSearch from "virtual:icons/iconamoon/search";
  import IconaMoonSignPlusCircle from "virtual:icons/iconamoon/sign-plus-circle";
  import IconaMoonSynchronize from "virtual:icons/iconamoon/synchronize";
  import IconaMoonSettings from "virtual:icons/iconamoon/settings";
  import IconaMoonApps from "virtual:icons/iconamoon/apps";
  import IconaMoonClock from "virtual:icons/iconamoon/clock";
  import IconaMoonFileDocument from "virtual:icons/iconamoon/file-document";
  import IconaMoonStar from "virtual:icons/iconamoon/star";
  import IconaMoonCategory from "virtual:icons/iconamoon/category";
  import IconaMoonMenuKebabVerticalSquare from "virtual:icons/iconamoon/menu-kebab-vertical-square";

  import cloneDeep from "lodash/cloneDeep";

  import { onDestroy } from "svelte";
  import { clearSubscriptions } from "$lib/ui";

  let sidebarFullpage = $state(false);
  let isSyncing = $state(false);

  const observable = globals.uiState.get$("currentPage");
  observable.subscribe((newValue) => {
    sidebarFullpage = newValue === "mainMenu";
  });

  let totalNotes: number | null = $state(null);
  let totalTodos: number | null = $state(null);
  let totalStarred: number | null = $state(null);
  let collections = $state([]);
  let replications: [] = $state([]);
  let newCollection = $state(getNewCollection());

  const subscriptions = [
    globals.uiState.get$("replications").subscribe((newValue) => {
      replications = newValue || [];
    }),
    globals.db?.documents
      .count({ selector: { type: "note" } })
      .$.subscribe((v) => (totalNotes = v)),
    globals.db?.documents
      .count({ selector: { "fragments.todolist.done": false } })
      .$.subscribe((v) => (totalTodos = v)),
    globals.db?.documents
      .count({ selector: { starred: true } })
      .$.subscribe((v) => (totalStarred = v)),
    globals.db?.documents
      .find({ selector: { type: "collection" }, sort: [{ title: "asc" }] })
      .$.subscribe((documents) => {
        collections = documents.map((d) => d.toMutableJSON());
      })
  ];
  onDestroy(clearSubscriptions(subscriptions));
</script>

<aside data-fullpage={sidebarFullpage}>
  <nav class="nav__main" aria-label="Main menu">
    <header class="flex__row flex__justify-between flex__align-center">
      <MainNavigationToggle class="layout__multi-hidden" />
      <a id="logo-wrapper" class="flex__grow" href="/my">
        <img src="/logo-horizontal.svg" alt="Pesto logo" />
      </a>
      <div>
        {#if replications.length > 0}
          <button
            type="button"
            class="button__icon p__inline-2 m__inline-1"
            aria-label={$_("Synchroniser", "")}
            title={$_("Synchroniser", "")}
            onclick={async (e) => {
              isSyncing = true;
              launchReplications(globals.uiState, globals.db)
              setTimeout(() => {
                isSyncing = false;
              }, 1000);
            }}
          >
            <IconaMoonSynchronize
              role="presentation"
              class={`icon__size-3 ` + (isSyncing ? "rotating" : "")}
              height="none"
              width="none"
              alt=""
            />
          </button>
        {/if}
        <a
          href="/my?action=search"
          class="button__icon p__inline-2 m__inline-1"
          aria-label={$_("Rechercher", "")}
          title={$_("Rechercher", "")}
        >
          <IconaMoonSearch
            role="presentation"
            class=" icon__size-3"
            height="none"
            width="none"
            alt=""
          />
        </a>
        <a
          href="/settings"
          class="button__icon p__inline-2 m__inline-1"
          aria-label={$_("Réglages", "")}
          title={$_("Réglages", "")}
        >
          <IconaMoonSettings
            role="presentation"
            class=" icon__size-3"
            height="none"
            width="none"
            alt=""
          />
        </a>
      </div>
    </header>
    <ul class="flex__column">
      <li>
        <MainNavigationLink href="/my/notes/add"
          ><IconaMoonSignPlusCircle role="presentation" alt="" /><span class="flex__grow"
            >{$_("Nouvelle note", "")}</span
          ></MainNavigationLink
        >
      </li>
      <li>
        <MainNavigationLink href="/my">
          <IconaMoonCategory role="presentation" alt="" /><span class="flex__grow"
            >{$_("Toutes les notes", "")}</span
          >
          <span class="badge float__end">{totalNotes}</span>
        </MainNavigationLink>
      </li>
      <li>
        <MainNavigationLink href="/my?q=starred:true">
          <IconaMoonStar role="presentation" alt="" /><span class="flex__grow"
            >{$_("Favoris", "")}</span
          >
          <span class="badge float__end">{totalStarred}</span>
        </MainNavigationLink>
      </li>
      <li>
        <MainNavigationLink href="/my?o=modified_at:desc"
          ><IconaMoonClock role="presentation" alt="" /><span class="flex__grow"
            >{$_("Récemment modifié", "")}</span
          ></MainNavigationLink
        >
      </li>
      <li>
        <MainNavigationLink href="/board">
          <IconaMoonApps role="presentation" alt="" />
          <span class="flex__grow">
            {$_("Tableau", "")}
          </span>
          <span class="badge float__end">{totalTodos}</span>
        </MainNavigationLink>
      </li>
      <li>
        <MainNavigationLink href={`/my?q=is:todo`}>
          <IconaMoonMenuKebabVerticalSquare role="presentation" alt="" />{$_("Tâches", "")}
        </MainNavigationLink>
      </li>
      <li class="flex__row flex__justify-between flex__align-center">
        <h2>
          {$_("Collections", "")}
        </h2>

        {#snippet newCollectionIcon()}
          <IconaMoonSignPlusCircle
            role="presentation"
            class=" icon__size-2"
            height="none"
            width="none"
            alt=""
          />
        {/snippet}
        <DialogForm
          anchorClass="button__icon"
          anchorLabel={$_("Ajouter une collection", "")}
          anchor={newCollectionIcon}
          title={$_("Ajouter une collection", "")}
          onopen={() => {
            newCollection = getNewCollection();
          }}
          onsubmit={async (e: SubmitEvent) => {
            e.preventDefault();
            await globals.db.documents.upsert(cloneDeep(newCollection));
            newCollection = getNewCollection();
          }}
        >
          <CollectionForm bind:collection={newCollection}></CollectionForm>
        </DialogForm>
      </li>
      {#each collections as collection, i (i)}
        <li>
          <MainNavigationLink href={`/my?collection=${collection.id}`}>
            <span class="icon">
              {collection.data.emoji || "📋️"}
            </span>
            {collection.title}
          </MainNavigationLink>
        </li>
      {/each}
      <li><h2>{$_("Données", "")}</h2></li>
      <li>
        <MainNavigationLink href="/forms"
          ><IconaMoonFileDocument role="presentation" alt="" /><span class="flex__grow"
            >{$_("Formulaires", "")}</span
          ></MainNavigationLink
        >
      </li>
      <li class="p__block-2"></li>
    </ul>
  </nav>
</aside>
