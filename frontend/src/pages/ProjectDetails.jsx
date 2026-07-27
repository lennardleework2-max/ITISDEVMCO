import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { dashboard, members as membersApi, tasks as tasksApi, projects as projectsApi, disputes as disputesApi, capacity as capacityApi } from '../utils/api';
import { exportPDF } from '../utils/exportReport';
import { useAuth } from '../context/AuthContext';

const CAPACITY_ROLES = ['Internship', 'Part-time', 'Full-time'];

const ORGANIZATION_OPTIONS = [
  'LSCS - La Salle Computer Society',
  'AISEC',
  'EngliCOM',
  'LSDC - La Salle Dance Club',
  'The Lasallian',
  'Green Giant FM',
  'Ang Pahayagang Plaridel',
  'Behavioral Science Society',
  'Malate Literary Folio',
  'BLAZE',
  'CATCH',
  'DLSU Pusa',
  'LAMB Lasallian Ambassadors'
];

function parseInternship(value = '') {
  const match = value.match(/^(.*?)\s+[—–-]\s+(Internship|Part-time|Full-time)$/i);
  if (!match) return { company: value, role: '' };

  const role = CAPACITY_ROLES.find(option => option.toLowerCase() === match[2].toLowerCase()) || '';
  return { company: match[1].trim(), role };
}

function parseOrganizations(value = '') {
  const savedOrganizations = value.split(/\s*(?:,|\n|;)\s*/).filter(Boolean);
  const selected = savedOrganizations.filter(org => ORGANIZATION_OPTIONS.includes(org));
  const other = savedOrganizations.filter(org => !ORGANIZATION_OPTIONS.includes(org)).join(', ');
  return { selected, other };
}

function ProjectDetails() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [members, setMembers] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [capacities, setCapacities] = useState([]);
  const [roleSuggestions, setRoleSuggestions] = useState([]);
  const [outliers, setOutliers] = useState([]);
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
  const [newTask, setNewTask] = useState({ description: '', deadline: '', difficulty: 5, task_type: 'General', assignees: [] });
  const [taskSuggestions, setTaskSuggestions] = useState([]);
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
  const [complexityAnalysis, setComplexityAnalysis] = useState(null);

  // Capacity tab — which member is selected in the master-detail panel
  const [selectedCapacityMember, setSelectedCapacityMember] = useState(null);

  // Capacity modal state
  const [capacityForm, setCapacityForm] = useState({
    company: '',
    capacity_role: '',
    selected_organizations: [],
    show_other_organization: false,
    other_organization: '',
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
      const [dashboardData, membersData, disputesData, capacityData, suggestionsData, outliersData] = await Promise.all([
        dashboard.getProject(projectId),
        membersApi.getAll(projectId),
        disputesApi.getByProject(projectId),
        capacityApi.getByProject(projectId),
        membersApi.getSuggestions(projectId),
        dashboard.getOutliers(projectId)
      ]);
      setData(dashboardData);
      setMembers(membersData);
      setDisputes(disputesData);
      setCapacities(capacityData);
      setRoleSuggestions(suggestionsData);
      setOutliers(outliersData?.outliers || []);
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
        difficulty: newTask.difficulty || 5,
        task_type: newTask.task_type || 'General',
        assignees: newTask.assignees
      });
      setShowCreateTask(false);
      setNewTask({ description: '', deadline: '', difficulty: 5, task_type: 'General', assignees: [] });
      setTaskSuggestions([]);
      loadData();
    } catch (err) {
      setActionError(err.message || 'Failed to create task');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleTaskTypeChange(taskType) {
    setNewTask({ ...newTask, task_type: taskType });

    // Fetch member suggestions based on task type
    if (taskType && taskType !== 'General') {
      try {
        const suggestions = await membersApi.getTaskSuggestions(projectId, taskType);
        setTaskSuggestions(suggestions);
      } catch (err) {
        console.error('Failed to fetch task suggestions:', err);
        setTaskSuggestions([]);
      }
    } else {
      setTaskSuggestions([]);
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
      difficulty: task.difficulty || 5,
      task_type: task.task_type || 'General',
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
        difficulty: editingTask.difficulty || 5,
        task_type: editingTask.task_type || 'General',
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

  async function nextDisputeStep() {
    if (disputeStep === 1 && !newDispute.dispute_type) {
      setActionError('Please select a dispute type');
      return;
    }
    if (disputeStep === 2 && !newDispute.description.trim()) {
      setActionError('Please provide a description');
      return;
    }
    setActionError('');

    // If moving to Step 3 and dispute is about uneven distribution, fetch complexity analysis
    if (disputeStep === 2 && (newDispute.dispute_type === 'Uneven Distribution' || newDispute.sub_type === 'Uneven Distribution')) {
      try {
        setActionLoading(true);
        const analysis = await disputesApi.getAnalysis(projectId);
        setComplexityAnalysis(analysis);
      } catch (err) {
        console.error('Failed to fetch complexity analysis:', err);
        setComplexityAnalysis(null);
      } finally {
        setActionLoading(false);
      }
    }

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
      const internship = parseInternship(existingCapacity.internship);
      const organizations = parseOrganizations(existingCapacity.organizations);
      setCapacityForm({
        company: internship.company,
        capacity_role: internship.role,
        selected_organizations: organizations.selected,
        show_other_organization: Boolean(organizations.other),
        other_organization: organizations.other,
        other_school_work: existingCapacity.other_school_work || '',
        personal_responsibilities: existingCapacity.personal_responsibilities || '',
        availability_hours_per_week: existingCapacity.availability_hours_per_week || '',
        notes: existingCapacity.notes || ''
      });
    } else {
      setCapacityForm({
        company: '',
        capacity_role: '',
        selected_organizations: [],
        show_other_organization: false,
        other_organization: '',
        other_school_work: '',
        personal_responsibilities: '',
        availability_hours_per_week: '',
        notes: ''
      });
    }
    setActionError('');
    setShowSetCapacity(true);
  }

  function toggleOrganization(organization) {
    setCapacityForm(current => ({
      ...current,
      selected_organizations: current.selected_organizations.includes(organization)
        ? current.selected_organizations.filter(item => item !== organization)
        : [...current.selected_organizations, organization]
    }));
  }

  async function handleSaveCapacity(e) {
    e.preventDefault();
    setActionLoading(true);
    setActionError('');

    try {
      const company = capacityForm.company.trim();
      const otherOrganizations = capacityForm.other_organization
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
      const payload = {
        internship: [company, capacityForm.capacity_role].filter(Boolean).join(' — '),
        organizations: [...capacityForm.selected_organizations, ...otherOrganizations].join(', '),
        other_school_work: capacityForm.other_school_work,
        personal_responsibilities: capacityForm.personal_responsibilities,
        availability_hours_per_week: capacityForm.availability_hours_per_week,
        notes: capacityForm.notes
      };
      await capacityApi.save(projectId, payload);
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
      'Missed Deadline': 'Consider messaging the professor for deadline reconsideration.',
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

  function formatWorkloadAnalysis(analysisJson) {
    try {
      const analysis = JSON.parse(analysisJson);
      return {
        totalComplexity: analysis.totalComplexity || 0,
        fairComplexity: analysis.fairComplexity || 0,
        memberCount: analysis.memberCount || 0,
        suggestion: analysis.suggestion || ''
      };
    } catch (e) {
      return null;
    }
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

          {/* Export bar */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.8125rem', padding: '0.375rem 0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
              onClick={() => exportPDF({
                project: data?.project,
                stats: data?.stats,
                memberContributions: data?.memberContributions,
                tasks: data?.tasks,
                outliers,
              })}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              Export PDF
            </button>
          </div>

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

          {/* Outliers Section */}
          {outliers.length > 0 && (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 className="card-title">⚠️ Outliers & Attention Needed</h2>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--gray-500)', marginTop: '0.2rem' }}>
                    Sorted by urgency — act from top to bottom. Click any row to take action.
                  </p>
                </div>
                <span className="badge" style={{ backgroundColor: 'var(--danger)', color: 'white', flexShrink: 0 }}>
                  {outliers.length} issue{outliers.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Fixed-height scrollable table — never blows up the page */}
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="table" style={{ margin: 0 }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr>
                      <th style={{ width: '4rem' }}>#</th>
                      <th style={{ width: '10rem' }}>Type</th>
                      <th style={{ width: '10rem' }}>Person</th>
                      <th>Task / Issue</th>
                      <th style={{ width: '7.5rem' }}>Deadline</th>
                      <th style={{ width: '7rem' }}>Status</th>
                      <th style={{ width: '1.5rem' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {outliers.map((outlier, index) => {
                      const severityColors = {
                        high:   { border: '#dc2626', text: '#991b1b', badgeBg: '#dc2626', rowBg: '#fff5f5' },
                        medium: { border: '#d97706', text: '#92400e', badgeBg: '#d97706', rowBg: '#fffbeb' },
                        low:    { border: '#3b82f6', text: '#1e40af', badgeBg: '#3b82f6', rowBg: '#eff6ff' }
                      };
                      const typeIcons  = { overdue_task: '⏰', low_performance: '📉', inactive_member: '😴', overloaded: '🔥' };
                      const typeLabels = { overdue_task: 'Overdue Task', low_performance: 'Low Performance', inactive_member: 'Inactive Member', overloaded: 'Overloaded' };

                      const colors  = severityColors[outlier.severity] || severityColors.low;
                      const isFirst = index === 0;

                      const issueText =
                        outlier.task?.description ||
                        (outlier.type === 'low_performance'  ? `${outlier.completionRate?.toFixed(0)}% completion vs ${outlier.teamAverage?.toFixed(0)}% team avg` :
                         outlier.type === 'inactive_member'  ? `${outlier.assignedTasks} tasks assigned, 0 completed` :
                         outlier.type === 'overloaded'       ? `${outlier.complexity} complexity pts vs ${outlier.teamAverage?.toFixed(0)} avg` : '—');

                      const handleOutlierClick = () => {
                        if (outlier.type === 'overdue_task' && outlier.task) {
                          navigate(`/tasks/${outlier.task.task_id}`);
                        } else {
                          setActiveTab('members');
                        }
                      };

                      return (
                        <tr
                          key={index}
                          onClick={handleOutlierClick}
                          style={{
                            cursor: 'pointer',
                            backgroundColor: isFirst ? colors.rowBg : undefined,
                          }}
                          onMouseEnter={e => { if (!isFirst) e.currentTarget.style.backgroundColor = 'var(--gray-50)'; }}
                          onMouseLeave={e => { if (!isFirst) e.currentTarget.style.backgroundColor = ''; }}
                        >
                          {/* # with colored left border */}
                          <td style={{ borderLeft: `3px solid ${colors.border}`, paddingLeft: '0.875rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                              <span style={{
                                width: '1.5rem', height: '1.5rem', borderRadius: '50%',
                                backgroundColor: isFirst ? colors.border : 'var(--gray-200)',
                                color: isFirst ? 'white' : 'var(--gray-500)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.75rem', fontWeight: 700,
                              }}>
                                {index + 1}
                              </span>
                              {isFirst && (
                                <span style={{ fontSize: '0.5rem', fontWeight: 700, color: colors.border, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.1, textAlign: 'center' }}>
                                  Do First
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Type */}
                          <td>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--gray-600)' }}>
                              {typeIcons[outlier.type]} {typeLabels[outlier.type]}
                            </span>
                          </td>

                          {/* Person */}
                          <td style={{ fontWeight: 600, color: 'var(--gray-800)', fontSize: '0.875rem' }}>
                            {outlier.member?.name || '—'}
                          </td>

                          {/* Task / Issue */}
                          <td style={{ color: 'var(--gray-600)', fontSize: '0.875rem', maxWidth: '200px' }}>
                            <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {issueText}
                            </span>
                          </td>

                          {/* Deadline */}
                          <td style={{ fontSize: '0.8125rem', color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>
                            {outlier.task?.deadline
                              ? new Date(outlier.task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                              : '—'}
                          </td>

                          {/* Status badge */}
                          <td>
                            <span style={{
                              display: 'inline-block',
                              fontSize: '0.6875rem', padding: '0.15rem 0.5rem', borderRadius: '999px',
                              backgroundColor: colors.badgeBg, color: 'white', fontWeight: 600, whiteSpace: 'nowrap',
                            }}>
                              {outlier.type === 'overdue_task'
                                ? `${outlier.daysPastDue}d overdue`
                                : outlier.severity.toUpperCase()}
                            </span>
                          </td>

                          {/* Arrow */}
                          <td style={{ color: 'var(--gray-400)', textAlign: 'right', paddingRight: '1rem' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="9,18 15,12 9,6" />
                            </svg>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
                        <span className="task-type">Type: {task.task_type || 'General'}</span>
                        <span className="task-difficulty">Difficulty: {task.difficulty || 5}/10</span>
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
              {members.map(member => {
                const suggestion = roleSuggestions.find(s => s.userdesc === member.userdesc);
                return (
                  <div key={member.userdesc} className="member-card">
                    <div className="member-info">
                      <div className="avatar avatar-lg">
                        {member.fname?.[0]}{member.lname?.[0]}
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3 className="member-name">{member.fullName}</h3>
                        <p className="member-email">{member.email}</p>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                          <span className={`badge badge-${member.role.toLowerCase()}`}>
                            {member.role}
                          </span>
                          {suggestion && (
                            <span className="badge badge-suggestion" title={suggestion.reasoning}>
                              💡 Suggested: {suggestion.suggestedRole} ({suggestion.confidence}%)
                            </span>
                          )}
                        </div>
                        {suggestion && suggestion.metrics && (
                          <div className="member-metrics">
                            <small>
                              📊 {suggestion.metrics.completedTasks}/{suggestion.metrics.totalTasks} tasks ({suggestion.metrics.completionRate}%) •
                              Avg complexity: {suggestion.metrics.avgComplexity}/10
                            </small>
                          </div>
                        )}
                        {suggestion && (
                          <p className="member-suggestion-reason">{suggestion.reasoning}</p>
                        )}
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
                );
              })}
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

                  {dispute.distribution_analysis && (() => {
                    const analysis = formatWorkloadAnalysis(dispute.distribution_analysis);
                    return analysis && (
                      <div className="dispute-analysis">
                        <strong>Workload Analysis:</strong>
                        <div className="analysis-summary">
                          <div className="analysis-stat">
                            <span className="stat-label">Total Complexity:</span>
                            <span className="stat-value">{analysis.totalComplexity} points</span>
                          </div>
                          <div className="analysis-stat">
                            <span className="stat-label">Suggested Complexity per Member:</span>
                            <span className="stat-value">{analysis.fairComplexity} points</span>
                          </div>
                          <div className="analysis-stat">
                            <span className="stat-label">Team Members:</span>
                            <span className="stat-value">{analysis.memberCount}</span>
                          </div>
                        </div>
                        {analysis.suggestion && (
                          <p className="analysis-suggestion">{analysis.suggestion}</p>
                        )}
                      </div>
                    );
                  })()}

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

      {activeTab === 'capacity' && (() => {
        // Build a unified list: all members, each with their capacity data (or null)
        const allMembersWithCapacity = members.map(m => ({
          ...m,
          capacity: capacities.find(c => c.userdesc === m.userdesc) || null
        }));

        // Default selection: current user, else first member
        const effectiveSelected = selectedCapacityMember
          || user?.userdesc
          || allMembersWithCapacity[0]?.userdesc;

        const selectedMember = allMembersWithCapacity.find(m => m.userdesc === effectiveSelected)
          || allMembersWithCapacity[0];

        const cap = selectedMember?.capacity;
        const isMe = selectedMember?.userdesc === user?.userdesc;

        const hoursColor = (h) => {
          if (!h) return 'var(--gray-300)';
          if (h >= 15) return 'var(--primary)';
          if (h >= 8)  return '#f59e0b';
          return '#ef4444';
        };

        const fields = [
          { icon: '💼', label: 'Internship / Part-time Job',       key: 'internship' },
          { icon: '🏛️', label: 'Organizations & Affiliations',      key: 'organizations' },
          { icon: '📚', label: 'Other School Responsibilities',     key: 'other_school_work' },
          { icon: '🏠', label: 'Personal Responsibilities',         key: 'personal_responsibilities' },
          { icon: '📝', label: 'Additional Notes',                  key: 'notes' },
        ];

        return (
          <div className="card" style={{ overflow: 'hidden' }}>
            {/* Header */}
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 className="card-title">Team Capacity</h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--gray-500)', marginTop: '0.2rem' }}>
                  Select a member to view their availability and commitments
                </p>
              </div>
              <button className="btn btn-primary" style={{ flexShrink: 0 }} onClick={openSetCapacity}>
                {capacities.find(c => c.userdesc === user?.userdesc) ? 'Update My Capacity' : 'Set My Capacity'}
              </button>
            </div>

            {/* Master-detail body */}
            <div style={{ display: 'flex', minHeight: '420px' }}>

              {/* LEFT — member list */}
              <div style={{
                width: '220px', flexShrink: 0,
                borderRight: '1px solid var(--gray-100)',
                overflowY: 'auto',
              }}>
                {allMembersWithCapacity.length === 0 ? (
                  <p style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--gray-500)' }}>No members yet</p>
                ) : allMembersWithCapacity.map(m => {
                  const isSelected = m.userdesc === effectiveSelected;
                  const hrs = m.capacity?.availability_hours_per_week;
                  return (
                    <button
                      key={m.userdesc}
                      onClick={() => setSelectedCapacityMember(m.userdesc)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.625rem',
                        width: '100%', padding: '0.75rem 1rem', textAlign: 'left',
                        border: 'none', borderBottom: '1px solid var(--gray-100)',
                        background: isSelected ? 'var(--primary-bg)' : 'transparent',
                        borderLeft: isSelected ? '3px solid var(--primary)' : '3px solid transparent',
                        cursor: 'pointer', transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--gray-50)'; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: '2rem', height: '2rem', borderRadius: '50%', flexShrink: 0,
                        background: isSelected ? 'var(--primary)' : 'var(--gray-200)',
                        color: isSelected ? 'white' : 'var(--gray-600)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', fontWeight: 700,
                      }}>
                        {m.fname?.[0]}{m.lname?.[0]}
                      </div>

                      {/* Name + hours */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.fullName}
                          {m.userdesc === user?.userdesc && (
                            <span style={{ marginLeft: '0.3rem', fontSize: '0.6875rem', color: 'var(--primary-dark)', fontWeight: 500 }}>(you)</span>
                          )}
                        </div>
                        {hrs ? (
                          <div style={{ marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'var(--gray-200)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.min((hrs / 40) * 100, 100)}%`, background: hoursColor(hrs), borderRadius: '2px' }} />
                            </div>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--gray-500)', flexShrink: 0 }}>{hrs}h</span>
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.6875rem', color: 'var(--gray-400)', marginTop: '0.1rem' }}>Not set</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* RIGHT — detail panel */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                {!selectedMember ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--gray-400)' }}>
                    Select a member on the left
                  </div>
                ) : (
                  <>
                    {/* Detail header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                        <div style={{
                          width: '3rem', height: '3rem', borderRadius: '50%',
                          background: 'var(--primary)', color: 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1.125rem', fontWeight: 700, flexShrink: 0,
                        }}>
                          {selectedMember.fname?.[0]}{selectedMember.lname?.[0]}
                        </div>
                        <div>
                          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--gray-900)', margin: 0 }}>
                            {selectedMember.fullName}
                            {isMe && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--primary-dark)', fontWeight: 500 }}>(you)</span>}
                          </h3>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>
                            {selectedMember.role}
                            {cap?.updated_at && ` · Updated ${new Date(cap.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                          </span>
                        </div>
                      </div>
                      {isMe && (
                        <button className="btn btn-secondary" style={{ fontSize: '0.8125rem', padding: '0.375rem 0.875rem' }} onClick={openSetCapacity}>
                          Edit
                        </button>
                      )}
                    </div>

                    {!cap ? (
                      <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--gray-400)' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</div>
                        <p style={{ fontWeight: 500, color: 'var(--gray-600)', marginBottom: '0.375rem' }}>
                          {isMe ? "You haven't set your capacity yet" : `${selectedMember.fullName} hasn't set their capacity yet`}
                        </p>
                        {isMe && (
                          <button className="btn btn-primary" style={{ marginTop: '0.75rem' }} onClick={openSetCapacity}>
                            Set My Capacity
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Hours/week bar */}
                        {cap.availability_hours_per_week && (
                          <div style={{
                            padding: '0.875rem 1rem', borderRadius: 'var(--radius)',
                            background: 'var(--primary-bg)', border: '1px solid var(--primary-light)',
                            marginBottom: '1.25rem',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--primary-dark)' }}>⏰ Hours available per week</span>
                              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary-dark)' }}>
                                {cap.availability_hours_per_week}h
                              </span>
                            </div>
                            <div style={{ height: '8px', borderRadius: '4px', background: 'var(--primary-light)', overflow: 'hidden' }}>
                              <div style={{
                                height: '100%',
                                width: `${Math.min((cap.availability_hours_per_week / 40) * 100, 100)}%`,
                                background: hoursColor(cap.availability_hours_per_week),
                                borderRadius: '4px', transition: 'width 0.3s ease',
                              }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--gray-400)', marginTop: '0.25rem' }}>
                              <span>0h</span><span>20h</span><span>40h</span>
                            </div>
                          </div>
                        )}

                        {/* Fields */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                          {fields.map(({ icon, label, key }) => (
                            cap[key] ? (
                              <div key={key} style={{ display: 'flex', gap: '0.75rem' }}>
                                <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: '0.05rem' }}>{icon}</span>
                                <div>
                                  <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                                    {label}
                                  </p>
                                  <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--gray-700)', lineHeight: 1.55 }}>
                                    {cap[key]}
                                  </p>
                                </div>
                              </div>
                            ) : null
                          ))}

                          {fields.every(f => !cap[f.key]) && !cap.availability_hours_per_week && (
                            <p style={{ color: 'var(--gray-400)', fontSize: '0.875rem' }}>No details provided</p>
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

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
                  <label className="form-label" htmlFor="taskDifficulty">Difficulty (1-10)</label>
                  <input
                    type="number"
                    id="taskDifficulty"
                    className="form-input"
                    value={newTask.difficulty}
                    onChange={(e) => setNewTask({ ...newTask, difficulty: parseInt(e.target.value) || 5 })}
                    min="1"
                    max="10"
                    required
                  />
                  <small className="form-help">Rate the complexity: 1 = Very Easy, 10 = Very Hard</small>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="taskType">Task Type</label>
                  <select
                    id="taskType"
                    className="form-select"
                    value={newTask.task_type}
                    onChange={(e) => handleTaskTypeChange(e.target.value)}
                    required
                  >
                    <option value="General">General</option>
                    <option value="Development">Development (Coding)</option>
                    <option value="Documentation">Documentation (Writing)</option>
                    <option value="Research">Research</option>
                    <option value="Design">Design</option>
                    <option value="Testing">Testing</option>
                    <option value="Planning">Planning</option>
                  </select>
                  <small className="form-help">Select the type of work this task involves</small>
                </div>
                {taskSuggestions.length > 0 && (
                  <div className="task-suggestions-box">
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--primary-dark)' }}>
                      💡 Recommended Members for {newTask.task_type} Tasks:
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {taskSuggestions.slice(0, 3).map(suggestion => (
                        <div key={suggestion.userdesc} className="suggestion-item">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong style={{ fontSize: '0.875rem' }}>{suggestion.fullName}</strong>
                              <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--gray-600)' }}>
                                ({suggestion.specialization})
                              </span>
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#059669' }}>
                              {suggestion.suitabilityScore}% match
                            </span>
                          </div>
                          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--gray-600)' }}>
                            {suggestion.matchReason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                    <div className="form-group">
                      <label className="form-label" htmlFor="editTaskDifficulty">Difficulty (1-10)</label>
                      <input
                        type="number"
                        id="editTaskDifficulty"
                        className="form-input"
                        value={editingTask.difficulty}
                        onChange={(e) => setEditingTask({ ...editingTask, difficulty: parseInt(e.target.value) || 5 })}
                        min="1"
                        max="10"
                        required
                      />
                      <small className="form-help">Rate the complexity: 1 = Very Easy, 10 = Very Hard</small>
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="editTaskType">Task Type</label>
                      <select
                        id="editTaskType"
                        className="form-select"
                        value={editingTask.task_type}
                        onChange={(e) => setEditingTask({ ...editingTask, task_type: e.target.value })}
                        required
                      >
                        <option value="General">General</option>
                        <option value="Development">Development (Coding)</option>
                        <option value="Documentation">Documentation (Writing)</option>
                        <option value="Research">Research</option>
                        <option value="Design">Design</option>
                        <option value="Testing">Testing</option>
                        <option value="Planning">Planning</option>
                      </select>
                      <small className="form-help">Select the type of work this task involves</small>
                    </div>
                  </>
                ) : (
                  <div className="task-info-display">
                    <p><strong>Task:</strong> {editingTask.description}</p>
                    {editingTask.deadline && (
                      <p><strong>Deadline:</strong> {new Date(editingTask.deadline).toLocaleDateString()}</p>
                    )}
                    <p><strong>Type:</strong> {editingTask.task_type || 'General'}</p>
                    <p><strong>Difficulty:</strong> {editingTask.difficulty}/10</p>
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

                {/* Step 2: Description, System Recommendation, and Proof */}
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

                {/* Step 3: Resolution Choice */}
                {disputeStep === 3 && (
                  <div>
                    <div className="dispute-summary">
                      <h3>Review Your Dispute</h3>
                      <p><strong>Type:</strong> {newDispute.dispute_type} {newDispute.sub_type && `- ${newDispute.sub_type}`}</p>
                      <p><strong>Description:</strong> {newDispute.description}</p>
                      {newDispute.supporting_context && (
                        <p><strong>Supporting Context:</strong> {newDispute.supporting_context.substring(0, 100)}{newDispute.supporting_context.length > 100 ? '...' : ''}</p>
                      )}
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

                    {(newDispute.dispute_type === 'Uneven Distribution' || newDispute.sub_type === 'Uneven Distribution') && complexityAnalysis && (
                      <div className="complexity-analysis-box">
                        <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>Workload Distribution Analysis</h4>
                        <div className="analysis-summary">
                          <div className="analysis-stat">
                            <span className="stat-label">Total Complexity:</span>
                            <span className="stat-value">{complexityAnalysis.totalComplexity} points</span>
                          </div>
                          <div className="analysis-stat">
                            <span className="stat-label">Fair Distribution:</span>
                            <span className="stat-value">{complexityAnalysis.fairComplexity} points per person</span>
                          </div>
                          <div className="analysis-stat">
                            <span className="stat-label">Team Members:</span>
                            <span className="stat-value">{complexityAnalysis.memberCount}</span>
                          </div>
                        </div>
                        {complexityAnalysis.currentDistribution && complexityAnalysis.currentDistribution.length > 0 && (
                          <div style={{ marginTop: '1rem' }}>
                            <strong style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Current Workload per Member:</strong>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {complexityAnalysis.currentDistribution.map(member => (
                                <div key={member.userdesc} style={{ padding: '0.5rem', backgroundColor: 'var(--gray-50)', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 500 }}>{member.name}</span>
                                  <span style={{ color: member.totalComplexity > complexityAnalysis.fairComplexity * 1.2 ? '#dc2626' : member.totalComplexity < complexityAnalysis.fairComplexity * 0.8 ? '#2563eb' : '#059669' }}>
                                    {member.totalComplexity} points ({member.assignedCount} tasks)
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--gray-600)' }}>
                          {complexityAnalysis.suggestion}
                        </p>
                      </div>
                    )}

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
                  <span className="form-label">Work Commitment</span>
                  <div className="capacity-work-row">
                    <div>
                      <label className="capacity-field-label" htmlFor="capacityCompany">Company</label>
                      <input
                        id="capacityCompany"
                        className="form-input"
                        value={capacityForm.company}
                        onChange={(e) => setCapacityForm({ ...capacityForm, company: e.target.value })}
                        placeholder="e.g., XYZ Corporation"
                      />
                    </div>
                    <div>
                      <label className="capacity-field-label" htmlFor="capacityRole">Role</label>
                      <select
                        id="capacityRole"
                        className="form-select"
                        value={capacityForm.capacity_role}
                        onChange={(e) => setCapacityForm({ ...capacityForm, capacity_role: e.target.value })}
                      >
                        <option value="">Select a role</option>
                        {CAPACITY_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <span className="form-label">
                    Organizations & Affiliations
                  </span>
                  <small className="form-help capacity-org-help">Select all that apply.</small>
                  <div className="capacity-org-options">
                    {ORGANIZATION_OPTIONS.map(organization => (
                      <label className="capacity-org-option" key={organization}>
                        <input
                          type="checkbox"
                          checked={capacityForm.selected_organizations.includes(organization)}
                          onChange={() => toggleOrganization(organization)}
                        />
                        <span>{organization}</span>
                      </label>
                    ))}
                    <label className="capacity-org-option capacity-org-other">
                      <input
                        type="checkbox"
                        checked={capacityForm.show_other_organization}
                        onChange={(e) => setCapacityForm({
                          ...capacityForm,
                          show_other_organization: e.target.checked,
                          other_organization: e.target.checked ? capacityForm.other_organization : ''
                        })}
                      />
                      <span>Others</span>
                    </label>
                  </div>
                  {capacityForm.show_other_organization && (
                    <input
                      className="form-input capacity-other-input"
                      value={capacityForm.other_organization}
                      onChange={(e) => setCapacityForm({ ...capacityForm, other_organization: e.target.value })}
                      placeholder="Enter other organization(s), separated by commas"
                      aria-label="Other organizations"
                      autoFocus
                    />
                  )}
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
          align-items: flex-start;
          justify-content: space-between;
          padding: 1rem;
          background-color: var(--white);
          border-radius: var(--radius);
          box-shadow: var(--shadow-sm);
        }

        .member-info {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          flex: 1;
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

        .badge-suggestion {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          color: #92400e;
          border: 1px solid #fbbf24;
          font-size: 0.75rem;
          padding: 0.25rem 0.5rem;
          cursor: help;
        }

        .member-metrics {
          margin-top: 0.5rem;
          padding: 0.5rem;
          background-color: var(--gray-50);
          border-radius: 4px;
          font-size: 0.75rem;
          color: var(--gray-600);
        }

        .member-suggestion-reason {
          margin-top: 0.5rem;
          font-size: 0.8125rem;
          color: var(--gray-600);
          font-style: italic;
          line-height: 1.4;
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
          margin-bottom: 0.75rem;
          color: var(--gray-800);
          font-size: 0.875rem;
        }

        .analysis-summary {
          display: flex;
          gap: 1.5rem;
          margin-bottom: 0.75rem;
          flex-wrap: wrap;
        }

        .analysis-stat {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .stat-label {
          font-size: 0.75rem;
          color: var(--gray-500);
          text-transform: uppercase;
          letter-spacing: 0.025em;
          font-weight: 500;
        }

        .stat-value {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--primary-dark);
        }

        .analysis-suggestion {
          margin: 0;
          font-size: 0.875rem;
          color: var(--gray-700);
          line-height: 1.5;
          padding-top: 0.75rem;
          border-top: 1px solid var(--gray-200);
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

        .complexity-analysis-box {
          background: linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%);
          border: 2px solid #f59e0b;
          border-radius: var(--radius);
          padding: 1.25rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .task-suggestions-box {
          background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%);
          border: 2px solid var(--primary);
          border-radius: var(--radius);
          padding: 1rem;
          margin-bottom: 1rem;
        }

        .suggestion-item {
          padding: 0.75rem;
          background-color: white;
          border-radius: 4px;
          border: 1px solid var(--gray-200);
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

        .capacity-work-row {
          display: grid;
          grid-template-columns: minmax(0, 1.6fr) minmax(150px, 1fr);
          gap: 0.75rem;
        }

        .capacity-field-label {
          display: block;
          margin-bottom: 0.375rem;
          color: var(--gray-600);
          font-size: 0.8125rem;
        }

        .capacity-org-help {
          margin-top: -0.125rem;
          margin-bottom: 0.625rem;
        }

        .capacity-org-options {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.5rem;
          max-height: 260px;
          padding: 0.75rem;
          overflow-y: auto;
          border: 1px solid var(--gray-300);
          border-radius: var(--radius);
          background: var(--gray-50);
        }

        .capacity-org-option {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          padding: 0.45rem 0.5rem;
          border-radius: 4px;
          color: var(--gray-700);
          font-size: 0.8125rem;
          line-height: 1.3;
          cursor: pointer;
        }

        .capacity-org-option:hover {
          background: var(--white);
        }

        .capacity-org-option input {
          flex: 0 0 auto;
          width: 16px;
          height: 16px;
          margin-top: 0.05rem;
          accent-color: var(--primary);
        }

        .capacity-org-other {
          font-weight: 600;
        }

        .capacity-other-input {
          margin-top: 0.625rem;
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

          .capacity-work-row,
          .capacity-org-options {
            grid-template-columns: 1fr;
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
