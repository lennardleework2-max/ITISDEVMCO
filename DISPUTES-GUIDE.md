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

### Step 3: Review and Choose Resolution

Review your dispute details and see the system recommendation:

- **Review Your Dispute**: Summary of type, description, and supporting context
- **System Recommendation**: Intelligent suggestion based on your dispute type:
  - **Uneven Distribution**: Analysis of current workload (total tasks, fair distribution per person)
  - **Missed Deadline**: Guidance on requesting deadline extensions from professor
  - **Unclear Task Assignment**: Suggestion to schedule group meeting for clarity
  - **Conflict (Unresponsive)**: Try private message first, then escalate if needed
  - **Conflict (Quality)**: Steps to clarify expectations and add revision notes

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
- System automatically analyzes workload distribution based on task complexity/difficulty
- Shows key metrics in an easy-to-read format:
  - **Total Complexity**: Sum of all task difficulty points in the project
  - **Suggested Complexity per Member**: Recommended complexity points per person
  - **Team Members**: Number of people in the team
  - **Current Workload per Member**: Shows each member's complexity points and task count
- Provides suggestions for balancing workload based on difficulty, not just task count

**Example Display:**
```
Total Complexity: 45 points
Suggested Complexity per Member: 15 points
Team Members: 3

Current Workload per Member:
- John Doe: 25 points (5 tasks) - Overloaded
- Jane Smith: 12 points (3 tasks) - Can take more
- Bob Johnson: 8 points (2 tasks) - Can take more

Suggestion: Fair distribution: ~15 complexity points per member.
Overloaded: John Doe (25 pts). Can take more: Jane Smith (12 pts), Bob Johnson (8 pts).
```

**How it works:**
- Each task has a difficulty rating from 1 (very easy) to 10 (very hard)
- The system sums up all difficulty points for each member
- Fair distribution = Total complexity ÷ Number of members
- Members with >20% above fair share are flagged as overloaded
- Members with >20% below fair share can take more tasks

### Missed Deadline
- System suggests messaging the professor for reconsideration
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
