<script lang="ts">
  import { _, _n } from "$lib/i18n/index.svelte";
  import NoteForm from "$lib/components/NoteForm.svelte";
  import { title } from "$lib/store.js";
  title.set($_("Nouvelle note", ""));
  let { data } = $props();
  let key = $state(0);
</script>

<main class="flex__grow">
  <NoteForm note={data.note || null}>
    <a
      href="/my"
      class="button button__secondary"
      on:delete={(e) => {
        key++;
      }}
    >
      {$_("Retour à la liste", "")}
    </a>
  </NoteForm>
</main>
