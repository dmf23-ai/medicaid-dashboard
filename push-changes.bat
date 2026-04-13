@echo off
REM ──────────────────────────────────────────────────────────
REM  push-changes.bat — Stage, commit, and push to GitHub
REM  Run from anywhere; it always cd's into the git repo first.
REM ──────────────────────────────────────────────────────────

cd /d "%~dp0"

echo.
echo === Medicaid Dashboard — Push to GitHub ===
echo Working directory: %CD%
echo.

REM 1. Stage all changes first (must happen before pull)
echo [1/4] Staging changes...
git add -A

REM 2. Commit (skip if nothing to commit)
git diff --staged --quiet
if errorlevel 1 (
    echo.
    echo [2/4] Committing...
    set /p "MSG=Commit message (or press Enter for default): "
    if not defined MSG set "MSG=Update dashboard"
    git commit -m "%MSG%"
) else (
    echo.
    echo [2/4] Nothing new to commit.
)

REM 3. Pull remote changes (rebase keeps history clean)
echo.
echo [3/4] Pulling latest from origin/main...
git pull --rebase origin main
if errorlevel 1 (
    echo.
    echo ERROR: Pull failed. You may have merge conflicts to resolve.
    echo Run "git status" to see what needs attention.
    pause
    exit /b 1
)

REM 4. Push
echo.
echo [4/4] Pushing to origin/main...
git push origin main
if errorlevel 1 (
    echo.
    echo ERROR: Push failed. Try running this script again.
    pause
    exit /b 1
)

echo.
echo === Done! Vercel will auto-deploy in ~60 seconds. ===
echo.
pause
