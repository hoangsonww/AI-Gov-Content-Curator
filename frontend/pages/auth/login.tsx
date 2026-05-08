import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Head from "next/head";
import { MdVisibility, MdVisibilityOff, MdKey } from "react-icons/md";
import {
  loginUser,
  loginWithPasskey,
  isPasskeySupported,
} from "../../services/api";
import { toast } from "react-toastify";

export default function Login() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [passwordVisible, setPasswordVisible] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [passkeySupported, setPasskeySupported] = useState<boolean>(false);
  const [passkeyLoading, setPasskeyLoading] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    setPasskeySupported(isPasskeySupported());
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    try {
      await loginUser(email, password);
      setMessage("");
      toast("Login successful! Redirecting to Home... 🔐");
      router.push("/home");
    } catch (err: any) {
      setError(err.message);
      toast("Could not login user. Please try again.");
    }
  };

  const handlePasskeyLogin = async () => {
    setError("");
    setPasskeyLoading(true);
    try {
      await loginWithPasskey();
      toast("Signed in with passkey 🔑");
      router.push("/home");
    } catch (err: any) {
      // User-cancelled WebAuthn prompts surface as NotAllowedError — stay quiet.
      if (err?.name === "NotAllowedError") return;
      setError(err.message || "Passkey sign-in failed.");
      toast("Could not sign in with passkey.");
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>SynthoraAI - Login</title>
      </Head>
      <div className="login-container">
        <h1 className="login-title">Login 🔒</h1>
        <p
          className="subtitle"
          style={{ textAlign: "center", marginBottom: "1.5rem" }}
        >
          Welcome back — sign in to continue
        </p>
        {error && <p className="error-msg">{error}</p>}
        {message && <p className="success-msg">{message}</p>}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email:</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group password-group">
            <label className="form-label">Password:</label>
            <div className="password-input-container">
              <input
                className="form-input"
                type={passwordVisible ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setPasswordVisible((prev) => !prev)}
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
            Login
          </button>
        </form>
        {passkeySupported && (
          <>
            <div className="passkey-divider">
              <span>or</span>
            </div>
            <div className="passkey-cta-row">
              <button
                type="button"
                className="passkey-btn"
                onClick={handlePasskeyLogin}
                disabled={passkeyLoading}
                aria-label="Sign in with a passkey"
              >
                <MdKey size={18} className="passkey-icon" aria-hidden />
                {passkeyLoading ? "Waiting…" : "Sign in with a passkey"}
              </button>
            </div>
          </>
        )}
        <div className="form-links">
          <p>
            Don't have an account?{" "}
            <Link href="/auth/register" legacyBehavior>
              <a>Register</a>
            </Link>
          </p>
          <p>
            Forgot your password?{" "}
            <Link href="/auth/reset-password" legacyBehavior>
              <a>Reset Password</a>
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
