import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-surface-2/40 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground md:flex-row">
        <p>© {new Date().getFullYear()} Lumen. Built for founders and builders.</p>
        <div className="flex items-center gap-5">
          <Link to="/explore" className="hover:text-foreground">Explore</Link>
          <Link to="/auth" className="hover:text-foreground">Sign in</Link>
        </div>
      </div>
    </footer>
  );
}
