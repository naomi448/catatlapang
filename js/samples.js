// samples.js — Fictional sample field notes so a judge (or Yan) can test
// the app immediately without typing. All households are invented; any
// resemblance to real people is coincidence. Dates are computed relative
// to "now" so the samples always land today / this week in the UI.

function daysAgo(days, hour, minute) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

export function sampleNotes() {
  return [
    {
      title: "Bu Sari — timbang balita",
      createdAt: daysAgo(0, 7, 10),
      raw:
        "kunjungan bu sari, anaknya dika 14 bln. bb 8,2 kg naik 300gr dr bln lalu. " +
        "sudah bisa jalan sendiri. imunisasi lengkap. ibu tanya soal mpasi, sudah sy jelaskan " +
        "tekstur naik pelan2. stok vitamin a di posyandu habis, perlu minta ke puskesmas.",
    },
    {
      title: "Pak Darto — padi & pupuk",
      createdAt: daysAgo(0, 8, 40),
      raw:
        "pak darto sawah 0,5 ha, padi umur 45 hst. daun agak kuning di petak bawah, kemungkinan " +
        "kurang nitrogen. pupuk urea subsidi belum dapat, kuota kelompok tani habis. sarankan " +
        "cek ke penyuluh minggu depan. panen perkiraan akhir bulan depan.",
    },
    {
      title: "Posyandu RT 04 — imunisasi",
      createdAt: daysAgo(0, 9, 15),
      raw:
        "posyandu rt 04 hari ini: 23 balita datang, 17 imunisasi (bcg 3, polio 6, dpt 8). " +
        "2 anak demam ringan setelah imunisasi, ibu sudah diberi tahu kompres hangat. " +
        "bu rina kader baru ikut bantu catat. timbangan digital error, pakai timbangan jarum dulu.",
    },
    {
      title: "Bu Lastri — kontrol hamil",
      createdAt: daysAgo(2, 10, 5),
      raw:
        "bu lastri hamil 28 minggu, anak kedua. tensi 110/70 normal. hb terakhir 10,8 agak rendah, " +
        "sudah diberi tablet tambah darah 30 tablet, diingatkan minum malam hari. gerakan janin aktif. " +
        "kontrol ulang 2 minggu lagi, kalau pusing hebat langsung ke bidan.",
    },
    {
      title: "Pak Bambang — cabai & hama",
      createdAt: daysAgo(4, 15, 30),
      raw:
        "kebun cabai pak bambang 800 batang. ada serangan kutu daun di bagian timur, daun keriting. " +
        "sudah semprot pestisida nabati daun mimba, pantau 3 hari. harga cabai di pasar lagi naik, " +
        "panen raya perkiraan 10 hari lagi. perlu contoh daun untuk ditunjukkan ke penyuluh.",
    },
  ];
}
