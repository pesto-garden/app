<script lang="ts">
  import { _, _n } from "$lib/i18n/index.svelte";
  import { createEventDispatcher } from "svelte";
  import { onDestroy } from "svelte";
  import { type TextType } from "$lib/db";
  import { syncPropertiesWithExternalChanges, clearSubscriptions } from "$lib/ui";
  import TextareaEditor from "./TextareaEditor.svelte";
  const dispatch = createEventDispatcher<{
    update: { fragment: TextType };
    delete: {};
  }>();

  interface Props {
    fieldId: string;
    fragment: TextType;
  }

  let { fieldId, fragment }: Props = $props();
  let content = $state(fragment.content);
  let focused = $state(false);
  let subscriptions = [
    syncPropertiesWithExternalChanges(fragment.content$, (v) => {
      if (!focused) {
        content = v;
      }
    })
  ];

  onDestroy(clearSubscriptions(subscriptions));
  function handleChange(content) {
    if (content) {
      dispatch("update", { fragment: { ...fragment, content } });
    } else {
      dispatch("delete", {});
    }
  }
</script>

<div class="form__field">
  <label for={fieldId}>{$_("Contenu", "")}</label>
  <TextareaEditor
    id={fieldId}
    onfocus={() => (focused = true)}
    onblur={() => (focused = false)}
    class="editor autoresize"
    placeholder={$_("Quoi de neuf ?", "")}
    oninput={(e) => handleChange(e.target.value)}
    value={content}
  ></TextareaEditor>
</div>
