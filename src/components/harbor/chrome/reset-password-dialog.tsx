// Reset-password dialog — opened via the global "harbor:reset-password"
// CustomEvent (dispatched by app-shell when the URL carries #reset=<token>
// from a password-reset email). Single-use token consumed by
// POST /api/auth/reset-password; success signs out all other devices.
"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/hooks/use-t";
import { useHorseAccount } from "@/lib/harbor/horse-account";

export function ResetPasswordDialog() {
  const t = useT();
  const { toast } = useToast();
  const resetAction = useHorseAccount((s) => s.resetPassword);
  const busy = useHorseAccount((s) => s.busy);
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    const h = (e: Event) => {
      setToken((e as CustomEvent<string>).detail ?? "");
      setOpen(true);
    };
    window.addEventListener("harbor:reset-password", h);
    return () => window.removeEventListener("harbor:reset-password", h);
  }, []);

  const submit = async () => {
    if (password.length < 10) {
      toast({ title: t("accountErrPasswordShort"), variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: t("accountErrPasswordMismatch"), variant: "destructive" });
      return;
    }
    const res = await resetAction(token, password);
    if (res.ok) {
      setOpen(false);
      setPassword("");
      setConfirm("");
      toast({ title: t("accountResetDone") });
    } else {
      toast({ title: res.error ?? t("accountResetInvalid"), variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="md-dialog max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-start">
            <KeyRound className="w-4 h-4 text-accent" />
            {t("accountResetTitle")}
          </DialogTitle>
          <DialogDescription className="text-start">{t("accountResetDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div>
            <label htmlFor="reset-pw" className="md-label-medium text-ink-muted mb-1 block">{t("passwordNew")}</label>
            <input
              id="reset-pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="md-field-outlined w-full px-3 min-h-11 text-sm text-ink"
              autoComplete="new-password"
              maxLength={128}
            />
          </div>
          <div>
            <label htmlFor="reset-pw-confirm" className="md-label-medium text-ink-muted mb-1 block">{t("passwordConfirm")}</label>
            <input
              id="reset-pw-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
              className="md-field-outlined w-full px-3 min-h-11 text-sm text-ink"
              autoComplete="new-password"
              maxLength={128}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" className="min-h-11" onClick={() => setOpen(false)}>{t("accountCancel")}</Button>
          <Button className="min-h-11 md-btn-filled" disabled={busy || password.length < 10} onClick={() => void submit()}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("accountResetBtn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
