import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/profile")({
  component: EditProfile,
});

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  headline: z.string().trim().max(160),
  bio: z.string().trim().max(2000),
  location: z.string().trim().max(80),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  linkedin: z.string().trim().max(200).optional().or(z.literal("")),
  skills: z.string().max(400),
  avatar_url: z.string().trim().max(500).optional().or(z.literal("")),
});

function EditProfile() {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: "", headline: "", bio: "", location: "", website: "", linkedin: "", skills: "", avatar_url: "" });
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data) setForm({
      name: data.name ?? "", headline: data.headline ?? "", bio: data.bio ?? "",
      location: data.location ?? "", website: data.website ?? "", linkedin: data.linkedin ?? "",
      skills: (data.skills ?? []).join(", "), avatar_url: data.avatar_url ?? "",
    });
  }, [data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      name: parsed.data.name, headline: parsed.data.headline, bio: parsed.data.bio,
      location: parsed.data.location || null, website: parsed.data.website || null,
      linkedin: parsed.data.linkedin || null, avatar_url: parsed.data.avatar_url || null,
      skills: parsed.data.skills.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 24),
    }).eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-10">
          <h1 className="font-display text-3xl font-bold">Edit profile</h1>
          <p className="text-sm text-muted-foreground">This is how you appear to founders and applicants.</p>

          <form onSubmit={save} className="mt-8">
            <Card>
              <CardHeader><CardTitle className="text-base">Public info</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <F label="Full name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} /></F>
                <F label="Headline"><Input value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} maxLength={160} placeholder="e.g. Full-stack engineer · ex-Stripe" /></F>
                <F label="Bio"><Textarea rows={5} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={2000} /></F>
                <F label="Skills (comma-separated)"><Input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="React, Design systems, Growth" /></F>
                <F label="Location"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} maxLength={80} /></F>
                <F label="Avatar URL"><Input value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} placeholder="https://…" /></F>
                <F label="Website"><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…" /></F>
                <F label="LinkedIn"><Input value={form.linkedin} onChange={(e) => setForm({ ...form, linkedin: e.target.value })} placeholder="https://linkedin.com/in/…" /></F>
              </CardContent>
            </Card>
            <div className="mt-6 flex justify-end">
              <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save profile"}</Button>
            </div>
          </form>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
