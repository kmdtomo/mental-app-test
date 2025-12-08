"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// 認証が必要なページで使用。ユーザー情報を返す必要があるためgetUser()を使用
export const handleAuthValidation = async () => {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      redirect("/signin");
    }
    return data.user;
  } catch (e) {
    redirect("/signin");
  }
};

// ログインしていた場合、/dashboard-web にリダイレクトする
// ミドルウェアで既にセッションチェックをしているため、getSessionを使用
export const handleAuthRedirect = async () => {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  try {
    // getUser()ではなくgetSession()を使用してAPI呼び出しを削減
    const { data, error } = await supabase.auth.getSession();
    if (!error && data.session) {
      redirect("/dashboard-web");
    }
  } catch (e) {
    console.error(e);
    // エラーが発生してもログインページは表示する
  }
};

// 現在のユーザーを取得する (リダイレクトなし)
export const getCurrentUser = async () => {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return null;
    }
    return data.user;
  } catch (e) {
    console.error(e);
    return null;
  }
};
