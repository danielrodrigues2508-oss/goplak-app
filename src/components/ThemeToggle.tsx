"use client";

import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={`w-9 h-9 rounded-xl bg-neutral-200 dark:bg-neutral-800 animate-pulse ${className}`} />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 cursor-pointer border shadow-sm ${
        theme === "dark"
          ? "bg-neutral-900 hover:bg-neutral-800 text-amber-400 border-neutral-800 hover:border-neutral-700 shadow-black/40"
          : "bg-white hover:bg-zinc-100 text-slate-700 border-zinc-200 hover:border-zinc-300 shadow-zinc-200/50"
      } ${className}`}
      title={theme === "dark" ? "Alternar para Modo Claro" : "Alternar para Modo Escuro"}
      aria-label="Alternar tema claro/escuro"
    >
      {theme === "dark" ? (
        <Sun className="w-4 h-4 transition-transform rotate-0 hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 transition-transform rotate-0 hover:-rotate-12 text-slate-800" />
      )}
    </button>
  );
}
