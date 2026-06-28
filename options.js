// Sober settings page for the Focused Gmail extension. Reads/writes
// chrome.storage.sync; content.js picks up changes live (no Gmail reload needed).
const DEFAULTS = {
  keys: { archive: "e", delete: "Backspace", read: "u", star: "s", snooze: "b", select: "x" },
  hoverActions: true,
  sections: true,
  todayTag: true,
  sidebarLabels: false,
};

const store = (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) || null;
let settings = JSON.parse(JSON.stringify(DEFAULTS));

if (store) store.get(DEFAULTS, (s) => { settings = s; render(); });
else render(); // standalone preview without the extension context

function render() {
  document.querySelectorAll(".key").forEach((b) => { b.textContent = show(settings.keys[b.dataset.act]); });
  document.querySelectorAll("[data-tog]").forEach((c) => { c.checked = !!settings[c.dataset.tog]; });
}

function show(k) { return k === " " ? "Espace" : k || "—"; }

function save() {
  if (store) store.set(settings);
  const s = document.querySelector(".saved");
  s.style.opacity = "1";
  setTimeout(() => { s.style.opacity = "0"; }, 1100);
}

// Each shortcut button records the next key you press.
document.querySelectorAll(".key").forEach((btn) => {
  btn.addEventListener("click", () => {
    btn.classList.add("rec");
    btn.textContent = "…";
    const onKey = (e) => {
      if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return; // wait for a real key
      e.preventDefault();
      document.removeEventListener("keydown", onKey, true);
      btn.classList.remove("rec");
      if (e.key === "Escape") { render(); return; } // cancel, keep current
      // a key maps to one action: clear it from any other action first
      for (const a in settings.keys) if (settings.keys[a] === e.key) settings.keys[a] = "";
      settings.keys[btn.dataset.act] = e.key;
      render();
      save();
    };
    document.addEventListener("keydown", onKey, true);
  });
});

document.querySelectorAll("[data-tog]").forEach((cb) => {
  cb.addEventListener("change", () => { settings[cb.dataset.tog] = cb.checked; save(); });
});
