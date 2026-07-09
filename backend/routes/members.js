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

// Predictive Analytics: Suggest best members for a task based on task type and specialization
router.get('/task-suggestions/:projectId', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { taskType } = req.query;
    const userdesc = req.session.user.userdesc;

    // Check if user is a member
    if (!(await isProjectMember(projectId, userdesc))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all members with user details including specialization
    const members = await select('projects_members', `project_id=eq.${projectId}`);
    if (!members || members.length === 0) {
      return res.json([]);
    }

    const userdescs = members.map(m => `"${m.userdesc}"`).join(',');
    const users = await select('mf_users', `userdesc=in.(${userdescs})&select=userdesc,fname,lname,email,specialization`);

    // Get all tasks and assignments for performance metrics
    const tasks = await select('project_tasks', `project_id=eq.${projectId}`);
    let assignments = [];
    if (tasks && tasks.length > 0) {
      const taskIds = tasks.map(t => `"${t.task_id}"`).join(',');
      assignments = await select('project_task_assignees', `task_id=in.(${taskIds})`);
    }

    // Map task type to preferred specializations
    const taskTypeMapping = {
      'Development': ['Coding', 'General'],
      'Documentation': ['Writing', 'General'],
      'Research': ['Research', 'Writing', 'General'],
      'Design': ['Design', 'General'],
      'Testing': ['Testing', 'Coding', 'General'],
      'Planning': ['Management', 'General'],
      'General': ['General']
    };

    const preferredSpecs = taskTypeMapping[taskType] || ['General'];

    // Score each member
    const scoredMembers = members.map(member => {
      const user = users.find(u => u.userdesc === member.userdesc);
      const memberAssignments = (assignments || []).filter(a => a.userdesc === member.userdesc);
      const memberTaskIds = memberAssignments.map(a => a.task_id);
      const memberTasks = (tasks || []).filter(t => memberTaskIds.includes(t.task_id));

      // Calculate performance metrics
      const totalTasks = memberTasks.length;
      const completedTasks = memberAssignments.filter(a => a.status === 'Completed').length;
      const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 100;
      const totalComplexity = memberTasks.reduce((sum, task) => sum + (task.difficulty || 5), 0);
      const currentWorkload = totalComplexity;

      // Calculate specialization match score
      const userSpec = user?.specialization || 'General';
      const specMatch = preferredSpecs.includes(userSpec);
      const specializationScore = specMatch ? (preferredSpecs.indexOf(userSpec) === 0 ? 100 : 70) : 30;

      // Calculate performance score
      const performanceScore = completionRate * 0.7 + (totalTasks > 0 ? 30 : 0);

      // Calculate workload score (lower is better)
      const avgWorkload = totalComplexity > 0 ? currentWorkload / (memberTasks.length || 1) : 0;
      const workloadScore = Math.max(0, 100 - (avgWorkload * 5));

      // Overall suitability score
      const suitabilityScore = (specializationScore * 0.5) + (performanceScore * 0.3) + (workloadScore * 0.2);

      return {
        userdesc: member.userdesc,
        fullName: user ? `${user.fname} ${user.lname}` : member.userdesc,
        email: user?.email || '',
        specialization: userSpec,
        suitabilityScore: Math.round(suitabilityScore),
        matchReason: specMatch
          ? `Specializes in ${userSpec} (matches ${taskType})`
          : `${userSpec} specialization (${completionRate.toFixed(0)}% completion rate)`,
        metrics: {
          completionRate: parseFloat(completionRate.toFixed(1)),
          currentWorkload,
          totalTasks
        }
      };
    });

    // Sort by suitability score descending
    scoredMembers.sort((a, b) => b.suitabilityScore - a.suitabilityScore);

    res.json(scoredMembers);
  } catch (error) {
    console.error('Get task suggestions error:', error.message);
    res.status(500).json({ error: 'Failed to get task suggestions' });
  }
});

// Predictive Analytics: Suggest roles for members based on performance
router.get('/suggestions/:projectId', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userdesc = req.session.user.userdesc;

    // Check if user is a member
    if (!(await isProjectMember(projectId, userdesc))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all members
    const members = await select('projects_members', `project_id=eq.${projectId}`);
    if (!members || members.length === 0) {
      return res.json([]);
    }

    // Get all tasks for the project
    const tasks = await select('project_tasks', `project_id=eq.${projectId}`);

    // Get all task assignments
    let assignments = [];
    if (tasks && tasks.length > 0) {
      const taskIds = tasks.map(t => `"${t.task_id}"`).join(',');
      assignments = await select('project_task_assignees', `task_id=in.(${taskIds})`);
    }

    // Calculate role suggestions for each member
    const suggestions = members.map(member => {
      // Get member's assigned tasks
      const memberAssignments = (assignments || []).filter(a => a.userdesc === member.userdesc);
      const memberTaskIds = memberAssignments.map(a => a.task_id);
      const memberTasks = (tasks || []).filter(t => memberTaskIds.includes(t.task_id));

      // Calculate metrics
      const totalTasks = memberTasks.length;
      const completedTasks = memberAssignments.filter(a => a.status === 'Completed').length;
      const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      const totalComplexity = memberTasks.reduce((sum, task) => sum + (task.difficulty || 5), 0);
      const avgComplexity = totalTasks > 0 ? totalComplexity / totalTasks : 0;

      // Determine suggested role based on performance metrics
      let suggestedRole = 'Contributor';
      let confidence = 0;
      let reasoning = '';

      if (totalTasks === 0) {
        suggestedRole = 'New Member';
        confidence = 50;
        reasoning = 'No tasks assigned yet. Assign tasks to get better role predictions.';
      } else if (member.role === 'Owner') {
        suggestedRole = 'Project Leader';
        confidence = 95;
        reasoning = 'Project owner with oversight responsibilities.';
      } else if (completionRate >= 80 && avgComplexity >= 7) {
        suggestedRole = 'Lead Developer';
        confidence = 90;
        reasoning = `High completion rate (${completionRate.toFixed(0)}%) and handles complex tasks (avg: ${avgComplexity.toFixed(1)}/10).`;
      } else if (avgComplexity >= 7) {
        suggestedRole = 'Senior Developer';
        confidence = 85;
        reasoning = `Handles high-complexity tasks (avg: ${avgComplexity.toFixed(1)}/10).`;
      } else if (completionRate >= 75 && avgComplexity >= 5) {
        suggestedRole = 'Developer';
        confidence = 80;
        reasoning = `Good completion rate (${completionRate.toFixed(0)}%) with moderate complexity tasks (avg: ${avgComplexity.toFixed(1)}/10).`;
      } else if (completionRate >= 85 && avgComplexity < 5) {
        suggestedRole = 'Quality Assurance';
        confidence = 75;
        reasoning = `Excellent completion rate (${completionRate.toFixed(0)}%) on detail-oriented tasks.`;
      } else if (totalTasks >= 5 && completionRate >= 60) {
        suggestedRole = 'Active Contributor';
        confidence = 70;
        reasoning = `Consistent participation with ${totalTasks} tasks and ${completionRate.toFixed(0)}% completion rate.`;
      } else if (completionRate < 50 && totalTasks > 0) {
        suggestedRole = 'Support Needed';
        confidence = 65;
        reasoning = `Low completion rate (${completionRate.toFixed(0)}%). May need assistance or workload adjustment.`;
      } else {
        suggestedRole = 'Contributor';
        confidence = 60;
        reasoning = `Contributing member with ${totalTasks} tasks assigned.`;
      }

      return {
        userdesc: member.userdesc,
        currentRole: member.role,
        suggestedRole,
        confidence,
        reasoning,
        metrics: {
          totalTasks,
          completedTasks,
          completionRate: parseFloat(completionRate.toFixed(1)),
          totalComplexity,
          avgComplexity: parseFloat(avgComplexity.toFixed(1))
        }
      };
    });

    res.json(suggestions);
  } catch (error) {
    console.error('Get role suggestions error:', error.message);
    res.status(500).json({ error: 'Failed to get role suggestions' });
  }
});

module.exports = router;
