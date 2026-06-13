# Security Policy

## Supported versions

Only the latest released version of Zotero Manager receives fixes. Please update to
the newest release before reporting an issue.

## Reporting a vulnerability

Please report security issues privately rather than opening a public issue:

- Use GitHub's **"Report a vulnerability"** button under the repository's
  **Security** tab (Privately report a vulnerability), or
- open a regular issue **without** sensitive details and ask for a private channel.

Please include reproduction steps and the plugin version (see `manifest.json`).
You can expect an initial response within a reasonable time; fixes are released as
a new version.

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
