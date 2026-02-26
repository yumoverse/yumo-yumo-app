"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/app/app-shell";
import { ThemeCard } from "@/components/app/theme-card";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, User, Lock, Save, Loader2, Wallet, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAppLocale } from "@/lib/i18n/app-context";
import { useAppProfile } from "@/lib/app/profile-context";
import { INCOME_BAND_KEYS } from "@/config/income-bands";
import { tokens } from "@/lib/design-tokens";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { useSound } from "@/lib/audio/sound-context";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Volume2 } from "lucide-react";

export default function SettingsPage() {
  const { t } = useAppLocale();
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const { profile: ctxProfile, refresh: refreshProfile } = useAppProfile();
  const { prefs: soundPrefs, setEnabled: setSoundEnabled, setVolume: setSoundVolume } = useSound();
  const accountLevel = ctxProfile?.accountLevel ?? 1;
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState<string>("");
  const [birthDate, setBirthDate] = useState<Date | undefined>(undefined);
  const [occupation, setOccupation] = useState("");
  const [incomeBand, setIncomeBand] = useState<string>("");
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

  useEffect(() => {
    const sessionCookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith("app_session="));
    const username = sessionCookie?.split("=")[1];

    if (ctxProfile) {
      if (ctxProfile.displayName) setDisplayName(ctxProfile.displayName);
      if (ctxProfile.gender) setGender(ctxProfile.gender);
      if (ctxProfile.birthDate) setBirthDate(new Date(ctxProfile.birthDate));
      if (ctxProfile.occupation) setOccupation(ctxProfile.occupation);
      if (ctxProfile.declaredMonthlyIncomeBand) setIncomeBand(ctxProfile.declaredMonthlyIncomeBand);
    }

    if (!username) return;

    const savedDisplayName = localStorage.getItem(`displayName_${username}`);
    const savedGender = localStorage.getItem(`gender_${username}`);
    const savedBirthDate = localStorage.getItem(`birthDate_${username}`);

    if (savedDisplayName && !ctxProfile?.displayName) setDisplayName(savedDisplayName);
    else if (!ctxProfile?.displayName && !savedDisplayName) {
      // Strip first segment before underscore for display (e.g. "alpha_beta" -> "Beta")
      const parts = username.split("_");
      const displayParts = parts.length > 1 ? parts.slice(1) : parts;
      const defaultDisplayName = displayParts
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
      setDisplayName(defaultDisplayName);
    }
    if (savedGender) setGender(savedGender);
    if (savedBirthDate) setBirthDate(new Date(savedBirthDate));
  }, [ctxProfile?.displayName, ctxProfile?.gender, ctxProfile?.birthDate, ctxProfile?.occupation, ctxProfile?.declaredMonthlyIncomeBand]);

  const handleSaveAccount = async () => {
    setIsSavingAccount(true);
    try {
      const sessionCookie = document.cookie
        .split("; ")
        .find((row) => row.startsWith("app_session="));
      const username = sessionCookie?.split("=")[1];

      if (!username) {
        toast.error(t("settings.error.login"));
        return;
      }
      if (!displayName.trim()) {
        toast.error(t("settings.error.displayNameRequired"));
        return;
      }

      const response = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          gender: gender || null,
          birthDate: birthDate ? birthDate.toISOString() : null,
          occupation: occupation.trim() || null,
          declaredMonthlyIncomeBand: incomeBand || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t("settings.error.saveProfile"));
      }

      localStorage.setItem(`displayName_${username}`, displayName);
      if (gender) localStorage.setItem(`gender_${username}`, gender);
      if (birthDate) localStorage.setItem(`birthDate_${username}`, birthDate.toISOString());

      refreshProfile();
      window.dispatchEvent(new CustomEvent("displayNameUpdated", { detail: { displayName } }));
      toast.success(t("settings.saved"));
    } catch (error: unknown) {
      console.error("Failed to save account:", error);
      toast.error((error as Error).message || t("settings.error.saveAccount"));
    } finally {
      setIsSavingAccount(false);
    }
  };

  const handleChangePassword = async () => {
    setIsChangingPassword(true);
    try {
      const sessionCookie = document.cookie
        .split("; ")
        .find((row) => row.startsWith("app_session="));
      const username = sessionCookie?.split("=")[1];

      if (!username) {
        toast.error(t("settings.error.login"));
        return;
      }
      if (!currentPassword || !newPassword || !confirmPassword) {
        toast.error(t("settings.error.allFieldsRequired"));
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error(t("settings.error.passwordsNotMatch"));
        return;
      }
      if (newPassword.length < 8) {
        toast.error(t("settings.error.passwordLength"));
        return;
      }

      const response = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t("settings.error.changePassword"));
      }

      toast.success(t("settings.passwordChanged"));
      setIsPasswordDialogOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Failed to change password:", error);
      toast.error(t("settings.error.changePassword"));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const inputClass = "bg-[var(--app-bg-elevated)] border-[var(--app-border)] text-[var(--app-text-primary)] placeholder:text-[var(--app-text-muted)] focus-visible:ring-primary";
  const labelClass = "text-[var(--app-text-secondary)] text-sm";

  return (
    <AppShell>
      <div className="max-w-2xl">
        <h2
          className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-6"
          style={{ fontSize: tokens.fontSize.label, color: "var(--app-text-muted)" }}
        >
          {t("settings.title")}
        </h2>

        <div className="space-y-6">
          {/* Appearance / Theme */}
          <ThemeCard accountLevel={accountLevel}>
            <div className="p-4 sm:p-5">
              <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--app-text-primary)" }}>
                {t("settings.appearance")}
              </h3>
              <p className="text-xs mb-3" style={{ color: "var(--app-text-secondary)" }}>
                {t("settings.appearanceDesc")}
              </p>
              <ThemeToggle showLabel />
            </div>
          </ThemeCard>

          {/* Sound */}
          <ThemeCard accountLevel={accountLevel}>
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4" style={{ color: "var(--app-text-muted)" }} />
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: "var(--app-text-primary)" }}>
                      {t("settings.sound")}
                    </h3>
                    <p className="text-xs" style={{ color: "var(--app-text-muted)" }}>
                      {t("settings.soundDesc")}
                    </p>
                  </div>
                </div>
                <Switch checked={soundPrefs.enabled} onCheckedChange={setSoundEnabled} aria-label={t("settings.sound")} />
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <Label className={labelClass}>{t("settings.sound.volume")}</Label>
                  <span className="text-xs font-mono tabular-nums" style={{ color: "var(--app-text-secondary)" }}>
                    {Math.round(soundPrefs.volume * 100)}%
                  </span>
                </div>
                <Slider
                  value={[soundPrefs.volume]}
                  onValueChange={(v) => setSoundVolume(v?.[0] ?? 0)}
                  min={0}
                  max={1}
                  step={0.05}
                  disabled={!soundPrefs.enabled}
                />
              </div>
            </div>
          </ThemeCard>

          {/* Account + Profile & income (single card) */}
          <ThemeCard accountLevel={accountLevel}>
            <div className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <User className="h-4 w-4" style={{ color: "var(--app-text-muted)" }} />
                <h3 className="text-sm font-semibold" style={{ color: "var(--app-text-primary)" }}>{t("settings.account")}</h3>
              </div>
              <p className="text-xs -mt-2" style={{ color: "var(--app-text-muted)" }}>{t("settings.accountDesc")}</p>

              <div className="space-y-2">
                <Label htmlFor="displayName" className={labelClass}>{t("settings.displayName")}</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t("settings.displayNamePlaceholder")}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender" className={labelClass}>{t("settings.gender")}</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger id="gender" className={inputClass}>
                    <SelectValue placeholder={t("settings.genderPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{t("settings.gender.male")}</SelectItem>
                    <SelectItem value="female">{t("settings.gender.female")}</SelectItem>
                    <SelectItem value="non-binary">{t("settings.gender.nonBinary")}</SelectItem>
                    <SelectItem value="other">{t("settings.gender.other")}</SelectItem>
                    <SelectItem value="prefer-not-to-say">{t("settings.gender.preferNotToSay")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className={labelClass}>{t("settings.birthDate")}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal hover:opacity-90", !birthDate && "opacity-70")}
                      style={{ borderColor: "var(--app-border)", background: "var(--app-bg-elevated)", color: "var(--app-text-primary)" }}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {birthDate ? format(birthDate, "PPP") : t("settings.birthDatePlaceholder")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-white/10 bg-[var(--card)]" align="start">
                    <Calendar
                      mode="single"
                      selected={birthDate}
                      onSelect={setBirthDate}
                      initialFocus
                      captionLayout="dropdown"
                      fromYear={1900}
                      toYear={new Date().getFullYear()}
                      defaultMonth={birthDate || new Date(2000, 0)}
                      disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="occupation" className={labelClass}>{t("settings.occupation")}</Label>
                <Input
                  id="occupation"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  placeholder={t("settings.occupationPlaceholder")}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="incomeBand" className={labelClass}>{t("settings.monthlyIncome")}</Label>
                <Select value={incomeBand || undefined} onValueChange={setIncomeBand}>
                  <SelectTrigger id="incomeBand" className={inputClass}>
                    <SelectValue placeholder={t("settings.monthlyIncomePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {INCOME_BAND_KEYS.map((key) => (
                      <SelectItem key={key} value={key}>
                        {t(`settings.incomeBand.${key}` as "settings.incomeBand.under_30")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className={labelClass}>{t("settings.password")}</Label>
                <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full hover:opacity-90" style={{ borderColor: "var(--app-border)", background: "var(--app-bg-elevated)", color: "var(--app-text-primary)" }}>
                      <Lock className="mr-2 h-4 w-4" />
                      {t("settings.changePassword")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-[var(--card)]" style={{ borderColor: "var(--app-border)", color: "var(--app-text-primary)" }}>
                    <DialogHeader>
                      <DialogTitle>{t("settings.changePassword")}</DialogTitle>
                      <DialogDescription style={{ color: "var(--app-text-secondary)" }}>
                        {t("settings.passwordDesc")}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label htmlFor="currentPassword" className={labelClass}>{t("settings.currentPassword")}</Label>
                        <Input
                          id="currentPassword"
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder={t("settings.currentPasswordPlaceholder")}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <Label htmlFor="newPassword" className={labelClass}>{t("settings.newPassword")}</Label>
                        <Input
                          id="newPassword"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder={t("settings.newPasswordPlaceholder")}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <Label htmlFor="confirmPassword" className={labelClass}>{t("settings.confirmPassword")}</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder={t("settings.confirmPasswordPlaceholder")}
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)} style={{ borderColor: "var(--app-border)", color: "var(--app-text-primary)" }}>
                        {t("settings.cancel")}
                      </Button>
                      <Button onClick={handleChangePassword} disabled={isChangingPassword}>
                        {isChangingPassword ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t("settings.changing")}
                          </>
                        ) : (
                          t("settings.changePassword")
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <Button
                onClick={handleSaveAccount}
                disabled={isSavingAccount}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isSavingAccount ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("settings.saving")}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {t("settings.save")}
                  </>
                )}
              </Button>
            </div>
          </ThemeCard>

          {/* Wallet */}
          <ThemeCard accountLevel={accountLevel}>
            <div className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="h-4 w-4" style={{ color: "var(--app-text-muted)" }} />
                <h3 className="text-sm font-semibold" style={{ color: "var(--app-text-primary)" }}>{t("settings.wallet")}</h3>
              </div>
              <p className="text-xs -mt-2" style={{ color: "var(--app-text-muted)" }}>{t("settings.walletDesc")}</p>
              {connected && publicKey ? (
                <div className="space-y-2">
                  <Label className={labelClass}>{t("settings.connectedAddress")}</Label>
                  <Input
                    value={publicKey.toString()}
                    readOnly
                    className={cn("font-mono text-sm", inputClass)}
                  />
                </div>
              ) : (
                <WalletConnectButton />
              )}
            </div>
          </ThemeCard>

          {/* Çıkış yap */}
          <Button
            variant="outline"
            className="w-full border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
            disabled={isLoggingOut}
            onClick={async () => {
              setIsLoggingOut(true);
              try {
                await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
                router.replace("/app/login");
              } finally {
                setIsLoggingOut(false);
              }
            }}
          >
            {isLoggingOut ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="mr-2 h-4 w-4" />
            )}
            {t("topbar.logout")}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
