import { siteConfig } from "@/config/site";
import { Heading3 } from "@/components/ui/typography";

import { SigninForm } from "../features/auth/components/SigninForm/SigninForm";

export const SigninPage = () => {
  return (
    <>
      <div className="flex flex-col space-y-2 text-center">
        <Heading3>{siteConfig.name}</Heading3>
        <p className="text-sm text-muted-foreground">
          Empowering Your Imagination with AI Services
        </p>
      </div>
      <SigninForm />
    </>
  );
};
