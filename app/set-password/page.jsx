"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib";
import { useRouter } from "next/navigation";
import Logo from "../components/Logo";

export default function SetPassword() {
  const [password, setPassword] = useState(""), [confirm, setConfirm] = useState(""), [msg, setMsg] = useState(""), [ready, setReady] = useState(false), router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setReady(true); else setMsg("Open this page from the invitation email link.");
    });
  }, []);

  async function save(e) {
    e.preventDefault();
    if (password.length < 8) return setMsg("Password must be at least 8 characters.");
    if (password !== confirm) return setMsg("Passwords do not match.");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setMsg(error.message);
    else { setMsg("Password set. Welcome to YOUNG BOYZ Distribution."); setTimeout(() => router.push("/dashboard"), 900); }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-logo"><Logo variant="full" width={300} /></div>
        <div className="login-eyebrow">Artist invitation</div>
        <h1>Create password</h1>
        <p className="login-subtitle">Choose a password with at least 8 characters to activate your account.</p>
        {ready ? (
          <form className="login-form" onSubmit={save}>
            <label>Password<input type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required /></label>
            <label>Confirm password<input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required /></label>
            <button className="primary">Activate account</button>
            {msg && <div className="form-message" role="status">{msg}</div>}
          </form>
        ) : (
          <div className="form-message" role="status">{msg || "Checking invitation…"}</div>
        )}
      </section>
    </main>
  );
}
