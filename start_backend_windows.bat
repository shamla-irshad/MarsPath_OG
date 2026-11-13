@echo off
setlocal
cd /d "%~dp0backend"
if not exist ".venv\Scripts\python.exe" (
  echo Creating Python virtual environment...
  py -m venv .venv
  if errorlevel 1 python -m venv .venv
)
if not exist ".venv\Scripts\python.exe" (echo ERROR: Python 3.10+ is required. & pause & exit /b 1)
".venv\Scripts\python.exe" -c "import fastapi, uvicorn, numpy, rasterio, pyproj; from pydantic import field_validator; import main" >nul 2>&1
if errorlevel 1 (
 echo Installing FastAPI dependencies...
 ".venv\Scripts\python.exe" -m pip install -r requirements.txt
 if errorlevel 1 (echo ERROR: pip install failed. & pause & exit /b 1)
)
echo MarsPath API: http://127.0.0.1:8000/docs
".venv\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8000
if errorlevel 1 pause
