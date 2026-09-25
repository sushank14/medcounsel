import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Stethoscope } from "lucide-react";

export async function Header() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href={session ? "/" : "/login"} className="flex items-center gap-2 font-semibold text-brand-700">
          <Stethoscope className="h-5 w-5" />
          MedCounsel AI
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
          <Link href="/colleges" className="hover:text-brand-600">Colleges</Link>
          <Link href="/top-colleges" className="hover:text-brand-600">Top Colleges</Link>
          <Link href="/calendar" className="hover:text-brand-600">Calendar</Link>
          <Link href="/cutoffs" className="hover:text-brand-600">Cutoffs</Link>
          <Link href="/my-chances" className="hover:text-brand-600">My Chances</Link>
          <Link href="/simulator" className="hover:text-brand-600">Simulator</Link>
          {session?.user?.role === "ADMIN" && (
            <Link href="/admin" className="hover:text-brand-600">Admin</Link>
          )}
        </nav>
        <div className="flex items-center gap-2">
          {session ? (
            <>
              <span className="hidden max-w-[140px] truncate text-sm text-slate-500 sm:inline">
                {session.user.name ?? session.user.email}
              </span>
              <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
                <Button variant="outline" size="sm" type="submit">Sign out</Button>
              </form>
            </>
          ) : (
            <Link href="/login"><Button size="sm">Sign in</Button></Link>
          )}
        </div>
      </div>
    </header>
  );
}
