import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { MdVisibility, MdVisibilityOff } from "react-icons/md";
import { registerUser } from "../../services/api";
import { toast } from "react-toastify";

export default function Register() {
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [passwordVisible, setPasswordVisible] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const router = useRouter();

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
