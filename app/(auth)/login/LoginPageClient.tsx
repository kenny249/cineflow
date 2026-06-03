"use client";

import { useState } from "react";
import Link from "next/link";
import { Film } from "lucide-react";
import { toast } from "sonner";
import { HeroPreview } from "./HeroPreview";
import { PageParticles } from "./PageParticles";
import { HexField } from "./HexField";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function GrainOverlay() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[1] h-full w-full"
      style={{ opacity: 0.13, mixBlendMode: "overlay" }}
    >
      <defs>
        <filter id="cf-grain" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </defs>
      <rect width="100%" height="100%" filter="url(#cf-grain)" />
    </svg>
  );
}

export function LoginPageClient() {
  const [email, setEmail]                 = useState("");
  const [password, setPassword]           = useState("");
  const [isLoading, setIsLoading]         = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    setIsLoading(false);
    if (error) {
      toast.error(
        error.message.includes("Invalid login credentials")
          ? "Incorrect email or password."
          : error.message
      );
      return;
    }
    window.location.assign("/welcome");
  }

  async function handleGoogleSignIn() {
    setIsGoogleLoading(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      toast.error(error.message);
      setIsGoogleLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background">
      <PageParticles />
      <GrainOverlay />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,168,83,0.14),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(212,168,83,0.06),transparent_35%)]" />
      <div className="absolute left-0 top-0 h-48 w-48 rounded-full bg-[#d4a853]/10 blur-3xl" />
      <div className="absolute right-0 bottom-0 h-72 w-72 rounded-full bg-[#d4a853]/8 blur-3xl" />

      {/* Left: Login Panel */}
      <div className="relative z-10 flex w-full flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-12 md:w-1/2 lg:w-2/5">
        <div className="animate-card-rise relative w-full max-w-sm rounded-[1.5rem] sm:rounded-[2rem] border border-white/10 bg-card/95 p-8 sm:p-10 backdrop-blur-xl">

          <Link href="/" className="mb-6 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[#d4a853]/30 bg-[#d4a853]/10">
              <Film className="h-3.5 w-3.5 text-[#d4a853]" />
            </div>
            <p className="text-[0.65rem] font-bold tracking-[0.3em] text-[#d4a853] uppercase">CineFlow</p>
          </Link>

          <div className="mb-7">
            <h2 className="text-xl font-bold text-foreground">Welcome back</h2>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your studio.</p>
          </div>

          <form className="space-y-4" onSubmit={handleSignIn}>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@studio.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              variant="gold"
              className="w-full"
              size="lg"
              disabled={isLoading || isGoogleLoading}
            >
              {isLoading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <Link
            href="/forgot-password"
            className="mt-3 flex min-h-[44px] items-center justify-center text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Forgot password?
          </Link>

          <div className="relative my-2 flex items-center">
            <div className="flex-1 border-t border-border" />
            <span className="mx-3 text-xs text-muted-foreground">or</span>
            <div className="flex-1 border-t border-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            size="lg"
            disabled={isGoogleLoading || isLoading}
            onClick={handleGoogleSignIn}
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

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
              Start free trial
            </Link>
          </p>

        </div>
      </div>

      {/* Right: Hero Preview */}
      <div className="relative hidden flex-1 items-center justify-center overflow-hidden border-l border-border bg-[#070707] px-8 py-10 md:flex">
        <HexField />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_50%,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
        <div className="relative z-10 flex w-full items-center justify-center">
          <HeroPreview />
        </div>
      </div>
    </div>
  );
}
