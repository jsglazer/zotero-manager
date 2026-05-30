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

If Better BibTeX is not available, enter your **Zotero API key** and **user/group ID** in the Web API section to enable fallback mode.

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

## License

MIT
