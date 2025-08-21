import { Suspense } from "react";
import { Metadata } from "next";
import { handleAuthRedirect } from "@/utils/server/auth";
import { SignupPage } from "@/views/SignupPage";

export const metadata: Metadata = {
  title: "Signup",
  description: "Signup a new account",
};

export default async function Page() {
  await handleAuthRedirect();

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignupPage />
    </Suspense>
  );
}
