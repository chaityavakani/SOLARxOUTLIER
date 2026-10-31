import React from 'react';

const statusLabels = {
  // Leads
  NEW: 'New Enquiry',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Feasibility Qualified',
  NOT_QUALIFIED: 'Not Feasible',
  SURVEY_SCHEDULED: 'Survey Scheduled',
  SURVEY_DONE: 'Survey Submitted',
  SURVEY_APPROVED: 'Survey Approved',
  SURVEY_REJECTED: 'Survey Rejected',
  QUOTED: 'Quote Prepared',
  WON: 'Order Won',
  LOST: 'Closed / Lost',

  // Surveys
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In Progress',
  SUBMITTED: 'Submitted for Review',
  APPROVED: 'Approved',
  REJECTED: 'Needs Revision',
  CANCELLED: 'Cancelled',

  // Quotes
  DRAFT: 'Draft BOM',
  SENT: 'Sent to Customer',
  ACCEPTED: 'Quote Accepted',

  // Projects
  AWAITING_ADVANCE: 'Awaiting Advance',
  CONFIRMED: 'Order Confirmed',
  PACKING: 'Packing in Warehouse',
  DISPATCHED: 'Dispatched in Transit',
  DELIVERED: 'Delivered to Site',
  INSTALLATION_SCHEDULED: 'Installation Scheduled',
  INSTALLING: 'Installation Underway',
  INSTALLED: 'Installed & Tested',
  CLOSED: 'Completed & Closed',

  // Tickets
  OPEN: 'Open',
  ASSIGNED: 'Technician Assigned',
  AWAITING_PARTS: 'Awaiting Parts',
  RESOLVED: 'Resolved',

  // Subsidies
  NOT_STARTED: 'Not Started',
  DOCUMENTS_PENDING: 'Docs Pending',
  APPLIED: 'Applied on Portal',
  INSPECTION_DONE: 'Inspection Done',
  DISBURSED: 'Subsidy Disbursed',

  // Warranties
  WARRANTY_COVERED: 'Under Warranty (₹0)',
  BILLABLE: 'Billable Service',
  ACTIVE: 'Active Warranty',
  EXPIRED: 'Expired',
};

const statusClasses = {
  // Green / Positive
  WON: 'badge-green',
  APPROVED: 'badge-green',
  SURVEY_APPROVED: 'badge-green',
  ACCEPTED: 'badge-green',
  INSTALLED: 'badge-green',
  CLOSED: 'badge-green',
  RESOLVED: 'badge-green',
  DISBURSED: 'badge-green',
  WARRANTY_COVERED: 'badge-green',
  ACTIVE: 'badge-green',

  // Amber / Warning / In Progress
  NEW: 'badge-amber',
  CONTACTED: 'badge-amber',
  AWAITING_ADVANCE: 'badge-amber',
  AWAITING_PARTS: 'badge-amber',
  DOCUMENTS_PENDING: 'badge-amber',
  BILLABLE: 'badge-amber',
  DRAFT: 'badge-amber',
  PENDING: 'badge-amber',
  NOT_STARTED: 'badge-gray',
  // Blue / Active
  QUALIFIED: 'badge-blue',
  SURVEY_SCHEDULED: 'badge-blue',
  SCHEDULED: 'badge-blue',
  SUBMITTED: 'badge-blue',
  SENT: 'badge-blue',
  CONFIRMED: 'badge-blue',
  PACKING: 'badge-blue',
  DISPATCHED: 'badge-blue',
  DELIVERED: 'badge-blue',
  INSTALLATION_SCHEDULED: 'badge-blue',
  IN_PROGRESS: 'badge-blue',
  INSTALLING: 'badge-blue',
  OPEN: 'badge-blue',
  ASSIGNED: 'badge-blue',
  APPLIED: 'badge-blue',
  INSPECTION_DONE: 'badge-blue',

  // Red / Negative
  LOST: 'badge-red',
  REJECTED: 'badge-red',
  SURVEY_REJECTED: 'badge-red',
  CANCELLED: 'badge-red',
  EXPIRED: 'badge-red',
  NOT_QUALIFIED: 'badge-red',
};

export default function StatusBadge({ status, text, size = 'normal' }) {
  if (!status) return null;
  const label = text || statusLabels[status] || status.replaceAll('_', ' ');
  const cssClass = statusClasses[status] || 'badge-gray';

  return (
    <span className={`status-badge ${cssClass} ${size === 'small' ? 'badge-sm' : ''}`}>
      <span className="badge-dot" />
      {label}
    </span>
  );
}

