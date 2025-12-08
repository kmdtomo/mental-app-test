import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { supabase, response } = createClient(request);

  // セッションの取得のみ行い、自動リフレッシュはクライアント側に任せる
  // これにより、ミドルウェアでの過剰なトークンリフレッシュを防ぐ
  try {
    await supabase.auth.getSession();
  } catch (error) {
    // エラーが発生してもレスポンスは返す
    console.error('Middleware session check error:', error);
  }

  return response;
}

// 静的アセットなどを除外
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|woff|woff2|ttf|eot|ico)$).*)",
  ],
};


