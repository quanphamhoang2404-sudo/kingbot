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
echo  [90m                 created by @dkhanh[0m
echo  [37m═══════════════════════════════════════════════════════[0m
echo.

echo  [37m[1/4][0m Dang kiem tra moi truong...
timeout /t 1 >nul

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [91m[LOI][0m Ban chua cai Node.js!
    echo  [37mHay tai tai: https://nodejs.org[0m
    echo.
    pause
    exit /b
)
echo  [37m[OK][0m Da co Node.js
echo.

echo  [37m[2/4][0m Dang tai kingbot.js...
curl -s -o kingbot.js https://raw.githubusercontent.com/quanphamhoang2404-sudo/kingbot/refs/heads/main/kingbot.js
if %errorlevel% neq 0 (
    echo  [91m[LOI][0m Khong the tai kingbot.js
    pause
    exit /b
)
echo  [37m[OK][0m Tai kingbot.js thanh cong

echo  [37m[3/4][0m Kiem tra app.json...

if exist app.json (
    echo  [37m[OK][0m Da co app.json → giữ nguyên dữ liệu (không ghi đè)
) else (
    echo  [37m[!][0m Chua co app.json → dang tai file mau...
    curl -s -o app.json https://raw.githubusercontent.com/quanphamhoang2404-sudo/kingbot/refs/heads/main/app.json
    if %errorlevel% neq 0 (
        echo  [91m[LOI][0m Khong the tai app.json
        pause
        exit /b
    )
    echo  [37m[OK][0m Tai app.json mau thanh cong
)
echo.

echo  [37m[4/4][0m Dang cai dat module mineflayer...
call npm install mineflayer --silent
if %errorlevel% neq 0 (
    echo  [91m[LOI][0m Cai dat module that bai
    pause
    exit /b
)
echo  [37m[OK][0m Cai dat module thanh cong
echo.

echo  [37m═══════════════════════════════════════════════════════[0m
echo  [37m          CAI DAT / UPDATE HOAN TAT![0m
echo  [37m═══════════════════════════════════════════════════════[0m
echo.
echo  [37m• kingbot.js đã được cập nhật[0m
echo  [37m• app.json được giữ nguyên (không mất acc)[0m
echo.
echo  [37mChay bot bang lenh:[0m
echo.
echo      [37mnode kingbot.js[0m
echo.
echo  [90mNhan phim bat ky de dong...[0m
pause >nul
