import { useState } from "react";
import { useAuth } from "../auth/AuthContext";

function AuthModal({ onClose, onSuccess }) {
  const {
    login,
    register,
    loginWithGoogle
  } = useAuth();

  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] =
    useState(false);

  function change(event) {
    setForm(previous => ({
      ...previous,
      [event.target.name]: event.target.value
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        await register(
          form.email,
          form.password,
          form.fullName
        );
      } else {
        await login(
          form.email,
          form.password
        );
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      setError(
        error.message ||
        "Authentication failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function googleSignIn() {
    setError("");
    setLoading(true);

    try {
      await loginWithGoogle();
      onSuccess?.();
      onClose();
    } catch (error) {
      setError(
        error.message ||
        "Google sign-in failed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="accountOverlay">
      <div className="accountModal authModal">
        <button
          className="accountClose"
          onClick={onClose}
        >
          ×
        </button>

        <p className="eyebrow">
          Secure customer account
        </p>

        <h2>
          {mode === "login"
            ? "Welcome back"
            : "Create your account"}
        </h2>

        <p className="accountDescription">
          Sign in to securely save your delivery
          details and preferred payment method.
        </p>

        <button
          className="googleButton"
          onClick={googleSignIn}
          disabled={loading}
        >
          Continue with Google
        </button>

        <div className="accountDivider">
          <span>or</span>
        </div>

        <form
          className="accountForm"
          onSubmit={submit}
        >
          {mode === "register" && (
            <label>
              Full name
              <input
                name="fullName"
                value={form.fullName}
                onChange={change}
                required
              />
            </label>
          )}

          <label>
            Email address
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={change}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={change}
              minLength="8"
              required
            />
          </label>

          {error && (
            <div className="accountError">
              {error}
            </div>
          )}

          <button
            className="accountPrimary"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <button
          className="accountSwitch"
          onClick={() =>
            setMode(
              mode === "login"
                ? "register"
                : "login"
            )
          }
        >
          {mode === "login"
            ? "New customer? Create an account"
            : "Already registered? Sign in"}
        </button>
      </div>
    </div>
  );
}

export default AuthModal;