import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboard } from '../utils/api';

function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const result = await dashboard.getUser();
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner spinner-lg"></div>
        <span className="loading-text">Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">{error}</div>
    );
  }

  const completionRate = data?.totalAssignedTasks > 0
    ? Math.round((data.completedTasks / data.totalAssignedTasks) * 100)
    : 0;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1 className="page-title">Welcome, {user?.fname}!</h1>
        <p className="page-subtitle">Here's an overview of your projects and tasks</p>
      </div>

      <div className="grid grid-cols-4 mb-4">
        <div className="stat-card primary">
          <div className="stat-value">{data?.totalProjects || 0}</div>
          <div className="stat-label">Total Projects</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data?.ownedProjects || 0}</div>
          <div className="stat-label">Projects Owned</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data?.totalAssignedTasks || 0}</div>
          <div className="stat-label">Assigned Tasks</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{completionRate}%</div>
          <div className="stat-label">Completion Rate</div>
        </div>
      </div>

      <div className="grid grid-cols-3 mb-4">
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <span className="badge badge-completed">Completed</span>
            <span className="stat-value text-sm">{data?.completedTasks || 0}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <span className="badge badge-in-progress">In Progress</span>
            <span className="stat-value text-sm">{data?.inProgressTasks || 0}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <span className="badge badge-pending">Pending</span>
            <span className="stat-value text-sm">{data?.pendingTasks || 0}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="card-title">Your Projects</h2>
          <Link to="/projects" className="btn btn-primary btn-sm">View All</Link>
        </div>
        <div className="card-body">
          {data?.projects?.length > 0 ? (
            <div className="project-list">
              {data.projects.map(project => (
                <Link
                  key={project.project_id}
                  to={`/projects/${project.project_id}`}
                  className="project-item"
                >
                  <div className="project-info">
                    <h3 className="project-name">{project.project_name}</h3>
                    <div className="project-meta">
                      <span className={`badge badge-${project.role.toLowerCase()}`}>
                        {project.role}
                      </span>
                      <span className="text-sm text-gray">
                        {project.completedTasks}/{project.totalTasks} tasks completed
                      </span>
                    </div>
                  </div>
                  <div className="project-progress">
                    <div className="progress-bar">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${project.totalTasks > 0
                            ? Math.round((project.completedTasks / project.totalTasks) * 100)
                            : 0}%`
                        }}
                      ></div>
                    </div>
                    <span className="progress-text">
                      {project.totalTasks > 0
                        ? Math.round((project.completedTasks / project.totalTasks) * 100)
                        : 0}%
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📁</div>
              <h3 className="empty-state-title">No projects yet</h3>
              <p className="empty-state-text">
                Create your first project to start tracking contributions
              </p>
              <Link to="/projects" className="btn btn-primary">
                Go to Projects
              </Link>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .project-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .project-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          background-color: var(--gray-50);
          border-radius: var(--radius);
          text-decoration: none;
          color: inherit;
          transition: all 0.15s ease;
        }

        .project-item:hover {
          background-color: var(--primary-bg);
          text-decoration: none;
        }

        .project-name {
          font-size: 1rem;
          font-weight: 600;
          color: var(--gray-800);
          margin-bottom: 0.25rem;
        }

        .project-meta {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .project-progress {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          min-width: 150px;
        }

        .project-progress .progress-bar {
          flex: 1;
        }

        .progress-text {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--primary-dark);
          min-width: 40px;
          text-align: right;
        }

        @media (max-width: 640px) {
          .project-item {
            flex-direction: column;
            align-items: stretch;
            gap: 0.75rem;
          }

          .project-progress {
            min-width: auto;
          }
        }
      `}</style>
    </div>
  );
}

export default Dashboard;
