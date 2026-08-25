@echo off
REM ===================================================================
REM  DevVault MCP - Step 5: verify your Stripe payment links work
REM
REM  Paste in the two payment links you created in step 1. This checks
REM  they are reachable and live - it never asks for and never touches
REM  your Stripe secret key.
REM ===================================================================
setlocal enabledelayedexpansion
title DevVault - verify payment links

echo.
echo  ============================================================
echo   DevVault MCP - payment link check
echo  ============================================================
echo.
echo   Paste the links you copied from the Stripe dashboard.
echo   They look like:  https://buy.stripe.com/xxxxxxxxxxxx
echo.

set /p PROLINK="PRO link        : "
set /p ENTLINK="ENTERPRISE link : "
echo.

call :check "PRO" "!PROLINK!"
call :check "ENTERPRISE" "!ENTLINK!"

echo.
echo   Now do the part no script can do for you:
echo.
echo     1. Open each link in a private/incognito window.
echo     2. Confirm the price, the product name, and that your
echo        business name appears - not "Acct 1Rfe28..." or blank.
echo     3. Do NOT test with a real card on a live link. If you want
echo        an end-to-end test, make the same link in TEST mode at
echo        https://dashboard.stripe.com/test/payment-links
echo        and pay it with card 4242 4242 4242 4242, any future
echo        expiry, any CVC.
echo     4. Then paste the LIVE links into your README so people
echo        can actually find them.
echo.
goto :end

:check
set LABEL=%~1
set URL=%~2
if "%URL%"=="" (
  echo   [%LABEL%] skipped - no link entered.
  goto :eof
)
echo %URL% | findstr /b /c:"https://buy.stripe.com/" >nul
if errorlevel 1 (
  echo   [%LABEL%] WARNING - that does not look like a Stripe payment
  echo             link. Expected it to start with https://buy.stripe.com/
)
for /f "tokens=*" %%c in ('curl -s -o nul -L -w "%%{http_code}" "%URL%"') do set HTTP=%%c
if "!HTTP!"=="200" (
  echo   [%LABEL%] OK - link is live ^(HTTP 200^).
) else (
  echo   [%LABEL%] PROBLEM - HTTP !HTTP!. The link may be deactivated,
  echo             mistyped, or the account is not activated for live
  echo             charges yet.
)
goto :eof

:end
pause
endlocal
