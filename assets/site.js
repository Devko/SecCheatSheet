// Screen-only behaviour: freshness badges (computed at view time, so unrebuilt pages still age),
// the "Copy as checklist" button, and highlighting the current section in "On this sheet".

import { freshnessStatus } from "./freshness.mjs";

const LABELS = { current: "Current", due: "Review due", overdue: "Past review date" };

for (const badge of document.querySelectorAll("[data-fresh]")) {
  const status = freshnessStatus(badge.dataset.reviewed, Number(badge.dataset.every));
  if (!(status in LABELS)) continue;
  badge.textContent = LABELS[status];
  badge.dataset.status = status;
  badge.hidden = false;
  if (status === "overdue") document.querySelector("[data-stale]")?.removeAttribute("hidden");
}

const status = document.querySelector(".rail__status");
for (const button of document.querySelectorAll("[data-copy]")) {
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(document.getElementById(button.dataset.copy).value);
      status.textContent = "Checklist copied. Paste it into a ticket or doc.";
    } catch {
      status.textContent = "Couldn't reach the clipboard. Use the Markdown download instead.";
    }
  });
}

// The first section (in reading order) that overlaps the top 40% of the viewport is "current".
const tocLinks = new Map([...document.querySelectorAll(".toc a")].map((a) => [a.hash.slice(1), a]));
if (tocLinks.size && "IntersectionObserver" in window) {
  const inView = new Set();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) entry.isIntersecting ? inView.add(entry.target.id) : inView.delete(entry.target.id);
      const current = [...tocLinks.keys()].find((id) => inView.has(id));
      for (const [id, link] of tocLinks) {
        if (id === current) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      }
    },
    { rootMargin: "0px 0px -60% 0px" }
  );
  for (const id of tocLinks.keys()) {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
  }
}
