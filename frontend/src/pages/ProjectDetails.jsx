import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { dashboard, members as membersApi, tasks as tasksApi, projects as projectsApi, disputes as disputesApi, capacity as capacityApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';

function ProjectDetails() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [members, setMembers] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [capacities, setCapacities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // Modal states
  const [showAddMember, setShowAddMember] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showEditTask, setShowEditTask] = useState(false);
  const [showRaiseDispute, setShowRaiseDispute] = useState(false);
  const [showSetCapacity, setShowSetCapacity] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [memberEmail, setMemberEmail] = useState('');
  const [newTask, setNewTask] = useState({ description: '', deadline: '', assignees: [] });
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // Dispute modal state
  const [disputeStep, setDisputeStep] = useState(1);
  const [newDispute, setNewDispute] = useState({
    dispute_type: '',
    sub_type: '',
    description: '',
    supporting_context: '',
    related_member_userdesc: '',
    resolution_choice: ''
  });

  // Capacity modal state
  const [capacityForm, setCapacityForm] = useState({
    internship: '',
    organizations: '',
    other_school_work: '',
    personal_responsibilities: '',
    availability_hours_per_week: '',
    notes: ''
  });

  const isOwner = data?.project?.role === 'Owner';

  // Check if current user is assigned to a task
  function isAssignedToTask(task) {
    return task.assignees?.some(a => a.userdesc === user?.userdesc);
  }

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function loadData() {
    try {
      const [dashboardData, membersData, disputesData, capacityData] = await Promise.all([
        dashboard.getProject(projectId),
        membersApi.getAll(projectId),
        disputesApi.getByProject(projectId),
        capacityApi.getByProject(projectId)
      ]);
      setData(dashboardData);
      setMembers(membersData);
      setDisputes(disputesData);
      setCapacities(capacityData);
    } catch (err) {
      setError(err.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMember(e) {
    e.preventDefault();
    if (!memberEmail.trim()) return;

    setActionLoading(true);
    setActionError('');
    try {
      const result = await membersApi.add(projectId, { email: memberEmail.trim() });
      setMembers([...members, result.member]);
      setShowAddMember(false);
      setMemberEmail('');
      loadData();
    } catch (err) {
      setActionError(err.message || 'Failed to add member');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRemoveMember(userdesc) {
    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      await membersApi.remove(projectId, userdesc);
      setMembers(members.filter(m => m.userdesc !== userdesc));
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to remove member');
    }
  }

  async function handleCreateTask(e) {
    e.preventDefault();
    if (!newTask.description.trim()) return;

    setActionLoading(true);
    setActionError('');
    try {
      await tasksApi.create({
        project_id: projectId,
        task_description: newTask.description.trim(),
        task_date_deadline: newTask.deadline || null,
        assignees: newTask.assignees
      });
      setShowCreateTask(false);
      setNewTask({ description: '', deadline: '', assignees: [] });
      loadData();
    } catch (err) {
      setActionError(err.message || 'Failed to create task');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteProject() {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) return;

    try {
      await projectsApi.delete(projectId);
      navigate('/projects');
    } catch (err) {
      setError(err.message || 'Failed to delete project');
    }
  }

  function toggleAssignee(userdesc) {
    setNewTask(prev => ({
      ...prev,
      assignees: prev.assignees.includes(userdesc)
        ? prev.assignees.filter(u => u !== userdesc)
        : [...prev.assignees, userdesc]
    }));
  }

  function openEditTask(task, e) {
    e.preventDefault();
    e.stopPropagation();
    setEditingTask({
      task_id: task.task_id,
      description: task.task_description,
      deadline: task.task_date_deadline ? task.task_date_deadline.split('T')[0] : '',
      status: task.status,
      canFullEdit: isOwner // Only owners can edit description and deadline
    });
    setActionError('');
    setShowEditTask(true);
  }

  async function handleEditTask(e) {
    e.preventDefault();
    if (!editingTask.description.trim()) return;

    setActionLoading(true);
    setActionError('');
    try {
      await tasksApi.update(editingTask.task_id, {
        task_description: editingTask.description.trim(),
        task_date_deadline: editingTask.deadline || null,
        status: editingTask.status
      });
      setShowEditTask(false);
      setEditingTask(null);
      loadData();
    } catch (err) {
      setActionError(err.message || 'Failed to update task');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteTask(taskId, e) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      await tasksApi.delete(taskId);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to delete task');
    }
  }

  function openRaiseDispute() {
    setDisputeStep(1);
    setNewDispute({
      dispute_type: '',
      sub_type: '',
      description: '',
      supporting_context: '',
      related_member_userdesc: '',
      resolution_choice: ''
    });
    setActionError('');
    setShowRaiseDispute(true);
  }

  function nextDisputeStep() {
    if (disputeStep === 1 && !newDispute.dispute_type) {
      setActionError('Please select a dispute type');
      return;
    }
    if (disputeStep === 2 && !newDispute.description.trim()) {
      setActionError('Please provide a description');
      return;
    }
    setActionError('');
    setDisputeStep(disputeStep + 1);
  }

  function prevDisputeStep() {
    setActionError('');
    setDisputeStep(disputeStep - 1);
  }

  async function handleRaiseDispute(e) {
    e.preventDefault();

    if (!newDispute.resolution_choice) {
      setActionError('Please choose a resolution approach');
      return;
    }

    setActionLoading(true);
    setActionError('');

    try {
      await disputesApi.create({
        project_id: projectId,
        ...newDispute
      });
      setShowRaiseDispute(false);
      loadData();
    } catch (err) {
      setActionError(err.message || 'Failed to raise dispute');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResolveDispute(disputeId) {
    try {
      await disputesApi.update(disputeId, { status: 'Resolved' });
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to resolve dispute');
    }
  }

  function openSetCapacity() {
    // Load existing capacity if available
    const existingCapacity = capacities.find(c => c.userdesc === user?.userdesc);
    if (existingCapacity) {
      setCapacityForm({
        internship: existingCapacity.internship || '',
        organizations: existingCapacity.organizations || '',
        other_school_work: existingCapacity.other_school_work || '',
        personal_responsibilities: existingCapacity.personal_responsibilities || '',
        availability_hours_per_week: existingCapacity.availability_hours_per_week || '',
        notes: existingCapacity.notes || ''
      });
    } else {
      setCapacityForm({
        internship: '',
        organizations: '',
        other_school_work: '',
        personal_responsibilities: '',
        availability_hours_per_week: '',
        notes: ''
      });
    }
    setActionError('');
    setShowSetCapacity(true);
  }

  async function handleSaveCapacity(e) {
    e.preventDefault();
    setActionLoading(true);
    setActionError('');

    try {
      await capacityApi.save(projectId, capacityForm);
      setShowSetCapacity(false);
      loadData();
    } catch (err) {
      setActionError(err.message || 'Failed to save capacity information');
    } finally {
      setActionLoading(false);
    }
  }

  function getSuggestedAction(disputeType, subType = null) {
    const actions = {
      'Uneven Distribution': 'The system will analyze task complexity and suggest a better workload distribution among members based on current assignments.',
      'Missed Deadline': 'Consider messaging the professor for deadline reconsideration. An email template will be provided to help you communicate the situation.',
      'Unclear Task Assignment': 'Schedule a group meeting for clarity. An email notification will be sent to all members to coordinate the discussion.',
      'Conflict - Unresponsive': 'Send a respectful private message first. If there is no response after 48 hours, you may escalate to the professor.',
      'Conflict - Uneven Distribution': 'The system will analyze current task distribution and provide workload balancing recommendations.',
      'Conflict - Missed Deadline': 'Indicate if the delay was communicated. The system suggests an extension request or professor escalation if needed.',
      'Conflict - Different Quality Expectation': 'Clarify expected output standards, add revision notes to tasks, or request professor guidance if the issue remains unresolved.',
      'Conflict - Others': 'Describe the situation in detail. You can then choose to resolve within the group or escalate to the professor with an email template.'
    };

    if (disputeType === 'Conflict with Groupmate' && subType) {
      return actions[`Conflict - ${subType}`] || actions['Conflict - Others'];
    }

    return actions[disputeType] || 'Please provide details about the dispute for review.';
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner spinner-lg"></div>
        <span className="loading-text">Loading project...</span>
      </div>
    );
  }

  if (error) {
    return <div className="alert alert-error">{error}</div>;
  }

  return (
    <div className="project-details">
      <div className="page-header">
        <div className="flex items-center gap-2 mb-2">
          <Link to="/projects" className="back-link">&larr; Projects</Link>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">{data?.project?.project_name}</h1>
            <p className="page-subtitle">ID: {projectId}</p>
          </div>
          {isOwner && (
            <button className="btn btn-danger btn-sm" onClick={handleDeleteProject}>
              Delete Project
            </button>
          )}
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          Tasks ({data?.stats?.totalTasks || 0})
        </button>
        <button
          className={`tab ${activeTab === 'members' ? 'active' : ''}`}
          onClick={() => setActiveTab('members')}
        >
          Members ({data?.stats?.totalMembers || 0})
        </button>
        <button
          className={`tab ${activeTab === 'disputes' ? 'active' : ''}`}
          onClick={() => setActiveTab('disputes')}
        >
          Disputes ({disputes?.length || 0})
        </button>
        <button
          className={`tab ${activeTab === 'capacity' ? 'active' : ''}`}
          onClick={() => setActiveTab('capacity')}
        >
          Capacity
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="overview-section">
          <div className="grid grid-cols-4 mb-4">
            <div className="stat-card primary">
              <div className="stat-value">{data?.stats?.completionPercentage || 0}%</div>
              <div className="stat-label">Complete</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{data?.stats?.completedTasks || 0}</div>
              <div className="stat-label">Completed</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{data?.stats?.inProgressTasks || 0}</div>
              <div className="stat-label">In Progress</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{data?.stats?.pendingTasks || 0}</div>
              <div className="stat-label">Pending</div>
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-header">
              <h2 className="card-title">Contribution Overview</h2>
            </div>
            <div className="card-body">
              {data?.memberContributions?.length > 0 ? (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Role</th>
                        <th>Assigned</th>
                        <th>Completed</th>
                        <th>Progress</th>
                        <th>Contribution</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.memberContributions.map(member => (
                        <tr key={member.userdesc}>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="avatar avatar-sm">
                                {member.fname?.[0]}{member.lname?.[0]}
                              </div>
                              <span>{member.fullName}</span>
                            </div>
                          </td>
                          <td>
                            <span className={`badge badge-${member.role.toLowerCase()}`}>
                              {member.role}
                            </span>
                          </td>
                          <td>{member.assignedTasks}</td>
                          <td>{member.completedTasks}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="progress-bar" style={{ width: '80px' }}>
                                <div
                                  className="progress-bar-fill"
                                  style={{ width: `${member.completionPercentage}%` }}
                                ></div>
                              </div>
                              <span className="text-sm">{member.completionPercentage}%</span>
                            </div>
                          </td>
                          <td className="font-semibold text-success">
                            {member.contributionPercentage}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <p>No contribution data yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="tasks-section">
          <div className="mb-4">
            <button className="btn btn-primary" onClick={() => setShowCreateTask(true)}>
              + Create Task
            </button>
          </div>

          {data?.tasks?.length > 0 ? (
            <div className="tasks-list">
              {data.tasks.map(task => (
                <div key={task.task_id} className="task-card-wrapper">
                  <Link
                    to={`/tasks/${task.task_id}`}
                    className="task-card"
                  >
                    <div className="task-card-main">
                      <div className="task-card-header">
                        <h3 className="task-card-title">{task.task_description}</h3>
                        <span className={`badge badge-${task.status.toLowerCase().replace(' ', '-')}`}>
                          {task.status}
                        </span>
                      </div>
                      <div className="task-card-meta">
                        <span className="task-id">ID: {task.task_id}</span>
                        {task.task_date_deadline && (
                          <span className="task-deadline">
                            Due: {new Date(task.task_date_deadline).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="task-card-assignees">
                      <span className="text-sm text-gray">Assignees:</span>
                      <div className="assignee-avatars">
                        {task.assignees?.slice(0, 3).map(a => (
                          <div
                            key={a.userdesc}
                            className="avatar avatar-sm"
                            title={a.fullName}
                          >
                            {a.fullName?.split(' ').map(n => n[0]).join('')}
                          </div>
                        ))}
                        {task.assignees?.length > 3 && (
                          <div className="avatar avatar-sm">+{task.assignees.length - 3}</div>
                        )}
                        {(!task.assignees || task.assignees.length === 0) && (
                          <span className="text-sm text-gray">None</span>
                        )}
                      </div>
                    </div>
                  </Link>
                  {(isOwner || isAssignedToTask(task)) && (
                    <div className="task-card-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => openEditTask(task, e)}
                      >
                        {isOwner ? 'Edit' : 'Update Status'}
                      </button>
                      {isOwner && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={(e) => handleDeleteTask(task.task_id, e)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">✓</div>
                <h3 className="empty-state-title">No tasks yet</h3>
                <p className="empty-state-text">
                  {isOwner ? 'Create your first task to get started' : 'No tasks have been created yet'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'members' && (
        <div className="members-section">
          {isOwner && (
            <div className="mb-4">
              <button className="btn btn-primary" onClick={() => setShowAddMember(true)}>
                + Add Member
              </button>
            </div>
          )}

          {members.length > 0 ? (
            <div className="members-grid">
              {members.map(member => (
                <div key={member.userdesc} className="member-card">
                  <div className="member-info">
                    <div className="avatar avatar-lg">
                      {member.fname?.[0]}{member.lname?.[0]}
                    </div>
                    <div>
                      <h3 className="member-name">{member.fullName}</h3>
                      <p className="member-email">{member.email}</p>
                      <span className={`badge badge-${member.role.toLowerCase()}`}>
                        {member.role}
                      </span>
                    </div>
                  </div>
                  {isOwner && member.role !== 'Owner' && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleRemoveMember(member.userdesc)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="card">
              <div className="empty-state">
                <p>No members found</p>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'disputes' && (
        <div className="disputes-section">
          <div className="mb-4">
            <button className="btn btn-primary" onClick={openRaiseDispute}>
              + Raise Dispute
            </button>
          </div>

          {disputes.length > 0 ? (
            <div className="disputes-list">
              {disputes.map(dispute => (
                <div key={dispute.dispute_id} className="dispute-card">
                  <div className="dispute-header">
                    <div>
                      <h3 className="dispute-title">{dispute.dispute_type}</h3>
                      {dispute.sub_type && (
                        <span className="dispute-subtype">{dispute.sub_type}</span>
                      )}
                    </div>
                    <span className={`badge badge-${dispute.status.toLowerCase()}`}>
                      {dispute.status}
                    </span>
                  </div>

                  <p className="dispute-description">{dispute.description}</p>

                  {dispute.suggested_action && (
                    <div className="dispute-suggestion">
                      <strong>Suggested Action:</strong>
                      <p>{dispute.suggested_action}</p>
                    </div>
                  )}

                  {dispute.distribution_analysis && (
                    <div className="dispute-analysis">
                      <strong>Workload Analysis:</strong>
                      <pre className="analysis-data">
                        {JSON.stringify(JSON.parse(dispute.distribution_analysis), null, 2)}
                      </pre>
                    </div>
                  )}

                  <div className="dispute-meta">
                    <span className="text-sm text-gray">
                      Raised by: {dispute.raised_by_name}
                    </span>
                    <span className="text-sm text-gray">
                      {new Date(dispute.created_at).toLocaleDateString()}
                    </span>
                    {dispute.resolution_choice && dispute.resolution_choice !== 'Pending' && (
                      <span className="text-sm text-gray">
                        Action: {dispute.resolution_choice}
                      </span>
                    )}
                  </div>

                  {dispute.status === 'Ongoing' && (
                    <div className="dispute-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleResolveDispute(dispute.dispute_id)}
                      >
                        Mark as Resolved
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">⚖️</div>
                <h3 className="empty-state-title">No disputes raised</h3>
                <p className="empty-state-text">
                  Disputes help resolve collaboration issues and track concerns
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'capacity' && (
        <div className="capacity-section">
          <div className="mb-4">
            <button className="btn btn-primary" onClick={openSetCapacity}>
              {capacities.find(c => c.userdesc === user?.userdesc) ? 'Update' : 'Set'} My Capacity
            </button>
          </div>

          <p className="capacity-intro">
            Share your current responsibilities to help your team understand your availability and workload.
            This promotes open communication and realistic task distribution.
          </p>

          {capacities.length > 0 ? (
            <div className="capacity-list">
              {capacities.map(capacity => (
                <div key={capacity.userdesc} className="capacity-card">
                  <div className="capacity-header">
                    <h3 className="capacity-name">{capacity.fullName}</h3>
                    {capacity.availability_hours_per_week && (
                      <span className="capacity-hours">
                        {capacity.availability_hours_per_week}h/week available
                      </span>
                    )}
                  </div>

                  <div className="capacity-details">
                    {capacity.internship && (
                      <div className="capacity-item">
                        <strong>Internship:</strong>
                        <p>{capacity.internship}</p>
                      </div>
                    )}

                    {capacity.organizations && (
                      <div className="capacity-item">
                        <strong>Organizations:</strong>
                        <p>{capacity.organizations}</p>
                      </div>
                    )}

                    {capacity.other_school_work && (
                      <div className="capacity-item">
                        <strong>Other School Work:</strong>
                        <p>{capacity.other_school_work}</p>
                      </div>
                    )}

                    {capacity.personal_responsibilities && (
                      <div className="capacity-item">
                        <strong>Personal Responsibilities:</strong>
                        <p>{capacity.personal_responsibilities}</p>
                      </div>
                    )}

                    {capacity.notes && (
                      <div className="capacity-item">
                        <strong>Notes:</strong>
                        <p>{capacity.notes}</p>
                      </div>
                    )}

                    {!capacity.internship && !capacity.organizations &&
                     !capacity.other_school_work && !capacity.personal_responsibilities &&
                     !capacity.notes && (
                      <p className="text-sm text-gray">No additional details provided</p>
                    )}
                  </div>

                  <div className="capacity-meta">
                    <span className="text-sm text-gray">
                      Last updated: {new Date(capacity.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <h3 className="empty-state-title">No capacity information yet</h3>
                <p className="empty-state-text">
                  Team members can share their availability and current responsibilities here
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="modal-overlay" onClick={() => setShowAddMember(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Member</h2>
              <button className="modal-close" onClick={() => setShowAddMember(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddMember}>
              <div className="modal-body">
                {actionError && <div className="alert alert-error">{actionError}</div>}
                <div className="form-group">
                  <label className="form-label" htmlFor="memberEmail">Member Email</label>
                  <input
                    type="email"
                    id="memberEmail"
                    className="form-input"
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    placeholder="Enter member's email"
                    required
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddMember(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateTask && (
        <div className="modal-overlay" onClick={() => setShowCreateTask(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create Task</h2>
              <button className="modal-close" onClick={() => setShowCreateTask(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateTask}>
              <div className="modal-body">
                {actionError && <div className="alert alert-error">{actionError}</div>}
                <div className="form-group">
                  <label className="form-label" htmlFor="taskDescription">Task Description</label>
                  <input
                    type="text"
                    id="taskDescription"
                    className="form-input"
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    placeholder="Enter task description"
                    maxLength={100}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="taskDeadline">Deadline (optional)</label>
                  <input
                    type="date"
                    id="taskDeadline"
                    className="form-input"
                    value={newTask.deadline}
                    onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Assign to Members</label>
                  <div className="assignee-list">
                    {members.map(member => (
                      <label key={member.userdesc} className="assignee-checkbox">
                        <input
                          type="checkbox"
                          checked={newTask.assignees.includes(member.userdesc)}
                          onChange={() => toggleAssignee(member.userdesc)}
                        />
                        <span>{member.fullName}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateTask(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {showEditTask && editingTask && (
        <div className="modal-overlay" onClick={() => setShowEditTask(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingTask.canFullEdit ? 'Edit Task' : 'Update Task Status'}</h2>
              <button className="modal-close" onClick={() => setShowEditTask(false)}>&times;</button>
            </div>
            <form onSubmit={handleEditTask}>
              <div className="modal-body">
                {actionError && <div className="alert alert-error">{actionError}</div>}
                {editingTask.canFullEdit ? (
                  <>
                    <div className="form-group">
                      <label className="form-label" htmlFor="editTaskDescription">Task Description</label>
                      <input
                        type="text"
                        id="editTaskDescription"
                        className="form-input"
                        value={editingTask.description}
                        onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                        placeholder="Enter task description"
                        maxLength={100}
                        required
                        autoFocus
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="editTaskDeadline">Deadline</label>
                      <input
                        type="date"
                        id="editTaskDeadline"
                        className="form-input"
                        value={editingTask.deadline}
                        onChange={(e) => setEditingTask({ ...editingTask, deadline: e.target.value })}
                      />
                    </div>
                  </>
                ) : (
                  <div className="task-info-display">
                    <p><strong>Task:</strong> {editingTask.description}</p>
                    {editingTask.deadline && (
                      <p><strong>Deadline:</strong> {new Date(editingTask.deadline).toLocaleDateString()}</p>
                    )}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label" htmlFor="editTaskStatus">Status</label>
                  <select
                    id="editTaskStatus"
                    className="form-select"
                    value={editingTask.status}
                    onChange={(e) => setEditingTask({ ...editingTask, status: e.target.value })}
                    autoFocus={!editingTask.canFullEdit}
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditTask(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Raise Dispute Modal */}
      {showRaiseDispute && (
        <div className="modal-overlay" onClick={() => setShowRaiseDispute(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Raise Dispute - Step {disputeStep} of 3</h2>
              <button className="modal-close" onClick={() => setShowRaiseDispute(false)}>&times;</button>
            </div>
            <form onSubmit={disputeStep === 3 ? handleRaiseDispute : (e) => { e.preventDefault(); nextDisputeStep(); }}>
              <div className="modal-body">
                {actionError && <div className="alert alert-error">{actionError}</div>}

                {/* Step 1: Select Dispute Type */}
                {disputeStep === 1 && (
                  <div className="form-group">
                    <label className="form-label">What type of dispute are you raising?</label>
                    <div className="dispute-types">
                      {['Uneven Distribution', 'Missed Deadline', 'Unclear Task Assignment', 'Conflict with Groupmate'].map(type => (
                        <label key={type} className="dispute-type-option">
                          <input
                            type="radio"
                            name="dispute_type"
                            value={type}
                            checked={newDispute.dispute_type === type}
                            onChange={(e) => setNewDispute({ ...newDispute, dispute_type: e.target.value, sub_type: '' })}
                          />
                          <span>{type}</span>
                        </label>
                      ))}
                    </div>

                    {newDispute.dispute_type === 'Conflict with Groupmate' && (
                      <div className="form-group mt-3">
                        <label className="form-label">Reason for conflict:</label>
                        <div className="dispute-types">
                          {['Unresponsive', 'Uneven Distribution', 'Missed Deadline', 'Different Quality Expectation', 'Others'].map(sub => (
                            <label key={sub} className="dispute-type-option">
                              <input
                                type="radio"
                                name="sub_type"
                                value={sub}
                                checked={newDispute.sub_type === sub}
                                onChange={(e) => setNewDispute({ ...newDispute, sub_type: e.target.value })}
                              />
                              <span>{sub}</span>
                            </label>
                          ))}
                        </div>

                        <div className="form-group mt-3">
                          <label className="form-label">Related Member:</label>
                          <select
                            className="form-select"
                            value={newDispute.related_member_userdesc}
                            onChange={(e) => setNewDispute({ ...newDispute, related_member_userdesc: e.target.value })}
                          >
                            <option value="">Select member (optional)</option>
                            {members.filter(m => m.userdesc !== user?.userdesc).map(member => (
                              <option key={member.userdesc} value={member.userdesc}>
                                {member.fullName}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2: Description and Proof */}
                {disputeStep === 2 && (
                  <>
                    <div className="form-group">
                      <label className="form-label" htmlFor="disputeDescription">
                        Describe the situation *
                      </label>
                      <textarea
                        id="disputeDescription"
                        className="form-textarea"
                        value={newDispute.description}
                        onChange={(e) => setNewDispute({ ...newDispute, description: e.target.value })}
                        placeholder="Provide details about the dispute..."
                        rows="4"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="supportingContext">
                        Supporting Context / Proof (optional)
                      </label>
                      <textarea
                        id="supportingContext"
                        className="form-textarea"
                        value={newDispute.supporting_context}
                        onChange={(e) => setNewDispute({ ...newDispute, supporting_context: e.target.value })}
                        placeholder="Add any supporting information, messages, or evidence..."
                        rows="3"
                      />
                    </div>
                  </>
                )}

                {/* Step 3: System Suggestion and Resolution Choice */}
                {disputeStep === 3 && (
                  <div>
                    <div className="dispute-summary">
                      <h3>Review Your Dispute</h3>
                      <p><strong>Type:</strong> {newDispute.dispute_type} {newDispute.sub_type && `- ${newDispute.sub_type}`}</p>
                      <p><strong>Description:</strong> {newDispute.description}</p>
                    </div>

                    <div className="system-suggestion-box">
                      <div className="suggestion-header">
                        <span className="suggestion-icon">💡</span>
                        <strong>System Recommendation</strong>
                      </div>
                      <p className="suggestion-text">
                        {getSuggestedAction(newDispute.dispute_type, newDispute.sub_type)}
                      </p>
                    </div>

                    <div className="form-group">
                      <label className="form-label">How would you like to proceed?</label>
                      <div className="resolution-options">
                        <label className="resolution-option">
                          <input
                            type="radio"
                            name="resolution_choice"
                            value="Resolve within group"
                            checked={newDispute.resolution_choice === 'Resolve within group'}
                            onChange={(e) => setNewDispute({ ...newDispute, resolution_choice: e.target.value })}
                          />
                          <div>
                            <strong>Resolve within group</strong>
                            <p className="text-sm text-gray">Address this with group members first</p>
                          </div>
                        </label>

                        <label className="resolution-option">
                          <input
                            type="radio"
                            name="resolution_choice"
                            value="Escalate to professor"
                            checked={newDispute.resolution_choice === 'Escalate to professor'}
                            onChange={(e) => setNewDispute({ ...newDispute, resolution_choice: e.target.value })}
                          />
                          <div>
                            <strong>Escalate to professor</strong>
                            <p className="text-sm text-gray">Request professor intervention</p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                {disputeStep > 1 && (
                  <button type="button" className="btn btn-secondary" onClick={prevDisputeStep}>
                    Back
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={() => setShowRaiseDispute(false)}>
                  Cancel
                </button>
                {disputeStep < 3 ? (
                  <button type="submit" className="btn btn-primary">
                    Next
                  </button>
                ) : (
                  <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                    {actionLoading ? 'Submitting...' : 'Raise Dispute'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set Capacity Modal */}
      {showSetCapacity && (
        <div className="modal-overlay" onClick={() => setShowSetCapacity(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Set Your Capacity & Responsibilities</h2>
              <button className="modal-close" onClick={() => setShowSetCapacity(false)}>&times;</button>
            </div>
            <form onSubmit={handleSaveCapacity}>
              <div className="modal-body">
                {actionError && <div className="alert alert-error">{actionError}</div>}

                <p className="capacity-modal-intro">
                  Help your team understand your availability by sharing your current commitments.
                  This information is visible to all project members.
                </p>

                <div className="form-group">
                  <label className="form-label" htmlFor="internship">
                    Internship / Part-time Job
                  </label>
                  <textarea
                    id="internship"
                    className="form-textarea"
                    value={capacityForm.internship}
                    onChange={(e) => setCapacityForm({ ...capacityForm, internship: e.target.value })}
                    placeholder="e.g., Software Engineering Intern at XYZ Corp (20hrs/week)"
                    rows="2"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="organizations">
                    Organizations & Affiliations
                  </label>
                  <textarea
                    id="organizations"
                    className="form-textarea"
                    value={capacityForm.organizations}
                    onChange={(e) => setCapacityForm({ ...capacityForm, organizations: e.target.value })}
                    placeholder="e.g., Student Council Secretary, Computer Society Member"
                    rows="2"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="otherSchoolWork">
                    Other School Responsibilities
                  </label>
                  <textarea
                    id="otherSchoolWork"
                    className="form-textarea"
                    value={capacityForm.other_school_work}
                    onChange={(e) => setCapacityForm({ ...capacityForm, other_school_work: e.target.value })}
                    placeholder="e.g., Taking 6 other courses, TA for Database class"
                    rows="2"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="personalResponsibilities">
                    Personal Responsibilities
                  </label>
                  <textarea
                    id="personalResponsibilities"
                    className="form-textarea"
                    value={capacityForm.personal_responsibilities}
                    onChange={(e) => setCapacityForm({ ...capacityForm, personal_responsibilities: e.target.value })}
                    placeholder="e.g., Family commitments, health considerations (optional)"
                    rows="2"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="availabilityHours">
                    Estimated Hours Available Per Week for This Project
                  </label>
                  <input
                    type="number"
                    id="availabilityHours"
                    className="form-input"
                    value={capacityForm.availability_hours_per_week}
                    onChange={(e) => setCapacityForm({ ...capacityForm, availability_hours_per_week: e.target.value })}
                    placeholder="e.g., 10"
                    min="0"
                    max="168"
                  />
                  <small className="form-help">This helps the team plan realistic task assignments</small>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="notes">
                    Additional Notes
                  </label>
                  <textarea
                    id="notes"
                    className="form-textarea"
                    value={capacityForm.notes}
                    onChange={(e) => setCapacityForm({ ...capacityForm, notes: e.target.value })}
                    placeholder="Any other information about your schedule or availability"
                    rows="2"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSetCapacity(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : 'Save Capacity Information'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .back-link {
          font-size: 0.875rem;
          color: var(--gray-500);
        }

        .tabs {
          display: flex;
          gap: 0.25rem;
          border-bottom: 1px solid var(--gray-200);
          margin-bottom: 1.5rem;
        }

        .tab {
          padding: 0.75rem 1rem;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--gray-500);
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .tab:hover {
          color: var(--gray-700);
        }

        .tab.active {
          color: var(--primary-dark);
          border-bottom-color: var(--primary);
        }

        .tasks-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .task-card-wrapper {
          background-color: var(--white);
          border-radius: var(--radius);
          box-shadow: var(--shadow-sm);
          overflow: hidden;
          transition: all 0.15s ease;
        }

        .task-card-wrapper:hover {
          box-shadow: var(--shadow);
        }

        .task-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          text-decoration: none;
          color: inherit;
        }

        .task-card:hover {
          text-decoration: none;
        }

        .task-card-actions {
          display: flex;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          background-color: var(--gray-50);
          border-top: 1px solid var(--gray-100);
        }

        .task-card-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--gray-800);
          margin-bottom: 0.25rem;
        }

        .task-card-meta {
          display: flex;
          gap: 1rem;
          font-size: 0.8125rem;
          color: var(--gray-500);
        }

        .task-card-assignees {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .assignee-avatars {
          display: flex;
          margin-left: -0.25rem;
        }

        .assignee-avatars .avatar {
          margin-left: -0.25rem;
          border: 2px solid var(--white);
        }

        .members-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1rem;
        }

        .member-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          background-color: var(--white);
          border-radius: var(--radius);
          box-shadow: var(--shadow-sm);
        }

        .member-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .member-name {
          font-weight: 600;
          color: var(--gray-800);
          margin-bottom: 0.125rem;
        }

        .member-email {
          font-size: 0.8125rem;
          color: var(--gray-500);
          margin-bottom: 0.25rem;
        }

        .assignee-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-height: 200px;
          overflow-y: auto;
        }

        .assignee-checkbox {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem;
          background-color: var(--gray-50);
          border-radius: var(--radius);
          cursor: pointer;
        }

        .assignee-checkbox:hover {
          background-color: var(--gray-100);
        }

        .task-info-display {
          background-color: var(--gray-50);
          padding: 1rem;
          border-radius: var(--radius);
          margin-bottom: 1rem;
        }

        .task-info-display p {
          margin: 0;
          margin-bottom: 0.5rem;
          color: var(--gray-700);
        }

        .task-info-display p:last-child {
          margin-bottom: 0;
        }

        .modal-lg {
          max-width: 600px;
        }

        .disputes-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .dispute-card {
          background-color: var(--white);
          border-radius: var(--radius);
          padding: 1.25rem;
          box-shadow: var(--shadow-sm);
        }

        .dispute-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 0.75rem;
        }

        .dispute-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--gray-800);
          margin-bottom: 0.25rem;
        }

        .dispute-subtype {
          font-size: 0.8125rem;
          color: var(--gray-500);
        }

        .dispute-description {
          margin-bottom: 0.75rem;
          color: var(--gray-700);
        }

        .dispute-suggestion {
          background-color: var(--primary-bg);
          padding: 0.75rem;
          border-radius: var(--radius);
          margin-bottom: 0.75rem;
        }

        .dispute-suggestion strong {
          display: block;
          margin-bottom: 0.25rem;
          color: var(--primary-dark);
        }

        .dispute-suggestion p {
          margin: 0;
          font-size: 0.875rem;
          color: var(--gray-700);
        }

        .dispute-analysis {
          background-color: var(--gray-50);
          padding: 0.75rem;
          border-radius: var(--radius);
          margin-bottom: 0.75rem;
        }

        .dispute-analysis strong {
          display: block;
          margin-bottom: 0.5rem;
          color: var(--gray-800);
        }

        .analysis-data {
          font-size: 0.75rem;
          color: var(--gray-600);
          margin: 0;
          overflow-x: auto;
          white-space: pre-wrap;
        }

        .dispute-meta {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          margin-bottom: 0.75rem;
        }

        .dispute-actions {
          display: flex;
          gap: 0.5rem;
          justify-content: flex-end;
        }

        .dispute-types {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .dispute-type-option {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          background-color: var(--gray-50);
          border: 2px solid var(--gray-200);
          border-radius: var(--radius);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .dispute-type-option:hover {
          background-color: var(--gray-100);
        }

        .dispute-type-option input[type="radio"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .dispute-type-option input[type="radio"]:checked + span {
          font-weight: 600;
          color: var(--primary-dark);
        }

        .dispute-summary {
          background-color: var(--gray-50);
          padding: 1rem;
          border-radius: var(--radius);
          margin-bottom: 1rem;
        }

        .dispute-summary h3 {
          font-size: 1rem;
          margin-bottom: 0.75rem;
          color: var(--gray-800);
        }

        .dispute-summary p {
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
          color: var(--gray-700);
        }

        .dispute-summary p:last-child {
          margin-bottom: 0;
        }

        .system-suggestion-box {
          background: linear-gradient(135deg, #e0f2fe 0%, #e0e7ff 100%);
          border: 2px solid var(--primary);
          border-radius: var(--radius);
          padding: 1.25rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .suggestion-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }

        .suggestion-icon {
          font-size: 1.5rem;
        }

        .suggestion-header strong {
          font-size: 1rem;
          color: var(--primary-dark);
          font-weight: 600;
        }

        .suggestion-text {
          margin: 0;
          color: var(--gray-800);
          font-size: 0.9375rem;
          line-height: 1.6;
        }

        .resolution-options {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .resolution-option {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 1rem;
          background-color: var(--gray-50);
          border: 2px solid var(--gray-200);
          border-radius: var(--radius);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .resolution-option:hover {
          background-color: var(--gray-100);
        }

        .resolution-option input[type="radio"] {
          width: 18px;
          height: 18px;
          margin-top: 0.25rem;
          cursor: pointer;
        }

        .badge-ongoing {
          background-color: var(--warning-light);
          color: #b45309;
        }

        .badge-resolved {
          background-color: var(--success-light);
          color: var(--primary-dark);
        }

        .capacity-intro {
          margin-bottom: 1.5rem;
          padding: 1rem;
          background-color: var(--primary-bg);
          border-radius: var(--radius);
          color: var(--gray-700);
          font-size: 0.875rem;
        }

        .capacity-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .capacity-card {
          background-color: var(--white);
          border-radius: var(--radius);
          padding: 1.25rem;
          box-shadow: var(--shadow-sm);
        }

        .capacity-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .capacity-name {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--gray-800);
          margin: 0;
        }

        .capacity-hours {
          background-color: var(--primary-bg);
          color: var(--primary-dark);
          padding: 0.25rem 0.75rem;
          border-radius: 999px;
          font-size: 0.8125rem;
          font-weight: 500;
        }

        .capacity-details {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .capacity-item strong {
          display: block;
          font-size: 0.8125rem;
          color: var(--gray-600);
          margin-bottom: 0.25rem;
          text-transform: uppercase;
          letter-spacing: 0.025em;
        }

        .capacity-item p {
          margin: 0;
          color: var(--gray-700);
          font-size: 0.9375rem;
          line-height: 1.5;
        }

        .capacity-meta {
          margin-top: 1rem;
          padding-top: 0.75rem;
          border-top: 1px solid var(--gray-200);
        }

        .capacity-modal-intro {
          margin-bottom: 1.5rem;
          padding: 0.875rem;
          background-color: var(--primary-bg);
          border-radius: var(--radius);
          color: var(--gray-700);
          font-size: 0.875rem;
          line-height: 1.5;
        }

        .form-help {
          display: block;
          margin-top: 0.375rem;
          font-size: 0.8125rem;
          color: var(--gray-500);
        }

        @media (max-width: 640px) {
          .task-card {
            flex-direction: column;
            align-items: stretch;
            gap: 0.75rem;
          }

          .task-card-actions {
            justify-content: flex-end;
          }

          .tabs {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }

          .tab {
            white-space: nowrap;
          }

          .modal-lg {
            max-width: 100%;
          }

          .dispute-header {
            flex-direction: column;
            gap: 0.5rem;
          }

          .dispute-meta {
            flex-direction: column;
            gap: 0.25rem;
          }
        }
      `}</style>
    </div>
  );
}

export default ProjectDetails;
