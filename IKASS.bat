@echo off
setlocal EnableDelayedExpansion
title IKASS
color 0A

:: ============================================================
::                          IKASS
::   Aggressive Performance Mode - Kill / Restart / Exit
:: ============================================================

:: --- Check for Admin rights ---
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [IKASS] Admin rights venum. Right-click panni "Run as administrator" nu run pannunga.
    pause
    exit /b
)

set "BASE_DIR=%~dp0"
set "BACKUP_DIR=%BASE_DIR%IKASS_backup"
set "LOG_FILE=%BASE_DIR%IKASS_log.txt"
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

call :LOGINIT

:MENU
cls
echo ============================================================
echo                          IKASS
echo ============================================================
echo   1. Kill everything    (background apps, startup, updates)
echo   2. Restart everything (restore normal settings)
echo   3. Exit
echo ============================================================
set /p choice="Enter your choice (1/2/3): "

if "%choice%"=="1" goto KILL_CONFIRM
if "%choice%"=="2" goto RESTART
if "%choice%"=="3" goto EXITMENU
echo Invalid choice, try again.
timeout /t 2 >nul
goto MENU

:: ============================================================
:: 0. CONFIRMATION BEFORE KILL
:: ============================================================
:KILL_CONFIRM
cls
echo ============================================================
echo   WARNING: Kill mode will:
echo   - Disable startup apps, background apps, notifications
echo   - Stop Windows Update permanently
echo   - Kill non-essential running processes
echo   - Clean temp files and trim RAM
echo   (Everything is reversible via option 2, except temp cleanup)
echo ============================================================
set /p confirm="Sure ah? Continue pannalama? (Y/N): "
if /I "%confirm%"=="Y" goto KILL
if /I "%confirm%"=="N" goto MENU
goto KILL_CONFIRM

:: ============================================================
:: 1. KILL EVERYTHING
:: ============================================================
:KILL
cls
echo [IKASS] Kill mode start aagudhu... please wait.
echo.
call :LOG "===== KILL MODE STARTED ====="

:: --- 1. Backup current startup registry entries before wiping ---
echo [*] Backing up startup entries...
reg export "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" "%BACKUP_DIR%\startup_backup_hkcu.reg" /y >nul 2>&1
reg export "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" "%BACKUP_DIR%\startup_backup_hklm.reg" /y >nul 2>&1
call :LOG "Backed up startup registry entries"

:: --- 2. Disable startup apps ---
echo [*] Disabling startup apps...
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /f >nul 2>&1
reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /f >nul 2>&1
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\StartUp" (
    ren "%APPDATA%\Microsoft\Windows\Start Menu\Programs\StartUp" "StartUp_disabled" >nul 2>&1
)
call :LOG "Disabled startup apps (Run keys + Startup folder)"

:: --- 3. Disable background apps (UWP) ---
echo [*] Disabling background apps...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications" /v GlobalUserDisabled /t REG_DWORD /d 1 /f >nul 2>&1
call :LOG "Disabled UWP background apps"

:: --- 4. Disable notifications (Focus Assist) ---
echo [*] Disabling notifications (Focus Assist ON)...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\PushNotifications" /v ToastEnabled /t REG_DWORD /d 0 /f >nul 2>&1
call :LOG "Disabled toast notifications"

:: --- 5. Stop Windows Update permanently ---
echo [*] Stopping and disabling Windows Update...
net stop wuauserv >nul 2>&1
net stop bits >nul 2>&1
net stop dosvc >nul 2>&1
sc config wuauserv start= disabled >nul 2>&1
sc config bits start= disabled >nul 2>&1
sc config dosvc start= disabled >nul 2>&1
call :LOG "Stopped and disabled Windows Update, BITS, Delivery Optimization"

:: --- 6. Metered connection (reduce background wifi data) ---
echo [*] Marking network as metered...
reg add "HKLM\SOFTWARE\Microsoft\DUSMSvc\1" /v UserSetCost /t REG_DWORD /d 2 /f >nul 2>&1
call :LOG "Set network as metered"

:: --- 7. Disable visual effects (RAM/GPU savings) ---
echo [*] Disabling visual effects (animations, transparency, shadows)...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects" /v VisualFXSetting /t REG_DWORD /d 2 /f >nul 2>&1
reg add "HKCU\Control Panel\Desktop" /v UserPreferencesMask /t REG_BINARY /d 9012038010000000 /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" /v TaskbarAnimations /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\DWM" /v EnableAeroPeek /t REG_DWORD /d 0 /f >nul 2>&1
call :LOG "Disabled visual effects"

:: --- 8. Switch to High Performance power plan ---
echo [*] Switching to High Performance power plan...
for /f "tokens=4" %%p in ('powercfg /list ^| findstr /C:"High performance"') do set "HIGHPERF=%%p"
if defined HIGHPERF (
    powercfg /setactive %HIGHPERF% >nul 2>&1
) else (
    powercfg -duplicatescheme 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c >nul 2>&1
    for /f "tokens=4" %%p in ('powercfg /list ^| findstr /C:"High performance"') do powercfg /setactive %%p >nul 2>&1
)
call :LOG "Switched to High Performance power plan"

:: --- 9. Reduce network throttling for multimedia ---
echo [*] Disabling network throttling index...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile" /v NetworkThrottlingIndex /t REG_DWORD /d 4294967295 /f >nul 2>&1
call :LOG "Disabled NetworkThrottlingIndex"

:: --- 10. Clean temp files ---
echo [*] Cleaning temp files...
del /f /s /q "%TEMP%\*" >nul 2>&1
for /d %%d in ("%TEMP%\*") do rd /s /q "%%d" >nul 2>&1
del /f /s /q "C:\Windows\Temp\*" >nul 2>&1
call :LOG "Cleaned temp files (%TEMP% and C:\Windows\Temp)"

:: --- 11. Kill non-essential running processes ---
echo [*] Killing non-essential background processes...
set "SAFE=System Idle Process^,System^,smss.exe^,csrss.exe^,wininit.exe^,services.exe^,lsass.exe^,winlogon.exe^,explorer.exe^,svchost.exe^,dwm.exe^,fontdrvhost.exe^,cmd.exe^,conhost.exe^,IKASS.bat^,IKASS_v2.bat^,wmic.exe^,taskeng.exe^,taskhostw.exe^,sihost.exe^,ctfmon.exe^,RuntimeBroker.exe^,SearchIndexer.exe^,SearchHost.exe^,spoolsv.exe^,audiodg.exe^,powershell.exe"

for /f "skip=3 tokens=1,2" %%a in ('tasklist /fo table') do (
    set "PNAME=%%a"
    set "SKIP=0"
    for %%s in (%SAFE%) do (
        if /I "!PNAME!"=="%%s" set "SKIP=1"
    )
    if "!SKIP!"=="0" (
        taskkill /IM "!PNAME!" /F >nul 2>&1
        call :LOG "Killed process: !PNAME!"
    )
)

:: --- 12. Boost priority of currently active/foreground window's process ---
echo [*] Giving current active app full CPU priority...
for /f "tokens=2" %%p in ('powershell -NoProfile -Command "(Get-Process | Where-Object {$_.MainWindowHandle -eq (Add-Type -MemberDefinition '\''[DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow();'\'' -Name Win32 -Namespace Win32Functions -PassThru)::GetForegroundWindow()}).Id"') do (
    wmic process where ProcessId=%%p CALL setpriority "128" >nul 2>&1
    call :LOG "Boosted priority for foreground process PID %%p"
)

:: --- 13. Trim working sets / clear standby RAM ---
echo [*] Trimming RAM (clearing standby memory)...
powershell -NoProfile -Command "Get-Process | ForEach-Object { try { $_.MinWorkingSet = $_.MinWorkingSet } catch {} }" >nul 2>&1
call :LOG "Trimmed process working sets"

echo.
echo [IKASS] Done! Background apps, startup, notifications, updates - ellame stop pannachu.
echo Visual effects off, High Performance mode ON, temp files cleaned, RAM trimmed.
echo Only your active app-ku full CPU/RAM priority kudukurom.
echo Log saved to: %LOG_FILE%
echo.
call :LOG "===== KILL MODE COMPLETE ====="
pause
goto MENU

:: ============================================================
:: 2. RESTART EVERYTHING (restore)
:: ============================================================
:RESTART
cls
echo [IKASS] Restoring normal settings...
echo.
call :LOG "===== RESTART MODE STARTED ====="

echo [*] Restoring startup entries...
if exist "%BACKUP_DIR%\startup_backup_hkcu.reg" reg import "%BACKUP_DIR%\startup_backup_hkcu.reg" >nul 2>&1
if exist "%BACKUP_DIR%\startup_backup_hklm.reg" reg import "%BACKUP_DIR%\startup_backup_hklm.reg" >nul 2>&1
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\StartUp_disabled" (
    ren "%APPDATA%\Microsoft\Windows\Start Menu\Programs\StartUp_disabled" "StartUp" >nul 2>&1
)
call :LOG "Restored startup entries"

echo [*] Re-enabling background apps...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications" /v GlobalUserDisabled /t REG_DWORD /d 0 /f >nul 2>&1

echo [*] Re-enabling notifications...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\PushNotifications" /v ToastEnabled /t REG_DWORD /d 1 /f >nul 2>&1

echo [*] Re-enabling Windows Update...
sc config wuauserv start= auto >nul 2>&1
sc config bits start= auto >nul 2>&1
sc config dosvc start= auto >nul 2>&1
net start wuauserv >nul 2>&1
net start bits >nul 2>&1
call :LOG "Re-enabled Windows Update services"

echo [*] Restoring visual effects...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects" /v VisualFXSetting /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" /v TaskbarAnimations /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\DWM" /v EnableAeroPeek /t REG_DWORD /d 1 /f >nul 2>&1
call :LOG "Restored visual effects"

echo [*] Restoring Balanced power plan...
for /f "tokens=4" %%p in ('powercfg /list ^| findstr /C:"Balanced"') do (
    powercfg /setactive %%p >nul 2>&1
)
call :LOG "Restored Balanced power plan"

echo [*] Restoring network throttling index (default)...
reg delete "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile" /v NetworkThrottlingIndex /f >nul 2>&1

echo [*] Removing metered connection flag...
reg add "HKLM\SOFTWARE\Microsoft\DUSMSvc\1" /v UserSetCost /t REG_DWORD /d 1 /f >nul 2>&1

echo [*] Restarting Explorer...
taskkill /IM explorer.exe /F >nul 2>&1
start explorer.exe

echo.
set /p wupdate="Windows Update check pannanuma ippo? (Y/N): "
if /I "%wupdate%"=="Y" (
    start ms-settings:windowsupdate
    call :LOG "Opened Windows Update settings"
)

echo.
echo [IKASS] Ellame normal ah restore pannachu.
echo Log saved to: %LOG_FILE%
echo.
call :LOG "===== RESTART MODE COMPLETE ====="
pause
goto MENU

:: ============================================================
:: 3. EXIT
:: ============================================================
:EXITMENU
cls
echo [IKASS] Vanakkam! Exiting...
call :LOG "===== SESSION EXIT ====="
timeout /t 1 >nul
exit /b

:: ============================================================
:: LOG HELPER FUNCTIONS
:: ============================================================
:LOGINIT
echo. >> "%LOG_FILE%"
echo ============================================================ >> "%LOG_FILE%"
echo IKASS Session started: %DATE% %TIME% >> "%LOG_FILE%"
echo ============================================================ >> "%LOG_FILE%"
exit /b

:LOG
echo [%DATE% %TIME%] %~1 >> "%LOG_FILE%"
exit /b
