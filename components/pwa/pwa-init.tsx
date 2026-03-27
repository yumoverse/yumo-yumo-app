"use client";

import { useEffect } from "react";
import { toast } from "sonner";

type ServiceWorkerWithWaiting = ServiceWorkerRegistration & {
  waiting?: ServiceWorker | null;
};

export function PwaInit() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let refreshing = false;

    const register = async () => {
      try {
        const registration = (await navigator.serviceWorker.register("/sw.js")) as ServiceWorkerWithWaiting;

        const promptRefresh = () => {
          toast("A new version of Yumo Yumo is ready.", {
            duration: Infinity,
            action: {
              label: "Refresh",
              onClick: () => registration.waiting?.postMessage({ type: "SKIP_WAITING" }),
            },
          });
        };

        if (registration.waiting) {
          promptRefresh();
        }

        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;
          if (!installingWorker) {
            return;
          }

          installingWorker.addEventListener("statechange", () => {
            if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
              promptRefresh();
            }
          });
        });

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshing) {
            return;
          }
          refreshing = true;
          window.location.reload();
        });
      } catch (error) {
        console.warn("[pwa] service worker registration failed", error);
      }
    };

    void register();
  }, []);

  return null;
}
