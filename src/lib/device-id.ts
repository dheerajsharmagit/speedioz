// Persistent per-browser device id so rider/captain sessions have identity without full auth.
const KEY = "rc-device-id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = (crypto.randomUUID?.() ?? `d-${Math.random().toString(36).slice(2)}-${Date.now()}`);
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
