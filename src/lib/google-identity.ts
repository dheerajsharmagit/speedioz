export type GoogleIdentity = {
  initialize: (options: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
    auto_select: boolean;
    ux_mode: "popup";
  }) => void;
  renderButton: (
    element: HTMLElement,
    options: {
      type: "standard";
      theme: "outline";
      size: "large";
      text: "continue_with";
      shape: "pill";
      width: string;
      logo_alignment: "left";
    },
  ) => void;
};

function identity() {
  // Google Maps also uses window.google; do not overwrite its namespace.
  return (window as unknown as { google?: { accounts?: { id?: GoogleIdentity } } }).google?.accounts
    ?.id;
}

const SCRIPT_ID = "rideher-google-identity";
let pending: Promise<GoogleIdentity> | null = null;

export function loadGoogleIdentity(): Promise<GoogleIdentity> {
  if (typeof window === "undefined")
    return Promise.reject(new Error("Google sign-in is available in the browser."));
  const ready = identity();
  if (ready) return Promise.resolve(ready);
  if (pending) return pending;
  pending = new Promise<GoogleIdentity>((resolve, reject) => {
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const owned = !script;
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
    }
    const node = script;
    const cleanup = () => {
      clearTimeout(timer);
      node.removeEventListener("load", loaded);
      node.removeEventListener("error", failed);
    };
    const failed = () => {
      cleanup();
      if (node.id === SCRIPT_ID) node.remove();
      reject(new Error("Google sign-in could not load. Check your connection and retry."));
    };
    const loaded = () => {
      const client = identity();
      if (!client) {
        failed();
        return;
      }
      cleanup();
      resolve(client);
    };
    const timer = setTimeout(failed, 15000);
    node.addEventListener("load", loaded, { once: true });
    node.addEventListener("error", failed, { once: true });
    if (owned) document.head.appendChild(node);
  }).catch((error) => {
    pending = null;
    throw error;
  });
  return pending;
}
