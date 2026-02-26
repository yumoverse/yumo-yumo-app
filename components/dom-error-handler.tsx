"use client";

import { useEffect } from "react";

/**
 * Client-side component to handle DOM errors from Google Translate and other browser extensions
 */
export function DOMErrorHandler() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return () => {}; // Return empty cleanup function for consistency
    }

    // Helper to check if error is DOM-related
    const isDOMError = (error: Error | any): boolean => {
      if (!error) return false;
      const name = error.name || "";
      const message = error.message || "";
      return (
        name === "NotFoundError" ||
        message.includes("removeChild") ||
        message.includes("insertBefore") ||
        message.includes("appendChild") ||
        message.includes("not a child of this node") ||
        message.includes("Failed to execute 'removeChild'") ||
        message.includes("Failed to execute 'insertBefore'") ||
        message.includes("Failed to execute 'appendChild'")
      );
    };

    // Setup global error handlers
    const handleError = (event: ErrorEvent) => {
      const error = event.error || new Error(event.message);
      
      if (isDOMError(error)) {
        // Prevent error from propagating and breaking the app
        event.preventDefault();
        event.stopPropagation();
        // Log as warning instead of error
        console.warn(
          "[DOM Error Handler] Caught DOM manipulation error (likely from Google Translate or browser extension):",
          error.message
        );
        return false;
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      
      if (error instanceof Error && isDOMError(error)) {
        // Prevent error from propagating
        event.preventDefault();
        event.stopPropagation();
        console.warn(
          "[DOM Error Handler] Caught DOM manipulation promise rejection (likely from Google Translate or browser extension):",
          error.message
        );
      }
    };

    // Override React's error reporting for DOM errors
    // This catches errors during React's commit phase
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      // Check if any argument is a DOM error
      const hasDOMError = args.some((arg) => {
        if (arg instanceof Error) {
          return isDOMError(arg);
        }
        if (typeof arg === "string") {
          return isDOMError({ message: arg });
        }
        return false;
      });

      if (hasDOMError) {
        // Convert to warning instead of error
        console.warn(
          "[DOM Error Handler] Intercepted React DOM error (likely from Google Translate):",
          ...args
        );
        return;
      }

      // Call original console.error for non-DOM errors
      originalConsoleError.apply(console, args);
    };

    // Override React's onRecoverableError if available
    if (typeof window !== "undefined" && (window as any).React?.onRecoverableError) {
      const originalOnRecoverableError = (window as any).React.onRecoverableError;
      (window as any).React.onRecoverableError = (error: Error, errorInfo: any) => {
        if (isDOMError(error)) {
          console.warn(
            "[DOM Error Handler] Intercepted React recoverable error (likely from Google Translate):",
            error.message
          );
          return;
        }
        originalOnRecoverableError?.(error, errorInfo);
      };
    }

    // Add event listeners
    window.addEventListener("error", handleError, true); // Use capture phase
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    // Cleanup
    return () => {
      window.removeEventListener("error", handleError, true);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      console.error = originalConsoleError; // Restore original
    };
  }, []);

  return null; // This component doesn't render anything
}

