@echo off
echo Cleaning node_modules and package-lock.json...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f package-lock.json
echo Clean complete!
echo.
echo Installing dependencies...
npm install
echo.
echo Installation complete!
