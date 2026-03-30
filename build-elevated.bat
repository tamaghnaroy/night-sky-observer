@echo off
echo === Night Sky Observer Build (Elevated) ===
echo.
echo Cleaning winCodeSign cache...
rmdir /s /q "C:\Users\tamaghna roy\AppData\Local\electron-builder\Cache\winCodeSign" 2>nul
echo Cache cleaned.
echo.
echo Building NSIS installer...
cd /d "C:\Users\tamaghna roy\CascadeProjects\windsurf-project-5"
call npm run dist
echo.
echo === Build complete ===
pause
