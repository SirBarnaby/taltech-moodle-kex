@echo off
rem Turns this folder into a git repo with the full history Claude made (from git-history.bundle).
rem Safe to re-run after each update: it moves main to the newest history and leaves your files alone.
cd /d "%~dp0"
if not exist git-history.bundle (echo git-history.bundle not found & pause & exit /b 1)
if not exist .git git init -q -b main
git fetch -q git-history.bundle main || (pause & exit /b 1)
git reset -q --mixed FETCH_HEAD
git log --oneline -1
git status --short
pause
