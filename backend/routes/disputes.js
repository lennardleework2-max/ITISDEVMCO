const express = require('express');
const router = express.Router();
const { select, insert, update } = require('../utils/supabase');
const { generateDisputeId } = require('../utils/idGenerator');
const { sanitizeString } = require('../utils/validation');

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

// Get suggested action based on dispute type
function getSuggestedAction(disputeType, subType = null) {
  const actions = {
    'Uneven Distribution': 'System will analyze task complexity and suggest a better workload distribution among members.',
    'Missed Deadline': 'Consider messaging the professor for deadline reconsideration. An email template will be provided.',
    'Unclear Task Assignment': 'Suggest scheduling a group meeting for clarity. An email notification will be sent to all members.',
    'Conflict - Unresponsive': 'System suggests sending a respectful private message first. If no response after 48 hours, you may escalate to the professor.',
    'Conflict - Uneven Distribution': 'This will be redirected to the Uneven Distribution dispute type for workload analysis.',
    'Conflict - Missed Deadline': 'System will ask if the delay was communicated. Suggests extension request or professor escalation.',
    'Conflict - Different Quality Expectation': 'System suggests clarifying expected output, adding revision notes, or requesting professor guidance.',
    'Conflict - Others': 'You can describe the situation and choose to resolve within the group or escalate to the professor with an email template.'
  };

  if (disputeType === 'Conflict with Groupmate' && subType) {
    return actions[`Conflict - ${subType}`] || actions['Conflict - Others'];
  }

  return actions[disputeType] || 'Please provide details about the dispute for review.';
}

// Calculate uneven distribution suggestion based on complexity/difficulty
async function calculateUnevenDistribution(projectId) {
  try {
    // Get all project members
    const members = await select('projects_members', `project_id=eq.${projectId}`);

    // Get all tasks with difficulty
    const tasks = await select('project_tasks', `project_id=eq.${projectId}`);

    if (!tasks || tasks.length === 0) {
      return {
        suggestion: 'No tasks have been created yet. Create tasks first to analyze distribution.',
        currentDistribution: [],
        totalComplexity: 0,
        fairComplexity: 0,
        memberCount: members.length
      };
    }

    // Get all task assignments
    const taskIds = tasks.map(t => `"${t.task_id}"`).join(',');
    const assignments = await select('project_task_assignees', `task_id=in.(${taskIds})`);

    // Get user details
    const memberUserdescs = members.map(m => m.userdesc);
    const userdescsQuery = memberUserdescs.map(u => `"${u}"`).join(',');
    const users = await select('mf_users', `userdesc=in.(${userdescsQuery})&select=userdesc,fname,lname`);

    // Calculate total complexity of all tasks
    const totalComplexity = tasks.reduce((sum, task) => sum + (task.difficulty || 5), 0);
    const fairComplexity = Math.round(totalComplexity / memberUserdescs.length);

    // Calculate current complexity per member
    const workload = memberUserdescs.map(userdesc => {
      const user = users.find(u => u.userdesc === userdesc);
      const assignedTaskIds = (assignments || [])
        .filter(a => a.userdesc === userdesc)
        .map(a => a.task_id);

      // Get tasks assigned to this member
      const memberTasks = tasks.filter(t => assignedTaskIds.includes(t.task_id));

      // Sum up difficulty
      const totalDifficulty = memberTasks.reduce((sum, task) => sum + (task.difficulty || 5), 0);

      return {
        userdesc,
        name: user ? `${user.fname} ${user.lname}` : userdesc,
        assignedCount: memberTasks.length,
        totalComplexity: totalDifficulty,
        completedCount: memberTasks.filter(t =>
          (assignments || []).find(a => a.task_id === t.task_id && a.userdesc === userdesc && a.status === 'Completed')
        ).length,
        pendingCount: memberTasks.filter(t =>
          (assignments || []).find(a => a.task_id === t.task_id && a.userdesc === userdesc && a.status === 'Pending')
        ).length
      };
    });

    // Find members who are overloaded or underloaded based on complexity
    const threshold = fairComplexity * 0.2; // 20% tolerance
    const overloaded = workload.filter(w => w.totalComplexity > fairComplexity + threshold);
    const underloaded = workload.filter(w => w.totalComplexity < fairComplexity - threshold);

    let suggestion = '';
    if (overloaded.length === 0 && underloaded.length === 0) {
      suggestion = 'Complexity distribution is fair. Each member has approximately equal workload based on task difficulty.';
    } else {
      suggestion = `Fair distribution: ~${fairComplexity} complexity points per member. `;
      if (overloaded.length > 0) {
        const overloadedDetails = overloaded.map(m => `${m.name} (${m.totalComplexity} pts)`).join(', ');
        suggestion += `Overloaded: ${overloadedDetails}. `;
      }
      if (underloaded.length > 0) {
        const underloadedDetails = underloaded.map(m => `${m.name} (${m.totalComplexity} pts)`).join(', ');
        suggestion += `Can take more: ${underloadedDetails}.`;
      }
    }

    return {
      suggestion,
      totalComplexity,
      fairComplexity,
      memberCount: memberUserdescs.length,
      currentDistribution: workload
    };
  } catch (error) {
    console.error('Error calculating distribution:', error.message);
    return {
      suggestion: 'Unable to calculate distribution at this time.',
      currentDistribution: [],
      totalComplexity: 0,
      fairComplexity: 0,
      memberCount: 0
    };
  }
}

// Get complexity analysis for a project
router.get('/analysis/:projectId', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userdesc = req.session.user.userdesc;

    // Check access
    if (!(await isProjectMember(projectId, userdesc))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const analysis = await calculateUnevenDistribution(projectId);
    res.json(analysis);
  } catch (error) {
    console.error('Get analysis error:', error.message);
    res.status(500).json({ error: 'Failed to get complexity analysis' });
  }
});

// Get all disputes for a project
router.get('/project/:projectId', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userdesc = req.session.user.userdesc;

    // Check access
    if (!(await isProjectMember(projectId, userdesc))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get disputes
    const disputes = await select('disputes',
      `project_id=eq.${projectId}&order=created_at.desc`);

    if (!disputes || disputes.length === 0) {
      return res.json([]);
    }

    // Get user details for raised_by
    const userdescs = [...new Set(disputes.map(d => d.raised_by_userdesc))];
    const userdescsQuery = userdescs.map(u => `"${u}"`).join(',');
    const users = await select('mf_users', `userdesc=in.(${userdescsQuery})&select=userdesc,fname,lname`);

    const disputesWithDetails = disputes.map(d => {
      const user = users.find(u => u.userdesc === d.raised_by_userdesc);
      return {
        ...d,
        raised_by_name: user ? `${user.fname} ${user.lname}` : d.raised_by_userdesc
      };
    });

    res.json(disputesWithDetails);
  } catch (error) {
    console.error('Get disputes error:', error.message);
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

// Get single dispute
router.get('/:disputeId', requireAuth, async (req, res) => {
  try {
    const { disputeId } = req.params;
    const userdesc = req.session.user.userdesc;

    const disputes = await select('disputes', `dispute_id=eq.${disputeId}`);
    if (!disputes || disputes.length === 0) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    const dispute = disputes[0];

    // Check access
    if (!(await isProjectMember(dispute.project_id, userdesc))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get user details
    const user = await select('mf_users',
      `userdesc=eq.${dispute.raised_by_userdesc}&select=userdesc,fname,lname`);

    res.json({
      ...dispute,
      raised_by_name: user?.[0] ? `${user[0].fname} ${user[0].lname}` : dispute.raised_by_userdesc
    });
  } catch (error) {
    console.error('Get dispute error:', error.message);
    res.status(500).json({ error: 'Failed to fetch dispute' });
  }
});

// Create dispute
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      project_id,
      dispute_type,
      sub_type,
      description,
      supporting_context,
      related_member_userdesc,
      resolution_choice
    } = req.body;

    const userdesc = req.session.user.userdesc;

    // Validate
    if (!project_id || !dispute_type || !description) {
      return res.status(400).json({ error: 'Project ID, dispute type, and description are required' });
    }

    // Check if member
    if (!(await isProjectMember(project_id, userdesc))) {
      return res.status(403).json({ error: 'Only project members can raise disputes' });
    }

    const cleanDescription = sanitizeString(description);
    const cleanContext = supporting_context ? sanitizeString(supporting_context) : null;

    // Generate dispute ID
    const dispute_id = await generateDisputeId();

    // Get suggested action
    const suggested_action = getSuggestedAction(dispute_type, sub_type);

    // Calculate distribution if needed
    let distribution_analysis = null;
    if (dispute_type === 'Uneven Distribution' || sub_type === 'Uneven Distribution') {
      distribution_analysis = JSON.stringify(await calculateUnevenDistribution(project_id));
    }

    // Create dispute
    const newDispute = await insert('disputes', {
      dispute_id,
      project_id,
      raised_by_userdesc: userdesc,
      dispute_type,
      sub_type: sub_type || null,
      description: cleanDescription,
      supporting_context: cleanContext,
      related_member_userdesc: related_member_userdesc || null,
      suggested_action,
      distribution_analysis,
      resolution_choice: resolution_choice || 'Pending',
      status: 'Ongoing'
    });

    res.status(201).json({
      message: 'Dispute raised successfully',
      dispute: newDispute[0]
    });
  } catch (error) {
    console.error('Create dispute error:', error.message);
    res.status(500).json({ error: 'Failed to create dispute' });
  }
});

// Update dispute
router.patch('/:disputeId', requireAuth, async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { status, resolution_choice, resolution_notes } = req.body;
    const userdesc = req.session.user.userdesc;

    // Get dispute
    const disputes = await select('disputes', `dispute_id=eq.${disputeId}`);
    if (!disputes || disputes.length === 0) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    const dispute = disputes[0];

    // Check access
    if (!(await isProjectMember(dispute.project_id, userdesc))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updates = {};

    if (status !== undefined) {
      if (!['Ongoing', 'Resolved'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be Ongoing or Resolved' });
      }
      updates.status = status;
      if (status === 'Resolved' && !dispute.resolved_at) {
        updates.resolved_at = new Date().toISOString();
      }
    }

    if (resolution_choice !== undefined) {
      updates.resolution_choice = sanitizeString(resolution_choice);
    }

    if (resolution_notes !== undefined) {
      updates.resolution_notes = sanitizeString(resolution_notes);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const updated = await update('disputes', `dispute_id=eq.${disputeId}`, updates);
    res.json({ message: 'Dispute updated', dispute: updated[0] });
  } catch (error) {
    console.error('Update dispute error:', error.message);
    res.status(500).json({ error: 'Failed to update dispute' });
  }
});

module.exports = router;
