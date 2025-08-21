import { Metadata } from "next";

import { siteConfig } from "@/config/site";
import { MainLayout } from "@/components/ui/common/MainLayout";
import { Heading1 } from "@/components/ui/typography";
import Link from "next/link";

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
};

export default async function Home() {
  return (
    <MainLayout>
      <div className="pt-20 text-white">
        <Heading1>This is SaaS template</Heading1>
        <Link href="/signin" className="bg-red-600 text-white p-3 rounded-md ml-4 hover:bg-red-700">Login</Link>
      </div>
    </MainLayout>
  );
}
