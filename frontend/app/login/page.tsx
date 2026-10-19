import AuthCard from "@/components/auth/AuthCard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Iniciar Sesión",
  description: "Accede a tu cuenta de FyDry Task para organizar tus tareas con tranquilidad.",
};

export default function LoginPage() {
  return <AuthCard initialView="login" />;
}
