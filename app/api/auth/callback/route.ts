import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get("next") ?? "/";

  if (code) {
    try {
      const cookieStore = cookies();
      const supabase = createClient(cookieStore);
      
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error("Error exchanging code for session:", error);
        return NextResponse.redirect(`${origin}/auth-code-error`);
      }
      
      // セッションが確立されたら、現在のユーザー情報を取得
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // public.usersテーブルにユーザーが存在するか確認
        const { data: existingUser, error: checkError } = await supabase
          .from('users')
          .select('id')
          .eq('id', user.id)
          .single();
          
        if (checkError && checkError.code !== 'PGRST116') {
          console.error("Error checking existing user:", checkError);
        }
        
        // ユーザーが存在しない場合は挿入
        if (!existingUser) {
          const userData = {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name || user.user_metadata?.full_name || '',
          };
          
          const { error: insertError } = await supabase
            .from('users')
            .insert([userData]);
            
          if (insertError) {
            console.error("Error inserting user data:", insertError);
          }
        }
      }
      
      return NextResponse.redirect(`${origin}${next}`);
    } catch (error) {
      console.error("Error in auth callback:", error);
      return NextResponse.redirect(`${origin}/auth-code-error`);
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth-code-error`);
}
