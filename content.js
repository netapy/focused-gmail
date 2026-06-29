(() => {
  // What each action clicks: a list of label prefixes (Gmail's hover toolbar <li>,
  // rendered only on hover; FR labels, this fr-FR account) OR a CSS selector for an
  // always-present control (star, checkbox; locale-free).
  const ACTION_DEFS = {
    archive: { label: ["Archiver", "Archive"] },
    delete: { label: ["Supprimer", "Delete"] },
    read: { label: ["Marquer comme", "Mark as"] },
    snooze: { label: ["Mettre en attente", "Snooze"] },
    star: { sel: ".apU [role='button'], .apU span.T-KT" },
    select: { sel: ".oZ-x3 [role='checkbox']" },
  };

  // Defaults, overridable from the options page via chrome.storage.sync.
  const DEFAULTS = {
    keys: { archive: "e", delete: "Backspace", read: "u", star: "s", snooze: "b", select: "x" },
    hoverActions: true,
    sections: true,
    todayTag: true,
    sidebarLabels: false, // hide the sidebar's user-label color dots by default
  };

  // Display language follows the browser: section headers and the Today tag are shown
  // in EN or FR accordingly. The value is written to data-nm-section / data-nm-today
  // and drawn by CSS via attr(), so localising these strings is all that's needed.
  const LANG = (navigator.language || "en").toLowerCase().startsWith("fr") ? "fr" : "en";
  const STR = {
    fr: { sections: ["Aujourd'hui", "Hier", "7 derniers jours", "Plus ancien"], today: "Aujourd'hui" },
    en: { sections: ["Today", "Yesterday", "Last 7 days", "Older"], today: "Today" },
  }[LANG];
  const SECTIONS = STR.sections;
  const TODAY_LABEL = STR.today;

  // Month-name → index, accepting French AND English forms — Gmail's date tooltips are
  // in the account's language, which is independent of the browser language above.
  // Most-specific prefixes first so e.g. "mars" matches before "mar".
  const MONTHS = [
    ["janv", 0], ["jan", 0], ["févr", 1], ["fevr", 1], ["feb", 1], ["mars", 2], ["mar", 2],
    ["avril", 3], ["avr", 3], ["apr", 3], ["mai", 4], ["may", 4], ["juin", 5], ["jun", 5],
    ["juil", 6], ["jul", 6], ["août", 7], ["aout", 7], ["aug", 7], ["sept", 8], ["sep", 8],
    ["oct", 9], ["nov", 10], ["déc", 11], ["dec", 11],
  ];
  const monthIndex = (w) => { for (const [p, i] of MONTHS) if (w.startsWith(p)) return i; return -1; };

  let settings = DEFAULTS;
  let keymap = buildKeymap(DEFAULTS);
  let scheduled = false;

  // Load saved settings, then keep them in sync live (so the options page applies
  // without reloading Gmail).
  const store = (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) || null;
  if (store) {
    store.get(DEFAULTS, apply);
    chrome.storage.onChanged.addListener((_changes, area) => { if (area === "sync") store.get(DEFAULTS, apply); });
  }
  function apply(s) {
    settings = s;
    keymap = buildKeymap(s);
    document.documentElement.classList.toggle("mg-labels", !!s.sidebarLabels);
    schedule();
  }

  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("keydown", onHoverKey, true);
  schedule();

  function buildKeymap(s) {
    const m = {};
    const keys = (s && s.keys) || {};
    for (const action in keys) {
      const k = keys[action];
      if (k && ACTION_DEFS[action]) m[k] = ACTION_DEFS[action];
    }
    return m;
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    // rAF: sections land in the same frame Gmail paints, no gap/flash; mutations coalesce.
    requestAnimationFrame(() => { scheduled = false; sectionize(); });
  }

  // Tag rows with data-nm-section / data-nm-today so CSS can draw the header / today
  // tag. Pure attribute writes (gated by settings) — no <tr> added, moved or
  // reindexed, and attribute writes don't retrigger the childList observer.
  function sectionize() {
    const rows = [...document.querySelectorAll("tr.zA")];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ranked = rows.map((row) => ({ row, rank: rankOf(row, today) }));

    // suffix-min: a row starts bucket R only if no newer mail sits below it, so an
    // interleaved nudge / out-of-order mail never gets a header.
    const minBelow = new Array(ranked.length);
    let lowest = Infinity;
    for (let i = ranked.length - 1; i >= 0; i--) {
      minBelow[i] = lowest;
      if (ranked[i].rank != null) lowest = Math.min(lowest, ranked[i].rank);
    }

    const wanted = new Map();
    let current = -1;
    for (let i = 0; i < ranked.length; i++) {
      const { row, rank } = ranked[i];
      if (rank == null || rank <= current || minBelow[i] < rank) continue;
      if (rank > 0) wanted.set(row, SECTIONS[rank]);
      current = rank;
    }

    for (const { row, rank } of ranked) {
      const want = (settings.sections && wanted.get(row)) || "";
      if ((row.getAttribute("data-nm-section") || "") !== want) {
        if (want) row.setAttribute("data-nm-section", want);
        else row.removeAttribute("data-nm-section");
      }
      const isToday = !!(settings.todayTag && rank === 0);
      const curToday = row.getAttribute("data-nm-today");
      if (isToday) { if (curToday !== TODAY_LABEL) row.setAttribute("data-nm-today", TODAY_LABEL); }
      else if (curToday !== null) row.removeAttribute("data-nm-today");
    }
  }

  function rankOf(row, today) {
    const title = (row.querySelector(".xW span[title]")?.getAttribute("title") || "").toLowerCase();
    const year = title.match(/\b(\d{4})\b/);
    const day = title.match(/\b(\d{1,2})\b/); // first 1–2 digit run = the day (the 4-digit year is skipped)
    if (!year || !day) return null;
    let month = -1;
    for (const w of title.match(/[a-zà-ÿ.]+/g) || []) { const mi = monthIndex(w); if (mi >= 0) { month = mi; break; } }
    if (month < 0) return null;
    const diff = Math.round((today - new Date(+year[1], month, +day[1])) / 86400000);
    return diff <= 0 ? 0 : diff === 1 ? 1 : diff < 7 ? 2 : 3;
  }

  // Hover-to-act: press a configured key over a row → run that action on the HOVERED
  // row by clicking the control Gmail already shows. Pure listener, no DOM mutation.
  function onHoverKey(e) {
    if (!settings.hoverActions) return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const el = document.activeElement;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
    const map = keymap[e.key];
    if (!map) return;
    const row = document.querySelector("tr.zA:hover");
    if (!row) return;

    const find = () => (map.sel ? row.querySelector(map.sel) : labelMatch(row, map.label));
    const target = find();
    if (target) { e.preventDefault(); e.stopImmediatePropagation(); target.click(); return; }
    if (map.sel) return; // always-present control — nothing to wait for

    // The hover toolbar <li> renders after a brief hover-intent delay; own the key
    // and retry once if the cursor is still on the row.
    e.preventDefault();
    e.stopImmediatePropagation();
    setTimeout(() => {
      const t = find();
      if (t && row.matches("tr.zA:hover")) t.click();
    }, 120);
  }

  function labelMatch(row, prefixes) {
    for (const node of row.querySelectorAll("[aria-label], [data-tooltip]")) {
      const t = node.getAttribute("aria-label") || node.getAttribute("data-tooltip") || "";
      if (prefixes.some((p) => t.startsWith(p))) return node;
    }
    return null;
  }
})();
