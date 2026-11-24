// firebase-ai.js — Firebase AI Logic integration (cloud + hybrid paths).
//
// All inference in CatatLapang goes through Firebase AI Logic, as the
// #BuildHybridAI rules require. The on-device features primarily use the
// Chrome Prompt API directly (see nano.js) so the privacy path works even
// before a Firebase project exists; this module provides:
//
//   C1  Laporan Mingguan — weekly report, cloud ONLY (InferenceMode
//       .ONLY_IN_CLOUD), built ONLY from worker-reviewed summaries.
//   D2' Translation fallback via Firebase with PREFER_ON_DEVICE, used
//       only when the direct Prompt API path is unavailable.
//   D1' Explicit, user-chosen cloud summarize — offered by the UI as a
//       separate button when on-device summarization is unavailable.
//       It is NEVER used silently: the privacy path is on-device or
//       nothing, unless the worker taps that button themselves.
//
// App Check: AI Logic enforces App Check. On localhost only, we use
// the DEBUG provider: setting self.FIREBASE_APPCHECK_DEBUG_TOKEN = true
// before initializeAppCheck makes the SDK print a debug token in the
// browser console; that token is registered in Firebase console ->
// App Check -> Apps -> Manage debug tokens. The token value itself is
// never stored in this repo. On any other host (e.g. the public GitHub
// Pages deployment) the flag stays OFF so real visitors get genuine
// reCAPTCHA Enterprise attestation — forcing the debug provider there
// would make every visitor's cloud call fail with an unregistered
// token. (Localhost-only gating fixed 2026-11-24.)
//
// Until js/firebase-config.js is filled in with Yan's project config,
// initFirebase() returns null and every function here reports
// { ok: false, reason: "not-configured" } so the UI can say so honestly.

import { initializeApp } from "firebase/app";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
} from "firebase/ai";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import {
  firebaseConfig,
  appCheckSiteKey,
  isFirebaseConfigured,
  isAppCheckSiteKeyConfigured,
} from "./firebase-config.js";

// Free-tier text model for the cloud paths. NOTE (fixed 2026-11-24): in
// firebase-ai 12.5.0, whenever a hybrid `mode` is passed, the SDK ignores
// the top-level model and uses params.inCloudParams, defaulting to
// "gemini-2.0-flash-lite" — a model Google has since retired (the weekly
// report failed with 404 "model is no longer available", whose message
// names gemini-3.5-flash-lite as the replacement). model() below therefore
// always passes inCloudParams explicitly.
const CLOUD_MODEL = "gemini-3.5-flash-lite";

let cached = null; // { app, ai } after first successful init

export function firebaseReady() {
  return isFirebaseConfigured();
}

export function initFirebase() {
  if (!isFirebaseConfigured()) return null;
  if (cached) return cached;

  const app = initializeApp(firebaseConfig);

  // --- App Check -----------------------------------------------------------
  // Debug provider ONLY on localhost (see header note). Must be set
  // BEFORE initializeAppCheck runs.
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  try {
    if (isAppCheckSiteKeyConfigured()) {
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } else {
      // Debug-token flow still needs a provider instance in the web SDK;
      // without a site key we skip initialization and log clear guidance.
      // AI Logic calls will be rejected by App Check until this is set up —
      // see README "App Check" section.
      console.info(
        "[CatatLapang] App Check not initialized: appCheckSiteKey is still " +
          "a placeholder in js/firebase-config.js. With the debug token " +
          "flag on, the SDK prints a debug token to register in the " +
          "Firebase console once a site key is provided."
      );
    }
  } catch (err) {
    console.warn("[CatatLapang] App Check initialization failed:", err);
  }

  const ai = getAI(app, { backend: new GoogleAIBackend() });
  cached = { app, ai };
  return cached;
}

function model(mode) {
  const ctx = initFirebase();
  if (!ctx) return null;
  const options = { model: CLOUD_MODEL };
  if (mode && typeof InferenceMode !== "undefined") {
    options.mode = mode;
    // Required: with a mode set, the SDK takes the cloud model from
    // inCloudParams (see the CLOUD_MODEL note above).
    options.inCloudParams = { model: CLOUD_MODEL };
  }
  return getGenerativeModel(ctx.ai, options);
}

async function generate(mode, prompt) {
  const m = model(mode);
  if (!m) return { ok: false, reason: "not-configured" };
  try {
    const result = await m.generateContent(prompt);
    return { ok: true, text: result.response.text() };
  } catch (err) {
    return { ok: false, reason: "error", error: String(err && err.message ? err.message : err) };
  }
}

// ---------------------------------------------------------------------------
// C1 — Weekly report. Input: ONLY summaries the worker marked reviewed.
// ---------------------------------------------------------------------------

const WEEKLY_REPORT_PROMPT = (summariesBlock) => `You are preparing the weekly report for an Indonesian community field worker (community health / farm extension). Below are this week's visit summaries. Every summary has already been reviewed by the worker.

Write a structured weekly report in English with exactly these sections:
1. "Visits by day" — count and one line per day.
2. "Key observations" — the most important patterns across the week.
3. "Supplies & issues" — anything about supplies, logistics or problems mentioned, or "None reported".
4. "Follow-up list" — households/people who need a follow-up visit, each with the reason. This is the most important section; be specific and never invent households that are not in the summaries.

Summaries:
${summariesBlock}`;

export async function cloudWeeklyReport(reviewedNotes) {
  const block = reviewedNotes
    .map((n) => {
      const day = new Date(n.createdAt).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      const f = n.fields || {};
      const follow = (f.followups || []).join("; ");
      return `- [${day}] ${n.title || f.household || "Visit"}\n  Summary: ${n.summary}${follow ? `\n  Follow-ups noted: ${follow}` : ""}`;
    })
    .join("\n");
  const res = await generate(
    typeof InferenceMode !== "undefined" ? InferenceMode.ONLY_IN_CLOUD : undefined,
    WEEKLY_REPORT_PROMPT(block)
  );
  if (!res.ok) return res;
  return { ok: true, text: res.text, source: "cloud" };
}

// ---------------------------------------------------------------------------
// D1' — Explicit cloud summarize (only when the worker chooses it).
// ---------------------------------------------------------------------------

export async function cloudSummarize(rawText) {
  const prompt = `Clean up and summarize this Indonesian field note. Reply with ONLY a JSON object (no markdown fences) with keys: "cleaned" (tidy rewrite, same language as the note), "summary" (2-3 sentences, same language), "household" (string, may be ""), "observations" (array of strings), "actions" (array of strings), "followups" (array of strings).

Field note:
"""
${rawText}
"""`;
  const res = await generate(
    typeof InferenceMode !== "undefined" ? InferenceMode.ONLY_IN_CLOUD : undefined,
    prompt
  );
  if (!res.ok) return res;
  return { ok: true, text: res.text, source: "cloud" };
}

// ---------------------------------------------------------------------------
// D2' — Translation fallback via Firebase AI Logic, PREFER_ON_DEVICE.
// The result's badge is labelled "hybrid" on purpose: the JS SDK response
// does not reliably report which side actually ran, so the UI must not
// claim certainty it doesn't have.
// ---------------------------------------------------------------------------

export async function firebaseTranslate(text, targetLanguage) {
  const res = await generate(
    typeof InferenceMode !== "undefined" ? InferenceMode.PREFER_ON_DEVICE : undefined,
    `Translate the following text into ${targetLanguage}. Reply with ONLY the translation.\n\n${text}`
  );
  if (!res.ok) return res;
  return { ok: true, text: res.text, source: "hybrid" };
}
