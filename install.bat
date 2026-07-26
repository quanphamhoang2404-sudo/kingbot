@echo off
chcp 65001 >nul
title AFK PRO - Auto Installer
color 0F

echo.
echo  [37m═══════════════════════════════════════════════════════[0m
echo  [37m     █████╗ ███████╗██╗  ██╗    ██████╗ ██████╗  ██████╗ [0m
echo  [37m    ██╔══██╗██╔════╝██║ ██╔╝    ██╔══██╗██╔══██╗██╔═══██╗[0m
echo  [37m    ███████║█████╗  █████╔╝     ██████╔╝██████╔╝██║   ██║[0m
echo  [37m    ██╔══██║██╔══╝  ██╔═██╗     ██╔═══╝ ██╔══██╗██║   ██║[0m
echo  [37m    ██║  ██║██║     ██║  ██╗    ██║     ██║  ██║╚██████╔╝[0m
echo  [37m    ╚═╝  ╚═╝╚═╝     ╚═╝  ╚═╝    ╚═╝     ╚═╝  ╚═╝ ╚═════╝ [0m
echo  [37m              Multi Account AFK System[0m
echo  [90m                 created by @tin244[0m
echo  [37m═══════════════════════════════════════════════════════[0m
echo.

echo  [37m[1/5][0m Dang kiem tra moi truong...
timeout /t 1 >nul

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [91m[LOI][0m Ban chua cai Node.js!
    echo  [37mHay tai tai: https://nodejs.org[0m
    pause
    exit /b
)
echo  [37m[OK][0m Da co Node.js
echo.

echo  [37m[2/5][0m Dang backup du lieu...
if exist app.json (
    copy /Y app.json app.json.bak >nul
    echo  [37m[OK][0m Da backup app.json → app.json.bak
) else (
    echo  [37m[!][0m Chua co app.json de backup
)
echo.

echo  [37m[3/5][0m Dang tai kingbot.js moi...
curl -s -o kingbot.js https://raw.githubusercontent.com/quanphamhoang2404-sudo/kingbot/refs/heads/main/kingbot.js
if %errorlevel% neq 0 (
    echo  [91m[LOI][0m Khong the tai kingbot.js
    pause
    exit /b
)
echo  [37m[OK][0m Tai kingbot.js thanh cong
echo.

echo  [37m[4/5][0m Kiem tra app.json...
if exist app.json (
    echo  [37m[OK][0m Giu nguyen app.json (khong mat acc)
) else (
    if exist app.json.bak (
        echo  [37m[!][0m Khong thay app.json → khoi phuc tu backup...
        copy /Y app.json.bak app.json >nul
        echo  [37m[OK][0m Da khoi phuc app.json tu backup
    ) else (
        echo  [37m[!][0m Chua co app.json → dang tai file mau...
        curl -s -o app.json https://raw.githubusercontent.com/quanphamhoang2404-sudo/kingbot/refs/heads/main/app.json
        echo  [37m[OK][0m Tai app.json mau thanh cong
    )
)
echo.

echo  [37m[5/5][0m Dang cai dat module...
call npm install mineflayer --silent
if %errorlevel% neq 0 (
    echo  [91m[LOI][0m Cai dat module that bai
    pause
    exit /b
)
echo  [37m[OK][0m Cai dat module thanh cong
echo.

echo  [37m═══════════════════════════════════════════════════════[0m
echo  [37m          UPDATE HOAN TAT - DU LIEU DA DUOC BAO VE[0m
echo  [37m═══════════════════════════════════════════════════════[0m
echo.
echo  [37m• kingbot.js đã cập nhật[0m
echo  [37m• app.json được giữ nguyên + có bản backup[0m
echo.
echo  [37mChay bot:[0m
echo      [37mnode kingbot.js[0m
echo.
pause >nul
