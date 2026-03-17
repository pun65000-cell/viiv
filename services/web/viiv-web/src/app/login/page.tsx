"use client";

import Link from "next/link";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main style={{ maxWidth: 420, margin: "64px auto", padding: 24 }}>
      <h1 style={{ marginBottom: 8 }}>Login</h1>
      <p style={{ marginTop: 0, color: "#666" }}>
        This is a UI placeholder. Authentication is not wired yet.
      </p>

      <form
        onSubmit={(e) => e.preventDefault()}
        style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="you@company.com"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          Password
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="••••••••"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
          />
        </label>

        <button
          type="submit"
          style={{
            marginTop: 8,
            padding: 10,
            borderRadius: 999,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            fontWeight: 600,
          }}
        >
          Login
        </button>
      </form>

      <div style={{ marginTop: 16 }}>
        <Link href="/signup">Create an account</Link>
      </div>
    </main>
  );
}
