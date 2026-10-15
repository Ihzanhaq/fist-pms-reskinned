// Windows Hello (fingerprint, face or PIN) check before the saved sign-in is used.
import { runPowerShell } from './powershell.js';

const PROMPT_TIMEOUT_MS = 90_000;

// The prompt opens behind other windows when started from a background process,
// so the script finds its window and brings it to the front.
const SCRIPT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class PmsHelloFocus {
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern IntPtr FindWindow(string cls, string title);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  public static bool Raise() {
    IntPtr h = FindWindow("Credential Dialog Xaml Host", null);
    if (h == IntPtr.Zero) return false;
    keybd_event(0x12, 0, 0, UIntPtr.Zero);
    keybd_event(0x12, 0, 2, UIntPtr.Zero);
    ShowWindow(h, 9);
    return SetForegroundWindow(h);
  }
}
"@
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
$null = [Windows.Security.Credentials.UI.UserConsentVerifier,Windows.Security.Credentials.UI,ContentType=WindowsRuntime]
$mode = [Console]::In.ReadLine()
if ($mode -eq 'check') {
  $op = [Windows.Security.Credentials.UI.UserConsentVerifier]::CheckAvailabilityAsync()
  $t = $asTask.MakeGenericMethod([Windows.Security.Credentials.UI.UserConsentVerifierAvailability]).Invoke($null, @($op))
  $t.Wait(); [string]$t.Result; exit
}
$op = [Windows.Security.Credentials.UI.UserConsentVerifier]::RequestVerificationAsync([Console]::In.ReadLine())
$t = $asTask.MakeGenericMethod([Windows.Security.Credentials.UI.UserConsentVerificationResult]).Invoke($null, @($op))
$raised = $false
for ($i = 0; $i -lt 60 -and -not $t.IsCompleted; $i++) {
  Start-Sleep -Milliseconds 150
  if (-not $raised) { $raised = [PmsHelloFocus]::Raise() }
}
$t.Wait(); [string]$t.Result
`;

export async function helloAvailable() {
  if (process.platform !== 'win32') return false;
  try {
    return (await runPowerShell(SCRIPT, { input: 'check\n' })) === 'Available';
  } catch {
    return false;
  }
}

/** Resolves to true when the user confirmed, false when cancelled or unavailable. */
export async function verifyUser(message) {
  const result = await runPowerShell(SCRIPT, {
    input: `verify\n${message.replace(/[\r\n]+/g, ' ')}\n`,
    timeoutMs: PROMPT_TIMEOUT_MS,
  }).catch(() => 'Failed');
  return result === 'Verified';
}
