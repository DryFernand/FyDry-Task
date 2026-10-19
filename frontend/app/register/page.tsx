import AuthCard from "@/components/auth/AuthCard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crear Cuenta",
  description: "Regístrate en FyDry Task y organiza tus tareas sin estrés.",
};

export default function RegisterPage() {
  return <AuthCard initialView="register" />;
}
