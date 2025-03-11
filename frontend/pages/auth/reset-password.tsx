import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { MdVisibility, MdVisibilityOff } from "react-icons/md";

export default function ResetPassword() {
  const [step, setStep] = useState<number>(1);
  const [email, setEmail] = useState<string>("");
  const [resetToken, setResetToken] = useState<string>(""); // token stored but not editable
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [passwordVisible, setPasswordVisible] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const router = useRouter();

  const toggleVisibility = () => setPasswordVisible((prev) => !prev);

  // Step 1: Request reset token
  const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("https://ai-content-curator-backend.vercel.app/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to request reset token");
      } else {
        // Assume the response contains a resetToken when the email is verified
        setResetToken(data.resetToken || "");
        setMessage("Reset token sent. Your email is now locked for reset.");
        setStep(2);
      }
    } catch (err) {
      setError("An error occurred while requesting reset token.");
    }
  };

  // Step 2: Submit email (read-only), token (hidden), and new password to reset
  const handleResetSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    try {
      const res = await fetch(
        "https://ai-content-curator-backend.vercel.app/api/auth/confirm-reset-password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, token: resetToken, newPassword }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Password reset failed");
      } else {
        setMessage("Password reset successfully. Redirecting to login...");
        setTimeout(() => router.push("/auth/login"), 2000);
      }
    } catch (err) {
      setError("An error occurred while resetting password.");
    }
  };

  return (
    <div className="reset-container">
      <h1 className="reset-title">Reset Password</h1>
      {error && <p className="error-msg">{error}</p>}
      {message && <p className="success-msg">{message}</p>}
      {step === 1 && (
        <form className="reset-form" onSubmit={handleEmailSubmit}>
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
          <button type="submit" className="btn submit-btn">
            Send Reset Token
          </button>
        </form>
      )}
      {step === 2 && (
        <form className="reset-form" onSubmit={handleResetSubmit}>
          <div className="form-group">
            <label className="form-label">Email:</label>
            <input type="email" className="form-input" value={email} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">New Password:</label>
            <div className="password-input-container">
              <input
                type={passwordVisible ? "text" : "password"}
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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
          <div className="form-group">
            <label className="form-label">Confirm New Password:</label>
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
            Reset Password
          </button>
        </form>
      )}
      <div className="form-links">
        <p>
          Already have an account?{" "}
          <Link href="/auth/login" legacyBehavior>
            <a>Login</a>
          </Link>
        </p>
        <p>
          Don't have an account?{" "}
          <Link href="/auth/register" legacyBehavior>
            <a>Register</a>
          </Link>
        </p>
      </div>
    </div>
  );
}
