// Paste – store and retrieve frequently used texts.
//
// Data is kept in chrome.storage.local (persists across browser restarts and
// is NOT wiped when the user clears browsing/site data, unlike localStorage).
// Shape: { entries: [{ id: string, name: string, value: string, hidden: boolean }, ...] }

const STORAGE_KEY = "entries";
const LEGACY_LOCALSTORAGE_KEY = "textboxState"; // used by v0.0.0.1

let entries = [];
let saveTimer = null;

function newId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ---------- storage ----------

function storageGet(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      if (chrome.runtime.lastError) {
        console.error("Paste: load failed", chrome.runtime.lastError);
        resolve(undefined);
        return;
      }
      resolve(result[key]);
    });
  });
}

function storageSet(key, value) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        console.error("Paste: save failed", chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
        return;
      }
      resolve();
    });
  });
}

// One-time migration of data saved by the old version in localStorage.
async function migrateLegacyData() {
  let raw;
  try {
    raw = localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
  } catch (e) {
    return null;
  }
  if (!raw) return null;

  let legacy;
  try {
    legacy = JSON.parse(raw);
  } catch (e) {
    console.warn("Paste: could not parse legacy data", e);
    return null;
  }
  if (!Array.isArray(legacy)) return null;

  const migrated = legacy
    .filter((pair) => Array.isArray(pair))
    .map((pair) => ({
      id: newId(),
      name: String(pair[0] ?? ""),
      value: String(pair[1] ?? ""),
      hidden: false,
    }));

  await storageSet(STORAGE_KEY, migrated);
  // Only remove the old copy after the new one is safely written.
  localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
  return migrated;
}

async function loadEntries() {
  const stored = await storageGet(STORAGE_KEY);
  if (Array.isArray(stored)) {
    return stored.map((e) => ({
      id: e.id || newId(),
      name: String(e.name ?? ""),
      value: String(e.value ?? ""),
      hidden: Boolean(e.hidden),
    }));
  }
  try {
    const migrated = await migrateLegacyData();
    if (migrated) return migrated;
  } catch (e) {
    console.error("Paste: migration failed", e);
  }
  return [];
}

function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  return storageSet(STORAGE_KEY, entries).catch(() => {});
}

// Debounce typing so we don't write on every keystroke.
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 250);
}

// ---------- UI ----------

function updateDescription() {
  const desc = document.querySelector(".desc");
  if (desc) desc.style.display = entries.length ? "none" : "";
}

const EYE_OPEN =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_CLOSED =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

// Apply the hidden/visible state to a row's value input and eye button.
function applyHidden(entry, valueInput, eyeBtn) {
  valueInput.type = entry.hidden ? "password" : "text";
  eyeBtn.innerHTML = entry.hidden ? EYE_CLOSED : EYE_OPEN; // static markup only
  const label = entry.hidden ? "Show value" : "Hide value";
  eyeBtn.title = label;
  eyeBtn.setAttribute("aria-label", label);
  eyeBtn.setAttribute("aria-pressed", String(entry.hidden));
}

function createRow(entry) {
  const row = document.createElement("div");
  row.className = "row";
  row.dataset.id = entry.id;

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "Name";
  nameInput.value = entry.name; // set as property: safe for any characters

  const valueInput = document.createElement("input");
  valueInput.type = "text";
  valueInput.placeholder = "Value";
  valueInput.value = entry.value;

  const eyeBtn = document.createElement("button");
  eyeBtn.type = "button";
  eyeBtn.className = "eye-button";
  applyHidden(entry, valueInput, eyeBtn);

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "copy-button";
  copyBtn.textContent = "Copy";

  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "delete-button";
  delBtn.textContent = "Delete";

  nameInput.addEventListener("input", () => {
    entry.name = nameInput.value;
    scheduleSave();
  });
  valueInput.addEventListener("input", () => {
    entry.value = valueInput.value;
    scheduleSave();
  });
  eyeBtn.addEventListener("click", () => {
    entry.hidden = !entry.hidden;
    applyHidden(entry, valueInput, eyeBtn);
    saveNow();
  });
  copyBtn.addEventListener("click", () => copyText(valueInput, copyBtn));
  delBtn.addEventListener("click", () => deleteRow(entry.id, row));

  row.append(nameInput, valueInput, eyeBtn, copyBtn, delBtn);
  return row;
}

function addRow() {
  const entry = { id: newId(), name: "", value: "", hidden: false };
  entries.push(entry);
  const row = createRow(entry);
  document.getElementById("container").appendChild(row);
  row.querySelector("input").focus();
  updateDescription();
  saveNow();
}

function deleteRow(id, rowElem) {
  entries = entries.filter((e) => e.id !== id);
  rowElem.remove();
  updateDescription();
  saveNow();
}

async function copyText(input, button) {
  const text = input.value;
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    // Fallback for environments where the async clipboard API is unavailable.
    input.select();
    document.execCommand("copy");
  }
  const original = button.textContent;
  button.textContent = "Copied!";
  setTimeout(() => (button.textContent = original), 1000);
}

function render() {
  const container = document.getElementById("container");
  container.querySelectorAll(".row").forEach((r) => r.remove());
  entries.forEach((entry) => container.appendChild(createRow(entry)));
  updateDescription();
}

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("addRow").addEventListener("click", addRow);
  entries = await loadEntries();
  render();
});

// Flush any pending (debounced) edit if the popup closes mid-typing.
window.addEventListener("pagehide", () => {
  if (saveTimer) saveNow();
});
