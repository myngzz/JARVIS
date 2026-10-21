# JARVIS Workspace

Aplikasi riset pribadi berbasis Next.js, React, dan SQLite. Antarmuka berbahasa Indonesia, dengan sumber yang bisa dibuka, pustaka dokumen, memori yang dapat dihapus, serta antrean persetujuan tindakan.

## Persyaratan

- Node.js 24+; penyimpanan menggunakan modul bawaan `node:sqlite`.
- npm dan direktori data yang dapat ditulis.
- Internet untuk pencarian web atau layanan AI cloud. Riset dokumen dan memori dalam mode ekstraktif tidak memerlukan layanan cloud.

Semua perintah berikut dijalankan dari direktori `web`.

## Mulai

```bash
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Buka <http://127.0.0.1:3000>. Laporan awal berlabel **Laporan contoh** bukan hasil riset baru. Masukkan pertanyaan, pilih Web, Dokumen, atau Memori, lalu mulai riset. Untuk dokumen pribadi, unggah melalui halaman Dokumen terlebih dahulu.

Tanpa konfigurasi tambahan, pencarian web menggunakan Wikipedia ID/EN dan laporan disusun dari petikan sumber. Mode **Ekstraktif lokal** tidak boleh dianggap sebagai analisis model AI atau verifikasi independen. Sumber web tetap dikunjungi melalui internet saat opsi Web dipilih.

## Konfigurasi Opsional

```bash
cp -n .env.example .env.local
```

Isi hanya variabel yang diperlukan di `.env.local`, lalu mulai ulang server. Jangan memasukkan kredensial ke chat atau Git.

| Variabel | Fungsi |
| --- | --- |
| `OPENAI_API_KEY` | Mengaktifkan pilihan sintesis AI cloud. |
| `OPENAI_MODEL` | Model OpenAI; default `gpt-4.1-mini`. Model harus mendukung JSON chat completions. |
| `TAVILY_API_KEY` | Pencarian web lebih luas sebagai pengganti Wikipedia. |
| `JARVIS_WEBHOOK_URL` | Tujuan HTTPS tetap untuk tindakan kirim laporan; harus disetujui dari UI. |
| `JARVIS_ACCESS_TOKEN` | Kata sandi HTTP Basic untuk mengamankan akses aplikasi. |
| `JARVIS_DATA_DIR` | Direktori SQLite; default `.data` relatif terhadap direktori aplikasi. |

API key tidak dikirim ke frontend. Penggunaan layanan eksternal dapat dikenakan biaya. Laporan AI yang gagal atau menghasilkan ID sitasi tidak valid dialihkan ke petikan ekstraktif dan ditandai dengan peringatan.

## Dokumen Dan Memori

- Format: PDF, TXT, MD, dan Markdown. Teks harus UTF-8.
- Maksimal 6 MB per berkas, 100 dokumen, 200 halaman PDF, dan 500.000 karakter teks per dokumen.
- PDF harus memiliki lapisan teks dan tidak dilindungi kata sandi. OCR untuk hasil scan belum tersedia.
- Pencarian memakai indeks teks SQLite, bukan embedding atau pencarian semantik.
- Menghapus dokumen atau memori juga menghapus laporan yang mengutipnya serta tindakan terkait.
- Salinan yang sudah diekspor, terkirim ke webhook, atau disimpan terpisah sebagai memori tidak ikut terhapus.

## Suara

Input memakai Web Speech API dengan bahasa `id-ID`; pembacaan laporan memakai suara perangkat. Dukungan berbeda antarbrowser dan perangkat. Izin aplikasi dan mikrofon diperlukan sebelum input dimulai. Layanan pengenalan suara browser dapat mengirim audio ke penyedia browser; JARVIS tidak menyimpan rekaman audio.

Perintah yang tersedia: `buka dokumen`, `buka memori`, `buka persetujuan`, dan `baca laporan`. Ucapan lain diisikan sebagai pertanyaan dan tidak otomatis menjalankan riset. Gunakan Chrome/Edge yang mendukung pengenalan suara melalui localhost atau HTTPS.

## Persetujuan

Ekspor Markdown, penyimpanan laporan ke memori, dan pengiriman webhook selalu masuk antrean terlebih dahulu. Buka **Pratinjau data**, periksa tujuan, lalu pilih **Setujui & jalankan** atau **Tolak**. Tindakan hanya dapat diklaim satu kali. Model AI tidak mendapat izin menjalankan tindakan atau perintah terminal.

Jika pengiriman webhook gagal atau timeout, periksa penerima sebelum mengajukan ulang: pihak penerima mungkin sudah menerima permintaan. Aplikasi tidak dapat menjamin eksekusi tepat satu kali pada sistem eksternal.

## Privasi Dan Akses

Data disimpan di server yang menjalankan aplikasi, bukan di browser. SQLite tidak dienkripsi secara otomatis. Gunakan enkripsi disk, cadangan yang aman, dan jangan menaruh direktori data di dalam folder publik.

Pertanyaan dikirim ke layanan pencarian saat Web aktif. Dokumen dan memori baru dikirim ke OpenAI jika AI cloud diaktifkan dan persetujuan pengiriman diberikan. Sitasi menunjukkan sumber yang tersedia, bukan jaminan kebenaran klaim.

Akses dengan hostname selain localhost ditolak jika `JARVIS_ACCESS_TOKEN` belum diatur. Untuk tautan port Codespaces atau akses jarak jauh:

1. Atur token kuat di `.env.local` dan mulai ulang server.
2. Gunakan HTTPS dan pertahankan visibilitas port Codespaces sebagai **Private**.
3. Pada dialog HTTP Basic browser, isi username `jarvis` dan password sesuai token. Username tidak digunakan sebagai akun terpisah.

Aplikasi ini untuk satu pengguna terpercaya. Autentikasi bersama bukan sistem multiuser atau kontrol akses per dokumen. Jangan membuka port publik tanpa proteksi. Pengenalan wajah, pelacakan orang, integrasi kacamata, OCR, dan agen browser otonom belum termasuk versi ini.

## Build Produksi

```bash
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

Gunakan server Node yang persisten dengan volume data yang persisten. Deployment stateless/serverless tidak cocok untuk SQLite lokal ini. Mode Cache Components dinonaktifkan agar konfigurasi API dinamis tetap kompatibel; respons API diberi `Cache-Control: no-store`.

## Pengujian

```bash
npm test
npm run typecheck
npm run lint
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

Tes browser menjalankan build produksi pada port 3100, memakai database sementara terpisah, dan tidak memakai data atau API key workspace Anda. Tutup server lain pada port itu atau tentukan `JARVIS_E2E_PORT`. Jika kode aplikasi berubah, ulangi build sebelum tes browser.

```bash
JARVIS_E2E_PORT=3101 npm run test:e2e
JARVIS_LIVE_TESTS=1 npm run test:e2e
```

Pemeriksaan rutin mencakup tampilan desktop/HP, gambar, navigasi, unggah Markdown, riset dokumen/memori, sitasi, ekspor, persetujuan, persistensi, penghapusan data terkait, dan simulasi izin suara. Pengujian live tambahan menghubungi Wikipedia dan memerlukan internet. Screenshot dan trace kegagalan ada di `test-results`.

Pengujian suara memakai simulasi API browser, bukan pengukuran akurasi mikrofon. Integrasi OpenAI, Tavily, webhook eksternal, serta perangkat kacamata tidak diuji dengan kredensial atau perangkat nyata.

## Struktur

- `src/components`: dashboard dan dialog.
- `src/app/api`: riset streaming, dokumen, memori, laporan, dan persetujuan.
- `src/lib`: SQLite, pencarian, validasi sitasi, serta suara.
- `src/proxy.ts`: autentikasi dan pemeriksaan origin.
- `e2e`: skenario Playwright desktop/mobile.

Foto Andasol oleh kallerna, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), dari [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Andasol_Guadix_4.jpg). Gambar digunakan dalam laporan contoh dan bukan data riset sesi pengguna.
