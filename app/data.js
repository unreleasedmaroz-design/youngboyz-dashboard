// Only these two DSPs are handled through the portal.
export const PL = ["Spotify", "Apple Music"];

export const GENRES = [
"Alternative","Ambient","Arabic Pop","Arabic Rap","Blues","Brazilian","Children's Music","Classical","Country","Dance","Dancehall","Disco","Drill","Electronic","Electro Pop","Folk","French Pop","Funk","Gospel","Grime","Hardcore","Hardstyle","Hip-Hop","House","Hyperpop","Indie","Industrial","Jazz","K-Pop","Latin","Lo-Fi","Metal","New Age","Opera","Orchestral","Pop","Punk","R&B","Reggae","Reggaeton","Rock","Soul","Soundtrack","Spoken Word","Techno","Trance","Trap","Afrobeats","Afro House","Amapiano","UK Garage","Jersey Club","Phonk","Rage","Drum & Bass","Dubstep","Garage","Breakbeat","Future Bass","Future House","Deep House","Progressive House","Tech House","Melodic House","Organic House","Hard Techno","Melodic Techno","Minimal","Techno Pop","Emo Rap","Cloud Rap","Boom Bap","Conscious Hip-Hop","West Coast Hip-Hop","East Coast Hip-Hop","Gangsta Rap","Alternative Hip-Hop","Experimental Hip-Hop","Egyptian Rap","Egyptian Pop","Khaliji","Khaleeji Pop","Shaabi","Mahraganat","Middle Eastern","North African","World","Other"
];

export const ROLES = ["Writer","Composer","Producer","Featured artist","Mixing engineer","Mastering engineer","Other"];
export const LANGS = ["Arabic","Egyptian Arabic","English","French","Instrumental / no lyrics","Other"];
export const STATUSES = ["draft","submitted","qa","approved","rejected","delivered","live"];

export const pad = n => String(n).padStart(2, "0");
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
// Saturday (6) and Sunday (0) are team holidays — nothing can be released on them.
export const isHoliday = d => d.getDay() === 0 || d.getDay() === 6;
export const fmtDate = s => s ? parseYmd(s).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "—";
export const fmt12 = t => { if (!t) return "—"; const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`; };
export const fmtSize = b => !b ? "" : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
export const uid = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
export const extOf = n => (n.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
export const safe = s => (s || "file").replace(/[\\/:*?"<>|]+/g, "").trim();
