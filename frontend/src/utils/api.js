const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const config = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

// Auth
export const auth = {
  signup: (data) => request('/auth/signup', { method: 'POST', body: data }),
  login: (data) => request('/auth/login', { method: 'POST', body: data }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me')
};

// Projects
export const projects = {
  getAll: () => request('/projects'),
  get: (id) => request(`/projects/${id}`),
  create: (data) => request('/projects', { method: 'POST', body: data }),
  update: (id, data) => request(`/projects/${id}`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/projects/${id}`, { method: 'DELETE' })
};

// Members
export const members = {
  getAll: (projectId) => request(`/members/${projectId}`),
  add: (projectId, data) => request(`/members/${projectId}`, { method: 'POST', body: data }),
  update: (projectId, userdesc, data) => request(`/members/${projectId}/${userdesc}`, { method: 'PATCH', body: data }),
  remove: (projectId, userdesc) => request(`/members/${projectId}/${userdesc}`, { method: 'DELETE' }),
  search: (query) => request(`/members/search/users?q=${encodeURIComponent(query)}`),
  getSuggestions: (projectId) => request(`/members/suggestions/${projectId}`),
  getTaskSuggestions: (projectId, taskType) => request(`/members/task-suggestions/${projectId}?taskType=${encodeURIComponent(taskType)}`)
};

// Tasks
export const tasks = {
  getByProject: (projectId) => request(`/tasks/project/${projectId}`),
  get: (id) => request(`/tasks/${id}`),
  create: (data) => request('/tasks', { method: 'POST', body: data }),
  update: (id, data) => request(`/tasks/${id}`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
  addAssignee: (taskId, userdesc) => request(`/tasks/${taskId}/assignees`, { method: 'POST', body: { userdesc } }),
  updateAssignee: (taskId, userdesc, data) => request(`/tasks/${taskId}/assignees/${userdesc}`, { method: 'PATCH', body: data }),
  removeAssignee: (taskId, userdesc) => request(`/tasks/${taskId}/assignees/${userdesc}`, { method: 'DELETE' })
};

// Dashboard
export const dashboard = {
  getProject: (projectId) => request(`/dashboard/project/${projectId}`),
  getUser: () => request('/dashboard/user'),
  getOutliers: (projectId) => request(`/dashboard/outliers/${projectId}`)
};

// Disputes
export const disputes = {
  getByProject: (projectId) => request(`/disputes/project/${projectId}`),
  get: (id) => request(`/disputes/${id}`),
  create: (data) => request('/disputes', { method: 'POST', body: data }),
  update: (id, data) => request(`/disputes/${id}`, { method: 'PATCH', body: data }),
  getAnalysis: (projectId) => request(`/disputes/analysis/${projectId}`)
};

// Capacity
export const capacity = {
  getByProject: (projectId) => request(`/capacity/${projectId}`),
  get: (projectId, userdesc) => request(`/capacity/${projectId}/${userdesc}`),
  save: (projectId, data) => request(`/capacity/${projectId}`, { method: 'POST', body: data })
};

export default {
  auth,
  projects,
  members,
  tasks,
  dashboard,
  disputes,
  capacity
};
