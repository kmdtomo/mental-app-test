import { SignupForm } from "@/features/auth/components/SignupForm";

import { siteConfig } from "@/config/site";
import { Heading3 } from "@/components/ui/typography";

export const SignupPage = () => {
  return (
    <>
      <div className="flex flex-col space-y-2 text-center">
        <Heading3>{siteConfig.name}</Heading3>
        <p className="text-sm text-muted-foreground">
          Empowering Your Imagination with AI Services
        </p>
      </div>
      <SignupForm />
    </>
  );
};
