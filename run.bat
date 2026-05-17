@echo off
title AquaGrow Dashboard — NITC MED
color 0A
echo  Starting AquaGrow IoT Simulation Dashboard...
cd /d "%~dp0"
python main.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  ERROR: Dashboard failed to start.
    echo  Run setup.bat first to install dependencies.
    pause
)
