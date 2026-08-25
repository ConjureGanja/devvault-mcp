@echo off
REM ===================================================================
REM  DevVault MCP - Step 4: verify the public install path
REM
REM  Installs the PUBLISHED package into a clean temp folder, exactly
REM  the way a stranger would. This catches the classic "works on my
REM  machine because dist/ is sitting right there" failure.
REM ===================================================================
setlocal enabledelayedexpansion
title DevVault - verify install
cd /d "%~dp0..\.."
for /f "usebackq tokens=*" %%n in (`node -p "require('./package.json').name"`) do set PKG=%%n
set WORK=%TEMP%\devvault-verify

echo.
echo  ============================================================
echo   DevVault MCP - verifying the public install
echo  ============================================================
echo.

echo [1/3] Is it on the registry yet?
for /f "tokens=*" %%c in ('curl -s -o nul -w "%%{http_code}" https://registry.npmjs.org/!PKG!') do set CODE=%%c
if not "!CODE!"=="200" (
  echo    Not found on npm yet ^(HTTP !CODE!^).
  echo    If you just published, wait a minute and rerun this script.
  goto :end
)
echo    OK - !PKG! is live on npm.
echo.

echo [2/3] Installing into a clean folder: %WORK%
if exist "%WORK%" rmdir /s /q "%WORK%"
mkdir "%WORK%"
cd /d "%WORK%"
call npm install !PKG! --no-save
if errorlevel 1 (
  echo    FAIL: a clean install of the published package failed.
  echo          Something in the tarball is broken. Fix, bump the
  echo          version, and republish.
  goto :end
)
echo    OK
echo.

echo [3/3] Launching the server binary for a moment...
echo    ^(An MCP server waits on stdin, so it will just sit there.
echo     No crash within a couple of seconds means it started fine.
echo     Press Ctrl+C to stop it, then close this window.^)
echo.
echo    ------------------------------------------------------------
call npx -y !PKG!
echo    ------------------------------------------------------------
echo.

echo   If that did not crash, paste this into Claude Desktop:
echo     Settings -^> Developer -^> Edit Config
echo.
echo     {
echo       "mcpServers": {
echo         "devvault": {
echo           "command": "npx",
echo           "args": ["-y", "!PKG!"]
echo         }
echo       }
echo     }
echo.
echo   Then FULLY QUIT Claude Desktop and reopen it - closing the
echo   window is not enough, the old server keeps running.
echo.

:end
pause
endlocal
