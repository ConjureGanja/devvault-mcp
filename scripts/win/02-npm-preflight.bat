@echo off
REM ===================================================================
REM  DevVault MCP - Step 2: npm publish preflight
REM
REM  Checks everything that can fail BEFORE you publish, because an
REM  npm version number can never be reused once it is published.
REM  Nothing here publishes anything. Safe to run as many times as
REM  you like.
REM ===================================================================
setlocal enabledelayedexpansion
title DevVault - npm preflight
cd /d "%~dp0..\.."

set FAILED=0

echo.
echo  ============================================================
echo   DevVault MCP - npm publish preflight
echo   Repo: %CD%
echo  ============================================================
echo.

REM ---------- node ----------
echo [1/6] Checking Node.js version...
where node >nul 2>&1
if errorlevel 1 (
  echo    FAIL: node is not installed or not on PATH.
  echo          Install the LTS build from https://nodejs.org
  set FAILED=1
  goto :summary
)
for /f "tokens=*" %%v in ('node --version') do set NODEV=%%v
echo    Found node !NODEV!
set NODEMAJOR=!NODEV:~1!
for /f "tokens=1 delims=." %%m in ("!NODEMAJOR!") do set NODEMAJOR=%%m
if !NODEMAJOR! LSS 22 (
  echo    FAIL: package.json requires Node ^>= 22. You have !NODEV!.
  echo          Install the LTS build from https://nodejs.org
  set FAILED=1
) else (
  echo    OK
)
echo.

REM ---------- npm name availability ----------
echo [2/6] Checking the npm name in package.json...
for /f "usebackq tokens=*" %%n in (`node -p "require('./package.json').name"`) do set PKG=%%n
if "!PKG!"=="" (
  echo    FAIL: could not read "name" from package.json.
  set FAILED=1
  goto :summary
)
echo    package.json name: !PKG!
for /f "tokens=*" %%c in ('curl -s -o nul -w "%%{http_code}" https://registry.npmjs.org/!PKG!') do set NAMECODE=%%c
if "!NAMECODE!"=="404" (
  echo    OK - "!PKG!" is unpublished and available.
) else if "!NAMECODE!"=="200" (
  echo    STOP: "!PKG!" ALREADY EXISTS on npm.
  echo.
  echo          Look at what is published there before going further:
  echo            https://www.npmjs.com/package/!PKG!
  echo.
  echo          If that page shows a DIFFERENT product than this repo,
  echo          publishing over it breaks every existing install of it.
  echo          Choose a different name in package.json instead.
  echo.
  echo          If it is an older version of THIS package, that is fine
  echo          - just bump "version" in package.json before publishing.
  set FAILED=1
) else (
  echo    Could not reach the npm registry ^(HTTP !NAMECODE!^). Skipping.
)
echo.

REM ---------- install ----------
echo [3/6] Installing dependencies ^(npm install^)...
call npm install
if errorlevel 1 (
  echo    FAIL: npm install failed. Read the error above.
  set FAILED=1
  goto :summary
)
echo    OK
echo.

REM ---------- tests ----------
echo [4/6] Running the test suite...
call npm test
if errorlevel 1 (
  echo    FAIL: tests did not pass. Do NOT publish a secrets tool
  echo          with failing tests. Fix them first.
  set FAILED=1
  goto :summary
)
echo    OK
echo.

REM ---------- build ----------
echo [5/6] Building dist/ ...
call npm run build
if errorlevel 1 (
  echo    FAIL: build failed.
  set FAILED=1
  goto :summary
)
if not exist "dist\server.js" (
  echo    FAIL: build finished but dist\server.js is missing.
  set FAILED=1
  goto :summary
)
echo    OK
echo.

REM ---------- tarball inspection ----------
echo [6/6] Inspecting the publish tarball...
echo    Everything listed below is what STRANGERS will download.
echo    ------------------------------------------------------------
call npm pack --dry-run
echo    ------------------------------------------------------------
echo.
echo    READ THAT LIST NOW. It must contain ONLY:
echo      dist\ , README.md , LICENSE , package.json
echo.
echo    If you see any .ts source, any .env, any .enc vault file,
echo    or anything from your home directory - STOP. Do not publish.
echo.

:summary
echo.
echo  ============================================================
if "%FAILED%"=="1" (
  echo   PREFLIGHT FAILED - fix the items marked FAIL above.
) else (
  echo   PREFLIGHT PASSED
  echo.
  echo   Next: run 03-npm-publish.bat
)
echo  ============================================================
echo.
pause
endlocal
