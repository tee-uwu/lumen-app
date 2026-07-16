import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookmarkMinus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/saved")({
  component: SavedPitchesRoute,
});

function SavedPitchesRoute() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: savedPitches = [], isLoading } = useQuery({
    queryKey: ["saved-pitches", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("saved_pitches")
        .select(`
          pitch_id,
          created_at,
          pitches (
            id, title, tagline, category, stage, cover_url,
            profiles!pitches_founder_profile_fkey(name, avatar_url)
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
        
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const removeBookmark = useMutation({
    mutationFn: async (pitchId: string) => {
      if (!user) return;
      const { error } = await supabase
        .from("saved_pitches")
        .delete()
        .eq("user_id", user.id)
        .eq("pitch_id", pitchId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-pitches"] });
      toast.success("Pitch removed from saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-muted/20">
        <div className="mx-auto max-w-5xl py-12 px-4">
          <h1 className="font-display text-3xl font-bold">Saved Pitches</h1>
          <p className="mt-2 text-muted-foreground">Pitches you've bookmarked for later.</p>
          
          {isLoading ? (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-[300px] animate-pulse rounded-2xl bg-card" />
              ))}
            </div>
          ) : savedPitches.length === 0 ? (
            <div className="mt-12 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 bg-surface/30 py-20 text-center">
              <h3 className="font-display text-xl font-semibold">No saved pitches yet</h3>
              <p className="mt-2 text-muted-foreground max-w-sm">
                Explore pitches and bookmark the ones that catch your eye!
              </p>
              <Button asChild className="mt-6" variant="outline">
                <Link to="/explore">Explore Pitches</Link>
              </Button>
            </div>
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {savedPitches.map((sp: any) => {
                const p = sp.pitches;
                if (!p) return null;
                return (
                  <Card key={p.id} className="group relative flex h-full flex-col overflow-hidden transition-all hover:-translate-y-1 hover:shadow-md border-border/50 bg-card/60 backdrop-blur-sm">
                    <CardHeader className="p-0">
                      <div className="relative h-40 w-full overflow-hidden bg-muted">
                        {p.cover_url ? (
                          <img src={p.cover_url} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10" />
                        )}
                        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                          <Badge variant="secondary" className="bg-background/80 capitalize backdrop-blur-md">{p.category}</Badge>
                          <Badge variant="outline" className="bg-background/80 capitalize backdrop-blur-md">{p.stage}</Badge>
                        </div>
                        <Button 
                          size="icon" 
                          variant="secondary" 
                          className="absolute right-3 top-3 h-8 w-8 rounded-full bg-background/80 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.preventDefault();
                            removeBookmark.mutate(p.id);
                          }}
                          disabled={removeBookmark.isPending}
                        >
                          <BookmarkMinus className="h-4 w-4" />
                          <span className="sr-only">Remove</span>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col p-5 pt-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {p.profiles?.avatar_url ? (
                          <img src={p.profiles.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                        ) : (
                          <div className="grid h-5 w-5 place-items-center rounded-full bg-primary/15 font-semibold text-primary">
                            {(p.profiles?.name ?? "?").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <span className="truncate">{p.profiles?.name ?? "Anonymous"}</span>
                      </div>
                      
                      <h3 className="mt-3 line-clamp-1 font-display text-lg font-semibold leading-tight"><Link to="/pitch/$id" params={{ id: p.id }} className="before:absolute before:inset-0">{p.title}</Link></h3>
                      {p.tagline && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground flex-1">{p.tagline}</p>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
