import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { toast } from "sonner";
import { Coins, Rocket, ShieldCheck, HeartHandshake, Clock, MapPin, Globe, Linkedin, Bookmark, Trash2 } from "lucide-react";
import MDEditor from '@uiw/react-md-editor';

export const Route = createFileRoute("/pitch/$id")({
  component: PitchDetail,
});

type Pitch = {
  id: string; title: string; tagline: string; problem: string; solution: string;
  category: string; stage: string; cover_url: string | null; founder_id: string;
  created_at: string;
  pitch_roles: { id: string; title: string; description: string; skills: string[]; comp_type: string; comp_details: string; commitment: string; filled: boolean }[];
  profiles: { name: string; headline: string; avatar_url: string | null; bio: string; location: string | null; website: string | null; linkedin: string | null } | null;
};

const compIcon = (t: string) =>
  t === "equity" ? <Coins className="h-3.5 w-3.5" /> :
  t === "revenue_share" ? <Rocket className="h-3.5 w-3.5" /> :
  t === "paid" ? <ShieldCheck className="h-3.5 w-3.5" /> :
  <HeartHandshake className="h-3.5 w-3.5" />;

const compLabel = (t: string) => ({
  equity: "Equity", paid: "Paid", revenue_share: "Revenue share", volunteer: "Volunteer",
}[t] ?? t);

function PitchDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["pitch", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pitches")
        .select("id, title, tagline, problem, solution, category, stage, cover_url, founder_id, created_at, pitch_roles(id, title, description, skills, comp_type, comp_details, commitment, filled), profiles!pitches_founder_profile_fkey(name, headline, avatar_url, bio, location, website, linkedin), pitch_members(user_id)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Pitch & { pitch_members: { user_id: string }[] } | null;
    },
  });

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  const deletePitch = useMutation({
    mutationFn: async () => {
      if (!isAdmin) throw new Error("Unauthorized");
      const { error } = await supabase.from("pitches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pitch deleted");
      navigate({ to: "/explore" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1"><div className="mx-auto max-w-4xl px-4 py-12"><div className="h-64 animate-pulse rounded-2xl bg-card" /></div></main>
        <SiteFooter />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1 grid place-items-center px-4">
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold">Pitch not found</h1>
            <p className="mt-2 text-muted-foreground">It may have been removed or unpublished.</p>
            <Button asChild className="mt-6"><Link to="/explore">Browse pitches</Link></Button>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const isFounder = user?.id === data.founder_id;
  const isMember = user?.id && data.pitch_members?.some((m) => m.user_id === user.id);
  const canAccessWorkspace = isFounder || isMember;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="bg-hero-gradient">
          <div className="mx-auto max-w-4xl px-4 py-10">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="capitalize">{data.category}</Badge>
              <Badge variant="outline" className="capitalize">{data.stage}</Badge>
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold md:text-5xl">{data.title}</h1>
            {data.tagline && <p className="mt-3 text-lg text-muted-foreground">{data.tagline}</p>}
            
            <div className="mt-5 flex gap-2">
              <BookmarkToggle pitchId={data.id} />
              {isFounder && (
                <Button asChild variant="outline" size="sm">
                  <Link to="/pitches/$id/manage" params={{ id: data.id }}>Manage pitch</Link>
                </Button>
              )}
              {canAccessWorkspace && (
                <Button asChild size="sm">
                  <Link to="/pitches/$id/workspace" params={{ id: data.id }}>Go to Workspace</Link>
                </Button>
              )}
              {isAdmin && (
                <Button size="sm" variant="destructive" onClick={() => {
                  if (confirm("Are you sure you want to delete this pitch? This action cannot be undone.")) {
                    deletePitch.mutate();
                  }
                }} disabled={deletePitch.isPending}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete (Admin)
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="mx-auto grid max-w-4xl gap-8 px-4 py-10 lg:grid-cols-[1fr_320px]">
          <div className="space-y-8">
            {data.cover_url && (
              <div className="overflow-hidden rounded-2xl border border-border">
                <img src={data.cover_url} alt="" className="w-full object-cover" />
              </div>
            )}
            {data.problem && (
              <section>
                <h2 className="font-display text-xl font-semibold">The problem</h2>
                <div className="mt-3 prose prose-sm max-w-none text-foreground/90" data-color-mode="light">
                  <MDEditor.Markdown source={data.problem} style={{ backgroundColor: 'transparent', color: 'inherit' }} />
                </div>
              </section>
            )}
            {data.solution && (
              <section>
                <h2 className="font-display text-xl font-semibold">The solution</h2>
                <div className="mt-3 prose prose-sm max-w-none text-foreground/90" data-color-mode="light">
                  <MDEditor.Markdown source={data.solution} style={{ backgroundColor: 'transparent', color: 'inherit' }} />
                </div>
              </section>
            )}

            <section>
              <h2 className="font-display text-xl font-semibold">Open roles</h2>
              <div className="mt-4 grid gap-3">
                {data.pitch_roles.length === 0 && (
                  <p className="text-sm text-muted-foreground">No roles listed yet.</p>
                )}
                {data.pitch_roles.map((r) => (
                  <RoleCard key={r.id} role={r} pitchId={data.id} founderId={data.founder_id}
                    onNeedAuth={() => navigate({ to: "/auth", search: { mode: "signup" } as never })}
                  />
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <Card>
              <CardHeader>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Founder</div>
                <div className="mt-2 flex items-center gap-3">
                  <Link to="/users/$id" params={{ id: data.founder_id }} className="transition-opacity hover:opacity-80">
                    {data.profiles?.avatar_url ? (
                      <img src={data.profiles.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover" />
                    ) : (
                      <div className="grid h-11 w-11 place-items-center rounded-full bg-primary/15 font-semibold text-primary">
                        {(data.profiles?.name ?? "?").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </Link>
                  <div>
                    <Link to="/users/$id" params={{ id: data.founder_id }} className="font-semibold hover:underline block">{data.profiles?.name ?? "Anonymous"}</Link>
                    {data.profiles?.headline && <div className="text-xs text-muted-foreground">{data.profiles.headline}</div>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {data.profiles?.bio && <p className="text-foreground/80">{data.profiles.bio}</p>}
                {data.profiles?.location && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {data.profiles.location}</div>}
                {data.profiles?.website && <a href={data.profiles.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-foreground"><Globe className="h-3.5 w-3.5" /> Website</a>}
                {data.profiles?.linkedin && <a href={data.profiles.linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-foreground"><Linkedin className="h-3.5 w-3.5" /> LinkedIn</a>}
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function RoleCard({ role, pitchId, founderId, onNeedAuth }: {
  role: Pitch["pitch_roles"][number]; pitchId: string; founderId: string; onNeedAuth: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  const existing = useQuery({
    queryKey: ["my-application", role.id, user?.id ?? "anon"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("applications").select("id, status").eq("role_id", role.id).eq("applicant_id", user!.id).maybeSingle();
      return data;
    },
  });

  const apply = useMutation({
    mutationFn: async () => {
      if (message.trim().length < 10) throw new Error("Please write a short message (at least 10 characters).");
      if (message.length > 2000) throw new Error("Message is too long.");
      const { error } = await supabase.from("applications").insert({
        role_id: role.id, pitch_id: pitchId, applicant_id: user!.id, message: message.trim(),
      });
      if (error) throw error;
      
      // Notify the founder
      await supabase.from("notifications").insert({
        user_id: founderId,
        type: "application_received",
        title: "New Application Received",
        content: `Someone applied for the ${role.title} role.`,
        link: `/pitches/${pitchId}/manage`
      });
    },
    onSuccess: () => {
      toast.success("Application sent!");
      setOpen(false); setMessage("");
      qc.invalidateQueries({ queryKey: ["my-application", role.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isFounder = user?.id === founderId;
  const alreadyApplied = !!existing.data;

  return (
    <Card className="border-border/70">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-semibold">{role.title}</h3>
              {role.filled && <Badge variant="outline" className="text-xs">Filled</Badge>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-accent">
                {compIcon(role.comp_type)} {compLabel(role.comp_type)}
                {role.comp_details && <span className="text-accent/80">· {role.comp_details}</span>}
              </span>
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {role.commitment}</span>
            </div>
          </div>
          {!isFounder && !role.filled && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={alreadyApplied}
                  onClick={(e) => { if (!user) { e.preventDefault(); onNeedAuth(); } }}
                >
                  {alreadyApplied ? `Applied · ${existing.data?.status}` : "Apply"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Apply for {role.title}</DialogTitle>
                </DialogHeader>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)}
                  placeholder="Introduce yourself, share why you're a fit, and link to work if you can."
                  rows={6} maxLength={2000} />
                <p className="text-xs text-muted-foreground">{message.length}/2000</p>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={() => apply.mutate()} disabled={apply.isPending}>
                    {apply.isPending ? "Sending…" : "Send application"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {role.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{role.description}</p>}
        {role.skills?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {role.skills.map((s) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BookmarkToggle({ pitchId }: { pitchId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: isSaved } = useQuery({
    queryKey: ["is-saved", pitchId, user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase
        .from("saved_pitches")
        .select("pitch_id")
        .eq("user_id", user.id)
        .eq("pitch_id", pitchId)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!user,
  });

  const toggleSave = useMutation({
    mutationFn: async () => {
      if (!user) {
        navigate({ to: "/auth" });
        return;
      }
      if (isSaved) {
        const { error } = await supabase.from("saved_pitches").delete().eq("user_id", user.id).eq("pitch_id", pitchId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("saved_pitches").insert({ user_id: user.id, pitch_id: pitchId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["is-saved", pitchId, user?.id] });
      qc.invalidateQueries({ queryKey: ["saved-pitches", user?.id] });
      if (isSaved && user) toast.success("Pitch removed from saved.");
      else if (user) toast.success("Pitch saved!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Button 
      variant={isSaved ? "default" : "outline"} 
      size="sm"
      onClick={() => toggleSave.mutate()}
      disabled={toggleSave.isPending}
    >
      <Bookmark className={`mr-2 h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
      {isSaved ? "Saved" : "Save Pitch"}
    </Button>
  );
}
