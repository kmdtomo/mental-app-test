"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const signoutAction = async () => {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    throw error;
  }
  
  return { success: true };
}; 