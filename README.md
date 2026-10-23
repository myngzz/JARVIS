# JARVIS Workspace

Workspace riset pribadi berbahasa Indonesia dengan sumber yang dapat diperiksa, dokumen lokal, memori, input suara, dan tindakan yang memerlukan persetujuan.

## Menjalankan

Memerlukan Node.js 24+ dan npm. Dari direktori repo:

```bash
npm --prefix web ci
npm --prefix web run dev -- --hostname 127.0.0.1 --port 3000
```

Buka <http://127.0.0.1:3000>. Pencarian web, pembacaan tautan publik, serta laporan ekstraktif dapat dipakai tanpa API key. Mode bawaan membaca hasil HTML publik DuckDuckGo dan tidak dibatasi ke Wikipedia. Koneksi internet tetap diperlukan untuk sumber web.

Jika mesin pencari meminta CAPTCHA atau membatasi server, gunakan **Buka pencarian di browser**, lalu masukkan maksimal tiga URL pada **Tautan sumber**. Nonaktifkan **Web** untuk membaca hanya tautan yang dipilih. JARVIS tidak mencoba melewati verifikasi atau diam-diam beralih ke API berbayar.

## Fitur

- Riset dengan sitasi, detail sumber, progres, pembatalan, dan riwayat.
- Riset AI mendalam: perencanaan hingga tiga kueri, pencarian paralel, sintesis, dan peninjauan bukti oleh model.
- Pencarian lokal dalam PDF berlapis teks, TXT, Markdown, dan memori pribadi.
- Input suara Bahasa Indonesia serta pembacaan laporan, bergantung pada dukungan browser.
- Kamera laptop/HP dan unggahan gambar untuk analisis objek serta teks, dengan izin cloud per gambar/pertanyaan.
- Browser baca-saja untuk mengambil maksimal tiga sumber publik setelah persetujuan, lalu menyimpannya ke dokumen.
- Pratinjau dan persetujuan sebelum ekspor Markdown, arsip dokumen, penyimpanan memori, atau pengiriman webhook.
- Pencarian HTML lintas situs tanpa API key, dengan tautan sumber langsung sebagai alternatif ketika akses otomatis dibatasi.
- Tavily/Brave hanya dipakai jika dipilih secara eksplisit; sintesis OpenAI bersifat opsional.
- SQLite lokal, penghapusan data, dan proteksi akses jarak jauh.

Versi ini adalah aplikasi web pribadi, bukan implementasi pengenalan wajah atau integrasi Meta Ray-Ban. Halaman awal menandai laporan contoh secara eksplisit.

Analisis AI mendalam dan analisis gambar memerlukan `OPENAI_API_KEY` serta model yang mendukung input gambar dan JSON. Ini terpisah dari pencarian tanpa API. Browser baca-saja memerlukan Chromium Playwright; pembacaan tautan langsung memakai HTTP dan parser HTML tanpa Chromium.

Lihat [panduan aplikasi](web/README.md) untuk konfigurasi, pengujian, akses dari Codespaces, dan batasan privasi. [Contoh variabel lingkungan](web/.env.example) tidak berisi kredensial.