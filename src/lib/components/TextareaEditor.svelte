<script lang="ts">
  // based on https://phuoc.ng/collection/mirror-a-text-area/add-autocomplete-to-your-text-area/
  import { globals } from "$lib/db";
  import { clearSubscriptions, signToType, parseTags } from "$lib/ui";
  import { onMount, onDestroy, tick } from "svelte";

  import type { HTMLBaseAttributes } from "svelte/elements";
  import { preventDefault } from "svelte/legacy";

  interface Props extends HTMLBaseAttributes {}
  let { oninput, onclick, ...restProps }: Props = $props();

  let textarea: HTMLTextAreaElement | null = $state(null);
  let reflection: HTMLDivElement | null = $state(null);
  let container: HTMLDivElement | null = $state(null);
  let suggestions: HTMLUListElement | null = $state(null);
  let caretElementRect: DOMRect = $state({
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    height: 0,
    width: 0,
    x: 0,
    y: 0
  });
  let currentWord: string | null = $state(null);
  let currentSuggestionIndex = $state(-1);
  let matches = $state([]);
  let suggestionsOptions = $state(new Set());

  onMount(() => {
    mirrorTextarea(textarea, reflection);
  });

  let subscriptions = [
    globals.db.documents
      .find({
        limit: 20000,
        selector: { type: "note" }
      })
      .$.subscribe((documents) => {
        suggestionsOptions = new Set();
        for (const document of documents) {
          let tags = document.tags || [];
          for (const tag of tags) {
            suggestionsOptions.add(tag);
          }
        }
      })
  ];

  onDestroy(clearSubscriptions(subscriptions));

  function mirrorTextarea(source: HTMLTextAreaElement, reflection: HTMLDivElement) {
    reflection.textContent = source.value;

    const textareaStyles = window.getComputedStyle(source);
    [
      "border",
      "boxSizing",
      "fontFamily",
      // 'fontSize',
      "fontWeight",
      "letterSpacing",
      "lineHeight",
      "padding",
      "textDecoration",
      "textIndent",
      "textTransform",
      "whiteSpace",
      "wordSpacing",
      "wordWrap"
    ].forEach((property: string) => {
      reflection.style[property] = textareaStyles[property];
    });
    reflection.style.borderColor = "transparent";

    const parseValue = (v) => (v.endsWith("px") ? parseInt(v.slice(0, -2), 10) : 0);
    const borderWidth = parseValue(textareaStyles.borderWidth);

    const ro = new ResizeObserver(() => {
      reflection.style.width = `${source.clientWidth + 2 * borderWidth}px`;
      reflection.style.height = `${source.clientHeight + 2 * borderWidth}px`;
    });
    ro.observe(source);
  }

  const findIndexOfCurrentWord = (element) => {
    // Get current value and cursor position
    const currentValue = element.value;
    const cursorPos = element.selectionStart;

    // Iterate backwards through characters until we find a space or newline character
    let startIndex = cursorPos - 1;
    while (startIndex >= 0 && !/\s/.test(currentValue[startIndex])) {
      startIndex--;
    }
    return startIndex;
  };

  const replaceCurrentWord = (element, newWord, input = false) => {
    const currentValue = element.value;
    const cursorPos = element.selectionStart;
    const startIndex = findIndexOfCurrentWord(element);

    const newValue =
      currentValue.substring(0, startIndex + 1) + newWord + currentValue.substring(cursorPos);
    element.value = newValue;
    element.focus();
    element.selectionStart = element.selectionEnd = startIndex + 1 + newWord.length;
    if (input) {
      var event = new Event("input", {
        bubbles: true
      });

      element.dispatchEvent(event);
    }
  };

  function updateMirror() {
    const currentValue = textarea.value;
    const cursorPos = textarea.selectionStart;
    const startIndex = findIndexOfCurrentWord(textarea);

    const textBeforeCursor = textarea.value.substring(0, cursorPos);
    const textAfterCursor = textarea.value.substring(cursorPos);
    const pre = document.createTextNode(textBeforeCursor);
    const post = document.createTextNode(textAfterCursor);
    const caretEle = document.createElement("span");
    caretEle.innerHTML = "&nbsp;";

    reflection.innerHTML = "";
    reflection.append(pre, caretEle, post);

    caretElementRect = caretEle.getBoundingClientRect();
    // Extract just the current word
    currentWord = currentValue.substring(startIndex + 1, cursorPos);
    currentSuggestionIndex = -1;
    let tag = parseTags(currentWord.trim())?.[0];
    if (tag) {
      matches = [...suggestionsOptions].filter(
        (suggestion) => suggestion.indexOf(tag.id) > -1 && suggestion != tag.id
      );

      matches.sort((a: string, b: string) => {
        return a.length - b.length;
      });
      matches = matches.slice(0, 5).map((s) => {
        return tag.fullSign + s;
      });
      if (matches.length > 0) {
        tick().then(() => {
          positionAbsolute(container, caretEle, suggestions);
        });
      }
    } else {
      matches = [];
    }
  }
  function positionAbsolute(container, anchor, element) {
    const screenPadding = 16;
    const maxWidth = window.outerWidth - screenPadding * 2;
    const width = Math.min(150, maxWidth);
    const anchorRect = anchor.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    element.style.width = `${width}px`;
    let widthDiff = anchorRect.width - width;
    let rightOverflow = anchorRect.right + width / 2 - screenPadding - window.innerWidth;

    element.style.top = `${caretElementRect.top - container.getBoundingClientRect().top + caretElementRect.height}px`;
    if (rightOverflow > 0) {
      element.style.right = `0px`;
    } else if (anchorRect.x - containerRect.x + widthDiff / 2 <= 0) {
      element.style.left = `0px`;
    } else {
      let left = caretElementRect.left - containerRect.left - width / 2;
      element.style.left = `${left}px`;
    }
  }
  const clamp = (min, value, max) => Math.min(Math.max(min, value), max);

  const insertLine = (textarea, text: string) => {
    const position = textarea.selectionStart;
    textarea.setRangeText(text);
    setTimeout(() => {
      textarea.selectionStart = position + text.length + 1;
    });
  };

  const removeChars = (textarea, count: number = 0) => {
    const position = textarea.selectionStart;

    // Get the text before and after the cursor position
    const before = textarea.value.substring(0, position);
    const after = textarea.value.substring(position, textarea.value.length);

    // Insert the new text at the cursor position
    textarea.value = before.slice(0, -count) + after;

    // Set the cursor position to after the newly inserted text
    textarea.selectionStart = textarea.selectionEnd = position - count;
  };

  function getPreviousLines(textarea) {
    return textarea.value.substr(0, textarea.selectionStart).split("\n");
  }
  function getPreviousLine(textarea) {
    return getPreviousLines(textarea).slice(-1)[0] || "";
  }
  function updateMarkupAfterNewLine(textarea) {
    let previousLine: string = getPreviousLine(textarea);
    console.debug(`[editor] Previous line: ${previousLine}`);

    if (!previousLine.trim()) {
      return;
    }
    // unordered list
    if (previousLine.startsWith("- ") && previousLine.length > 2) {
      console.debug("[editor] inserting unordered list item");
      insertLine(textarea, "- ");
    }
    if (previousLine === "- ") {
      console.debug("[editor] removing empty list element");
      removeChars(textarea, 3);
    }

    // ordered list
    const olRegex = new RegExp(/^(\d+). (.*)/);
    let found = previousLine.match(olRegex);
    if (found) {
      if (found[2].trim()) {
        let nextIdx = parseInt(found[1]) + 1;
        console.debug(`[editor] inserting ordered list item ${nextIdx}`);
        insertLine(textarea, `${nextIdx}. `);
      } else {
        // we remove len(idx) + 2 chars to include the dot, the space and the newline char
        removeChars(textarea, found[1].length + 1 + 1 + 1);
      }
    }
  }
</script>

<div bind:this={container} class="mirror__container">
  <div bind:this={reflection} class="mirror__reflection" aria-hidden="true"></div>
  <textarea
    bind:this={textarea}
    aria-autocomplete="list"
    oninput={(e) => {
      updateMirror();
      oninput?.(e);
    }}
    onclick={(e) => {
      updateMirror();
      onclick?.(e);
    }}
    onscroll={() => {
      reflection.scrollTop = textarea.scrollTop;
    }}
    onkeydown={(e) => {
      if (!["ArrowDown", "ArrowUp", "ArrowRight", "Enter", "Escape"].includes(e.key)) {
        return;
      }

      const numSuggestions = matches.length;
      if (numSuggestions === 0) {
        if (e.key === "Enter") {
          updateMarkupAfterNewLine(e.target);
        }
        return;
      }
      if (e.key === "Enter" && currentSuggestionIndex === -1) {
        return;
      }
      e.preventDefault();
      switch (e.key) {
        case "ArrowDown":
          currentSuggestionIndex = clamp(0, currentSuggestionIndex + 1, numSuggestions - 1);
          replaceCurrentWord(textarea, matches[currentSuggestionIndex]);
          break;
        case "ArrowUp":
          currentSuggestionIndex = clamp(0, currentSuggestionIndex - 1, numSuggestions - 1);
          replaceCurrentWord(textarea, matches[currentSuggestionIndex]);
          break;
        case "Enter":
          replaceCurrentWord(textarea, matches[currentSuggestionIndex], true);
          matches = [];
          break;
        case "ArrowRight":
          currentSuggestionIndex = clamp(0, currentSuggestionIndex, numSuggestions - 1);
          replaceCurrentWord(textarea, matches[currentSuggestionIndex], true);
          matches = [];
          break;
        case "Escape":
          matches = [];
          break;
        default:
          break;
      }
    }}
    {...restProps}
  >
  </textarea>

  {#if matches.length > 0}
    <ul
      bind:this={suggestions}
      class="mirror__suggestions"
      role="listbox"
      data-testid="autocomplete-list"
    >
      {#each matches as match, i (i)}
        <li
          aria-posinset={i + 1}
          aria-setsize={matches.length}
          role="option"
          tabindex="-1"
          aria-selected={currentSuggestionIndex === i}
        >
          <button
            type="button"
            tabindex="-1"
            data-testid="autocomplete-option"
            onclick={(e) => {
              replaceCurrentWord(textarea, match, true);
              matches = [];
              e.preventDefault();
            }}>{match}</button
          >
        </li>
      {/each}
    </ul>
  {/if}
</div>
