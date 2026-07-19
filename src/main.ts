// feedback:begin (managed by hub/scripts/feedback/backfill.mjs)
import { mountFeedback } from './feedback';
mountFeedback();
// feedback:end

import { init } from './app.ts';

init().catch((err: unknown) => {
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:1rem;color:#475569;font-family:system-ui;background:#f4f7fa">
        <div style="font-size:1.5rem;color:#dc2626">Failed to load</div>
        <div style="font-size:0.875rem;color:#78869b">${err instanceof Error ? err.message : 'Unknown error'}</div>
      </div>
    `;
  }
});
