"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib";
import { useRouter } from "next/navigation";
import Shell from "../components/Shell";
import Icon from "../components/Icon";
import DatePicker from "../components/DatePicker";
import TrackEditor from "../components/TrackEditor";
import { PL, GENRES, extOf, fmtDate, fmtSize, isHoliday, pad, uid, ymd } from "../data";

const newTrack = () => ({ id: uid(), title: "", version: "", featured: "", explicit: "no", language: "", isrc: "", lyrics: "", contributors: [], audio: null });
const blankDsp = saved => Object.fromEntries(PL.map(p => { const s = saved?.find(x => x.platform === p && x.has_profile && x.profile_url); return [p, s ? { choice: "existing", url: s.profile_url } : { choice: "", url: "" }]; }));
const blankForm = (artist, saved) => ({ title: "", type: "Single", mode: "date", date: "", time: "00:00", artist, genre: "", subGenre: "", pitch: "", notes: "", designer: "", cover: null, dsp: blankDsp(saved), noAi: false, original: false, terms: false });
const TYPE_LABEL = { single: "Single", ep: "EP", album: "Album", mixtape: "Mixtape", compilation: "Compilation" };
const urlOk = (p, u) => /^https?:\/\//i.test(u) && (p === "Spotify" ? /spotify\.com/i.test(u) : /apple\.com/i.test(u));

export default function Submit() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [f, setF] = useState(blankForm("", []));
  const [tracks, setTracks] = useState([newTrack()]);
  const [openId, setOpenId] = useState(null);
  const [saved, setSaved] = useState([]);
  const [relId, setRelId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState({});
  const [save, setSave] = useState({ s: "idle", at: null });
  const [msg, setMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fRef = useRef(f), tRef = useRef(tracks), relRef = useRef(null), creating = useRef(null);
  const removed = useRef([]), chain = useRef(Promise.resolve()), dirty = useRef(false), timer = useRef(null), userRef = useRef(null);
  fRef.current = f; tRef.current = tracks;

  const today = useMemo(() => new Date(), []);
  const todayHoliday = isHoliday(today);

  /* ---------- load (resume the artist's draft, or start fresh) ---------- */
  useEffect(() => {
    (async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) return router.push("/login");
      setUser(u); userRef.current = u;
      const [{ data: p }, { data: pr }] = await Promise.all([
        supabase.from("profiles").select("artist_name").eq("id", u.id).single(),
        supabase.from("artist_profiles").select("*").eq("artist_id", u.id),
      ]);
      setSaved(pr || []);
      const base = blankForm(p?.artist_name || "", pr || []);
      const q = new URLSearchParams(window.location.search);
      let rel = null;
      if (q.get("id")) {
        rel = (await supabase.from("releases").select("*").eq("id", q.get("id")).eq("artist_id", u.id).maybeSingle()).data;
      } else if (!q.get("new")) {
        rel = (await supabase.from("releases").select("*").eq("artist_id", u.id).eq("status", "draft").order("updated_at", { ascending: false }).limit(1).maybeSingle()).data;
      }
      if (rel) {
        if (rel.status !== "draft") setLocked(true);
        relRef.current = rel.id; setRelId(rel.id);
        const dsp = { ...base.dsp };
        for (const k of PL) if (rel.dsp_profiles?.[k]) dsp[k] = { choice: rel.dsp_profiles[k].choice || "", url: rel.dsp_profiles[k].url || "" };
        setF({
          ...base, title: rel.title === "Untitled release" ? "" : rel.title || "", type: TYPE_LABEL[rel.release_type] || "Single",
          mode: rel.release_mode || "date", date: rel.release_date || "", time: rel.release_time || "00:00", artist: rel.artist_name || base.artist,
          genre: rel.genre || "", subGenre: rel.sub_genre || "", pitch: rel.pitch || "", notes: rel.notes || "", designer: rel.artwork_by || "",
          cover: rel.cover_path ? { path: rel.cover_path, name: rel.cover_name, size: rel.cover_size } : null,
          dsp, noAi: !!rel.confirm_no_ai, original: !!rel.confirm_original, terms: !!rel.confirm_terms,
        });
        const { data: tr } = await supabase.from("tracks").select("*").eq("release_id", rel.id).order("position");
        if (tr?.length) {
          const list = tr.map(x => ({ id: x.id, title: x.title || "", version: x.version || "", featured: x.featured_artists || "", explicit: x.explicit || "no", language: x.language || "", isrc: x.isrc || "", lyrics: x.lyrics || "", contributors: x.contributors || [], audio: x.audio_path ? { path: x.audio_path, name: x.audio_name, size: x.audio_size } : null }));
          setTracks(list); setOpenId(list[0].id);
        } else { const t = newTrack(); setTracks([t]); setOpenId(t.id); }
      } else {
        setF(base); const t = tRef.current[0]; setOpenId(t.id);
      }
      setLoaded(true);
    })();
  }, [router]);

  /* ---------- auto-save ---------- */
  const ensureRelease = useCallback(async () => {
    if (relRef.current) return relRef.current;
    if (!creating.current) {
      creating.current = (async () => {
        const { data, error } = await supabase.from("releases").insert({ artist_id: userRef.current.id, title: fRef.current.title || "Untitled release", release_type: fRef.current.type.toLowerCase(), status: "draft" }).select("id").single();
        if (error) { creating.current = null; throw error; }
        relRef.current = data.id; setRelId(data.id);
        window.history.replaceState(null, "", `/submit?id=${data.id}`);
        return data.id;
      })();
    }
    return creating.current;
  }, []);

  const writeAll = useCallback(async () => {
    const id = await ensureRelease(), F = fRef.current, T = tRef.current, uidv = userRef.current.id;
    const { error } = await supabase.from("releases").update({
      title: F.title || "Untitled release", release_type: F.type.toLowerCase(), release_mode: F.mode,
      release_date: F.mode === "today" ? null : F.date || null, release_time: F.time, release_tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      artist_name: F.artist, genre: F.genre || null, sub_genre: F.subGenre || null, pitch: F.pitch || null, notes: F.notes || null, artwork_by: F.designer || null,
      cover_path: F.cover?.path || null, cover_name: F.cover?.name || null, cover_size: F.cover?.size || null,
      dsp_profiles: F.dsp, confirm_no_ai: F.noAi, confirm_original: F.original, confirm_terms: F.terms, updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) throw error;
    if (removed.current.length) {
      const ids = removed.current.splice(0);
      const { error: e } = await supabase.from("tracks").delete().in("id", ids);
      if (e) throw e;
    }
    const rows = T.map((t, i) => ({
      id: t.id, release_id: id, artist_id: uidv, position: i + 1, title: t.title || null, version: t.version || null, featured_artists: t.featured || null,
      explicit: t.explicit, isrc: t.isrc || null, language: t.language || null, lyrics: t.lyrics || null,
      contributors: t.contributors.filter(c => c.name.trim()), audio_path: t.audio?.path || null, audio_name: t.audio?.name || null, audio_size: t.audio?.size || null, updated_at: new Date().toISOString(),
    }));
    const { error: te } = await supabase.from("tracks").upsert(rows, { onConflict: "id" });
    if (te) throw te;
  }, [ensureRelease]);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    chain.current = chain.current.then(async () => {
      if (!dirty.current) return;
      dirty.current = false;
      setSave(s => ({ ...s, s: "saving" }));
      try { await writeAll(); setSave({ s: "saved", at: new Date() }); }
      catch (e) { dirty.current = true; setSave({ s: "error", at: null, m: e.message }); throw e; }
    }).catch(() => {});
    return chain.current;
  }, [writeAll]);

  useEffect(() => {
    if (!loaded || locked) return;
    if (!dirty.current && save.s === "idle" && !relRef.current && !f.title && tracks.length === 1 && !tracks[0].title && !f.genre && !f.date) return; // untouched blank form
    dirty.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 900);
    return () => clearTimeout(timer.current);
  }, [f, tracks, loaded, locked]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const h = e => { if (dirty.current || Object.values(busy).some(Boolean)) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [busy]);

  /* ---------- helpers ---------- */
  const up = (k, v) => setF(a => ({ ...a, [k]: v }));
  const upDsp = (p, patch) => setF(a => ({ ...a, dsp: { ...a.dsp, [p]: { ...a.dsp[p], ...patch } } }));
  const setChoice = (p, c) => setF(a => { const cur = a.dsp[p]; const next = cur.choice === c ? "" : c; const saved0 = saved.find(x => x.platform === p && x.profile_url); return { ...a, dsp: { ...a.dsp, [p]: { choice: next, url: next === "existing" ? cur.url || saved0?.profile_url || "" : cur.url } } }; });
  const upTrack = (id, patch) => setTracks(a => a.map(t => t.id === id ? { ...t, ...patch } : t));
  const [h12, m, ap] = (() => { const [h, mm] = f.time.split(":").map(Number); return [h % 12 || 12, mm, h < 12 ? "AM" : "PM"]; })();
  const setTime = (nh, nm, nap) => up("time", `${pad((nh % 12) + (nap === "PM" ? 12 : 0))}:${pad(nm)}`);

  async function removeFile(bucket, path) { if (path) await supabase.storage.from(bucket).remove([path]).catch(() => {}); }

  async function uploadCover(file) {
    setMsg("");
    if (!/^image\/(jpeg|png)$/.test(file.type)) return setMsg("Cover must be a JPG or PNG image.");
    if (file.size > 10 * 1024 * 1024) return setMsg("Cover must be 10 MB or smaller.");
    setBusy(b => ({ ...b, cover: true }));
    try {
      const id = await ensureRelease();
      const path = `${userRef.current.id}/${id}/cover-${Date.now()}.${extOf(file.name)}`;
      const { error } = await supabase.storage.from("covers").upload(path, file, { contentType: file.type });
      if (error) throw error;
      await removeFile("covers", fRef.current.cover?.path);
      up("cover", { path, name: file.name, size: file.size });
    } catch (e) { setMsg(`Cover upload failed: ${e.message}`); }
    setBusy(b => ({ ...b, cover: false }));
  }

  async function uploadAudio(tid, file) {
    setMsg("");
    if (!["wav", "mp3", "flac"].includes(extOf(file.name))) return setMsg("Audio must be a WAV, MP3 or FLAC file.");
    setBusy(b => ({ ...b, [tid]: true }));
    try {
      const id = await ensureRelease();
      const path = `${userRef.current.id}/${id}/audio/${tid}-${Date.now()}.${extOf(file.name)}`;
      const { error } = await supabase.storage.from("audio").upload(path, file, { contentType: file.type || "audio/wav" });
      if (error) throw error;
      await removeFile("audio", tRef.current.find(t => t.id === tid)?.audio?.path);
      upTrack(tid, { audio: { path, name: file.name, size: file.size } });
    } catch (e) { setMsg(`Audio upload failed: ${e.message}`); }
    setBusy(b => ({ ...b, [tid]: false }));
  }

  function clearAudio(tid) { const t = tracks.find(x => x.id === tid); removeFile("audio", t?.audio?.path); upTrack(tid, { audio: null }); }
  function addTrack() { const t = newTrack(); setTracks(a => [...a, t]); setOpenId(t.id); }
  function removeTrack(tid) {
    const t = tracks.find(x => x.id === tid);
    if (!window.confirm(`Delete track "${t?.title || "Untitled"}"?`)) return;
    removeFile("audio", t?.audio?.path); removed.current.push(tid);
    setTracks(a => a.filter(x => x.id !== tid));
  }
  function clearAll() {
    if (!window.confirm("Clear everything in this release form (including uploaded files)?")) return;
    tracks.forEach(t => { removeFile("audio", t.audio?.path); removed.current.push(t.id); });
    removeFile("covers", f.cover?.path);
    const t = newTrack(); setTracks([t]); setOpenId(t.id); setF(blankForm(f.artist, saved)); setMsg("");
  }

  async function saveDraft() {
    setMsg(""); dirty.current = true;
    try { await flush(); } catch {}
    if (dirty.current) return setMsg("Couldn't save the draft — check your connection and try again.");
    router.push("/dashboard");
  }

  /* ---------- submit ---------- */
  async function submit(e) {
    e.preventDefault(); setMsg("");
    const err = [];
    if (Object.values(busy).some(Boolean)) err.push("Wait for the uploads to finish.");
    if (!f.cover) err.push("Upload the cover artwork.");
    if (!f.artist.trim()) err.push("Artist name is required.");
    if (!f.title.trim()) err.push("Release title is required.");
    if (!f.genre) err.push("Choose a genre.");
    if (f.mode === "today") {
      if (todayHoliday) err.push("Today is a weekend (holiday) — pick a weekday.");
      else if (f.time <= `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`) err.push("That release time has already passed today — choose a later time.");
    } else if (!f.date) err.push("Choose a release date.");
    tracks.forEach((t, i) => {
      if (!t.title.trim()) err.push(`Track ${i + 1}: title is required.`);
      if (!t.audio) err.push(`Track ${i + 1}: upload the audio file.`);
      if (!t.language) err.push(`Track ${i + 1}: choose the language.`);
    });
    PL.forEach(p => {
      const d = f.dsp[p];
      if (!d.choice) err.push(`${p}: choose "Existing profile" or "We don't have a profile".`);
      else if (d.choice === "existing" && !urlOk(p, d.url.trim())) err.push(`${p}: paste your official artist page link (https://…).`);
    });
    if (!f.noAi) err.push("Confirm the release is not AI-made.");
    if (!f.original) err.push("Confirm this is your own original release.");
    if (!f.terms) err.push("Accept the Terms & Conditions.");
    if (err.length) { setMsg(err.join("\n")); document.getElementById("form-msg")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }

    setSubmitting(true);
    try {
      dirty.current = true; await flush(); if (dirty.current) throw new Error("Couldn't save your release. Try again.");
      const id = relRef.current;
      const { error } = await supabase.from("releases").update({ status: "submitted", submitted_at: new Date().toISOString(), release_date: f.mode === "today" ? ymd(new Date()) : f.date, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      for (const p of PL) {
        const d = f.dsp[p];
        if (d.choice === "existing") await supabase.from("artist_profiles").upsert({ artist_id: user.id, platform: p, profile_url: d.url.trim(), has_profile: true, status: "connected", updated_at: new Date().toISOString() }, { onConflict: "artist_id,platform" });
        else {
          await supabase.from("artist_profiles").upsert({ artist_id: user.id, platform: p, has_profile: false, status: "requested", updated_at: new Date().toISOString() }, { onConflict: "artist_id,platform" });
          const { data: ex } = await supabase.from("profile_requests").select("id").eq("release_id", id).eq("platform", p).limit(1);
          if (!ex?.length) await supabase.from("profile_requests").insert({ artist_id: user.id, platform: p, release_id: id });
        }
      }
      setMsg("Release submitted successfully. The YOUNG BOYZ team will review it.");
      setTimeout(() => router.push("/dashboard"), 900);
    } catch (x) { setMsg(x.message); setSubmitting(false); }
  }

  const stateLabel = save.s === "saving" ? "Saving…" : save.s === "saved" ? `All changes saved · ${save.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : save.s === "error" ? `Not saved — ${save.m || "retrying on next change"}` : "Auto-saves as you type";

  if (locked) return <Shell><div className="page page-narrow"><div className="panel"><h2>This release was already submitted</h2><p className="support-text" style={{ margin: "10px 0 18px" }}>It's with the YOUNG BOYZ team now and can't be edited here.</p><a className="btn-primary" href="/dashboard">Back to dashboard</a></div></div></Shell>;

  return (
    <Shell>
      <div className="page page-narrow">
        <header className="page-head">
          <div><p className="eyebrow">Distribution</p><h1>Submit a release</h1><p className="lead">Send your release to the YOUNG BOYZ distribution team for QA and delivery. Everything you enter is saved to your account automatically.</p></div>
          <div className="head-side">
            <div className={`save-chip ${save.s}`} role="status">{stateLabel}</div>
            {relId && <a className="btn-ghost small-btn" href="/submit?new=1">+ Start a new release</a>}
          </div>
        </header>

        {!loaded ? <p className="muted">Loading your release…</p> : (
          <form className="release-form" onSubmit={submit}>
            {/* 01 */}
            <section className="form-section cover-section"><div className="section-title"><span>01</span><div><h2>Artwork & artist</h2><p>Use a square, high-quality cover. JPG or PNG, 3000×3000 recommended.</p></div></div>
              <div className="cover-row">
                <label className="cover-drop">
                  <input type="file" accept="image/jpeg,image/png" disabled={busy.cover} onChange={e => { const x = e.target.files?.[0]; e.target.value = ""; if (x) uploadCover(x); }} />
                  <span className="cover-icon"><Icon name="image" size={34} /></span>
                  <b>{busy.cover ? "Uploading…" : f.cover ? f.cover.name : "Choose cover"}</b>
                  <small>{f.cover ? `${fmtSize(f.cover.size)} uploaded · click to replace` : "JPEG · 3000×3000 · ≤10 MB"}</small>
                </label>
                <div className="artist-fields"><label>Artist *<input value={f.artist} onChange={e => up("artist", e.target.value)} required /></label>
                  <div className="hint">Your Spotify and Apple Music pages are chosen in step 03. You can also manage them anytime from <a href="/profile">Platform Profiles</a>.</div></div>
              </div>
            </section>

            {/* 02 */}
            <section className="form-section"><div className="section-title"><span>02</span><div><h2>Release information</h2><p>Tell us what you're releasing and when it should go live.</p></div></div>
              <div className="field-grid">
                <label>Release title *<input value={f.title} onChange={e => up("title", e.target.value)} placeholder="e.g. RANAT" required /></label>
                <label>Release type *<select value={f.type} onChange={e => up("type", e.target.value)}><option>Single</option><option>EP</option><option>Album</option><option>Mixtape</option><option>Compilation</option></select></label>
                <label>Genre *<select value={f.genre} onChange={e => up("genre", e.target.value)} required><option value="">Choose a genre</option>{GENRES.map(g => <option key={g}>{g}</option>)}</select></label>
                <label>Sub-Genre <span className="optional">optional</span><input value={f.subGenre} onChange={e => up("subGenre", e.target.value)} placeholder="e.g. Egyptian Trap, Rage, Afro House" /></label>
                <label>Artwork by <span className="optional">optional</span><input value={f.designer} onChange={e => up("designer", e.target.value)} placeholder="@designer" /></label>
                <div className="static-field"><span>Tracks in this release</span><b>{tracks.length}</b></div>
              </div>

              <div className="when-box">
                <div className="when-title"><b>When should it go live? *</b><span>Saturday &amp; Sunday are holidays — no releases on those days.</span></div>
                <div className="seg" role="radiogroup" aria-label="Release day">
                  <button type="button" role="radio" aria-checked={f.mode === "today"} className={f.mode === "today" ? "on" : ""} onClick={() => up("mode", "today")}>Release today</button>
                  <button type="button" role="radio" aria-checked={f.mode === "date"} className={f.mode === "date" ? "on" : ""} onClick={() => up("mode", "date")}>Choose a date</button>
                </div>
                <div className="when-row">
                  <div className="when-field"><span className="lbl">Date</span>
                    {f.mode === "today"
                      ? <div className={`today-box ${todayHoliday ? "bad" : ""}`}>{fmtDate(ymd(today))}{todayHoliday ? " — weekend, can't release today" : " — today"}</div>
                      : <DatePicker value={f.date} onChange={d => up("date", d)} />}
                  </div>
                  <div className="when-field"><span className="lbl">Time</span>
                    <div className="time-row">
                      <select aria-label="Hour" value={h12} onChange={e => setTime(+e.target.value, m, ap)}>{Array.from({ length: 12 }, (_, i) => i + 1).map(h => <option key={h} value={h}>{h}</option>)}</select>
                      <select aria-label="Minute" value={m} onChange={e => setTime(h12, +e.target.value, ap)}>{Array.from({ length: 12 }, (_, i) => i * 5).concat(m % 5 ? [m] : []).sort((a, b) => a - b).map(x => <option key={x} value={x}>{pad(x)}</option>)}</select>
                      <select aria-label="AM or PM" value={ap} onChange={e => setTime(h12, m, e.target.value)}><option>AM</option><option>PM</option></select>
                    </div>
                  </div>
                </div>
                <small className="muted">Time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</small>
              </div>

              <label>Pitch <span className="optional">sell your release</span><textarea value={f.pitch} onChange={e => up("pitch", e.target.value)} placeholder="Tell us what this release is about — the story, vibe, influences, what makes it special. This helps us pitch it to DSPs for editorial playlists." /></label>
              <label>Notes<textarea value={f.notes} onChange={e => up("notes", e.target.value)} placeholder="Anything else I should know about this release?" /></label>
            </section>

            {/* 03 */}
            <section className="form-section"><div className="section-title"><span>03</span><div><h2>Artist profiles</h2><p>Spotify and Apple Music — use your existing artist page, or ask YOUNG BOYZ to create one.</p></div></div>
              {PL.map(p => {
                const d = f.dsp[p];
                return (
                  <div className="platform-block" key={p}>
                    <div className="platform-line">
                      <div><b>{p}</b><small>{d.choice === "request" ? "YOUNG BOYZ will create a profile for you" : d.choice === "existing" ? "Using your existing artist page" : "Choose one option"}</small></div>
                      <div className="platform-actions">
                        <button type="button" className={d.choice === "existing" ? "selected" : ""} aria-pressed={d.choice === "existing"} onClick={() => setChoice(p, "existing")}>✓ Existing profile</button>
                        <button type="button" className={d.choice === "request" ? "selected request" : ""} aria-pressed={d.choice === "request"} onClick={() => setChoice(p, "request")}>+ We don't have a profile</button>
                      </div>
                    </div>
                    {d.choice === "existing" && (
                      <label className="profile-url">{p} artist page link *
                        <input value={d.url} onChange={e => upDsp(p, { url: e.target.value })} placeholder={p === "Spotify" ? "https://open.spotify.com/artist/..." : "https://music.apple.com/eg/artist/..."} inputMode="url" />
                        {d.url && !urlOk(p, d.url.trim()) && <span className="field-err">Paste the full official {p} link starting with https://</span>}
                      </label>
                    )}
                  </div>
                );
              })}
            </section>

            {/* 04 */}
            <section className="form-section"><div className="section-title"><span>04</span><div><h2>Track list & metadata</h2><p>Add the audio and metadata for every track in this release. Click a track to edit it.</p></div></div>
              <div className="tracks">
                {tracks.map((t, i) => (
                  <TrackEditor key={t.id} t={t} index={i} total={tracks.length} busy={!!busy[t.id]} open={openId === t.id} defaultArtist={f.artist}
                    onToggle={() => setOpenId(openId === t.id ? null : t.id)} onChange={patch => upTrack(t.id, patch)} onRemove={() => removeTrack(t.id)}
                    onAudio={file => uploadAudio(t.id, file)} onClearAudio={() => clearAudio(t.id)} />
                ))}
              </div>
              <button type="button" className="secondary add-track" onClick={addTrack}><Icon name="plus" size={16} /> Add track</button>
            </section>

            <section className="form-section checks">
              <label><input type="checkbox" checked={f.noAi} onChange={e => up("noAi", e.target.checked)} /><span>This release was not made with AI (no AI-generated vocals, instruments, or masters).</span></label>
              <label><input type="checkbox" checked={f.original} onChange={e => up("original", e.target.checked)} /><span>This is my <b>own original release</b> — not a free beat and not a remix.</span></label>
              <label><input type="checkbox" checked={f.terms} onChange={e => up("terms", e.target.checked)} /><span>I have read and accept the <a href="#">Terms & Conditions</a>.</span></label>
            </section>

            {msg && <div className="form-message" id="form-msg" role="alert" style={{ whiteSpace: "pre-line" }}>{msg}</div>}
            <div className="submit-actions">
              <button className="primary big" disabled={submitting || Object.values(busy).some(Boolean)}>{submitting ? "Submitting…" : "Submit release"}</button>
              <button type="button" className="secondary big" onClick={saveDraft}>Save draft</button>
              <button type="button" className="danger big" onClick={clearAll}>Clear</button>
            </div>
          </form>
        )}
      </div>
    </Shell>
  );
}
