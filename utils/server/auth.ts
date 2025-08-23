"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

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

// ログインしていた場合、/voice-diary にリダイレクトする
export const handleAuthRedirect = async () => {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) {
      redirect("/voice-diary");
    }
  } catch (e) {
    console.error(e);
    throw e;
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
