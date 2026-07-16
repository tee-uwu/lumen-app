import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";
import { ArrowRight, Handshake, Lightbulb, ShieldCheck, Users2, Rocket, Coins } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-hero-gradient">
          <div className="mx-auto max-w-6xl px-4 pb-20 pt-16 md:pt-24">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Free to join. Secure by design.
              </span>
              <h1 className="mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
                Pitch your idea.<br />
                <span className="text-gradient-primary">Assemble the team that builds it.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
                Lumen is where founders post ideas, list the roles they need, and match with builders,
                designers and operators — for equity, revenue share or pay.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg">
                  <Link to="/auth" search={{ mode: "signup" } as never}>
                    Start pitching free <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/explore">Explore ideas</Link>
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">No credit card. Backed by row-level security & encrypted auth.</p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <div className="mb-12 text-center">
            <h2 className="font-display text-3xl font-bold md:text-4xl">How Lumen works</h2>
            <p className="mt-3 text-muted-foreground">Three steps from spark to shipping team.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <Step n="1" icon={<Lightbulb className="h-5 w-5" />} title="Post your pitch"
              body="Share the problem, the solution and where you're at. Draft it in minutes." />
            <Step n="2" icon={<Users2 className="h-5 w-5" />} title="List open roles"
              body="Add roles you need — engineer, designer, growth — with the compensation you're offering." />
            <Step n="3" icon={<Handshake className="h-5 w-5" />} title="Match & build"
              body="Review applicants, accept your team, and start building together." />
          </div>
        </section>

        {/* Compensation */}
        <section className="bg-surface-2/60 py-20">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="font-display text-3xl font-bold md:text-4xl">
                Any deal structure that works for you.
              </h2>
              <p className="mt-4 text-muted-foreground">
                Set the terms on every role you post. Whether you're bootstrapping with equity, sharing
                future revenue, or paying up-front — it's transparent from the first message.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                <Bullet icon={<Coins className="h-4 w-4" />}>Equity — % of the company for early builders</Bullet>
                <Bullet icon={<Rocket className="h-4 w-4" />}>Revenue share — a slice of what you earn</Bullet>
                <Bullet icon={<ShieldCheck className="h-4 w-4" />}>Paid — hourly, fixed, or milestone</Bullet>
              </ul>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Example pitch</div>
              <div className="mt-2 font-display text-xl font-semibold">Nomad — a marketplace for remote work retreats</div>
              <p className="mt-2 text-sm text-muted-foreground">Looking for 3 co-founders to launch by Q2.</p>
              <div className="mt-5 space-y-2">
                <RoleRow role="Full-stack engineer" comp="8% equity" />
                <RoleRow role="Product designer" comp="5% equity" />
                <RoleRow role="Growth marketer" comp="Revenue share" />
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 py-24 text-center">
          <h2 className="font-display text-3xl font-bold md:text-4xl">Your idea deserves a team.</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Join thousands of founders and builders already forging what's next.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth" search={{ mode: "signup" } as never}>
                Create your free account <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Step({ n, icon, title, body }: { n: string; icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="relative rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</span>
        <span className="font-display text-xs font-semibold text-muted-foreground">STEP {n}</span>
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function Bullet({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 grid h-6 w-6 place-items-center rounded-md bg-primary/10 text-primary">{icon}</span>
      <span>{children}</span>
    </li>
  );
}

function RoleRow({ role, comp }: { role: string; comp: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2/50 px-3 py-2 text-sm">
      <span className="font-medium">{role}</span>
      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">{comp}</span>
    </div>
  );
}
