# Dispute Handling System - User Guide

## Overview

The Dispute Handling System allows students to raise collaboration concerns at any point during the project. The system categorizes concerns, recommends appropriate actions, and records the dispute status.

## How to Raise a Dispute

1. Navigate to your project
2. Click the **Disputes** tab
3. Click **+ Raise Dispute**
4. Follow the 3-step process:

### Step 1: Select Dispute Type

Choose from:
- **Uneven Distribution** - When workload is not fairly distributed
- **Missed Deadline** - When deadlines are not being met
- **Unclear Task Assignment** - When tasks are ambiguous
- **Conflict with Groupmate** - Issues with specific team members

If you select "Conflict with Groupmate", you'll be asked to specify:
- **Unresponsive** - Member not replying to messages
- **Uneven Distribution** - Redirects to workload analysis
- **Missed Deadline** - Member missing deadlines
- **Different Quality Expectation** - Disagreement on work quality
- **Others** - Any other conflict

You can also select which member the conflict is with (optional).

### Step 2: Describe the Situation

- Provide a detailed description of the issue
- Add supporting context or proof (optional)
  - Screenshots of messages
  - Evidence of missed deadlines
  - Any relevant documentation

### Step 3: Choose Resolution Approach

Select how you'd like to proceed:

**Resolve within group**
- Address the issue with group members first
- System records the dispute for future reference
- Good for minor issues or first-time concerns

**Escalate to professor**
- Request professor intervention
- System provides suggested email templates
- Recommended for serious or unresolved issues

## System Suggestions by Dispute Type

### Uneven Distribution
- System automatically analyzes current task distribution
- Shows each member's assigned tasks vs fair distribution
- Identifies overloaded and underloaded members
- Provides specific redistribution suggestions

**Example Output:**
```
Fair distribution: ~4 tasks per member
Overloaded: John Cruz (6 tasks), Mary Santos (5 tasks)
Can take more tasks: Carl Reyes (2 tasks)
```

### Missed Deadline
- System suggests messaging the professor for reconsideration
- Provides email template for deadline extension request
- Tracks if delays were communicated

### Unclear Task Assignment
- System suggests scheduling a group meeting
- Sends email notification to all members
- Recommends clarifying task descriptions and expectations

### Conflict - Unresponsive
- System suggests sending a respectful private message first
- If no response after 48 hours, option to escalate to professor
- Tracks communication attempts

### Conflict - Different Quality Expectation
- System suggests clarifying expected output
- Recommends adding revision notes to tasks
- Option to request professor guidance if unresolved

### Conflict - Others
- Allows custom description of the situation
- Provides option to resolve within group or escalate
- Includes email template for professor escalation

## Dispute Status

All disputes have one of two statuses:

**Ongoing**
- Dispute is currently active
- Shows in orange/yellow badge
- Can be marked as resolved

**Resolved**
- Dispute has been addressed
- Shows in green badge
- Records resolution date
- Remains in system for documentation

## Viewing Disputes

All project members can:
- View all disputes raised in the project
- See who raised each dispute
- Read descriptions and supporting context
- View suggested actions
- See resolution choices (group vs professor)
- Track dispute status

## Important Notes

1. **All disputes are recorded** - They can be shown to the professor later if needed
2. **No automatic penalties** - The system does not automatically reduce contribution scores
3. **Promotes communication** - Encourages clarification and mediation first
4. **Professor visibility** - Professors can review dispute history to understand team dynamics
5. **Privacy** - Sensitive conflicts can be escalated directly to professor

## Best Practices

✅ **DO:**
- Raise disputes early before they escalate
- Provide specific examples and context
- Try group resolution first for minor issues
- Keep description professional and factual
- Add supporting evidence when available

❌ **DON'T:**
- Raise disputes for every small disagreement
- Use offensive or unprofessional language
- Raise disputes without attempting communication first
- Abuse the system to penalize others unfairly

## Example Scenarios

### Scenario 1: Unresponsive Member
You notice Sarah hasn't responded to group chat messages for 3 days.

**Steps:**
1. Raise dispute → Conflict with Groupmate → Unresponsive
2. Describe: "Sarah hasn't responded to messages since June 15"
3. Add proof: Screenshot of unanswered messages
4. Choose: Resolve within group (system suggests private message first)

### Scenario 2: Heavy Workload
You notice John has 8 tasks while you have 2.

**Steps:**
1. Raise dispute → Uneven Distribution
2. Describe: "Current distribution feels unfair"
3. System automatically analyzes and shows:
   - John: 8 tasks (overloaded)
   - You: 2 tasks (underloaded)
   - Fair distribution: 5 tasks each
4. Choose: Resolve within group or escalate

### Scenario 3: Missed Project Deadline
Your group missed the submission deadline.

**Steps:**
1. Raise dispute → Missed Deadline
2. Describe reason for delay
3. System provides email template for professor
4. Choose: Escalate to professor

## Technical Details

- Dispute IDs: `DIS-000001`, `DIS-000002`, etc.
- All disputes stored permanently in database
- Timestamps for creation and resolution
- Full audit trail for accountability
- Integration with member contribution tracking
