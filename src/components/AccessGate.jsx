import { useState } from "react";

/**
 * Access code gate. Validates against a list of codes.
 * In production, set VITE_ACCESS_CODES as a comma-separated list in .env.
 * Falls back to a default demo code if not set.
 */
const VALID_CODES = (import.meta.env.VITE_ACCESS_CODES || "LOXLEY2026,UES-INTEL,DEMO")
  .split(",")
  .map((c) => c.trim().toUpperCase());

export default function AccessGate({ onAuthenticated }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [shaking, setShaking] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (VALID_CODES.includes(code.trim().toUpperCase())) {
      sessionStorage.setItem("loxley_access", "1");
      onAuthenticated();
    } else {
      setError("Invalid access code");
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    }
  };

  return (
    <div style={styles.backdrop}>
      <div style={{ ...styles.card, animation: shaking ? "shake 0.4s ease" : "none" }}>
        <div style={styles.logo}>LOXLEY AI</div>
        <h2 style={styles.heading}>Corridor Intelligence Portal</h2>
        <p style={styles.sub}>
          Subscriber-gated access to Watkins-scored real estate corridor data.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="text"
            value={code}
            onChange={(e) => { setCode(e.target.value); setError(""); }}
            placeholder="Enter access code"
            style={styles.input}
            autoFocus
          />
          <button type="submit" style={styles.button}>
            Enter Portal
          </button>
        </form>

        {error && <p style={styles.error}>{error}</p>}

        <p style={styles.footer}>
          Contact your account manager for access credentials.
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  backdrop: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: 24,
  },
  card: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 12,
    padding: "48px 40px",
    maxWidth: 420,
    width: "100%",
    textAlign: "center",
    boxShadow: "0 25px 50px rgba(0,0,0,0.4)",
  },
  logo: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.2em",
    color: "#3b82f6",
    marginBottom: 8,
  },
  heading: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: 700,
    margin: "0 0 8px",
  },
  sub: {
    color: "#64748b",
    fontSize: 14,
    margin: "0 0 32px",
    lineHeight: 1.5,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  input: {
    background: "#0f172a",
    color: "#e2e8f0",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "14px 16px",
    fontSize: 16,
    textAlign: "center",
    letterSpacing: "0.1em",
    outline: "none",
  },
  button: {
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "14px 20px",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.2s",
  },
  error: {
    color: "#ef4444",
    fontSize: 13,
    marginTop: 12,
  },
  footer: {
    color: "#475569",
    fontSize: 12,
    marginTop: 24,
  },
};
