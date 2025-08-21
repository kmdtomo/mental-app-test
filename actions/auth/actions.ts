"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

type SignupActionParams = {
  email: string;
  password: string;
  name: string;
};

export const signupWithEmailAction = async ({
  email,
  password,
  name,
}: SignupActionParams) => {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  
  // ユーザー登録
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
      },
    },
  });
  
  if (error) {
    throw error;
  }
  
  // 認証が成功したら、public.usersテーブルにもデータを挿入
  if (data.user) {
    const { error: insertError } = await supabase
      .from('users')
      .insert([
        {
          id: data.user.id, // auth.usersと同じIDを使用
          name: name,
          email: email,
        }
      ]);
    
    if (insertError) {
      console.error('Failed to insert into public.users:', insertError);
      // 認証は成功しているので、エラーはログに記録するだけにする
    }
  }
  
  return data;
};

type SigninActionParams = {
  email: string;
  password: string;
};

export const signinWithEmailAction = async ({
  email,
  password,
}: SigninActionParams) => {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  
  // ユーザーログイン
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) {
    throw error;
  }
  
  return data;
};

export const signoutAction = async () => {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  
  // ログアウト
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    throw error;
  }
  
  return { success: true };
};
