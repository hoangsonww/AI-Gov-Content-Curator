import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { MdVisibility, MdVisibilityOff, MdKey } from "react-icons/md";
import {
  registerUser,
  signupWithPasskey,
  isPasskeySupported,
} from "../../services/api";
import { toast } from "react-toastify";

export default function Register() {
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [passwordVisible, setPasswordVisible] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [passkeySupported, setPasskeySupported] = useState<boolean>(false);
  const [passkeyLoading, setPasskeyLoading] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    setPasskeySupported(isPasskeySupported());
  }, []);

  const toggleVisibility = () => setPasswordVisible((prev) => !prev);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      await registerUser(name, email, password);
      setMessage("");
      toast("Registration successful! Please log in 🔓");
      router.push("/auth/login");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred",
      );
      toast("Could not register user. Please try again.");
    }
  };

  const handlePasskeySignup = async () => {
    setError("");
    if (!email) {
      setError("Enter your email above before creating a passkey account.");
      return;
    }
    setPasskeyLoading(true);
    try {
      await signupWithPasskey(email, name || undefined);
      toast("Account created with passkey 🔑");
      router.push("/home");
    } catch (err: any) {
      if (err?.name === "NotAllowedError") return;
      setError(err.message || "Passkey signup failed.");
      toast("Could not create passkey account.");
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>SynthoraAI - Register</title>
      </Head>
      <div className="register-container">
        <h1 className="register-title">Register 📝</h1>
        <p
          className="subtitle"
          style={{ textAlign: "center", marginBottom: "1.5rem" }}
        >
          Create your free account and get started!
        </p>
        {error && <p className="error-msg">{error}</p>}
        {message && <p className="success-msg">{message}</p>}
        <form className="register-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Name:</label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email:</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group password-group">
            <label className="form-label">Password:</label>
            <div className="password-input-container">
              <input
                type={passwordVisible ? "text" : "password"}
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={toggleVisibility}
                aria-label="Toggle password visibility"
              >
                {passwordVisible ? (
                  <MdVisibilityOff size={20} />
                ) : (
                  <MdVisibility size={20} />
                )}
              </button>
            </div>
          </div>
          <div className="form-group password-group">
            <label className="form-label">Confirm Password:</label>
            <div className="password-input-container">
              <input
                type={passwordVisible ? "text" : "password"}
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={toggleVisibility}
                aria-label="Toggle password visibility"
              >
                {passwordVisible ? (
                  <MdVisibilityOff size={20} />
                ) : (
                  <MdVisibility size={20} />
                )}
              </button>
            </div>
          </div>
          <button type="submit" className="btn submit-btn">
            Register
          </button>
        </form>
        {passkeySupported && (
          <>
            <div className="passkey-divider">
              <span>or skip the password</span>
            </div>
            <div className="passkey-cta-row">
              <button
                type="button"
                className="passkey-btn"
                onClick={handlePasskeySignup}
                disabled={passkeyLoading}
                aria-label="Sign up with a passkey"
              >
                <MdKey size={18} className="passkey-icon" aria-hidden />
                {passkeyLoading ? "Waiting…" : "Sign up with a passkey instead"}
              </button>
            </div>
            <p className="passkey-hint">
              Uses Face ID, Touch ID, Windows Hello, or a hardware key.
            </p>
          </>
        )}
        <div className="form-links">
          <p>
            Already have an account?{" "}
            <Link href="/auth/login" legacyBehavior>
              <a>Login</a>
            </Link>
          </p>
          <p>
            Forgot your password?{" "}
            <Link href="/auth/reset-password" legacyBehavior>
              <a>Reset here</a>
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
