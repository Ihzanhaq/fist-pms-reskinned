# Automatic sign-in (Windows)

## Goal

Sign in to FISSO without a login window, like the HRMS phone app: the dashboard
stores the password and its own authenticator-app (TOTP) secret, and signs in in
a hidden browser when the saved session cannot be renewed. Windows Hello
(fingerprint/PIN) unlocks the stored secrets unless the user turns that off.

## Setup (Settings → Account → Automatic sign-in)

1. User enters FISSO username + password, clicks **Set up**.
2. A visible login window opens PMS with `kc_action=CONFIGURE_TOTP` added to the
   Keycloak auth request. The username/password are filled in; the user
   confirms the passkey.
3. On Keycloak's authenticator setup page the dashboard reads the hidden
   `totpSecret`, generates the current code, fills `totp` + `userLabel`
   ("PMS Dashboard (<computer name>)") and submits.
4. Back on PMS: session saved as usual, and `{password, secret}` encrypted with
   Windows DPAPI (CurrentUser) into `~/.fist-pms-dashboard/auto-login.json`
   alongside plaintext metadata (username, label, askHello, disabledReason).

## Sign-in

`silentLogin()` (hidden browser with the saved profile) is unchanged; when it
lands on Keycloak and automatic sign-in is on:

1. Windows Hello prompt (if askHello) — the prompt window is forced to the
   foreground. Background keepalive pings never prompt.
2. Decrypt, then drive Keycloak pages: login form → passkey page "try another
   way" → pick "Authenticator Application" → OTP form (pick our credential
   when several) → back on PMS. A virtual WebAuthn environment stops the
   passkey page from opening a Windows passkey dialog.
3. Failures: wrong password or OTP rejected twice → automatic sign-in is
   paused with a reason shown in Settings; unknown page or cancelled Hello →
   falls back to the normal login window. The **Log in** button also tries
   automatic sign-in first.

## Out of scope

macOS/Linux (setting hidden there). Removing the FISSO authenticator is done by
the user in FISSO account settings.

## Testing

Unit: TOTP (RFC 6238 vectors), Keycloak page classification, store metadata.
Manual: setup and sign-in against the real FISSO.
