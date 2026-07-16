import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Compass, LayoutDashboard, LogOut, PlusCircle, UserCircle2, MessageSquare } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationsBell } from "@/components/notifications-bell";

export function SiteHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link to="/" className="group flex items-center gap-2.5 font-display text-xl font-bold tracking-tight">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary/80 to-primary text-primary-foreground shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:shadow">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Lumen</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          <NavLink to="/explore" active={path.startsWith("/explore") && !path.startsWith("/explore-talent") || path.startsWith("/pitch")}>
            <Compass className="mr-1.5 h-4 w-4" /> Pitches
          </NavLink>
          <NavLink to="/explore-talent" active={path.startsWith("/explore-talent") || path.startsWith("/users")}>
            <UserCircle2 className="mr-1.5 h-4 w-4" /> Talent
          </NavLink>
          {user && (
            <NavLink to="/dashboard" active={path.startsWith("/dashboard")}>
              <LayoutDashboard className="mr-1.5 h-4 w-4" /> Dashboard
            </NavLink>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {user && (
            <>
              <MessagesBadge />
              <NotificationsBell />
            </>
          )}
          {user ? (
            <>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link to="/pitches/new"><PlusCircle className="mr-1.5 h-4 w-4" /> New pitch</Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <UserCircle2 className="h-6 w-6" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">{user.email}</div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link to="/dashboard">Dashboard</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/profile">Edit profile</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/pitches/new">New pitch</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/saved">Saved pitches</Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm"><Link to="/auth">Sign in</Link></Button>
              <Button asChild size="sm"><Link to="/auth" search={{ mode: "signup" } as never}>Join free</Link></Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

function MessagesBadge() {
  const { user } = useAuth();
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-messages", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .is("read_at", null);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  return (
    <Button asChild variant="ghost" size="icon" className="relative rounded-full">
      <Link to="/messages">
        <MessageSquare className="h-[1.2rem] w-[1.2rem]" />
        {unreadCount > 0 && (
          <span className="absolute right-2 top-2 flex h-2 w-2 rounded-full bg-destructive" />
        )}
        <span className="sr-only">Messages</span>
      </Link>
    </Button>
  );
}
