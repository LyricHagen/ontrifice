import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SettingsContent } from "@/components/settings-content";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your Ontrifice account, API keys, and preferences.",
  openGraph: {
    title: "Settings | Ontrifice",
    description: "Manage your Ontrifice account, API keys, and preferences.",
    type: "website",
    url: "https://ontrifice.dev/settings",
  },
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?redirect=/settings");
  }

  const [user] = await db
    .select({
      username: users.username,
      email: users.email,
      apiKey: users.apiKey,
      apiKeyCreatedAt: users.apiKeyCreatedAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) {
    redirect("/login");
  }

  return (
    <SettingsContent
      username={user.username}
      email={user.email}
      hasApiKey={user.apiKey !== null}
      apiKeyCreatedAt={user.apiKeyCreatedAt?.toISOString() ?? null}
    />
  );
}
