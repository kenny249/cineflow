"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

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

  const handleDemoLogin = async () => {
    setIsDemoLoading(true);

    try {
      const { data, error } = await createClient().auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });

      if (error) {
        if (
          error.message.toLowerCase().includes("user not found") ||
          error.message.toLowerCase().includes("invalid login credentials")
        ) {
          const redirectUrl = `${window.location.origin}/login`;
          const { data: signupData, error: signupError } = await createClient().auth.signUp({
            email: DEMO_EMAIL,
            password: DEMO_PASSWORD,
            options: {
              emailRedirectTo: redirectUrl,
              data: {
                full_name: "Kenny",
              },
            },
          });

          if (signupError) {
            const message = signupError.message.includes("fetch failed")
              ? "Unable to reach Supabase. Check your project URL and network."
              : signupError.message;
            toast.error(message);
            return;
          }

          if (signupData?.session) {
            toast.success("Temporary account created and signed in.");
            window.location.assign("/welcome");
            return;
          }

          toast.success("Temporary account created. Verify your email and then sign in.");
          return;
        }

        const message = error.message.includes("fetch failed")
          ? "Unable to reach Supabase. Check your project URL and network."
          : error.message;
        toast.error(message);
        return;
      }

      if (data?.session) {
        toast.success("Signed in successfully.");
        window.location.assign("/welcome");
      }
    } catch (catchError) {
      console.error("Demo login error:", catchError);
      toast.error("Unable to sign in with temporary account.");
    } finally {
      setIsDemoLoading(false);
    }
  };

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
    </form>
  );
}
