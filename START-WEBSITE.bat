@echo off
chcp 65001 >nul
title NANDAN DIGITAL SEVA KENDRA
cd /d "%~dp0"
echo ==============================================
echo   NANDAN DIGITAL SEVA KENDRA - START SERVER
echo ==============================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js nahi mila.
  echo Pehle https://nodejs.org se Node.js LTS install karein.
  pause
  exit /b 1
)
if not exist "node_modules\express" (
  echo Pehli baar dependencies install ho rahi hain...
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo Install fail hua. Internet aur package.json check karein.
    pause
    exit /b 1
  )
)
echo.
echo Website khulne ka address: http://localhost:3000
echo Server band karne ke liye is window mein Ctrl+C dabayein.
echo.
start "" "http://localhost:3000"
call npm.cmd start
echo.
echo Server band ho gaya ya start nahi hua.
pause
