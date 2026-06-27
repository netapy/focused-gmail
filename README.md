# Minimal Gmail

A small **Manifest V3** Chrome extension that makes Gmail's inbox **list** calmer and
more minimal — Notion-style label pills, time-section headers, and keyboard
"hover-to-act" shortcuts — plus a tiny settings page to configure it.

It only restyles and adds shortcuts to the **message list**. The sidebar, reading
pane, search, and compose are left alone. No build step, no dependencies, no network
access.

## Features

- **Calmer list (CSS).** Pure white rows (read mail is dimmed by content opacity,
  never a background tint), no separator lines, one-line subjects, gray right-aligned
  dates, Gmail's own labels turned into right-aligned pastel pills, an unread accent
  dot, and a green **Today** tag on today's mail.
- **Time-section headers (tiny JS).** `Yesterday` / `Last 7 days` / … are drawn with a
  data-attribute + CSS `::before` on the *existing* row — no `<tr>` is ever inserted or
  reordered, so clicks always open the right message. The script only sets attributes
  (idempotent, inside `requestAnimationFrame`), so it can't storm or flicker.
- **Hover-to-act (tiny JS).** Press a key while the cursor is over a row to run that
  action on the **hovered** mail — no selecting first. It just clicks the per-row
  control Gmail already provides, so it stays a pure event listener with no DOM
  mutation. Archive/delete remain reversible (Gmail's undo toast still appears).
- **Chrome cleanup (CSS).** Optionally hides the Gmail wordmark and, when the sidebar
  is *collapsed*, the user-labels section — expand the sidebar and the labels come
  back. Uses a CSS container query on the nav width, so it's reactive with no JS.
- **Settings popup.** Click the toolbar icon to remap shortcuts and toggle behaviors.
  Stored in `chrome.storage.sync` and applied live (no Gmail reload).

## Hover-to-act shortcuts

Defaults — all remappable in the settings popup. Hover a mail row, then press:

| Key | Action |
|-----|--------|
| `e` | Archive |
| `Backspace` (or `#`) | Delete |
| `u` | Mark read / unread |
| `s` | Star / unstar |
| `b` | Snooze |
| `x` | Select (check the row) |

If you're not hovering a row, the keys fall through to Gmail's normal behavior.
Archive/delete/read/snooze use Gmail's hover toolbar, which renders ~150 ms after you
settle on a row — if nothing happens, the row hadn't finished hovering; re-press.

## Install

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. Open or refresh Gmail.

After editing the source, click **Reload** (⟳) on the extension card in
`chrome://extensions`, then **hard-refresh** Gmail (`Cmd/Ctrl+Shift+R`). A plain Gmail
refresh re-injects the *cached* files; only reloading the extension makes Chrome
re-read them from disk.

## Privacy

- Requests a single permission: `storage` (to save your shortcut/behavior settings).
- Runs only on `https://mail.google.com/*`.
- Makes **no network requests** and sends nothing anywhere. All settings stay in
  `chrome.storage.sync` on your own Google account.

## How it works

The design is **CSS-first**: almost everything is styling that targets Gmail's own
list elements in place. The only JavaScript sets a few `data-` attributes for the
time-section headers and listens for the hover-to-act keys — it never inserts,
reorders, or rebuilds rows, which is what keeps clicks landing on the correct mail and
the list free of flicker.

## Caveats

Gmail ships obfuscated, localized class names (`.zA`, `.bog`, `.at`, the hover-toolbar
labels like `Archiver` / `Supprimer`, etc.). This extension was built and verified
against a **French** Gmail; a Gmail redesign or a different UI language may rename
those hooks and need a small nudge. It's an unpacked developer extension, not a
Web Store listing.

## License

[MIT](LICENSE) © 2026 Baudouin A.
