@echo off
REM ---------------------------------------------------------------------------
REM  Impact Theory: start the game.
REM
REM  Double-click this file. It starts the dev server and opens the game in your
REM  browser. Leave the window open while you play; closing it stops the game.
REM
REM  To play on a phone, use the Network address this prints, with the phone on
REM  the same wifi. Windows Firewall may ask permission the first time.
REM ---------------------------------------------------------------------------

cd /d "%~dp0"

echo.
echo   Impact Theory
echo   -------------
echo   Starting. The game will open in your browser in a few seconds.
echo   Leave this window open while you play. Press Ctrl+C to stop.
echo.

REM Install dependencies if this is a fresh copy of the project.
if not exist "node_modules" (
  echo   First run: installing dependencies. This takes a couple of minutes.
  echo.
  call npm install
  echo.
)

REM Open the browser shortly after the server starts. `start` returns immediately,
REM so the timeout runs in a separate shell and does not hold up the server.
start "" cmd /c "timeout /t 6 /nobreak >nul & start http://localhost:5173/"

call npm run dev

REM If the server stops because of an error, keep the window open so the message
REM can actually be read rather than vanishing with the console.
echo.
echo   The server has stopped.
pause
