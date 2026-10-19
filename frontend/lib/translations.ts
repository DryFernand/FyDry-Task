export type Language = "es" | "en";

export const translations = {
  es: {
    brand: {
      name: "FyDry Task",
      tagline: "Gestión de Tareas",
      securityTag: "Conexión cifrada (HTTPS)",
    },
    nav: {
      main: "PRINCIPAL",
      home: "Inicio",
      settings: "Configuración",
      logout: "Cerrar Sesión",
    },
    home: {
      greeting: "Hola",
      subtitle: "Este es tu espacio de tareas. Pronto aquí verás tus pendientes, proyectos y prioridades.",
      emptyTitle: "Tu espacio está listo",
      emptyText: "Estamos construyendo los módulos de FyDry Task. Muy pronto podrás crear y organizar tus tareas desde aquí.",
      loading: "Cargando tu espacio de tareas...",
    },
  },
  en: {
    brand: {
      name: "FyDry Task",
      tagline: "Task Management",
      securityTag: "Encrypted connection (HTTPS)",
    },
    nav: {
      main: "MAIN",
      home: "Home",
      settings: "Settings",
      logout: "Sign Out",
    },
    home: {
      greeting: "Hi",
      subtitle: "This is your task space. Soon you'll see your to-dos, projects and priorities here.",
      emptyTitle: "Your space is ready",
      emptyText: "We're building the FyDry Task modules. Very soon you'll be able to create and organize your tasks from here.",
      loading: "Loading your task space...",
    },
  },
};
