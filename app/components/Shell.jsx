"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../lib";
import Icon from "./Icon";
import Logo from "./Logo";

// Pages that exist today.
const MAIN = [
  ["home", "Home", "/dashboard"],
  ["upload", "Submit a release", "/submit"],
  ["disc", "My releases", "/dashboard#releases"],
  ["user", "Platform profiles", "/profile"],
];
// Planned pages — shown as "Soon" instead of links that go nowhere.
const SOON = [
  ["coins", "Royalties"],
  ["ticket", "Support tickets"],
  ["tools", "Tools"],
];

export default function Shell({ children }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || "");
      const { data } = await supabase.from("profiles").select("artist_name,role").eq("id", user.id).single();
      setName(data?.artist_name || user.email?.split("@")[0] || "Artist");
      setRole(data?.role || "");
    })();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/dashboard" aria-label="YOUNG BOYZ Distribution — home">
          <Logo variant="wordmark" width={188} />
          <span className="brand-sub">Distribution</span>
        </a>

        <div className="user-mini">
          <div className="avatar">{(name || email || "A").slice(0, 1).toUpperCase()}</div>
          <div className="user-text">
            <b>{name || "Artist"}</b>
            <span>{email || "Artist account"}</span>
          </div>
        </div>

        {role === "admin" && (
          <div className="seg-link" role="tablist" aria-label="Switch view">
            <a href="/admin" className={pathname === "/admin" ? "active" : ""}><Icon name="shield" size={16} /><span>Admin view</span></a>
            <a href="/dashboard" className={pathname !== "/admin" ? "active" : ""}><Icon name="user" size={16} /><span>Artist view</span></a>
          </div>
        )}

        <nav className="side-nav" aria-label="Main">
          <p className="nav-label">Menu</p>
          {MAIN.map(([icon, label, href]) => {
            const active = !href.includes("#") && pathname === href;
            return (
              <a key={label} href={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
                <Icon name={icon} />
                <span>{label}</span>
              </a>
            );
          })}

          <p className="nav-label nav-label-soon">Coming soon</p>
          {SOON.map(([icon, label]) => (
            <span key={label} className="nav-soon" aria-disabled="true">
              <Icon name={icon} />
              <span>{label}</span>
              <em>Soon</em>
            </span>
          ))}
        </nav>

        <button className="signout" onClick={logout}>
          <Icon name="logout" />
          <span>Sign out</span>
        </button>
      </aside>

      <main className="app-main">{children}</main>
    </div>
  );
}
