import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, MapPin, Briefcase } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

const userProfileQueryOptions = (id: string) => queryOptions({
  queryKey: ["user-profile", id],
  queryFn: async () => {
    // Fetch profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();
    
    if (profileError) throw profileError;

    // Fetch founded pitches
    const { data: founded } = await supabase
      .from("pitches")
      .select("id, title, tagline, status, stage")
      .eq("founder_id", id)
      .eq("status", "published");

    // Fetch roles
    const { data: roles } = await supabase
      .from("pitch_members")
      .select("role_title, pitches(id, title, status)")
      .eq("user_id", id);
      
    // Filter out unpublished pitches from roles
    const publicRoles = (roles || []).filter((r: any) => r.pitches?.status === "published");

    return { profile, founded: founded || [], roles: publicRoles };
  }
});

export const Route = createFileRoute("/users/$id")({
  loader: ({ context: { queryClient }, params: { id } }) => {
    return queryClient.ensureQueryData(userProfileQueryOptions(id));
  },
  component: UserProfile,
});

function UserProfile() {
  const { id } = Route.useParams();
  const { data: { profile, founded, roles } } = useSuspenseQuery(userProfileQueryOptions(id));
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-muted/10">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-12">
          
          <div className="flex flex-col md:flex-row gap-10 items-start">
            {/* Left sidebar: Avatar and Info */}
            <div className="w-full md:w-1/3 flex flex-col items-center text-center space-y-6">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.name} className="h-40 w-40 rounded-full object-cover shadow-sm border-4 border-background" />
              ) : (
                <div className="grid h-40 w-40 place-items-center rounded-full bg-primary/10 text-5xl font-bold text-primary shadow-sm border-4 border-background">
                  {profile.name?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
              
              <div className="space-y-1">
                <h1 className="font-display text-3xl font-bold">{profile.name}</h1>
                <p className="text-muted-foreground">{profile.headline}</p>
              </div>

              {user?.id !== profile.id && (
                <Button className="w-full rounded-full" asChild>
                  <Link to="/messages" search={{ user: profile.id } as never}>Message</Link>
                </Button>
              )}
              {user?.id === profile.id && (
                <Button className="w-full rounded-full" variant="outline" asChild>
                  <Link to="/profile">Edit Profile</Link>
                </Button>
              )}

              <div className="flex flex-col gap-3 w-full text-sm text-left mt-4 text-muted-foreground bg-card/60 rounded-2xl p-4 border border-border/50">
                {profile.location && (
                  <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> <span className="truncate">{profile.location}</span></div>
                )}
                {profile.website && (
                  <div className="flex items-center gap-2"><ExternalLink className="h-4 w-4 text-primary" /> <a href={profile.website} target="_blank" rel="noreferrer" className="hover:underline truncate">{profile.website.replace(/^https?:\/\//, '')}</a></div>
                )}
                {profile.linkedin && (
                  <div className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-primary" /> <a href={profile.linkedin} target="_blank" rel="noreferrer" className="hover:underline truncate">LinkedIn</a></div>
                )}
                {!profile.location && !profile.website && !profile.linkedin && (
                  <p className="text-center italic">No contact info provided</p>
                )}
              </div>
            </div>

            {/* Right content: Bio, Skills, Work */}
            <div className="w-full md:w-2/3 space-y-10">
              
              {profile.bio && (
                <section>
                  <h2 className="font-display text-xl font-semibold mb-4">About</h2>
                  <p className="whitespace-pre-wrap leading-relaxed text-foreground/80">{profile.bio}</p>
                </section>
              )}
              
              {profile.skills && profile.skills.length > 0 && (
                <section>
                  <h2 className="font-display text-xl font-semibold mb-4">Skills</h2>
                  <div className="flex flex-wrap gap-2">
                    {profile.skills.map((s: string) => <Badge key={s} variant="secondary" className="rounded-full px-3 font-medium">{s}</Badge>)}
                  </div>
                </section>
              )}

              {founded.length > 0 && (
                <section>
                  <h2 className="font-display text-xl font-semibold mb-4">Founded Pitches</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {founded.map((p) => (
                      <Link key={p.id} to="/pitch/$id" params={{ id: p.id }}>
                        <Card className="h-full transition-shadow hover:shadow-md hover:border-primary/50 rounded-2xl">
                          <CardHeader className="p-4 pb-2">
                            <Badge className="w-fit mb-2 capitalize rounded-full" variant="outline">{p.stage}</Badge>
                            <CardTitle className="text-base leading-tight">{p.title}</CardTitle>
                          </CardHeader>
                          <CardContent className="p-4 pt-0 text-sm text-muted-foreground line-clamp-2">
                            {p.tagline}
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {roles.length > 0 && (
                <section>
                  <h2 className="font-display text-xl font-semibold mb-4">Team Roles</h2>
                  <div className="space-y-3">
                    {roles.map((r: any, i: number) => (
                      <Link key={i} to="/pitch/$id" params={{ id: r.pitches.id }} className="block">
                        <Card className="transition-colors hover:bg-muted/50 rounded-2xl border-border/50">
                          <CardContent className="flex items-center justify-between p-4">
                            <div>
                              <div className="font-medium">{r.role_title}</div>
                              <div className="text-sm text-muted-foreground">at <span className="font-medium text-foreground">{r.pitches.title}</span></div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
              
            </div>
          </div>
          
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
