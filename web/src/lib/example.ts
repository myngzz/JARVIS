import type { ResearchReport } from "./types";

export const exampleReport: ResearchReport = {
  id: "example", query: "Energi terbarukan", title: "Energi terbarukan: dari sumber ke penerapan",
  summary: "Energi terbarukan memanfaatkan sumber alam yang dapat pulih pada skala waktu manusia. Dua artikel berikut memberi gambaran awal tentang jenis sumber energi dan tahap penerapan teknologinya.",
  findings: [
    { heading: "Lebih dari sekadar panel surya", text: "Energi surya, angin, air, dan bioenergi merupakan jenis energi terbarukan yang banyak digunakan. Panas bumi juga berperan dalam bauran energi di sejumlah negara.", sourceIds: ["example-1"], kind: "source" },
    { heading: "Teknologi berada di tahap yang berbeda", text: "Komersialisasi energi terbarukan meliputi beberapa generasi teknologi. Hidroelektrik dan panas bumi telah lama digunakan, sementara penerapan teknologi lain terus berkembang sesuai kondisi pasar dan wilayah.", sourceIds: ["example-2"], kind: "source" },
    { heading: "Data lokal tetap diperlukan", text: "Dua sumber umum ini belum cukup untuk menentukan biaya proyek atau memilih teknologi di sebuah lokasi. Keputusan investasi memerlukan data potensi energi, jaringan listrik, biaya, dan kebijakan setempat.", sourceIds: ["example-1", "example-2"], kind: "analysis" },
  ],
  sources: [
    { id: "example-1", title: "Renewable energy", kind: "web", host: "en.wikipedia.org", url: "https://en.wikipedia.org/wiki/Renewable_energy", image: "/images/andasol.jpg", excerpt: "Renewable energy is energy made from renewable natural resources that are replenished on a human timescale. The most widely used types include solar energy, wind power, bioenergy and hydropower.", accessedAt: "2026-10-20T00:00:00Z" },
    { id: "example-2", title: "Renewable energy commercialization", kind: "web", host: "en.wikipedia.org", url: "https://en.wikipedia.org/wiki/Renewable_energy_commercialization", excerpt: "Renewable energy commercialization involves the deployment of three generations of renewable energy technologies. Technologies differ in maturity and market readiness.", accessedAt: "2026-10-20T00:00:00Z" },
  ],
  mode: "example", provider: "Contoh terkurasi", warnings: ["Laporan contoh, bukan hasil riset sesi ini. Sumber Wikipedia tidak merupakan verifikasi independen."],
  createdAt: "2026-10-20T00:00:00Z", durationMs: 0,
};