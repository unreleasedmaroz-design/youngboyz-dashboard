"use client";
import Icon from "./Icon";
import { LANGS, ROLES, fmtSize } from "../data";

// One editable track: audio file + full metadata + any number of contributors.
export default function TrackEditor({ t, index, total, busy, open, onToggle, onChange, onRemove, onAudio, onClearAudio, defaultArtist }) {
  const set = (k, v) => onChange({ [k]: v });
  const setC = (i, patch) => onChange({ contributors: t.contributors.map((c, j) => j === i ? { ...c, ...patch } : c) });
  const addC = () => onChange({ contributors: [...t.contributors, { name: "", role: "Writer" }] });
  const delC = i => onChange({ contributors: t.contributors.filter((_, j) => j !== i) });
  const ready = t.title && t.audio;

  return (
    <div className={`track-card ${open ? "open" : ""}`}>
      <div className="track-head" onClick={onToggle} role="button" tabIndex={0} onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onToggle())} aria-expanded={open}>
        <div className="track-num">{String(index + 1).padStart(2, "0")}</div>
        <div className="track-head-text">
          <b>{t.title || "Untitled track"}{t.version ? <em> ({t.version})</em> : null}</b>
          <span>{defaultArtist || "Artist"}{t.featured ? ` ft. ${t.featured}` : ""} · {busy ? "Uploading audio…" : t.audio ? t.audio.name : "No audio yet"}</span>
        </div>
        <span className={`track-state ${ready ? "ok" : "todo"}`}>{ready ? "Ready" : "Incomplete"}</span>
        <span className="chev" aria-hidden="true">{open ? "−" : "+"}</span>
      </div>

      {open && (
        <div className="track-body">
          <div className="audio-row">
            <label className={`audio-drop ${t.audio ? "has" : ""}`}>
              <input type="file" accept=".wav,.mp3,.flac,audio/wav,audio/x-wav,audio/mpeg,audio/flac" disabled={busy}
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onAudio(f); }} />
              <span className="cover-icon"><Icon name="music" size={26} /></span>
              <b>{busy ? "Uploading…" : t.audio ? t.audio.name : "Upload audio file"}</b>
              <small>{t.audio ? `${fmtSize(t.audio.size)} · click to replace` : "WAV (recommended) · MP3 · FLAC"}</small>
            </label>
            {t.audio && !busy && <button type="button" className="danger small-btn" onClick={onClearAudio}>Remove audio</button>}
          </div>

          <div className="field-grid">
            <label>Track title *<input value={t.title} onChange={e => set("title", e.target.value)} placeholder="e.g. RANAT" /></label>
            <label>Version <span className="optional">optional</span><input value={t.version} onChange={e => set("version", e.target.value)} placeholder="e.g. Remix, Instrumental, Slowed" /></label>
            <label>Featured artists <span className="optional">optional</span><input value={t.featured} onChange={e => set("featured", e.target.value)} placeholder="Separate with commas" /></label>
            <label>Explicit content *<select value={t.explicit} onChange={e => set("explicit", e.target.value)}><option value="no">Not explicit</option><option value="yes">Explicit</option><option value="clean">Clean version</option></select></label>
            <label>Language *<select value={t.language} onChange={e => set("language", e.target.value)}><option value="">Choose a language</option>{LANGS.map(l => <option key={l}>{l}</option>)}</select></label>
            <label>ISRC <span className="optional">optional — we'll generate one</span><input value={t.isrc} onChange={e => set("isrc", e.target.value.toUpperCase())} placeholder="e.g. QZ-ABC-26-00001" maxLength={16} /></label>
          </div>

          <div className="contrib">
            <div className="contrib-title"><b>Credits &amp; contributors</b><span>Writers, producers, engineers — add as many as you need.</span></div>
            {t.contributors.length === 0 && <p className="muted small">No credits added yet.</p>}
            {t.contributors.map((c, i) => (
              <div className="contrib-row" key={i}>
                <input value={c.name} onChange={e => setC(i, { name: e.target.value })} placeholder="Full name" aria-label="Contributor name" />
                <select value={c.role} onChange={e => setC(i, { role: e.target.value })} aria-label="Role">{ROLES.map(r => <option key={r}>{r}</option>)}</select>
                <button type="button" className="icon-btn" onClick={() => delC(i)} aria-label="Remove contributor">✕</button>
              </div>
            ))}
            <button type="button" className="secondary small-btn" onClick={addC}>+ Add contributor</button>
          </div>

          <label>Lyrics <span className="optional">optional</span><textarea value={t.lyrics} onChange={e => set("lyrics", e.target.value)} placeholder="Paste the full lyrics (helps with Apple Music / Spotify lyrics sync)." /></label>

          {total > 1 && <div className="track-foot"><button type="button" className="danger small-btn" onClick={onRemove}>Delete this track</button></div>}
        </div>
      )}
    </div>
  );
}
