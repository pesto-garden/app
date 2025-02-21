import { fetchEventSource } from "@microsoft/fetch-event-source";
import { Subject } from "rxjs";
import { PUBLIC_PESTO_DB_URL } from "$env/static/public";

import {
  type MangoQuery,
  type RxCollection,
  type RxDatabase,
  type RxDocument,
  type ExtractDocumentTypeFromTypedRxJsonSchema,
  type RxJsonSchema,
  createRxDatabase,
  addRxPlugin,
  toTypedRxJsonSchema,
  type RxState,
  type MangoQuerySelector,
  getAssumedMasterState
} from "rxdb";
import { replicateRxCollection } from "rxdb/plugins/replication";
import { RxDBMigrationSchemaPlugin } from "rxdb/plugins/migration-schema";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { RxDBStatePlugin } from "rxdb/plugins/state";
import { RxDBUpdatePlugin } from "rxdb/plugins/update";
import { dev } from "$app/environment";
import { RxDBCleanupPlugin } from "rxdb/plugins/cleanup";
import { RxDBLeaderElectionPlugin } from "rxdb/plugins/leader-election";
import cloneDeep from "lodash/cloneDeep";
import isEmpty from "lodash/isEmpty";
import { delay, parseTags, getRandomId } from "./ui";
import { tempoToPestoDocument } from "./replication";

if (dev) {
  import("rxdb/plugins/dev-mode").then((r) => {
    addRxPlugin(r.RxDBDevModePlugin);
  });
}

addRxPlugin(RxDBMigrationSchemaPlugin);
addRxPlugin(RxDBStatePlugin);
addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBCleanupPlugin);
addRxPlugin(RxDBLeaderElectionPlugin);

export const DEFAULT_SIGNALING_SERVER = "wss://webrtc.pesto.garden/";

export const LOCALE = new Intl.NumberFormat().resolvedOptions().locale;

export const DATE_FORMATTER = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit"
});

export const DATE_FORMATTER_SHORT = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit"
});
export const TIME_FORMATTER = new Intl.DateTimeFormat(LOCALE, {
  timeStyle: "short"
});
export const documentSchemaLiteral = {
  version: 15,
  primaryKey: "id",
  type: "object",
  required: ["id", "type", "col", "created_at", "modified_at", "tags", "fragments"],
  indexes: [["type", "created_at"]],
  properties: {
    id: {
      type: "string",
      maxLength: 40
    },
    type: {
      type: "string",
      enum: ["note", "setting", "form", "collection"],
      maxLength: 40
    },
    // collection is a reserved RxDB keyword
    col: {
      type: ["string", "null"],
      maxLength: 40
    },
    title: {
      type: ["string", "null"]
    },
    source: {
      type: ["string", "null"]
    },
    starred: {
      type: "boolean"
    },
    created_at: {
      type: "string",
      format: "date-time",
      maxLength: 30
    },
    modified_at: {
      type: "string",
      format: "date-time",
      maxLength: 30
    },
    tags: {
      type: "array",
      items: {
        type: "string"
      }
    },
    data: {
      type: "object",
      additionalProperties: true
    },
    fragments: {
      type: "object",
      required: [],
      properties: {
        text: {
          type: "object",
          required: ["content"],
          properties: {
            content: {
              type: "string"
            }
          }
        },
        form: {
          type: "object",
          required: ["id", "data", "annotations"],
          properties: {
            id: {
              type: ["string", "null"]
            },
            data: {
              type: "object",
              additionalProperties: true
            },
            annotations: {
              type: "object",
              additionalProperties: true
            }
          }
        },
        todolist: {
          type: "object",
          required: ["todos", "done", "column"],
          properties: {
            done: {
              type: "boolean"
            },
            column: {
              type: "number"
            },
            todos: {
              type: "array",
              minItems: 0,
              items: {
                type: "object",
                required: ["id", "done", "text"],
                properties: {
                  id: {
                    type: "string"
                  },
                  done: {
                    type: "boolean"
                  },
                  text: {
                    type: "string"
                  }
                }
              }
            }
          }
        }
      }
    }
  }
} as const;

export const migrationStrategies = {
  1: function (oldDocumentData) {
    if (oldDocumentData?.fragments.todolist) {
      if (oldDocumentData.fragments.todolist.done) {
        oldDocumentData.fragments.todolist.column = -1;
      } else {
        oldDocumentData.fragments.todolist.column = 0;
      }
    }
    return oldDocumentData;
  },
  2: function (oldDocumentData) {
    oldDocumentData.data = {};
    return oldDocumentData;
  },
  3: function (oldDocumentData) {
    return oldDocumentData;
  },
  4: function (oldDocumentData) {
    return oldDocumentData;
  },
  5: function (oldDocumentData) {
    return oldDocumentData;
  },
  6: function (oldDocumentData) {
    return oldDocumentData;
  },
  7: function (oldDocumentData) {
    oldDocumentData.starred = false;
    return oldDocumentData;
  },
  8: function (oldDocumentData) {
    return oldDocumentData;
  },
  9: function (oldDocumentData) {
    return oldDocumentData;
  },
  10: function (oldDocumentData) {
    if (oldDocumentData?.fragments?.form) {
      oldDocumentData.fragments.form.annotations = {};
    }
    return oldDocumentData;
  },
  11: function (oldDocumentData) {
    if (oldDocumentData?.fragments?.form) {
      if (!oldDocumentData.fragments.form.annotations) {
        oldDocumentData.fragments.form.annotations = {};
      }
    }
    return oldDocumentData;
  },
  12: function (oldDocumentData) {
    if (oldDocumentData?.fragments?.form) {
      if (oldDocumentData.fragments.form.id === undefined) {
        oldDocumentData.fragments.form.id = null;
      }
    }
    return oldDocumentData;
  },
  // remove todolist title, use note title
  13: function (oldDocumentData) {
    if (oldDocumentData?.fragments?.todolist) {
      if (!oldDocumentData.title) {
        oldDocumentData.title = oldDocumentData.fragments.todolist.title;
      }
      delete oldDocumentData.fragments.todolist.title;
    }
    return oldDocumentData;
  },
  // fix bugged 13 migration that ended up with todolists with no todos
  14: function (oldDocumentData) {
    if (oldDocumentData?.fragments?.todolist?.todos.length === 0) {
      oldDocumentData.fragments.todolist.todos.push({
        text: oldDocumentData.title || "Empty task",
        done: oldDocumentData.fragments.todolist.done,
        id: oldDocumentData.id
      });
    }
    return oldDocumentData;
  },
  // Added col type
  15: function (oldDocumentData) {
    oldDocumentData.col = null;
    return oldDocumentData;
  }
};

export const CURRENT_DOCUMENT_VERSION = Math.max(
  ...Object.keys(migrationStrategies).map((m) => parseInt(m))
);

const documentSchemaTyped = toTypedRxJsonSchema(documentSchemaLiteral);

// aggregate the document type from the schema
export type DocumentType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof documentSchemaTyped>;
export type NoteType = DocumentType & {
  type: "note";
};

export type TextType = NonNullable<DocumentType["fragments"]["text"]>;
export type TodolistType = NonNullable<DocumentType["fragments"]["todolist"]>;
export type FormFragmentType = NonNullable<DocumentType["fragments"]["form"]>;
export type TodosType = NonNullable<TodolistType["todos"]>;
export type TodoType = TodosType[number];

// create the typed RxJsonSchema from the literal typed object.
export const documentSchema: RxJsonSchema<DocumentType> = documentSchemaLiteral;

// and then merge all our types
export type DocumentCollection = RxCollection<DocumentType>;

export type DocumentDocument = RxDocument<DocumentType>;

export type DatabaseCollections = {
  documents: DocumentCollection;
};

export type Database = RxDatabase<DatabaseCollections>;

export type Globals = {
  db: null | Database;
  uiState: null | RxState;
  replications: [];
  forms: object;
};
export const globals: Globals = {
  db: null,
  uiState: null,
  replications: [],
  forms: {}
};

export type FormFieldConfiguration = {
  id: string;
  label: string;
  type: "number" | "text" | "boolean";
  required: boolean;
  default?: number | boolean | string | null;
  suggestions?: string[] | number[];
  autosuggest?: boolean;
  help?: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: string;
};

export type FormConfiguration = {
  id: string;
  name: string;
  fields: FormFieldConfiguration[];
};

export type CollectionConfiguration = {
  query: string;
};

export type Replication = {
  type: string;
  pull: boolean;
  push: boolean;
};
export type WebRTCReplication = Replication & {
  type: "webrtc";
  signalingServer: string;
  room: string;
};

export type CouchDBReplication = Replication & {
  type: "couchdb";
  server: string;
  database: string;
  username: string;
  password: string;
};

export type PestoServerReplication = Replication & {
  type: "pesto-server";
  database: string;
};

export type AnyReplication = CouchDBReplication | WebRTCReplication | PestoServerReplication;

export type PushPullConfig = {
  pull?: {};
  push?: {};
};
export async function getDb() {
  if (globals.db) {
    return globals;
  }
  let storage = getRxStorageDexie();
  if (dev) {
    storage = wrappedValidateAjvStorage({
      storage
    });
  }
  globals.replications = [];

  globals.db = await createRxDatabase<Database>({
    name: "main",
    storage,
    allowSlowCount: true,
    eventReduce: true
  });

  const documentSchema: RxJsonSchema<DocumentType> = documentSchemaLiteral;
  await globals.db.addCollections({
    documents: {
      schema: documentSchema,
      autoMigrate: false,
      migrationStrategies
    }
  });

  globals.uiState = await globals.db.addState("ui");

  return { db: globals.db, uiState: globals.uiState, replications: globals.replications };
}

export function loadFormsQuery() {
  return globals.db.documents.find({
    limit: 20000,
    selector: { type: "form" }
  });
}
export function observeLoadForms() {
  loadFormsQuery().$.subscribe((documents) => {
    for (const document of documents) {
      globals.forms[document.data.id] = document.data;
    }
  });
}

export function launchReplications(uiState, db) {
  console.log("Launching replications…");
  return uiState.replications$.subscribe(async (v) => {
    v = v || [];
    let newReplications = await setupReplications(db, globals.replications, v);
    globals.replications = newReplications;
  });
}

export async function syncReplications(replications: []) {
  for (const replication of replications) {
    if (replication.reSync) {
      await replication.reSync();
    }
  }
}
async function setupReplications(db: Database, current: [], config: AnyReplication[]) {
  // we stop and delete any existing replications
  for (const replicationState of current) {
    replicationState?.pull?._fetch.abort();
    if (replicationState.pause) {
      await replicationState.pause();
    }
    if (replicationState.cancel) {
      await replicationState.cancel();
    }
    if (replicationState.remove) {
      await replicationState.remove();
    }
  }

  // necessary for WebRTC replication to work
  window.process = {
    nextTick: (fn, ...args) => setTimeout(() => fn(...args))
  };

  let replicationStates = [];
  // we create replications from given configuration
  for (const conf of config) {
    let state = await createReplication(db, conf);
    if (state) {
      replicationStates.push(state);
    }
  }
  return replicationStates;
}

function getPushPullConfig(config: AnyReplication) {
  let pushPullConfig: PushPullConfig = {};
  if (config.push) {
    pushPullConfig.push = {};
  }
  if (config.pull) {
    pushPullConfig.pull = {};
  }
  return pushPullConfig;
}

async function getCouchDBReplicationState(db: Database, config: CouchDBReplication) {
  let pushPullConfig = getPushPullConfig(config);
  let CouchDBPlugin = await import("rxdb/plugins/replication-couchdb");
  const couchdbUrl = `${config.server}/${config.database}/`;
  return CouchDBPlugin.replicateCouchDB({
    replicationIdentifier: `pesto-couchdb-replication-${couchdbUrl}`,
    collection: db.documents,
    url: couchdbUrl,
    live: true,
    fetch: CouchDBPlugin.getFetchWithCouchDBAuthorization(config.username, config.password),
    ...pushPullConfig
  });
}
async function getWebRTCReplicationState(db: Database, config: WebRTCReplication) {
  let pushPullConfig = getPushPullConfig(config);
  let WebRTCPlugin = await import("rxdb/plugins/replication-webrtc");
  let state = await WebRTCPlugin.replicateWebRTC({
    collection: db.documents,
    topic: config.room,
    ...pushPullConfig,
    connectionHandlerCreator: WebRTCPlugin.getConnectionHandlerSimplePeer({
      signalingServerUrl: config.signalingServer
    })
  });
  state.error$.subscribe((err) => {
    console.log("REPLICATION ERROR", err);
  });
  let initialAddPeer = state.addPeer.bind(state);
  let replicationMonkeyPatched = false;
  // if (!config.pull) {
  //   // we protect from rogue/misconfigured instances that might push their changes
  //   // even if we disabled pull locally
  //   state.masterReplicationHandler.masterWrite = async function (rows) {
  //     console.debug('Skip writing remote rows locally because pull is disabled', rows)
  //     return []
  //   }
  // }
  // let initialSend = state.connectionHandler.send
  // state.connectionHandler.send = async function (peer, message) {
  //   // drop some messages based on our push/pull configuration
  //   // to protect ourselves from rogue clients
  //   console.log("MESSAIGE", message)
  //   if (!config.push && (message?.result?.documents || Array.isArray(message.result))) {
  //     console.debug('Dropping message because push is disabled…', message)
  //     return
  //   }
  //   return await initialSend(peer, message)
  // }
  state.addPeer = function addPeer(peer, replicationState) {
    // let initialPushHandler = replicationState?.push?.handler
    // async function pushHandler(docs) {
    //   return await initialPushHandler(docs)
    // }
    // if (initialPushHandler && replicationState && !replicationMonkeyPatched) {
    //   replicationState.push.handler = pushHandler
    //   replicationMonkeyPatched = true
    // }
    console.log("PEER ADDED", replicationState);
    return initialAddPeer(peer, replicationState);
  };
  return state;
}

async function getPestoServerReplicationState(db: Database, config: PestoServerReplication) {
  let pushPullConfig = getPushPullConfig(config);
  let baseUrl = `${PUBLIC_PESTO_DB_URL}/sync/db/${config.database}`;
  if (pushPullConfig.pull) {
    const myPullStream$ = new Subject();
    const controller = new AbortController();
    const signal = controller.signal;
    fetchEventSource(`${baseUrl}/stream`, {
      signal: signal,
      credentials: "include",
      onmessage: (event) => {
        console.debug("received event", event);
        const eventData = JSON.parse(event.data);
        myPullStream$.next({
          documents: eventData.documents.map((d) => {
            return {
              id: d.id,
              ...JSON.parse(d.content)
            };
          }),
          checkpoint: eventData.checkpoint
        });
      }
    });
    pushPullConfig.pull.handler = async function pullHandler(checkpointOrNull, batchSize: number) {
      const checkpoint = checkpointOrNull ? checkpointOrNull.updatedAt : "";
      const id = checkpointOrNull ? checkpointOrNull.id : "";
      const response = await fetch(
        `${baseUrl}/pull?checkpoint=${checkpoint || ""}&id=${id || ""}&limit=${batchSize}`,
        {
          credentials: "include",
          method: "GET"
        }
      );
      const data = await response.json();
      return {
        documents: data.documents.map((d) => {
          return JSON.parse(d.content);
        }),
        checkpoint: data.checkpoint
      };
    };
    pushPullConfig.pull.stream$ = myPullStream$.asObservable();
    pushPullConfig.pull._fetch = controller;
  }
  if (pushPullConfig.push) {
    pushPullConfig.push.handler = async function pushHandler(changeRows: []) {
      function serializeDocumentState(state) {
        return {
          id: state.id,
          modified_at: state.modified_at,
          content: JSON.stringify(state),
          _deleted: state._deleted
        };
      }
      const rawResponse = await fetch(`${baseUrl}/push`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(
          changeRows.map((r) => {
            return {
              newDocumentState: serializeDocumentState(r.newDocumentState),
              assumedMasterState: r.assumedMasterState
                ? serializeDocumentState(r.assumedMasterState)
                : undefined
            };
          })
        )
      });
      const conflictsArray = await rawResponse.json();
      return conflictsArray;
    };
  }
  return replicateRxCollection({
    collection: db.documents,
    replicationIdentifier: `pesto-server-replication-${baseUrl}`,
    live: true,
    ...pushPullConfig
  });
}

async function createReplication(db: Database, config: AnyReplication) {
  let state = null;
  if (config.type === "couchdb") {
    state = await getCouchDBReplicationState(db, config);
  }
  if (config.type === "pesto-server") {
    state = await getPestoServerReplicationState(db, config);
  }
  if (config.type === "webrtc") {
    state = await getWebRTCReplicationState(db, config);
  }
  state?.error$.subscribe((err) => console.log("error$", err));
  return state;
}

export function buildUniqueId(date: Date | null = null) {
  return (date || new Date()).toISOString();
}

export function getNewNote(params = { collection: "" }) {
  let date = new Date();
  return {
    id: buildUniqueId(date),
    type: "note",
    col: params.collection || null,
    created_at: date.toISOString(),
    modified_at: date.toISOString(),
    title: null,
    fragments: {},
    tags: []
  } as DocumentType;
}

export function getNewForm() {
  let data = getNewNote();
  data.type = "form";
  return data;
}

export function getNewTextFragment(content = "") {
  return {
    content
  } as TextType;
}

export function getNewTodoListFragment() {
  return {
    done: false,
    todos: [],
    column: 0
  };
}

export function getNewFormFragment(id = null, data = {}, annotations = {}) {
  return {
    id,
    data,
    annotations
  };
}

export function getNewCollection() {
  let note = getNewNote();
  note.id = getRandomId().toLowerCase();
  note.type = "collection";
  note.title = "My collection";
  note.data = {
    query: null,
    emoji: "📋️"
  };
  return note;
}

export function getNewTodo() {
  return {
    id: buildUniqueId(),
    text: "",
    done: false
  } as TodoType;
}

export async function getById(collection: RxCollection, id: string) {
  let results = await collection.findByIds([id]).exec();
  return results.get(id);
}

export async function createOrUpdateSetting(
  id: string,
  data: object,
  source: null | string = null
) {
  let existing = await globals.db?.documents.findOne({ selector: { id, type: "setting" } }).exec();
  if (existing) {
    return await existing.incrementalUpdate({
      $set: {
        modified_at: new Date().toISOString(),
        data: cloneDeep(data),
        source
      }
    });
  } else {
    let d = new Date().toISOString();
    return await globals.db?.documents.insert({
      id,
      type: "setting",
      col: null,
      created_at: d,
      modified_at: d,
      tags: [],
      fragments: {},
      data: cloneDeep(data),
      source
    });
  }
}

export function getSetting(id: string) {
  return globals.db?.documents.findOne({ selector: { id, type: "setting" } });
}
export async function getSettingData(id: string, defaultValue: object = {}) {
  let existing = await getSetting(id).exec();
  return existing ? existing.toMutableJSON().data : defaultValue;
}

export function getNoteUpdateData(note: DocumentType, data: object) {
  data = cloneDeep(data);
  data.modified_at = new Date().toISOString();

  let tagsSource = data["fragments.text"]?.content || "";
  let parsedTags = parseTags(tagsSource);
  const tags = parsedTags.map((t) => {
    return t.id;
  });

  if (tagsSource) {
    data.tags = [...new Set(tags)];
  }

  const dataTags = {};
  parsedTags
    .filter((t) => {
      return t.type === "annotation";
    })
    .forEach((t) => {
      try {
        dataTags[t.id] = JSON.parse(t.value);
      } catch {
        dataTags[t.id] = t.value;
      }
    });
  if (Object.keys(dataTags).length > 0) {
    data["fragments.form.annotations"] = dataTags;
    if (note.fragments.form) {
      // remove data that is present in both form fields and annotations from form field
      let formData = cloneDeep(note.fragments.form.data);
      for (const key in dataTags) {
        if (Object.prototype.hasOwnProperty.call(dataTags, key)) {
          if (formData[key] != undefined) {
            delete formData[key];
          }
        }
      }
      data["fragments.form.data"] = formData;
    } else {
      data["fragments.form.id"] = null;
      data["fragments.form.data"] = {};
    }
  } else if (data["fragments.text"] && note.fragments.form) {
    // text was updated and no available annotation are present
    // we just remove everything that is stale

    if (isEmpty(note.fragments.form.data)) {
      // the form itself don't contain data, wipe everything
      data["fragments.form"] = undefined;
    } else {
      // wipe only annotations
      data["fragments.form.annotations"] = {};
    }
  }

  return data;
}
export type QueryToken = {
  type: "is" | "text" | "tag" | "form" | "starred" | "column";
  value: string | number;
};

export function getTimeId() {
  return new Date().toISOString();
}

export async function createOrUpdateForm(
  id: null | string,
  config: FormConfiguration,
  source: string | null = null
) {
  let data;
  let note: DocumentDocument;
  config = cloneDeep(config);
  if (id) {
    note = await getById(globals.db?.documents, id);
    await note.incrementalUpdate({
      $set: getNoteUpdateData(note, { data: config, source })
    });
    note = note.getLatest();
  } else {
    data = getNewForm();
    data.data = config;
    data.source = source;
    note = await globals.db.documents.insert(data);
  }
  return note;
}

export function getQueryTokens(q: string) {
  return q
    .split(" ")
    .filter((s) => {
      return s.trim();
    })
    .map((s) => {
      let raw = s.trim().toLowerCase();
      if (raw.startsWith("is:")) {
        return {
          type: "is",
          value: raw.slice(3)
        } as QueryToken;
      } else if (raw.startsWith("tag:")) {
        return {
          type: "tag",
          value: raw.slice(4)
        } as QueryToken;
      } else if (raw.startsWith("#")) {
        return {
          type: "tag",
          value: raw.slice(1)
        } as QueryToken;
      } else if (raw.startsWith("form:")) {
        return {
          type: "form",
          value: raw.slice(5)
        } as QueryToken;
      } else if (raw.startsWith("starred:")) {
        return {
          type: "starred",
          value: raw.slice(8)
        } as QueryToken;
      } else if (raw.startsWith("column:")) {
        return {
          type: "column",
          value: parseInt(raw.slice(7))
        } as QueryToken;
      } else {
        return {
          type: "text",
          value: raw
        } as QueryToken;
      }
    });
}

export function getNoteSelector(q: string, collection: DocumentType | null | undefined) {
  if (!q.trim() && !collection) {
    return {};
  }

  let tokens = q.split(",").map((v) => getQueryTokens(v));
  let selector = {
    $or: tokens.map((t) => {
      return { $and: tokensToMangoQuery(t) };
    })
  };
  if (collection) {
    let collectionSelector = [{ col: collection.id }];
    if (collection.data?.query) {
      collectionSelector.push(getNoteSelector(collection.data.query, null));
    }
    selector = {
      $and: [{ $or: collectionSelector }, selector]
    };
  }
  return selector;
}

export function tokensToMangoQuery(tokens: QueryToken[]) {
  let query = [];
  for (const token of tokens) {
    if (token.type === "is") {
      if (token.value === "todo") {
        query.push({ "fragments.todolist": { $exists: true } });
      } else if (token.value === "subtask") {
        query.push({ "fragments.todolist.todos.1": { $exists: true } });
      } else if (token.value === "done") {
        query.push({ "fragments.todolist.done": { $eq: true } });
      } else if (token.value === "text") {
        query.push({ "fragments.text.content": { $exists: true } });
      } else if (token.value === "form") {
        query.push({ "fragments.form": { $exists: true } });
      }
    }
    if (token.type === "tag") {
      query.push({ tags: token.value });
    }
    if (token.type === "form") {
      query.push({ "fragments.form.id": token.value });
    }
    if (token.type === "starred") {
      query.push({ starred: token.value === "true" ? true : false });
    }
    if (token.type === "column") {
      query.push({ "fragments.todolist.column": token.value });
    }
    if (token.type === "text") {
      let orQuery = [];
      let regex = { $regex: `.*${token.value}.*`, $options: "i" };
      orQuery.push({ title: regex });
      orQuery.push({ "fragments.text.content": regex });
      orQuery.push({ "fragments.todolist.todos": { $elemMatch: { text: regex } } });
      query.push({ $or: orQuery });
    }
  }
  return query;
}
export function capitalizeFirstLetter(s: string) {
  return s[0].toUpperCase() + s.slice(1);
}

export function formatDate(d: string) {
  let p = new Date(d);
  let formatted = `${DATE_FORMATTER.format(p)} · ${TIME_FORMATTER.format(p)}`;
  return capitalizeFirstLetter(formatted);
}

export function formatDateShort(d: string) {
  let p = new Date(d);
  let formatted = `${DATE_FORMATTER_SHORT.format(p)}`;
  return capitalizeFirstLetter(formatted);
}
export function formatTimeShort(d: string) {
  let p = new Date(d);
  let formatted = `${TIME_FORMATTER.format(p)}`;
  return formatted;
}

export function timeAgo(d: string) {
  const date = (d instanceof Date) ? d : new Date(d);
  const formatter = new Intl.RelativeTimeFormat(LOCALE);
  const ranges = {
    years: 3600 * 24 * 365,
    months: 3600 * 24 * 30,
    weeks: 3600 * 24 * 7,
    days: 3600 * 24,
    hours: 3600,
    minutes: 60,
    seconds: 1
  };
  const secondsElapsed = Math.min((date.getTime() - Date.now()) / 1000, 0);
  for (let key in ranges) {
    if (ranges[key] < Math.abs(secondsElapsed)) {
      const delta = secondsElapsed / ranges[key];
      return formatter.format(Math.round(delta), key);
    }
  }
  return formatter.format(-1, "seconds");
}
