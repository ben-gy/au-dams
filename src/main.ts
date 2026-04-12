import { init } from './app.ts';

init().catch((err: unknown) => {
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:1rem;color:#93a4c5;font-family:system-ui">
        <div style="font-size:1.5rem;color:#f87171">Failed to load</div>
        <div style="font-size:0.875rem;color:#5b6a8b">${err instanceof Error ? err.message : 'Unknown error'}</div>
      </div>
    `;
  }
});
