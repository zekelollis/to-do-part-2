import React, { useState, useEffect } from "react";

/*
 * Screen curtain, not security.
 *
 * VITE_ variables are compiled into the client bundle, so this
 * passphrase is readable by anyone who opens dev tools. It exists to
 * keep the app from sitting open on screen during a share or when
 * someone walks up. For a real gate, use Vercel Deployment Protection.
 */

const PASS = import.meta.env.VITE_NOW_PASSPHRASE || "";
const UNLOCK_KEY = "now:unlocked";
const REMEMBER_DAYS = 30;

export function isUnlocked() {
  if (!PASS) return true;
  try {
    const until = Number(localStorage.getItem(UNLOCK_KEY) || 0);
    return Date.now() < until;
  } catch (e) {
    return false;
  }
}

export function lock() {
  try {
    localStorage.removeItem(UNLOCK_KEY);
  } catch (e) {}
}

export default function Gate({ children }) {
  const [open, setOpen] = useState(isUnlocked());
  const [entry, setEntry] = useState("");
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    const on = () => setOpen(isUnlocked());
    window.addEventListener("now:lock", on);
    return () => window.removeEventListener("now:lock", on);
  }, []);

  if (open) return children;

  const submit = () => {
    if (entry === PASS) {
      try {
        localStorage.setItem(
          UNLOCK_KEY,
          String(Date.now() + REMEMBER_DAYS * 86400000)
        );
      } catch (e) {}
      setOpen(true);
      setEntry("");
      setWrong(false);
    } else {
      setWrong(true);
      setEntry("");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(120% 90% at 50% 8%, #F2EFE8 0%, #E6E1D6 75%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "'Karla', system-ui, sans-serif",
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500&family=Karla:wght@400;500&family=IBM+Plex+Mono:wght@400&display=swap');
        input:focus-visible, button:focus-visible { outline: 2px solid #A07A2E; outline-offset: 3px; }`}</style>

      <div style={{ width: "100%", maxWidth: 380 }}>
        <div
          style={{
            fontFamily: "'Fraunces', Georgia, serif",
            fontSize: 40,
            color: "#22282F",
            marginBottom: 8,
            letterSpacing: "-0.02em",
          }}
        >
          To-Do
        </div>
        <div
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10.5,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: wrong ? "#A07A2E" : "#A19B8D",
            marginBottom: 26,
          }}
        >
          {wrong ? "not it, try again" : "passphrase"}
        </div>

        <input
          type="password"
          autoFocus
          value={entry}
          onChange={(e) => {
            setEntry(e.target.value);
            setWrong(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          style={{
            width: "100%",
            background: "#FFFDF8",
            border: "1px solid #DDD7C9",
            borderRadius: 2,
            color: "#22282F",
            fontFamily: "'Karla', system-ui, sans-serif",
            fontSize: 16,
            padding: "13px 14px",
            marginBottom: 16,
          }}
        />

        <button
          onClick={submit}
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            padding: "11px 19px",
            borderRadius: 2,
            cursor: "pointer",
            background: "#A07A2E",
            color: "#FFFDF8",
            border: "1px solid #A07A2E",
          }}
        >
          open
        </button>
      </div>
    </div>
  );
}
