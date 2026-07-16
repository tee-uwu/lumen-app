import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, User } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesRoute,
  validateSearch: (search: Record<string, unknown>): { user?: string } => {
    return { user: search.user as string | undefined };
  },
});

function MessagesRoute() {
  const { user: authUser } = useAuth();
  const qc = useQueryClient();
  const search = Route.useSearch();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(search.user || null);
  const [messageInput, setMessageInput] = useState("");

  useEffect(() => {
    if (search.user) {
      setSelectedUserId(search.user);
    }
  }, [search.user]);

  const { data: contacts = [] } = useQuery({
    queryKey: ["messages-contacts", authUser?.id],
    queryFn: async () => {
      if (!authUser?.id) return [];
      // Fetch all distinct users this person has messaged or received messages from
      const { data: sentData } = await supabase
        .from("messages")
        .select("receiver_id, receiver:profiles!messages_receiver_profile_fkey(id, name, avatar_url)")
        .eq("sender_id", authUser.id);
      
      const { data: recvData } = await supabase
        .from("messages")
        .select("sender_id, sender:profiles!messages_sender_profile_fkey(id, name, avatar_url)")
        .eq("receiver_id", authUser.id);
      
      const uniqueContacts = new Map();
      
      if (search.user) {
        // Optimistically add the selected user if not in contacts yet
        const { data: directUser } = await supabase.from("profiles").select("id, name, avatar_url").eq("id", search.user).maybeSingle();
        if (directUser) uniqueContacts.set(directUser.id, directUser);
      }

      sentData?.forEach((m: any) => {
        if (m.receiver) uniqueContacts.set(m.receiver_id, m.receiver);
      });
      recvData?.forEach((m: any) => {
        if (m.sender) uniqueContacts.set(m.sender_id, m.sender);
      });
      
      return Array.from(uniqueContacts.values());
    },
    enabled: !!authUser,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", authUser?.id, selectedUserId],
    queryFn: async () => {
      if (!authUser?.id || !selectedUserId) return [];
      const { data, error } = await supabase
        .from("messages")
        .select(`
          *,
          sender:profiles!messages_sender_profile_fkey(name, avatar_url),
          receiver:profiles!messages_receiver_profile_fkey(name, avatar_url)
        `)
        .or(`and(sender_id.eq.${authUser.id},receiver_id.eq.${selectedUserId}),and(sender_id.eq.${selectedUserId},receiver_id.eq.${authUser.id})`)
        .order("created_at", { ascending: true });
        
      if (error) throw error;
      
      // Mark as read
      const unreadIds = data.filter(m => m.receiver_id === authUser.id && !m.read_at).map(m => m.id);
      if (unreadIds.length > 0) {
        await supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
        qc.invalidateQueries({ queryKey: ["messages-contacts"] });
        qc.invalidateQueries({ queryKey: ["unread-messages"] });
      }
      
      return data;
    },
    enabled: !!authUser && !!selectedUserId,
  });

  useEffect(() => {
    if (!authUser) return;
    const channel = supabase.channel('messages-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${authUser.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["messages"] });
          qc.invalidateQueries({ queryKey: ["messages-contacts"] });
          qc.invalidateQueries({ queryKey: ["unread-messages"] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [authUser, qc]);

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!authUser?.id || !selectedUserId) throw new Error("No receiver selected");
      const { error } = await supabase
        .from("messages")
        .insert({
          sender_id: authUser.id,
          receiver_id: selectedUserId,
          content,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessageInput("");
      qc.invalidateQueries({ queryKey: ["messages", authUser?.id, selectedUserId] });
      qc.invalidateQueries({ queryKey: ["messages-contacts", authUser?.id] });
    },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-muted/20">
        <div className="mx-auto max-w-5xl py-8 px-4">
          <div className="grid h-[calc(100vh-10rem)] grid-cols-1 overflow-hidden rounded-3xl border bg-card shadow-card md:grid-cols-[300px_1fr]">
            
            {/* Sidebar */}
            <div className="flex flex-col border-r bg-surface/50">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Messages</h2>
              </div>
              <ScrollArea className="flex-1">
                <div className="flex flex-col gap-1 p-2">
                  {contacts.length === 0 && (
                    <p className="p-4 text-sm text-muted-foreground text-center">No conversations yet.</p>
                  )}
                  {contacts.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => setSelectedUserId(contact.id)}
                      className={`flex items-center gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-muted ${
                        selectedUserId === contact.id ? "bg-muted" : ""
                      }`}
                    >
                      <Avatar>
                        <AvatarImage src={contact.avatar_url || ""} />
                        <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col overflow-hidden">
                        <span className="truncate font-medium">{contact.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Chat Area */}
            {selectedUserId ? (
              <div className="flex flex-col bg-surface-2/30">
                <div className="flex items-center p-4 border-b bg-surface/50">
                  <span className="font-semibold">
                    {contacts.find((c) => c.id === selectedUserId)?.name || "Chat"}
                  </span>
                </div>
                
                <ScrollArea className="flex-1 p-4 flex flex-col-reverse">
                  <div className="flex flex-col justify-end gap-4 pb-4 min-h-full">
                    {messages.length === 0 && (
                      <p className="text-center text-sm text-muted-foreground mt-8">No messages yet. Say hi!</p>
                    )}
                    {messages.map((msg) => {
                      const isMe = msg.sender_id === authUser?.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex w-max max-w-[75%] flex-col gap-1 rounded-2xl px-4 py-2 text-sm ${
                            isMe
                              ? "ml-auto bg-primary text-primary-foreground rounded-tr-sm"
                              : "bg-surface text-foreground rounded-tl-sm border shadow-sm"
                          }`}
                        >
                          <span>{msg.content}</span>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
                
                <div className="p-4 border-t bg-surface/50">
                  <form
                    className="flex items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (messageInput.trim()) sendMessage.mutate(messageInput.trim());
                    }}
                  >
                    <Input
                      placeholder="Type your message..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      className="rounded-full flex-1"
                    />
                    <Button type="submit" size="icon" className="rounded-full shrink-0" disabled={!messageInput.trim() || sendMessage.isPending}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="hidden flex-col items-center justify-center p-8 text-center md:flex bg-surface-2/30">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 mb-4">
                  <Send className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold">Your Messages</h3>
                <p className="text-sm text-muted-foreground max-w-sm mt-2">
                  Select a conversation from the sidebar to view messages, or start a new chat from a Pitch.
                </p>
              </div>
            )}
            
          </div>
        </div>
      </main>
    </div>
  );
}
