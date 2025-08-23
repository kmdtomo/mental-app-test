import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { supabase, response } = createClient(request);
  // Supabase Auth のセッションをルートで自動更新
  await supabase.auth.getUser();
  return response;
}

// 静的アセットなどを除外
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};


