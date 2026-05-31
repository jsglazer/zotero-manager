# Zotero Manager for Obsidian

An Obsidian plugin for querying and importing bibliographic information, PDF annotations, notes, and citations from [Zotero](https://www.zotero.org/). Built as a modernized replacement for [obsidian-zotero-integration](https://github.com/mgmeyers/obsidian-zotero-integration), with full feature parity, native Zotero 6 annotation support, and a Zotero Web API fallback mode.

---

## Features

- **Insert citations** — trigger Zotero's item picker and insert formatted citations directly at the cursor (LaTeX, BibLaTeX, Pandoc, formatted citation/bibliography, or custom Nunjucks template)
- **Export to Markdown** — export Zotero items to Obsidian notes using fully customizable Nunjucks templates, with support for persist blocks that survive re-imports
- **Import annotations** — pull PDF highlights, underlines, notes, and image annotations from Zotero 6's native annotation store directly into Obsidian (no external binary required)
- **Import notes** — import Zotero text notes (including embedded annotation links) as Obsidian files
- **Cite key autocomplete** — type `@` in any note to trigger fuzzy-search autocomplete over your entire Zotero library
- **Data explorer** — sidebar view to inspect the full data object available to your templates
- **Connection status** — live Linked / Not Linked indicator in settings
- **Web API fallback** — works without Better BibTeX by falling back to the Zotero Web API

---

## Requirements

### Primary mode (recommended)
- [Zotero](https://www.zotero.org/) running on your machine
- [Better BibTeX for Zotero](https://retorque.re/zotero-better-bibtex/) plugin installed in Zotero

### Fallback mode
- A [Zotero Web API key](https://www.zotero.org/settings/keys) and your Zotero user/group ID (configured in plugin settings)

> **Desktop only.** This plugin requires the Obsidian desktop app.

---

## Installation

1. Download `manifest.json`, `main.js`, and `styles.css` from the [latest release](https://github.com/jsglazer/zotero-manager/releases).
2. Create a folder at `<your-vault>/.obsidian/plugins/zotero-manager/`.
3. Place all three files in that folder.
4. In Obsidian → Settings → Community plugins, enable **Zotero Manager**.

---

## Setup

### 1. Connect to Zotero

Open **Settings → Zotero Manager**. The **Linked** / **Not Linked** badge next to the Database selector shows your connection status.

- **Zotero** (default) — uses port 23119
- **Juris-M** — uses port 24119
- **Custom** — specify your own port

If Better BibTeX is not available, configure the Web API fallback as described below.

### 1a. Zotero Web API fallback (optional)

Use this when Zotero is not running locally, or Better BibTeX is not installed.

**Step 1 — Create an API key**

1. Log in to [zotero.org](https://www.zotero.org/) and go to **Settings → Feeds/API → [Create new private key](https://www.zotero.org/settings/keys/new)**.
2. Give the key a name (e.g. *Obsidian*).
3. Under **Personal Library**, enable **Allow library access** and **Allow notes access**.
4. If you use group libraries, enable **Allow library access** for each group under **Default Group Permissions** or individually.
5. Click **Save Key** and copy the key string shown — it is only displayed once.

**Step 2 — Find your user ID**

Your numeric user ID appears on the same [Feeds/API settings page](https://www.zotero.org/settings/keys) under *"Your userID for use in API calls is XXXXXXX"*.

**Step 3 — Enter credentials in Obsidian**

Open **Settings → Zotero Manager → Zotero Web API (fallback)**:

- **API key** — paste the key from Step 1
- **User / group ID** — enter your numeric user ID from Step 2

The plugin will automatically use the Web API whenever the local Zotero/BBT connection is unavailable.

A **Valid** (green) / **Invalid** (red) badge appears next to the API key field and updates whenever the key or user ID changes, confirming the credentials work before you use them.

> **Note:** The Web API does not support the Zotero item picker (CAYW). In fallback mode, use the **Insert notes into current document** or **Import notes** commands, which will present an in-Obsidian search modal instead.

### 2. Create citation formats

Each citation format becomes an Obsidian command under **Insert citation: [name]**.

| Format | Output example |
|--------|---------------|
| Pandoc | `@smith2020` |
| LaTeX | `\cite{smith2020}` |
| BibLaTeX | `\autocite{smith2020}` |
| Formatted citation | (APA, Chicago, etc.) |
| Formatted bibliography | Full reference entry |
| Template | Any Nunjucks output |

### 3. Create export formats

Each export format becomes an **Export to Markdown: [name]** command. Configure:

- **Template path** — path to a Nunjucks `.md` template in your vault
- **Output path template** — where to save the exported note (e.g. `Literature/{{citekey}}.md`)
- **Image output path** — where to save exported annotation images (e.g. `assets/{{citekey}}`)
- **CSL style** — optional citation style for the `bibliography` template variable

### 4. Configure note import

Set a **Note import folder** (with autocomplete) for the **Import notes** command. Toggle **Open note after import** to automatically open newly created files.

---

## Commands

| Command | Description |
|---------|-------------|
| **Insert citation: [name]** | Opens Zotero picker; inserts formatted citation at cursor |
| **Export to Markdown: [name]** | Opens Zotero picker; exports item to a Markdown note |
| **Import notes** | Opens Zotero picker; imports Zotero notes + PDF annotations as files |
| **Insert notes into current document** | Inserts Zotero notes + annotations inline at cursor |
| **Open data explorer** | Opens sidebar with the full template data object for a selected item |
| **Refresh cite key cache** | Forces a refresh of the cite key list used for autocomplete |

---

## Dataview Integration

Zotero Manager integrates with the [Dataview](https://github.com/blacksmithgu/obsidian-dataview) plugin automatically — no configuration required. If Dataview is installed and enabled, the plugin injects a `citekeys` field into Dataview's index for every note that contains citations.

> **No files are modified.** Fields are injected directly into Dataview's in-memory index at runtime, exactly as the Obsidian Annotation Manager plugin does. Your notes stay clean.

### Which citations are detected

| Format | Example | Detected |
|--------|---------|---------|
| Pandoc | `@smith2020` | ✅ |
| Pandoc bracketed | `[@smith2020]` or `[@key1; @key2]` | ✅ |
| LaTeX `\cite` | `\cite{smith2020}` | ✅ |
| LaTeX variants | `\autocite{}`, `\parencite{}`, `\textcite{}`, etc. | ✅ |
| Formatted citation | (Smith, 2020) | ❌ (no parseable key) |
| Template output | depends on template | ✅ if `@key` or `\cite{}` pattern used |

### Querying with Dataview

**Find all notes that cite a specific paper:**
```dataview
TABLE file.link, citekeys
FROM "Notes"
WHERE contains(citekeys, "smith2020")
```

**List all cited papers across a folder:**
```dataview
TABLE citekeys
FROM "Literature"
WHERE citekeys
```

**Find notes citing multiple specific papers:**
```dataview
TABLE file.link
FROM "Notes"
WHERE contains(citekeys, "smith2020") AND contains(citekeys, "jones2021")
```

**Imported notes** (via **Import notes** command) also get a `citekeys` field injected automatically with the Zotero item's cite key.

**Exported notes** (via **Export to Markdown**) are queryable via their template frontmatter — any fields you put in your template's YAML block (e.g. `citekey`, `title`, `year`) are natively visible to Dataview without any injection.

---

## Cite Key Autocomplete

Type `@` in any note to open a fuzzy-search suggestion list over your Zotero library. Select an entry to insert using the configured **Insertion template** (default: `[[{{citekey}}]]`).

The cache refreshes automatically every 60 seconds while Zotero is running, or on demand with **Refresh cite key cache**.

---

## Templates

Export templates use [Nunjucks](https://mozilla.github.io/nunjucks/) syntax. A basic example:

```markdown
---
citekey: {{citekey}}
title: "{{title}}"
authors: {{authorString}}
year: {{year}}
---

# {{title}}

{{bibliography}}

## Notes

{% for note in notes %}
{{note.note}}
{% endfor %}

## Annotations

{% for attachment in attachments %}
{% for annotation in attachment.annotations %}

### {{annotation.colorCategory}} — p. {{annotation.pageLabel}}

{{annotation.annotatedText}}

{{annotation.comment}}

[Go to annotation]({{annotation.desktopURI}})
{% endfor %}
{% endfor %}
```

### Available template variables

| Variable | Description |
|----------|-------------|
| `citekey` | Better BibTeX cite key |
| `title` | Item title |
| `authorString` | Authors formatted as "Family, Given; ..." |
| `firstAuthor` | Last name of first author |
| `year`, `month`, `day` | Publication date parts |
| `bibliography` | Formatted bibliography entry (HTML → Markdown) |
| `collections` | Array of `{ name, fullPath }` |
| `tags` | Array of `{ tag }` |
| `tagNames` | Comma-separated tag names |
| `hashTags` | Space-separated `#hashtags` |
| `notes` | Array of Zotero note objects |
| `attachments` | Array of attachment objects (each with `annotations`) |
| `importDate` | Moment.js date of this import |
| `desktopURI` | `zotero://select/...` link to open item in Zotero |

#### Annotation variables (inside `attachment.annotations`)

| Variable | Description |
|----------|-------------|
| `type` | `highlight`, `underline`, `note`, `image` |
| `color` | Hex color |
| `colorCategory` | Human name: Yellow, Red, Green, … |
| `annotatedText` | Highlighted/underlined text |
| `comment` | User's annotation comment |
| `pageLabel` | Page label string |
| `page` | Page index (1-based) |
| `desktopURI` | `zotero://open-pdf/...` deep link to annotation |
| `tags`, `allTags`, `hashTags` | Annotation tags |

### Persist blocks

Wrap a section in `{% persist "key" %}...{% endpersist %}` to preserve it across re-imports. Useful for notes you add manually to an exported file.

```markdown
{% persist "my-notes" %}
Anything written here survives the next re-import.
{% endpersist %}
```

---

## Annotation import format

When using **Import notes**, PDF annotations are formatted as:

```markdown
## Yellow — p. 12

The key finding was that treatment effects vary significantly by subgroup.

This contradicts the Smith 2019 meta-analysis.

[Go to annotation](zotero://open-pdf/library/items/ABCD1234?page=12&annotation=XY12)
```

- Highlights and underlines with both annotated text and a comment render each as a bullet
- Notes and images show the comment text
- All annotations include a deep link back to the exact location in the PDF

---

## Troubleshooting

**"Cannot connect to Zotero"**
- Ensure Zotero is running
- Ensure Better BibTeX is installed and enabled in Zotero
- Check that the port in settings matches BBT's server port (Zotero → Edit → Preferences → Better BibTeX → Automatic export)

**Citation commands not appearing**
- Commands are registered when formats are saved; if a command is missing, open settings, verify the format is listed, and re-save.

**Annotations not appearing in imported notes**
- Requires Zotero 6 or later (annotations must be stored natively in Zotero, not via ZotFile)
- Open the PDF in Zotero's built-in reader and create annotations there

**Screen stays on Zotero after picking an item**
- This is handled automatically via the Electron window API. If it still occurs, click the Obsidian icon in the dock/taskbar to return.

---

## Differences from obsidian-zotero-integration

| Feature | obsidian-zotero-integration | zotero-manager |
|---------|---------------------------|----------------|
| PDF annotation extraction | External binary (downloaded from GitHub) | Zotero 6 native API — no binary needed |
| Zotero Web API fallback | No | Yes |
| Obsidian API | Outdated (1.1.x) | Current (1.4+) |
| TypeScript | Loose | Strict |
| Overwrite protection | None | Confirm modal before overwriting |
| Cite key autocomplete | Yes | Yes |
| Template engine | Nunjucks | Nunjucks (compatible) |

---

Build with Claude!

## License

MIT
