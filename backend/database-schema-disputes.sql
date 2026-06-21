-- Disputes table schema for Supabase PostgreSQL
-- Add this table to your Supabase database

CREATE TABLE disputes (
  recid BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dispute_id VARCHAR(100) UNIQUE NOT NULL,
  project_id VARCHAR(100) NOT NULL,
  raised_by_userdesc VARCHAR(100) NOT NULL,
  dispute_type VARCHAR(100) NOT NULL,
  sub_type VARCHAR(100),
  description TEXT NOT NULL,
  supporting_context TEXT,
  related_member_userdesc VARCHAR(100),
  suggested_action TEXT,
  distribution_analysis TEXT,
  resolution_choice VARCHAR(100),
  resolution_notes TEXT,
  status VARCHAR(50) DEFAULT 'Ongoing',
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX idx_disputes_project_id ON disputes(project_id);
CREATE INDEX idx_disputes_raised_by ON disputes(raised_by_userdesc);
CREATE INDEX idx_disputes_status ON disputes(status);
CREATE INDEX idx_disputes_created_at ON disputes(created_at DESC);

-- Comments for documentation
COMMENT ON TABLE disputes IS 'Stores project collaboration disputes raised by members';
COMMENT ON COLUMN disputes.dispute_id IS 'Unique dispute identifier (DIS-XXXXXX format)';
COMMENT ON COLUMN disputes.dispute_type IS 'Type: Uneven Distribution, Missed Deadline, Unclear Task Assignment, Conflict with Groupmate';
COMMENT ON COLUMN disputes.sub_type IS 'Sub-type for conflicts: Unresponsive, Uneven Distribution, Missed Deadline, Different Quality Expectation, Others';
COMMENT ON COLUMN disputes.distribution_analysis IS 'JSON string containing workload analysis for Uneven Distribution disputes';
COMMENT ON COLUMN disputes.resolution_choice IS 'Resolve within group or Escalate to professor';
COMMENT ON COLUMN disputes.status IS 'Ongoing or Resolved';
