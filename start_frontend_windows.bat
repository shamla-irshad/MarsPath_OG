@echo off
setlocal
cd /d "%~dp0frontend"
where node >nul 2>&1
if errorlevel 1 (echo ERROR: Node.js 20.19+ or 22.12+ is required. & pause & exit /b 1)
if not exist ".env.local" copy ".env.example" ".env.local" >nul
if not exist "node_modules\react" (
 echo Installing frontend dependencies...
 call npm install
 if errorlevel 1 (echo ERROR: npm install failed. & pause & exit /b 1)
)
echo MarsPath will use port 5173 or the next available port.
echo Open the Local address printed by Vite below.
call npm run dev
if errorlevel 1 pause
