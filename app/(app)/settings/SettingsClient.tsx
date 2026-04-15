"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getProfile, updateProfile } from "@/lib/supabase/queries";
import { setDisplayName } from "@/lib/random-name";
import { createClient } from "@/lib/supabase/client";
import type { PaymentSettings } from "@/types";

// ─── Payment method tab config ────────────────────────────────────────────────

const PAYMENT_TABS = [
  { id: "stripe",  label: "Stripe" },
  { id: "paypal",  label: "PayPal" },
  { id: "zelle",   label: "Zelle" },
  { id: "ach",     label: "ACH / Bank" },
  { id: "wire",    label: "Wire" },
  { id: "check",   label: "Check" },
] as const;

type PaymentTab = typeof PAYMENT_TABS[number]["id"];

// ─── Masked secret input ──────────────────────────────────────────────────────

function SecretInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-9 font-mono text-xs"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SettingsClient() {
  const [avatarUrl, setAvatarUrl] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Business info
  const [businessName, setBusinessName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [addrLine1, setAddrLine1] = useState("");
  const [addrLine2, setAddrLine2] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrZip, setAddrZip] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessWebsite, setBusinessWebsite] = useState("");
  const [isSavingBusiness, setIsSavingBusiness] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  // Payment settings
  const [paymentTab, setPaymentTab] = useState<PaymentTab>("stripe");
  const [paySettings, setPaySettings] = useState<PaymentSettings>({});
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState<PaymentTab | null>("stripe");

  // Password
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
          setBusinessName(profile.business_name ?? "");
          setLogoUrl(profile.logo_url ?? "");
          setAddrLine1(profile.address_line1 ?? "");
          setAddrLine2(profile.address_line2 ?? "");
          setAddrCity(profile.city ?? "");
          setAddrState(profile.state ?? "");
          setAddrZip(profile.zip ?? "");
          setBusinessPhone(profile.business_phone ?? "");
          setBusinessWebsite(profile.business_website ?? "");
          setPaySettings((profile.payment_settings as PaymentSettings) ?? {});
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
      // Keep localStorage in sync so nav dropdown reflects the update immediately
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
      if (fullName) setDisplayName(fullName);
      toast.success("Profile saved.");
    } catch {
      toast.error("Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoChange = (file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo must be under 2MB"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setLogoUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBusiness = async () => {
    setIsSavingBusiness(true);
    try {
      await updateProfile({
        business_name: businessName.trim() || undefined,
        logo_url: logoUrl || undefined,
        address_line1: addrLine1.trim() || undefined,
        address_line2: addrLine2.trim() || undefined,
        city: addrCity.trim() || undefined,
        state: addrState.trim() || undefined,
        zip: addrZip.trim() || undefined,
        business_phone: businessPhone.trim() || undefined,
        business_website: businessWebsite.trim() || undefined,
      });
      toast.success("Business info saved.");
    } catch {
      toast.error("Failed to save business info.");
    } finally {
      setIsSavingBusiness(false);
    }
  };

  const handleSavePayment = async () => {
    setIsSavingPayment(true);
    try {
      await updateProfile({ payment_settings: paySettings });
      toast.success("Payment settings saved.");
    } catch {
      toast.error("Failed to save payment settings.");
    } finally {
      setIsSavingPayment(false);
    }
  };

  const setPay = (key: keyof PaymentSettings, value: string) =>
    setPaySettings((prev) => ({ ...prev, [key]: value || undefined }));

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
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update password.");
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

          {/* ── Profile ─────────────────────────────────────────── */}
          <section>
            <h2 className="mb-4 font-display text-sm font-semibold text-foreground">Profile</h2>
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={avatarUrl} alt="Profile photo" />
                  <AvatarFallback>
                    {firstName ? firstName[0] : ""}
                    {lastName ? lastName[0] : ""}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                      Change photo
                    </Button>
                    <p className="text-xs text-muted-foreground">JPG, PNG or WebP. Max 2MB.</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? undefined)}
                  />
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>First name</Label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Last name</Label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label>Company</Label>
                  <Input value={company} onChange={(e) => setCompany(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="gold" size="sm" onClick={handleSaveProfile} disabled={isSaving}>
                  {isSaving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </div>
          </section>

          {/* ── Business Info ────────────────────────────────────── */}
          <section>
            <h2 className="mb-1 font-display text-sm font-semibold text-foreground">Business Info</h2>
            <p className="mb-4 text-xs text-muted-foreground">Appears on invoices sent to clients.</p>
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              {/* Agency logo */}
              <div className="space-y-1.5">
                <Label>Agency logo</Label>
                <p className="text-xs text-muted-foreground">Shown on client-facing forms and intake pages.</p>
                <div className="flex items-center gap-4">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Agency logo" className="h-12 max-w-[160px] object-contain rounded border border-border bg-muted p-1" />
                  ) : (
                    <div className="flex h-12 w-28 items-center justify-center rounded border border-dashed border-border bg-muted text-xs text-muted-foreground">
                      No logo
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>
                      {logoUrl ? "Change logo" : "Upload logo"}
                    </Button>
                    {logoUrl && (
                      <Button variant="ghost" size="sm" className="text-muted-foreground text-xs h-7" onClick={() => setLogoUrl("")}>
                        Remove
                      </Button>
                    )}
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => handleLogoChange(e.target.files?.[0])}
                  />
                </div>
              </div>
              <Separator />
              <div className="space-y-1.5">
                <Label>Business name</Label>
                <Input
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Your studio or company name"
                />
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Street address</Label>
                  <Input
                    value={addrLine1}
                    onChange={(e) => setAddrLine1(e.target.value)}
                    placeholder="123 Main St"
                  />
                </div>
                <Input
                  value={addrLine2}
                  onChange={(e) => setAddrLine2(e.target.value)}
                  placeholder="Suite, floor, unit (optional)"
                />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="col-span-2 space-y-1.5 sm:col-span-1">
                    <Label>City</Label>
                    <Input value={addrCity} onChange={(e) => setAddrCity(e.target.value)} placeholder="Los Angeles" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>State</Label>
                    <Input value={addrState} onChange={(e) => setAddrState(e.target.value)} placeholder="CA" maxLength={2} className="uppercase" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>ZIP</Label>
                    <Input value={addrZip} onChange={(e) => setAddrZip(e.target.value)} placeholder="90001" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input
                    value={businessPhone}
                    onChange={(e) => setBusinessPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Website</Label>
                  <Input
                    value={businessWebsite}
                    onChange={(e) => setBusinessWebsite(e.target.value)}
                    placeholder="yourstudio.com"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="gold" size="sm" onClick={handleSaveBusiness} disabled={isSavingBusiness}>
                  {isSavingBusiness ? "Saving…" : "Save business info"}
                </Button>
              </div>
            </div>
          </section>

          {/* ── Payment Methods ──────────────────────────────────── */}
          <section>
            <h2 className="mb-1 font-display text-sm font-semibold text-foreground">Payment Methods</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Configure how clients can pay your invoices. Enable only the methods you accept.
            </p>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Stripe */}
              <PaymentSection
                id="stripe"
                label="Stripe"
                badge="Auto-generates payment links"
                badgeColor="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                configured={!!paySettings.stripe_secret_key}
                open={paymentOpen === "stripe"}
                onToggle={() => setPaymentOpen(paymentOpen === "stripe" ? null : "stripe")}
              >
                <p className="mb-3 text-xs text-muted-foreground">
                  Clients pay by card, Apple Pay, or Google Pay. Cineflow auto-generates a permanent payment link for each invoice.
                </p>
                <div className="space-y-1.5">
                  <Label>Stripe Secret Key</Label>
                  <SecretInput
                    value={paySettings.stripe_secret_key ?? ""}
                    onChange={(v) => setPay("stripe_secret_key", v)}
                    placeholder="sk_live_… or sk_test_…"
                  />
                  <p className="text-[11px] text-muted-foreground/60">
                    Find this in your Stripe Dashboard → Developers → API keys. Stored securely in your account.
                  </p>
                </div>
              </PaymentSection>

              <Separator />

              {/* PayPal */}
              <PaymentSection
                id="paypal"
                label="PayPal"
                badge="Uses PayPal.me"
                badgeColor="text-blue-400 bg-blue-500/10 border-blue-500/20"
                configured={!!paySettings.paypal_me_username}
                open={paymentOpen === "paypal"}
                onToggle={() => setPaymentOpen(paymentOpen === "paypal" ? null : "paypal")}
              >
                <p className="mb-3 text-xs text-muted-foreground">
                  Generates a PayPal.me link with the invoice amount pre-filled.
                </p>
                <div className="space-y-1.5">
                  <Label>PayPal.me username</Label>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-sm text-muted-foreground">paypal.me/</span>
                    <Input
                      value={paySettings.paypal_me_username ?? ""}
                      onChange={(e) => setPay("paypal_me_username", e.target.value)}
                      placeholder="yourusername"
                      className="flex-1"
                    />
                  </div>
                </div>
              </PaymentSection>

              <Separator />

              {/* Zelle */}
              <PaymentSection
                id="zelle"
                label="Zelle"
                badge="Zero fees, instant"
                badgeColor="text-violet-400 bg-violet-500/10 border-violet-500/20"
                configured={!!paySettings.zelle_contact}
                open={paymentOpen === "zelle"}
                onToggle={() => setPaymentOpen(paymentOpen === "zelle" ? null : "zelle")}
              >
                <p className="mb-3 text-xs text-muted-foreground">
                  Your Zelle contact is printed on the invoice. Client sends payment directly to you.
                </p>
                <div className="space-y-1.5">
                  <Label>Zelle phone or email</Label>
                  <Input
                    value={paySettings.zelle_contact ?? ""}
                    onChange={(e) => setPay("zelle_contact", e.target.value)}
                    placeholder="phone@email.com or +1 (555) 000-0000"
                  />
                </div>
              </PaymentSection>

              <Separator />

              {/* ACH */}
              <PaymentSection
                id="ach"
                label="ACH / Bank Transfer"
                badge="Best for large invoices"
                badgeColor="text-amber-400 bg-amber-500/10 border-amber-500/20"
                configured={!!(paySettings.ach_routing && paySettings.ach_account)}
                open={paymentOpen === "ach"}
                onToggle={() => setPaymentOpen(paymentOpen === "ach" ? null : "ach")}
              >
                <p className="mb-3 text-xs text-muted-foreground">
                  Bank details are printed on the invoice for direct transfer.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label>Bank name</Label>
                    <Input
                      value={paySettings.ach_bank_name ?? ""}
                      onChange={(e) => setPay("ach_bank_name", e.target.value)}
                      placeholder="Chase, Bank of America, etc."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Routing number</Label>
                    <Input
                      value={paySettings.ach_routing ?? ""}
                      onChange={(e) => setPay("ach_routing", e.target.value)}
                      placeholder="021000021"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Account number</Label>
                    <SecretInput
                      value={paySettings.ach_account ?? ""}
                      onChange={(v) => setPay("ach_account", v)}
                      placeholder="Account number"
                    />
                  </div>
                </div>
              </PaymentSection>

              <Separator />

              {/* Wire */}
              <PaymentSection
                id="wire"
                label="Wire Transfer"
                badge="International clients"
                badgeColor="text-cyan-400 bg-cyan-500/10 border-cyan-500/20"
                configured={!!paySettings.wire_instructions}
                open={paymentOpen === "wire"}
                onToggle={() => setPaymentOpen(paymentOpen === "wire" ? null : "wire")}
              >
                <p className="mb-3 text-xs text-muted-foreground">
                  Wire instructions are printed on the invoice.
                </p>
                <div className="space-y-1.5">
                  <Label>Wire instructions</Label>
                  <textarea
                    className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-[#d4a853]/50 focus:ring-1 focus:ring-[#d4a853]/30 placeholder:text-muted-foreground"
                    rows={4}
                    value={paySettings.wire_instructions ?? ""}
                    onChange={(e) => setPay("wire_instructions", e.target.value)}
                    placeholder={"Bank: Chase\nABA/Routing: 021000021\nAccount: 000123456789\nSWIFT: CHASUS33"}
                  />
                </div>
              </PaymentSection>

              <Separator />

              {/* Check */}
              <PaymentSection
                id="check"
                label="Check"
                badge="Traditional billing"
                badgeColor="text-zinc-400 bg-zinc-500/10 border-zinc-500/20"
                configured={!!(paySettings.check_payable_to || paySettings.check_mail_to)}
                open={paymentOpen === "check"}
                onToggle={() => setPaymentOpen(paymentOpen === "check" ? null : "check")}
              >
                <p className="mb-3 text-xs text-muted-foreground">
                  Mailing instructions are printed on the invoice.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Payable to</Label>
                    <Input
                      value={paySettings.check_payable_to ?? ""}
                      onChange={(e) => setPay("check_payable_to", e.target.value)}
                      placeholder="Your Legal Name or Business"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Mail to address</Label>
                    <Input
                      value={paySettings.check_mail_to ?? ""}
                      onChange={(e) => setPay("check_mail_to", e.target.value)}
                      placeholder="123 Main St, City, ST 00000"
                    />
                  </div>
                </div>
              </PaymentSection>
            </div>

            <div className="mt-3 flex justify-end">
              <Button variant="gold" size="sm" onClick={handleSavePayment} disabled={isSavingPayment}>
                {isSavingPayment ? "Saving…" : "Save payment settings"}
              </Button>
            </div>
          </section>

          {/* ── Email / Invoicing ───────────────────────────────── */}
          <section>
            <h2 className="mb-1 font-display text-sm font-semibold text-foreground">Invoice Email</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Send invoices directly to clients via email. Powered by{" "}
              <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground transition-colors">Resend</a>
              {" "}— free plan includes 3,000 emails/month.
            </p>
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="space-y-1.5">
                <Label>Resend API Key</Label>
                <SecretInput
                  value={paySettings.resend_api_key ?? ""}
                  onChange={(v) => setPay("resend_api_key", v)}
                  placeholder="re_…"
                />
                <p className="text-[11px] text-muted-foreground/60">
                  <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-muted-foreground transition-colors">Get your free API key at Resend →</a>
                  {" "}Sign up → API Keys → Create key → choose <strong>Sending access</strong>. Paste it here.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>From Name</Label>
                  <Input
                    value={paySettings.invoice_from_name ?? ""}
                    onChange={(e) => setPay("invoice_from_name", e.target.value)}
                    placeholder="Your Studio Name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>From Email</Label>
                  <Input
                    value={paySettings.invoice_from_email ?? ""}
                    onChange={(e) => setPay("invoice_from_email", e.target.value)}
                    placeholder="invoices@yourdomain.com"
                  />
                  <p className="text-[11px] text-muted-foreground/60">
                    Must be a{" "}
                    <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-muted-foreground transition-colors">verified domain in Resend</a>
                    . Use <code className="text-[10px]">onboarding@resend.dev</code> to test first.
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="gold" size="sm" onClick={handleSavePayment} disabled={isSavingPayment}>
                  {isSavingPayment ? "Saving…" : "Save email settings"}
                </Button>
              </div>
            </div>
          </section>

          {/* ── Password ─────────────────────────────────────────── */}
          <section>
            <h2 className="mb-4 font-display text-sm font-semibold text-foreground">Password</h2>
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="space-y-1.5">
                <Label>Current password</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>New password</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Confirm password</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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

          {/* ── Danger Zone ──────────────────────────────────────── */}
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

// ─── Collapsible payment section ─────────────────────────────────────────────

function PaymentSection({
  id,
  label,
  badge,
  badgeColor,
  configured,
  open,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  badge: string;
  badgeColor: string;
  configured: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-muted/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeColor}`}>
            {badge}
          </span>
          {configured && (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              Configured
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="border-t border-border bg-muted/5 px-5 pb-5 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}
