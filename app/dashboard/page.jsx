"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib";
import { useRouter } from "next/navigation";
import Shell from "../components/Shell";
import Icon from "../components/Icon";

export default function Dashboard() {
  const [u, setU] = useState(null), [p, setP] = useState(null), [r, setR] = useState([]);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push("/login");
      setU(user);
      const a = await supabase.from("profiles").select("*").eq("id", user.id).single(); setP(a.data);
      const rr = await supabase.from("releases").select("*").eq("artist_id", user.id).order("created_at", { ascending: false }); setR(rr.data || []);
    })();
  }, [router]);

  const name = p?.artist_name || u?.email?.split("@")[0] || "Artist";
  const stats = useMemo(() => ({
    total: r.length,
    drafts: r.filter(x => x.status === "draft").length,
    pending: r.filter(x => ["submitted", "qa", "pending"].includes(x.status)).length,
    live: r.filter(x => ["live", "delivered"].includes(x.status)).length,
  }), [r]);
  const latest = r[0];

  return (
    <Shell>
      <div className="page">
        <header className="page-head">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h1>Welcome back, <em>{name}</em></h1>
            <p className="lead">Here's a quick look at your distribution.</p>
          </div>
          <a className="btn-primary" href="/submit"><Icon name="plus" /> Submit a release</a>
        </header>

        <section className="stats-grid" aria-label="Release statistics">
          <Stat icon="disc" n={stats.total} label="Total releases" />
          <Stat icon="file" n={stats.drafts} label="Drafts" />
          <Stat icon="clock" n={stats.pending} label="Pending review" />
          <Stat icon="check" n={stats.live} label="Live" />
        </section>

        <section className="two-grid">
          <div className="dash-card latest-card">
            <div className="card-kicker">Latest release</div>
            {latest ? (
              <>
                <h3>{latest.title}</h3>
                <div className="release-meta">
                  <span className={`pill pill-${latest.status || "submitted"}`}>{latest.status || "Submitted"}</span>
                  <span>{typeLabel(latest.release_type)}</span>
                  <span>{latest.release_date || "—"}</span>
                </div>
              </>
            ) : (
              <p className="empty-line">No releases yet. Submit your first one to get started.</p>
            )}
          </div>
          <div className="dash-card">
            <div className="card-kicker">Support</div>
            <p className="support-text">No open tickets. If you need help with a release, contact the YOUNG BOYZ team.</p>
          </div>
        </section>

        <section className="panel" aria-label="Quick actions">
          <div className="panel-head"><h2>Quick actions</h2></div>
          <div className="quick-grid">
            <a href="/submit"><span className="qa-ico"><Icon name="upload" /></span><span>Submit a release<small>Send music for QA &amp; delivery</small></span><Icon name="arrow" size={16} /></a>
            <a href="/profile"><span className="qa-ico"><Icon name="user" /></span><span>Platform profiles<small>Spotify &amp; Apple Music</small></span><Icon name="arrow" size={16} /></a>
            <a href="#releases"><span className="qa-ico"><Icon name="disc" /></span><span>My releases<small>See status of every release</small></span><Icon name="arrow" size={16} /></a>
          </div>
        </section>

        <section className="panel" id="releases" aria-label="My releases">
          <div className="panel-head">
            <h2>My releases</h2>
            <span className="panel-note">{r.length} total</span>
          </div>
          {r.length ? (
            <div className="table">
              <div className="table-head"><span>Title</span><span>Type</span><span>Release date</span><span>Status</span></div>
              {r.map(x => (
                <div className="table-row" key={x.id}>
                  <b>{x.title}</b>
                  <span className="cell-muted">{typeLabel(x.release_type)}</span>
                  <span className="cell-muted">{x.release_mode === "today" && !x.release_date ? "Today" : x.release_date || "—"}</span>
                  <span><span className={`pill pill-${x.status}`}>{x.status}</span>{x.status === "draft" && <> <a className="draft-link" href={`/submit?id=${x.id}`}>Continue →</a></>}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>You haven't submitted any releases yet.</p>
              <a className="btn-primary" href="/submit"><Icon name="plus" /> Submit your first release</a>
            </div>
          )}
        </section>

      </div>
    </Shell>
  );
}

const typeLabel = t => !t ? "Single" : t.toLowerCase() === "ep" ? "EP" : t.charAt(0).toUpperCase() + t.slice(1);

function Stat({ icon, n, label }) {
  return (
    <div className="stat-card">
      <div className="stat-top"><span>{label}</span><div className="stat-ico"><Icon name={icon} size={18} /></div></div>
      <strong>{n}</strong>
    </div>
  );
}
