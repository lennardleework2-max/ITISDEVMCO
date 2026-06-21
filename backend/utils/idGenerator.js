const { select } = require('./supabase');

// Generate next sequential ID with prefix
// Format: PREFIX-000001, PREFIX-000002, etc.
async function generateId(table, column, prefix) {
  try {
    // Get the latest ID with the matching prefix
    const query = `select=${column}&${column}=like.${prefix}-*&order=${column}.desc&limit=1`;
    const results = await select(table, query);

    if (results && results.length > 0) {
      const lastId = results[0][column];
      // Extract the number part and increment
      const numPart = parseInt(lastId.split('-')[1], 10);
      const nextNum = numPart + 1;
      return `${prefix}-${String(nextNum).padStart(6, '0')}`;
    }

    // If no existing IDs, start at 000001
    return `${prefix}-000001`;
  } catch (error) {
    console.error('Error generating ID:', error.message);
    throw error;
  }
}

// Generate user ID (USR-XXXXXX)
async function generateUserId() {
  return generateId('mf_users', 'userdesc', 'USR');
}

// Generate project ID (PJT-XXXXXX)
async function generateProjectId() {
  return generateId('projects', 'project_id', 'PJT');
}

// Generate task ID (TSK-XXXXXX)
async function generateTaskId() {
  return generateId('project_tasks', 'task_id', 'TSK');
}

// Generate task assignee ID (TAA-XXXXXX)
async function generateTaskAssigneeId() {
  return generateId('project_task_assignees', 'task_assignees_id', 'TAA');
}

// Generate dispute ID (DIS-XXXXXX)
async function generateDisputeId() {
  return generateId('disputes', 'dispute_id', 'DIS');
}

module.exports = {
  generateId,
  generateUserId,
  generateProjectId,
  generateTaskId,
  generateTaskAssigneeId,
  generateDisputeId
};
