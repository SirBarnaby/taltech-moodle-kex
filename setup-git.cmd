@echo off
rem Brings this folder up to date with the history Claude made (git-history.bundle).
rem First run: creates the git repo and writes every source file.
rem Later runs: fast-forwards to the newest history, but stops if you have uncommitted edits.
cd /d "%~dp0"
if not exist git-history.bundle (echo git-history.bundle not found & pause & exit /b 1)
if not exist .git (
  git init -q -b main
  git fetch -q git-history.bundle main || (pause & exit /b 1)
  git reset -q --mixed FETCH_HEAD
  git checkout-index -a -f
) else (
  git fetch -q git-history.bundle main || (pause & exit /b 1)
  for /f %%i in ('git status --porcelain --untracked-files=no') do (echo You have uncommitted edits. Commit or stash them, then run this again. & pause & exit /b 1)
  git merge -q --ff-only FETCH_HEAD || (echo Your branch has its own commits; merge FETCH_HEAD by hand. & pause & exit /b 1)
)
git log --oneline -1
pause
