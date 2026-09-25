"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { signIn } from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");
  const callbackUrl = (formData.get("callbackUrl") as string) || "/";

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof AuthError) {
      redirect(`/login?error=${error.type}&callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
    throw error;
  }
}
