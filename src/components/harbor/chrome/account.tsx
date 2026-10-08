"use client";

// Harbor Web — Stremio account: auth modal + sidebar user chip + cloud sync
import { useEffect, useState } from "react";
import {
  LogIn, LogOut, RefreshCw, User, CloudDownload, Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/harbor/auth";
import { useCloudSync } from "@/lib/harbor/cloud-sync";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setError(null);
        setPassword("");
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  const submit = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    const res = await login(email.trim(), password);
    setBusy(false);
    if (res.ok) {
      toast({ title: "Signed in to Stremio", description: "Syncing your addons and library…" });
      onClose();
      const sync = await useAuth.getState().syncAll();
      if ("addonsMerged" in sync) {
        toast({
          title: "Sync complete",
          description: `${sync.addonsMerged} addons merged · ${sync.libraryPulled} library items pulled`,
        });
      }
      // Cloud sync now keys under the Stremio account — pull this account's bucket
      void useCloudSync.getState().boot();
    } else {
      setError(res.error ?? "Login failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="md-dialog max-w-sm">
        <DialogHeader>
          <DialogTitle className="md-title-large font-display flex items-center gap-2">
            <User className="w-5 h-5 text-accent" /> Sign in to Stremio
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <p className="md-body-small text-ink-muted leading-relaxed">
            Your credentials go only to Stremio&apos;s official API through our server-side proxy —
            they are never stored or logged. Syncing imports your addons, watchlist and continue
            watching.
          </p>
          <div>
            <label htmlFor="auth-email" className="md-label-medium text-ink-muted mb-1 block">Email</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="md-field-outlined w-full px-3 py-2.5 text-sm text-ink"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="md-label-medium text-ink-muted mb-1 block">Password</label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="md-field-outlined w-full px-3 py-2.5 text-sm text-ink"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p role="alert" className="rounded-[var(--md-sys-shape-corner-small)] bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)] md-body-small px-3 py-2">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={busy || !email.trim() || !password}
            className="md-btn-filled w-full disabled:opacity-50"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? "Signing in…" : "Sign in & sync"}
          </button>
          <p className="md-label-small text-ink-subtle text-center">
            Not affiliated with Stremio. You can also use Horse without an account.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function UserChip({ variant = "sidebar" }: { variant?: "sidebar" | "settings" }) {
  const auth = useAuth((s) => s.auth);
  const loaded = useAuth((s) => s.loaded);
  const syncing = useAuth((s) => s.syncing);
  const logout = useAuth((s) => s.logout);
  const syncAll = useAuth((s) => s.syncAll);
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // "settings" variant: compact inline chip for the Settings page header
  // (the sidebar that used to host the default variant was removed).
  const inline = variant === "settings";
  const wrapCls = inline ? "relative" : "relative mx-3 mb-3";

  useEffect(() => {
    if (loaded && auth) {
      // background sync on load
      useAuth.getState().syncAll();
    }
     
  }, [loaded]);

  if (!loaded) return null;

  if (!auth) {
    return (
      <>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={cn(
            inline &&
              "glass-surface glass-hover md-state harbor-tv-focus flex min-h-11 items-center gap-2 rounded-[var(--md-sys-shape-corner-full)] px-3 py-2 md-body-small text-ink-muted hover:!text-ink transition-colors",
            !inline &&
              "glass-surface glass-hover md-state harbor-tv-focus mx-3 mb-3 hidden md:flex items-center gap-2.5 rounded-[var(--md-sys-shape-corner-large)] px-3 py-2.5 md-body-medium text-ink-muted hover:!text-ink transition-colors",
          )}
        >
          <LogIn className="w-4 h-4 shrink-0" />
          {inline ? <span className="truncate">Sign in</span> : <span className="truncate">Sign in to sync</span>}
        </button>
        {!inline && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="glass-surface md-icon-btn md:hidden mx-3 mb-3 !w-12 !h-12 rounded-[var(--md-sys-shape-corner-large)] text-ink-muted"
            aria-label="Sign in to Stremio"
          >
            <LogIn className="w-4 h-4" />
          </button>
        )}
        <AuthModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  const initial = (auth.user.fullname ?? auth.user.email ?? "S").trim().charAt(0).toUpperCase();

  return (
    <div className={wrapCls}>
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className={cn(
          "glass-surface glass-hover md-state harbor-tv-focus flex items-center gap-2.5 rounded-[var(--md-sys-shape-corner-large)] px-2.5 py-2 text-start transition-colors",
          !inline && "w-full",
        )}
        aria-expanded={menuOpen}
        aria-label="Account menu"
      >
        <span className="w-8 h-8 rounded-full bg-accent text-black font-bold flex items-center justify-center shrink-0">
          {auth.user.avatar ? (
             
            <img src={auth.user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            initial
          )}
        </span>
        <span className="hidden md:block min-w-0">
          <span className="harbor-clamp-1 block md-label-medium text-ink">
            {auth.user.fullname ?? auth.user.email ?? "Stremio user"}
          </span>
          <span className="md-label-small text-ink-subtle">Stremio account</span>
        </span>
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden />
          <div
            className={cn(
              "md-dialog absolute z-50 p-2 min-w-[220px]",
              inline ? "top-full mt-2 end-0" : "bottom-full mb-2 inset-x-0",
            )}
            role="menu"
            aria-label="Account actions"
          >
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                setMenuOpen(false);
                const res = await syncAll();
                if ("addonsMerged" in res) {
                  toast({
                    title: "Sync complete",
                    description: `${res.addonsMerged} addons · ${res.libraryPulled} items`,
                  });
                } else {
                  toast({ title: "Sync failed", description: res.error, variant: "destructive" });
                }
              }}
              className={cn(
                "md-state w-full flex items-center gap-2.5 rounded-[var(--md-sys-shape-corner-medium)] px-3 py-2.5 md-body-medium text-ink-muted hover:!text-ink hover:!bg-[var(--md-sys-color-surface-container-highest)] text-start",
                syncing && "opacity-60 pointer-events-none",
              )}
            >
              {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
              Sync now
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                logout();
                toast({ title: "Signed out" });
              }}
              className="md-state w-full flex items-center gap-2.5 rounded-[var(--md-sys-shape-corner-medium)] px-3 py-2.5 md-body-medium text-ink-muted hover:!text-danger hover:!bg-[var(--md-sys-color-surface-container-highest)] text-start"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
