import AuthCard from "@/components/auth/AuthCard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Autenticación",
  description: "Accede o regístrate en FyDry Task.",
};

export default function AuthPage() {
  return <AuthCard initialView="login" />;
}
