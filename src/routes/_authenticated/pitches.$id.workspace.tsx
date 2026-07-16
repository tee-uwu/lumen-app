import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";
import { PlusCircle, MessageSquare } from "lucide-react";
import MDEditor from '@uiw/react-md-editor';

const workspaceQueryOptions = (id: string) => queryOptions({
  queryKey: ["workspace", id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("pitches")
      .select(`
        id, title, founder_id,
        profiles!pitches_founder_profile_fkey(id, name, avatar_url, headline),
        pitch_members(id, role_title, user_id),
        tasks(id, title, description, status, assignee_id, profiles!tasks_assignee_id_fkey(name, avatar_url), created_at)
      `)
      .eq("id", id)
      .single();
    
    if (error) throw error;
    
    // Fetch profiles for the members since there's no direct FK to profiles from pitch_members
    if (data.pitch_members && data.pitch_members.length > 0) {
      const userIds = data.pitch_members.map(m => m.user_id);
      const { data: memberProfiles } = await supabase.from("profiles").select("id, name, avatar_url, headline").in("id", userIds);
      
      data.pitch_members = data.pitch_members.map((m: any) => ({
        ...m,
        profiles: memberProfiles?.find(p => p.id === m.user_id)
      }));
    }
    
    // Sort tasks newest first
    if (data.tasks) {
      data.tasks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    
    return data;
  }
});

export const Route = createFileRoute("/_authenticated/pitches/$id/workspace")({
  loader: ({ context: { queryClient }, params: { id } }) => {
    return queryClient.ensureQueryData(workspaceQueryOptions(id));
  },
  component: PitchWorkspace,
});

function PitchWorkspace() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState<string>("unassigned");
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);

  // Fetch pitch, members, and tasks instantly from cache (fetched in loader)
  const workspaceData = useSuspenseQuery(workspaceQueryOptions(id));

  const createTask = useMutation({
    mutationFn: async () => {
      if (!newTaskTitle.trim()) throw new Error("Title is required");
      const { error } = await supabase.from("tasks").insert({
        pitch_id: id,
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim(),
        assignee_id: newTaskAssignee === "unassigned" ? null : newTaskAssignee,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace", id] });
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskAssignee("unassigned");
      setIsTaskDialogOpen(false);
      toast.success("Task created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const { error } = await supabase.from("tasks").update({ status }).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { title, founder_id, profiles, pitch_members, tasks } = workspaceData.data || {};
  const pitch = { title, founder_id, profiles };
  const members = pitch_members;
  
  const allTeamMembers = [
    { 
      id: pitch.founder_id, 
      name: pitch.profiles?.name ?? "Founder", 
      avatar_url: pitch.profiles?.avatar_url,
      role_title: "Founder" 
    },
    ...(members?.map((m) => ({
      id: (m.profiles as unknown as {id: string}).id,
      name: (m.profiles as unknown as {name: string}).name ?? "Member",
      avatar_url: (m.profiles as unknown as {avatar_url: string})?.avatar_url,
      role_title: m.role_title
    })) || [])
  ];

  const tasksByStatus = {
    todo: tasks?.filter((t: any) => t.status === "todo") || [],
    in_progress: tasks?.filter((t: any) => t.status === "in_progress") || [],
    done: tasks?.filter((t: any) => t.status === "done") || [],
  };

  const statusColumns = [
    { id: "todo", label: "To Do" },
    { id: "in_progress", label: "In Progress" },
    { id: "done", label: "Done" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8">
          
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Link to="/pitch/$id" params={{ id: id }} className="text-sm text-muted-foreground hover:underline">
                  ← Back to Pitch
                </Link>
              </div>
              <h1 className="mt-2 font-display text-3xl font-bold">{pitch?.title} Workspace</h1>
              <p className="text-muted-foreground">Collaborate with your team and manage tasks.</p>
            </div>
            
            <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full shadow-sm"><PlusCircle className="mr-2 h-4 w-4" /> New Task</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create a Task</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Task Title</label>
                    <Input 
                      placeholder="E.g., Design landing page" 
                      value={newTaskTitle} 
                      onChange={(e) => setNewTaskTitle(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <div data-color-mode="light">
                      <MDEditor 
                        value={newTaskDescription} 
                        onChange={(v) => setNewTaskDescription(v || "")} 
                        preview="edit" 
                        height={200} 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Assign To</label>
                    <Select value={newTaskAssignee} onValueChange={setNewTaskAssignee}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a team member" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {allTeamMembers.map((tm) => (
                          <SelectItem key={tm.id} value={tm.id!}>{tm.name} ({tm.role_title})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsTaskDialogOpen(false)}>Cancel</Button>
                  <Button onClick={() => createTask.mutate()} disabled={createTask.isPending}>Create Task</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
            <div className="space-y-6">
              <h2 className="font-display text-xl font-semibold">Tasks</h2>
              
              <div className="flex overflow-x-auto snap-x md:grid md:grid-cols-3 gap-6 pb-4 -mx-4 px-4 md:mx-0 md:px-0">
                {statusColumns.map((col) => (
                  <div key={col.id} className="min-w-[85vw] md:min-w-0 snap-center flex flex-col gap-3 rounded-[24px] bg-card/60 backdrop-blur-sm border border-border/50 p-4 min-h-[400px]">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{col.label}</h3>
                      <Badge variant="secondary" className="rounded-full">
                        {tasksByStatus[col.id as keyof typeof tasksByStatus].length}
                      </Badge>
                    </div>
                    
                    {tasksByStatus[col.id as keyof typeof tasksByStatus].map((task) => (
                      <Card key={task.id} className="border-border/60 shadow-sm transition-shadow hover:shadow-md rounded-[20px]">
                        <CardHeader className="p-4 pb-2">
                          <div className="font-medium text-sm leading-tight">{task.title}</div>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 text-xs">
                          <div className="flex items-center justify-between mt-3">
                            <div className="flex items-center gap-2">
                              {task.profiles?.avatar_url ? (
                                <img src={task.profiles.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                              ) : (
                                <div className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                                  {task.profiles?.name ? task.profiles.name[0].toUpperCase() : "?"}
                                </div>
                              )}
                              <span className="text-muted-foreground truncate max-w-[80px]">
                                {task.profiles?.name ?? "Unassigned"}
                              </span>
                            </div>
                            
                            <Select 
                              value={task.status} 
                              onValueChange={(val) => updateTaskStatus.mutate({ taskId: task.id, status: val })}
                            >
                              <SelectTrigger className="h-7 w-auto border border-border/50 bg-muted/30 px-2 py-0 text-xs focus:ring-0 rounded-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {statusColumns.map(c => (
                                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    
                    {tasksByStatus[col.id as keyof typeof tasksByStatus].length === 0 && (
                      <div className="flex-1 border-2 border-dashed border-border/60 rounded-[20px] grid place-items-center text-muted-foreground text-sm py-8 opacity-50">
                        No tasks
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <h2 className="font-display text-xl font-semibold">Team Roster</h2>
              <Card className="rounded-[24px] border-border/60 bg-card/60 backdrop-blur-sm">
                <CardContent className="p-0 divide-y divide-border/50">
                  {allTeamMembers.map((tm) => (
                    <div key={tm.id} className="flex items-center gap-3 p-4">
                      <Link to="/users/$id" params={{ id: tm.id as string }} className="flex-shrink-0 transition-opacity hover:opacity-80">
                        {tm.avatar_url ? (
                          <img src={tm.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 font-semibold text-primary">
                            {tm.name[0].toUpperCase()}
                          </div>
                        )}
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link to="/users/$id" params={{ id: tm.id as string }} className="truncate font-medium text-sm hover:underline block">{tm.name}</Link>
                        <p className="truncate text-xs text-muted-foreground">{tm.role_title}</p>
                      </div>
                      {tm.id !== user?.id && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary" asChild>
                          <Link to="/messages" search={{ user: tm.id as string }}><MessageSquare className="h-4 w-4" /></Link>
                        </Button>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
          
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
