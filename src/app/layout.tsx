import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { DataStaleBanner } from "@/components/layout/DataStaleBanner";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-noto-sans-kr",
});

export const metadata: Metadata = {
  title: {
    default: "G2B 스마트 비교 | 나라장터 종합쇼핑몰 비교 서비스",
    template: "%s | G2B 스마트 비교",
  },
  description:
    "나라장터 종합쇼핑몰 공공데이터를 기반으로 관급자재를 쉽게 검색하고 비교하는 공익 서비스입니다.",
  keywords: ["나라장터", "종합쇼핑몰", "관급자재", "공공조달", "G2B"],
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={notoSansKr.variable}>
      <body className="min-h-screen flex flex-col bg-gray-50 font-sans antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded focus:shadow-lg focus:text-blue-700"
        >
          본문으로 바로가기
        </a>
        <SiteHeader />
        <DataStaleBanner />
        <main id="main-content" className="flex-1 w-full max-w-7xl mx-auto px-4 py-6">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
