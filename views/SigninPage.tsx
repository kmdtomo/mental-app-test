"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { siteConfig } from "@/config/site";
import { Heading3 } from "@/components/ui/typography";

import { SigninForm } from "../features/auth/components/SigninForm/SigninForm";

export const SigninPage = () => {
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push("/dashboard-web");
      }
    };
    checkSession();
  }, [router]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#FBF7F3] p-4" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}>
      <div className="w-full max-w-[400px] flex flex-col space-y-6 md:space-y-8">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-[#3D3632]">{siteConfig.name}</h1>
          <p className="text-xs md:text-sm text-[#6B5F58]">
            おかえりなさい。ログインして記録を続けましょう。
          </p>
        </div>
        <div className="bg-white/80 backdrop-blur-sm p-6 md:p-8 rounded-[24px] shadow-[0_2px_8px_rgba(193,123,104,0.12),0_1px_3px_rgba(107,95,88,0.06)] border border-[#F5EBE0]">
          <SigninForm />
        </div>
      </div>
    </div>
  );
};

