import type { Metadata } from "next";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "JARVIS | Personal Intelligence Workspace",
  description: "Workspace riset pribadi dengan sumber yang dapat ditelusuri, dokumen, memori, dan persetujuan tindakan.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id">
      <body><a className="skip-link" href="#main-content">Lewati ke konten</a>{children}</body>
    </html>
  );
}
