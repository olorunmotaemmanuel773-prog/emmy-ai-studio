import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Eye, EyeOff, MailCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { friendlyError } from "@/lib/utils";

const PERKS = ["All creative tools included", "Unlimited projects & storyboards", "No credits, no subscriptions"];

export default function SignUpPage() {
  const { signUp, configured } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmSent, setConfirmSent] = React.useState(false);

  const strength = passwordStrength(password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (fullName.trim().length < 2) return setError("Please enter your full name.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Please enter a valid email address.");
    if (password.length < 8) return setError("Your password should be at least 8 characters.");
    setLoading(true);
    try {
      const { needsConfirmation } = await signUp(fullName, email, password);
      if (needsConfirmation) {
        setConfirmSent(true);
      } else {
        toast.success("Your studio is ready. Welcome!");
        navigate("/studio", { replace: true });
      }
    } catch (err) {
      setError(friendlyError(err, "We couldn't create your account. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  if (confirmSent) {
    return (
      <AuthLayout title="Check your inbox" subtitle="One more step to unlock your studio.">
        <div className="rounded-3xl border border-border glass p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary">
            <MailCheck className="h-6 w-6" />
          </div>
          <p className="mt-5 text-sm text-muted-foreground leading-relaxed">
            We sent a confirmation link to <span className="font-semibold text-foreground">{email}</span>. Click it
            to activate your account, then log in.
          </p>
          <Button asChild className="mt-6 w-full">
            <Link to="/login">Go to login</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your free account"
      subtitle="Everything in EmmyAI Studio is free. No card, no credits."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <ul className="mb-6 grid gap-2 sm:grid-cols-3">
        {PERKS.map((p) => (
          <li key={p} className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs font-medium">
            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> {p}
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <FormField label="Full name" htmlFor="fullName">
          <Input id="fullName" autoComplete="name" placeholder="Ada Okafor" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </FormField>
        <FormField label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <FormField label="Password" htmlFor="password" hint="At least 8 characters.">
          <div className="relative">
            <Input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {password && (
            <div className="mt-2 flex gap-1" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i < strength.score ? strength.color : "bg-muted"
                  }`}
                />
              ))}
            </div>
          )}
        </FormField>
        {error && (
          <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!configured}>
          <Sparkles /> Start creating for free
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          By signing up you agree to use the studio responsibly and respect others' rights.
        </p>
      </form>
    </AuthLayout>
  );
}

function passwordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw) && pw.length >= 12) score++;
  const color = score <= 1 ? "bg-destructive" : score === 2 ? "bg-amber-500" : score === 3 ? "bg-primary" : "bg-emerald-500";
  return { score, color };
}
