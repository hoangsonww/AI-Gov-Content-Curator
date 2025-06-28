import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Head from "next/head";
import { MdVisibility, MdVisibilityOff } from "react-icons/md";
import { loginUser } from "../../services/api";
import { toast } from "react-toastify";

export default function Login() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [passwordVisible, setPasswordVisible] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    try {
      const data = await loginUser(email, password);
      setMessage("");
      toast("Login successful! Redirecting to Home... 🔐");
      router.push("/home");
    } catch (err: any) {
      setError(err.message);
      toast("Could not login user. Please try again.");
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
