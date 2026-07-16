import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Search, MapPin, MessageSquarePlus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/explore-talent")({
  head: () => ({
    meta: [
      { title: "Explore Talent — Lumen" },
      { name: "description", content: "Find engineers, designers, and operators for your startup." },
    ],
  }),
  component: ExploreTalent,
});

function ExploreTalent() {
  const [q, setQ] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const { data: myPitches = [] } = useQuery({
    queryKey: ["my-pitches-published"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pitches")
        .select("id, title")
        .eq("founder_id", user!.id)
        .eq("status", "published");
      if (error) throw error;
      return data;
    },
  });

  const filtered = profiles.filter((p) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    const skillsMatch = p.skills?.some((sk: string) => sk.toLowerCase().includes(s));
    return p.name?.toLowerCase().includes(s) || p.headline?.toLowerCase().includes(s) || skillsMatch;
  });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-hero-gradient">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h1 className="font-display text-3xl font-bold md:text-4xl">Explore talent</h1>
          <p className="mt-2 text-muted-foreground">Find co-founders and early team members looking to build.</p>
          <div className="relative mt-6 max-w-lg">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, headline, or skills (e.g. React)..." className="pl-9" />
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {isLoading && Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
            ))}
            {!isLoading && filtered.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center">
                <p className="text-muted-foreground">No talent found.</p>
              </div>
            )}
            {filtered.map((p) => (
              <Card key={p.id} className="flex flex-col border-border/70 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-glow">
                <CardHeader className="pb-3 flex flex-row items-start gap-4 space-y-0">
                  <Link to="/users/$id" params={{ id: p.id }} className="shrink-0">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                    ) : (
                      <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/15 font-semibold text-primary">
                        {(p.name || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to="/users/$id" params={{ id: p.id }} className="font-display font-semibold truncate block hover:underline">
                      {p.name || "Anonymous"}
                    </Link>
                    <div className="text-xs text-muted-foreground line-clamp-1">{p.headline}</div>
                    {p.location && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {p.location}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between pt-0 pb-4 space-y-4">
                  <div className="flex flex-wrap gap-1.5">
                    {p.skills?.slice(0, 5).map((s: string) => (
                      <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                    ))}
                    {p.skills && p.skills.length > 5 && (
                      <Badge variant="outline" className="text-[10px]">+{p.skills.length - 5}</Badge>
                    )}
                  </div>
                  
                  {user?.id !== p.id && (
                    <div className="pt-2 border-t border-border/50">
                      <InviteDialog 
                        talentId={p.id} 
                        talentName={p.name} 
                        myPitches={myPitches} 
                        onRequireAuth={() => navigate({ to: "/auth", search: { mode: "signup" } as never })}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function InviteDialog({ talentId, talentName, myPitches, onRequireAuth }: { 
  talentId: string, 
  talentName: string, 
  myPitches: {id: string, title: string}[],
  onRequireAuth: () => void 
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [selectedPitch, setSelectedPitch] = useState<string>("");

  const invite = useMutation({
    mutationFn: async () => {
      if (!selectedPitch) throw new Error("Select a pitch to invite them to.");
      const pitch = myPitches.find(p => p.id === selectedPitch);
      if (!pitch) throw new Error("Pitch not found.");
      
      const content = `Hi ${talentName.split(" ")[0] || "there"}, I'd like to invite you to check out my startup: ${pitch.title}. Would love to chat!`;
      
      const { data, error } = await supabase.from("messages").insert({
        sender_id: user!.id,
        receiver_id: talentId,
        pitch_id: selectedPitch,
        content
      }).select().single();
      if (error) throw error;
      
      await supabase.from("notifications").insert({
        user_id: talentId,
        type: "invite",
        title: "New Invitation",
        content: `You received an invitation to check out ${pitch.title}.`,
        link: `/messages`
      });
      return data;
    },
    onSuccess: () => {
      toast.success("Invitation sent!");
      setOpen(false);
      navigate({ to: "/messages" });
    },
    onError: (err: any) => toast.error(err.message)
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="secondary" 
          size="sm" 
          className="w-full h-8 text-xs"
          onClick={(e) => {
            if (!user) {
              e.preventDefault();
              onRequireAuth();
            }
          }}
        >
          <MessageSquarePlus className="mr-1.5 h-3.5 w-3.5" /> Invite to Pitch
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite {talentName}</DialogTitle>
        </DialogHeader>
        {myPitches.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            You don't have any published pitches yet.<br/>
            <Link to="/pitches/new" className="text-primary hover:underline mt-2 inline-block" onClick={() => setOpen(false)}>Create a pitch</Link>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Send a direct message inviting {talentName} to check out your startup and apply for a role.
            </p>
            <Select value={selectedPitch} onValueChange={setSelectedPitch}>
              <SelectTrigger>
                <SelectValue placeholder="Select a pitch..." />
              </SelectTrigger>
              <SelectContent>
                {myPitches.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button 
            disabled={!selectedPitch || invite.isPending || myPitches.length === 0} 
            onClick={() => invite.mutate()}
          >
            {invite.isPending ? "Sending..." : "Send Invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
