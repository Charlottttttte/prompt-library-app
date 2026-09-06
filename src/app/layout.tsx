import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FolderSidebar } from "@/components/folder-sidebar";
import { buttonStyles } from "@/components/ui";
import { getFolderTree } from "@/lib/queries";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prompt Library",
  description: "Save, organize, and optimize your prompts.",
};

async function Sidebar() {
  const { tree, rootPromptCount, totalPromptCount } = await getFolderTree();
  return (
    <FolderSidebar
      tree={tree}
      rootPromptCount={rootPromptCount}
      totalPromptCount={totalPromptCount}
    />
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:flex-row md:gap-8 md:py-8">
          <aside className="w-full shrink-0 md:w-60">
            <div className="md:sticky md:top-8">
              <Link href="/" className="mb-4 block">
                <span className="text-base font-semibold">Prompt Library</span>
              </Link>

              <Link
                href="/prompts/new"
                className={`${buttonStyles.primary} mb-6 w-full`}
              >
                New prompt
              </Link>

              <Suspense
                fallback={
                  <div className="space-y-2" aria-hidden>
                    <div className="h-3 w-16 rounded bg-surface" />
                    <div className="h-6 rounded bg-surface" />
                    <div className="h-6 w-4/5 rounded bg-surface" />
                  </div>
                }
              >
                <Sidebar />
              </Suspense>
            </div>
          </aside>

          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
