// How a sheet's review date is presented to readers.
//
// This module runs in the browser (the build copies it to dist/assets), so a page that nobody
// rebuilt still shows its real age. Keep it free of Node imports.

// Reviews arrive as a pull request from the monthly review agent, and a person has to merge it.
// The grace period covers that lag, so readers only see a warning once a review is actually late.
const GRACE_DAYS = 7;

// lastReviewed:    "YYYY-MM-DD"
// reviewEveryDays: the sheet's review cadence (30 by default)
// Returns "current" up to and including the next review date, "due" during the grace period after
// it, then "overdue", which also shows a "may be out of date" notice. There is deliberately no
// warning before the review date: on a 30-day cycle it would make every sheet look half-stale.
// Returns null for unreadable input, which shows only the dates, with no badge.
export function freshnessStatus(lastReviewed, reviewEveryDays, today = new Date()) {
  const reviewed = new Date(`${lastReviewed}T00:00:00Z`);
  const ageDays = Math.floor((today - reviewed) / 86_400_000);
  if (Number.isNaN(ageDays) || !(reviewEveryDays > 0)) return null;

  if (ageDays <= reviewEveryDays) return "current";
  if (ageDays <= reviewEveryDays + GRACE_DAYS) return "due";
  return "overdue";
}
