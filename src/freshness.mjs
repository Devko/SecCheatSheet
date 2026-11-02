// How a sheet's review date is presented to readers.
//
// This module runs in the browser (the build copies it to dist/assets), so a page that nobody
// rebuilt still shows its real age. Keep it free of Node imports.
//
// lastReviewed:    "YYYY-MM-DD"
// reviewEveryDays: the sheet's review cadence (30 by default)
// Returns "current", "due-soon" or "overdue". Returning null shows only the dates, with no badge.
export function freshnessStatus(lastReviewed, reviewEveryDays, today = new Date()) {
  const reviewed = new Date(`${lastReviewed}T00:00:00Z`);
  const ageDays = Math.floor((today - reviewed) / 86_400_000);

  // TODO: decide when a sheet stops being "current". Things to weigh:
  //  - Reviews arrive as a pull request from the monthly review agent, and a person has to merge it.
  //    How many days of merge lag should pass before a reader sees a warning?
  //  - Should "due-soon" be shown at all on a 30-day cycle, or does it make every sheet look
  //    half-stale for a week each month? Overdue sheets also show a "may be out of date" notice.
  return null;
}
