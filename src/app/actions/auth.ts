"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn, signOut } from "@/lib/auth";

export type SignInState = {
  error: string | null;
};

const formSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export async function authenticate(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = formSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    // Rethrows Next.js navigation redirect signals while trapping AuthError to return failure state
    if (error instanceof AuthError) {
      return { error: "Incorrect email or password" };
    }
    throw error;
  }

  return { error: null };
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/signin" });
}
