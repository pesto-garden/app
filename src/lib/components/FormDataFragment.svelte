<script lang="ts">
  import { type FormFragmentType } from "$lib/db";
  import { forms } from "$lib/store-db";

  interface Props {
    fragment: FormFragmentType;
  }

  let { fragment }: Props = $props();

  let fields: string[] = $state(Object.keys(fragment.data || {}));
  let annotations: string[] = $state(Object.keys(fragment.annotations || {}));
  let form;
  let fieldsById = {};
  forms.subscribe((v) => {
    form = v[fragment.id];
    form?.fields.forEach((f) => {
      fieldsById[f.id] = f;
    });
  });
  // let subscriptions = [
  //   syncPropertiesWithExternalChanges(fragment.content$, (v) => {content = v})
  // ]
  // onDestroy(clearSubscriptions(subscriptions))
</script>

<table class="table__simpledata">
  <caption>
    <a href={`/my?q=form:${fragment.id}`}>
      {form.name || fragment.id}
    </a>
  </caption>
  <tbody>
    {#each fields as field}
      <tr>
        <td>{fieldsById[field]?.label || field}</td>
        <td>{fragment.data[field]}</td>
      </tr>
    {/each}
    {#each annotations as annotation}
      <tr>
        <td>{annotation}</td>
        <td>{fragment.annotations[annotation]}</td>
      </tr>
    {/each}
  </tbody>
</table>
