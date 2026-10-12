import { Link } from 'react-router-dom';

export default function NajlExperience() {
  return (
    <div className="min-h-screen najl-theme najl-atmosphere">
      <div className="mx-auto max-w-6xl px-6 py-8 md:px-10">
        <header className="mb-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold tracking-[0.2em] text-[var(--najl-copper)]">
              N
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-[var(--najl-muted)]">NAJL</p>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-sm text-[var(--najl-muted)] md:flex">
            <a href="#story" className="transition hover:text-[var(--najl-ivory)]">Story</a>
            <a href="#experience" className="transition hover:text-[var(--najl-ivory)]">Experience</a>
            <a href="#contact" className="transition hover:text-[var(--najl-ivory)]">Contact</a>
          </nav>

          <Link
            to="/"
            className="rounded-full border border-[var(--najl-border)] bg-white/5 px-4 py-2 text-sm text-[var(--najl-ivory)] transition hover:border-[var(--najl-copper)] hover:text-[var(--najl-copper)]"
          >
            Open app
          </Link>
        </header>

        <main className="grid items-center gap-10 pb-12 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-8">
            <span className="inline-flex rounded-full border border-[var(--najl-border)] bg-white/5 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.28em] text-[var(--najl-copper)]">
              Crafted for better cuts
            </span>

            <h1 className="najl-display max-w-3xl text-[var(--najl-ivory)]">
              Precision planning for wood, waste, and every cut that matters.
            </h1>

            <p className="max-w-xl text-base leading-7 text-[var(--najl-muted)] md:text-lg">
              NAJL turns raw sheet stock into efficient, buildable layouts — helping teams reduce scrap,
              improve material usage, and make faster decisions on the shop floor.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                to="/"
                className="rounded-full bg-[var(--najl-copper)] px-6 py-3 text-sm font-medium text-[#111214] transition hover:brightness-110"
              >
                Start project
              </Link>
              <a
                href="#experience"
                className="rounded-full border border-[var(--najl-border)] bg-white/5 px-6 py-3 text-sm font-medium text-[var(--najl-ivory)] transition hover:border-[var(--najl-copper)] hover:text-[var(--najl-copper)]"
              >
                Learn more
              </a>
            </div>
          </section>

          <aside
            id="experience"
            className="rounded-[var(--najl-radius)] border border-[var(--najl-border)] bg-[var(--najl-panel)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--najl-muted)]">Workflow</p>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-emerald-300">
                Live
              </span>
            </div>

            <div className="space-y-4">
              {[
                ['Material intake', '90%+ utilization on repeat layouts'],
                ['Cut planning', 'Optimized placements with kerf awareness'],
                ['Waste recovery', 'Track offcuts and regenerate smarter plans'],
              ].map(([title, description]) => (
                <div
                  key={title}
                  className="rounded-2xl border border-[var(--najl-border)] bg-[var(--najl-panel-raised)] p-4"
                >
                  <p className="mb-1 text-lg font-medium text-[var(--najl-ivory)]">{title}</p>
                  <p className="text-sm leading-6 text-[var(--najl-muted)]">{description}</p>
                </div>
              ))}
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
