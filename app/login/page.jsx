"use client";
import { useState } from "react";
import { supabase } from "../../lib";
import { useRouter } from "next/navigation";
import Logo from "../components/Logo";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function go(e) {
    e.preventDefault();
    setError("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setError(error.message);
    const { data: p } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
    router.push(p?.role === "admin" ? "/admin" : "/dashboard");
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-logo"><Logo variant="full" width={300} /></div>
        <div className="login-eyebrow">Artist / Admin portal</div>
        <h1>Sign in</h1>
        <p className="login-subtitle">Access your YOUNG BOYZ distribution dashboard.</p>
        <form className="login-form" onSubmit={go}>
          <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required /></label>
          <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" required /></label>
          <button type="submit" className="primary">Sign in</button>
          {error && <div className="login-error" role="alert">{error}</div>}
        </form>
        <div className="login-footer">YOUNG BOYZ MUSIC MENA · DISTRIBUTION PORTAL</div>
      </section>
    </main>
  );
}
