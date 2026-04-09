"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { generateDisplayName, getOrCreateDisplayName } from "@/lib/random-name";

const DEMO_EMAIL = "kenny@maltavmedia.com";
const DEMO_PASSWORD = "DopeDrops17!";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    const { error } = await createClient().auth.signInWithPassword({
      email,
      password,
    });

    setIsLoading(false);

    if (error) {
      const message = error.message.includes("fetch failed")
        ? "Unable to reach Supabase. Check your project URL and network."
        : error.message;
      toast.error(message);
      return;
    }

    toast.success("Signed in successfully.");
    window.location.assign("/welcome");
  };

  const handleBetaAccess = async () => {
    setIsDemoLoading(true);
    try {
      // Ensure a random display name exists before signing in
      const displayName = getOrCreateDisplayName();

      const { data, error } = await createClient().auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });

      if (error) {
        if (
          error.message.toLowerCase().includes("user not found") ||
          error.message.toLowerCase().includes("invalid login credentials")
        ) {
          const { data: signupData, error: signupError } = await createClient().auth.signUp({
            email: DEMO_EMAIL,
            password: DEMO_PASSWORD,
            options: {
              emailRedirectTo: `${window.location.origin}/login`,
              data: { full_name: displayName },
            },
          });

          if (signupError) {
            toast.error(signupError.message.includes("fetch failed")
              ? "Unable to reach Supabase. Check your project URL and network."
              : signupError.message);
            return;
          }

          if (signupData?.session) {
            toast.success(`Beta access granted. Welcome, ${displayName}!`);
            window.location.assign("/welcome");
            return;
          }

          toast.info("Check your email to confirm, then sign in.");
          return;
        }

        toast.error(error.message.includes("fetch failed")
          ? "Unable to reach Supabase. Check your project URL and network."
          : error.message);
        return;
      }

      if (data?.session) {
        toast.success(`Welcome back, ${displayName}!`);
        window.location.assign("/welcome");
      }
    } catch (err) {
      console.error("Beta access error:", err);
      toast.error("Unable to activate beta access.");
    } finally {
      setIsDemoLoading(false);
    }
  };

  const handleDemoLogin = handleBetaAccess;

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@cineflow.com"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>

      <Button type="submit" variant="gold" className="w-full" size="lg" disabled={isLoading}>
        {isLoading ? "Signing in..." : "Sign in"}
      </Button>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-card px-3 text-xs text-muted-foreground">or</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        size="lg"
        onClick={handleDemoLogin}
        disabled={isLoading || isDemoLoading}
      >
        {isDemoLoading ? "Signing in..." : "Use temporary login"}
      </Button>

      {/* Beta Test button */}
      <div className="relative my-3">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-card px-3 text-xs text-muted-foreground">or</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleBetaAccess}
        disabled={isLoading || isDemoLoading}
        className="group relative w-full overflow-hidden rounded-xl px-5 py-3 text-sm font-bold tracking-widest uppercase text-zinc-900 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        style={{
          background: "linear-gradient(105deg, #b0b0b0 0%, #f5f5f5 25%, #ffffff 50%, #e0e0e0 75%, #a8a8a8 100%)",
          backgroundSize: "200% 100%",
          animation: isDemoLoading ? "none" : "silver-sweep 3s linear infinite",
          boxShadow: "0 0 24px rgba(220,220,220,0.25), 0 0 48px rgba(200,200,200,0.12), inset 0 1px 0 rgba(255,255,255,0.8), 0 2px 8px rgba(0,0,0,0.4)",
        }}
      >
        <span className="flex items-center justify-center gap-2">
          <Sparkles className="h-4 w-4" />
          {isDemoLoading ? "Activating..." : "Beta Test"}
        </span>
      </button>
    </form>
  );
}
