import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const navLinkClass = ({ isActive }) =>
    `nav-link ${isActive ? 'active' : ''}`;

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-container">
          <div className="header-left">
            <NavLink to="/dashboard" className="logo">
              <span className="logo-icon">S</span>
              <span className="logo-text">SCS</span>
            </NavLink>
          </div>

          <nav className={`main-nav ${menuOpen ? 'open' : ''}`}>
            <NavLink to="/dashboard" className={navLinkClass} onClick={() => setMenuOpen(false)}>
              Dashboard
            </NavLink>
            <NavLink to="/projects" className={navLinkClass} onClick={() => setMenuOpen(false)}>
              Projects
            </NavLink>
          </nav>

          <div className="header-right">
            <div className="user-menu">
              <div className="avatar">{user?.fname?.[0]}{user?.lname?.[0]}</div>
              <span className="user-name hide-mobile">{user?.fname} {user?.lname}</span>
              <button onClick={handleLogout} className="btn btn-secondary btn-sm">
                Logout
              </button>
            </div>
          </div>

          <button
            className="menu-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </header>

      <main className="app-main">
        <div className="container">
          <Outlet />
        </div>
      </main>

      <style>{`
        .app-layout {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .app-header {
          background-color: var(--white);
          border-bottom: 1px solid var(--gray-200);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .header-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 1rem;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .header-left {
          display: flex;
          align-items: center;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          text-decoration: none;
          font-weight: 700;
          color: var(--gray-900);
        }

        .logo-icon {
          width: 32px;
          height: 32px;
          background-color: var(--primary);
          color: var(--white);
          border-radius: var(--radius);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.125rem;
        }

        .logo-text {
          font-size: 1.25rem;
        }

        .main-nav {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .nav-link {
          padding: 0.5rem 1rem;
          color: var(--gray-600);
          font-weight: 500;
          text-decoration: none;
          border-radius: var(--radius);
          transition: all 0.15s ease;
        }

        .nav-link:hover {
          color: var(--gray-900);
          background-color: var(--gray-100);
          text-decoration: none;
        }

        .nav-link.active {
          color: var(--primary-dark);
          background-color: var(--primary-bg);
        }

        .header-right {
          display: flex;
          align-items: center;
        }

        .user-menu {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .user-name {
          font-weight: 500;
          color: var(--gray-700);
          font-size: 0.875rem;
        }

        .menu-toggle {
          display: none;
          flex-direction: column;
          gap: 4px;
          padding: 8px;
          background: none;
          border: none;
          cursor: pointer;
        }

        .menu-toggle span {
          display: block;
          width: 20px;
          height: 2px;
          background-color: var(--gray-600);
          border-radius: 1px;
          transition: all 0.15s ease;
        }

        .app-main {
          flex: 1;
          padding: 1.5rem 0;
        }

        @media (max-width: 768px) {
          .main-nav {
            position: fixed;
            top: 64px;
            left: 0;
            right: 0;
            background-color: var(--white);
            border-bottom: 1px solid var(--gray-200);
            padding: 1rem;
            flex-direction: column;
            align-items: stretch;
            display: none;
          }

          .main-nav.open {
            display: flex;
          }

          .menu-toggle {
            display: flex;
          }

          .user-menu {
            gap: 0.5rem;
          }

          .header-container {
            height: 56px;
          }
        }
      `}</style>
    </div>
  );
}

export default Layout;
