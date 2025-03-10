<script lang="ts">
  import { _, _n } from "$lib/i18n/index.svelte";
  import IconaMoonSettings from "virtual:icons/iconamoon/settings";
  import IconaMoonSignPlusCircle from "virtual:icons/iconamoon/sign-plus-circle";

  import MainNavigation from "$lib/components/MainNavigation.svelte";
  import MainNavigationToggle from "$lib/components/MainNavigationToggle.svelte";
  import DialogForm from "$lib/components/DialogForm.svelte";
  import FormBuilder from "$lib/components/FormBuilder.svelte";
  import FormRendered from "$lib/components/FormRendered.svelte";
  import { goto } from "$app/navigation";

  import { getRandomId, clearSubscriptions } from "$lib/ui";
  import {
    type FormConfiguration,
    type DocumentType,
    createOrUpdateForm,
    globals,
    getNewNote,
    createOrUpdateSetting,
    getNewFormFragment
  } from "$lib/db";
  import { onDestroy } from "svelte";
  import sortBy from "lodash/sortBy";
  import { title } from "$lib/store";
  title.set($_("Formulaires", ""));
  let editedForm: FormConfiguration | null = $state(null);
  let subscriptions = [];
  let forms: DocumentType = $state([]);
  function loadForms() {
    return globals.db.documents
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
      });
  }

  let subscription = null;
  $effect(() => {
    subscription?.unsubscribe();
    subscription = loadForms();
  });

  onDestroy(clearSubscriptions([...subscriptions, subscription]));
</script>

<div class="my__layout">
  <MainNavigation />
  <main>
    <div class="scroll__wrapper">
      <header class="p__inline-3 flex__row flex__justify-between flex__align-center">
        <MainNavigationToggle class="layout__multi-hidden" />

        <h2 class="flex__grow">{$_("Formulaires", "")}</h2>

        {#snippet plusIcon()}
          <IconaMoonSignPlusCircle
            role="presentation"
            class=" icon__size-3"
            height="none"
            width="none"
            alt=""
          />
        {/snippet}
        <DialogForm
          anchorClass="button__icon"
          anchor={plusIcon}
          anchorLabel={$_("Ajouter un formulaire", "")}
          title={$_("Ajouter un formulaire", "")}
          onopen={() =>
            (editedForm = {
              id: getRandomId().toLowerCase(),
              name: $_("Mon formulaire", ""),
              fields: []
            })}
          onsubmit={async (e: SubmitEvent) => {
            e.preventDefault();
            await createOrUpdateForm(null, editedForm);
            editedForm = null;
          }}
        >
          {#if editedForm}
            <FormBuilder bind:form={editedForm} />
          {/if}
        </DialogForm>
      </header>
      <div class="scroll p__block-2 p__inline-2">
        <div class="grid grid__gap">
          {#each forms as form}
            <FormRendered
              elClass="card card__narrow | flow"
              form={form.data}
              id={form.id}
              onsubmit={async (values: object) => {
                let noteData = getNewNote();
                noteData.fragments = {
                  form: getNewFormFragment(form.data.id, values, {})
                };
                let note = await globals.db.documents.insert(noteData);
                await goto(`/my/notes/${note.id}`);
              }}
            ></FormRendered>
          {/each}
        </div>
      </div>
    </div>
  </main>
</div>
