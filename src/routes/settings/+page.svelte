<script lang="ts">
  import { _, _n } from "$lib/i18n/index.svelte";
  import { lang } from "$lib/i18n/stores";

  import { PUBLIC_BUILD_ID, PUBLIC_PESTO_DB_URL } from "$env/static/public";

  import DialogForm from "$lib/components/DialogForm.svelte";
  import FormResult from "$lib/components/FormResult.svelte";
  import ReplicationForm from "$lib/components/ReplicationForm.svelte";
  import ReplicationCard from "$lib/components/ReplicationCard.svelte";
  import MainNavigation from "$lib/components/MainNavigation.svelte";
  import MainNavigationToggle from "$lib/components/MainNavigationToggle.svelte";
  import { globals, DEFAULT_SIGNALING_SERVER, type AnyReplication } from "$lib/db";
  import { languages } from "../../lib/i18n";
  import { type LogMessage, renderMarkdown, downloadFile, getRandomId } from "$lib/ui";
  import cloneDeep from "lodash/cloneDeep";
  import {
    handleImportTempo,
    handleImportPesto,
    handleExportPesto,
    handleExportTempo
  } from "$lib/replication";
  import { title } from "$lib/store";
  title.set($_("Réglages", ""));
  let replications: AnyReplication[] = $state([]);
  let newReplication = $state(null);
  let isLoadingPestoServerInfo = $state(false);
  let pestoServerInfo: null | object = $state(null);
  let pestoServerError: null | string = $state(null);
  let importFiles: FileList | null = $state(null);
  let importMessages: LogMessage[] = $state([]);
  let importType: "tempo" | "pesto" = $state("pesto");
  let importTypes = $state({
    tempo: {
      name: "Tempo",
      help: $_("Restaurer depuis un fichier Tempo / JSON.", ""),
      flags: [
        {
          id: "entries",
          label: $_("Restaurer les notes", ""),
          value: true
        },
        {
          id: "tasks",
          label: $_("Restaurer les tâches et le tableau", ""),
          value: true
        },
        {
          id: "forms",
          label: $_("Restaurer les formulaires", ""),
          value: true
        },
        {
          id: "aliases",
          label: $_("Restaurer les alias (en tant que collections)", ""),
          value: true
        }
      ],
      handler: handleImportTempo
    },
    pesto: {
      name: "Pesto",
      help: $_(
        "Restaurer depuis un fichier Pesto / JSON. C'est un moyen de restaurer une sauvegarde complète effectuée depuis une autre session Pesto.",
        ""
      ),
      flags: [
        {
          id: "notes",
          label: $_("Restaurer les notes", ""),
          value: true
        },
        {
          id: "collections",
          label: $_("Restaurer les collections", ""),
          value: true
        },
        {
          id: "forms",
          label: $_("Restaurer les formulaires", ""),
          value: true
        },
        {
          id: "settings",
          label: $_("Restaurer les réglages", ""),
          value: true
        }
      ],
      handler: handleImportPesto
    }
  });

  let exportMessages: LogMessage[] = $state([]);
  let exportType: "pesto" = $state("pesto");
  let exportTypes = $state({
    pesto: {
      name: "Pesto",
      help: $_("Créer une sauvegarde partielle ou complète au format Pesto / JSON.", ""),
      flags: [
        {
          id: "notes",
          label: $_("Sauvegarder les notes", ""),
          value: true
        },
        {
          id: "collections",
          label: $_("Sauvegarder les collections", ""),
          value: true
        },
        {
          id: "forms",
          label: $_("Sauvegarder les formulaires", ""),
          value: true
        },
        {
          id: "settings",
          label: $_("Sauvegarder les réglages", ""),
          value: true
        }
      ],
      handler: handleExportPesto
    },
    tempo: {
      name: "Tempo",
      help: $_("Créer une sauvegarde partielle ou complète au format Tempo / JSON.", ""),
      flags: [
        {
          id: "entries",
          label: $_("Sauvegarder les notes", ""),
          value: true
        },
        {
          id: "tasks",
          label: $_("Sauvegarder les tâches et le tableau", ""),
          value: true
        }
      ],
      handler: handleExportTempo
    }
  });

  let replicationType: string | null = $state(null);
  globals.uiState.get$("replications").subscribe((newValue: AnyReplication[]) => {
    replications = [...(newValue || [])].map((t) => cloneDeep(t));
  });

  async function handleSubmitReplication(replication: AnyReplication, index: number | null) {
    replications = [...replications];
    if (index === null) {
      replications.push(replication);
    } else {
      // editing an existing replication
      replications[index] = replication;
    }

    replications = [...replications];
    await globals.uiState.set("replications", () => {
      return replications.map((t) => cloneDeep(t));
    });
  }

  function getNewReplication(type: "webrtc" | "couchdb" | "pesto-server") {
    if (type === "webrtc") {
      return {
        type: "webrtc",
        signalingServer: DEFAULT_SIGNALING_SERVER,
        room: getRandomId(40),
        push: true,
        pull: true
      };
    }

    if (type === "pesto-server") {
      return {
        type: "pesto-server",
        database: "DEFAULT",
        push: true,
        pull: true
      };
    }

    let baseCouchDb = {
      type: "couchdb",
      server: "",
      database: "",
      username: "",
      password: "",
      push: true,
      pull: true
    };
    if (type === "couchdb") {
      return { ...baseCouchDb, type: "couchdb" };
    }
  }
  async function handleSubmit() {
    window.localStorage.clear();
    try {
      await globals.db?.remove();
      await globals.db?.close();
      window.indexedDB.databases().then((r) => {
        for (var i = 0; i < r.length; i++) window.indexedDB.deleteDatabase(r[i].name);
      });
      location.reload();
    } catch (err) {
      console.log(err);
    }
  }

  async function updateLanguage(v: string) {
    await globals.uiState.set("language", () => v);
    $lang = v;
  }

  function fetchPestoServerInfo() {
    isLoadingPestoServerInfo = true;
    pestoServerError = null;
    pestoServerInfo = null;
    let infoUrl = `${PUBLIC_PESTO_DB_URL}/sync/info`;
    fetch(infoUrl, { credentials: "include" }).then(async (response) => {
      if (response.ok) {
        pestoServerInfo = await response.json();
      } else if (response.status === 403) {
        pestoServerError = $_("Vous n'êtes pas connecté·e au serveur Pesto.", "");
      } else {
        pestoServerError = $_("Le serveur Pesto est injoignable.", "");
      }
    });
  }
  $effect(() => {
    fetchPestoServerInfo();
  });
</script>

<div class="my__layout">
  <MainNavigation />
  <main>
    <div class="with_sticky_header">
      <header>
        <div class="wrapper flex__row flex__justify-between flex__align-center">
          <MainNavigationToggle class="layout__multi-hidden" />
          <h2 class="flex__grow">{$_("Réglages", "")}</h2>
        </div>
      </header>
      <section class="flow | scroll">
        <div class="wrapper p__block-3">
          <div class="flow">
            <h1>Interface</h1>
            <div class="form__field">
              <label for="language">{$_("Langue", "")}</label>
              <select
                name="language"
                id="language"
                value={$lang}
                oninput={(e) => updateLanguage(e.target.value)}
              >
                {#each languages as language}
                  <option value={language.id}>{language.name}</option>
                {/each}
              </select>
            </div>
            <div class="form__field">
              <input
                type="checkbox"
                name="telemetry"
                id="telemetry"
                checked={globals.uiState.telemetryEnabled === undefined
                  ? true
                  : globals.uiState.telemetryEnabled}
                oninput={(e) => globals.uiState.set("telemetryEnabled", () => e.target.checked)}
              />
              <label for="telemetry">{$_("Partager les données d'utilisation", "")}</label>
              <p class="form__help">
                {$_(
                  "Les données d'utilisation nous servent à améliorer Pesto. Aucune adresse IP ni information personnelle n'est collectée.",
                  ""
                )}
              </p>
              <hr class="hidden" />
              <h1>{$_("Synchronisation", "")}</h1>
              <p>
                {$_("Les données de Pesto peuvent être synchronisées avec d'autres appareil.", "")}
              </p>
              {#if replications.length > 0}
                <div class="flow" role="list">
                  {#each replications as replication, i (i)}
                    <ReplicationCard
                      {pestoServerInfo}
                      {pestoServerError}
                      bind:replication={replications[i]}
                      class="card"
                      role="listitem"
                      on:submit={async (e) => {
                        await handleSubmitReplication(e.detail.replication, i);
                      }}
                      on:delete={async () => {
                        replications.splice(i, 1);
                        replications = [...replications];
                        await globals.uiState.set("replications", () => {
                          return replications.map((t) => cloneDeep(t));
                        });
                      }}
                    />
                  {/each}
                </div>
              {/if}
              {#if replications.length === 0}
                <DialogForm
                  anchorClass="button"
                  anchorText={$_("Configurer une nouvelle synchronisation", "")}
                  title={$_("Configurer une nouvelle synchronisation", "")}
                  onopen={() => {
                    replicationType = "webrtc";
                    newReplication = getNewReplication(replicationType);
                  }}
                  onsubmit={async (e: SubmitEvent) => {
                    e.preventDefault();
                    await handleSubmitReplication(newReplication, null);
                    newReplication = null;
                    replicationType = null;
                  }}
                >
                  <div class="form__field">
                    <label for="replication-type">{$_("Mode", "")}</label>
                    <select
                      name="replication-type"
                      id="replication-type"
                      bind:value={replicationType}
                      onchange={() => {
                        newReplication = getNewReplication(replicationType);
                      }}
                    >
                      <option value={null}>---</option>
                      <option value="webrtc">{$_("WebRTC", "")}</option>
                      {#if PUBLIC_PESTO_DB_URL}
                        <option value="pesto-server">{$_("Serveur Pesto (Alpha)", "")}</option>
                      {/if}
                      <option value="couchdb">{$_("CouchDB", "")}</option>
                    </select>
                  </div>
                  {#if newReplication}
                    <ReplicationForm
                      {pestoServerInfo}
                      {pestoServerError}
                      bind:replication={newReplication}
                    />
                  {/if}
                </DialogForm>
              {/if}
              <hr class="hidden" />

              <form
                id="export"
                class="flow m__block-3"
                onsubmit={async (e) => {
                  e.preventDefault();
                  exportMessages = [];
                  let flags = {};
                  for (const flag of exportTypes[exportType].flags) {
                    flags[flag.id] = flag.value;
                  }
                  let data = await exportTypes[exportType].handler(exportMessages, flags);
                  let d = new Date().toISOString().slice(0, 16);
                  let filename = `pesto_to_${exportType}_${d}.json`;
                  downloadFile(JSON.stringify(data, null, 2), "application/json", filename);
                }}
              >
                <h1>{$_("Sauvegarde", "")}</h1>
                <p>
                  {$_(
                    "Sauvegarder les données de Pesto afin d'en garder une copie ou de les transférer vers une autre application.",
                    ""
                  )}
                </p>
                <div class="form__field">
                  <label for="export-format">{$_("Format de sauvegarde", "")}</label>
                  <select name="export-format" id="export-format" bind:value={exportType}>
                    <option value="pesto">Pesto / JSON</option>
                    <option value="tempo">Tempo / JSON</option>
                  </select>
                </div>

                {#if exportType}
                  {@html renderMarkdown(exportTypes[exportType].help)}

                  {#if exportTypes[exportType].flags.length > 0}
                    {#each exportTypes[exportType].flags as flag, i (i)}
                      <div class="form__field">
                        <input
                          type="checkbox"
                          name={`export-flag-${flag.id}`}
                          id={`export-flag-${flag.id}`}
                          bind:checked={exportTypes[exportType].flags[i].value}
                        />
                        <label for={`export-flag-${flag.id}`}>{flag.label}</label>
                      </div>
                    {/each}
                  {/if}
                  <button type="submit"> {$_("Sauvegarder", "")} </button>
                  {#if exportMessages.length > 0}
                    <FormResult messages={exportMessages} forEl="export-format" />
                  {/if}
                {/if}
              </form>
              <hr class="hidden" />
              <form
                id="import"
                class="flow m__block-3"
                onsubmit={(e) => {
                  e.preventDefault();
                  importMessages = [];
                  let flags = {};
                  for (const flag of importTypes[importType].flags) {
                    flags[flag.id] = flag.value;
                  }
                  importTypes[importType].handler(importFiles, importMessages, flags);
                }}
              >
                <h1>{$_("Restauration", "")}</h1>
                <p>
                  {$_(
                    "Restaurer les données d'une autre source dans Pesto. Les doublons sont ignorés et vos données locales sont toujours préservées en cas de conflit.",
                    ""
                  )}
                </p>
                <div class="form__field">
                  <label for="import-source">{$_("Type de restauration", "")}</label>
                  <select name="import-source" id="import-source" bind:value={importType}>
                    <option value="pesto">Pesto / JSON</option>
                    <option value="tempo">Tempo / JSON</option>
                  </select>
                </div>

                {#if importType}
                  {@html renderMarkdown(importTypes[importType].help)}
                  <div class="form__field">
                    <label for="import-file">{$_("Sélectionner le fichier à restaurer", "")}</label>
                    <input
                      accept=".json,application/json"
                      id="import-file"
                      name="import-file"
                      type="file"
                      bind:files={importFiles}
                    />
                  </div>
                  {#if importTypes[importType].flags.length > 0}
                    {#each importTypes[importType].flags as flag, i (i)}
                      <div class="form__field">
                        <input
                          type="checkbox"
                          name={`import-flag-${flag.id}`}
                          id={`import-flag-${flag.id}`}
                          bind:checked={importTypes[importType].flags[i].value}
                        />
                        <label for={`import-flag-${flag.id}`}>{flag.label}</label>
                      </div>
                    {/each}
                  {/if}
                  <button type="submit"> {$_("Restaurer", "")} </button>
                  {#if importMessages.length > 0}
                    <FormResult messages={importMessages} forEl="import-file" />
                  {/if}
                {/if}
              </form>

              <hr class="hidden" />

              <h1>{$_("Effacer mes données", "")}</h1>
              <p>
                {$_(
                  "Vous pouvez supprimer l'intégralité de vos données Pesto. Une confirmation vous sera demandée.",
                  ""
                )}
              </p>
              <DialogForm
                anchorClass="button"
                anchorText={$_("Effacer toutes mes données", "")}
                title={$_("Effacer toutes les données de Pesto ?", "")}
                onsubmit={(e: SubmitEvent) => {
                  e.preventDefault();
                  handleSubmit();
                }}
              >
                <p>
                  {$_(
                    "Supprimer toutes les données locales y compris les notes, tâches, paramètres, collections et formulaires. Cette action est irréversible.",
                    ""
                  )}
                </p>
              </DialogForm>
              <hr class="hidden" />
              <h1>{$_("Informations de l'application", "")}</h1>
              <p>{$_("Version : %0", "", [PUBLIC_BUILD_ID])}</p>
              <p>
                <a href="https://flns.fr" target="_blank" noreferrer>{$_("Logo par flns.fr", "")}</a
                >
              </p>
              <hr class="hidden" />
            </div>
          </div>
        </div>
      </section>
    </div>
  </main>
</div>
