<script lang="ts">
  import { globals, type FormFieldConfiguration } from "$lib/db";
  import sortBy from "lodash/sortBy";

  interface Props {
    children?: import("svelte").Snippet;
    formId: string;
    field: FormFieldConfiguration;
    label?: string;
    value?: boolean | number | string;
    oninput?: Function;
  }

  let { field, label, children, formId, value = $bindable(), oninput }: Props = $props();

  let suggestions = $state(field.suggestions || []);

  async function loadSuggestions() {
    if (!field.autosuggest) {
      return;
    }
    // load value form other values of same field in other entries
    let selector = { [`fragments.form.data.${field.id}`]: { $exists: true } };
    let results = await globals.db.documents
      .find({
        limit: 300,
        selector,
        sort: [{ id: "desc" }]
      })
      .exec();
    for (const result of results) {
      let v = result.toJSON().fragments.form.data[field.id];
      if (v) {
        suggestions = [...suggestions, String(v).trim()];
      }
      suggestions = [...new Set(suggestions)];
      suggestions = sortBy(suggestions);
    }
  }
</script>

<div class="form__field">
  {#if field.type === "text" || field.type === "number"}
    <label for={`field-${formId}-${field.id}`}>{label || field.label}</label>
    <input
      onfocus={() => {
        loadSuggestions();
      }}
      id={`field-${formId}-${field.id}`}
      name={`field-${formId}-${field.id}`}
      type={field.type}
      list={`field-autocomplete-${formId}-${field.id}`}
      step="any"
      bind:value
      oninput={(e) => {
        oninput?.(
          field.type === "number" ? e.target.valueAsNumber : e.target.value
        )
        return true
      }}
    />
    <datalist id={`field-autocomplete-${formId}-${field.id}`}>
      {#each suggestions as suggestion}
        <option value={suggestion}>{suggestion}</option>
      {/each}
    </datalist>
  {/if}
  {#if field.type === "boolean"}
    <input
      id={`field-${formId}-${field.id}`}
      name={`field-${formId}-${field.id}`}
      type="checkbox"
      bind:checked={value}
      oninput={(e) => {
        oninput?.(e.target.checked)
        return true
      }}
    />
    <label for={`field-${formId}-${field.id}`}>{field.label}</label>
  {/if}
  {#if field.help}
    <p class="form__help">{field.help}</p>
  {/if}

  {@render children?.()}
</div>
