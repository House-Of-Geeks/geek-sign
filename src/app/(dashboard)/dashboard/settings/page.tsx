"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Camera, Save, Palette, Lock, Sparkles, Pen, Trash2, Globe } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { jurisdictions, type Jurisdiction } from "@/config/jurisdiction";

interface PlanLimits {
  plan: string;
  isSuperAdmin: boolean;
  features: {
    customBranding: boolean;
  };
}

interface UserProfile {
  name: string | null;
  companyName: string | null;
  brandingLogoUrl: string | null;
  brandingPrimaryColor: string | null;
  savedSignature: string | null;
  savedInitials: string | null;
  sendAsName: string | null;
  jurisdiction: string | null;
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [sendAsName, setSendAsName] = useState("");
  const [brandingLogoUrl, setBrandingLogoUrl] = useState("");
  const [brandingPrimaryColor, setBrandingPrimaryColor] = useState("#000000");
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>("AU");
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [savedInitials, setSavedInitials] = useState<string | null>(null);
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (session?.user?.name) {
      setFullName(session.user.name);
    }
  }, [session]);

  useEffect(() => {
    // Fetch plan limits and profile data
    const fetchData = async () => {
      try {
        const [limitsRes, profileRes] = await Promise.all([
          fetch("/api/user/plan-limits"),
          fetch("/api/user/profile"),
        ]);

        if (limitsRes.ok) {
          const limits = await limitsRes.json();
          setPlanLimits(limits);
        }

        if (profileRes.ok) {
          const profile: UserProfile = await profileRes.json();
          if (profile.companyName) setCompanyName(profile.companyName);
          if (profile.sendAsName) setSendAsName(profile.sendAsName);
          if (profile.jurisdiction) setJurisdiction(profile.jurisdiction as Jurisdiction);
          if (profile.brandingLogoUrl) setBrandingLogoUrl(profile.brandingLogoUrl);
          if (profile.brandingPrimaryColor) setBrandingPrimaryColor(profile.brandingPrimaryColor);
          setSavedSignature(profile.savedSignature ?? null);
          setSavedInitials(profile.savedInitials ?? null);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    if (session?.user) {
      fetchData();
    }
  }, [session]);

  const handleSaveProfile = async () => {
    if (!session?.user) return;

    setIsSaving(true);

    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fullName, companyName, sendAsName: sendAsName || null, jurisdiction }),
      });

      if (!response.ok) throw new Error("Failed to update profile");

      toast({
        title: "Profile updated",
        description: "Your profile has been saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBranding = async () => {
    if (!session?.user) return;

    setIsSavingBranding(true);

    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandingLogoUrl: brandingLogoUrl || null,
          brandingPrimaryColor: brandingPrimaryColor || null,
        }),
      });

      if (!response.ok) throw new Error("Failed to update branding");

      toast({
        title: "Branding updated",
        description: "Your custom branding has been saved.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update branding. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingBranding(false);
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return session?.user?.email?.charAt(0).toUpperCase() || "U";
    return name
      .split(" ")
      .map((n) => n.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const canUseBranding = planLimits?.features?.customBranding || planLimits?.isSuperAdmin;

  if (status === "loading") {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Update your personal information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage
                src={session?.user?.image || undefined}
                alt={fullName}
              />
              <AvatarFallback className="text-lg">
                {getInitials(session?.user?.name)}
              </AvatarFallback>
            </Avatar>
            <Button variant="outline" size="sm">
              <Camera className="mr-2 h-4 w-4" />
              Change Photo
            </Button>
          </div>

          <Separator />

          {/* Form */}
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Enter your company name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sendAsName">Send As Name</Label>
              <Input
                id="sendAsName"
                value={sendAsName}
                onChange={(e) => setSendAsName(e.target.value)}
                placeholder={fullName || "e.g. Andy Smith"}
              />
              <p className="text-xs text-muted-foreground">
                This name appears on signature request emails — e.g. &ldquo;Andy Smith requested your signature&rdquo;. Leave blank to use your full name.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jurisdiction">Jurisdiction</Label>
              <Select value={jurisdiction} onValueChange={(v) => setJurisdiction(v as Jurisdiction)}>
                <SelectTrigger id="jurisdiction">
                  <Globe className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Select jurisdiction" />
                </SelectTrigger>
                <SelectContent>
                  {jurisdictions.map((j) => (
                    <SelectItem key={j.value} value={j.value}>
                      {j.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Sets which electronic signature law is referenced in consent disclosures and signed document audit trails.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={session?.user?.email || ""}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed
              </p>
            </div>
          </div>

          <Button onClick={handleSaveProfile} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Custom Branding */}
      <Card className={!canUseBranding ? "opacity-75" : ""}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Custom Branding
                {!canUseBranding && (
                  <Badge variant="secondary" className="ml-2">
                    <Lock className="mr-1 h-3 w-3" />
                    Starter+
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Customize how your documents appear to signers
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {canUseBranding ? (
            <>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="brandingLogoUrl">Logo URL</Label>
                  <Input
                    id="brandingLogoUrl"
                    value={brandingLogoUrl}
                    onChange={(e) => setBrandingLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    type="url"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter a URL to your company logo (recommended: 200x50px PNG)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brandingPrimaryColor">Brand Color</Label>
                  <div className="flex gap-3">
                    <Input
                      id="brandingPrimaryColor"
                      type="color"
                      value={brandingPrimaryColor}
                      onChange={(e) => setBrandingPrimaryColor(e.target.value)}
                      className="w-16 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={brandingPrimaryColor}
                      onChange={(e) => setBrandingPrimaryColor(e.target.value)}
                      placeholder="#000000"
                      className="flex-1"
                      maxLength={7}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This color will be used for buttons and links in signing emails
                  </p>
                </div>
              </div>

              {/* Preview */}
              {(brandingLogoUrl || brandingPrimaryColor !== "#000000") && (
                <div className="rounded-lg border p-4 bg-muted/30">
                  <p className="text-sm font-medium mb-3">Preview</p>
                  <div className="flex items-center gap-4">
                    {brandingLogoUrl && (
                      <img
                        src={brandingLogoUrl}
                        alt="Logo preview"
                        className="h-8 max-w-[150px] object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    )}
                    <button
                      className="px-4 py-2 rounded text-white text-sm font-medium"
                      style={{ backgroundColor: brandingPrimaryColor }}
                    >
                      Sign Document
                    </button>
                  </div>
                </div>
              )}

              <Button onClick={handleSaveBranding} disabled={isSavingBranding}>
                {isSavingBranding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Branding
                  </>
                )}
              </Button>
            </>
          ) : (
            <div className="text-center py-6">
              <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Upgrade to Starter or Team plan to customize your branding
              </p>
              <Button asChild>
                <Link href="/dashboard/billing">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Upgrade Plan
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saved Signature */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pen className="h-5 w-5" />
            Saved Signature
          </CardTitle>
          <CardDescription>
            Your signature is saved automatically when you check &quot;Save for next time&quot; while signing a document.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {savedSignature || savedInitials ? (
            <div className="space-y-4">
              {savedSignature && (
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">Signature</Label>
                  <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
                    <p className="text-2xl" style={{ fontFamily: "cursive" }}>{savedSignature}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        await fetch("/api/user/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ savedSignature: null }) });
                        setSavedSignature(null);
                        toast({ title: "Signature cleared" });
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              )}
              {savedInitials && (
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">Initials</Label>
                  <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
                    <p className="text-2xl" style={{ fontFamily: "cursive" }}>{savedInitials}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        await fetch("/api/user/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ savedInitials: null }) });
                        setSavedInitials(null);
                        toast({ title: "Initials cleared" });
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No saved signature yet. When you sign a document, check &quot;Save for next time&quot; to save it here.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Password Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Update your password to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input id="currentPassword" type="password" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input id="newPassword" type="password" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input id="confirmPassword" type="password" />
          </div>
          <Button variant="outline">Update Password</Button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions for your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-destructive/50 p-4">
            <div>
              <p className="font-medium">Delete Account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all associated data
              </p>
            </div>
            <Button variant="destructive">Delete Account</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
