import Link from "next/link";
import { redirect } from "next/navigation";
import {
  User,
  Bookmark,
  List,
  FileText,
  Bell,
  Info,
  Code2,
  Settings,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@medcounsel/database";
import { formatRank } from "@/lib/utils";
import { ProfileMenuLink } from "@/components/layout/profile-menu-link";
import { CreatorCard } from "@/components/about/creator-card";

export default async function ProfileHubPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await prisma.candidateProfile.findFirst({
    where: { userId: session.user.id, isActive: true },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="mt-1 text-sm text-slate-600">
          Your counselling profile, tools, and app information.
        </p>
      </div>

      {profile ? (
        <section className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
                My counselling profile
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {formatRank(profile.rank, profile.rankType as "AIR" | "SML")} · {profile.category}
              </p>
              <p className="mt-0.5 text-sm text-slate-500">
                {profile.domicileState} · NEET-PG {profile.neetPgYear}
              </p>
            </div>
            <Link
              href="/onboarding"
              className="rounded-lg border px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
            >
              Edit profile
            </Link>
          </div>
        </section>
      ) : (
        <section className="card border-dashed p-5 text-sm text-slate-600">
          <p>No counselling profile yet.</p>
          <Link href="/onboarding" className="mt-2 inline-block font-medium text-brand-600 hover:underline">
            Set up your profile →
          </Link>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Account & counselling
        </h2>
        <div className="grid gap-2">
          <ProfileMenuLink
            href="/onboarding"
            icon={User}
            label="My counselling profile"
            description="Rank, category, preferences & priorities"
          />
          <ProfileMenuLink
            href="/compare"
            icon={Bookmark}
            label="Saved colleges"
            description="Compare colleges you saved"
          />
          <ProfileMenuLink
            href="/preferences"
            icon={List}
            label="Choice lists"
            description="Build and reorder your MCC choices"
          />
          <ProfileMenuLink
            href="/documents"
            icon={FileText}
            label="Documents"
            description="Counselling document checklist"
          />
          <ProfileMenuLink
            href="/profile/notifications"
            icon={Bell}
            label="Notifications"
            description="Counselling reminders"
            badge="Soon"
          />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">About</h2>
        <div className="grid gap-2">
          <ProfileMenuLink
            href="/profile/about"
            icon={Info}
            label="About MedCounsel"
            description="What this platform is and why it exists"
          />
          <ProfileMenuLink
            href="/profile/creator"
            icon={Code2}
            label="About the creator"
            description="Who built MedCounsel"
          />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Settings</h2>
        <ProfileMenuLink
          href="/profile/settings"
          icon={Settings}
          label="Settings"
          description="Account & sign out"
        />
      </section>

      <CreatorCard compact />
    </div>
  );
}
