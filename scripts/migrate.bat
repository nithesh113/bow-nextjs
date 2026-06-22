@echo off
REM ============================================================
REM  scripts\migrate.bat
REM
REM  Runs scripts\migrate-neon-region.mjs using Node + the project's
REM  realpath patch. Reads connection strings from scripts\.migration.env
REM
REM  Flags (passed through):
REM    --dry-run      show what would be copied without changing anything
REM    --schema-only  push schema only, skip data
REM    --data-only    skip the schema push
REM    --yes          skip the "press enter" confirmation
REM ============================================================

setlocal

REM Switch to project root (one level up from scripts\)
cd /d "%~dp0\.."

echo.
echo ============================================================
echo  BOW Neon Region Migration
echo ============================================================
echo  Project: %CD%
echo.

if not exist "scripts\.migration.env" (
  echo [ERROR] scripts\.migration.env not found.
  echo         Create the file with OLD_DATABASE_URL and NEW_DATABASE_URL lines.
  echo         See scripts\migrate-neon-region.mjs for the format.
  exit /b 1
)

node --require ./scripts/node-realpath-patch.cjs scripts\migrate-neon-region.mjs %*

set RC=%ERRORLEVEL%

echo.
if %RC%==0 (
  echo ============================================================
  echo   Migration complete.
  echo   Update .env to point at NEW and redeploy.
  echo ============================================================
) else (
  echo ============================================================
  echo   Migration FAILED with exit code %RC%.
  echo ============================================================
)

exit /b %RC%
