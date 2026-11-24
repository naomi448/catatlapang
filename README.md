# CatatLapang

**Field notes that stay on your device.**

CatatLapang is an offline-first field-notes assistant for Indonesian community
health workers (*kader*/posyandu volunteers) and smallholder-farm extension
workers. A worker types rough notes right after a home visit — messy
Indonesian shorthand is fine — and CatatLapang:

1. **Cleans up and summarizes the note on-device** with Gemini Nano
   (Chrome Prompt API) — instantly, with no signal, and the raw note never
   leaves the device.
2. **Translates the summary on-device** (Indonesian ↔ English) for reports.
3. **Generates a structured weekly report in the cloud** (Gemini via
   Firebase AI Logic) when the worker is back online — built **only** from
   summaries the worker has already reviewed, and flags households that
   need follow-up.

The hybrid split is the product: sensitive raw notes are processed where
they are safest (on the device), and the cloud is used only for the one job
that genuinely needs it, on data the worker has already approved. Every AI
result carries a badge showing where it actually ran — *On-device · Gemini
Nano* or *Cloud · Gemini*.

Built for **#BuildHybridAI 2026** (Firebase AI Logic hackathon), Web/Chrome
platform. All AI inference goes through Firebase AI Logic / the Chrome
Prompt API; there is no backend of ours, no accounts, and no database —
notes live only in the browser's IndexedDB.

## Run it locally

No build step. You just need any static file server (ES modules require
http(s), not `file://`):

```bash
cd buildhybridai
python3 -m http.server 8080
# then open http://localhost:8080 in Chrome (desktop, version 139+)
```

or `npx serve .` — same idea.

### What works with zero setup

- Note editor, note list, IndexedDB storage (offline-first), sample notes.
- **On-device summarize + translate**, if your Chrome supports Gemini Nano
  (see below). The header pill shows Nano's real availability state.

### On-device requirements (Gemini Nano in Chrome)

- Chrome desktop **≥ 139** on a machine that supports built-in AI.
- Enable the Prompt API flag if prompted by the docs:
  `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`
  (and relaunch Chrome). The first *Ringkas* tap may trigger a model
  download (a few GB) — the app shows its progress.

If Nano is unavailable, the app says so honestly: summarization of raw
notes refuses to fall back to the cloud silently. Translation and the
weekly report can still work through Firebase once configured.

## Firebase setup (needed for cloud features)

Cloud features (weekly report, translation fallback, the explicit
"summarize in cloud" option) need a Firebase project:

1. Create a project at <https://console.firebase.google.com> (free Spark
   tier, **no billing**), enable **AI Logic** with the **Gemini Developer
   API** provider, and register a **Web app**.
2. Copy the web app config object into **`js/firebase-config.js`**
   (replace every `GANTI_DENGAN_CONFIG_YAN` value). Those values are app
   identifiers, not secrets.
3. **App Check** (required by AI Logic):
   - Register the web app in Firebase console → App Check with the
     **Fraud Defense (reCAPTCHA Enterprise)** provider, and put the site
     key in `js/firebase-config.js`. (This project uses Fraud Defense;
     the classic reCAPTCHA provider is deprecated by Google.)
   - For local development the app enables the App Check **debug
     provider**: open the browser console, copy the debug token the SDK
     prints, and register it in Firebase console → App Check → Apps →
     Manage debug tokens. **Never commit a debug token to this repo.**

Until the config is filled in, the app runs fully in local mode and the
cloud buttons explain why they are inactive.

## Project layout

```
index.html            the single page (UI language: English)
css/styles.css        styling
js/app.js             UI wiring, feature flows, badges
js/db.js              IndexedDB wrapper (notes + latest report)
js/nano.js            Chrome Prompt API: availability, summarize, translate
js/firebase-ai.js     Firebase AI Logic: App Check init, cloud report,
                      cloud summarize (explicit), translate fallback
js/firebase-config.js >>> THE file to fill in with your Firebase config <<<
js/samples.js         fictional Indonesian sample notes for instant testing
```

## Privacy model

- Raw notes are processed **only** on-device (`ONLY_ON_DEVICE` path) and
  stored **only** in this browser's IndexedDB. There is no server of ours.
- The cloud sees **only worker-reviewed summaries**, and only when the
  worker taps *Buat laporan mingguan*.
- The one exception is a deliberate, clearly-labelled button: if
  on-device summarization is unavailable, the worker may *choose* to
  summarize that one note in the cloud. It never happens silently.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
