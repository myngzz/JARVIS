# JARVIS Workspace

Workspace riset pribadi berbahasa Indonesia dengan sumber yang dapat diperiksa, dokumen lokal, memori, input suara, dan tindakan yang memerlukan persetujuan.

## Menjalankan

Memerlukan Node.js 24+ dan npm. Dari direktori repo:

```bash
npm --prefix web ci
npm --prefix web run dev -- --hostname 127.0.0.1 --port 3000
```

Buka <http://127.0.0.1:3000>. Mode dasar tidak memerlukan API key: pencarian menggunakan Wikipedia Indonesia/Inggris dan laporan berisi petikan ekstraktif, bukan jawaban model AI.

## Fitur

- Riset dengan sitasi, detail sumber, progres, pembatalan, dan riwayat.
- Pencarian lokal dalam PDF berlapis teks, TXT, Markdown, dan memori pribadi.
- Input suara Bahasa Indonesia serta pembacaan laporan, bergantung pada dukungan browser.
- Pratinjau dan persetujuan sebelum ekspor Markdown, penyimpanan laporan ke memori, atau pengiriman ke webhook.
- OpenAI dan pencarian web Tavily sebagai integrasi opsional.
- SQLite lokal, penghapusan data, dan proteksi akses jarak jauh.

Versi ini adalah aplikasi web pribadi, bukan implementasi pengenalan wajah atau integrasi Meta Ray-Ban. Halaman awal menandai laporan contoh secara eksplisit.

Lihat [panduan aplikasi](web/README.md) untuk konfigurasi, pengujian, akses dari Codespaces, dan batasan privasi. [Contoh variabel lingkungan](web/.env.example) tidak berisi kredensial.