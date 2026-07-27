import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── shared helpers ───────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtPct(n) {
  return `${n ?? 0}%`;
}

function nowLabel() {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ─── colours ──────────────────────────────────────────────────────────────────

const GREEN     = [34,  197, 94];   // primary green
const GREEN_DK  = [22,  163, 74];   // darker green
const GREEN_LT  = [240, 253, 244];  // very light green
const GRAY_HD   = [71,  85,  105];  // header text
const GRAY_ROW  = [248, 250, 252];  // alternating row
const WHITE     = [255, 255, 255];
const AMBER     = [245, 158, 11];
const RED       = [220,  38,  38];

// ─── PDF EXPORT ───────────────────────────────────────────────────────────────

export function exportPDF({ project, stats, memberContributions, tasks, outliers = [] }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();
  let y = 0;

  // ── cover band ──────────────────────────────────────────────────────────────
  doc.setFillColor(...GREEN_DK);
  doc.rect(0, 0, PW, 36, 'F');

  doc.setTextColor(...WHITE);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(project?.project_name || 'Project Report', 14, 15);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${project?.project_id || ''}  ·  Exported ${nowLabel()}`, 14, 23);

  // status pill
  const pct = stats?.completionPercentage ?? 0;
  const pillColor = pct >= 80 ? GREEN : pct >= 40 ? AMBER : RED;
  doc.setFillColor(...pillColor);
  doc.roundedRect(PW - 48, 6, 34, 11, 3, 3, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`${pct}% Complete`, PW - 31, 13.5, { align: 'center' });

  y = 44;

  // ── section helper ──────────────────────────────────────────────────────────
  function section(title) {
    doc.setFillColor(...GREEN_LT);
    doc.rect(14, y, PW - 28, 7, 'F');
    doc.setDrawColor(...GREEN);
    doc.line(14, y, 14, y + 7);
    doc.setTextColor(...GREEN_DK);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 18, y + 5);
    y += 10;
  }

  // ── Project Summary ─────────────────────────────────────────────────────────
  section('Project Summary');

  const summaryRows = [
    ['Total Members',   String(stats?.totalMembers ?? 0)],
    ['Total Tasks',     String(stats?.totalTasks ?? 0)],
    ['Completed',       `${stats?.completedTasks ?? 0}  (${pct}%)`],
    ['In Progress',     String(stats?.inProgressTasks ?? 0)],
    ['Pending',         String(stats?.pendingTasks ?? 0)],
  ];

  autoTable(doc, {
    startY: y,
    body: summaryRows,
    columnStyles: {
      0: { cellWidth: 55, fontStyle: 'bold', textColor: GRAY_HD },
      1: { cellWidth: 60 },
    },
    bodyStyles: { fontSize: 9, cellPadding: 3 },
    alternateRowStyles: { fillColor: GRAY_ROW },
    margin: { left: 14, right: 14 },
    tableWidth: 'wrap',
    theme: 'plain',
  });
  y = doc.lastAutoTable.finalY + 10;

  // ── Member Contributions ────────────────────────────────────────────────────
  section('Member Contributions');

  const contribHead = [['Member', 'Role', 'Assigned', 'Completed', 'Completion %', 'Contribution %']];
  const contribBody = (memberContributions || []).map(m => [
    m.fullName,
    m.role,
    String(m.assignedTasks),
    String(m.completedTasks),
    fmtPct(m.completionPercentage),
    fmtPct(m.contributionPercentage),
  ]);

  autoTable(doc, {
    startY: y,
    head: contribHead,
    body: contribBody,
    headStyles: { fillColor: GREEN_DK, textColor: WHITE, fontSize: 9, fontStyle: 'bold', cellPadding: 3 },
    bodyStyles: { fontSize: 9, cellPadding: 3 },
    alternateRowStyles: { fillColor: GRAY_ROW },
    columnStyles: {
      0: { cellWidth: 48 },
      1: { cellWidth: 22 },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 26, halign: 'center' },
      5: { cellWidth: 26, halign: 'center', fontStyle: 'bold', textColor: GREEN_DK },
    },
    margin: { left: 14, right: 14 },
    theme: 'grid',
  });
  y = doc.lastAutoTable.finalY + 10;

  // ── Task Details ─────────────────────────────────────────────────────────────
  section('Task Details');

  const taskHead = [['Task ID', 'Description', 'Assignee(s)', 'Status', 'Deadline']];
  const taskBody = (tasks || []).map(t => [
    t.task_id,
    t.task_description,
    (t.assignees || []).map(a => a.fullName).join(', ') || '—',
    t.status,
    fmtDate(t.task_date_deadline),
  ]);

  autoTable(doc, {
    startY: y,
    head: taskHead,
    body: taskBody,
    headStyles: { fillColor: GRAY_HD, textColor: WHITE, fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
    bodyStyles: { fontSize: 8, cellPadding: 3 },
    alternateRowStyles: { fillColor: GRAY_ROW },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 62 },
      2: { cellWidth: 42 },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 22, halign: 'center' },
    },
    didParseCell(data) {
      if (data.column.index === 3 && data.section === 'body') {
        const v = data.cell.raw;
        if (v === 'Completed')  data.cell.styles.textColor = GREEN_DK;
        if (v === 'In Progress') data.cell.styles.textColor = [180, 83, 9];
        if (v === 'Pending')     data.cell.styles.textColor = [100, 116, 139];
      }
    },
    margin: { left: 14, right: 14 },
    theme: 'grid',
  });
  y = doc.lastAutoTable.finalY + 10;

  // ── Issues / Outliers (if any) ───────────────────────────────────────────────
  if (outliers.length > 0) {
    // may need new page
    if (y > 220) { doc.addPage(); y = 20; }
    section('Issues Requiring Attention');

    const issueHead = [['#', 'Type', 'Member', 'Task / Issue', 'Deadline', 'Status']];
    const typeLabels = {
      overdue_task: 'Overdue Task', low_performance: 'Low Performance',
      inactive_member: 'Inactive Member', overloaded: 'Overloaded',
    };
    const issueBody = outliers.map((o, i) => [
      String(i + 1),
      typeLabels[o.type] || o.type,
      o.member?.name || '—',
      o.task?.description ||
        (o.type === 'low_performance'  ? `${o.completionRate?.toFixed(0)}% vs ${o.teamAverage?.toFixed(0)}% avg` :
         o.type === 'inactive_member'  ? `${o.assignedTasks} tasks, 0 completed` :
         o.type === 'overloaded'       ? `${o.complexity} pts vs ${o.teamAverage?.toFixed(0)} avg` : '—'),
      fmtDate(o.task?.deadline),
      o.type === 'overdue_task' ? `${o.daysPastDue}d overdue` : o.severity?.toUpperCase(),
    ]);

    autoTable(doc, {
      startY: y,
      head: issueHead,
      body: issueBody,
      headStyles: { fillColor: [185, 28, 28], textColor: WHITE, fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
      bodyStyles: { fontSize: 8, cellPadding: 3 },
      alternateRowStyles: { fillColor: [255, 245, 245] },
      columnStyles: {
        0: { cellWidth: 8,  halign: 'center' },
        1: { cellWidth: 30 },
        2: { cellWidth: 35 },
        3: { cellWidth: 60 },
        4: { cellWidth: 25, halign: 'center' },
        5: { cellWidth: 20, halign: 'center' },
      },
      margin: { left: 14, right: 14 },
      theme: 'grid',
    });
  }

  // ── footer on every page ─────────────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(...GREEN);
    doc.line(14, 285, PW - 14, 285);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text(`${project?.project_name || 'Project'} — Exported ${nowLabel()}`, 14, 290);
    doc.text(`Page ${p} of ${pageCount}`, PW - 14, 290, { align: 'right' });
  }

  const safeName = (project?.project_name || 'project').replace(/[^a-z0-9]/gi, '_');
  doc.save(`${safeName}_report.pdf`);
}

