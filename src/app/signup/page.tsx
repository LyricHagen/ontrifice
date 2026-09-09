import type { Metadata } from "next";
import { SignupForm } from "@/components/signup-form";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create an Ontrifice account to access API keys and advanced features.",
  openGraph: {
    title: "Sign up | Ontrifice",
    description: "Create an Ontrifice account to access API keys and advanced features.",
    type: "website",
    url: "https://ontrifice.dev/signup",
  },
};

export default function SignupPage() {
  return <SignupForm />;
}
