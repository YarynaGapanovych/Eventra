import { HomeAuth } from "@/components/auth/home-auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in · Eventra",
};

export default function LoginPage() {
  return <HomeAuth />;
}
