"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const STORE_NAME_REGEX = /^[a-z0-9]+$/;

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState("");

  const storeNameError = useMemo(() => {
    if (!storeName) return null;
    if (!STORE_NAME_REGEX.test(storeName)) return "Store name must match ^[a-z0-9]+$";
    return null;
  }, [storeName]);

  const storePreview = storeName ? `viiv.me/${storeName}` : "viiv.me/{storename}";

  return (
    <main style={{ maxWidth: 520, margin: "64px auto", padding: 24 }}>
      <h1 style={{ marginBottom: 8 }}>Sign up</h1>
      <p style={{ marginTop: 0, color: "#666" }}>
        This is a UI placeholder. Signup is not connected to the backend yet.
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

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          Store name
          <input
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="healthyfood"
            style={{
              padding: 10,
              borderRadius: 8,
              border: `1px solid ${storeNameError ? "#ff4d4f" : "#ddd"}`,
            }}
          />
        </label>

        <div
          style={{
            padding: 12,
            borderRadius: 8,
            border: "1px solid #eee",
            background: "#fafafa",
          }}
        >
          <div style={{ fontSize: 12, color: "#666" }}>Store preview</div>
          <div style={{ fontFamily: "monospace" }}>{storePreview}</div>
          {storeNameError ? (
            <div style={{ marginTop: 8, color: "#ff4d4f" }}>{storeNameError}</div>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={!!storeNameError || !storeName || !email || !password}
          style={{
            marginTop: 8,
            padding: 10,
            borderRadius: 999,
            border: "1px solid #111",
            background: !!storeNameError || !storeName || !email || !password ? "#999" : "#111",
            color: "#fff",
            fontWeight: 600,
            cursor: !!storeNameError || !storeName || !email || !password ? "not-allowed" : "pointer",
          }}
        >
          Create account
        </button>
      </form>

      <div style={{ marginTop: 16 }}>
        <Link href="/login">Already have an account?</Link>
      </div>
    </main>
  );
}
