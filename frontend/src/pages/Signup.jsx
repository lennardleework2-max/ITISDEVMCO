import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Signup() {
  const [formData, setFormData] = useState({
    fname: '',
    lname: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  function handleChange(e) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await signup({
        fname: formData.fname,
        lname: formData.lname,
        email: formData.email,
        password: formData.password,
        usertype: 'Student'
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Signup failed');
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
          <h1 className="auth-title">Create account</h1>
          <p className="auth-subtitle">Join the School Contribution System</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="name-fields">
            <div className="form-group">
              <label className="form-label" htmlFor="fname">First Name</label>
              <input
                type="text"
                id="fname"
                name="fname"
                className="form-input"
                value={formData.fname}
                onChange={handleChange}
                placeholder="John"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="lname">Last Name</label>
              <input
                type="text"
                id="lname"
                name="lname"
                className="form-input"
                value={formData.lname}
                onChange={handleChange}
                placeholder="Doe"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              className="form-input"
              value={formData.email}
              onChange={handleChange}
              placeholder="john.doe@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              className="form-input"
              value={formData.password}
              onChange={handleChange}
              placeholder="At least 6 characters"
              required
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              className="form-input"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm your password"
              required
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
            {loading ? (
              <>
                <div className="spinner"></div>
                Creating account...
              </>
            ) : (
              'Create account'
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account? <Link to="/login">Sign in</Link>
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

        .name-fields {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
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

        @media (max-width: 480px) {
          .name-fields {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default Signup;
