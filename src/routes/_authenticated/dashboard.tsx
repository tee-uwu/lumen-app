import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PlusCircle, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();

  const myPitches = useQuery({
    queryKey: ["my-pitches", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("pitches")
        .select("id, title, tagline, status, created_at, pitch_roles(id, filled)")
        .eq("founder_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const myApps = useQuery({
    queryKey: ["my-applications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("applications")
        .select("id, status, message, created_at, pitch_id, pitches(title, founder_id), pitch_roles(title)")
        .eq("applicant_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const recommendedPitches = useQuery({
    queryKey: ["recommended-pitches", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // 1. Get user profile skills
      const { data: profile } = await supabase.from("profiles").select("skills").eq("id", user!.id).single();
      if (!profile || !profile.skills || profile.skills.length === 0) return [];

      // 2. Query open roles requiring those skills
      const { data, error } = await supabase
        .from("pitch_roles")
        .select("pitch_id, pitches(id, title, tagline, status, created_at, pitch_roles(id, filled))")
        .eq("filled", false)
        .overlaps("skills", profile.skills);

      if (error) throw error;

      // 3. Deduplicate pitches
      const pitchMap = new Map();
      for (const r of data) {
        // filter out nulls if foreign key pitch is not found or not published (though we can't filter nested table status easily in one go, we can filter in memory)
        const p = r.pitches as any;
        if (p && p.status === "published" && p.id) {
          pitchMap.set(p.id, p);
        }
      }
      return Array.from(pitchMap.values()) as any[];
    },
  });

  const navigate = Route.useNavigate();
  const startMessage = (userId: string) => {
    navigate({ to: "/messages", search: { user: userId } as never });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-bold">Your dashboard</h1>
              <p className="text-sm text-muted-foreground">Manage your pitches and applications.</p>
            </div>
            <Button asChild><Link to="/pitches/new"><PlusCircle className="mr-1.5 h-4 w-4" /> New pitch</Link></Button>
          </div>

          <Tabs defaultValue="pitches" className="mt-8">
            <TabsList>
              <TabsTrigger value="pitches">My pitches</TabsTrigger>
              <TabsTrigger value="applications">My applications</TabsTrigger>
              <TabsTrigger value="recommended">Recommended for you</TabsTrigger>
            </TabsList>

            <TabsContent value="pitches" className="mt-6 space-y-3">
              {myPitches.isLoading && <div className="h-24 animate-pulse rounded-xl bg-card" />}
              {myPitches.data?.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
                  <Sparkles className="mx-auto h-8 w-8 text-primary" />
                  <p className="mt-3 font-medium">No pitches yet</p>
                  <p className="text-sm text-muted-foreground">Post your first idea and start building a team.</p>
                  <Button asChild className="mt-4"><Link to="/pitches/new">Create a pitch</Link></Button>
                </div>
              )}
              {myPitches.data?.map((p) => (
                <Card key={p.id}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <Link to="/pitch/$id" params={{ id: p.id }} className="font-display text-lg font-semibold hover:underline">{p.title}</Link>
                        {p.tagline && <p className="text-sm text-muted-foreground">{p.tagline}</p>}
                      </div>
                      <Badge variant={p.status === "published" ? "default" : "outline"} className="capitalize">{p.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between pt-0">
                    <span className="text-xs text-muted-foreground">
                      {p.pitch_roles.length} role{p.pitch_roles.length === 1 ? "" : "s"} · {p.pitch_roles.filter((r) => !r.filled).length} open
                    </span>
                    <div className="flex gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/pitches/$id/manage" params={{ id: p.id }}>Manage</Link>
                      </Button>
                      <Button asChild size="sm">
                        <Link to="/pitches/$id/workspace" params={{ id: p.id }}>Workspace</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="applications" className="mt-6 space-y-3">
              {myApps.isLoading && <div className="h-24 animate-pulse rounded-xl bg-card" />}
              {myApps.data?.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
                  <p className="font-medium">No applications yet</p>
                  <p className="text-sm text-muted-foreground">Browse ideas and apply for a role.</p>
                  <Button asChild className="mt-4" variant="outline"><Link to="/explore">Explore pitches</Link></Button>
                </div>
              )}
              {myApps.data?.map((a) => (
                <Card key={a.id}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <Link to="/pitch/$id" params={{ id: a.pitch_id }} className="font-medium hover:underline">
                          {(a.pitches as unknown as { title: string } | null)?.title ?? "Pitch"}
                        </Link>
                        <div className="text-xs text-muted-foreground">Role: {(a.pitch_roles as unknown as { title: string } | null)?.title}</div>
                      </div>
                      <div className="flex gap-2">
                        {a.status === "accepted" && (
                          <>
                            <Button size="sm" variant="secondary" onClick={() => startMessage((a.pitches as unknown as { founder_id: string })?.founder_id)}>
                              Message Founder
                            </Button>
                            <Button size="sm" asChild>
                              <Link to="/pitches/$id/workspace" params={{ id: a.pitch_id }}>Workspace</Link>
                            </Button>
                          </>
                        )}
                        <Badge className="capitalize" variant={a.status === "accepted" ? "default" : a.status === "rejected" ? "destructive" : "secondary"}>{a.status}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0"><p className="text-sm text-muted-foreground line-clamp-2">{a.message}</p></CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="recommended" className="mt-6 space-y-3">
              {recommendedPitches.isLoading && <div className="h-24 animate-pulse rounded-xl bg-card" />}
              {recommendedPitches.data?.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
                  <Sparkles className="mx-auto h-8 w-8 text-primary" />
                  <p className="mt-3 font-medium">No recommendations right now</p>
                  <p className="text-sm text-muted-foreground">Add more skills to your profile to see tailored pitch recommendations.</p>
                  <Button asChild className="mt-4" variant="outline"><Link to="/profile">Edit Profile</Link></Button>
                </div>
              )}
              {recommendedPitches.data?.map((p) => (
                <Card key={p.id}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <Link to="/pitch/$id" params={{ id: p.id }} className="font-display text-lg font-semibold hover:underline">{p.title}</Link>
                        {p.tagline && <p className="text-sm text-muted-foreground">{p.tagline}</p>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between pt-0">
                    <span className="text-xs text-muted-foreground">
                      {p.pitch_roles.length} role{p.pitch_roles.length === 1 ? "" : "s"} · {p.pitch_roles.filter((r: any) => !r.filled).length} open
                    </span>
                    <Button asChild size="sm" variant="secondary">
                      <Link to="/pitch/$id" params={{ id: p.id }}>View pitch</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
