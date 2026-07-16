import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import MDEditor from '@uiw/react-md-editor';

export const Route = createFileRoute("/_authenticated/pitches/new")({
  component: NewPitch,
});

type Role = {
  title: string; description: string; skills: string; comp_type: "equity" | "paid" | "revenue_share" | "volunteer";
  comp_details: string; commitment: string;
};

const pitchSchema = z.object({
  title: z.string().trim().min(3, "Title too short").max(120),
  tagline: z.string().trim().max(200).optional(),
  problem: z.string().trim().max(4000).optional(),
  solution: z.string().trim().max(4000).optional(),
  category: z.string().max(40),
  stage: z.string().max(40),
});

const CATEGORIES = ["saas", "consumer", "marketplace", "ai", "fintech", "healthtech", "climate", "web3", "hardware", "other"];
const STAGES = ["idea", "prototype", "mvp", "launched", "revenue"];

function NewPitch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [problem, setProblem] = useState("");
  const [solution, setSolution] = useState("");
  const [category, setCategory] = useState("saas");
  const [stage, setStage] = useState("idea");
  const [roles, setRoles] = useState<Role[]>([
    { title: "", description: "", skills: "", comp_type: "equity", comp_details: "", commitment: "part-time" },
  ]);
  const [busy, setBusy] = useState(false);

  function updateRole(i: number, patch: Partial<Role>) {
    setRoles((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const parsed = pitchSchema.safeParse({ title, tagline, problem, solution, category, stage });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }

    setBusy(true);
    try {
      const { data: pitch, error } = await supabase.from("pitches").insert({
        founder_id: user.id,
        title: parsed.data.title,
        tagline: parsed.data.tagline ?? "",
        problem: parsed.data.problem ?? "",
        solution: parsed.data.solution ?? "",
        category: parsed.data.category,
        stage: parsed.data.stage,
        status: "published",
      }).select("id").single();
      if (error) throw error;

      const roleRows = roles
        .filter((r) => r.title.trim())
        .map((r) => ({
          pitch_id: pitch.id,
          title: r.title.trim().slice(0, 80),
          description: r.description.trim().slice(0, 2000),
          skills: r.skills.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12),
          comp_type: r.comp_type,
          comp_details: r.comp_details.trim().slice(0, 120),
          commitment: r.commitment,
        }));
      if (roleRows.length > 0) {
        const { error: rErr } = await supabase.from("pitch_roles").insert(roleRows);
        if (rErr) throw rErr;
      }

      toast.success("Pitch published!");
      navigate({ to: "/pitch/$id", params: { id: pitch.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create pitch");
    } finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <h1 className="font-display text-3xl font-bold">Post your pitch</h1>
          <p className="mt-1 text-sm text-muted-foreground">Share your idea and the roles you're looking to fill.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-base">The idea</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Field label="Title *"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required placeholder="e.g. Nomad — remote work retreat marketplace" /></Field>
                <Field label="One-line tagline"><Input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={200} placeholder="What is it, in one line?" /></Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Category">
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Stage">
                    <Select value={stage} onValueChange={setStage}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field label="Problem">
                  <div data-color-mode="light">
                    <MDEditor value={problem} onChange={(v) => setProblem(v || "")} preview="edit" height={200} />
                  </div>
                </Field>
                <Field label="Solution">
                  <div data-color-mode="light">
                    <MDEditor value={solution} onChange={(v) => setSolution(v || "")} preview="edit" height={200} />
                  </div>
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Open roles</CardTitle>
                <Button type="button" size="sm" variant="outline" onClick={() => setRoles([...roles, { title: "", description: "", skills: "", comp_type: "equity", comp_details: "", commitment: "part-time" }])}>
                  <Plus className="mr-1 h-4 w-4" /> Add role
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                {roles.map((r, i) => (
                  <div key={i} className="rounded-xl border border-border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role {i + 1}</div>
                      {roles.length > 1 && (
                        <Button type="button" size="icon" variant="ghost" onClick={() => setRoles(roles.filter((_, idx) => idx !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <Field label="Role title *"><Input value={r.title} onChange={(e) => updateRole(i, { title: e.target.value })} maxLength={80} placeholder="e.g. Full-stack engineer" /></Field>
                    <Field label="Description"><Textarea rows={3} value={r.description} onChange={(e) => updateRole(i, { description: e.target.value })} maxLength={2000} placeholder="What will they be doing?" /></Field>
                    <Field label="Skills (comma-separated)"><Input value={r.skills} onChange={(e) => updateRole(i, { skills: e.target.value })} placeholder="React, TypeScript, Postgres" /></Field>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label="Compensation">
                        <Select value={r.comp_type} onValueChange={(v) => updateRole(i, { comp_type: v as Role["comp_type"] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="equity">Equity</SelectItem>
                            <SelectItem value="revenue_share">Revenue share</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="volunteer">Volunteer</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Details"><Input value={r.comp_details} onChange={(e) => updateRole(i, { comp_details: e.target.value })} maxLength={120} placeholder="e.g. 5-8% or $60/hr" /></Field>
                      <Field label="Commitment">
                        <Select value={r.commitment} onValueChange={(v) => updateRole(i, { commitment: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="part-time">Part-time</SelectItem>
                            <SelectItem value="full-time">Full-time</SelectItem>
                            <SelectItem value="contract">Contract</SelectItem>
                            <SelectItem value="advisor">Advisor</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => navigate({ to: "/dashboard" })}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? "Publishing…" : "Publish pitch"}</Button>
            </div>
          </form>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
