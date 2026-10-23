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

Pencarian web bawaan membaca halaman hasil HTML publik DuckDuckGo tanpa API key. Dokumen, memori, dan tautan publik yang Anda masukkan juga dapat dipakai tanpa layanan API berbayar. Mode **Ekstraktif lokal** menyusun petikan sumber, bukan analisis model AI atau verifikasi independen. Laporan contoh di halaman awal tetap merupakan referensi terkurasi, bukan hasil pencarian baru.

## Konfigurasi Opsional

```bash
cp -n .env.example .env.local
```

Isi hanya variabel yang diperlukan di `.env.local`, lalu mulai ulang server. Jangan memasukkan kredensial ke chat atau Git.

| Variabel | Fungsi |
| --- | --- |
| `OPENAI_API_KEY` | Mengaktifkan pilihan sintesis AI cloud. |
| `OPENAI_MODEL` | Model OpenAI; default `gpt-4.1-mini`. Mendukung JSON chat completions dan input gambar untuk kamera. |
| `TAVILY_API_KEY` | Opsional; hanya digunakan jika provider `tavily` dipilih secara eksplisit. |
| `BRAVE_SEARCH_API_KEY` | Opsional; hanya digunakan jika provider `brave` dipilih secara eksplisit. |
| `JARVIS_SEARCH_PROVIDER` | `duckduckgo`, `auto`, `tavily`, atau `brave`. Nilai kosong/auto selalu memakai DuckDuckGo HTML tanpa key, meskipun key berbayar tersimpan. |
| `JARVIS_WEBHOOK_URL` | Tujuan HTTPS tetap untuk tindakan kirim laporan; harus disetujui dari UI. |
| `JARVIS_ACCESS_TOKEN` | Kata sandi HTTP Basic untuk mengamankan akses aplikasi. |
| `JARVIS_DATA_DIR` | Direktori SQLite; default `.data` relatif terhadap direktori aplikasi. |
| `JARVIS_BROWSER_ENABLED` | Default `true`; atur `false` untuk menonaktifkan tindakan browser baca-saja. |

API key tidak dikirim ke frontend. Penggunaan layanan eksternal dapat dikenakan biaya. Laporan AI yang gagal atau menghasilkan ID sitasi tidak valid dialihkan ke petikan ekstraktif dan ditandai dengan peringatan.

## Pencarian Tanpa API

Tidak perlu membuat akun penyedia pencarian atau mengisi API key. Gunakan `JARVIS_SEARCH_PROVIDER=duckduckgo`, biarkan `auto`, atau jangan isi variabel tersebut. Mulai ulang server jika sebelumnya provider berbayar dipilih secara eksplisit.

1. Masukkan topik pada ruang riset.
2. Aktifkan sumber **Web** dan biarkan AI cloud nonaktif jika tidak ingin memakai layanan AI berbayar.
3. Jalankan riset. JARVIS membaca judul, tautan tujuan, dan petikan yang benar-benar terdapat di halaman hasil HTML.
4. Periksa sitasi dan sumber asli sebelum memakai hasilnya sebagai dasar keputusan.

Hasil dapat berasal dari berita, dokumentasi, jurnal, situs pemerintah, organisasi, dan situs publik lain dalam indeks penyedia. Wikipedia bisa muncul jika relevan, tetapi bukan batas pencarian. Mode ini tetap memakai koneksi internet dan mengirim kueri ke DuckDuckGo. Status **Web tanpa API** berarti tidak memakai API key pencarian, bukan jaminan penyedia selalu dapat diakses.

HTML bukan API resmi yang stabil. CAPTCHA, pembatasan lalu lintas, gangguan jaringan, atau perubahan struktur halaman dapat menghentikan pencarian otomatis. Aplikasi melaporkannya secara eksplisit, tanpa hasil buatan, pengulangan otomatis, bypass verifikasi, atau fallback diam-diam ke layanan berbayar. Jika sumber lokal atau tautan langsung juga tersedia, laporan dapat memakai sumber yang berhasil diambil dengan peringatan.

Mode Ringkas mempertahankan maksimal 5 hasil per kueri, dan Mendalam maksimal 10. Riset AI mendalam dapat membuat hingga 3 kueri, dengan maksimal 16 sumber dalam laporan. Tidak semua halaman internet tercakup, khususnya halaman privat, login/paywall, atau situs yang tidak diindeks.

## Tautan Sumber Langsung

Saat pencarian otomatis dibatasi, klik **Buka pencarian di browser**. Pilih artikel publik yang relevan, lalu kembali ke JARVIS:

1. Buka **Tautan sumber** dan masukkan maksimal tiga URL, satu per baris.
2. Isi topik riset. Nonaktifkan **Web** jika hanya ingin membaca tautan tersebut tanpa menghubungi mesin pencari.
3. Jalankan riset. Tautan juga bisa digabungkan dengan dokumen, memori, atau pencarian web.
4. Periksa laporan ekstraktif dan sitasinya. Laporan yang hanya menggunakan tautan ditandai **Tautan langsung**.

Impor memakai HTTP dan parser HTML, tanpa API key atau Chromium. Pembatas jaringan yang sama dengan browser baca-saja tetap berlaku: alamat privat/localhost ditolak, DNS diperiksa dan IP koneksi dipasangkan, redirect dibatasi pada hostname yang sama, serta ukuran halaman maksimal 2 MB. Skrip dan formulir tidak dijalankan; halaman verifikasi tidak diperlakukan sebagai sumber.

Hanya teks HTML/teks publik yang didukung. Petikan sumber dibatasi hingga 3.000 karakter; ini bukan pengambilan seluruh isi situs. Halaman yang membutuhkan login, JavaScript, atau akses berbayar dapat gagal. Untuk PDF, gunakan unggahan Dokumen. Jika sebagian tautan tidak dapat dibaca, hasil yang berhasil tetap dipertahankan dan kegagalan ditampilkan sebagai peringatan.

## Provider Opsional

Integrasi Tavily dan Brave tetap tersedia sebagai pilihan eksplisit, bukan syarat penggunaan. Untuk mengaktifkannya, isi key yang sesuai dan atur `JARVIS_SEARCH_PROVIDER=tavily` atau `brave`, lalu mulai ulang server. Periksa kuota dan harga penyedia. `auto` tidak memilih provider berbayar secara otomatis lagi.

Key yang hilang, ditolak, atau kehabisan kuota dilaporkan secara jelas. `OPENAI_API_KEY` terpisah dari pengaturan pencarian dan hanya diperlukan untuk analisis AI/gambar yang diaktifkan pengguna.

## Riset AI Mendalam

Aktifkan sakelar AI cloud, pilih **Mendalam**, dan berikan persetujuan pengiriman pertanyaan serta petikan sumber. Pipeline kemudian:

1. Membuat rencana dengan maksimal tiga kueri, tetap menyertakan pertanyaan asli.
2. Mencari dokumen/memori yang dipilih dan menjalankan kueri web secara paralel jika Web aktif.
3. Menyusun analisis berdasarkan maksimal 16 sumber yang dipertahankan.
4. Meminta model meninjau draft terhadap petikan dan menyingkirkan temuan yang dianggap tidak didukung.
5. Menyimpan laporan, rencana, sitasi, keterbatasan, dan hasil peninjauan di riwayat.

Satu riset AI mendalam dapat memakai tiga panggilan AI dan hingga tiga pencarian HTML atau API provider yang dipilih. Biaya AI lebih tinggi daripada mode Ringkas; pencarian HTML sendiri tidak memerlukan API berbayar. Batas waktu pipeline 150 detik; tidak ada retry AI otomatis. Pembatalan tidak menjamin biaya permintaan AI yang sudah dikirim ikut dibatalkan.

Peninjauan memakai model yang sama, bukan pemeriksa fakta independen. Validasi memastikan ID sitasi tersedia, bukan membuktikan bahwa setiap klaim benar. Kegagalan sintesis atau peninjauan mengembalikan laporan ekstraktif dengan peringatan. Tanpa AI cloud, **Mendalam** hanya meningkatkan jumlah sumber dan tidak melakukan penalaran model.

## Kamera Dan Gambar

Halaman **Kamera** menerima kamera laptop/HP atau unggahan JPEG, PNG, dan WebP maksimal 6 MB. Kamera berjalan lokal tanpa audio dan berhenti ketika halaman kamera ditutup. Cuplikan diperkecil di browser sebelum dikirim, dengan sisi terpanjang maksimal 1280 piksel. API menerima gambar maksimal 2 MB.

1. Mulai kamera dan ambil gambar, atau unggah satu gambar.
2. Isi pertanyaan tentang objek atau teks yang terlihat.
3. Berikan persetujuan pengiriman gambar dan pertanyaan ke OpenAI, lalu pilih **Analisis gambar**.
4. Periksa deskripsi, teks terbaca, dan ketidakpastian. **Simpan ke dokumen** menyimpan hasil teks saja.

Penggantian gambar atau pertanyaan menghapus hasil lama dan meminta persetujuan ulang. Tidak ada streaming video otomatis ke model. JARVIS tidak mengarsipkan gambar ke SQLite, tetapi kebijakan penyimpanan penyedia AI tetap berlaku. Jangan mengirim gambar atau dokumen yang tidak berhak Anda bagikan.

Gunakan localhost atau HTTPS; akses kamera bergantung pada izin browser. Kamera HP memakai pilihan depan/belakang jika tersedia. Teks pada foto dapat dibaca model, tetapi hasil bukan OCR yang dijamin akurat dan bukan konversi PDF scan secara massal. Tidak ada pengenalan identitas, verifikasi wajah, atau pelacakan orang.

## Dokumen Dan Memori

- Format: PDF, TXT, MD, dan Markdown. Teks harus UTF-8.
- Maksimal 6 MB per berkas, 100 dokumen, 200 halaman PDF, dan 500.000 karakter teks per dokumen.
- PDF harus memiliki lapisan teks dan tidak dilindungi kata sandi. OCR untuk hasil scan belum tersedia.
- Pencarian memakai indeks teks SQLite, bukan embedding atau pencarian semantik.
- Menghapus dokumen atau memori juga menghapus laporan yang mengutipnya serta tindakan terkait.
- Salinan yang sudah diekspor, terkirim ke webhook, atau disimpan terpisah sebagai memori tidak ikut terhapus.

## Suara

Input memakai Web Speech API dengan bahasa `id-ID`; pembacaan laporan memakai suara perangkat. Dukungan berbeda antarbrowser dan perangkat. Izin aplikasi dan mikrofon diperlukan sebelum input dimulai. Layanan pengenalan suara browser dapat mengirim audio ke penyedia browser; JARVIS tidak menyimpan rekaman audio.

Perintah yang tersedia: `buka kamera`, `buka dokumen`, `buka memori`, `buka persetujuan`, dan `baca laporan`. Ucapan lain diisikan sebagai pertanyaan dan tidak otomatis menjalankan riset. Gunakan Chrome/Edge yang mendukung pengenalan suara melalui localhost atau HTTPS.

## Persetujuan

Ekspor Markdown, arsip laporan, penyimpanan laporan ke memori, pembacaan browser, dan pengiriman webhook selalu masuk antrean terlebih dahulu. Buka **Pratinjau data**, periksa tujuan, lalu pilih **Setujui & jalankan** atau **Tolak**. Tindakan hanya dapat diklaim satu kali. Model AI tidak mendapat izin menjalankan tindakan atau perintah terminal.

**Arsipkan laporan** membuat dokumen Markdown di pustaka SQLite, bukan menulis ke path bebas di komputer. Gunakan ekspor untuk mengunduh berkas fisik. Dokumen arsip adalah salinan terpisah dan tidak otomatis terhapus bersama laporan asalnya.

Jika pengiriman webhook gagal atau timeout, periksa penerima sebelum mengajukan ulang: pihak penerima mungkin sudah menerima permintaan. Aplikasi tidak dapat menjamin eksekusi tepat satu kali pada sistem eksternal.

## Browser Baca-Saja

Siapkan Chromium di mesin server:

```bash
npx playwright install --with-deps chromium
```

Pada laporan yang memiliki sumber web, pilih **Telusuri sumber**. Pratinjau menampilkan maksimal tiga URL dari laporan. Setelah disetujui, browser mengambil teks dan menyimpannya sebagai dokumen lokal dengan URL serta waktu akses. Dokumen hasilnya bisa menjadi sumber riset berikutnya. Instalasi Chromium belum diverifikasi hanya dari status konfigurasi; tindakan akan gagal dengan jelas jika runtime browser tidak tersedia.

Batas operasinya:

- Sesi browser baru tanpa cookies akun, login, JavaScript situs, formulir, atau subresource.
- Hanya HTTP/HTTPS publik pada port standar; tanpa kredensial di URL.
- IP privat, localhost, alamat metadata, dan hasil DNS nonpublik ditolak. Koneksi dipasangkan dengan IP yang sudah diperiksa.
- Redirect hanya boleh pada hostname yang sama dan tidak boleh menurunkan HTTPS ke HTTP.
- Maksimal tiga redirect, 2 MB per halaman, 24.000 karakter per dokumen hasil, dan satu tindakan browser berjalan sekaligus.
- Tindakan dibatasi waktu dan dapat dihentikan; hasil sebagian ditandai. Tidak ada pengulangan otomatis atau bypass CAPTCHA/paywall.

Isolasi ini adalah pembatas aplikasi dan konteks browser, bukan mesin virtual keamanan. Untuk deployment di jaringan sensitif, tambahkan pembatas egress jaringan di infrastruktur. Situs dinamis yang memerlukan JavaScript atau login dapat gagal dibaca. Fitur ini bukan agen yang bebas mengklik situs, mengendalikan desktop, atau menjalankan terminal.

## Privasi Dan Akses

Data disimpan di server yang menjalankan aplikasi, bukan di browser. SQLite tidak dienkripsi secara otomatis. Gunakan enkripsi disk, cadangan yang aman, dan jangan menaruh direktori data di dalam folder publik.

Pertanyaan dikirim ke penyedia pencarian saat Web aktif. Tautan sumber langsung menghubungi situs yang Anda pilih dan menyimpan petikan dalam laporan lokal. Dokumen, memori, dan petikan sumber baru dikirim ke OpenAI jika AI cloud diaktifkan dan persetujuan pengiriman diberikan. Sitasi menunjukkan sumber yang tersedia, bukan jaminan kebenaran klaim.

Akses dengan hostname selain localhost ditolak jika `JARVIS_ACCESS_TOKEN` belum diatur. Untuk tautan port Codespaces atau akses jarak jauh:

1. Atur token kuat di `.env.local` dan mulai ulang server.
2. Gunakan HTTPS dan pertahankan visibilitas port Codespaces sebagai **Private**.
3. Pada dialog HTTP Basic browser, isi username `jarvis` dan password sesuai token. Username tidak digunakan sebagai akun terpisah.

Aplikasi ini untuk satu pengguna terpercaya. Autentikasi bersama bukan sistem multiuser atau kontrol akses per dokumen. Jangan membuka port publik tanpa proteksi. Pengenalan wajah, pelacakan orang, integrasi Meta Ray-Ban, OCR PDF massal, dan kendali desktop bebas tidak termasuk versi ini.

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

Tes browser menjalankan build produksi pada port 3100 dengan database sementara terpisah, provider DuckDuckGo HTML, dan semua key pencarian/AI dikosongkan. Tutup server lain pada port itu atau tentukan `JARVIS_E2E_PORT`. Jika kode aplikasi berubah, ulangi build sebelum tes browser.

```bash
JARVIS_E2E_PORT=3101 npm run test:e2e
JARVIS_LIVE_TESTS=1 npm run test:e2e
```

Dengan `JARVIS_LIVE_TESTS=1`, tes mengimpor halaman dokumentasi W3C dan membaca ulang sumbernya melalui browser setelah persetujuan. Ini membutuhkan internet, tetapi tidak membutuhkan atau meneruskan API key apa pun. Tes rutin menyimulasikan pemblokiran pencarian agar CAPTCHA tidak membuat hasil pengujian bergantung pada kondisi mesin pencari.

Pemeriksaan rutin mencakup tampilan desktop/HP, gambar, navigasi, unggah Markdown, riset dokumen/memori, sitasi, ekspor, arsip, persetujuan, persistensi, penghapusan data terkait, kamera sintetis, status tanpa API, validasi tautan, dan simulasi izin suara. Tes unit memeriksa parser hasil HTML, penolakan CAPTCHA, batas ukuran, pembatalan, impor artikel, pembatas DNS/URL, serta pipeline tanpa pemakaian key berbayar. Screenshot dan trace kegagalan ada di `test-results`.

Pengujian kamera memakai perangkat sintetis dan pemeriksaan piksel, bukan kamera fisik. Pengujian suara memakai simulasi API browser, bukan pengukuran akurasi mikrofon. Respons cloud kamera/riset disimulasikan; kualitas jawaban OpenAI tidak diukur dengan kredensial nyata. Adapter Tavily/Brave telah diuji dengan respons simulasi; akses akun dan kuota nyata perlu diuji setelah key diisi. Webhook eksternal serta perangkat kacamata juga belum diuji dengan kredensial atau perangkat nyata.

## Struktur

- `src/components`: dashboard, kamera, rencana riset, dan dialog.
- `src/app/api`: riset streaming, analisis gambar, dokumen, memori, laporan, dan persetujuan.
- `src/lib`: SQLite, pencarian, pipeline AI, validasi sitasi, browser baca-saja, serta suara.
- `src/proxy.ts`: autentikasi dan pemeriksaan origin.
- `e2e`: skenario Playwright desktop/mobile.

Foto Andasol oleh kallerna, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), dari [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Andasol_Guadix_4.jpg). Gambar digunakan dalam laporan contoh dan bukan data riset sesi pengguna.
