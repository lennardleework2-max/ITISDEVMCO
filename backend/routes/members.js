const express = require('express');
const router = express.Router();
const { select, insert, update, remove } = require('../utils/supabase');
const { sanitizeString } = require('../utils/validation');

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

// Get project members
router.get('/:projectId', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userdesc = req.session.user.userdesc;

    // Check if user is a member
    if (!(await isProjectMember(projectId, userdesc))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get members
    const members = await select('projects_members', `project_id=eq.${projectId}`);

    if (!members || members.length === 0) {
      return res.json([]);
    }

    // Get user details for each member
    const userdescs = members.map(m => `"${m.userdesc}"`).join(',');
    const users = await select('mf_users', `userdesc=in.(${userdescs})&select=userdesc,fname,lname,email`);

    // Combine member info with user details
    const membersWithDetails = members.map(m => {
      const user = users.find(u => u.userdesc === m.userdesc);
      return {
        ...m,
        fname: user?.fname || '',
        lname: user?.lname || '',
        email: user?.email || '',
        fullName: user ? `${user.fname} ${user.lname}` : m.userdesc
      };
    });

    res.json(membersWithDetails);
  } catch (error) {
    console.error('Get members error:', error.message);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Add member to project
router.post('/:projectId', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { email, role } = req.body;
    const currentUser = req.session.user.userdesc;

    // Check if current user is owner
    if (!(await isProjectOwner(projectId, currentUser))) {
      return res.status(403).json({ error: 'Only project owner can add members' });
    }

    // Validate email
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const cleanEmail = sanitizeString(email).toLowerCase();

    // Find user by email
    const users = await select('mf_users', `email=eq.${encodeURIComponent(cleanEmail)}`);
    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'User not found with this email' });
    }

    const userToAdd = users[0];

    // Check if already a member
    if (await isProjectMember(projectId, userToAdd.userdesc)) {
      return res.status(400).json({ error: 'User is already a member of this project' });
    }

    // Add member
    const memberRole = sanitizeString(role) || 'Member';
    const newMember = await insert('projects_members', {
      project_id: projectId,
      userdesc: userToAdd.userdesc,
      role: memberRole
    });

    res.status(201).json({
      message: 'Member added successfully',
      member: {
        ...newMember[0],
        fname: userToAdd.fname,
        lname: userToAdd.lname,
        email: userToAdd.email,
        fullName: `${userToAdd.fname} ${userToAdd.lname}`
      }
    });
  } catch (error) {
    console.error('Add member error:', error.message);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// Update member role
router.patch('/:projectId/:memberUserdesc', requireAuth, async (req, res) => {
  try {
    const { projectId, memberUserdesc } = req.params;
    const { role } = req.body;
    const currentUser = req.session.user.userdesc;

    // Check if current user is owner
    if (!(await isProjectOwner(projectId, currentUser))) {
      return res.status(403).json({ error: 'Only project owner can update members' });
    }

    // Cannot change owner's role
    if (memberUserdesc === currentUser) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    if (!role) {
      return res.status(400).json({ error: 'Role is required' });
    }

    const cleanRole = sanitizeString(role);
    if (cleanRole === 'Owner') {
      return res.status(400).json({ error: 'Cannot assign Owner role' });
    }

    const updated = await update('projects_members',
      `project_id=eq.${projectId}&userdesc=eq.${memberUserdesc}`,
      { role: cleanRole }
    );

    res.json({ message: 'Member role updated', member: updated[0] });
  } catch (error) {
    console.error('Update member error:', error.message);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// Remove member from project
router.delete('/:projectId/:memberUserdesc', requireAuth, async (req, res) => {
  try {
    const { projectId, memberUserdesc } = req.params;
    const currentUser = req.session.user.userdesc;

    // Check if current user is owner
    if (!(await isProjectOwner(projectId, currentUser))) {
      return res.status(403).json({ error: 'Only project owner can remove members' });
    }

    // Cannot remove owner
    if (memberUserdesc === currentUser) {
      return res.status(400).json({ error: 'Cannot remove yourself as owner' });
    }

    // Remove from task assignments first
    const tasks = await select('project_tasks', `project_id=eq.${projectId}`);
    for (const task of tasks || []) {
      await remove('project_task_assignees', `task_id=eq.${task.task_id}&userdesc=eq.${memberUserdesc}`);
    }

    // Remove from project
    await remove('projects_members', `project_id=eq.${projectId}&userdesc=eq.${memberUserdesc}`);

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error.message);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Search users (for adding members)
router.get('/search/users', requireAuth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json([]);
    }

    const searchTerm = sanitizeString(q).toLowerCase();

    // Search by email or name
    const users = await select('mf_users',
      `or=(email.ilike.*${encodeURIComponent(searchTerm)}*,fname.ilike.*${encodeURIComponent(searchTerm)}*,lname.ilike.*${encodeURIComponent(searchTerm)}*)&select=userdesc,fname,lname,email&limit=10`
    );

    res.json(users || []);
  } catch (error) {
    console.error('Search users error:', error.message);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

module.exports = router;
