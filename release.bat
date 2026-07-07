@echo off
setlocal
REM ---------------------------------------------------------------------------
REM  release.bat - build a store-ready Chrome Web Store package.
REM
REM    release.bat          -> patch bump  (e.g. 2.2.0 -> 2.2.1)
REM    release.bat minor    -> minor bump  (e.g. 2.2.0 -> 2.3.0)
REM    release.bat major    -> major bump  (e.g. 2.2.0 -> 3.0.0)
REM
REM  Bumps the version in package.json + manifest.json, rebuilds dist/, and
REM  creates prayer-times-reminder-<version>.zip in this folder. Then upload
REM  that .zip manually to the Chrome Web Store dashboard and Submit for review.
REM ---------------------------------------------------------------------------
cd /d "%~dp0"

set "LEVEL=%~1"
if "%LEVEL%"=="" set "LEVEL=patch"

echo [release] Bumping (%LEVEL%) and building...
call npm run version:release %LEVEL%
if errorlevel 1 (
  echo.
  echo [release] FAILED. The version may have been bumped before the build broke.
  echo           To undo the version bump, run:  npm run version:rollback
  pause
  exit /b 1
)

echo.
echo [release] Done. Upload the newest prayer-times-reminder-*.zip in this
echo           folder to the Chrome Web Store dashboard, then Submit for review.
pause
endlocal
