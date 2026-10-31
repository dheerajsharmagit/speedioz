import { Link, useRouterState } from "@tanstack/react-router";
import { storage, authApi } from "@/lib/api";
import { useState, useEffect } from "react";
import {
  Home,
  Bike,
  Users,
  User,
  MoreHorizontal,
  Settings,
  LogOut,
  LogIn,
  ShieldCheck,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/ride", label: "Ride", icon: Bike },
  { to: "/routes", label: "Community", icon: Users },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function RoleNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [user, setUser] = useState(storage.getUser());
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setUser(storage.getUser()), 1000);
    return () => clearInterval(interval);
  }, []);

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      window.location.href = "/";
    }
  };

  return (
    <>
      {/* spacer so page content never hides behind the bar */}
      <div aria-hidden className="h-24" />

      <nav
        aria-label="Main menu"
        className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2"
      >
        <div className="mx-auto flex max-w-[480px] items-stretch gap-1 rounded-[26px] border border-border/70 bg-card/85 p-1.5 shadow-[0_10px_40px_-12px_hsl(var(--primary)/0.45)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/70">
          {TABS.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex flex-1 flex-col items-center justify-center gap-1 rounded-[20px] px-1 py-2 transition-all duration-200 active:scale-95",
                  active
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200",
                    active ? "bg-primary text-primary-foreground shadow-md" : "bg-transparent",
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 1.9} />
                </span>
                <span className="text-[10px] font-semibold tracking-tight">{label}</span>
              </Link>
            );
          })}

          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger
              className={cn(
                "flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-[20px] px-1 py-2 transition-all duration-200 active:scale-95",
                moreOpen
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
              aria-label="More options"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full">
                <MoreHorizontal className="h-[18px] w-[18px]" strokeWidth={1.9} />
              </span>
              <span className="text-[10px] font-semibold tracking-tight">More</span>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="mx-auto max-w-[480px] rounded-t-[28px] border-border/70 pb-[max(env(safe-area-inset-bottom),1.25rem)]"
            >
              <SheetHeader className="text-left">
                <SheetTitle className="text-base">
                  {user?.name ? `Hi, ${user.name.split(" ")[0]}` : "Menu"}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-1.5">
                {user?.role === "CAPTAIN" && (
                  <Link
                    to="/captain"
                    onClick={() => setMoreOpen(false)}
                    className="block rounded-2xl bg-muted p-4 text-sm font-semibold"
                  >
                    Captain portal
                  </Link>
                )}
                {user?.role === "ADMIN" && (
                  <Link
                    to="/admin"
                    onClick={() => setMoreOpen(false)}
                    className="block rounded-2xl bg-muted p-4 text-sm font-semibold"
                  >
                    Operations
                  </Link>
                )}

                <Link
                  to="/settings"
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-3 rounded-2xl bg-muted/50 px-4 py-3.5 text-sm font-semibold transition active:scale-[0.98]"
                >
                  <Settings className="h-5 w-5 text-primary" />
                  Settings & appearance
                </Link>
                <Link
                  to="/profile"
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-3 rounded-2xl bg-muted/50 px-4 py-3.5 text-sm font-semibold transition active:scale-[0.98]"
                >
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Safety & profile
                </Link>
                {user ? (
                  <button
                    onClick={logout}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-destructive/10 px-4 py-3.5 text-left text-sm font-semibold text-destructive transition active:scale-[0.98]"
                  >
                    <LogOut className="h-5 w-5" />
                    Log out
                  </button>
                ) : (
                  <Link
                    to="/auth"
                    search={{ mode: "signin" }}
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-3 rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground transition active:scale-[0.98]"
                  >
                    <LogIn className="h-5 w-5" />
                    Sign in
                  </Link>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </>
  );
}
