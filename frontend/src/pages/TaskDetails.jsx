import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { tasks as tasksApi, members as membersApi, projects as projectsApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';

function TaskDetails() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState(null);
  const [project, setProject] = useState(null);
  const [projectMembers, setProjectMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Edit states
  const [editingStatus, setEditingStatus] = useState(null);
  const [editingRemarks, setEditingRemarks] = useState(null);
  const [showAddAssignee, setShowAddAssignee] = useState(false);

  const isOwner = project?.role === 'Owner';
  const userAssignment = task?.assignees?.find(a => a.userdesc === user?.userdesc);

  useEffect(() => {
    loadTask();
  }, [taskId]);

  async function loadTask() {
    try {
      const taskData = await tasksApi.get(taskId);
      setTask(taskData);

      const [projectData, members] = await Promise.all([
        projectsApi.get(taskData.project_id),
        membersApi.getAll(taskData.project_id)
      ]);
      setProject(projectData);
      setProjectMembers(members);
    } catch (err) {
      setError(err.message || 'Failed to load task');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateStatus(userdesc, newStatus) {
    setActionLoading(true);
    try {
      await tasksApi.updateAssignee(taskId, userdesc, { status: newStatus });
      setEditingStatus(null);
      loadTask();
    } catch (err) {
      setError(err.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUpdateRemarks(userdesc, remarks) {
    setActionLoading(true);
    try {
      await tasksApi.updateAssignee(taskId, userdesc, { remarks });
      setEditingRemarks(null);
      loadTask();
    } catch (err) {
      setError(err.message || 'Failed to update remarks');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAddAssignee(userdesc) {
    setActionLoading(true);
    try {
      await tasksApi.addAssignee(taskId, userdesc);
      setShowAddAssignee(false);
      loadTask();
    } catch (err) {
      setError(err.message || 'Failed to add assignee');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRemoveAssignee(userdesc) {
    if (!confirm('Are you sure you want to remove this assignee?')) return;

    try {
      await tasksApi.removeAssignee(taskId, userdesc);
      loadTask();
    } catch (err) {
      setError(err.message || 'Failed to remove assignee');
    }
  }

  async function handleDeleteTask() {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      await tasksApi.delete(taskId);
      navigate(`/projects/${task.project_id}`);
    } catch (err) {
      setError(err.message || 'Failed to delete task');
    }
  }

  function canEditAssignee(assigneeUserdesc) {
    return isOwner || assigneeUserdesc === user?.userdesc;
  }

  const unassignedMembers = projectMembers.filter(
    m => !task?.assignees?.some(a => a.userdesc === m.userdesc)
  );

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner spinner-lg"></div>
        <span className="loading-text">Loading task...</span>
      </div>
    );
  }

  if (error) {
    return <div className="alert alert-error">{error}</div>;
  }

  return (
    <div className="task-details">
      <div className="page-header">
        <div className="flex items-center gap-2 mb-2">
          <Link to={`/projects/${task?.project_id}`} className="back-link">
            &larr; Back to {project?.project_name || 'Project'}
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">{task?.task_description}</h1>
            <p className="page-subtitle">Task ID: {taskId}</p>
          </div>
          {isOwner && (
            <button className="btn btn-danger btn-sm" onClick={handleDeleteTask}>
              Delete Task
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 mb-4">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Task Information</h2>
          </div>
          <div className="card-body">
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Status</span>
                <span className={`badge badge-${task?.status?.toLowerCase().replace(' ', '-')}`}>
                  {task?.status}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Deadline</span>
                <span className="info-value">
                  {task?.task_date_deadline
                    ? new Date(task.task_date_deadline).toLocaleDateString()
                    : 'No deadline set'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Created</span>
                <span className="info-value">
                  {task?.task_date_created
                    ? new Date(task.task_date_created).toLocaleDateString()
                    : '-'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Assignees</span>
                <span className="info-value">{task?.assignees?.length || 0} members</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Uploaded Proof</h2>
          </div>
          <div className="card-body">
            <div className="proof-placeholder">
              <div className="proof-placeholder-icon">📎</div>
              <p className="proof-placeholder-text">
                File upload coming soon
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-header flex items-center justify-between">
          <h2 className="card-title">Assigned Members</h2>
          {isOwner && unassignedMembers.length > 0 && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowAddAssignee(true)}
            >
              + Add Assignee
            </button>
          )}
        </div>
        <div className="card-body">
          {task?.assignees?.length > 0 ? (
            <div className="assignees-list">
              {task.assignees.map(assignee => (
                <div key={assignee.userdesc} className="assignee-card">
                  <div className="assignee-header">
                    <div className="flex items-center gap-3">
                      <div className="avatar">
                        {assignee.fname?.[0]}{assignee.lname?.[0]}
                      </div>
                      <div>
                        <h3 className="assignee-name">{assignee.fullName}</h3>
                        <p className="assignee-email">{assignee.email}</p>
                      </div>
                    </div>
                    <div className="assignee-actions">
                      {editingStatus === assignee.userdesc ? (
                        <select
                          className="form-select"
                          value={assignee.status}
                          onChange={(e) => handleUpdateStatus(assignee.userdesc, e.target.value)}
                          disabled={actionLoading}
                          autoFocus
                          onBlur={() => setEditingStatus(null)}
                        >
                          <option value="Pending">Pending</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                        </select>
                      ) : (
                        <button
                          className={`badge badge-${assignee.status?.toLowerCase().replace(' ', '-')} clickable`}
                          onClick={() => canEditAssignee(assignee.userdesc) && setEditingStatus(assignee.userdesc)}
                          disabled={!canEditAssignee(assignee.userdesc)}
                        >
                          {assignee.status}
                          {canEditAssignee(assignee.userdesc) && ' ✎'}
                        </button>
                      )}
                      {isOwner && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleRemoveAssignee(assignee.userdesc)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="assignee-details">
                    <div className="detail-item">
                      <span className="detail-label">Remarks:</span>
                      {editingRemarks === assignee.userdesc ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const form = e.target;
                            handleUpdateRemarks(assignee.userdesc, form.remarks.value);
                          }}
                          className="remarks-form"
                        >
                          <input
                            type="text"
                            name="remarks"
                            className="form-input"
                            defaultValue={assignee.remarks || ''}
                            maxLength={100}
                            autoFocus
                          />
                          <button type="submit" className="btn btn-primary btn-sm" disabled={actionLoading}>
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setEditingRemarks(null)}
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <span className="detail-value">
                          {assignee.remarks || <em className="text-gray">No remarks</em>}
                          {canEditAssignee(assignee.userdesc) && (
                            <button
                              className="edit-btn"
                              onClick={() => setEditingRemarks(assignee.userdesc)}
                            >
                              ✎
                            </button>
                          )}
                        </span>
                      )}
                    </div>
                    {assignee.task_date_finished && (
                      <div className="detail-item">
                        <span className="detail-label">Completed:</span>
                        <span className="detail-value text-success">
                          {new Date(assignee.task_date_finished).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>No members assigned to this task</p>
              {isOwner && unassignedMembers.length > 0 && (
                <button
                  className="btn btn-primary mt-3"
                  onClick={() => setShowAddAssignee(true)}
                >
                  Add Assignee
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Timeline</h2>
        </div>
        <div className="card-body">
          <div className="timeline">
            <div className="timeline-item">
              <div className="timeline-date">
                {task?.task_date_created
                  ? new Date(task.task_date_created).toLocaleString()
                  : 'Unknown'}
              </div>
              <div className="timeline-content">Task created</div>
            </div>
            {task?.assignees?.filter(a => a.task_date_finished).map(assignee => (
              <div key={assignee.userdesc} className="timeline-item">
                <div className="timeline-date">
                  {new Date(assignee.task_date_finished).toLocaleString()}
                </div>
                <div className="timeline-content">
                  {assignee.fullName} completed their assignment
                  {assignee.remarks && `: "${assignee.remarks}"`}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Assignee Modal */}
      {showAddAssignee && (
        <div className="modal-overlay" onClick={() => setShowAddAssignee(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Assignee</h2>
              <button className="modal-close" onClick={() => setShowAddAssignee(false)}>&times;</button>
            </div>
            <div className="modal-body">
              {unassignedMembers.length > 0 ? (
                <div className="member-select-list">
                  {unassignedMembers.map(member => (
                    <button
                      key={member.userdesc}
                      className="member-select-item"
                      onClick={() => handleAddAssignee(member.userdesc)}
                      disabled={actionLoading}
                    >
                      <div className="avatar avatar-sm">
                        {member.fname?.[0]}{member.lname?.[0]}
                      </div>
                      <div>
                        <div className="font-medium">{member.fullName}</div>
                        <div className="text-sm text-gray">{member.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-gray">All members are already assigned</p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddAssignee(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .back-link {
          font-size: 0.875rem;
          color: var(--gray-500);
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
        }

        .info-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .info-label {
          font-size: 0.8125rem;
          color: var(--gray-500);
        }

        .info-value {
          font-weight: 500;
          color: var(--gray-800);
        }

        .assignees-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .assignee-card {
          padding: 1rem;
          background-color: var(--gray-50);
          border-radius: var(--radius);
        }

        .assignee-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.75rem;
        }

        .assignee-name {
          font-weight: 600;
          color: var(--gray-800);
          margin-bottom: 0.125rem;
        }

        .assignee-email {
          font-size: 0.8125rem;
          color: var(--gray-500);
        }

        .assignee-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .assignee-details {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding-left: 3rem;
        }

        .detail-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
        }

        .detail-label {
          color: var(--gray-500);
          min-width: 80px;
        }

        .detail-value {
          color: var(--gray-700);
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .edit-btn {
          background: none;
          border: none;
          color: var(--gray-400);
          cursor: pointer;
          padding: 0.25rem;
          font-size: 0.875rem;
        }

        .edit-btn:hover {
          color: var(--primary);
        }

        .remarks-form {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex: 1;
        }

        .remarks-form .form-input {
          flex: 1;
          padding: 0.375rem 0.625rem;
          font-size: 0.875rem;
        }

        .badge.clickable {
          cursor: pointer;
          border: none;
          font-family: inherit;
        }

        .badge.clickable:hover {
          opacity: 0.9;
        }

        .member-select-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .member-select-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          background-color: var(--gray-50);
          border: 1px solid var(--gray-200);
          border-radius: var(--radius);
          cursor: pointer;
          text-align: left;
          width: 100%;
          transition: all 0.15s ease;
        }

        .member-select-item:hover {
          background-color: var(--primary-bg);
          border-color: var(--primary-light);
        }

        @media (max-width: 640px) {
          .info-grid {
            grid-template-columns: 1fr;
          }

          .assignee-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.75rem;
          }

          .assignee-details {
            padding-left: 0;
          }

          .detail-item {
            flex-direction: column;
            align-items: flex-start;
          }

          .remarks-form {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  );
}

export default TaskDetails;
