import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { KeyRound, MailCheck, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/utils";

/* ---------------------------- Forgot password -------------------------- */
export function ForgotPasswordPage() {
  const { requestPasswordReset, configured } = useAuth();
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Please enter a valid email address.");
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(friendlyError(err, "We couldn't send the reset link. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a secure link to choose a new password."
      footer={
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Back to login
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-3xl glass p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary">
            <MailCheck className="h-6 w-6" />
          </div>
          <p className="mt-5 text-sm text-muted-foreground leading-relaxed">
            If an account exists for <span className="font-semibold text-foreground">{email}</span>, a reset link is
            on its way. Open it on this device to continue.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5" noValidate>
          <FormField label="Email" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormField>
          {error && (
            <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!configured}>
            <KeyRound /> Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

/* ----------------------------- Reset password -------------------------- */
export function ResetPasswordPage() {
  const { updatePassword, configured } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [ready, setReady] = React.useState<boolean | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!configured) {
      setReady(false);
      return;
    }
    let active = true;
    // Supabase exchanges the recovery code from the URL and emits PASSWORD_RECOVERY / SIGNED_IN.
    supabase.auth.getSession().then(({ data }) => active && setReady(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    const timeout = setTimeout(() => active && setReady((r) => (r === null ? false : r)), 4000);
    return () => {
      active = false;
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [configured]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Your password should be at least 8 characters.");
    if (password !== confirm) return setError("The passwords don't match.");
    setLoading(true);
    try {
      await updatePassword(password);
      toast.success("Password updated. You're all set.");
      navigate("/studio", { replace: true });
    } catch (err) {
      setError(friendlyError(err, "We couldn't update your password. Request a new link and try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Choose a new password" subtitle="Make it strong and memorable.">
      {ready === false ? (
        <div className="rounded-3xl glass p-8 text-center">
          <p className="text-sm text-muted-foreground leading-relaxed">
            This reset link is invalid or has expired. Please request a new one.
          </p>
          <Button asChild className="mt-6 w-full">
            <Link to="/forgot-password">Request a new link</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5" noValidate>
          <FormField label="New password" htmlFor="password">
            <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </FormField>
          <FormField label="Confirm password" htmlFor="confirm">
            <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </FormField>
          {error && (
            <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" loading={loading || ready === null} disabled={!configured}>
            <ShieldCheck /> Update password
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
