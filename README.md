# School Contribution System (SCS)

A web-based system to help students and group leaders track individual contributions in academic group projects.

## Features

- User authentication (signup/login)
- Create and manage projects
- Add project members
- Create and assign tasks to members
- Track task status (Pending, In Progress, Completed)
- View contribution dashboards
- Member contribution tracking and statistics
- **Dispute handling system** - Raise and track collaboration concerns:
  - Uneven distribution (with automatic workload analysis)
  - Missed deadlines
  - Unclear task assignments
  - Conflicts with groupmates
  - Suggested actions and resolution tracking

## Tech Stack

- **Frontend:** React.js with Vite
- **Backend:** Express.js
- **Database:** Supabase PostgreSQL (via REST API)
- **Deployment:** Vercel-ready

## Project Structure

```
ITISDEV MCO/
├── frontend/           # React/Vite frontend
│   ├── src/
│   │   ├── components/ # Reusable components
│   │   ├── pages/      # Page components
│   │   ├── context/    # React context (auth)
│   │   └── utils/      # API utilities
│   ├── package.json
│   └── vite.config.js
├── backend/            # Express.js backend
│   ├── routes/         # API routes
│   ├── utils/          # Helper utilities
│   ├── server.js       # Main server file
│   ├── seed.js         # Sample data seeder
│   └── package.json
└── README.md
```

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn
- A Supabase account with the database tables created

## Database Setup

Ensure your Supabase database has the following tables:

### mf_users
- recid (BIGINT, identity, primary key)
- fname (VARCHAR 100)
- lname (VARCHAR 100)
- userdesc (VARCHAR 100, UNIQUE NOT NULL)
- usertype (VARCHAR 100)
- password (VARCHAR 200)
- email (VARCHAR 100)

### projects
- recid (BIGINT, identity, primary key)
- project_id (VARCHAR 100, UNIQUE NOT NULL)
- project_name (VARCHAR 100, NOT NULL)
- created_by_userdesc (VARCHAR 100, NOT NULL)
- created_at (TIMESTAMP, DEFAULT NOW())

### projects_members
- recid (BIGINT, identity, primary key)
- project_id (VARCHAR 100, NOT NULL)
- userdesc (VARCHAR 100, NOT NULL)
- role (VARCHAR 100)

### project_tasks
- recid (BIGINT, identity, primary key)
- project_id (VARCHAR 100, NOT NULL)
- task_id (VARCHAR 100, UNIQUE NOT NULL)
- task_description (VARCHAR 100)
- task_date_deadline (TIMESTAMP)
- task_date_created (TIMESTAMP, DEFAULT NOW())
- status (VARCHAR 100)

### project_task_assignees
- recid (BIGINT, identity, primary key)
- task_assignees_id (VARCHAR 100, UNIQUE NOT NULL)
- task_id (VARCHAR 100, NOT NULL)
- userdesc (VARCHAR 100, NOT NULL)
- task_date_finished (TIMESTAMP)
- status (VARCHAR 100)
- remarks (VARCHAR 100)

### disputes
- recid (BIGINT, identity, primary key)
- dispute_id (VARCHAR 100, UNIQUE NOT NULL)
- project_id (VARCHAR 100, NOT NULL)
- raised_by_userdesc (VARCHAR 100, NOT NULL)
- dispute_type (VARCHAR 100, NOT NULL)
- sub_type (VARCHAR 100)
- description (TEXT, NOT NULL)
- supporting_context (TEXT)
- related_member_userdesc (VARCHAR 100)
- suggested_action (TEXT)
- distribution_analysis (TEXT)
- resolution_choice (VARCHAR 100)
- resolution_notes (TEXT)
- status (VARCHAR 50, DEFAULT 'Ongoing')
- created_at (TIMESTAMP, DEFAULT NOW())
- resolved_at (TIMESTAMP)

**Note:** Run the SQL file `backend/database-schema-disputes.sql` in your Supabase SQL editor to create this table.

## Local Development Setup

### 1. Clone and Install Dependencies

```bash
# Navigate to the project folder
cd "ITISDEV MCO"

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Configure Environment Variables

#### Backend (.env)

Create `backend/.env` from the example:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
PORT=5000
SUPABASE_URL=https://your-project.supabase.co/rest/v1
SUPABASE_ANON_KEY=your-supabase-anon-key
SESSION_SECRET=your-random-secret-string-here
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

#### Frontend (.env)

Create `frontend/.env` from the example:

```bash
cd frontend
cp .env.example .env
```

For local development, the default settings work (uses Vite proxy).

### 3. Seed Sample Data (Optional but Recommended)

```bash
cd backend
npm run seed
```

This creates demo accounts and sample data. Demo credentials:
- Email: john.cruz@demo.com (Password: demo123)
- Email: mary.santos@demo.com (Password: demo123)
- Email: carl.reyes@demo.com (Password: demo123)
- Email: lennard.lee@demo.com (Password: demo123)
- Email: sarah.lee@demo.com (Password: demo123)

### 4. Run the Application

Open two terminals:

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
Backend runs on http://localhost:5000

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Frontend runs on http://localhost:5173

### 5. Access the Application

Open http://localhost:5173 in your browser.

## Vercel Deployment

### Deploy Backend

1. Create a new Vercel project and import the `backend` folder
2. Add environment variables in Vercel Project Settings:
   - `SUPABASE_URL` - Your Supabase REST API URL
   - `SUPABASE_ANON_KEY` - Your Supabase anon key
   - `SESSION_SECRET` - A random secret string
   - `FRONTEND_URL` - Your frontend Vercel URL (after deploying frontend)
   - `NODE_ENV` - Set to `production`
3. Deploy

### Deploy Frontend

1. Create a new Vercel project and import the `frontend` folder
2. Add environment variables in Vercel Project Settings:
   - `VITE_API_BASE_URL` - Your backend Vercel URL + `/api` (e.g., `https://your-backend.vercel.app/api`)
3. Deploy

### Post-Deployment

1. Update the backend's `FRONTEND_URL` to your deployed frontend URL
2. Redeploy the backend
3. Test login, signup, dashboard, and all features

## Environment Variables Reference

### Backend

| Variable | Description | Example |
|----------|-------------|---------|
| PORT | Server port | 5000 |
| SUPABASE_URL | Supabase REST API URL | https://xxx.supabase.co/rest/v1 |
| SUPABASE_ANON_KEY | Supabase publishable key | eyJhbG... |
| SESSION_SECRET | Session encryption key | random-string |
| FRONTEND_URL | Frontend URL for CORS | http://localhost:5173 |
| NODE_ENV | Environment mode | development or production |

### Frontend

| Variable | Description | Example |
|----------|-------------|---------|
| VITE_API_BASE_URL | Backend API URL | /api or https://api.example.com/api |

## ID Format

The system generates IDs with the following format:

- Users: `USR-000001`, `USR-000002`, ...
- Projects: `PJT-000001`, `PJT-000002`, ...
- Tasks: `TSK-000001`, `TSK-000002`, ...
- Task Assignees: `TAA-000001`, `TAA-000002`, ...
- Disputes: `DIS-000001`, `DIS-000002`, ...

These IDs are auto-generated and cannot be edited.

## Security Features

- Passwords are hashed using bcrypt
- Session-based authentication
- Input validation and sanitization
- CORS protection
- XSS prevention through output escaping
- Permission checks for all protected operations
- Environment variables for sensitive configuration

## Troubleshooting

### CORS Errors
- Ensure `FRONTEND_URL` in backend matches your frontend URL
- Check that both are using HTTPS in production

### Session Not Persisting
- Ensure cookies are enabled
- Check `SESSION_SECRET` is set
- In production, ensure `NODE_ENV=production`

### Database Connection Issues
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- Check Supabase project is active
- Ensure tables are created with correct schema

### Build Errors
- Run `npm install` in both frontend and backend
- Check Node.js version (v18+ recommended)
- Clear npm cache: `npm cache clean --force`

## License

This project is for educational purposes.
"# ITISDEVMCO" 
