const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { select, insert } = require('../utils/supabase');
const { generateUserId } = require('../utils/idGenerator');
const { sanitizeString, isValidEmail, isValidPassword, validateRequired } = require('../utils/validation');

// Sign up
router.post('/signup', async (req, res) => {
  try {
    const { fname, lname, email, password, usertype } = req.body;

    // Validate required fields
    const missing = validateRequired(req.body, ['fname', 'lname', 'email', 'password']);
    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    // Sanitize inputs
    const cleanFname = sanitizeString(fname);
    const cleanLname = sanitizeString(lname);
    const cleanEmail = sanitizeString(email).toLowerCase();
    const cleanUsertype = sanitizeString(usertype) || 'Student';

    // Validate email format
    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password
    if (!isValidPassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if email already exists
    const existingUsers = await select('mf_users', `email=eq.${encodeURIComponent(cleanEmail)}`);
    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Generate user ID
    const userdesc = await generateUserId();

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const newUser = await insert('mf_users', {
      fname: cleanFname,
      lname: cleanLname,
      userdesc,
      usertype: cleanUsertype,
      password: hashedPassword,
      email: cleanEmail
    });

    if (newUser && newUser.length > 0) {
      // Set session
      req.session.user = {
        userdesc: newUser[0].userdesc,
        fname: newUser[0].fname,
        lname: newUser[0].lname,
        email: newUser[0].email,
        usertype: newUser[0].usertype
      };

      res.status(201).json({
        message: 'Account created successfully',
        user: req.session.user
      });
    } else {
      res.status(500).json({ error: 'Failed to create account' });
    }
  } catch (error) {
    console.error('Signup error:', error.message);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = sanitizeString(email).toLowerCase();

    // Find user by email
    const users = await select('mf_users', `email=eq.${encodeURIComponent(cleanEmail)}`);

    if (!users || users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Set session
    req.session.user = {
      userdesc: user.userdesc,
      fname: user.fname,
      lname: user.lname,
      email: user.email,
      usertype: user.usertype
    };

    res.json({
      message: 'Login successful',
      user: req.session.user
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// Get current user session
router.get('/me', (req, res) => {
  if (req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

module.exports = router;
