import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { projects as projectsApi } from '../utils/api';

function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const data = await projectsApi.getAll();
      setProjects(data);
    } catch (err) {
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    setCreating(true);
    try {
      const result = await projectsApi.create({ project_name: newProjectName.trim() });
      setProjects([result.project, ...projects]);
      setShowModal(false);
      setNewProjectName('');
    } catch (err) {
      setError(err.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner spinner-lg"></div>
        <span className="loading-text">Loading projects...</span>
      </div>
    );
  }

  return (
    <div className="projects-page">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">Manage your group projects</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + New Project
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {projects.length > 0 ? (
        <div className="projects-grid">
          {projects.map(project => (
            <Link
              key={project.project_id}
              to={`/projects/${project.project_id}`}
              className="project-card"
            >
              <div className="project-card-header">
                <h3 className="project-card-title">{project.project_name}</h3>
                <span className={`badge badge-${project.role.toLowerCase()}`}>
                  {project.role}
                </span>
              </div>
              <div className="project-card-body">
                <div className="project-card-meta">
                  <span className="text-sm text-gray">ID: {project.project_id}</span>
                </div>
                <div className="project-card-date">
                  Created {new Date(project.created_at).toLocaleDateString()}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📁</div>
            <h3 className="empty-state-title">No projects yet</h3>
            <p className="empty-state-text">
              Create your first project to start tracking contributions
            </p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              Create Project
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create New Project</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label" htmlFor="projectName">Project Name</label>
                  <input
                    type="text"
                    id="projectName"
                    className="form-input"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Enter project name"
                    maxLength={100}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? (
                    <>
                      <div className="spinner"></div>
                      Creating...
                    </>
                  ) : (
                    'Create Project'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .projects-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1rem;
        }

        .project-card {
          display: block;
          background-color: var(--white);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow);
          text-decoration: none;
          color: inherit;
          transition: all 0.15s ease;
          overflow: hidden;
        }

        .project-card:hover {
          box-shadow: var(--shadow-md);
          transform: translateY(-2px);
          text-decoration: none;
        }

        .project-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 1.25rem;
          padding-bottom: 0;
        }

        .project-card-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--gray-800);
          margin: 0;
          line-height: 1.3;
        }

        .project-card-body {
          padding: 1rem 1.25rem 1.25rem;
        }

        .project-card-meta {
          margin-bottom: 0.5rem;
        }

        .project-card-date {
          font-size: 0.8125rem;
          color: var(--gray-500);
        }

        @media (max-width: 640px) {
          .page-header {
            flex-direction: column;
            align-items: stretch;
            gap: 1rem;
          }

          .projects-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default Projects;
