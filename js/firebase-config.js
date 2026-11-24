// ============================================================================
// firebase-config.js — SATU-SATUNYA file yang perlu diisi Yan.
//
// Ganti semua nilai "GANTI_DENGAN_CONFIG_YAN" dengan web app config dari
// Firebase console proyek milik Yan:
//   Firebase console -> Project settings -> General -> Your apps -> Web app
//   -> "Firebase SDK snippet" / firebaseConfig object.
//
// Nilai-nilai ini (apiKey, projectId, appId, ...) adalah IDENTITAS aplikasi,
// bukan kredensial rahasia — aman berada di kode klien. Yang TIDAK BOLEH
// pernah masuk repo: App Check debug token terdaftar, file .env, dan kunci
// privat apa pun.
//
// Sampai file ini diisi, aplikasi tetap jalan penuh secara lokal:
// catatan + IndexedDB + ringkasan/terjemahan on-device lewat Chrome
// Prompt API. Hanya aksi cloud (laporan mingguan, fallback cloud) yang
// nonaktif dan ditandai jelas di UI.
// ============================================================================

export const firebaseConfig = {
  apiKey: "AIzaSyDCmVw9mp1vYjBZNR38ggqUTOftL7npKdI",
  authDomain: "catatlapang.firebaseapp.com",
  projectId: "catatlapang",
  storageBucket: "catatlapang.firebasestorage.app",
  messagingSenderId: "1028199975147",
  appId: "1:1028199975147:web:e6e08c21fbd04ef1c116ae",
};

// Site key reCAPTCHA untuk App Check provider Fraud Defense
// (reCAPTCHA Enterprise) — terdaftar di Firebase console -> App Check
// pada 2026-11-24. Site key adalah nilai publik (memang untuk klien).
// Untuk pengembangan lokal, App Check berjalan dengan DEBUG token
// (lihat firebase-ai.js) — token debug dicetak di console browser dan
// didaftarkan manual oleh Yan di console; nilainya TIDAK disimpan di sini.
export const appCheckSiteKey = "6Ldhiy8uAAAAAEi45AF1IvsHKSv2giXmrvPrCeF_";

const PLACEHOLDER = "GANTI_DENGAN_CONFIG_YAN";

export function isFirebaseConfigured() {
  return Object.values(firebaseConfig).every(
    (v) => typeof v === "string" && v.length > 0 && v !== PLACEHOLDER
  );
}

export function isAppCheckSiteKeyConfigured() {
  return appCheckSiteKey !== PLACEHOLDER && appCheckSiteKey.length > 0;
}
