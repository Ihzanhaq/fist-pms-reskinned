// Stops the dashboard server listening on the configured port, if any.
import { execSync } from 'node:child_process';
import { PORT } from '../server/config.js';

export function stopServer() {
  try {
    if (process.platform === 'win32') {
      execSync(
        `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }"`,
        { stdio: 'ignore', windowsHide: true },
      );
    } else {
      execSync(`fuser -k ${PORT}/tcp || lsof -ti tcp:${PORT} | xargs -r kill`, { stdio: 'ignore', shell: '/bin/sh' });
    }
  } catch {
    // Nothing was running.
  }
}
