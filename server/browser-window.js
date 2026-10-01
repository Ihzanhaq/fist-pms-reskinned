// Maximize Chromium windows and bring them to the foreground (Windows often keeps them on the taskbar).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const CHROMIUM_WINDOW_ARGS = ['--start-maximized'];

const FOCUS_MS = 2500;

function winFocusScript(pid) {
  return `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class PmsWinFocus {
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool AllowSetForegroundWindow(int processId);
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  public static IntPtr MainWindow(uint pid) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((hWnd, lParam) => {
      GetWindowThreadProcessId(hWnd, out uint p);
      if (p == pid && IsWindowVisible(hWnd)) { found = hWnd; return false; }
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
"@
$targetPid = ${pid}
[void][PmsWinFocus]::AllowSetForegroundWindow($targetPid)
$h = [PmsWinFocus]::MainWindow([uint32]$targetPid)
if ($h -ne [IntPtr]::Zero) {
  [void][PmsWinFocus]::ShowWindowAsync($h, 3)
  [void][PmsWinFocus]::SetForegroundWindow($h)
}
`;
}

async function maximizeViaCdp(page) {
  const cdp = await page.context().newCDPSession(page);
  const { windowId } = await cdp.send('Browser.getWindowForTarget');
  await cdp.send('Browser.setWindowBounds', {
    windowId,
    bounds: { windowState: 'maximized' },
  });
}

async function focusWindowsPid(pid) {
  if (!pid) return;
  const script = winFocusScript(pid);
  await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { windowsHide: true, timeout: 8000 },
  ).catch(() => {});
}

/** Maximize and try to raise the browser window (best-effort on each OS). */
export async function focusBrowserWindow(browser, page) {
  await page.bringToFront().catch(() => {});
  try {
    await maximizeViaCdp(page);
  } catch {
    // CDP bounds are Chromium-only; Win32 below covers Edge/Chrome too.
  }
  if (process.platform === 'win32') {
    await focusWindowsPid(browser?.process?.()?.pid);
  }
}

/** Re-focus while the user completes login in a visible window. */
export function keepBrowserOnTop(browser, page) {
  const tick = () => focusBrowserWindow(browser, page).catch(() => {});
  tick();
  return setInterval(tick, FOCUS_MS);
}
