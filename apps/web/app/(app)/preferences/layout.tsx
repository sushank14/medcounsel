import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function PreferencesLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/preferences");
  return <div className="mx-auto w-full max-w-3xl pb-10 pt-1">{children}</div>;
}
