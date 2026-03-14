import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { Analytics } from '@vercel/analytics/next';
import Script from "next/script";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "F1 Championship Standings",
  description:
    "Interactive bump chart visualization of F1 season standings over time",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-K6EYFR9LLM"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-K6EYFR9LLM');
          `}
        </Script>
      </head>
      <Analytics />
      <body className={`${outfit.variable} bg-neutral-950 text-white antialiased font-[family-name:var(--font-outfit)]`}>
        {children}
      </body>
    </html>
  );
}
