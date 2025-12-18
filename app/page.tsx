import { Metadata } from "next";

import { siteConfig } from "@/config/site";
import Link from "next/link";

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
};

export default async function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FBF7F3] p-4 text-[#3D3632]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}>
      <main className="flex flex-col items-center gap-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight md:text-6xl text-[#3D3632]">
          {siteConfig.name}
        </h1>
        <p className="text-lg text-[#6B5F58] md:text-xl">
          毎日の感情を記録し、AIと共に振り返る
        </p>
        <Link
          href="/signin"
          className="rounded-full bg-[#C17B68] px-8 py-4 text-lg font-bold text-white shadow-lg transition-all hover:bg-[#A66250] hover:shadow-xl active:scale-95"
        >
          ログインして始める
        </Link>
      </main>
    </div>
  );
}
