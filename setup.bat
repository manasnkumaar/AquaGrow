@echo off
title AquaGrow Dashboard — Setup
color 0A
echo.
echo  ============================================
echo   AQUAGROW DASHBOARD — SETUP
echo   NITC MED IoT Simulation
echo  ============================================
echo.

REM Check Python
python --version 2>NUL
if %ERRORLEVEL% NEQ 0 (
    echo  ERROR: Python not found.
    echo  Please install Python 3.9+ from https://python.org
    echo  Make sure to check "Add Python to PATH" during install.
    pause
    exit /b 1
)

echo  Python found. Installing dependencies...
echo.
pip install --upgrade pip
pip install customtkinter matplotlib numpy scipy Pillow

echo.
echo  ============================================
echo   Setup complete!
echo   Run "run.bat" to start the dashboard.
echo  ============================================
echo.
pause
