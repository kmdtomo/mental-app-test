import { Suspense } from "react";
import { Metadata } from "next";
import { handleAuthRedirect } from "@/utils/server/auth";
import { SigninPage } from "@/views/SigninPage";

export const metadata: Metadata = {
  title: "Sigin",
  description: "Sigin to your account",
};

export default async function Page() {
  await handleAuthRedirect();
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SigninPage />
    </Suspense>
  );
}
