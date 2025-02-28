<script lang="ts">
  import { _, _n } from "$lib/i18n/index.svelte";

  import FormFieldRendered from "$lib/components/FormFieldRendered.svelte";
  import FormBuilder from "$lib/components/FormBuilder.svelte";
  import DialogForm from "$lib/components/DialogForm.svelte";
  import cloneDeep from "lodash/cloneDeep";
  import { type FormConfiguration, createOrUpdateForm, globals, getById, removeDocument} from "$lib/db";

  interface Props {
    children: import("svelte").Snippet;
    form: FormConfiguration;
    id: string;
    onsubmit: Function;
    showActions: boolean;
    values?: object;
    elClass?: string;
    ignoredEntryId?: string;
  }

  let {
    form,
    children,
    id,
    onsubmit,
    showActions = true,
    values,
    elClass,
    ignoredEntryId
  } = $props();

  let v = $state(values || {});
  function setDefaultValues() {
    for (const field of form.fields) {
      v[field.id] = field.default || null;
    }
  }
  if (!values) {
    setDefaultValues();
  }
</script>

<div class={elClass}>
  <div class="flex__row flex__align-top flex__justify-between">
    <h3 class="m__block-0">
      <a href={`/my?q=form:${form.id}`}>
        {form.name}
      </a>
    </h3>
    {#if showActions}
      <div>
        <DialogForm
          anchorClass="button button__link"
          anchorText={$_("Éditer", "")}
          title={$_("Éditer le formulaire %0", "", [form.name])}
          onsubmit={async (e: SubmitEvent) => {
            await createOrUpdateForm(id, form);
            return e.preventDefault();
          }}
        >
          <FormBuilder bind:form />
        </DialogForm>
        <br />
        <DialogForm
          anchorClass="button button__link"
          anchorText={$_("Supprimer", "")}
          title={$_("Supprimer le formulaire %0", "", [form.name])}
          onsubmit={async (e: SubmitEvent) => {
            let form = await getById(globals.db.documents, id);
            await removeDocument(form);
            return e.preventDefault();
          }}
        >
          <p>
            {$_(
              "Voulez-vous supprimer ce formulaire ? Les données déjà saisies ne seront pas supprimées. Cette action est irréversible.",
              ""
            )}
          </p>
        </DialogForm>
      </div>
    {/if}
  </div>
  <form
    class="flow"
    onsubmit={(e) => {
      e.preventDefault();
      onsubmit(cloneDeep(v));
    }}
  >
    {#each form.fields as field, i (i)}
      <FormFieldRendered {field} formId={form.id} bind:value={v[field.id]} />
    {/each}

    <div class="flex__row flex__justify-between">
      <button type="submit">{$_("Sauvegarder", "")}</button>
      <button
        type="button"
        class="button__link"
        onclick={async () => {
          let last = await globals.db.documents
            .findOne({
              selector: { "fragments.form.id": form.id, id: { $ne: ignoredEntryId } },
              sort: [{ id: "desc" }]
            })
            .exec();
          if (last) {
            v = cloneDeep(last.fragments.form.data);
          }
        }}>{$_("Pré-remplir", "")}</button
      >
    </div>
    {@render children?.()}
  </form>
</div>
