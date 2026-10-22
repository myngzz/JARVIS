# JARVIS Workspace

Workspace riset pribadi berbahasa Indonesia dengan sumber yang dapat diperiksa, dokumen lokal, memori, input suara, dan tindakan yang memerlukan persetujuan.

## Menjalankan

Memerlukan Node.js 24+ dan npm. Dari direktori repo:

```bash
npm --prefix web ci
npm --prefix web run dev -- --hostname 127.0.0.1 --port 3000
```

Buka <http://127.0.0.1:3000>. Dokumen dan memori lokal dapat ditelusuri tanpa API key. Untuk pencarian web umum, isi `TAVILY_API_KEY` atau `BRAVE_SEARCH_API_KEY` mengikuti [panduan konfigurasi](web/README.md). Pencarian tidak lagi dibatasi ke Wikipedia atau diam-diam kembali ke Wikipedia saat key belum tersedia.

## Fitur

- Riset dengan sitasi, detail sumber, progres, pembatalan, dan riwayat.
- Riset AI mendalam: perencanaan hingga tiga kueri, pencarian paralel, sintesis, dan peninjauan bukti oleh model.
- Pencarian lokal dalam PDF berlapis teks, TXT, Markdown, dan memori pribadi.
- Input suara Bahasa Indonesia serta pembacaan laporan, bergantung pada dukungan browser.
- Kamera laptop/HP dan unggahan gambar untuk analisis objek serta teks, dengan izin cloud per gambar/pertanyaan.
- Browser baca-saja untuk mengambil maksimal tiga sumber publik setelah persetujuan, lalu menyimpannya ke dokumen.
- Pratinjau dan persetujuan sebelum ekspor Markdown, arsip dokumen, penyimpanan memori, atau pengiriman webhook.
- Pencarian lintas situs melalui indeks web umum Tavily atau Brave; sintesis OpenAI bersifat opsional.
- SQLite lokal, penghapusan data, dan proteksi akses jarak jauh.

Versi ini adalah aplikasi web pribadi, bukan implementasi pengenalan wajah atau integrasi Meta Ray-Ban. Halaman awal menandai laporan contoh secara eksplisit.

Analisis mendalam dan kamera memerlukan `OPENAI_API_KEY` serta model yang mendukung input gambar dan JSON. Key analisis berbeda dari key pencarian. Browser baca-saja memerlukan Chromium Playwright. Tanpa API key, fitur dokumen, memori, ekstraksi sumber lokal, dan persetujuan tetap tersedia.

Lihat [panduan aplikasi](web/README.md) untuk konfigurasi, pengujian, akses dari Codespaces, dan batasan privasi. [Contoh variabel lingkungan](web/.env.example) tidak berisi kredensial.