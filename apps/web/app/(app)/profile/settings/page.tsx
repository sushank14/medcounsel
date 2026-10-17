import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/ui/back-link";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl page">
      <BackLink fallbackHref="/profile" label="← Back to profile" />
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">Manage your account and counselling profile.</p>
      </div>

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-slate-900">Account</h2>
        <p className="mt-1 text-sm text-slate-600">{session.user.email}</p>
        {session.user.name && (
          <p className="text-sm text-slate-500">{session.user.name}</p>
        )}
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-slate-900">Counselling profile</h2>
        <p className="mt-1 text-sm text-slate-600">
          Update rank, category, specialties, budget, and choice priorities.
        </p>
        <Link href="/onboarding" className="mt-3 inline-block">
          <Button variant="outline" size="sm">
            Edit counselling profile
          </Button>
        </Link>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-slate-900">Sign out</h2>
        <p className="mt-1 text-sm text-slate-600">Sign out of MedCounsel on this device.</p>
        <form
          className="mt-3"
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button variant="outline" size="sm" type="submit">
            Sign out
          </Button>
        </form>
      </section>
    </div>
  );
}
