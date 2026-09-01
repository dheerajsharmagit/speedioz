import { Link, useRouterState } from "@tanstack/react-router";
import { storage, authApi } from "@/lib/api";
import { useState, useEffect } from "react";

export function RoleNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [user, setUser] = useState(storage.getUser());

  useEffect(() => {
    // Basic sync
    const interval = setInterval(() => {
      setUser(storage.getUser());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const roles = [
    { to: "/", label: "Home" },
    { to: "/ride", label: "Ride" },
    { to: "/profile", label: "Profile" },
    { to: "/routes", label: "Community" },
    { to: "/settings", label: "Settings" },
    user ? { to: "#logout", label: "Logout", onClick: async () => { await authApi.logout(); window.location.href = "/"; } } : { to: "/auth", label: "Sign in" },
  ] as const;
  return (
    <nav aria-label="Main menu" className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-lg backdrop-blur">
      <div className="mx-auto flex max-w-[430px] items-center justify-around gap-1">
        {roles.map((r: any) => {
          const active = pathname === r.to;
          if (r.onClick) {
            return (
              <button
                key={r.label}
                onClick={r.onClick}
                className="min-w-12 rounded-lg px-2 py-2 font-mono text-[10px] font-semibold uppercase tracking-wider transition text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {r.label}
              </button>
            );
          }
          return (
            <Link
              key={r.to}
              to={r.to}
              className={`min-w-12 rounded-lg px-2 py-2 text-center font-mono text-[10px] font-semibold uppercase tracking-wider transition ${
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
