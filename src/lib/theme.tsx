import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Intensity = "soft" | "balanced" | "vibrant";
export type Mode = "light" | "dark";

type ThemeState = {
  intensity: Intensity;
  mode: Mode;
  setIntensity: (i: Intensity) => void;
  setMode: (m: Mode) => void;
  markers: MarkerPalette;
  /** Bumps every time theme changes so subscribers (e.g. map markers) can react. */
  version: number;
};

export type MarkerPalette = {
  pickupFill: string;
  pickupStroke: string;
  dropFill: string;
  dropStroke: string;
  routeStroke: string;
  routeTraveled: string;
  captainFill: string;
  captainStroke: string;
  userFill: string;
};

const PALETTES: Record<Mode, Record<Intensity, MarkerPalette>> = {
  light: {
    soft: {
      pickupFill: "#F9A8D4", pickupStroke: "#831843",
      dropFill: "#831843", dropStroke: "#F9A8D4",
      routeStroke: "#831843", routeTraveled: "#E5D4DE",
      captainFill: "#4ADE80", captainStroke: "#052e16",
      userFill: "#3b82f6",
    },
    balanced: {
      pickupFill: "#EC4899", pickupStroke: "#4A0E2A",
      dropFill: "#4A0E2A", dropStroke: "#EC4899",
      routeStroke: "#4A0E2A", routeTraveled: "#D8B4C7",
      captainFill: "#22c55e", captainStroke: "#052e16",
      userFill: "#3b82f6",
    },
    vibrant: {
      pickupFill: "#DB2777", pickupStroke: "#1F0511",
      dropFill: "#1F0511", dropStroke: "#DB2777",
      routeStroke: "#1F0511", routeTraveled: "#C99BB2",
      captainFill: "#16a34a", captainStroke: "#052e16",
      userFill: "#2563eb",
    },
  },
  dark: {
    soft: {
      pickupFill: "#F9A8D4", pickupStroke: "#FCE7F3",
      dropFill: "#FCE7F3", dropStroke: "#F9A8D4",
      routeStroke: "#FCE7F3", routeTraveled: "#6B4759",
      captainFill: "#4ADE80", captainStroke: "#052e16",
      userFill: "#60A5FA",
    },
    balanced: {
      pickupFill: "#F472B6", pickupStroke: "#FCE7F3",
      dropFill: "#FCE7F3", dropStroke: "#F472B6",
      routeStroke: "#FCE7F3", routeTraveled: "#7A4E63",
      captainFill: "#4ADE80", captainStroke: "#052e16",
      userFill: "#60A5FA",
    },
    vibrant: {
      pickupFill: "#EC4899", pickupStroke: "#FDF2F8",
      dropFill: "#FDF2F8", dropStroke: "#EC4899",
      routeStroke: "#FDF2F8", routeTraveled: "#8A4E68",
      captainFill: "#22c55e", captainStroke: "#052e16",
      userFill: "#3b82f6",
    },
  },
};

const KEY_INTENSITY = "rc.theme.intensity";
const KEY_MODE = "rc.theme.mode";

const ThemeCtx = createContext<ThemeState | null>(null);

function applyToRoot(intensity: Intensity, mode: Mode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-intensity", intensity);
  root.classList.toggle("dark", mode === "dark");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [intensity, setIntensityState] = useState<Intensity>("balanced");
  const [mode, setModeState] = useState<Mode>("light");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    try {
      const i = (localStorage.getItem(KEY_INTENSITY) as Intensity | null) ?? "balanced";
      const m = (localStorage.getItem(KEY_MODE) as Mode | null) ?? "light";
      setIntensityState(i);
      setModeState(m);
      applyToRoot(i, m);
      setVersion((v) => v + 1);
    } catch {
      applyToRoot("balanced", "light");
    }
  }, []);

  const setIntensity = (i: Intensity) => {
    setIntensityState(i);
    try { localStorage.setItem(KEY_INTENSITY, i); } catch { /* noop */ }
    applyToRoot(i, mode);
    setVersion((v) => v + 1);
  };
  const setMode = (m: Mode) => {
    setModeState(m);
    try { localStorage.setItem(KEY_MODE, m); } catch { /* noop */ }
    applyToRoot(intensity, m);
    setVersion((v) => v + 1);
  };

  const value = useMemo<ThemeState>(() => ({
    intensity, mode, setIntensity, setMode,
    markers: PALETTES[mode][intensity],
    version,
  }), [intensity, mode, version]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeCtx);
  if (ctx) return ctx;
  // Fallback for components rendered outside provider (SSR head, etc.)
  return {
    intensity: "balanced",
    mode: "light",
    setIntensity: () => {},
    setMode: () => {},
    markers: PALETTES.light.balanced,
    version: 0,
  };
}
