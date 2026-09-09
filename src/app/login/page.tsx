import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to your Ontrifice account.",
  openGraph: {
    title: "Log in | Ontrifice",
    description: "Log in to your Ontrifice account.",
    type: "website",
    url: "https://ontrifice.dev/login",
  },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;

  return <LoginForm redirectTo={params.redirect} />;
}
