import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SiteFooter } from "@/components/layout/site-footer";

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="mx-auto min-h-[calc(100vh-3.5rem)] max-w-6xl px-4 pb-28 pt-6 sm:px-6 md:pb-10 md:pt-8">
        {children}
      </main>
      <SiteFooter />
      <BottomNav />
    </>
  );
}
