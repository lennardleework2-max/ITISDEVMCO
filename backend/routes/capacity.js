const express = require('express');
const router = express.Router();
const { select, insert, update } = require('../utils/supabase');
const { sanitizeString } = require('../utils/validation');

// Middleware to check authentication
function requireAuth(req, res, next) {
  if (!req.session?.user?.userdesc) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Check if user is a member of the project
async function isProjectMember(projectId, userdesc) {
  const member = await select('projects_members',
    `project_id=eq.${projectId}&userdesc=eq.${userdesc}`);
  return member && member.length > 0;
}

// GET /api/capacity/:projectId - Get all members' capacity info for a project
router.get('/:projectId', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { userdesc } = req.session.user;

    // Verify user is a member of this project
    const isMember = await isProjectMember(projectId, userdesc);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all capacity info for this project with user details
    const capacities = await select('member_capacity', `project_id=eq.${projectId}`);

    // Enrich with user details
    const enriched = await Promise.all((capacities || []).map(async (cap) => {
      const userResult = await select('mf_users', `userdesc=eq.${cap.userdesc}`);
      const user = userResult?.[0];
      return {
        ...cap,
        fullName: user ? `${user.fname} ${user.lname}` : cap.userdesc
      };
    }));

    res.json(enriched);
  } catch (err) {
    console.error('Get capacity error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve capacity information' });
  }
});

// GET /api/capacity/:projectId/:userdesc - Get specific member's capacity
router.get('/:projectId/:userdesc', requireAuth, async (req, res) => {
  try {
    const { projectId, userdesc } = req.params;
    const currentUser = req.session.user.userdesc;

    // Verify current user is a member of this project
    const isMember = await isProjectMember(projectId, currentUser);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const capacity = await select('member_capacity',
      `project_id=eq.${projectId}&userdesc=eq.${userdesc}`);

    if (!capacity || capacity.length === 0) {
      return res.status(404).json({ error: 'Capacity information not found' });
    }

    res.json(capacity[0]);
  } catch (err) {
    console.error('Get member capacity error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve capacity information' });
  }
});

// POST /api/capacity/:projectId - Create or update capacity info for current user
router.post('/:projectId', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { userdesc } = req.session.user;
    const {
      internship,
      organizations,
      other_school_work,
      personal_responsibilities,
      availability_hours_per_week,
      notes
    } = req.body;

    // Verify user is a member of this project
    const isMember = await isProjectMember(projectId, userdesc);
    if (!isMember) {
      return res.status(403).json({ error: 'You must be a project member to set capacity' });
    }

    // Validate availability hours
    if (availability_hours_per_week !== undefined && availability_hours_per_week !== null && availability_hours_per_week !== '') {
      const hours = parseInt(availability_hours_per_week);
      if (isNaN(hours) || hours < 0 || hours > 168) {
        return res.status(400).json({ error: 'Availability hours must be between 0 and 168' });
      }
    }

    // Check if capacity info already exists
    const existing = await select('member_capacity',
      `project_id=eq.${projectId}&userdesc=eq.${userdesc}`);

    const capacityData = {
      project_id: projectId,
      userdesc: userdesc,
      internship: sanitizeString(internship) || null,
      organizations: sanitizeString(organizations) || null,
      other_school_work: sanitizeString(other_school_work) || null,
      personal_responsibilities: sanitizeString(personal_responsibilities) || null,
      availability_hours_per_week: availability_hours_per_week || null,
      notes: sanitizeString(notes) || null,
      updated_at: new Date().toISOString()
    };

    let result;
    if (existing && existing.length > 0) {
      // Update existing record
      result = await update('member_capacity',
        `project_id=eq.${projectId}&userdesc=eq.${userdesc}`,
        capacityData);
    } else {
      // Insert new record
      result = await insert('member_capacity', capacityData);
    }

    res.json({
      message: 'Capacity information saved successfully',
      data: result?.[0] || capacityData
    });
  } catch (err) {
    console.error('Save capacity error:', err.message);
    res.status(500).json({ error: 'Failed to save capacity information' });
  }
});

// PATCH /api/capacity/:projectId - Update capacity info (same as POST for convenience)
router.patch('/:projectId', requireAuth, async (req, res) => {
  // Reuse POST handler
  return router.stack.find(r => r.route?.path === '/:projectId' && r.route?.methods?.post)
    .route.stack[0].handle(req, res);
});

module.exports = router;
