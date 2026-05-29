"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

interface Props {
  inviteCode: string;
  accessType: string;
  invitePlan: string;
}

export function InviteSignupForm({ inviteCode, accessType, invitePlan }: Props) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          inviteCode,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to create account.");
        return;
      }
      const { error: signInError } = await createClient().auth.signInWithPassword({ email, password });
      if (signInError) {
        toast.error("Account created — please sign in.");
        window.location.assign("/login");
        return;
      }
      toast.success("Welcome to CineFlow!");
      window.location.assign("/welcome");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    setIsLoading(false);
    if (error) {
      toast.error(error.message.includes("Invalid login credentials") ? "Incorrect email or password." : error.message);
      return;
    }
    window.location.assign("/welcome");
  }

  async function handleGoogle() {
    setIsGoogleLoading(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?invite_code=${inviteCode}&access_type=${accessType}&invite_plan=${invitePlan}`,
      },
    });
    if (error) {
      toast.error(error.message);
      setIsGoogleLoading(false);
    }
  }

  const GoogleBtn = (
    <Button
      type="button"
      variant="outline"
      className="w-full gap-2"
      size="lg"
      disabled={isGoogleLoading || isLoading}
      onClick={handleGoogle}
    >
      {isGoogleLoading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/20 border-t-current" />
      ) : (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
      )}
      {isGoogleLoading ? "Redirecting…" : "Continue with Google"}
    </Button>
  );

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex rounded-xl border border-white/10 p-1 gap-1">
        {(["signup", "login"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
              mode === m
                ? "bg-[#d4a853]/15 text-[#d4a853] border border-[#d4a853]/30"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {m === "signup" ? "Create account" : "Already have one"}
          </button>
        ))}
      </div>

      {mode === "signup" ? (
        <form className="space-y-3" onSubmit={handleSignup}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="first-name" className="text-xs">First name</Label>
              <Input id="first-name" placeholder="First name" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last-name" className="text-xs">Last name</Label>
              <Input id="last-name" placeholder="Last name" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">Email</Label>
            <Input id="email" type="email" placeholder="you@studio.com" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs">Password</Label>
            <Input id="password" type="password" placeholder="At least 8 characters" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" variant="gold" className="w-full" size="lg" disabled={isLoading}>
            {isLoading ? "Creating account…" : "Claim your invitation"}
          </Button>
          <div className="relative flex items-center">
            <div className="flex-1 border-t border-border" />
            <span className="mx-3 text-xs text-muted-foreground">or</span>
            <div className="flex-1 border-t border-border" />
          </div>
          {GoogleBtn}
          <p className="text-center text-[10px] text-muted-foreground">
            By signing up you agree to our{" "}
            <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">Terms</Link>
            {" "}and{" "}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">Privacy Policy</Link>.
          </p>
        </form>
      ) : (
        <form className="space-y-3" onSubmit={handleLogin}>
          <div className="space-y-1.5">
            <Label htmlFor="login-email" className="text-xs">Email</Label>
            <Input id="login-email" type="email" placeholder="you@studio.com" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="login-password" className="text-xs">Password</Label>
            <Input id="login-password" type="password" placeholder="••••••••" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" variant="gold" className="w-full" size="lg" disabled={isLoading}>
            {isLoading ? "Signing in…" : "Sign in"}
          </Button>
          <div className="relative flex items-center">
            <div className="flex-1 border-t border-border" />
            <span className="mx-3 text-xs text-muted-foreground">or</span>
            <div className="flex-1 border-t border-border" />
          </div>
          {GoogleBtn}
        </form>
      )}
    </div>
  );
}
