import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Search, Users2, Bookmark } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore ideas — Lumen" },
      { name: "description", content: "Browse pitches looking for co-founders, engineers, designers and operators." },
      { property: "og:title", content: "Explore ideas on Lumen" },
      { property: "og:description", content: "Find a startup idea to join or team up on." },
    ],
  }),
  component: Explore,
});

type PitchRow = {
  id: string; title: string; tagline: string; category: string; stage: string;
  cover_url: string | null; created_at: string; founder_id: string;
  pitch_roles: { id: string; title: string; comp_type: string; filled: boolean }[];
};

function Explore() {
  const [q, setQ] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["pitches", "published"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pitches")
        .select("id, title, tagline, category, stage, cover_url, created_at, founder_id, pitch_roles(id, title, comp_type, filled)")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as PitchRow[];
    },
  });

  const filtered = data.filter((p) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return p.title.toLowerCase().includes(s) || p.tagline.toLowerCase().includes(s) || p.category.toLowerCase().includes(s);
  });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-hero-gradient">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h1 className="font-display text-3xl font-bold md:text-4xl">Explore pitches</h1>
          <p className="mt-2 text-muted-foreground">Find an idea worth building — and a team you belong on.</p>
          <div className="relative mt-6 max-w-lg">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title, tagline, category…" className="pl-9" />
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {isLoading && Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-2xl border border-border bg-card" />
            ))}
            {!isLoading && filtered.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center">
                <p className="text-muted-foreground">No pitches yet. Be the first!</p>
                <Link to="/pitches/new" className="mt-3 inline-block font-medium text-primary hover:underline">Post a pitch →</Link>
              </div>
            )}
                <PitchCard key={p.id} p={p} />
              ))}
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function PitchCard({ p }: { p: PitchRow }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: isSaved } = useQuery({
    queryKey: ["is-saved", p.id, user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase
        .from("saved_pitches")
        .select("pitch_id")
        .eq("user_id", user.id)
        .eq("pitch_id", p.id)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!user,
  });

  const toggleSave = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please log in to save pitches.");
      if (isSaved) {
        const { error } = await supabase.from("saved_pitches").delete().eq("user_id", user.id).eq("pitch_id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("saved_pitches").insert({ user_id: user.id, pitch_id: p.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["is-saved", p.id, user?.id] });
      qc.invalidateQueries({ queryKey: ["saved-pitches", user?.id] });
      if (isSaved) toast.success("Pitch removed from saved.");
      else toast.success("Pitch saved!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Link to="/pitch/$id" params={{ id: p.id }} className="group">
      <Card className="relative h-full overflow-hidden border-border/70 shadow-card transition-all group-hover:-translate-y-0.5 group-hover:shadow-glow">
        <Button 
          size="icon" 
          variant={isSaved ? "default" : "secondary"}
          className={`absolute right-3 top-3 z-10 h-8 w-8 rounded-full shadow-sm transition-opacity ${
            isSaved ? "opacity-100 bg-primary hover:bg-primary/90" : "bg-background/80 backdrop-blur-md opacity-0 group-hover:opacity-100"
          }`}
          onClick={(e) => {
            e.preventDefault();
            toggleSave.mutate();
          }}
          disabled={toggleSave.isPending}
        >
          <Bookmark className="h-4 w-4" />
          <span className="sr-only">{isSaved ? "Unsave" : "Save"}</span>
        </Button>
        {p.cover_url ? (
          <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
            <img src={p.cover_url} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
          </div>
        ) : (
          <div className="aspect-[16/9] w-full bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 transition-transform duration-500 group-hover:scale-105" />
        )}
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <Badge variant="secondary" className="capitalize">{p.category}</Badge>
            <Badge variant="outline" className="capitalize">{p.stage}</Badge>
          </div>
          <h3 className="mt-2 font-display text-lg font-semibold leading-tight">{p.title}</h3>
          {p.tagline && <p className="line-clamp-2 text-sm text-muted-foreground">{p.tagline}</p>}
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users2 className="h-3.5 w-3.5" />
            {p.pitch_roles.filter((r) => !r.filled).length} open role{p.pitch_roles.filter((r) => !r.filled).length === 1 ? "" : "s"}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
