import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-logo">
            <span className="logo-icon">S</span>
            <span className="logo-text">SCS</span>
          </div>
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
            {loading ? (
              <>
                <div className="spinner"></div>
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Don't have an account? <Link to="/signup">Sign up</Link>
          </p>
        </div>
      </div>

      <style>{`
        .auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          background-color: var(--gray-50);
        }

        .auth-container {
          width: 100%;
          max-width: 400px;
          background-color: var(--white);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          padding: 2rem;
        }

        .auth-header {
          text-align: center;
          margin-bottom: 1.5rem;
        }

        .auth-logo {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
        }

        .auth-logo .logo-icon {
          width: 40px;
          height: 40px;
          background-color: var(--primary);
          color: var(--white);
          border-radius: var(--radius);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          font-weight: 700;
        }

        .auth-logo .logo-text {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--gray-900);
        }

        .auth-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--gray-900);
          margin-bottom: 0.25rem;
        }

        .auth-subtitle {
          color: var(--gray-500);
          font-size: 0.9375rem;
        }

        .auth-form {
          margin-bottom: 1.5rem;
        }

        .w-full {
          width: 100%;
        }

        .auth-footer {
          text-align: center;
          font-size: 0.875rem;
          color: var(--gray-600);
        }

        .auth-footer a {
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}

export default Login;
