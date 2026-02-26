"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { getCountriesSorted } from "@/lib/shared/countries";
import { useAppLocale } from "@/lib/i18n/app-context";
import { translateApiError } from "@/lib/i18n/app-context";

const countries = getCountriesSorted();

export default function LoginPage() {
  const { t } = useAppLocale();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState<string>("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Persist form values to localStorage to prevent loss from Google Translate
  useEffect(() => {
    // Restore from localStorage on mount
    const savedUsername = localStorage.getItem("login_username");
    const savedPassword = localStorage.getItem("login_password");
    const savedCountry = localStorage.getItem("login_country");
    
    if (savedUsername) setUsername(savedUsername);
    if (savedPassword) setPassword(savedPassword);
    if (savedCountry) setCountry(savedCountry);
  }, []);

  // Save form values to localStorage on change
  useEffect(() => {
    if (username) {
      localStorage.setItem("login_username", username);
    } else {
      localStorage.removeItem("login_username");
    }
  }, [username]);

  useEffect(() => {
    if (password) {
      localStorage.setItem("login_password", password);
    } else {
      localStorage.removeItem("login_password");
    }
  }, [password]);

  useEffect(() => {
    if (country) {
      localStorage.setItem("login_country", country);
    } else {
      localStorage.removeItem("login_country");
    }
  }, [country]);

  // Clear localStorage on successful login
  const clearFormStorage = () => {
    localStorage.removeItem("login_username");
    localStorage.removeItem("login_password");
    localStorage.removeItem("login_country");
  };

  // Handle DOM errors from Google Translate (separate effect, no dependencies)
  useEffect(() => {
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
        message.includes("commitDeletionEffectsOnFiber")
      );
    };

    const handleDOMError = (event: ErrorEvent) => {
      const error = event.error || new Error(event.message);
      
      if (isDOMError(error)) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
    };

    // Override console.error to catch React's commit phase errors
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
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
        return;
      }

      originalConsoleError.apply(console, args);
    };

    window.addEventListener("error", handleDOMError, true);
    
    return () => {
      window.removeEventListener("error", handleDOMError, true);
      console.error = originalConsoleError;
    };
  }, []); // No dependencies - only run once

  // Separate effect for form value restoration (use refs to avoid hook dependency issues)
  useEffect(() => {
    // Store current values in refs to avoid closure issues
    const valueRefs = { username, password };
    
    // Monitor for Google Translate DOM changes and restore form values
    const observer = new MutationObserver(() => {
      // Update refs from current state
      valueRefs.username = username;
      valueRefs.password = password;
      
      // Use requestAnimationFrame to avoid React render conflicts
      requestAnimationFrame(() => {
        const usernameInput = document.getElementById("username") as HTMLInputElement;
        const passwordInput = document.getElementById("password") as HTMLInputElement;
        
        if (usernameInput && usernameInput.value !== valueRefs.username && valueRefs.username) {
          // Restore value using native setter to trigger React
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value"
          )?.set;
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(usernameInput, valueRefs.username);
            const inputEvent = new Event("input", { bubbles: true });
            usernameInput.dispatchEvent(inputEvent);
          }
        }
        
        if (passwordInput && passwordInput.value !== valueRefs.password && valueRefs.password) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value"
          )?.set;
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(passwordInput, valueRefs.password);
            const inputEvent = new Event("input", { bubbles: true });
            passwordInput.dispatchEvent(inputEvent);
          }
        }
      });
    });

    // Observe the form container for changes
    const formElement = document.querySelector("form");
    if (formElement) {
      observer.observe(formElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["value"],
      });
    }
    
    return () => {
      observer.disconnect();
    };
  }, [username, password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    console.log("[login] 🚀 Form submitted");
    console.log("[login] Username:", username);
    console.log("[login] Country:", country);
    
    // Validate country selection
    if (!country) {
      console.log("[login] ❌ Country not selected");
      setError(t("errors.login.selectCountryFirst"));
      return;
    }

    setIsLoading(true);
    console.log("[login] 📡 Sending login request...");

    try {
      let response: Response;
      try {
        console.log("[login] Fetching /api/auth/login...");
        response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, password }),
        });
        console.log("[login] Response received - Status:", response.status, response.statusText);
      } catch (fetchError: any) {
        console.error("[login] ❌ Fetch error:", fetchError);
        // Network error (no internet connection)
        if (fetchError.message?.includes("Failed to fetch") || fetchError.name === "TypeError") {
          setError(t("errors.login.noInternet"));
          setIsLoading(false);
          return;
        }
        throw fetchError;
      }

      let data: any;
      try {
        data = await response.json();
        console.log("[login] Response data:", data);
        console.log("[login] Username from response:", data.username);
      } catch (parseError) {
        console.error("[login] ❌ JSON parse error:", parseError);
        setError(t("errors.login.invalidServerResponse"));
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        console.log("[login] ❌ Login failed - Status:", response.status, "Error:", data.error);
        setError(translateApiError(data.error, t) || t("errors.login.invalidCredentials"));
        setIsLoading(false);
        return;
      }

      // Save country in background (do not block redirect)
      if (country) {
        localStorage.setItem(`user_country_${username}`, country);
        fetch("/api/auth/country", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, country }),
        }).catch(() => {});
      }

      clearFormStorage();

      window.location.href = "/app";
    } catch (err: any) {
      // Check if it's a network error
      if (err?.message?.includes("Failed to fetch") || err?.name === "TypeError") {
        setError(t("errors.login.noInternet"));
      } else {
        setError(t("errors.login.errorOccurred"));
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" suppressHydrationWarning>
      <Card className="w-full max-w-md" suppressHydrationWarning>
        <CardHeader className="space-y-1" suppressHydrationWarning>
          <CardTitle className="text-2xl font-bold text-center" suppressHydrationWarning>
            Panel Access
          </CardTitle>
          <CardDescription className="text-center" suppressHydrationWarning>
            Enter your credentials to access the panel
          </CardDescription>
        </CardHeader>
        <CardContent suppressHydrationWarning>
          <form 
            onSubmit={handleSubmit} 
            className="space-y-4" 
            suppressHydrationWarning
            data-notranslate="true"
          >
            <div className="space-y-2" suppressHydrationWarning>
              <Label htmlFor="username" suppressHydrationWarning>Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setUsername(newValue);
                  // Also update localStorage immediately
                  if (newValue) {
                    localStorage.setItem("login_username", newValue);
                  } else {
                    localStorage.removeItem("login_username");
                  }
                }}
                onBlur={(e) => {
                  // Ensure value is preserved on blur
                  if (e.target.value !== username && username) {
                    e.target.value = username;
                  }
                }}
                required
                disabled={isLoading}
                suppressHydrationWarning
                autoComplete="username"
                data-notranslate="true"
              />
            </div>
            <div className="space-y-2" suppressHydrationWarning>
              <Label htmlFor="password" suppressHydrationWarning>Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setPassword(newValue);
                  // Also update localStorage immediately
                  if (newValue) {
                    localStorage.setItem("login_password", newValue);
                  } else {
                    localStorage.removeItem("login_password");
                  }
                }}
                onBlur={(e) => {
                  // Ensure value is preserved on blur
                  if (e.target.value !== password && password) {
                    e.target.value = password;
                  }
                }}
                required
                disabled={isLoading}
                suppressHydrationWarning
                autoComplete="current-password"
                data-notranslate="true"
              />
            </div>
            <div className="space-y-2" suppressHydrationWarning>
              <Label htmlFor="country" suppressHydrationWarning>Country <span className="text-red-500">*</span></Label>
              <Select
                value={country}
                onValueChange={(value) => {
                  setCountry(value);
                  // Also update localStorage immediately
                  if (value) {
                    localStorage.setItem("login_country", value);
                  } else {
                    localStorage.removeItem("login_country");
                  }
                }}
                required
                disabled={isLoading}
                // Disable Google Translate on Select component
                data-notranslate="true"
              >
                <SelectTrigger 
                  id="country" 
                  suppressHydrationWarning
                  data-notranslate="true"
                >
                  <SelectValue 
                    placeholder="Select your country" 
                    suppressHydrationWarning
                    data-notranslate="true"
                  />
                </SelectTrigger>
                <SelectContent 
                  suppressHydrationWarning
                  data-notranslate="true"
                >
                  {countries.map((c) => (
                    <SelectItem 
                      key={c.code} 
                      value={c.code} 
                      suppressHydrationWarning
                      data-notranslate="true"
                    >
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                Please select your country to continue. You can change this later in settings.
              </p>
            </div>
            {error && (
              <div className="bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg" suppressHydrationWarning>
                {error}
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              suppressHydrationWarning
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

