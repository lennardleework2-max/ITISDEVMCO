const express = require('express');
const router = express.Router();
const { select, insert, update, remove } = require('../utils/supabase');
const { generateTaskId, generateTaskAssigneeId } = require('../utils/idGenerator');
const { sanitizeString, isValidStatus, VALID_STATUSES } = require('../utils/validation');

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Check if user is project owner
async function isProjectOwner(projectId, userdesc) {
  const membership = await select('projects_members',
    `project_id=eq.${projectId}&userdesc=eq.${userdesc}&role=eq.Owner`);
  return membership && membership.length > 0;
}

// Check if user is project member
async function isProjectMember(projectId, userdesc) {
  const membership = await select('projects_members',
    `project_id=eq.${projectId}&userdesc=eq.${userdesc}`);
  return membership && membership.length > 0;
}

// Get all tasks for a project
router.get('/project/:projectId', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userdesc = req.session.user.userdesc;

    // Check access
    if (!(await isProjectMember(projectId, userdesc))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get tasks
    const tasks = await select('project_tasks',
      `project_id=eq.${projectId}&order=task_date_created.desc`);

    if (!tasks || tasks.length === 0) {
      return res.json([]);
    }

    // Get assignees for all tasks
    const taskIds = tasks.map(t => `"${t.task_id}"`).join(',');
    const assignees = await select('project_task_assignees', `task_id=in.(${taskIds})`);

    // Get user details for assignees
    const assigneeUserdescs = [...new Set((assignees || []).map(a => a.userdesc))];
    let users = [];
    if (assigneeUserdescs.length > 0) {
      const userdescsQuery = assigneeUserdescs.map(u => `"${u}"`).join(',');
      users = await select('mf_users', `userdesc=in.(${userdescsQuery})&select=userdesc,fname,lname`);
    }

    // Combine tasks with assignees
    const tasksWithAssignees = tasks.map(task => {
      const taskAssignees = (assignees || [])
        .filter(a => a.task_id === task.task_id)
        .map(a => {
          const user = users.find(u => u.userdesc === a.userdesc);
          return {
            ...a,
            fname: user?.fname || '',
            lname: user?.lname || '',
            fullName: user ? `${user.fname} ${user.lname}` : a.userdesc
          };
        });

      return {
        ...task,
        assignees: taskAssignees
      };
    });

    res.json(tasksWithAssignees);
  } catch (error) {
    console.error('Get tasks error:', error.message);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get single task
router.get('/:taskId', requireAuth, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userdesc = req.session.user.userdesc;

    // Get task
    const tasks = await select('project_tasks', `task_id=eq.${taskId}`);
    if (!tasks || tasks.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = tasks[0];

    // Check access
    if (!(await isProjectMember(task.project_id, userdesc))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get assignees
    const assignees = await select('project_task_assignees', `task_id=eq.${taskId}`);

    // Get user details
    let users = [];
    if (assignees && assignees.length > 0) {
      const userdescs = assignees.map(a => `"${a.userdesc}"`).join(',');
      users = await select('mf_users', `userdesc=in.(${userdescs})&select=userdesc,fname,lname,email`);
    }

    const assigneesWithDetails = (assignees || []).map(a => {
      const user = users.find(u => u.userdesc === a.userdesc);
      return {
        ...a,
        fname: user?.fname || '',
        lname: user?.lname || '',
        email: user?.email || '',
        fullName: user ? `${user.fname} ${user.lname}` : a.userdesc
      };
    });

    res.json({
      ...task,
      assignees: assigneesWithDetails
    });
  } catch (error) {
    console.error('Get task error:', error.message);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// Create task
router.post('/', requireAuth, async (req, res) => {
  try {
    const { project_id, task_description, task_date_deadline, difficulty, assignees } = req.body;
    const userdesc = req.session.user.userdesc;

    // Validate
    if (!project_id) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    if (!task_description || !task_description.trim()) {
      return res.status(400).json({ error: 'Task description is required' });
    }

    // Validate difficulty
    const taskDifficulty = difficulty !== undefined && difficulty !== null && difficulty !== ''
      ? parseInt(difficulty)
      : 5; // Default to 5 if not provided

    if (isNaN(taskDifficulty) || taskDifficulty < 1 || taskDifficulty > 10) {
      return res.status(400).json({ error: 'Difficulty must be between 1 and 10' });
    }

    // Check if member
    if (!(await isProjectMember(project_id, userdesc))) {
      return res.status(403).json({ error: 'Only project members can create tasks' });
    }

    const cleanDescription = sanitizeString(task_description);
    if (cleanDescription.length > 100) {
      return res.status(400).json({ error: 'Task description must be 100 characters or less' });
    }

    // Generate task ID
    const task_id = await generateTaskId();

    // Create task
    const newTask = await insert('project_tasks', {
      project_id,
      task_id,
      task_description: cleanDescription,
      task_date_deadline: task_date_deadline || null,
      difficulty: taskDifficulty,
      status: 'Pending'
    });

    if (!newTask || newTask.length === 0) {
      return res.status(500).json({ error: 'Failed to create task' });
    }

    // Add assignees if provided
    const taskAssignees = [];
    if (assignees && Array.isArray(assignees) && assignees.length > 0) {
      for (const assigneeUserdesc of assignees) {
        // Verify assignee is a project member
        if (await isProjectMember(project_id, assigneeUserdesc)) {
          const task_assignees_id = await generateTaskAssigneeId();
          const newAssignee = await insert('project_task_assignees', {
            task_assignees_id,
            task_id,
            userdesc: assigneeUserdesc,
            status: 'Pending'
          });
          if (newAssignee && newAssignee.length > 0) {
            taskAssignees.push(newAssignee[0]);
          }
        }
      }
    }

    res.status(201).json({
      message: 'Task created successfully',
      task: {
        ...newTask[0],
        assignees: taskAssignees
      }
    });
  } catch (error) {
    console.error('Create task error:', error.message);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Check if user is assigned to task
async function isTaskAssignee(taskId, userdesc) {
  const assignment = await select('project_task_assignees',
    `task_id=eq.${taskId}&userdesc=eq.${userdesc}`);
  return assignment && assignment.length > 0;
}

// Update task
router.patch('/:taskId', requireAuth, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { task_description, task_date_deadline, difficulty, status } = req.body;
    const userdesc = req.session.user.userdesc;

    // Get task
    const tasks = await select('project_tasks', `task_id=eq.${taskId}`);
    if (!tasks || tasks.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = tasks[0];

    // Check permissions
    const ownerCheck = await isProjectOwner(task.project_id, userdesc);
    const assigneeCheck = await isTaskAssignee(taskId, userdesc);

    if (!ownerCheck && !assigneeCheck) {
      return res.status(403).json({ error: 'Not authorized to update this task' });
    }

    const updates = {};

    // Only owners can update description and deadline
    if (task_description !== undefined) {
      if (!ownerCheck) {
        return res.status(403).json({ error: 'Only project owner can update task description' });
      }
      const cleanDescription = sanitizeString(task_description);
      if (cleanDescription.length > 100) {
        return res.status(400).json({ error: 'Task description must be 100 characters or less' });
      }
      updates.task_description = cleanDescription;
    }

    if (task_date_deadline !== undefined) {
      if (!ownerCheck) {
        return res.status(403).json({ error: 'Only project owner can update task deadline' });
      }
      updates.task_date_deadline = task_date_deadline;
    }

    // Only owners can update difficulty
    if (difficulty !== undefined) {
      if (!ownerCheck) {
        return res.status(403).json({ error: 'Only project owner can update task difficulty' });
      }
      const taskDifficulty = parseInt(difficulty);
      if (isNaN(taskDifficulty) || taskDifficulty < 1 || taskDifficulty > 10) {
        return res.status(400).json({ error: 'Difficulty must be between 1 and 10' });
      }
      updates.difficulty = taskDifficulty;
    }

    // Both owners and assignees can update status
    if (status !== undefined) {
      if (!isValidStatus(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
      }
      updates.status = status;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const updated = await update('project_tasks', `task_id=eq.${taskId}`, updates);
    res.json({ message: 'Task updated', task: updated[0] });
  } catch (error) {
    console.error('Update task error:', error.message);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete task
router.delete('/:taskId', requireAuth, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userdesc = req.session.user.userdesc;

    // Get task
    const tasks = await select('project_tasks', `task_id=eq.${taskId}`);
    if (!tasks || tasks.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if owner
    if (!(await isProjectOwner(tasks[0].project_id, userdesc))) {
      return res.status(403).json({ error: 'Only project owner can delete tasks' });
    }

    // Delete assignees first
    await remove('project_task_assignees', `task_id=eq.${taskId}`);
    await remove('project_tasks', `task_id=eq.${taskId}`);

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error.message);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Add assignee to task
router.post('/:taskId/assignees', requireAuth, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { userdesc: assigneeUserdesc } = req.body;
    const currentUser = req.session.user.userdesc;

    // Get task
    const tasks = await select('project_tasks', `task_id=eq.${taskId}`);
    if (!tasks || tasks.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = tasks[0];

    // Check if owner
    if (!(await isProjectOwner(task.project_id, currentUser))) {
      return res.status(403).json({ error: 'Only project owner can assign tasks' });
    }

    // Check if assignee is project member
    if (!(await isProjectMember(task.project_id, assigneeUserdesc))) {
      return res.status(400).json({ error: 'User is not a project member' });
    }

    // Check if already assigned
    const existing = await select('project_task_assignees',
      `task_id=eq.${taskId}&userdesc=eq.${assigneeUserdesc}`);
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'User is already assigned to this task' });
    }

    // Generate assignee ID
    const task_assignees_id = await generateTaskAssigneeId();

    // Add assignee
    const newAssignee = await insert('project_task_assignees', {
      task_assignees_id,
      task_id: taskId,
      userdesc: assigneeUserdesc,
      status: 'Pending'
    });

    // Get user details
    const users = await select('mf_users', `userdesc=eq.${assigneeUserdesc}&select=userdesc,fname,lname`);
    const user = users?.[0];

    res.status(201).json({
      message: 'Assignee added successfully',
      assignee: {
        ...newAssignee[0],
        fname: user?.fname || '',
        lname: user?.lname || '',
        fullName: user ? `${user.fname} ${user.lname}` : assigneeUserdesc
      }
    });
  } catch (error) {
    console.error('Add assignee error:', error.message);
    res.status(500).json({ error: 'Failed to add assignee' });
  }
});

// Update assignee status
router.patch('/:taskId/assignees/:assigneeUserdesc', requireAuth, async (req, res) => {
  try {
    const { taskId, assigneeUserdesc } = req.params;
    const { status, remarks } = req.body;
    const currentUser = req.session.user.userdesc;

    // Get task
    const tasks = await select('project_tasks', `task_id=eq.${taskId}`);
    if (!tasks || tasks.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = tasks[0];

    // Check if user can update (owner or the assignee themselves)
    const isOwner = await isProjectOwner(task.project_id, currentUser);
    const isSelf = currentUser === assigneeUserdesc;

    if (!isOwner && !isSelf) {
      return res.status(403).json({ error: 'Not authorized to update this assignment' });
    }

    const updates = {};

    if (status !== undefined) {
      if (!isValidStatus(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
      }
      updates.status = status;

      // Set finished date if completed
      if (status === 'Completed') {
        updates.task_date_finished = new Date().toISOString();
      }
    }

    if (remarks !== undefined) {
      updates.remarks = sanitizeString(remarks).substring(0, 100);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const updated = await update('project_task_assignees',
      `task_id=eq.${taskId}&userdesc=eq.${assigneeUserdesc}`, updates);

    // Update task status based on assignees
    await updateTaskStatus(taskId);

    res.json({ message: 'Assignment updated', assignee: updated[0] });
  } catch (error) {
    console.error('Update assignee error:', error.message);
    res.status(500).json({ error: 'Failed to update assignment' });
  }
});

// Remove assignee
router.delete('/:taskId/assignees/:assigneeUserdesc', requireAuth, async (req, res) => {
  try {
    const { taskId, assigneeUserdesc } = req.params;
    const currentUser = req.session.user.userdesc;

    // Get task
    const tasks = await select('project_tasks', `task_id=eq.${taskId}`);
    if (!tasks || tasks.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if owner
    if (!(await isProjectOwner(tasks[0].project_id, currentUser))) {
      return res.status(403).json({ error: 'Only project owner can remove assignees' });
    }

    await remove('project_task_assignees', `task_id=eq.${taskId}&userdesc=eq.${assigneeUserdesc}`);
    res.json({ message: 'Assignee removed successfully' });
  } catch (error) {
    console.error('Remove assignee error:', error.message);
    res.status(500).json({ error: 'Failed to remove assignee' });
  }
});

// Helper to update task status based on assignees
async function updateTaskStatus(taskId) {
  try {
    const assignees = await select('project_task_assignees', `task_id=eq.${taskId}`);

    if (!assignees || assignees.length === 0) {
      return;
    }

    const statuses = assignees.map(a => a.status);
    let newStatus = 'Pending';

    if (statuses.every(s => s === 'Completed')) {
      newStatus = 'Completed';
    } else if (statuses.some(s => s === 'In Progress' || s === 'Completed')) {
      newStatus = 'In Progress';
    }

    await update('project_tasks', `task_id=eq.${taskId}`, { status: newStatus });
  } catch (error) {
    console.error('Update task status error:', error.message);
  }
}

module.exports = router;
