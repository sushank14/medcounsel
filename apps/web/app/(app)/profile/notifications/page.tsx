import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { auth } from "@/lib/auth";
import { BackLink } from "@/components/ui/back-link";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BackLink fallbackHref="/profile" label="← Back to profile" />
      <div>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="mt-1 text-sm text-slate-600">Counselling reminders and deadline alerts.</p>
      </div>
      <section className="card flex flex-col items-center px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <Bell className="h-6 w-6" />
        </div>
        <p className="mt-4 font-medium text-slate-900">Coming soon</p>
        <p className="mt-2 max-w-sm text-sm text-slate-600">
          Smart notifications for counselling rounds and document deadlines are on the roadmap.
          For now, check the{" "}
          <a href="/calendar" className="font-medium text-brand-600 hover:underline">
            counselling calendar
          </a>
          .
        </p>
      </section>
    </div>
  );
}
