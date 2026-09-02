@echo off
setlocal EnableDelayedExpansion
title IKASS
color 0A

:: ============================================================
::                          IKASS
::   Aggressive Performance Mode - Kill / Restart / Exit
:: ============================================================

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [IKASS] Admin rights venum. Right-click panni "Run as administrator" nu run pannunga.
    pause
    exit
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
:: 1. KILL EVERYTHING  (13 tracked steps, live progress bar)
:: ============================================================
:KILL
call :LOG "===== KILL MODE STARTED ====="
set "KTOTAL=13"

call :PROGRESS 1 %KTOTAL% "Backing up startup entries"
reg export "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" "%BACKUP_DIR%\startup_backup_hkcu.reg" /y >nul 2>&1
reg export "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" "%BACKUP_DIR%\startup_backup_hklm.reg" /y >nul 2>&1

call :PROGRESS 2 %KTOTAL% "Disabling startup apps"
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /f >nul 2>&1
reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /f >nul 2>&1
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\StartUp" (
    ren "%APPDATA%\Microsoft\Windows\Start Menu\Programs\StartUp" "StartUp_disabled" >nul 2>&1
)

call :PROGRESS 3 %KTOTAL% "Disabling background UWP apps"
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications" /v GlobalUserDisabled /t REG_DWORD /d 1 /f >nul 2>&1

call :PROGRESS 4 %KTOTAL% "Disabling notifications"
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\PushNotifications" /v ToastEnabled /t REG_DWORD /d 0 /f >nul 2>&1

call :PROGRESS 5 %KTOTAL% "Stopping Windows Update permanently"
net stop wuauserv >nul 2>&1
net stop bits >nul 2>&1
net stop dosvc >nul 2>&1
sc config wuauserv start= disabled >nul 2>&1
sc config bits start= disabled >nul 2>&1
sc config dosvc start= disabled >nul 2>&1

call :PROGRESS 6 %KTOTAL% "Marking network as metered"
reg add "HKLM\SOFTWARE\Microsoft\DUSMSvc\1" /v UserSetCost /t REG_DWORD /d 2 /f >nul 2>&1

call :PROGRESS 7 %KTOTAL% "Disabling visual effects"
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects" /v VisualFXSetting /t REG_DWORD /d 2 /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" /v TaskbarAnimations /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\DWM" /v EnableAeroPeek /t REG_DWORD /d 0 /f >nul 2>&1

call :PROGRESS 8 %KTOTAL% "Switching to High Performance power plan"
set "HIGHPERF="
for /f "tokens=4" %%p in ('powercfg /list ^| findstr /C:"High performance"') do set "HIGHPERF=%%p"
if defined HIGHPERF (
    powercfg /setactive %HIGHPERF% >nul 2>&1
) else (
    powercfg -duplicatescheme 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c >nul 2>&1
    for /f "tokens=4" %%p in ('powercfg /list ^| findstr /C:"High performance"') do powercfg /setactive %%p >nul 2>&1
)

call :PROGRESS 9 %KTOTAL% "Disabling network throttling index"
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile" /v NetworkThrottlingIndex /t REG_DWORD /d 4294967295 /f >nul 2>&1

call :PROGRESS 10 %KTOTAL% "Cleaning temp files"
del /f /s /q "%TEMP%\*" >nul 2>&1
for /d %%d in ("%TEMP%\*") do rd /s /q "%%d" >nul 2>&1
del /f /s /q "C:\Windows\Temp\*" >nul 2>&1

call :PROGRESS 11 %KTOTAL% "Killing non-essential background processes"
set "SAFE=System Idle Process^,System^,smss.exe^,csrss.exe^,wininit.exe^,services.exe^,lsass.exe^,winlogon.exe^,explorer.exe^,svchost.exe^,dwm.exe^,fontdrvhost.exe^,cmd.exe^,conhost.exe^,IKASS.bat^,wmic.exe^,taskeng.exe^,taskhostw.exe^,sihost.exe^,ctfmon.exe^,RuntimeBroker.exe^,SearchIndexer.exe^,SearchHost.exe^,spoolsv.exe^,audiodg.exe^,powershell.exe"

echo.
echo   Scanning running processes...
set "PLIST_COUNT=0"
for /f "skip=3 tokens=1" %%a in ('tasklist /fo table') do (
    set "PNAME=%%a"
    set "IS_SAFE=0"
    for %%s in (%SAFE%) do if /I "!PNAME!"=="%%s" set "IS_SAFE=1"
    if "!IS_SAFE!"=="0" set /a PLIST_COUNT+=1
)
echo   %PLIST_COUNT% process^(es^) to kill.
echo.

set "PKILLED=0"
for /f "skip=3 tokens=1" %%a in ('tasklist /fo table') do (
    set "PNAME=%%a"
    set "IS_SAFE=0"
    for %%s in (%SAFE%) do if /I "!PNAME!"=="%%s" set "IS_SAFE=1"
    if "!IS_SAFE!"=="0" (
        set /a PKILLED+=1
        echo   [!PKILLED!/%PLIST_COUNT%] Killing: !PNAME!
        taskkill /IM "!PNAME!" /F >nul 2>&1
        call :LOG "Killed process: !PNAME!"
    )
)
timeout /t 1 >nul

call :PROGRESS 12 %KTOTAL% "Boosting priority of active app"
for /f "tokens=2" %%p in ('powershell -NoProfile -Command "(Get-Process | Where-Object {$_.MainWindowHandle -eq (Add-Type -MemberDefinition '\''[DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow();'\'' -Name Win32 -Namespace Win32Functions -PassThru)::GetForegroundWindow()}).Id"') do (
    wmic process where ProcessId=%%p CALL setpriority "128" >nul 2>&1
    call :LOG "Boosted priority for foreground process PID %%p"
)

call :PROGRESS 13 %KTOTAL% "Trimming RAM (clearing working sets)"
powershell -NoProfile -Command "Get-Process | ForEach-Object { try { $_.MinWorkingSet = $_.MinWorkingSet } catch {} }" >nul 2>&1

cls
echo ============================================================
echo                          IKASS
echo ============================================================
echo   [##############################] 100%%
echo   KILL MODE COMPLETE
echo ============================================================
echo.
echo   Background apps, startup, notifications, updates - OFF
echo   Visual effects OFF, High Performance mode ON
echo   Temp files cleaned, RAM trimmed, %PKILLED% process(es) killed
echo   Log saved to: %LOG_FILE%
echo.
call :LOG "===== KILL MODE COMPLETE (%PKILLED% processes killed) ====="
pause
goto MENU

:: ============================================================
:: 2. RESTART EVERYTHING  (9 tracked steps, live progress bar)
:: ============================================================
:RESTART
call :LOG "===== RESTART MODE STARTED ====="
set "RTOTAL=9"

call :PROGRESS 1 %RTOTAL% "Restoring startup entries"
if exist "%BACKUP_DIR%\startup_backup_hkcu.reg" reg import "%BACKUP_DIR%\startup_backup_hkcu.reg" >nul 2>&1
if exist "%BACKUP_DIR%\startup_backup_hklm.reg" reg import "%BACKUP_DIR%\startup_backup_hklm.reg" >nul 2>&1
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\StartUp_disabled" (
    ren "%APPDATA%\Microsoft\Windows\Start Menu\Programs\StartUp_disabled" "StartUp" >nul 2>&1
)

call :PROGRESS 2 %RTOTAL% "Re-enabling background apps"
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications" /v GlobalUserDisabled /t REG_DWORD /d 0 /f >nul 2>&1

call :PROGRESS 3 %RTOTAL% "Re-enabling notifications"
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\PushNotifications" /v ToastEnabled /t REG_DWORD /d 1 /f >nul 2>&1

call :PROGRESS 4 %RTOTAL% "Re-enabling Windows Update"
sc config wuauserv start= auto >nul 2>&1
sc config bits start= auto >nul 2>&1
sc config dosvc start= auto >nul 2>&1
net start wuauserv >nul 2>&1
net start bits >nul 2>&1

call :PROGRESS 5 %RTOTAL% "Restoring visual effects"
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects" /v VisualFXSetting /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" /v TaskbarAnimations /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\DWM" /v EnableAeroPeek /t REG_DWORD /d 1 /f >nul 2>&1

call :PROGRESS 6 %RTOTAL% "Restoring Balanced power plan"
for /f "tokens=4" %%p in ('powercfg /list ^| findstr /C:"Balanced"') do powercfg /setactive %%p >nul 2>&1

call :PROGRESS 7 %RTOTAL% "Restoring network throttling default"
reg delete "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile" /v NetworkThrottlingIndex /f >nul 2>&1

call :PROGRESS 8 %RTOTAL% "Removing metered connection flag"
reg add "HKLM\SOFTWARE\Microsoft\DUSMSvc\1" /v UserSetCost /t REG_DWORD /d 1 /f >nul 2>&1

call :PROGRESS 9 %RTOTAL% "Restarting Explorer"
taskkill /IM explorer.exe /F >nul 2>&1
start explorer.exe

cls
echo ============================================================
echo                          IKASS
echo ============================================================
echo   [##############################] 100%%
echo   RESTART MODE COMPLETE
echo ============================================================
echo.
call :LOG "===== RESTART MODE COMPLETE ====="

set /p wupdate="Windows Update check pannanuma ippo? (Y/N): "
if /I "%wupdate%"=="Y" (
    start ms-settings:windowsupdate
    call :LOG "Opened Windows Update settings"
)

echo.
echo   Ellame normal ah restore pannachu.
echo   Log saved to: %LOG_FILE%
echo.
pause
goto MENU

:: ============================================================
:: 3. EXIT  (real, immediate close - no fallthrough)
:: ============================================================
:EXITMENU
cls
echo [IKASS] Vanakkam! Exiting...
call :LOG "===== SESSION EXIT ====="
timeout /t 1 >nul
endlocal
exit

:: ============================================================
:: HELPER FUNCTIONS  (only ever reached via CALL - never fallthrough)
:: ============================================================
:PROGRESS
:: %1=current step  %2=total steps  %3=step description
setlocal
set /a "PCT=(%~1*100)/%~2"
set /a "FILL=(%~1*30)/%~2"
set "BAR="
for /l %%i in (1,1,%FILL%) do set "BAR=!BAR!#"
set /a "EMPTY=30-FILL"
if %EMPTY% gtr 0 for /l %%i in (1,1,%EMPTY%) do set "BAR=!BAR!-"
cls
echo ============================================================
echo                          IKASS
echo ============================================================
echo   [!BAR!] !PCT!%%
echo   Step %~1 of %~2: %~3...
echo ============================================================
endlocal
call :LOG "Step %~1/%~2: %~3"
goto :EOF

:LOGINIT
echo. >> "%LOG_FILE%"
echo ============================================================ >> "%LOG_FILE%"
echo IKASS Session started: %DATE% %TIME% >> "%LOG_FILE%"
echo ============================================================ >> "%LOG_FILE%"
goto :EOF

:LOG
echo [%DATE% %TIME%] %~1 >> "%LOG_FILE%"
goto :EOF
