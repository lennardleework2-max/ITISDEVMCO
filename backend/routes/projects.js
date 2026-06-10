const express = require('express');
const router = express.Router();
const { select, insert, update, remove } = require('../utils/supabase');
const { generateProjectId } = require('../utils/idGenerator');
const { sanitizeString, validateRequired } = require('../utils/validation');

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Get all projects for current user
router.get('/', requireAuth, async (req, res) => {
  try {
    const userdesc = req.session.user.userdesc;

    // Get projects where user is a member
    const memberships = await select('projects_members', `userdesc=eq.${userdesc}`);

    if (!memberships || memberships.length === 0) {
      return res.json([]);
    }

    const projectIds = memberships.map(m => m.project_id);
    const projectsQuery = `project_id=in.(${projectIds.map(id => `"${id}"`).join(',')})&order=created_at.desc`;
    const projects = await select('projects', projectsQuery);

    // Add role info to each project
    const projectsWithRole = projects.map(p => {
      const membership = memberships.find(m => m.project_id === p.project_id);
      return {
        ...p,
        role: membership ? membership.role : 'Member'
      };
    });

    res.json(projectsWithRole);
  } catch (error) {
    console.error('Get projects error:', error.message);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get single project
router.get('/:projectId', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userdesc = req.session.user.userdesc;

    // Check if user is a member
    const membership = await select('projects_members',
      `project_id=eq.${projectId}&userdesc=eq.${userdesc}`);

    if (!membership || membership.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get project
    const projects = await select('projects', `project_id=eq.${projectId}`);
    if (!projects || projects.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({
      ...projects[0],
      role: membership[0].role
    });
  } catch (error) {
    console.error('Get project error:', error.message);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Create project
router.post('/', requireAuth, async (req, res) => {
  try {
    const { project_name } = req.body;
    const userdesc = req.session.user.userdesc;

    // Validate
    if (!project_name || !project_name.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const cleanName = sanitizeString(project_name);
    if (cleanName.length > 100) {
      return res.status(400).json({ error: 'Project name must be 100 characters or less' });
    }

    // Generate project ID
    const project_id = await generateProjectId();

    // Create project
    const newProject = await insert('projects', {
      project_id,
      project_name: cleanName,
      created_by_userdesc: userdesc
    });

    if (!newProject || newProject.length === 0) {
      return res.status(500).json({ error: 'Failed to create project' });
    }

    // Add creator as owner/leader
    await insert('projects_members', {
      project_id,
      userdesc,
      role: 'Owner'
    });

    res.status(201).json({
      message: 'Project created successfully',
      project: {
        ...newProject[0],
        role: 'Owner'
      }
    });
  } catch (error) {
    console.error('Create project error:', error.message);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project
router.patch('/:projectId', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { project_name } = req.body;
    const userdesc = req.session.user.userdesc;

    // Check if user is owner
    const membership = await select('projects_members',
      `project_id=eq.${projectId}&userdesc=eq.${userdesc}&role=eq.Owner`);

    if (!membership || membership.length === 0) {
      return res.status(403).json({ error: 'Only project owner can update project' });
    }

    const updates = {};
    if (project_name) {
      const cleanName = sanitizeString(project_name);
      if (cleanName.length > 100) {
        return res.status(400).json({ error: 'Project name must be 100 characters or less' });
      }
      updates.project_name = cleanName;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const updated = await update('projects', `project_id=eq.${projectId}`, updates);
    res.json({ message: 'Project updated', project: updated[0] });
  } catch (error) {
    console.error('Update project error:', error.message);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project
router.delete('/:projectId', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userdesc = req.session.user.userdesc;

    // Check if user is owner
    const membership = await select('projects_members',
      `project_id=eq.${projectId}&userdesc=eq.${userdesc}&role=eq.Owner`);

    if (!membership || membership.length === 0) {
      return res.status(403).json({ error: 'Only project owner can delete project' });
    }

    // Delete in order: assignees, tasks, members, project
    const tasks = await select('project_tasks', `project_id=eq.${projectId}`);
    for (const task of tasks || []) {
      await remove('project_task_assignees', `task_id=eq.${task.task_id}`);
    }
    await remove('project_tasks', `project_id=eq.${projectId}`);
    await remove('projects_members', `project_id=eq.${projectId}`);
    await remove('projects', `project_id=eq.${projectId}`);

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error.message);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

module.exports = router;
