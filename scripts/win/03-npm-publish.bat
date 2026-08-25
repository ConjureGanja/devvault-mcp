@echo off
REM ===================================================================
REM  DevVault MCP - Step 3: publish to npm
REM
REM  THIS ONE IS IRREVERSIBLE. A published version number can never
REM  be reused, and unpublishing is only allowed within 72 hours.
REM  Run 02-npm-preflight.bat first and read its tarball listing.
REM ===================================================================
setlocal enabledelayedexpansion
title DevVault - npm publish
cd /d "%~dp0..\.."

echo.
echo  ============================================================
echo   DevVault MCP - publish to npm  ^(IRREVERSIBLE^)
echo  ============================================================
echo.

REM ---------- 2FA reminder ----------
echo   Before you continue, your npm account MUST have two-factor
echo   authentication enabled, set to "Authorization and Publishing".
echo.
echo   Turn it on here ^(opens in your browser^):
echo     https://www.npmjs.com/settings/~/profile
echo.
echo   A hijacked npm account on a SECRETS package means attackers
echo   push malware to everyone who installs it. This is the one
echo   step you do not skip.
echo.
set /p OPEN2FA="Open the npm 2FA settings page now? (y/n): "
if /i "!OPEN2FA!"=="y" start "" "https://www.npmjs.com/settings/~/profile"
echo.

REM ---------- login ----------
echo [1/3] Checking npm login...
call npm whoami >nul 2>&1
if errorlevel 1 (
  echo    Not logged in. Launching npm login...
  echo    ^(This opens a browser window for authentication.^)
  call npm login
  if errorlevel 1 (
    echo    FAIL: npm login did not complete.
    goto :end
  )
)
for /f "tokens=*" %%u in ('npm whoami') do set NPMUSER=%%u
echo    Logged in as: !NPMUSER!
echo.

REM ---------- last look ----------
echo [2/3] Final tarball check...
call npm pack --dry-run
echo.
echo    ------------------------------------------------------------
echo    That is the exact file list about to go public, forever.
echo    ------------------------------------------------------------
echo.
set /p CONFIRM="Type PUBLISH (all caps) to continue, anything else to abort: "
if not "!CONFIRM!"=="PUBLISH" (
  echo    Aborted. Nothing was published.
  goto :end
)
echo.

REM ---------- publish ----------
echo [3/3] Publishing...
call npm publish --access public
if errorlevel 1 (
  echo.
  echo    PUBLISH FAILED. The most common causes:
  echo.
  echo      * "You do not have permission" / 403 with a similar name:
  echo        npm blocked the name for being too close to an existing
  echo        package. Fix: change "name" in package.json to a scoped
  echo        name, e.g. "@!NPMUSER!/devvault-mcp", then rerun.
  echo.
  echo      * "You cannot publish over the previously published
  echo        version": bump "version" in package.json and rerun.
  echo.
  echo      * "OTP required": your 2FA code was wrong or expired.
  echo        Just rerun and enter a fresh code.
  echo.
  goto :end
)

echo.
echo  ============================================================
echo   PUBLISHED
echo  ============================================================
echo.
echo   Your package page ^(may take a minute to appear^):
echo     https://www.npmjs.com/package/devvault-mcp
echo.
echo   Next: run 04-verify-install.bat to install it the way a
echo   stranger would, and confirm it actually works.
echo.

:end
pause
endlocal
