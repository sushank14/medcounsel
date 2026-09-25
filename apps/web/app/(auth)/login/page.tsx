import { googleAuthEnabled, signIn } from "@/lib/auth";
import { loginAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stethoscope } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Invalid email or password. Contact your administrator if you need access.",
  AccessDenied: "This account is not authorized to use MedCounsel AI.",
  Default: "Sign in failed. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/";
  const errorMessage = params.error
    ? (ERROR_MESSAGES[params.error] ?? ERROR_MESSAGES.Default)
    : null;

  return (
    <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mb-4 inline-flex items-center gap-2 font-semibold text-brand-700">
            <Stethoscope className="h-6 w-6" />
            MedCounsel AI
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
          <p className="mt-1 text-sm text-slate-600">
            Authorized users only — enter your credentials to continue
          </p>
        </div>

        <div className="card space-y-4 p-6 shadow-lg">
          {errorMessage && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          )}

        <form action={loginAction}>
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="username"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Your password"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>
            <Button type="submit" className="mt-4 w-full">
              Sign in
            </Button>
          </form>

          {googleAuthEnabled && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-500">or</span>
                </div>
              </div>

              <form
                action={async () => {
                  "use server";
                  await signIn("google", { redirectTo: callbackUrl });
                }}
              >
                <Button type="submit" variant="outline" className="w-full">
                  Continue with Google
                </Button>
              </form>
            </>
          )}
        </div>

      <p className="text-center text-xs text-slate-500">
        Need access? Ask your administrator to add your email to the allowlist.
      </p>
    </div>
  );
}
