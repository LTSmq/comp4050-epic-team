"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import styles from "./authForm.module.css";

export interface AuthFormProps {
  mode: "login" | "register";
}

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const isRegister = mode === "register";
  const [username, setUsername] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (isRegister) {
      if (!username.trim() || !email.trim() || !password || !confirmPassword) {
        setError("Please fill in all fields.");
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    } else if (!identifier.trim() || !password) {
      setError("Please enter your email/username and password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(isRegister ? "/api/register" : "/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isRegister
            ? { username: username.trim(), email: email.trim(), password }
            : { email: identifier.trim(), password }
        ),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.message || (isRegister ? "Registration failed." : "Login failed."));
        return;
      }

      setMessage(isRegister ? "Account created successfully! Redirecting..." : "Logged in successfully! Redirecting...");

      if (isRegister) {
        setUsername("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
      }

    setTimeout(() => router.push(isRegister ? "/login" : "/portal"), //when the user logs in, they are redirected to the portal. 
    isRegister ? 1200 : 800
);
    } catch (error) {
      console.error("Auth request error:", error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>{isRegister ? "Create an Account" : "Welcome Back"}</h1>

        <form className={styles.form} onSubmit={handleSubmit}>
          {isRegister ? (
            <>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="username">Username</label>
                <input
                  id="username"
                  className={styles.input}
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="e.g. johndoe"
                  disabled={loading}
                  autoComplete="username"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="email">Email</label>
                <input
                  id="email"
                  className={styles.input}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  disabled={loading}
                  autoComplete="email"
                />
              </div>
            </>
          ) : (
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="identifier">Email or Username</label>
              <input
                id="identifier"
                className={styles.input}
                type="text"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="you@example.com or username"
                disabled={loading}
                autoComplete="username"
              />
            </div>
          )}

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="password">Password</label>
            <input
              id="password"
              className={styles.input}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              disabled={loading}
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
          </div>

          {isRegister && (
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                className={styles.input}
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="••••••••"
                disabled={loading}
                autoComplete="new-password"
              />
            </div>
          )}

          {error && <div className={styles.alertError} role="alert">⚠️ {error}</div>}
          {message && <div className={styles.alertSuccess} role="status">✓ {message}</div>}

          <button type="submit" className={styles.submitButton} disabled={loading}>
            {loading && <span className={styles.spinner} />}
            {loading ? (isRegister ? "Creating account..." : "Signing in...") : isRegister ? "Register" : "Sign In"}
          </button>
        </form>

        <footer className={styles.footer}>
          <p>
            {isRegister ? "Already have an account?" : "Don't have an account?"}
            <button
              type="button"
              className={styles.switchLink}
              onClick={() => router.push(isRegister ? "/login" : "/register")}
            >
              {isRegister ? "Log In" : "Create Account"}
            </button>
          </p>
        </footer>
      </div>
    </div>
  );
}
