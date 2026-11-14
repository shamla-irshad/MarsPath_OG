@echo off
setlocal
cd /d "%~dp0"
echo Starting MarsPath backend and frontend in two terminal windows.
start "MarsPath API" cmd /k ""%~dp0start_backend_windows.bat""
timeout /t 2 >nul
start "MarsPath Frontend" cmd /k ""%~dp0start_frontend_windows.bat""
echo.
echo When both services are ready, open http://127.0.0.1:5173
pause
