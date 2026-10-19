import { Metadata } from "next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";

export const metadata: Metadata = {
  title: "Panel",
  description: "Organiza tus tareas y pendientes en FyDry Task.",
};

export default function DashboardPage() {
  return <DashboardLayout />;
}
