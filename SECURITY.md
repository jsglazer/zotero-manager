# Security Policy

## Supported versions

Only the latest released version of Zotero Manager receives fixes. Please update to
the newest release before reporting an issue.

## Reporting a vulnerability

Please report security issues privately rather than opening a public issue:

- Use GitHub's **"Report a vulnerability"** button (Security tab → Privately report
  a vulnerability): <https://github.com/jsglazer/zotero-manager/security/advisories/new>
- or open a regular issue **without** sensitive details and ask for a private channel.

Please include reproduction steps and the plugin version (see `manifest.json`). We aim
to acknowledge reports within 14 days and to release a fix in a subsequent version.

## Scope & threat model

Zotero Manager runs inside Obsidian and communicates with your **locally running**
Zotero instance (the Zotero connector / local HTTP API, typically
`http://127.0.0.1:23119`) to import citations, bibliographies, notes, and PDF
annotations.

- It makes no external network requests beyond the local Zotero connection; nothing
  leaves your machine and there is no telemetry.
- Data returned by Zotero (citation metadata, note/annotation text) is treated as
  untrusted input and inserted into notes via the Obsidian API.
- File access uses the sandboxed Obsidian Vault API with `normalizePath()`.
