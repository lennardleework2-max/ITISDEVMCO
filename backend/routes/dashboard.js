const express = require('express');
const router = express.Router();
const { select } = require('../utils/supabase');

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Check if user is project member
async function isProjectMember(projectId, userdesc) {
  const membership = await select('projects_members',
    `project_id=eq.${projectId}&userdesc=eq.${userdesc}`);
  return membership && membership.length > 0;
}

// Get project dashboard stats
router.get('/project/:projectId', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userdesc = req.session.user.userdesc;

    console.log('=== PROJECT DASHBOARD REQUEST ===');
    console.log('Project ID:', projectId);
    console.log('User:', userdesc);

    // Check access
    const isMember = await isProjectMember(projectId, userdesc);
    console.log('Is member:', isMember);

    if (!isMember) {
      console.log('Access denied - user is not a project member');
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get project
    console.log('Querying projects table with:', `project_id=eq.${projectId}`);
    const projects = await select('projects', `project_id=eq.${projectId}`);
    console.log('Projects found:', projects ? projects.length : 0);

    if (!projects || projects.length === 0) {
      console.log('ERROR: Project not found in database');
      return res.status(404).json({ error: 'Project not found' });
    }

    console.log('Project data:', projects[0]);

    // Get members
    const members = await select('projects_members', `project_id=eq.${projectId}`);
    const memberUserdescs = members.map(m => m.userdesc);

    // Get user details
    let users = [];
    if (memberUserdescs.length > 0) {
      const userdescsQuery = memberUserdescs.map(u => `"${u}"`).join(',');
      users = await select('mf_users', `userdesc=in.(${userdescsQuery})&select=userdesc,fname,lname`);
    }

    // Get tasks
    const tasks = await select('project_tasks', `project_id=eq.${projectId}`);
    const taskIds = (tasks || []).map(t => t.task_id);

    // Get all assignees
    let assignees = [];
    if (taskIds.length > 0) {
      const taskIdsQuery = taskIds.map(t => `"${t}"`).join(',');
      assignees = await select('project_task_assignees', `task_id=in.(${taskIdsQuery})`);
    }

    // Calculate task stats
    const totalTasks = tasks?.length || 0;
    const completedTasks = (tasks || []).filter(t => t.status === 'Completed').length;
    const inProgressTasks = (tasks || []).filter(t => t.status === 'In Progress').length;
    const pendingTasks = (tasks || []).filter(t => t.status === 'Pending').length;
    const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Calculate member contributions
    const memberContributions = memberUserdescs.map(memberUserdesc => {
      const user = users.find(u => u.userdesc === memberUserdesc);
      const member = members.find(m => m.userdesc === memberUserdesc);

      const memberAssignments = (assignees || []).filter(a => a.userdesc === memberUserdesc);
      const assignedCount = memberAssignments.length;
      const completedCount = memberAssignments.filter(a => a.status === 'Completed').length;
      const memberCompletionPct = assignedCount > 0 ? Math.round((completedCount / assignedCount) * 100) : 0;

      // Contribution is based on completed tasks relative to total project assignments
      const totalAssignments = assignees?.length || 0;
      const contributionPct = totalAssignments > 0 ? Math.round((completedCount / totalAssignments) * 100) : 0;

      return {
        userdesc: memberUserdesc,
        fname: user?.fname || '',
        lname: user?.lname || '',
        fullName: user ? `${user.fname} ${user.lname}` : memberUserdesc,
        role: member?.role || 'Member',
        assignedTasks: assignedCount,
        completedTasks: completedCount,
        completionPercentage: memberCompletionPct,
        contributionPercentage: contributionPct
      };
    });

    // Task list with details
    const taskList = (tasks || []).map(task => {
      const taskAssignees = (assignees || []).filter(a => a.task_id === task.task_id);
      const assigneeDetails = taskAssignees.map(a => {
        const user = users.find(u => u.userdesc === a.userdesc);
        return {
          userdesc: a.userdesc,
          fullName: user ? `${user.fname} ${user.lname}` : a.userdesc,
          status: a.status
        };
      });

      return {
        task_id: task.task_id,
        task_description: task.task_description,
        status: task.status,
        task_date_deadline: task.task_date_deadline,
        task_date_created: task.task_date_created,
        assignees: assigneeDetails,
        assigneeCount: taskAssignees.length,
        completedAssignees: taskAssignees.filter(a => a.status === 'Completed').length
      };
    });

    res.json({
      project: projects[0],
      stats: {
        totalMembers: members?.length || 0,
        totalTasks,
        completedTasks,
        inProgressTasks,
        pendingTasks,
        completionPercentage
      },
      memberContributions,
      tasks: taskList
    });
  } catch (error) {
    console.error('Dashboard error:', error.message);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Get outliers for a project (late submissions, missed deadlines, low performers, etc.)
router.get('/outliers/:projectId', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userdesc = req.session.user.userdesc;

    // Check access
    if (!(await isProjectMember(projectId, userdesc))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all tasks with assignees
    const tasks = await select('project_tasks', `project_id=eq.${projectId}`);
    const taskIds = (tasks || []).map(t => t.task_id);

    let assignees = [];
    if (taskIds.length > 0) {
      const taskIdsQuery = taskIds.map(t => `"${t}"`).join(',');
      assignees = await select('project_task_assignees', `task_id=in.(${taskIdsQuery})`);
    }

    // Get members
    const members = await select('projects_members', `project_id=eq.${projectId}`);
    const memberUserdescs = members.map(m => m.userdesc);

    // Get user details
    let users = [];
    if (memberUserdescs.length > 0) {
      const userdescsQuery = memberUserdescs.map(u => `"${u}"`).join(',');
      users = await select('mf_users', `userdesc=in.(${userdescsQuery})&select=userdesc,fname,lname`);
    }

    const outliers = [];
    const now = new Date();

    // 1. Detect overdue tasks (past deadline and not completed)
    const overdueTasks = (tasks || []).filter(task => {
      if (!task.task_date_deadline || task.status === 'Completed') return false;
      const deadline = new Date(task.task_date_deadline);
      return deadline < now;
    });

    overdueTasks.forEach(task => {
      const taskAssignees = (assignees || []).filter(a => a.task_id === task.task_id);
      taskAssignees.forEach(assignee => {
        const user = users.find(u => u.userdesc === assignee.userdesc);
        const daysPastDue = Math.floor((now - new Date(task.task_date_deadline)) / (1000 * 60 * 60 * 24));

        outliers.push({
          type: 'overdue_task',
          severity: daysPastDue > 7 ? 'high' : daysPastDue > 3 ? 'medium' : 'low',
          member: {
            userdesc: assignee.userdesc,
            name: user ? `${user.fname} ${user.lname}` : assignee.userdesc
          },
          task: {
            task_id: task.task_id,
            description: task.task_description,
            deadline: task.task_date_deadline
          },
          message: `${user ? user.fname + ' ' + user.lname : assignee.userdesc} has overdue task "${task.task_description}" (${daysPastDue} days past due)`,
          daysPastDue
        });
      });
    });

    // 2. Calculate completion rates and detect low performers
    const memberStats = memberUserdescs.map(memberUserdesc => {
      const user = users.find(u => u.userdesc === memberUserdesc);
      const memberAssignments = (assignees || []).filter(a => a.userdesc === memberUserdesc);
      const totalTasks = memberAssignments.length;
      const completedTasks = memberAssignments.filter(a => a.status === 'Completed').length;
      const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      return {
        userdesc: memberUserdesc,
        name: user ? `${user.fname} ${user.lname}` : memberUserdesc,
        totalTasks,
        completedTasks,
        completionRate
      };
    });

    const avgCompletionRate = memberStats.reduce((sum, m) => sum + m.completionRate, 0) / memberStats.length || 0;

    // Low performers: completion rate < 50% and significantly below average
    memberStats.forEach(member => {
      if (member.totalTasks > 0 && member.completionRate < 50 && member.completionRate < avgCompletionRate - 20) {
        outliers.push({
          type: 'low_performance',
          severity: member.completionRate < 30 ? 'high' : 'medium',
          member: {
            userdesc: member.userdesc,
            name: member.name
          },
          message: `${member.name} has low completion rate (${member.completionRate.toFixed(0)}% vs team avg ${avgCompletionRate.toFixed(0)}%)`,
          completionRate: member.completionRate,
          teamAverage: avgCompletionRate
        });
      }
    });

    // 3. Detect inactive members (0 completed tasks but have assigned tasks)
    memberStats.forEach(member => {
      if (member.totalTasks > 0 && member.completedTasks === 0) {
        outliers.push({
          type: 'inactive_member',
          severity: member.totalTasks >= 5 ? 'high' : 'medium',
          member: {
            userdesc: member.userdesc,
            name: member.name
          },
          message: `${member.name} has ${member.totalTasks} assigned tasks but 0 completed`,
          assignedTasks: member.totalTasks
        });
      }
    });

    // 4. Detect workload imbalance (members with significantly more work than others)
    const taskComplexities = memberStats.map(member => {
      const memberTaskIds = (assignees || [])
        .filter(a => a.userdesc === member.userdesc)
        .map(a => a.task_id);
      const memberTasks = (tasks || []).filter(t => memberTaskIds.includes(t.task_id));
      const totalComplexity = memberTasks.reduce((sum, task) => sum + (task.difficulty || 5), 0);

      return {
        ...member,
        totalComplexity
      };
    });

    const avgComplexity = taskComplexities.reduce((sum, m) => sum + m.totalComplexity, 0) / taskComplexities.length || 0;

    taskComplexities.forEach(member => {
      if (member.totalComplexity > avgComplexity * 1.5 && member.totalComplexity > 20) {
        outliers.push({
          type: 'overloaded',
          severity: member.totalComplexity > avgComplexity * 2 ? 'high' : 'medium',
          member: {
            userdesc: member.userdesc,
            name: member.name
          },
          message: `${member.name} is overloaded with ${member.totalComplexity} complexity points (team avg: ${avgComplexity.toFixed(0)})`,
          complexity: member.totalComplexity,
          teamAverage: avgComplexity
        });
      }
    });

    // Sort by severity (high first)
    const severityOrder = { high: 0, medium: 1, low: 2 };
    outliers.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    res.json({
      total: outliers.length,
      outliers
    });
  } catch (error) {
    console.error('Get outliers error:', error.message);
    res.status(500).json({ error: 'Failed to get outliers' });
  }
});

// Get user's overall dashboard
router.get('/user', requireAuth, async (req, res) => {
  try {
    const userdesc = req.session.user.userdesc;

    // Get user's projects
    const memberships = await select('projects_members', `userdesc=eq.${userdesc}`);

    if (!memberships || memberships.length === 0) {
      return res.json({
        totalProjects: 0,
        ownedProjects: 0,
        totalAssignedTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        inProgressTasks: 0,
        projects: []
      });
    }

    const projectIds = memberships.map(m => m.project_id);
    const projectsQuery = `project_id=in.(${projectIds.map(id => `"${id}"`).join(',')})`;
    const projects = await select('projects', projectsQuery);

    // Get all tasks from user's projects
    const tasks = await select('project_tasks', projectsQuery);
    const taskIds = (tasks || []).map(t => t.task_id);

    // Get user's assignments
    let userAssignments = [];
    if (taskIds.length > 0) {
      const taskIdsQuery = taskIds.map(t => `"${t}"`).join(',');
      userAssignments = await select('project_task_assignees',
        `task_id=in.(${taskIdsQuery})&userdesc=eq.${userdesc}`);
    }

    const ownedProjects = memberships.filter(m => m.role === 'Owner').length;
    const totalAssignedTasks = userAssignments.length;
    const completedTasks = userAssignments.filter(a => a.status === 'Completed').length;
    const inProgressTasks = userAssignments.filter(a => a.status === 'In Progress').length;
    const pendingTasks = userAssignments.filter(a => a.status === 'Pending').length;

    // Project summaries
    const projectSummaries = (projects || []).map(p => {
      const projectTasks = (tasks || []).filter(t => t.project_id === p.project_id);
      const membership = memberships.find(m => m.project_id === p.project_id);
      return {
        project_id: p.project_id,
        project_name: p.project_name,
        role: membership?.role || 'Member',
        totalTasks: projectTasks.length,
        completedTasks: projectTasks.filter(t => t.status === 'Completed').length
      };
    });

    res.json({
      totalProjects: projects?.length || 0,
      ownedProjects,
      totalAssignedTasks,
      completedTasks,
      pendingTasks,
      inProgressTasks,
      projects: projectSummaries
    });
  } catch (error) {
    console.error('User dashboard error:', error.message);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

module.exports = router;
