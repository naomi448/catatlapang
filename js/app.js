// app.js — CatatLapang UI wiring.
//
// Feature map (see design-catatlapang.md):
//   D1 Ringkas       -> nano.js (Chrome Prompt API, on-device only).
//                       If Nano is unavailable the raw note goes NOWHERE;
//                       the UI offers a separate, explicit cloud button.
//   D1' Cloud Ringkas-> firebase-ai.js cloudSummarize (only on that tap).
//   D2 Terjemahkan   -> nano.js first; firebase-ai.js PREFER_ON_DEVICE
//                       fallback when the Prompt API path is unavailable.
//   C1 Laporan       -> firebase-ai.js cloudWeeklyReport, built ONLY from
//                       summaries the worker marked "reviewed".
//   D3/D4            -> readiness pill in the header + a badge stamped on
//                       every AI result showing where it ran.

import {
  getAllNotes,
  putNote,
  deleteNote,
  getLatestReport,
  putLatestReport,
  newId,
} from "./db.js";
import {
  isPromptApiPresent,
  getNanoStatus,
  nanoSummarize,
  nanoTranslate,
} from "./nano.js";
import {
  firebaseReady,
  cloudWeeklyReport,
  cloudSummarize,
  firebaseTranslate,
} from "./firebase-ai.js";
import { sampleNotes } from "./samples.js";

// ---------------------------------------------------------------------------
// State + element handles
// ---------------------------------------------------------------------------

let notes = [];
let selectedId = null;

const $ = (id) => document.getElementById(id);
const els = {
  nanoPill: $("nano-pill"),
  netPill: $("net-pill"),
  noteList: $("note-list"),
  noteListEmpty: $("note-list-empty"),
  btnNew: $("btn-new"),
  btnSamples: $("btn-samples"),
  title: $("note-title"),
  text: $("note-text"),
  btnSave: $("btn-save"),
  btnRingkas: $("btn-ringkas"),
  btnDelete: $("btn-delete"),
  saveStatus: $("save-status"),
  summaryBody: $("summary-body"),
  summaryBadge: $("summary-badge"),
  progress: $("summary-progress"),
  progressFill: $("summary-progress-fill"),
  progressText: $("summary-progress-text"),
  cloudBox: $("cloud-fallback-box"),
  btnRingkasCloud: $("btn-ringkas-cloud"),
  cloudFallbackNote: $("cloud-fallback-note"),
  translateLang: $("translate-lang"),
  btnTranslate: $("btn-translate"),
  translationBox: $("translation-box"),
  translationText: $("translation-text"),
  translationBadge: $("translation-badge"),
  chkReviewed: $("chk-reviewed"),
  weekStrip: $("week-strip"),
  btnReport: $("btn-report"),
  reportCard: $("report-card"),
  reportBody: $("report-body"),
  reportBadge: $("report-badge"),
  storageStatus: $("storage-status"),
};

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function selectedNote() {
  return notes.find((n) => n.id === selectedId) || null;
}

// ---------------------------------------------------------------------------
// Header pills (D3)
// ---------------------------------------------------------------------------

async function refreshNanoPill() {
  const status = await getNanoStatus();
  els.nanoPill.textContent = status.label;
  els.nanoPill.className =
    "pill " +
    (status.state === "available"
      ? "pill-ok"
      : status.state === "downloadable" || status.state === "downloading"
        ? "pill-warn"
        : "pill-bad");
}

function refreshNetPill() {
  const online = navigator.onLine;
  els.netPill.textContent = online ? "Online" : "Offline — on-device features still work";
  els.netPill.className = "pill " + (online ? "pill-online" : "pill-offline");
}

window.addEventListener("online", refreshNetPill);
window.addEventListener("offline", refreshNetPill);

// ---------------------------------------------------------------------------
// Note list + week strip
// ---------------------------------------------------------------------------

function renderNoteList() {
  els.noteList.innerHTML = "";
  els.noteListEmpty.style.display = notes.length ? "none" : "";
  for (const n of notes) {
    const li = document.createElement("li");
    if (n.id === selectedId) li.className = "selected";
    const time = new Date(n.createdAt).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const day = new Date(n.createdAt).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    const flags = [
      n.summary ? "ringkas ✓" : "",
      n.reviewed ? "reviewed ✓" : "",
    ]
      .filter(Boolean)
      .join(" · ");
    li.innerHTML =
      `<span class="note-time">${esc(day)} ${esc(time)}</span>` +
      esc(n.title || n.raw.slice(0, 60)) +
      (flags ? `<span class="note-flags">${esc(flags)}</span>` : "");
    li.addEventListener("click", () => selectNote(n.id));
    els.noteList.appendChild(li);
  }
  renderWeekStrip();
}

function renderWeekStrip() {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const counts = names.map((name, i) => {
    const dayStart = monday.getTime() + i * 86400000;
    const c = notes.filter(
      (n) => n.createdAt >= dayStart && n.createdAt < dayStart + 86400000
    ).length;
    return `${name} ${c}`;
  });
  els.weekStrip.textContent = counts.join(" · ") + `  —  ${notes.length} note(s) total, on this device only`;
}

// ---------------------------------------------------------------------------
// Editor + summary card
// ---------------------------------------------------------------------------

function setBadge(el, text, kind) {
  if (!text) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.textContent = text;
  el.className = "badge" + (kind === "cloud" ? " badge-cloud" : kind === "hybrid" ? " badge-hybrid" : "");
}

function badgeFor(source) {
  if (source === "on-device") return { text: "On-device · Gemini Nano", kind: "device" };
  if (source === "cloud") return { text: "Cloud · Gemini", kind: "cloud" };
  if (source === "hybrid") return { text: "Hybrid · Firebase AI Logic (prefer on-device)", kind: "hybrid" };
  return { text: "", kind: "device" };
}

function renderSummary() {
  const n = selectedNote();
  els.cloudBox.hidden = true;
  if (!n) {
    els.summaryBody.innerHTML =
      '<p class="muted">Select a note and tap <strong>Ringkas di perangkat</strong>. The clean-up and summary run on this device with Gemini Nano — the raw note never leaves it.</p>';
    setBadge(els.summaryBadge, "");
    els.btnTranslate.disabled = true;
    els.chkReviewed.disabled = true;
    els.chkReviewed.checked = false;
    els.translationBox.hidden = true;
    return;
  }
  if (n.summary) {
    const f = n.fields || {};
    const list = (arr) =>
      arr && arr.length
        ? "<ul>" + arr.map((x) => `<li>${esc(x)}</li>`).join("") + "</ul>"
        : '<span class="muted">—</span>';
    els.summaryBody.innerHTML =
      `<div class="summary-cleaned">${esc(n.cleaned || n.summary)}</div>` +
      `<p>${esc(n.summary)}</p>` +
      `<dl class="summary-fields">` +
      (f.household ? `<dt>Household</dt><dd>${esc(f.household)}</dd>` : "") +
      `<dt>Observations</dt><dd>${list(f.observations)}</dd>` +
      `<dt>Actions taken</dt><dd>${list(f.actions)}</dd>` +
      `<dt>Follow-ups</dt><dd>${list(f.followups)}</dd>` +
      `</dl>`;
    const b = badgeFor(n.summarySource);
    setBadge(els.summaryBadge, b.text, b.kind);
    els.btnTranslate.disabled = false;
    els.chkReviewed.disabled = false;
    els.chkReviewed.checked = !!n.reviewed;
  } else {
    els.summaryBody.innerHTML =
      '<p class="muted">Not summarized yet. Tap <strong>Ringkas di perangkat</strong> — it runs on this device, offline.</p>';
    setBadge(els.summaryBadge, "");
    els.btnTranslate.disabled = true;
    els.chkReviewed.disabled = true;
    els.chkReviewed.checked = false;
  }
  if (n.translation) {
    els.translationBox.hidden = false;
    els.translationText.textContent = n.translation;
    const b = badgeFor(n.translationSource);
    setBadge(els.translationBadge, b.text, b.kind);
  } else {
    els.translationBox.hidden = true;
  }
}

function selectNote(id) {
  selectedId = id;
  const n = selectedNote();
  els.title.value = n ? n.title || "" : "";
  els.text.value = n ? n.raw : "";
  els.btnDelete.hidden = !n;
  renderNoteList();
  renderSummary();
}

function markSaved() {
  const t = new Date().toLocaleTimeString("en-GB");
  els.saveStatus.textContent = `Saved locally at ${t} — stored only in this browser (IndexedDB). Nothing uploaded.`;
  els.storageStatus.textContent = `Storage: IndexedDB (this device only) · ${notes.length} note(s)`;
}

async function persistEditor() {
  const raw = els.text.value.trim();
  if (!raw) return null;
  let n = selectedNote();
  const now = Date.now();
  if (!n) {
    n = {
      id: newId(),
      createdAt: now,
      raw,
      title: els.title.value.trim(),
      cleaned: "",
      summary: "",
      fields: null,
      summarySource: null,
      translation: "",
      translationLang: "",
      translationSource: null,
      reviewed: false,
    };
    notes.unshift(n);
    selectedId = n.id;
  } else {
    if (n.raw !== raw) {
      // Raw text changed: any old summary no longer matches it.
      n.summary = "";
      n.cleaned = "";
      n.fields = null;
      n.summarySource = null;
      n.translation = "";
      n.reviewed = false;
    }
    n.raw = raw;
    n.title = els.title.value.trim();
  }
  n.updatedAt = now;
  await putNote(n);
  markSaved();
  renderNoteList();
  return n;
}

// ---------------------------------------------------------------------------
// D1 — Ringkas (on-device). The privacy path: Nano or nothing.
// ---------------------------------------------------------------------------

function showProgress(show, fraction, label) {
  els.progress.hidden = !show;
  if (show) {
    els.progressFill.style.width = `${Math.round((fraction || 0) * 100)}%`;
    if (label) els.progressText.textContent = label;
  }
}

function applySummaryResult(n, result, source) {
  n.cleaned = result.cleaned;
  n.summary = result.summary;
  n.fields = result.fields;
  n.summarySource = source;
  n.translation = "";
  n.translationSource = null;
  n.reviewed = false;
  n.updatedAt = Date.now();
  return putNote(n).then(() => {
    markSaved();
    renderNoteList();
    renderSummary();
  });
}

async function onRingkas() {
  const n = await persistEditor();
  if (!n) {
    els.summaryBody.innerHTML = '<p class="muted">Write a field note first, then tap Ringkas.</p>';
    return;
  }
  els.cloudBox.hidden = true;
  if (!isPromptApiPresent()) {
    showCloudFallback("The Chrome Prompt API isn't present in this browser.");
    return;
  }
  const status = await getNanoStatus();
  if (status.state === "unavailable" || status.state === "unsupported") {
    showCloudFallback(`Gemini Nano status: ${status.state}.`);
    return;
  }
  els.btnRingkas.disabled = true;
  showProgress(true, 0, "Preparing on-device model (first run may download it)…");
  try {
    const result = await nanoSummarize(n.raw, (fraction) => {
      showProgress(true, fraction, "Downloading on-device model…");
    });
    showProgress(false);
    await applySummaryResult(n, result, "on-device");
    refreshNanoPill();
  } catch (err) {
    showProgress(false);
    showCloudFallback(`On-device summarization failed: ${err.message || err}`);
  } finally {
    els.btnRingkas.disabled = false;
  }
}

function showCloudFallback(reason) {
  els.cloudBox.hidden = false;
  els.cloudFallbackNote.textContent = firebaseReady()
    ? `${reason} Cloud fallback is available (Firebase configured) — it sends this note's text to the cloud model, only if you tap the button.`
    : `${reason} Cloud fallback is not available yet: the Firebase project config is still a placeholder (see js/firebase-config.js), so this note stays on the device, unsummarized.`;
  els.btnRingkasCloud.disabled = !firebaseReady();
}

// D1' — explicit cloud summarize, only via its own button.
async function onRingkasCloud() {
  const n = selectedNote();
  if (!n) return;
  els.btnRingkasCloud.disabled = true;
  els.cloudFallbackNote.textContent = "Summarizing in the cloud…";
  try {
    const res = await cloudSummarize(n.raw);
    if (!res.ok) {
      els.cloudFallbackNote.textContent =
        res.reason === "not-configured"
          ? "Firebase isn't configured yet (placeholder config)."
          : `Cloud summarization failed: ${res.error || res.reason}`;
      return;
    }
    const parsed = parseSummaryJsonLoose(res.text) || {
      cleaned: n.raw,
      summary: res.text,
      fields: { household: "", observations: [], actions: [], followups: [] },
    };
    els.cloudBox.hidden = true;
    await applySummaryResult(n, parsed, "cloud");
  } finally {
    els.btnRingkasCloud.disabled = !firebaseReady();
  }
}

function parseSummaryJsonLoose(text) {
  if (!text) return null;
  let c = String(text).trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const a = c.indexOf("{");
  const b = c.lastIndexOf("}");
  if (a === -1 || b <= a) return null;
  try {
    const o = JSON.parse(c.slice(a, b + 1));
    const arr = (v) => (Array.isArray(v) ? v.map(String).filter(Boolean) : v ? [String(v)] : []);
    return {
      cleaned: String(o.cleaned || ""),
      summary: String(o.summary || ""),
      fields: {
        household: String(o.household || ""),
        observations: arr(o.observations),
        actions: arr(o.actions),
        followups: arr(o.followups),
      },
    };
  } catch (_) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// D2 — Terjemahkan: Nano first, Firebase PREFER_ON_DEVICE as fallback.
// ---------------------------------------------------------------------------

async function onTranslate() {
  const n = selectedNote();
  if (!n || !n.summary) return;
  const target = els.translateLang.value;
  els.btnTranslate.disabled = true;
  try {
    let translated = null;
    let source = null;
    if (isPromptApiPresent()) {
      const status = await getNanoStatus();
      if (status.state === "available" || status.state === "downloadable" || status.state === "downloading") {
        try {
          translated = await nanoTranslate(n.summary, target);
          source = "on-device";
        } catch (_) {
          translated = null; // fall through to the Firebase hybrid path
        }
      }
    }
    if (translated === null) {
      const res = await firebaseTranslate(n.summary, target);
      if (res.ok) {
        translated = res.text;
        source = res.source; // "hybrid"
      }
    }
    if (translated === null) {
      els.translationBox.hidden = false;
      els.translationText.textContent = firebaseReady()
        ? "Translation failed on both paths. Check the connection and try again."
        : "Translation isn't available: Gemini Nano isn't ready on this device and the Firebase config is still a placeholder, so the prefer-on-device fallback can't run yet.";
      setBadge(els.translationBadge, "");
      return;
    }
    n.translation = translated;
    n.translationLang = target;
    n.translationSource = source;
    n.updatedAt = Date.now();
    await putNote(n);
    markSaved();
    renderSummary();
  } finally {
    els.btnTranslate.disabled = !selectedNote()?.summary;
  }
}

// ---------------------------------------------------------------------------
// C1 — Weekly report from reviewed summaries only.
// ---------------------------------------------------------------------------

async function onReport() {
  const since = Date.now() - 7 * 86400000;
  const reviewed = notes.filter(
    (n) => n.summary && n.reviewed && n.createdAt >= since
  );
  els.reportCard.hidden = false;
  setBadge(els.reportBadge, "");
  if (!reviewed.length) {
    els.reportBody.textContent =
      "No reviewed summaries from the last 7 days yet. Summarize a note, check its summary, then tick \"Sudah saya tinjau\" — only reviewed summaries are sent to the cloud report, by design.";
    return;
  }
  if (!firebaseReady()) {
    els.reportBody.textContent =
      "The weekly report is a cloud feature and Firebase isn't configured yet: js/firebase-config.js still holds placeholder values. Once Yan's Firebase web config is filled in, this button generates the report from the " +
      reviewed.length +
      " reviewed summar" +
      (reviewed.length === 1 ? "y" : "ies") +
      " waiting. Nothing has been sent anywhere.";
    return;
  }
  els.btnReport.disabled = true;
  els.reportBody.textContent = "Generating weekly report in the cloud…";
  try {
    const res = await cloudWeeklyReport(reviewed);
    if (!res.ok) {
      els.reportBody.textContent =
        res.reason === "not-configured"
          ? "Firebase isn't configured yet (placeholder config)."
          : `Weekly report failed: ${res.error || res.reason}. (If App Check rejects the call, register the debug token from the browser console in Firebase console → App Check → Manage debug tokens.)`;
      return;
    }
    await putLatestReport({
      text: res.text,
      createdAt: Date.now(),
      noteCount: reviewed.length,
    });
    els.reportBody.textContent = res.text;
    setBadge(els.reportBadge, "Cloud · Gemini", "cloud");
  } finally {
    els.btnReport.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Misc actions
// ---------------------------------------------------------------------------

async function onSamples() {
  const existing = new Set(notes.map((n) => n.title + "|" + n.createdAt));
  let added = 0;
  for (const s of sampleNotes()) {
    if (existing.has(s.title + "|" + s.createdAt)) continue;
    const n = {
      id: newId(),
      createdAt: s.createdAt,
      updatedAt: s.createdAt,
      title: s.title,
      raw: s.raw,
      cleaned: "",
      summary: "",
      fields: null,
      summarySource: null,
      translation: "",
      translationLang: "",
      translationSource: null,
      reviewed: false,
    };
    await putNote(n);
    notes.push(n);
    added++;
  }
  notes.sort((a, b) => b.createdAt - a.createdAt);
  markSaved();
  renderNoteList();
  if (added && !selectedId) selectNote(notes[0].id);
}

async function onDelete() {
  const n = selectedNote();
  if (!n) return;
  await deleteNote(n.id);
  notes = notes.filter((x) => x.id !== n.id);
  selectedId = null;
  els.title.value = "";
  els.text.value = "";
  els.btnDelete.hidden = true;
  markSaved();
  renderNoteList();
  renderSummary();
}

// ---------------------------------------------------------------------------
// Wire-up + init
// ---------------------------------------------------------------------------

els.btnNew.addEventListener("click", () => {
  selectedId = null;
  els.title.value = "";
  els.text.value = "";
  els.btnDelete.hidden = true;
  renderNoteList();
  renderSummary();
  els.text.focus();
});
els.btnSave.addEventListener("click", async () => {
  const n = await persistEditor();
  if (n) {
    renderSummary();
    els.btnDelete.hidden = false;
  }
});
els.btnRingkas.addEventListener("click", onRingkas);
els.btnRingkasCloud.addEventListener("click", onRingkasCloud);
els.btnTranslate.addEventListener("click", onTranslate);
els.btnReport.addEventListener("click", onReport);
els.btnSamples.addEventListener("click", onSamples);
els.btnDelete.addEventListener("click", onDelete);
els.chkReviewed.addEventListener("change", async () => {
  const n = selectedNote();
  if (!n) return;
  n.reviewed = els.chkReviewed.checked;
  n.updatedAt = Date.now();
  await putNote(n);
  markSaved();
  renderNoteList();
});

(async function init() {
  refreshNetPill();
  refreshNanoPill();
  try {
    notes = await getAllNotes();
  } catch (err) {
    els.saveStatus.textContent = `IndexedDB unavailable: ${err.message || err}`;
  }
  renderNoteList();
  renderSummary();
  markSaved();
  const report = await getLatestReport().catch(() => null);
  if (report && report.text) {
    els.reportCard.hidden = false;
    els.reportBody.textContent = report.text;
    setBadge(els.reportBadge, "Cloud · Gemini", "cloud");
  }
  if (!firebaseReady()) {
    console.info(
      "[CatatLapang] Firebase config is still placeholder (js/firebase-config.js). Local features + on-device Prompt API work; cloud features are disabled until Yan's config is filled in."
    );
  }
})();
