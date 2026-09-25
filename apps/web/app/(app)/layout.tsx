import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="mx-auto min-h-[calc(100vh-3.5rem)] max-w-6xl px-4 pb-20 pt-6 md:pb-6">
        {children}
      </main>
      <BottomNav />
    </>
  );
}
