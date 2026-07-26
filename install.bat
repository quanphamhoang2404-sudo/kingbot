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

:: Kiểm tra Node.js
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

echo  [37m[3/4][0m Dang tai app.json...
curl -s -o app.json https://raw.githubusercontent.com/quanphamhoang2404-sudo/kingbot/refs/heads/main/app.json
if %errorlevel% neq 0 (
    echo  [91m[LOI][0m Khong the tai app.json
    pause
    exit /b
)
echo  [37m[OK][0m Tai app.json thanh cong
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
echo  [37m          CAI DAT HOAN TAT THANH CONG![0m
echo  [37m═══════════════════════════════════════════════════════[0m
echo.
echo  [37mDe chay bot, hay nhap lenh:[0m
echo.
echo      [37mnode kingbot.js[0m
echo.
echo  [90mNhan phim bat ky de dong cua so...[0m
pause >nul
