# zotero-manager: Plugin Specification

## Overview

`zotero-manager` is a new Obsidian plugin that replicates and modernizes the functionality of `obsidian-zotero-integration` (v3.2.1). The goal is to maintain full feature parity while fixing compatibility issues with current Obsidian and Zotero versions, removing the dependency on a downloaded external binary for PDF annotation extraction, and updating the codebase to use current APIs and dependencies.

## Communication Architecture

The plugin communicates with Zotero exclusively through the **Better BibTeX (BBT)** plugin's local HTTP server:

- **Zotero**: `http://127.0.0.1:23119`
- **Juris-M**: `http://127.0.0.1:24119`
- **Custom port**: user-configurable

Two endpoint types are used:

1. **CAYW (Cite As You Write)** — `GET /better-bibtex/cayw?...` — triggers Zotero's item picker and returns the selected item in the requested format.
2. **JSON-RPC** — `POST /better-bibtex/json-rpc` — programmatic access to item data, notes, attachments, collections, bibliography, search, and library info.

**Requirement**: Zotero must be running with the Better BibTeX plugin installed. The new plugin will retain this requirement.

## Features to Implement

### 1. Citation Insertion (CAYW-based)

Insert a citation at the cursor position in the active editor. Supports multiple output formats, each configured as a named "citation format":

| Format | BBT query |
|--------|-----------|
| `latex` | `?format=latex&command=cite` |
| `biblatex` | `?format=biblatex&command=autocite` |
| `pandoc` | `?format=pandoc[&brackets=true]` |
| `formatted-citation` | `?format=formatted-citation[&style=<csl>]` |
| `formatted-bibliography` | via JSON-RPC `item.bibliography` |
| `template` | CAYW JSON → item JSON → Nunjucks template render |

Each configured citation format becomes an Obsidian command. Users define formats in plugin settings.

### 2. Export to Markdown

The primary feature: select one or more Zotero items via the picker, then render a Markdown note using a Nunjucks template. The output path, image output path, and image base name are also Nunjucks templates evaluated against the item data.

**Data pipeline per item:**
1. Fetch item JSON via `item.export` (translator `36a3b0b5-bad0-4a04-b79b-441c7cef77db` = CSL JSON)
2. Enrich item: resolve dates, collections, bibliography, notes, attachments
3. Extract PDF annotations (see §4)
4. Render output path template → determine target `.md` file
5. Load existing file content (for incremental update / persist blocks)
6. Render main template with full item data
7. Write or update the vault file

**Persist blocks**: sections of an existing note wrapped in special markers are preserved across re-imports.

Each named export format becomes an Obsidian command.

### 3. Note Import / Insert

- **Insert notes into current document**: Prompts via CAYW, fetches Zotero notes for selected items via `item.notes`, converts HTML → Markdown, inserts at cursor.
- **Import notes as files**: Same pipeline but creates one file per cite key under a configured folder.

Zotero notes can contain embedded annotation links and citation spans (HTML `data-annotation` / `data-citation` attributes) that are converted to `zotero://` deep-link anchors.

### 4. PDF Annotation Extraction

The old plugin used a downloaded native binary (`pdf-annots-extractor`) to extract annotations from PDF files. **This is the primary source of breakage** — the binary download mechanism uses a GitHub release URL and the binary itself may be outdated or incompatible with the current OS.

**New approach**: Use Zotero's native annotation storage (available since Zotero 6). Annotations are now stored in the Zotero database and accessible via the BBT `item.attachments` JSON-RPC call, which includes `annotations` arrays on each attachment. The old plugin already has partial support for this (`convertNativeAnnotation` in `export.ts`). The new plugin will rely **exclusively** on native Zotero annotations and drop the external binary entirely.

Annotation types supported: highlight, underline, note, image (area annotation).

For image annotations, the file is copied from Zotero's storage path into the vault.

### 5. Data Explorer

A sidebar view (ItemView) that lets the user inspect the full data object that would be passed to a template for a selected item. Useful for template authoring. Uses a tree viewer (JSON tree).

### 6. Cite Key Autocomplete / Suggest

An EditorSuggest that provides fuzzy-search autocomplete over all cite keys in the Zotero library. The suggestion list is cached and refreshed periodically. The insertion format is configurable via a template string (e.g., `[[{{citekey}}]]`).

### 7. Settings

| Setting | Description |
|---------|-------------|
| Database | Zotero / Juris-M / Custom |
| Port | Custom port (if database = Custom) |
| Citation formats | List of named citation insertion formats |
| Export formats | List of named export-to-markdown formats |
| Note import folder | Default vault path for imported notes |
| Open note after import | Whether to open newly created notes |
| Which note to open | First / last / all |
| Cite suggest template | Template for autocomplete insertion |
| Annotation concat | Merge consecutive annotations sharing a `+ ` comment prefix |

## Technical Stack

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Language | TypeScript | Same as original; required for Obsidian plugin API |
| Build | esbuild | Fast, same as original |
| Templating | Nunjucks | Same as original; user-facing template syntax stays compatible |
| UI (settings) | Obsidian native + React via Preact | Keep existing settings UI approach |
| Fuzzy search | Fuse.js | Same as original |
| HTTP | Obsidian `request()` | Stays in browser sandbox, no Node.js `http` required |
| PDF annotations | Zotero native (BBT JSON-RPC) | Eliminates external binary dependency |

## Key Differences from obsidian-zotero-integration

1. **No external binary**: PDF annotation extraction goes through BBT JSON-RPC only. The `AssetDownloader` module and all `exeVersion`/`exeOverridePath` settings are removed.
2. **Updated dependencies**: Obsidian API, TypeScript, esbuild, and all other packages updated to current versions.
3. **Modernized Obsidian API usage**: Replace deprecated APIs (e.g., `app.workspace.activeLeaf` → `app.workspace.getActiveViewOfType`, `createLeafBySplit` → `app.workspace.getLeaf('split')`).
4. **Clean TypeScript**: Strict mode enabled; eliminate `any` casts where possible.
5. **New plugin ID**: `zotero-manager` (not `obsidian-zotero-desktop-connector`).

## File / Module Structure

```
src/
  main.ts                  # Plugin entry point, command registration
  types.ts                 # All shared TypeScript interfaces/types
  helpers.ts               # Vault root, path utilities, window helpers
  settings/
    settings.tsx           # Settings tab UI
    CitationFormatSettings.tsx
    ExportFormatSettings.tsx
    SettingItem.tsx
    Icon.tsx
    select.helpers.tsx
    cslList.ts
  zotero/
    connection.ts          # isZoteroRunning, port resolution, queue
    cayw.ts                # CAYW picker calls (citation insertion)
    jsonRPC.ts             # All BBT JSON-RPC calls
    annotations.ts         # Native annotation processing (replaces binary)
  export/
    export.ts              # exportToMarkdown, renderCiteTemplate
    exportNotes.ts         # Note import/insert pipeline
    template.env.ts        # Nunjucks environment setup, PersistExtension
    template.helpers.ts    # appendExportDate, getLastExport, etc.
    basicTemplates/        # Built-in template helpers (authors, dates, etc.)
  ui/
    DataExplorerView.tsx   # Sidebar data inspector
    LoadingModal.ts        # "Fetching from Zotero…" modal
    CiteSuggest.ts         # EditorSuggest autocomplete
```

## Build Setup

```
package.json     # npm scripts: dev, build, check-types
esbuild.config.mjs
tsconfig.json
manifest.json    # id: zotero-manager, version: 0.1.0
versions.json
styles.css
```

## Development Plan

1. **Phase 1 — Scaffold**: Initialize npm project, configure esbuild + TypeScript, create `manifest.json`, stub `main.ts`.
2. **Phase 2 — Connection layer**: Port `connection.ts` + `jsonRPC.ts`; verify Zotero connectivity.
3. **Phase 3 — Citation insertion**: Implement CAYW-based citation commands + settings UI for citation formats.
4. **Phase 4 — Export pipeline**: Port template engine, `export.ts`, export format settings, export commands.
5. **Phase 5 — Native annotations**: Implement `annotations.ts` using BBT attachment data; integrate into export pipeline.
6. **Phase 6 — Note import**: Port `exportNotes.ts`; implement insert and import commands.
7. **Phase 7 — UI polish**: Data explorer, cite key autocomplete/suggest, loading modals.
8. **Phase 8 — Settings**: Full settings tab with all options.
9. **Phase 9 — Testing & cleanup**: Smoke-test against live Zotero, fix edge cases, update manifest version.
