import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pitches/$id/manage")({
  component: ManagePitch,
});

function ManagePitch() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();

  const pitch = useQuery({
    queryKey: ["manage-pitch", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("pitches").select("*, pitch_roles(*)").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const applications = useQuery({
    queryKey: ["manage-apps", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("applications")
        .select("id, status, message, created_at, role_id, applicant_id, pitch_roles(title), profiles!applications_applicant_profile_fkey(name, headline, avatar_url, bio)")
        .eq("pitch_id", id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ appId, status, roleId, applicantId, roleTitle }: {
      appId: string; status: "accepted" | "rejected"; roleId: string; applicantId: string; roleTitle: string;
    }) => {
      const { error } = await supabase.from("applications").update({ status }).eq("id", appId);
      if (error) throw error;
      if (status === "accepted") {
        await supabase.from("pitch_roles").update({ filled: true }).eq("id", roleId);
        await supabase.from("pitch_members").upsert({ pitch_id: id, user_id: applicantId, role_id: roleId, role_title: roleTitle }, { onConflict: "pitch_id,user_id" });
      }
      
      // Notify the applicant
      await supabase.from("notifications").insert({
        user_id: applicantId,
        type: `application_${status}`,
        title: status === "accepted" ? "Application Accepted!" : "Application Update",
        content: status === "accepted" ? `You were accepted for the ${roleTitle} role!` : `Your application for ${roleTitle} was not selected.`,
        link: `/pitch/${id}`
      });
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["manage-apps", id] });
      qc.invalidateQueries({ queryKey: ["manage-pitch", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const navigate = Route.useNavigate();
  const startMessage = (userId: string) => {
    navigate({ to: "/messages", search: { user: userId } as never });
  };

  const deletePitch = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pitches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pitch deleted");
      qc.invalidateQueries();
      navigate({ to: "/dashboard" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (pitch.isLoading) return <Shell><div className="h-32 animate-pulse rounded-xl bg-card" /></Shell>;
  if (!pitch.data) return <Shell><p>Not found.</p></Shell>;
  if (pitch.data.founder_id !== user?.id) return <Shell><p>You don't have access to manage this pitch.</p></Shell>;

  return (
    <Shell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{pitch.data.title}</h1>
          <p className="text-sm text-muted-foreground">Manage roles and applications</p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline"><Link to="/pitch/$id" params={{ id }}>View public page</Link></Button>
          <Button asChild variant="secondary"><Link to="/pitches/$id/edit" params={{ id }}>Edit Pitch</Link></Button>
          <Button 
            variant="destructive" 
            onClick={() => {
              if (window.confirm("Are you sure you want to delete this pitch? This action cannot be undone.")) {
                deletePitch.mutate();
              }
            }}
            disabled={deletePitch.isPending}
          >
            {deletePitch.isPending ? "Deleting..." : "Delete Pitch"}
          </Button>
        </div>
      </div>

      <div className="mt-8 space-y-8">
        <section>
          <h2 className="font-display text-lg font-semibold">Applications</h2>
          <div className="mt-3 space-y-3">
            {applications.isLoading && <div className="h-24 animate-pulse rounded-xl bg-card" />}
            {applications.data?.length === 0 && <p className="text-sm text-muted-foreground">No applications yet.</p>}
            {applications.data?.map((a) => {
              const prof = a.profiles as unknown as { name: string; headline: string; avatar_url: string | null; bio: string } | null;
              const role = a.pitch_roles as unknown as { title: string } | null;
              return (
                <Card key={a.id}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Link to="/users/$id" params={{ id: a.applicant_id }} className="transition-opacity hover:opacity-80">
                          {prof?.avatar_url ? (
                            <img src={prof.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                          ) : (
                            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 font-semibold text-primary">
                              {(prof?.name ?? "?").slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </Link>
                        <div>
                          <Link to="/users/$id" params={{ id: a.applicant_id }} className="font-semibold hover:underline block">{prof?.name ?? "Applicant"}</Link>
                          <div className="text-xs text-muted-foreground">{prof?.headline} · applied for <span className="font-medium">{role?.title}</span></div>
                        </div>
                      </div>
                      <Badge className="capitalize" variant={a.status === "accepted" ? "default" : a.status === "rejected" ? "destructive" : "secondary"}>{a.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <p className="whitespace-pre-wrap text-sm">{a.message}</p>
                    {a.status === "pending" && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => updateStatus.mutate({ appId: a.id, status: "accepted", roleId: a.role_id, applicantId: a.applicant_id, roleTitle: role?.title ?? "" })}>Accept</Button>
                        <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ appId: a.id, status: "rejected", roleId: a.role_id, applicantId: a.applicant_id, roleTitle: role?.title ?? "" })}>Reject</Button>
                        <Button size="sm" variant="secondary" onClick={() => startMessage(a.applicant_id)}>Message</Button>
                      </div>
                    )}
                    {a.status === "accepted" && (
                       <div className="flex gap-2">
                         <Button size="sm" variant="secondary" onClick={() => startMessage(a.applicant_id)}>Message</Button>
                       </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1"><div className="mx-auto max-w-4xl px-4 py-10">{children}</div></main>
      <SiteFooter />
    </div>
  );
}
