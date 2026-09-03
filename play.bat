@echo off
REM ---------------------------------------------------------------------------
REM  Impact Theory: start the game.
REM
REM  Double-click this file. It starts the dev server, waits until the server is
REM  actually answering, and only then opens the browser. Leave the window open
REM  while you play; closing it stops the game.
REM
REM  Waiting for a real response rather than counting seconds matters. The first
REM  version of this file opened the browser after a fixed six seconds and the
REM  page showed a connection error, because the server was not up yet. A cold
REM  start is also far slower than a warm one, so no single delay is right for
REM  both cases.
REM
REM  To play on a phone, use the Network address the server prints, with the
REM  phone on the same wifi. Windows Firewall may ask permission the first time.
REM ---------------------------------------------------------------------------

cd /d "%~dp0"

echo.
echo   Impact Theory
echo   -------------
echo   Starting. Your browser will open once the game is ready.
echo   Leave this window open while you play. Press Ctrl+C to stop.
echo.

REM Install dependencies if this is a fresh copy of the project.
if not exist "node_modules" (
  echo   First run: installing dependencies. This takes a couple of minutes.
  echo.
  call npm install
  echo.
)

REM Poll in a background window and open the browser the moment the server answers.
REM PowerShell rather than a batch loop: the nested quoting a batch retry loop needs
REM is fragile, and this is one line with one level of quoting. Two minutes of
REM attempts, which is generous even for a cold start on a network drive.
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "$u='http://localhost:5173/'; for($i=0; $i -lt 120; $i++){ try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri $u ^| Out-Null; Start-Process $u; break } catch { Start-Sleep -Seconds 1 } }"

call npm run dev

REM If the server stops because of an error, keep the window open so the message
REM can actually be read rather than vanishing with the console.
echo.
echo   The server has stopped.
pause
