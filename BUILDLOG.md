# BUILDLOG — CatatLapang

## 2026-11-24 — Kerangka (scaffold) dibangun di VM

Dibangun sesuai `design-catatlapang.md` terkunci. Ini bagian yang TIDAK
tergantung lingkungan Yan: seluruh aplikasi statis, fitur lokal, jalur
on-device Prompt API, dan kode Firebase AI Logic dengan config placeholder.

### Sudah jadi dan berfungsi (lokal, tanpa config apa pun)

- **SPA satu halaman** (vanilla JS + ES modules, tanpa build step):
  header dengan pill kesiapan on-device + pill online/offline, daftar
  catatan, editor, kartu ringkasan + badge, strip minggu, kartu laporan.
- **Catatan lapangan**: buat/edit/simpan/hapus, judul opsional; mengedit
  teks mentah mengosongkan ringkasan lama (tidak lagi cocok).
- **IndexedDB offline-first** (`js/db.js`): store `notes` + `reports`,
  promise wrapper tanpa dependensi. Status simpan lokal ditampilkan di UI
  ("Saved locally at … — stored only in this browser").
- **Status sinkron**: karena by design tidak ada backend, status yang
  ditampilkan = status simpan lokal + status koneksi browser
  (online/offline, diperbarui lewat event `online`/`offline`).
- **D3 pill kesiapan**: `LanguageModel.availability()` dibaca saat muat;
  pill menampilkan available / downloadable / downloading / unavailable /
  unsupported apa adanya.
- **D1 Ringkas (on-device)**: `js/nano.js` memanggil Chrome Prompt API
  (`LanguageModel.create` + `prompt`, single-turn) dengan prompt JSON
  terstruktur → cleaned + summary + fields (household, observations,
  actions, followups). Parsing JSON defensif (strip fences, fallback
  ringkasan teks mentah). Download model dilaporkan lewat
  `downloadprogress` ke progress bar. Sesi dibuat dari klik tombol
  (user gesture) dan di-destroy setelah dipakai.
- **Privasi D1 ditegakkan di UI**: bila Nano unavailable/unsupported,
  catatan mentah TIDAK dikirim ke mana pun; muncul kotak pemberitahuan
  dengan tombol terpisah "Summarize in cloud instead" (D1') yang hanya
  aktif bila Firebase sudah terkonfigurasi.
- **D2 Terjemahkan**: Nano dulu; bila jalur Prompt API gagal/tidak
  tersedia, fallback `firebaseTranslate` (PREFER_ON_DEVICE). Hasil +
  badge disimpan per catatan.
- **D4 badge inferensi**: setiap hasil AI ditempeli badge sumbernya —
  "On-device · Gemini Nano" (jalur Prompt API langsung, pasti),
  "Cloud · Gemini" (ONLY_IN_CLOUD), atau "Hybrid · Firebase AI Logic
  (prefer on-device)" untuk jalur PREFER_ON_DEVICE lewat SDK.
- **Review gate untuk laporan**: checkbox "Sudah saya tinjau" per
  ringkasan; laporan mingguan hanya mengambil ringkasan 7 hari terakhir
  yang bertanda reviewed.
- **Contoh data**: 5 catatan fiktif berbahasa Indonesia (posyandu,
  padi/pupuk, imunisasi, kontrol hamil, cabai) dengan tanggal relatif
  terhadap hari ini, dimuat lewat tombol "Load sample notes (fictional)".
- **LICENSE** Apache-2.0 + **README** dengan instruksi menjalankan lokal,
  setup Firebase, dan App Check.

### Placeholder — menunggu Yan

| # | Yang menunggu | Di mana |
|---|---|---|
| 1 | **Web app config Firebase** proyek milik Yan (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId) | `js/firebase-config.js` — semua nilai masih `GANTI_DENGAN_CONFIG_YAN`; `isFirebaseConfigured()` mendeteksinya dan UI menandai fitur cloud nonaktif secara jujur |
| 2 | **Site key reCAPTCHA v3 App Check** | `js/firebase-config.js` (`appCheckSiteKey`); App Check di-init dengan debug provider (`self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` sebelum `initializeAppCheck`) di `js/firebase-ai.js` — token debug dari console browser harus didaftarkan Yan di Firebase console; tanpa site key, inisialisasi App Check dilewati dengan log penjelasan |
| 3 | **Hasil tes Nano (gerbang 24 Nov)** di laptop Yan | Menentukan apakah jalur on-device benar-benar jalan di perangkat Yan; kode sudah menangani semua status availability |
| 4 | Nama model cloud | `CLOUD_MODEL = "gemini-2.5-flash"` di `js/firebase-ai.js` — sesuaikan bila console menawarkan nama model gratis lain |

### Kode Firebase AI Logic (sudah ditulis, belum bisa diuji end-to-end)

- `js/firebase-ai.js`: `initializeApp` + `getAI(app, { backend: new GoogleAIBackend() })` + `getGenerativeModel(ai, { model, mode })` dengan `InferenceMode.ONLY_IN_CLOUD` (laporan + ringkas cloud) dan `InferenceMode.PREFER_ON_DEVICE` (fallback terjemahan). SDK dimuat via importmap, pinned **12.5.0** (lantai kompetisi ≥ 12.5.0; URL CDN terverifikasi HTTP 200 dari VM).
- C1 Laporan Mingguan: prompt terstruktur (visits by day, key observations,
  supplies & issues, follow-up list) dari ringkasan reviewed saja; laporan
  terakhir disimpan di IndexedDB dan direstorasi saat muat.

### Belum dikerjakan (sengaja, sesuai rencana)

- Hosting (Firebase Hosting) + repo publik GitHub + teks Devpost — tahap
  berikutnya dalam `plan-23-30nov.md` (freeze 28 Nov, submit 30 Nov).
- Uji nyata di Chrome laptop Yan (gate Nano) — bukan bagian scaffold ini.

### Catatan kejujuran teknis

- Respons `generateContent` Firebase AI Logic JS SDK tidak secara andal
  melaporkan sisi mana (device/cloud) yang benar-benar menjalankan
  inferensi PREFER_ON_DEVICE; karena itu badge jalur tersebut ditulis
  "Hybrid · Firebase AI Logic (prefer on-device)", bukan klaim pasti.
  Badge "On-device · Gemini Nano" hanya dipakai untuk jalur Prompt API
  langsung yang memang pasti di perangkat.
- Pemeriksaan sintaks semua file JS lolos `node --check` (sebagai ESM);
  aplikasi dilayani statis dan halaman + modul terverifikasi termuat dari
  server lokal (lihat log eksekusi sesi pembangunan).

## 2026-11-24 — Nano gate: FAIL (entry cancelled)
- Gate run on Yan's laptop (Chrome 158.0.8127.89): flag #prompt-api-for-gemini-nano-multimodal-input Enabled; availability() went downloadable -> downloading but never 'available'.
- Model download initially stalled (0 traffic); Cloudflare WARP unblocked component traffic; create() monitor reported 0%->100%, yet availability() stayed 'downloading' and prompt() hung.
- chrome://on-device-internals: "Device performance class: Very Low"; Load Default -> "Unable to get default model path." Component nano_v3_gpu_component stuck at version 0.0.0.0 ("Up-to-date").
- Disk checked: C: 75.3 GB free of 299 GB — not a space problem.
- Bypass flag #optimization-guide-on-device-model no longer exists in Chrome 158 — the perf-requirement bypass is gone.
- Conclusion: Chrome does not serve Gemini Nano to this device class. Gate FAIL per the locked criteria -> BuildHybridAI entry cancelled 2026-11-24. Skeleton + prep pack kept on disk; revival only if a Nano-capable machine appears before the 1 Dec 05:00 WIB deadline.

## 2026-11-24 — Nano gate: PASS (cancellation withdrawn)
- Correction to the FAIL section above: the blocker was never the device class. The Manifest Criteria table on chrome://on-device-internals showed every hardware criterion true (VRAM 7,846 MiB vs 3,000 required; Device Capable true; disk true) and exactly one red row: "Enabled by user setting: false". Yan enabled that setting; the model then downloaded normally.
- Evidence (Yan's console screenshot, 2026-11-24 ~09:10 WIB): download progress reached 100%; `await LanguageModel.availability()` returned 'available'; the one-line prompt test returned a real on-device summary: "Balita yang dikunjungi ibu Sari dalam kondisi berat badan ideal (9,2 kg), imunisasi lengkap, dan disarankan tindak lanjut pada bulan depan." Inference returned within seconds.
- Verdict: gate PASS per the locked criteria (availability 'available' AND a live prompt returns a real summary). The BuildHybridAI entry cancellation is WITHDRAWN; the CatatLapang build is back on. Feature freeze 28 Nov; submission deadline 1 Dec 05:00 WIB.
- Next step: Yan creates the Firebase project (his Google account, free tier, no billing) and hands over the web config; Muse wires it into js/firebase-config.js, then integration test + App Check debug token.

## Firebase config wired (2026-11-24 ~09:33 WIB)
- Yan created the Firebase project "catatlapang" (Spark plan, Analytics off) and registered the Web app "CatatLapang" himself in the console; he pasted the firebaseConfig in chat (web config is public-by-design).
- Config written into js/firebase-config.js (projectId catatlapang; appId 1:1028199975147:web:e6e08c21fbd04ef1c116ae). appCheckSiteKey still placeholder by design.
- Verified: node --check passes all 6 JS modules; local static server returns HTTP 200 for index + all assets; config values consistent (messagingSenderId matches appId prefix).
- Remaining for the cloud path: App Check setup — Yan registers the web app in App Check with a reCAPTCHA v3 site key (console), then runs the app once on his laptop so the SDK prints the debug token, which he registers under App Check -> Manage debug tokens. Only after that do AI Logic cloud calls (weekly report / fallbacks) succeed end-to-end.

## App Check: Fraud Defense registered + code switched to Enterprise provider (2026-11-24 ~09:58–10:00 WIB)
- Classic reCAPTCHA provider path abandoned: the secret key could not be copied/pasted on Yan's laptop, and the console itself banners Classic as deprecated. Yan registered the app with **Fraud Defense (reCAPTCHA Enterprise)** instead — site key only, typed directly into the console form; console shows "Fraud Defense — Registered".
- Yan created the underlying score-based (v3) key in the reCAPTCHA admin under the catatlapang GCP project, domain localhost (an initial "locashost" typo was caught from his screenshot and fixed before submit).
- Site key (public) sent by Yan in chat and written to js/firebase-config.js as appCheckSiteKey. firebase-ai.js switched ReCaptchaV3Provider -> ReCaptchaEnterpriseProvider; node --check passes; importmap already maps firebase/app-check.
- Laptop pack built: laptop-pack/catatlapang-app.zip (~24 KB: app + serve.mjs pure-Node server on port 8080 + PANDUAN.txt incl. the debug-token registration steps). Upload link given to Yan (expires 2026-11-26 10:00 WIB).
- Remaining: Yan runs the app on his laptop (localhost:8080), first cloud tap prints the App Check debug token in Chrome console; Yan registers it (App Check -> CatatLapang -> Manage debug tokens); then Weekly Report cloud path can be verified end-to-end.

## On-device summarize verified in the real app on Yan's laptop (2026-11-24 ~10:19 WIB)
- Yan ran the laptop pack (localhost:8080): app loads, header badge "On-device: Ready - Gemini Nano", sample notes loaded (5 fictional notes, IndexedDB local save confirmed).
- Summarize on-device on the "Pak Darto - padi & pupuk" sample produced the structured summary (Household / Observations / Actions taken / Follow-ups), faithful to the raw note. On-device path PROVEN end-to-end in the app, not just the console probe.
- Remaining: reviewed checkbox -> weekly report cloud tap -> App Check debug token printed in console -> Yan registers token -> second tap verifies the cloud path.

## Cloud model fix (2026-11-24 ~10:52 WIB) — SDK default retired model
- After Yan enabled the Gemini Developer API (wizard step 1 "APIs enabled"), the weekly-report call passed App Check (403 gone) but failed 404: the request went to models/gemini-2.0-flash-lite, "no longer available" (server message recommends gemini-3.5-flash-lite).
- Root cause found in the firebase-ai 12.5.0 bundle itself: when a hybrid `mode` is passed, getGenerativeModel uses params.inCloudParams || { model: "gemini-2.0-flash-lite" } and ignores the top-level model. Our model() passed only the top-level model (gemini-2.5-flash).
- Fix in js/firebase-ai.js: CLOUD_MODEL = "gemini-3.5-flash-lite" and model() now always passes inCloudParams: { model: CLOUD_MODEL } when a mode is set. node --check OK. Laptop pack rebuilt with the fixed file.

## FULL HYBRID LOOP PROVEN (2026-11-24 ~10:54 WIB)
- Yan replaced the pack with the fixed build, hard-reloaded, tapped Buat laporan mingguan: SUCCESS. Weekly report rendered with the "Cloud - Gemini" badge, built only from the 1 reviewed summary (Pak Darto), with all 4 designed sections (Visits by day / Key observations / Supplies & issues / Follow-up list).
- End-to-end proof complete: Gemini Nano on-device summarize (Prompt API) + Firebase AI Logic cloud report (ONLY_IN_CLOUD, gemini-3.5-flash-lite via inCloudParams) with App Check enforced (Fraud Defense provider + registered debug token) on the Spark plan, $0.
- Remaining for the entry: public GitHub repo, hosted URL, demo video (<=3 min, public YouTube), Devpost submission by 1 Dec 05:00 WIB; feature freeze 28 Nov.

## Public repo published (2026-11-24 ~11:02 WIB)
- Yan created the empty public repo naomi448/catatlapang himself (on his laptop) and added it to the fine-grained token scope. Published via the GitHub API (Contents bootstrap + Git Data tree): 11 files (app + README + LICENSE Apache-2.0 + BUILDLOG). Bootstrap commit 9564b37, publish commit 0b91828; recursive tree verified MATCH against the local source.
- Secret scan before publish: only the public-by-design Firebase web config + App Check site key; no secrets.
- GitHub Pages enablement via API failed (403, token lacks Pages permission) — Yan must flip it in repo Settings > Pages (branch main, / root). Hosted URL will be https://naomi448.github.io/catatlapang/ — for cloud features to work there, the reCAPTCHA Enterprise key also needs the naomi448.github.io domain added.

## Hosted URL live (2026-11-24 ~11:05 WIB)
- Yan enabled GitHub Pages himself (Settings > Pages: Deploy from a branch, main / root). Verified from the VM: https://naomi448.github.io/catatlapang/ returns HTTP 200 with the app title; js/css assets serve 200.
- Remaining nicety: add domain naomi448.github.io to the reCAPTCHA Enterprise key so App Check attestation (and thus cloud features) also works on the public URL; on-device features work there regardless.

## App Check debug provider gated to localhost (2026-11-24 ~11:10 WIB)
- Found while preparing the public-URL check: js/firebase-ai.js set self.FIREBASE_APPCHECK_DEBUG_TOKEN = true unconditionally, which forces the debug provider for EVERY visitor — on the public GitHub Pages URL every cloud call would 403 with an unregistered debug token. Fixed: the flag is now set only when location.hostname is localhost/127.0.0.1; public visitors get real reCAPTCHA Enterprise attestation (the key's domain list now includes naomi448.github.io, added by Yan in bare-domain form after a first attempt with an https:// prefix was corrected). Yan's laptop flow is unchanged.
