/**
 * The public "verified work record" page (FR-053) — a link a student can put on a CV or LinkedIn.
 * Plain HTML, no scripts, every value HTML-escaped. Only data from orders completed in the app.
 */
import type { WorkRecordDto } from '@cc/shared';

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

export function renderWorkRecordPage(r: WorkRecordDto): string {
  const name = escapeHtml(r.displayName);
  const since = new Date(r.memberSince).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const rating = r.rating.average === null ? 'No reviews yet' : `${r.rating.average.toFixed(1)} ★ from ${r.rating.count} review${r.rating.count === 1 ? '' : 's'}`;
  const rows = r.entries.length
    ? r.entries
        .map(
          (e) => `<li><strong>${escapeHtml(e.category)}</strong> · ${escapeHtml(e.completedMonth)}
${e.rating ? `<div class="stars" aria-label="${e.rating} out of 5">${stars(e.rating)}</div>` : '<div class="muted">Not rated</div>'}
${e.comment ? `<blockquote>${escapeHtml(e.comment)}</blockquote>` : ''}</li>`,
        )
        .join('\n')
    : '<li class="muted">No completed jobs yet.</li>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name} — verified work record · Connect</title>
<meta name="description" content="${r.completedJobs} jobs completed on Connect. ${escapeHtml(rating)}.">
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:32px auto;padding:0 16px;color:#17141F;line-height:1.5}
h1{margin-bottom:4px}.muted{color:#5B5668}.badge{display:inline-block;background:#DCFAE6;color:#067647;border-radius:999px;padding:2px 10px;font-size:14px;font-weight:600}
ul{list-style:none;padding:0}li{border:1px solid #DDD8E8;border-radius:12px;padding:12px 16px;margin:12px 0}
.stars{color:#6D28D9;letter-spacing:2px}blockquote{margin:8px 0 0;color:#17141F;font-style:italic}
footer{margin-top:32px;font-size:13px}</style></head><body>
<h1>${name}</h1>
<p class="muted">${r.collegeName ? `${escapeHtml(r.collegeName)} · ` : ''}Member since ${escapeHtml(since)}</p>
${r.isStudent ? '<p><span class="badge">✓ Verified student</span></p>' : ''}
<p><strong>${r.completedJobs}</strong> job${r.completedJobs === 1 ? '' : 's'} completed · ${escapeHtml(rating)}</p>
<h2>Completed work</h2>
<ul>${rows}</ul>
<footer class="muted">Verified by Connect: every entry is an order completed and paid through the app. Buyer names and contact details are never shown.</footer>
</body></html>`;
}
