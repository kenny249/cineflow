"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getProfile, updateProfile } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";

export default function SettingsClient() {
  const [avatarUrl, setAvatarUrl] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const profile = await getProfile();
        if (profile) {
          setFirstName(profile.first_name ?? "");
          setLastName(profile.last_name ?? "");
          setEmail(profile.email ?? "");
          setCompany(profile.company ?? "");
          setAvatarUrl(profile.avatar_url ?? "");
        }
      } catch {
        toast.error("Failed to load profile");
      }
    }
    load();
  }, []);

  const handlePhotoChange = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarUrl(reader.result);
        toast.success("Photo updated locally. Save changes to persist.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        company: company.trim(),
        avatar_url: avatarUrl || undefined,
      });
      toast.success("Profile saved.");
    } catch {
      toast.error("Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error("Fill out all password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setIsUpdatingPassword(true);
    try {
      const { error } = await createClient().auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated.");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update password.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleDeleteAccount = () => {
    if (window.confirm("Are you sure you want to delete your account? This cannot be undone.")) {
      toast.error("Account deletion requires contacting support for now.");
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center border-b border-border px-6 py-4">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Settings</h1>
          <p className="text-xs text-muted-foreground">Manage your account and preferences</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="mx-auto max-w-2xl space-y-8 p-6">
          {/* Profile */}
          <section>
            <h2 className="mb-4 font-display text-sm font-semibold text-foreground">Profile</h2>
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={avatarUrl} alt="Profile photo" />
                  <AvatarFallback>KG</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Change photo
                    </Button>
                    <p className="text-xs text-muted-foreground">JPG, PNG or WebP. Max 2MB.</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => handlePhotoChange(event.target.files?.[0] ?? undefined)}
                  />
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>First name</Label>
                  <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Last name</Label>
                  <Input value={lastName} onChange={(event) => setLastName(event.target.value)} />
                </div>
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label>Company</Label>
                  <Input value={company} onChange={(event) => setCompany(event.target.value)} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="gold" size="sm" onClick={handleSaveProfile} disabled={isSaving}>
                  {isSaving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </div>
          </section>

          {/* Password */}
          <section>
            <h2 className="mb-4 font-display text-sm font-semibold text-foreground">Password</h2>
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="space-y-1.5">
                <Label>Current password</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>New password</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Confirm password</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={handleUpdatePassword} disabled={isUpdatingPassword}>
                  {isUpdatingPassword ? "Updating…" : "Update password"}
                </Button>
              </div>
            </div>
          </section>

          {/* Danger zone */}
          <section>
            <h2 className="mb-4 font-display text-sm font-semibold text-red-400">Danger Zone</h2>
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Delete account</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Permanently delete your account and all data. This cannot be undone.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                  onClick={handleDeleteAccount}
                >
                  Delete account
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
