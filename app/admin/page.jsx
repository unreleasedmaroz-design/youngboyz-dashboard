"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib";
import { useRouter } from "next/navigation";
import Shell from "../components/Shell";
import Icon from "../components/Icon";
import { STATUSES, fmt12, fmtDate, fmtSize, safe } from "../data";

const genPass = (n = 12) => { const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"; const a = crypto.getRandomValues(new Uint32Array(n)); return Array.from(a, x => c[x % c.length]).join(""); };
const FILTERS = [["review", "Needs review"], ["all", "All submitted"], ["approved", "Approved"], ["done", "Delivered / Live"], ["rejected", "Rejected"], ["draft", "Drafts"]];
const inFilter = (f, s) => f === "all" ? s !== "draft" : f === "review" ? ["submitted", "qa", "pending"].includes(s) : f === "done" ? ["delivered", "live"].includes(s) : s === f;

export default function Admin() {
  const router = useRouter();
  const [artists, setArtists] = useState([]), [releases, setReleases] = useState([]), [requests, setRequests] = useState([]);
  const [err, setErr] = useState(""), [ok, setOk] = useState(""), [filter, setFilter] = useState("review"), [openId, setOpenId] = useState(null), [tracksBy, setTracksBy] = useState({});
  const [ready, setReady] = useState(false);
  // create-account form
  const [cName, setCName] = useState(""), [cEmail, setCEmail] = useState(""), [cPass, setCPass] = useState(genPass()), [creating, setCreating] = useState(false), [creds, setCreds] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push("/login");
      const p = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (p.data?.role !== "admin") return router.push("/dashboard");
      setReady(true);
      load();
    })();
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const [a, r, q] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("releases").select("*").order("created_at", { ascending: false }),
      supabase.from("profile_requests").select("*").order("created_at", { ascending: false }),
    ]);
    if (a.error || r.error || q.error) setErr((a.error || r.error || q.error).message);
    setArtists(a.data || []); setReleases(r.data || []); setRequests(q.data || []);
  }

  const byId = useMemo(() => Object.fromEntries(artists.map(a => [a.id, a])), [artists]);
  const relById = useMemo(() => Object.fromEntries(releases.map(r => [r.id, r])), [releases]);
  const shown = releases.filter(r => inFilter(filter, r.status));
  const nameOf = id => byId[id]?.artist_name || byId[id]?.email || "Unknown artist";

  async function setStatus(id, s) {
    setErr("");
    const { error } = await supabase.from("releases").update({ status: s, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) setErr(error.message); else setReleases(a => a.map(x => x.id === id ? { ...x, status: s } : x));
  }
  async function setReqStatus(id, s) {
    const { error } = await supabase.from("profile_requests").update({ status: s }).eq("id", id);
    if (error) setErr(error.message); else setRequests(a => a.map(q => q.id === id ? { ...q, status: s } : q));
  }

  async function toggle(r) {
    if (openId === r.id) return setOpenId(null);
    setOpenId(r.id);
    if (!tracksBy[r.id]) {
      const { data, error } = await supabase.from("tracks").select("*").eq("release_id", r.id).order("position");
      if (error) setErr(error.message); else setTracksBy(m => ({ ...m, [r.id]: data || [] }));
    }
  }

  async function download(bucket, path, filename) {
    setErr("");
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300, { download: filename });
    if (error) return setErr(`Download failed: ${error.message}`);
    const a = document.createElement("a"); a.href = data.signedUrl; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  }

  function metaText(r, tracks) {
    const a = byId[r.artist_id];
    const L = [
      `RELEASE: ${r.title} (${r.release_type})`, `ARTIST: ${r.artist_name || a?.artist_name || ""}  <${a?.email || ""}>`,
      `RELEASE DATE: ${r.release_mode === "today" && !r.release_date ? "today" : fmtDate(r.release_date)} at ${fmt12(r.release_time)} (${r.release_tz || "local time"})`,
      `GENRE: ${r.genre || ""}${r.sub_genre ? ` / ${r.sub_genre}` : ""}`, `ARTWORK BY: ${r.artwork_by || ""}`,
      ...Object.entries(r.dsp_profiles || {}).map(([p, d]) => `${p.toUpperCase()}: ${d.choice === "existing" ? d.url : "NO PROFILE — create one"}`),
      `PITCH: ${r.pitch || ""}`, `NOTES: ${r.notes || ""}`, "",
      ...tracks.flatMap((t, i) => [
        `TRACK ${i + 1}: ${t.title}${t.version ? ` (${t.version})` : ""}`, `  Featured: ${t.featured_artists || "-"}`, `  Explicit: ${t.explicit}`, `  Language: ${t.language || "-"}`, `  ISRC: ${t.isrc || "-"}`,
        `  Credits: ${(t.contributors || []).map(c => `${c.name} (${c.role})`).join(", ") || "-"}`, `  Lyrics: ${t.lyrics ? "\n" + t.lyrics : "-"}`, "",
      ]),
    ];
    return L.join("\n");
  }
  async function copyMeta(r) {
    try { await navigator.clipboard.writeText(metaText(r, tracksBy[r.id] || [])); setOk("Release details copied."); setTimeout(() => setOk(""), 2500); } catch { setErr("Couldn't copy — select the text manually."); }
  }

  /* ---------- artist accounts ---------- */
  async function invoke(email, artistName, password) {
    const { data, error } = await supabase.functions.invoke("create-artist", { body: { email, artistName, password } });
    if (error) { let m = error.message; try { m = (await error.context.json()).error || m; } catch {} throw new Error(m); }
    if (!data?.ok) throw new Error(data?.error || "Request failed");
    return data;
  }
  async function createArtist(e) {
    e.preventDefault(); setErr(""); setCreds(null); setCreating(true);
    try {
      const d = await invoke(cEmail.trim(), cName.trim(), cPass);
      setCreds({ ...d, name: cName.trim(), created: d.created });
      setCName(""); setCEmail(""); setCPass(genPass()); load();
    } catch (x) { setErr(x.message); }
    setCreating(false);
  }
  async function resetPass(a) {
    if (!window.confirm(`Generate a new password for ${a.artist_name || a.email}? The old one stops working.`)) return;
    setErr(""); setCreds(null);
    try { const d = await invoke(a.email, a.artist_name, genPass()); setCreds({ ...d, name: a.artist_name, created: false }); } catch (x) { setErr(x.message); }
  }
  const credText = c => `YOUNG BOYZ Distribution\nLogin: ${window.location.origin}/login\nEmail: ${c.email}\nPassword: ${c.password}`;
  async function copyCreds(c) { try { await navigator.clipboard.writeText(credText(c)); setOk("Login details copied."); setTimeout(() => setOk(""), 2500); } catch { setErr("Couldn't copy."); } }

  if (!ready) return <Shell><div className="page"><p className="muted">Checking admin access…</p></div></Shell>;

  return (
    <Shell>
      <div className="page">
        <header className="page-head">
          <div><p className="eyebrow">Admin control</p><h1>Admin panel</h1><p className="lead">Review submissions, download the files and metadata, and create artist logins.</p></div>
          <a className="btn-ghost" href="/dashboard"><Icon name="back" /> Artist view</a>
        </header>

        <section className="stats-grid" aria-label="Totals">
          <AStat icon="user" label="Artists" n={artists.filter(a => a.role !== "admin").length} />
          <AStat icon="disc" label="Submitted releases" n={releases.filter(x => x.status !== "draft").length} />
          <AStat icon="help" label="Profile requests" n={requests.filter(x => x.status === "requested").length} />
          <AStat icon="clock" label="Needs review" n={releases.filter(x => ["submitted", "qa", "pending"].includes(x.status)).length} />
        </section>

        {(err || ok) && <div className={err ? "login-error" : "form-message"} role="alert" style={{ marginTop: 16 }}>{err || ok}</div>}

        <section className="panel">
          <div className="panel-head"><h2>Release submissions</h2><span className="panel-note">{shown.length} shown</span></div>
          <div className="filters">{FILTERS.map(([k, l]) => <button key={k} className={`chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{l} ({releases.filter(r => inFilter(k, r.status)).length})</button>)}</div>
          {shown.length ? shown.map(r => {
            const a = byId[r.artist_id], open = openId === r.id, tr = tracksBy[r.id];
            const cover = r.cover_path ? supabase.storage.from("covers").getPublicUrl(r.cover_path).data.publicUrl : null;
            return (
              <div className="rel-card" key={r.id}>
                <div className="rel-top">
                  {cover ? <img className="thumb" src={cover} alt="" /> : <div className="thumb"><Icon name="disc" /></div>}
                  <div><b>{r.title}</b><small>by {r.artist_name || nameOf(r.artist_id)} · {a?.email || ""}</small></div>
                  <div><small>Release</small><b style={{ fontSize: 13 }}>{r.release_mode === "today" && !r.release_date ? "Today" : fmtDate(r.release_date)} · {fmt12(r.release_time)}</b></div>
                  <select value={r.status} onChange={e => setStatus(r.id, e.target.value)} aria-label="Status">{STATUSES.map(s => <option key={s}>{s}</option>)}</select>
                  <button className="secondary dl-btn" onClick={() => toggle(r)}>{open ? "Hide details" : "View details & files"}</button>
                </div>
                {open && (
                  <div className="rel-detail">
                    <div className="kv">
                      <div><span>Artist</span><b>{r.artist_name || nameOf(r.artist_id)}</b></div>
                      <div><span>Artist email</span><b>{a?.email || "—"}</b></div>
                      <div><span>Type</span><b style={{ textTransform: "capitalize" }}>{r.release_type}</b></div>
                      <div><span>Genre</span><b>{r.genre || "—"}{r.sub_genre ? ` / ${r.sub_genre}` : ""}</b></div>
                      <div><span>Go-live</span><b>{r.release_mode === "today" && !r.release_date ? "Today" : fmtDate(r.release_date)} · {fmt12(r.release_time)} {r.release_tz ? `(${r.release_tz})` : ""}</b></div>
                      <div><span>Artwork by</span><b>{r.artwork_by || "—"}</b></div>
                      {Object.entries(r.dsp_profiles || {}).map(([p, d]) => <div key={p}><span>{p}</span><b>{d.choice === "existing" ? <a href={d.url} target="_blank" rel="noreferrer">{d.url}</a> : d.choice === "request" ? "No profile — create one" : "—"}</b></div>)}
                    </div>
                    {r.pitch && <div><span className="lbl">Pitch</span><div className="block-text">{r.pitch}</div></div>}
                    {r.notes && <div><span className="lbl">Notes</span><div className="block-text">{r.notes}</div></div>}

                    <div className="row-actions-wrap">
                      {r.cover_path && <button className="secondary dl-btn" onClick={() => download("covers", r.cover_path, `${safe(r.title)} - cover.${r.cover_path.split(".").pop()}`)}>⬇ Cover ({fmtSize(r.cover_size)})</button>}
                      <button className="secondary dl-btn" onClick={() => copyMeta(r)}>Copy all details</button>
                    </div>

                    <div style={{ display: "grid", gap: 12 }}>
                      {!tr ? <p className="muted">Loading tracks…</p> : tr.length === 0 ? <p className="muted">No tracks on this release.</p> : tr.map((t, i) => (
                        <div className="dl-track" key={t.id}>
                          <div className="dl-track-head">
                            <div className="track-num">{String(i + 1).padStart(2, "0")}</div>
                            <b>{t.title || "Untitled"}{t.version ? ` (${t.version})` : ""}</b>
                            {t.audio_path ? <button className="primary dl-btn" onClick={() => download("audio", t.audio_path, `${safe(r.artist_name || nameOf(r.artist_id))} - ${safe(t.title)}${t.version ? ` (${safe(t.version)})` : ""}.${t.audio_path.split(".").pop()}`)}>⬇ Download audio ({fmtSize(t.audio_size)})</button> : <span className="pill pill-rejected">No audio</span>}
                          </div>
                          <div className="kv">
                            <div><span>Featured</span><b>{t.featured_artists || "—"}</b></div>
                            <div><span>Explicit</span><b style={{ textTransform: "capitalize" }}>{t.explicit}</b></div>
                            <div><span>Language</span><b>{t.language || "—"}</b></div>
                            <div><span>ISRC</span><b>{t.isrc || "— (generate)"}</b></div>
                            <div><span>File</span><b>{t.audio_name || "—"}</b></div>
                          </div>
                          {t.contributors?.length > 0 && <div><span className="lbl">Credits</span><div className="block-text">{t.contributors.map(c => `${c.name} — ${c.role}`).join("\n")}</div></div>}
                          {t.lyrics && <details><summary className="lbl" style={{ cursor: "pointer" }}>Lyrics</summary><div className="block-text" style={{ marginTop: 8 }}>{t.lyrics}</div></details>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          }) : <p className="empty-line">Nothing here.</p>}
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Profile requests</h2><span className="panel-note">{requests.length} total</span></div>
          {requests.length ? requests.map(x => (
            <div className="req-row" key={x.id}>
              <div><b>{x.platform} profile for {nameOf(x.artist_id)}</b><small>{byId[x.artist_id]?.email || ""}{x.release_id && relById[x.release_id] ? ` · release “${relById[x.release_id].title}”` : ""}</small></div>
              <span><span className={`pill pill-${x.status}`}>{x.status}</span></span>
              <select value={x.status} onChange={e => setReqStatus(x.id, e.target.value)} aria-label="Request status">{["requested", "processing", "created", "rejected"].map(s => <option key={s}>{s}</option>)}</select>
            </div>
          )) : <p className="empty-line">No profile requests.</p>}
        </section>

        <section className="admin-tools" style={{ marginTop: 16 }}>
          <div className="panel" style={{ marginTop: 0 }}>
            <div className="panel-head"><h2>Create artist login</h2></div>
            <p className="support-text" style={{ marginBottom: 16 }}>Enter the artist's email. A password is generated — you give them the email + password and they sign in. If the email already has an account, its password is replaced.</p>
            <form className="inline-form" onSubmit={createArtist}>
              <label>Artist name<input value={cName} onChange={e => setCName(e.target.value)} placeholder="Stage name" /></label>
              <label>Artist email *<input type="email" value={cEmail} onChange={e => setCEmail(e.target.value)} placeholder="artist@example.com" required /></label>
              <label>Password
                <div className="pw-row"><input value={cPass} onChange={e => setCPass(e.target.value)} minLength={8} required /><button type="button" className="secondary" onClick={() => setCPass(genPass())}>Generate</button></div>
              </label>
              <button className="primary" disabled={creating}>{creating ? "Creating…" : "Create login"}</button>
            </form>
            {creds && (
              <div className="creds" role="status">
                <b>{creds.created ? "Account created" : "Password updated"}{creds.name ? ` — ${creds.name}` : ""}</b>
                <code>Email: {creds.email}</code><code>Password: {creds.password}</code>
                <div className="row"><button className="secondary dl-btn" onClick={() => copyCreds(creds)}>Copy login details</button></div>
                <small className="muted">Shown once — copy it now. You can reset it anytime from the artist list.</small>
              </div>
            )}
          </div>

          <div className="panel" style={{ marginTop: 0 }}>
            <div className="panel-head"><h2>Artists</h2><span className="panel-note">{artists.length} accounts</span></div>
            {artists.length ? artists.map(a => (
              <div className="art-row" key={a.id}>
                <div><b>{a.artist_name || "—"}</b>{a.role === "admin" && <span className="role">admin</span>}</div>
                <span className="cell-muted">{a.email || "no email"}</span>
                {a.email && <button className="secondary dl-btn" onClick={() => resetPass(a)}>Reset password</button>}
              </div>
            )) : <p className="empty-line">No artists yet.</p>}
          </div>
        </section>
      </div>
    </Shell>
  );
}

function AStat({ icon, label, n }) {
  return (
    <div className="stat-card">
      <div className="stat-top"><span>{label}</span><div className="stat-ico"><Icon name={icon} size={18} /></div></div>
      <strong>{n}</strong>
    </div>
  );
}
