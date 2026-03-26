import { useState } from "react";
import { supabase } from "../supabaseClient.js";

export default function AccessGate({ onAuthenticated }) {
  const [mode, setMode] = useState("login"); // "login" | "signup" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [shaking, setShaking] = useState(false);

  const shake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);
    if (err) {
      setError(err.message);
      shake();
    } else {
      onAuthenticated();
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      shake();
      return;
    }

    setLoading(true);

    const { error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    setLoading(false);
    if (err) {
      setError(err.message);
      shake();
    } else {
      setMessage("Check your email for a confirmation link, then sign in.");
      setMode("login");
      setPassword("");
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const { error: err } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: window.location.origin }
    );

    setLoading(false);
    if (err) {
      setError(err.message);
      shake();
    } else {
      setMessage("Password reset link sent. Check your email.");
    }
  };

  const onSubmit =
    mode === "login"
      ? handleLogin
      : mode === "signup"
        ? handleSignup
        : handleForgot;

  return (
    <div style={styles.backdrop}>
      <div
        style={{
          ...styles.card,
          animation: shaking ? "shake 0.4s ease" : "none",
        }}
      >
        <div style={styles.logo}>LOXLEY AI</div>
        <h2 style={styles.heading}>Corridor Intelligence Portal</h2>
        <p style={styles.sub}>
          {mode === "login" && "Sign in to access Watkins-scored corridor data."}
          {mode === "signup" && "Create your account to get started."}
          {mode === "forgot" && "Enter your email to reset your password."}
        </p>

        <form onSubmit={onSubmit} style={styles.form}>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            placeholder="Email address"
            style={styles.input}
            autoFocus
            required
          />

          {mode !== "forgot" && (
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder="Password"
              style={styles.input}
              required
              minLength={6}
            />
          )}

          <button type="submit" disabled={loading} style={{
            ...styles.button,
            ...(loading ? styles.buttonDisabled : {}),
          }}>
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Sign In"
                : mode === "signup"
                  ? "Create Account"
                  : "Send Reset Link"}
          </button>
        </form>

        {error && <p style={styles.error}>{error}</p>}
        {message && <p style={styles.success}>{message}</p>}

        <div style={styles.links}>
          {mode === "login" && (
            <>
              <button onClick={() => { setMode("signup"); setError(""); setMessage(""); }} style={styles.link}>
                Create an account
              </button>
              <span style={styles.dot}>&middot;</span>
              <button onClick={() => { setMode("forgot"); setError(""); setMessage(""); }} style={styles.link}>
                Forgot password?
              </button>
            </>
          )}
          {mode !== "login" && (
            <button onClick={() => { setMode("login"); setError(""); setMessage(""); }} style={styles.link}>
              Back to sign in
            </button>
          )}
        </div>
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
    background:
      "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
    fontSize: 15,
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
    marginTop: 4,
  },
  buttonDisabled: {
    background: "#1e40af",
    cursor: "not-allowed",
    opacity: 0.7,
  },
  error: {
    color: "#ef4444",
    fontSize: 13,
    marginTop: 12,
  },
  success: {
    color: "#22c55e",
    fontSize: 13,
    marginTop: 12,
  },
  links: {
    marginTop: 24,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  link: {
    background: "none",
    border: "none",
    color: "#60a5fa",
    fontSize: 13,
    cursor: "pointer",
    textDecoration: "underline",
    padding: 0,
  },
  dot: {
    color: "#475569",
  },
};
