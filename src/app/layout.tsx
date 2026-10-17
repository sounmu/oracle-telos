import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import DemoFetch from "@/components/DemoFetch";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PatenTrace — AI 특허 탐색기",
  description: "기존 특허를 지도로 보고, 내 아이디어와 비교해 방향을 잡는다.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f2f4f6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* 폰은 페이지 전체가 스크롤되고, md 이상은 왼쪽 열 안만 스크롤한다 */}
      <body className="h-full md:overflow-hidden">
        {/* 한국어 본문 서체. 동적 서브셋이라 쓰는 글자만 받는다 */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
          precedence="default"
        />
        <DemoFetch />
        {children}
      </body>
    </html>
  );
}
