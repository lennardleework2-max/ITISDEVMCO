-- Member Capacity and Responsibilities table schema for Supabase PostgreSQL
-- Add this table to your Supabase database

CREATE TABLE member_capacity (
  recid BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id VARCHAR(100) NOT NULL,
  userdesc VARCHAR(100) NOT NULL,
  internship TEXT,
  organizations TEXT,
  other_school_work TEXT,
  personal_responsibilities TEXT,
  availability_hours_per_week INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, userdesc)
);

-- Indexes for better query performance
CREATE INDEX idx_capacity_project_id ON member_capacity(project_id);
CREATE INDEX idx_capacity_userdesc ON member_capacity(userdesc);

-- Comments for documentation
COMMENT ON TABLE member_capacity IS 'Stores member capacity and current responsibilities for each project';
COMMENT ON COLUMN member_capacity.internship IS 'Current internship details';
COMMENT ON COLUMN member_capacity.organizations IS 'Organization affiliations and roles';
COMMENT ON COLUMN member_capacity.other_school_work IS 'Other school responsibilities (classes, projects, etc.)';
COMMENT ON COLUMN member_capacity.personal_responsibilities IS 'Personal matters affecting availability';
COMMENT ON COLUMN member_capacity.availability_hours_per_week IS 'Estimated hours per week available for this project';
COMMENT ON COLUMN member_capacity.notes IS 'Additional notes about capacity or schedule';
