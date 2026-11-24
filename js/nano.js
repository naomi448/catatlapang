// nano.js — On-device inference through the Chrome Prompt API
// (window.LanguageModel -> Gemini Nano), used directly for the two
// privacy-sensitive, offline-first features:
//
//   D1 Ringkas      — clean-up + summary + structured fields (single turn)
//   D2 Terjemahkan  — translate a finished summary (single turn)
//
// The Prompt API supports single-turn text generation only, and every
// call here is designed as a single turn. Sessions are created lazily
// from a user gesture (button click), as the platform requires, and
// destroyed after use.
//
// This module never sends anything anywhere: prompts run inside the
// browser on the user's own device.

const SYSTEM_INSTRUCTION =
  "You are an assistant inside CatatLapang, a field-notes app for Indonesian " +
  "community health workers and farm extension workers. Be accurate, concise, " +
  "and never invent facts that are not in the note.";

function languageModel() {
  // Chrome exposes the Prompt API as window.LanguageModel in recent versions.
  return typeof self !== "undefined" ? self.LanguageModel : undefined;
}

export function isPromptApiPresent() {
  return typeof languageModel()?.availability === "function";
}

// Returns one of:
//   { state: "available" | "downloadable" | "downloading" | "unavailable" | "unsupported",
//     label: string }
export async function getNanoStatus() {
  const lm = languageModel();
  if (!lm || typeof lm.availability !== "function") {
    return {
      state: "unsupported",
      label: "On-device: not supported in this browser",
    };
  }
  try {
    const status = await lm.availability();
    const labels = {
      available: "On-device: Ready ● Gemini Nano",
      downloadable: "On-device: Nano downloadable (tap Ringkas to fetch it)",
      downloading: "On-device: Nano downloading…",
      unavailable: "On-device: unavailable on this device",
    };
    return { state: status, label: labels[status] || `On-device: ${status}` };
  } catch (err) {
    return { state: "unavailable", label: "On-device: status check failed" };
  }
}

// Create a session, reporting model-download progress (0..1) via onProgress.
// Must be called from a user-gesture handler.
async function createSession(onProgress) {
  const lm = languageModel();
  if (!lm) throw new Error("Prompt API not present in this browser.");
  const options = {
    initialPrompts: [{ role: "system", content: SYSTEM_INSTRUCTION }],
  };
  if (typeof onProgress === "function") {
    options.monitor = (monitor) => {
      monitor.addEventListener("downloadprogress", (e) => {
        if (typeof e.loaded === "number") onProgress(e.loaded);
      });
    };
  }
  return lm.create(options);
}

async function promptOnce(promptText, onProgress) {
  const session = await createSession(onProgress);
  try {
    return await session.prompt(promptText);
  } finally {
    try {
      session.destroy();
    } catch (_) {
      /* already gone */
    }
  }
}

// ---------------------------------------------------------------------------
// D1 — Ringkas: rough note -> cleaned note + summary + structured fields.
// Asks Nano for JSON; parses defensively. If the JSON is malformed, falls
// back to treating the whole reply as the summary so the worker still gets
// something usable.
// ---------------------------------------------------------------------------

const SUMMARIZE_PROMPT = (raw) => `Clean up and summarize this Indonesian field note.

Reply with ONLY a JSON object (no markdown fences, no commentary) with exactly these keys:
- "cleaned": the note rewritten as tidy, complete sentences (same language as the note)
- "summary": a 2-3 sentence summary (same language as the note)
- "household": the household/person/family this note is about, or "" if none
- "observations": array of short strings — what was observed
- "actions": array of short strings — what was done during the visit
- "followups": array of short strings — what needs a follow-up visit, or [] if none

Field note:
"""
${raw}
"""`;

function parseSummaryJson(text) {
  if (!text) return null;
  let candidate = text.trim();
  // Strip markdown code fences if the model added them anyway.
  candidate = candidate.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(candidate.slice(start, end + 1));
    const asArray = (v) =>
      Array.isArray(v) ? v.map(String).filter(Boolean) : v ? [String(v)] : [];
    return {
      cleaned: String(obj.cleaned || ""),
      summary: String(obj.summary || ""),
      fields: {
        household: String(obj.household || ""),
        observations: asArray(obj.observations),
        actions: asArray(obj.actions),
        followups: asArray(obj.followups),
      },
    };
  } catch (_) {
    return null;
  }
}

export async function nanoSummarize(rawText, onProgress) {
  const reply = await promptOnce(SUMMARIZE_PROMPT(rawText), onProgress);
  const parsed = parseSummaryJson(reply);
  if (parsed && (parsed.summary || parsed.cleaned)) return parsed;
  // Defensive fallback: use the raw reply as the summary.
  return {
    cleaned: rawText.trim(),
    summary: String(reply || "").trim(),
    fields: { household: "", observations: [], actions: [], followups: [] },
  };
}

// ---------------------------------------------------------------------------
// D2 — Terjemahkan: translate an already-finished (worker-reviewed) summary.
// ---------------------------------------------------------------------------

export async function nanoTranslate(text, targetLanguage, onProgress) {
  const reply = await promptOnce(
    `Translate the following text into ${targetLanguage}. Reply with ONLY the translation — no commentary, no quotation marks.\n\n${text}`,
    onProgress
  );
  return String(reply || "").trim();
}
