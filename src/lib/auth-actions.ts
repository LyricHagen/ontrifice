"use server";

import { signIn, signOut, auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import { AuthError } from "next-auth";
import crypto from "crypto";

const loginAttempts = new Map<
  string,
  { count: number; resetAt: number }
>();

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const key = email.toLowerCase();
  const entry = loginAttempts.get(key);

  if (!entry || now > entry.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }

  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

export async function login(
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const rawRedirect = (formData.get("redirectTo") as string) || "/explore";
  const redirectTo = rawRedirect.startsWith("/") ? rawRedirect : "/explore";

  if (!email || !password) {
    return {
      error:
        "The email or password you entered is incorrect. Double-check both and try again. If you don't have an account, sign up instead. Ontrifice does not support password resets at this time. (ERR_AUTH_INVALID_CREDENTIALS)",
    };
  }

  if (!checkRateLimit(email)) {
    return {
      error:
        "Too many login attempts for this email. Wait 15 minutes before trying again. This protects your account from unauthorized access. (ERR_AUTH_RATE_LIMIT)",
    };
  }

  try {
    await signIn("credentials", {
      email: email.toLowerCase().trim(),
      password,
      redirectTo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error:
          "The email or password you entered is incorrect. Double-check both and try again. If you don't have an account, sign up instead. Ontrifice does not support password resets at this time. (ERR_AUTH_INVALID_CREDENTIALS)",
      };
    }
    throw error;
  }
}

export async function signup(
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const username = (formData.get("username") as string)?.trim();
  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!username || username.length < 3 || username.length > 20) {
    return {
      error:
        "Username must be 3-20 characters. Choose a shorter or longer name. (ERR_VALIDATION_USERNAME_LENGTH)",
    };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return {
      error:
        "Username can only contain letters, numbers, and underscores. Remove any special characters. (ERR_VALIDATION_USERNAME_FORMAT)",
    };
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      error:
        "Enter a valid email address. Example: you@domain.com (ERR_VALIDATION_EMAIL)",
    };
  }

  if (!password || password.length < 8) {
    return {
      error: `Password must be at least 8 characters. Yours is ${password?.length || 0}. (ERR_VALIDATION_PASSWORD_LENGTH)`,
    };
  }

  if (password !== confirmPassword) {
    return {
      error:
        "Passwords do not match. Re-enter your password in both fields. (ERR_VALIDATION_PASSWORD_MISMATCH)",
    };
  }

  const [existingEmail] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingEmail) {
    return {
      error:
        "Could not create account. If you already have an account, try logging in instead. (ERR_AUTH_SIGNUP_FAILED)",
    };
  }

  const [existingUsername] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username.toLowerCase()))
    .limit(1);

  if (existingUsername) {
    return {
      error:
        "That username is already taken. Try a different one. (ERR_AUTH_USERNAME_TAKEN)",
    };
  }

  const passwordHash = await hash(password, 12);
  try {
    await db.insert(users).values({ username: username.toLowerCase(), email, passwordHash });
  } catch {
    return {
      error:
        "Could not create your account due to a server error. This is not your fault. Try again in a moment, and if it persists, contact support. (ERR_AUTH_SIGNUP_SERVER)",
    };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/settings",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error:
          "Could not create your account due to a server error. This is not your fault. Try again in a moment, and if it persists, contact support. (ERR_AUTH_SIGNUP_SERVER)",
      };
    }
    throw error;
  }
}

export async function deleteAccount(): Promise<
  { error: string } | undefined
> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  try {
    await db.delete(users).where(eq(users.id, session.user.id));
  } catch {
    return {
      error:
        "Could not delete your account due to a server error. Try again in a moment.",
    };
  }

  await signOut({ redirectTo: "/?deleted=true" });
}

export async function generateApiKey(): Promise<
  { error: string } | { key: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  const rawKey = crypto.randomBytes(32).toString("hex");
  const hashedKey = crypto
    .createHash("sha256")
    .update(rawKey)
    .digest("hex");

  try {
    await db
      .update(users)
      .set({ apiKey: hashedKey, apiKeyCreatedAt: new Date() })
      .where(eq(users.id, session.user.id));
  } catch {
    return {
      error:
        "Could not generate API key due to a server error. Try again in a moment.",
    };
  }

  return { key: rawKey };
}

export async function revokeApiKey(): Promise<
  { error: string } | undefined
> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };

  try {
    await db
      .update(users)
      .set({ apiKey: null, apiKeyCreatedAt: null })
      .where(eq(users.id, session.user.id));
  } catch {
    return {
      error:
        "Could not revoke API key due to a server error. Try again in a moment.",
    };
  }
}
