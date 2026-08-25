@echo off
REM ===================================================================
REM  DevVault MCP - Step 1: Stripe checkout setup (guided browser tour)
REM
REM  This opens each Stripe dashboard page you need, in order, one at a
REM  time. Do the clicks described on screen, then press a key here to
REM  move to the next page.
REM
REM  Nothing in this script touches your Stripe account directly - it
REM  only opens URLs. You stay in control of every click.
REM ===================================================================
setlocal
title DevVault - Stripe setup

echo.
echo  ============================================================
echo   DevVault MCP - Stripe live checkout setup
echo  ============================================================
echo.
echo   Your live Stripe account already has:
echo     - Pro Plan         USD 19.00 / month
echo     - Enterprise Plan  USD 36.99 / month
echo.
echo   What is MISSING is a way for anyone to actually pay for them.
echo   That is what these 5 pages fix.
echo.
pause

REM ---------- 1 of 5 : confirm the account can accept live charges ----------
cls
echo.
echo   [1 of 5]  Confirm your account can accept live payments
echo   ------------------------------------------------------------
echo   On the page that opens:
echo     * If you see a banner asking you to "activate payments" or
echo       "complete your business profile", click it and finish it.
echo     * You need: legal name/address, tax id (SSN or EIN is fine
echo       for a US sole proprietor), and a bank account for payouts.
echo     * If there is no banner and the page looks normal, you are
echo       already activated. Move on.
echo.
echo   You cannot take a single real dollar until this is done.
echo.
pause
start "" "https://dashboard.stripe.com/settings/payouts"

REM ---------- 2 of 5 : public business details ----------
cls
echo.
echo   [2 of 5]  Set your public business details
echo   ------------------------------------------------------------
echo   These appear on the checkout page and on your customers'
echo   card statements. Blank or default values here are the #1
echo   cause of chargebacks on small products.
echo.
echo   Fill in:
echo     * Public business name    -^> DevVault
echo     * Statement descriptor    -^> DEVVAULT
echo     * Support email           -^> your real, monitored inbox
echo     * Support / business URL  -^> your GitHub repo is fine for now
echo.
pause
start "" "https://dashboard.stripe.com/settings/public"

REM ---------- 3 of 5 : payment link for Pro ----------
cls
echo.
echo   [3 of 5]  Create the PRO payment link  (USD 19.00 / month)
echo   ------------------------------------------------------------
echo   On the "Create a payment link" page:
echo     1. Product         -^> click the product dropdown, choose
echo                            "Pro Plan" (the existing one - do NOT
echo                            create a second product).
echo     2. Confirm it shows USD 19.00 / month, recurring.
echo     3. Open "Options" (left side) and set:
echo          - "After payment"  -^> Show confirmation page
echo          - Confirmation message: tell them what happens next,
echo            e.g. "Thanks. Your license key arrives by email
echo            within one business day."
echo     4. Under "Options", tick "Collect customers' addresses"
echo        only if you plan to charge sales tax. Otherwise skip.
echo     5. Click "Create link", then COPY the link.
echo.
echo   Paste the copied link into a notepad - you will need it in
echo   step 5 and in your README.
echo.
pause
start "" "https://dashboard.stripe.com/payment-links/create"

REM ---------- 4 of 5 : payment link for Enterprise ----------
cls
echo.
echo   [4 of 5]  Create the ENTERPRISE payment link  (USD 36.99 / month)
echo   ------------------------------------------------------------
echo   Same page, same steps as before, but choose the existing
echo   "Enterprise Plan" product in the dropdown.
echo.
echo   Click "Create link", COPY it, and save it next to the other one.
echo.
pause
start "" "https://dashboard.stripe.com/payment-links/create"

REM ---------- 5 of 5 : customer portal ----------
cls
echo.
echo   [5 of 5]  Turn on the customer portal  (so people can cancel)
echo   ------------------------------------------------------------
echo   A subscription people cannot cancel themselves becomes a
echo   support burden and then a chargeback. Turn this on now.
echo.
echo   On the page that opens:
echo     1. Click "Activate test link" / "Activate link" for the
echo        customer portal.
echo     2. Under "Subscriptions", tick "Customers can cancel
echo        subscriptions".
echo     3. Under "Business information", add a link to your terms
echo        of service and privacy policy. Stripe requires these
echo        before the portal will save.
echo     4. Save.
echo.
pause
start "" "https://dashboard.stripe.com/settings/billing/portal"

cls
echo.
echo  ============================================================
echo   Stripe side is done once those 5 pages are complete.
echo  ============================================================
echo.
echo   Next: run  02-npm-preflight.bat  to get the package ready
echo   to publish, then 03-npm-publish.bat to put it on npm.
echo.
echo   Reminder from your own launch brief: get the crypto reviewed
echo   by an outside engineer, and get terms of service written,
echo   BEFORE you take the first real payment for a secrets tool.
echo.
pause
endlocal
