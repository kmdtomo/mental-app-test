import { SignupForm } from "@/features/auth/components/SignupForm";

import { siteConfig } from "@/config/site";
import { Heading3 } from "@/components/ui/typography";

export const SignupPage = () => {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#FBF7F3] p-4" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}>
      <div className="w-full max-w-[400px] flex flex-col space-y-6 md:space-y-8">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-[#3D3632]">{siteConfig.name}</h1>
          <p className="text-xs md:text-sm text-[#6B5F58]">
            新しいアカウントを作成して始めましょう。
          </p>
        </div>
        <div className="bg-white/80 backdrop-blur-sm p-6 md:p-8 rounded-[24px] shadow-[0_2px_8px_rgba(193,123,104,0.12),0_1px_3px_rgba(107,95,88,0.06)] border border-[#F5EBE0]">
          <SignupForm />
        </div>
      </div>
    </div>
  );
};

