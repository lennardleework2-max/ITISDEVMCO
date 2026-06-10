require('dotenv').config();
const bcrypt = require('bcryptjs');
const { select, insert } = require('./utils/supabase');

// Sample data
const sampleUsers = [
  { fname: 'John', lname: 'Cruz', email: 'john.cruz@demo.com', usertype: 'Student' },
  { fname: 'Mary', lname: 'Santos', email: 'mary.santos@demo.com', usertype: 'Student' },
  { fname: 'Carl', lname: 'Reyes', email: 'carl.reyes@demo.com', usertype: 'Student' },
  { fname: 'Lennard', lname: 'Lee', email: 'lennard.lee@demo.com', usertype: 'Student' },
  { fname: 'Sarah', lname: 'Lee', email: 'sarah.lee@demo.com', usertype: 'Student' }
];

const sampleProjects = [
  { project_name: 'Database Management System', ownerIndex: 0 },
  { project_name: 'AI Research Paper', ownerIndex: 3 }
];

const sampleTasks = [
  // Project 1 tasks
  { projectIndex: 0, task_description: 'Research database technologies', deadline: 7, status: 'Completed' },
  { projectIndex: 0, task_description: 'Create ERD diagram', deadline: 14, status: 'Completed' },
  { projectIndex: 0, task_description: 'Design database schema', deadline: 21, status: 'In Progress' },
  { projectIndex: 0, task_description: 'Implement backend API', deadline: 28, status: 'In Progress' },
  { projectIndex: 0, task_description: 'Write documentation', deadline: 35, status: 'Pending' },
  // Project 2 tasks
  { projectIndex: 1, task_description: 'Literature review', deadline: 10, status: 'Completed' },
  { projectIndex: 1, task_description: 'Data collection', deadline: 20, status: 'In Progress' },
  { projectIndex: 1, task_description: 'Model training', deadline: 30, status: 'Pending' },
  { projectIndex: 1, task_description: 'Results analysis', deadline: 40, status: 'Pending' },
  { projectIndex: 1, task_description: 'Final presentation', deadline: 50, status: 'Pending' }
];

// Remarks for completed/in-progress work
const sampleRemarks = [
  'Completed initial research on SQL and NoSQL databases',
  'Created ERD diagram using draw.io',
  'Prepared final slides for presentation',
  'Fixed database errors in schema design',
  'Wrote literature review section',
  'Collected survey responses from 50 participants',
  'Implemented backend REST API endpoints',
  'Trained initial ML model with 80% accuracy'
];

async function generateNextId(table, column, prefix) {
  try {
    const query = `select=${column}&${column}=like.${prefix}-*&order=${column}.desc&limit=1`;
    const results = await select(table, query);

    if (results && results.length > 0) {
      const lastId = results[0][column];
      const numPart = parseInt(lastId.split('-')[1], 10);
      return `${prefix}-${String(numPart + 1).padStart(6, '0')}`;
    }
    return `${prefix}-000001`;
  } catch (error) {
    return `${prefix}-000001`;
  }
}

async function seed() {
  console.log('Starting seed process...\n');

  try {
    // Check if seed data already exists
    const existingUsers = await select('mf_users', 'email=like.*@demo.com');
    if (existingUsers && existingUsers.length > 0) {
      console.log('Sample data already exists. Skipping seed to prevent duplicates.');
      console.log('Existing demo users:', existingUsers.map(u => u.email).join(', '));
      return;
    }

    // Hash password for all demo users (same password for simplicity)
    const demoPassword = await bcrypt.hash('demo123', 10);

    // Create users
    console.log('Creating users...');
    const createdUsers = [];
    for (const user of sampleUsers) {
      const userdesc = await generateNextId('mf_users', 'userdesc', 'USR');
      const newUser = await insert('mf_users', {
        ...user,
        userdesc,
        password: demoPassword
      });
      createdUsers.push(newUser[0]);
      console.log(`  Created user: ${user.fname} ${user.lname} (${userdesc})`);
    }

    // Create projects
    console.log('\nCreating projects...');
    const createdProjects = [];
    for (const project of sampleProjects) {
      const project_id = await generateNextId('projects', 'project_id', 'PJT');
      const owner = createdUsers[project.ownerIndex];

      const newProject = await insert('projects', {
        project_id,
        project_name: project.project_name,
        created_by_userdesc: owner.userdesc
      });
      createdProjects.push({ ...newProject[0], ownerIndex: project.ownerIndex });
      console.log(`  Created project: ${project.project_name} (${project_id})`);

      // Add owner as member
      await insert('projects_members', {
        project_id,
        userdesc: owner.userdesc,
        role: 'Owner'
      });
      console.log(`    Added owner: ${owner.fname} ${owner.lname}`);
    }

    // Add members to projects
    console.log('\nAdding project members...');
    // Project 1: John (owner), Mary, Carl
    const project1Members = [1, 2]; // Mary, Carl
    for (const idx of project1Members) {
      const member = createdUsers[idx];
      await insert('projects_members', {
        project_id: createdProjects[0].project_id,
        userdesc: member.userdesc,
        role: 'Member'
      });
      console.log(`  Added ${member.fname} to ${createdProjects[0].project_name}`);
    }

    // Project 2: Lennard (owner), Sarah, John, Mary
    const project2Members = [4, 0, 1]; // Sarah, John, Mary
    for (const idx of project2Members) {
      const member = createdUsers[idx];
      await insert('projects_members', {
        project_id: createdProjects[1].project_id,
        userdesc: member.userdesc,
        role: 'Member'
      });
      console.log(`  Added ${member.fname} to ${createdProjects[1].project_name}`);
    }

    // Create tasks
    console.log('\nCreating tasks...');
    const createdTasks = [];
    for (const task of sampleTasks) {
      const project = createdProjects[task.projectIndex];
      const task_id = await generateNextId('project_tasks', 'task_id', 'TSK');
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + task.deadline);

      const newTask = await insert('project_tasks', {
        project_id: project.project_id,
        task_id,
        task_description: task.task_description,
        task_date_deadline: deadline.toISOString(),
        status: task.status
      });
      createdTasks.push({ ...newTask[0], projectIndex: task.projectIndex });
      console.log(`  Created task: ${task.task_description} (${task_id})`);
    }

    // Assign tasks to members
    console.log('\nAssigning tasks to members...');

    // Project 1 task assignments
    const p1Assignments = [
      { taskIdx: 0, users: [0, 1], statuses: ['Completed', 'Completed'], remarks: [sampleRemarks[0], sampleRemarks[0]] },
      { taskIdx: 1, users: [0, 2], statuses: ['Completed', 'Completed'], remarks: [sampleRemarks[1], sampleRemarks[1]] },
      { taskIdx: 2, users: [1, 2], statuses: ['In Progress', 'Completed'], remarks: [null, sampleRemarks[3]] },
      { taskIdx: 3, users: [0, 1, 2], statuses: ['In Progress', 'In Progress', 'Pending'], remarks: [sampleRemarks[6], null, null] },
      { taskIdx: 4, users: [1], statuses: ['Pending'], remarks: [null] }
    ];

    for (const assignment of p1Assignments) {
      const task = createdTasks[assignment.taskIdx];
      for (let i = 0; i < assignment.users.length; i++) {
        const user = createdUsers[assignment.users[i]];
        const task_assignees_id = await generateNextId('project_task_assignees', 'task_assignees_id', 'TAA');

        const assigneeData = {
          task_assignees_id,
          task_id: task.task_id,
          userdesc: user.userdesc,
          status: assignment.statuses[i],
          remarks: assignment.remarks[i]
        };

        if (assignment.statuses[i] === 'Completed') {
          const finishedDate = new Date();
          finishedDate.setDate(finishedDate.getDate() - Math.floor(Math.random() * 7));
          assigneeData.task_date_finished = finishedDate.toISOString();
        }

        await insert('project_task_assignees', assigneeData);
        console.log(`  Assigned ${user.fname} to "${task.task_description}" (${assignment.statuses[i]})`);
      }
    }

    // Project 2 task assignments
    const p2Assignments = [
      { taskIdx: 5, users: [3, 4], statuses: ['Completed', 'Completed'], remarks: [sampleRemarks[4], sampleRemarks[4]] },
      { taskIdx: 6, users: [0, 4], statuses: ['Completed', 'In Progress'], remarks: [sampleRemarks[5], null] },
      { taskIdx: 7, users: [3, 1], statuses: ['Pending', 'Pending'], remarks: [null, null] },
      { taskIdx: 8, users: [3, 4, 0], statuses: ['Pending', 'Pending', 'Pending'], remarks: [null, null, null] },
      { taskIdx: 9, users: [1, 3, 4], statuses: ['Pending', 'Pending', 'Pending'], remarks: [null, null, null] }
    ];

    for (const assignment of p2Assignments) {
      const task = createdTasks[assignment.taskIdx];
      for (let i = 0; i < assignment.users.length; i++) {
        const user = createdUsers[assignment.users[i]];
        const task_assignees_id = await generateNextId('project_task_assignees', 'task_assignees_id', 'TAA');

        const assigneeData = {
          task_assignees_id,
          task_id: task.task_id,
          userdesc: user.userdesc,
          status: assignment.statuses[i],
          remarks: assignment.remarks[i]
        };

        if (assignment.statuses[i] === 'Completed') {
          const finishedDate = new Date();
          finishedDate.setDate(finishedDate.getDate() - Math.floor(Math.random() * 7));
          assigneeData.task_date_finished = finishedDate.toISOString();
        }

        await insert('project_task_assignees', assigneeData);
        console.log(`  Assigned ${user.fname} to "${task.task_description}" (${assignment.statuses[i]})`);
      }
    }

    console.log('\n========================================');
    console.log('Seed completed successfully!');
    console.log('========================================\n');
    console.log('Demo accounts (password for all: demo123):');
    for (const user of createdUsers) {
      console.log(`  - ${user.email}`);
    }
    console.log('\nYou can now log in with any of these accounts.');

  } catch (error) {
    console.error('Seed error:', error.message);
    process.exit(1);
  }
}

seed();
