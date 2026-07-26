const originalWarn = console.warn;
console.warn = function (...args) {
    if (typeof args[0] === 'string' && args[0].includes('Ignoring block entities as chunk failed to load')) return;
    originalWarn.apply(console, args);
};

const mineflayer = require('mineflayer');
const http = require('http');
const readline = require("readline");
const fs = require('fs');

process.on('uncaughtException', (err) => {
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.message.includes('ECONNRESET')) return;
    console.error('[Hệ Thống] Lỗi bất ngờ:', err);
});

let config;
try {
    config = require('./app.json');
} catch (e) {
    console.log("❌ Không tìm thấy file app.json hoặc file bị lỗi format!");
    process.exit(1);
}

if (!config.App) config.App = { Webhook: "" };
if (!config.Accounts) config.Accounts = {};
if (!config.CurrentAccounts) config.CurrentAccounts = [];
if (config.Chat === undefined) config.Chat = false;
if (config.IgnoreError === undefined) config.IgnoreError = true;
config.AntiAFK = true;

let CurrentTab = "Home";
let running = true;
let lastError = null;
const reconnectTracker = {};

let selectedAccounts = [];
if (config.CurrentAccounts && Array.isArray(config.CurrentAccounts)) {
    selectedAccounts = config.CurrentAccounts.filter(acc => config.Accounts[acc]);
    if (selectedAccounts.length !== config.CurrentAccounts.length) {
        config.CurrentAccounts = selectedAccounts;
        saveConfig();
    }
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

function saveConfig() {
    fs.writeFileSync('./app.json', JSON.stringify(config, null, 4), 'utf8');
}

function resolveUsername(input) {
    const accountKeys = Object.keys(config.Accounts);
    const idx = parseInt(input);
    if (!isNaN(idx) && idx > 0 && idx <= accountKeys.length) {
        return accountKeys[idx - 1];
    }
    return input;
}

function resolveText(raw) {
    if (!raw) return '';
    let obj = raw;
    if (typeof raw === 'string') {
        try { obj = JSON.parse(raw); } 
        catch (e) { return raw.replace(/§[0-9a-fk-or]/gi, '').trim(); }
    }
    let text = '';
    if (obj.text !== undefined) text = obj.text;
    if (obj.extra && Array.isArray(obj.extra)) {
        text += obj.extra.map(item => typeof item === 'string' ? item : (item.text || '')).join('');
    }
    if (!text && typeof obj === 'object') text = JSON.stringify(obj);
    else if (!text) text = String(obj);
    return text.replace(/§[0-9a-fk-or]/gi, '').trim();
}

// ==================== PROXY PARSER MẠNH ====================
function parseProxyInput(input) {
    if (!input) return null;
    input = input.trim().replace(/^https?:\/\//i, '');

    // user:pass@ip:port
    let match = input.match(/^([^:@\s]+):([^@\s]+)@([\d.]+):(\d+)$/);
    if (match) {
        return {
            enable: true,
            ip: match[3],
            port: parseInt(match[4]),
            username: match[1],
            password: match[2]
        };
    }

    // ip:port:user:pass
    match = input.match(/^([\d.]+):(\d+):([^:]+):(.+)$/);
    if (match) {
        return {
            enable: true,
            ip: match[1],
            port: parseInt(match[2]),
            username: match[3],
            password: match[4]
        };
    }

    // ip:port
    match = input.match(/^([\d.]+):(\d+)$/);
    if (match) {
        return {
            enable: true,
            ip: match[1],
            port: parseInt(match[2])
        };
    }

    // ip port
    match = input.match(/^([\d.]+)\s+(\d+)$/);
    if (match) {
        return {
            enable: true,
            ip: match[1],
            port: parseInt(match[2])
        };
    }

    // ip port user pass
    match = input.match(/^([\d.]+)\s+(\d+)\s+(\S+)\s+(.+)$/);
    if (match) {
        return {
            enable: true,
            ip: match[1],
            port: parseInt(match[2]),
            username: match[3],
            password: match[4]
        };
    }

    return null;
}

// ==================== BULK ADD ====================
function parseBulkAccountLine(line) {
    line = line.trim();
    if (!line || line.toLowerCase() === 'done') return null;

    if (line.includes(':')) {
        const [user, ...passParts] = line.split(':');
        const pass = passParts.join(':').trim();
        if (user && pass) return { username: user.trim(), pass };
    }

    const parts = line.split(/\s+/);
    if (parts.length >= 2) {
        return { username: parts[0], pass: parts.slice(1).join(' ') };
    }

    return null;
}

async function handleBulkAdd() {
    console.log(`\n\x1b[37m▸ Chế độ Bulk Add\x1b[0m`);
    console.log(`\x1b[90mDán nhiều tài khoản (mỗi dòng 1 acc). Gõ dòng trống hoặc "done" để kết thúc.\x1b[0m`);
    console.log(`\x1b[90mĐịnh dạng hỗ trợ: user:pass  hoặc  user pass\x1b[0m\n`);

    let added = 0;
    let skipped = 0;

    while (true) {
        const line = await askQuestion("\x1b[37m>\x1b[0m ");
        if (!line.trim() || line.trim().toLowerCase() === 'done') break;

        const parsed = parseBulkAccountLine(line);
        if (!parsed) {
            console.log(`\x1b[31m  ✗ Bỏ qua dòng không hợp lệ\x1b[0m`);
            skipped++;
            continue;
        }

        if (config.Accounts[parsed.username]) {
            console.log(`\x1b[33m  ⚠ ${parsed.username} đã tồn tại → bỏ qua\x1b[0m`);
            skipped++;
            continue;
        }

        config.Accounts[parsed.username] = {
            pass: parsed.pass,
            proxy: { enable: false, ip: "", port: 0 }
        };
        console.log(`\x1b[37m  ✔ Đã thêm: ${parsed.username}\x1b[0m`);
        added++;
    }

    if (added > 0) saveConfig();
    console.log(`\n\x1b[37m→ Hoàn tất: Thêm ${added} acc, bỏ qua ${skipped} dòng\x1b[0m`);
    await new Promise(r => setTimeout(r, 1500));
}

function render_logo() {
    console.log(`
\x1b[37m═══════════════════════════════════════════════════════\x1b[0m
\x1b[1m\x1b[36m     █████╗ ███████╗██╗  ██╗    ██████╗ ██████╗  ██████╗ 
    ██╔══██╗██╔════╝██║ ██╔╝    ██╔══██╗██╔══██╗██╔═══██╗
    ███████║█████╗  █████╔╝     ██████╔╝██████╔╝██║   ██║
    ██╔══██║██╔══╝  ██╔═██╗     ██╔═══╝ ██╔══██╗██║   ██║
    ██║  ██║██║     ██║  ██╗    ██║     ██║  ██║╚██████╔╝
    ╚═╝  ╚═╝╚═╝     ╚═╝  ╚═╝    ╚═╝     ╚═╝  ╚═╝ ╚═════╝ \x1b[0m
\x1b[94m              Multi Account AFK System\x1b[0m
\x1b[90m                 created by @dkhanh\x1b[0m
\x1b[37m═══════════════════════════════════════════════════════\x1b[0m
`);
}

function Render() {
    console.clear();
    console.log('\n');
    render_logo();
    const accountKeys = Object.keys(config.Accounts);

    if (CurrentTab === "Home") {
        console.log(`\x1b[33m▸ Danh sách tài khoản đã thêm (${accountKeys.length}):\x1b[0m`);
        if (accountKeys.length === 0) {
            console.log(`  \x1b[90m(Chưa có tài khoản nào)\x1b[0m`);
        } else {
            accountKeys.forEach((acc, index) => {
                const isProxy = config.Accounts[acc].proxy?.enable;
                console.log(`  [\x1b[36m${index + 1}\x1b[0m] \x1b[37m${acc}\x1b[0m ${isProxy ? '\x1b[35m(Proxy)\x1b[0m' : ''}`);
            });
        }

        console.log(`\n\x1b[36m▸ Tài khoản đang chọn để treo (${selectedAccounts.length}):\x1b[0m`);
        if (selectedAccounts.length === 0) {
            console.log(`  \x1b[90m(Chưa chọn tài khoản nào)\x1b[0m`);
        } else {
            selectedAccounts.forEach((acc, index) => {
                const isProxy = config.Accounts[acc].proxy?.enable;
                console.log(`  [\x1b[36m${index + 1}\x1b[0m] \x1b[4m\x1b[37m${acc}\x1b[0m ${isProxy ? '\x1b[35m(Proxy)\x1b[0m' : ''}`);
            });
        }

        console.log(`\n\x1b[90m───────────────────────────────────────────────────────\x1b[0m`);
        console.log(`  \x1b[37mRun\x1b[0m            → Chạy toàn bộ bot đã chọn`);
        console.log(`  \x1b[37mAcc <tên/số>\x1b[0m   → Thêm / xóa bot khỏi danh sách treo`);
        console.log(`  \x1b[37mBulk\x1b[0m           → Thêm hàng loạt tài khoản`);
        console.log(`  \x1b[37mSetting\x1b[0m        → Quản lý tài khoản & proxy`);
        console.log(`  \x1b[37mHelp\x1b[0m           → Xem hướng dẫn đầy đủ`);
        console.log(`  \x1b[37mExit\x1b[0m           → Thoát chương trình`);
    }
    else if (CurrentTab === "Setting") {
        console.log(`\x1b[33m▸ Danh sách tài khoản (${accountKeys.length}):\x1b[0m`);
        accountKeys.forEach((acc, index) => {
            const isProxy = config.Accounts[acc].proxy?.enable;
            console.log(`  [\x1b[36m${index + 1}\x1b[0m] \x1b[37m${acc}\x1b[0m ${isProxy ? '\x1b[35m(Proxy)\x1b[0m' : ''}`);
        });

        const webhookStatus = config.App.Webhook ? "\x1b[37mOnline\x1b[0m" : "\x1b[31mOffline\x1b[0m";
        console.log(`\n▸ Webhook: [${webhookStatus}] \x1b[34m${config.App.Webhook || "Trống"}\x1b[0m`);
        console.log(`▸ Anti-AFK: \x1b[37mLuôn Bật\x1b[0m`);

        console.log(`\n\x1b[90m───────────────────────────────────────────────────────\x1b[0m`);
        console.log(`  \x1b[37mAdd <user> <pass>\x1b[0m     → Thêm tài khoản`);
        console.log(`  \x1b[37mBulk\x1b[0m                  → Thêm hàng loạt tài khoản`);
        console.log(`  \x1b[37mDel <user/số>\x1b[0m         → Xóa tài khoản`);
        console.log(`  \x1b[37mProxy <user> <proxy>\x1b[0m  → Gán proxy`);
        console.log(`  \x1b[37mProxy <user> ON/OFF\x1b[0m   → Bật/tắt proxy`);
        console.log(`  \x1b[37mWebhook <url>\x1b[0m         → Thêm Discord webhook`);
        console.log(`  \x1b[37mHome\x1b[0m                  → Quay lại menu chính`);
    }
    else if (CurrentTab === "Help") {
        console.log(`\x1b[33m▸ Danh sách lệnh:\x1b[0m\n`);
        console.log(`  Help`);
        console.log(`  Run`);
        console.log(`  Acc <username/index>`);
        console.log(`  Add <username> <password>`);
        console.log(`  Bulk`);
        console.log(`  Del <username/index>`);
        console.log(`  Proxy <username/index> <proxy>`);
        console.log(`  Proxy <username/index> ON`);
        console.log(`  Proxy <username/index> OFF`);
        console.log(`  Webhook <url>`);
        console.log(`  Setting`);
        console.log(`  Home`);
        console.log(`  Exit`);
        console.log(`\n\x1b[90m───────────────────────────────────────────────────────\x1b[0m`);
        console.log(`  Nhập \x1b[37mHome\x1b[0m để quay lại menu chính`);
    }

    if (lastError) {
        console.log(`\n\x1b[31m❌ LỖI: ${lastError}\x1b[0m`);
        lastError = null;
    }
}

async function sendDiscordWebhook(username, title, description, color = 16711680) {
    const webhookUrl = config.App.Webhook;
    if (!webhookUrl) return;

    const payload = {
        username: "AFK PRO System",
        avatar_url: "https://i.pinimg.com/736x/2c/8e/d8/2c8ed804aa99adbae923768f134c2f63.jpg",
        embeds: [{
            title: title,
            description: `**User:** \`${username}\`\n${description}`,
            color: color,
            timestamp: new Date().toISOString()
        }]
    };

    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (err) {}
}

function maskIp(ip) {
    if (!ip) return 'Unknown';
    const parts = ip.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.***.***`;
    return ip;
}

// ==================== ANTI-AFK ENGINE ====================
function startAntiAFK(bot, username) {
    const log = (...args) => console.log(`[\x1b[37m${username}\x1b[0m]:`, ...args);
    const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    const lookAround = () => {
        if (!bot.entity) return;
        const yaw = bot.entity.yaw + (Math.random() * 1.2 - 0.6);
        const pitch = (Math.random() * 0.6 - 0.3);
        bot.look(yaw, pitch, true);
    };

    const randomMove = () => {
        if (!bot.entity) return;
        const directions = ['forward', 'back', 'left', 'right'];
        const dir = directions[random(0, 3)];
        bot.setControlState(dir, true);
        setTimeout(() => bot.setControlState(dir, false), random(400, 1200));
    };

    const jumpOrSneak = () => {
        if (!bot.entity) return;
        if (Math.random() > 0.5) {
            bot.setControlState('jump', true);
            setTimeout(() => bot.setControlState('jump', false), 250);
        } else {
            bot.setControlState('sneak', true);
            setTimeout(() => bot.setControlState('sneak', false), random(800, 1800));
        }
    };

    const swing = () => {
        if (bot.entity) bot.swingArm('right');
    };

    const scheduleNext = () => {
        const delay = random(18000, 45000);
        setTimeout(() => {
            if (!bot.entity || bot._client?.ended) return;

            const action = random(1, 10);
            if (action <= 4) randomMove();
            else if (action <= 7) lookAround();
            else if (action <= 9) jumpOrSneak();
            else swing();

            if (Math.random() > 0.7) {
                setTimeout(() => {
                    if (Math.random() > 0.5) lookAround();
                    else swing();
                }, random(800, 2000));
            }

            scheduleNext();
        }, delay);
    };

    setTimeout(() => {
        log(`\x1b[36m🛡️ Anti-AFK Engine đã kích hoạt\x1b[0m`);
        scheduleNext();
    }, 8000);
}

// ==================== BOT CORE ====================
function startBot(username, accountConfig) {
    let isverified = false;
    let inkingsmp = false;
    let retryMenuTimer = null;
    let reconnectTimer = null;
    let hasEnded = false;
    let hasSentAuth = false;

    if (!reconnectTracker[username]) {
        reconnectTracker[username] = { attempts: [] };
    }

    const pass = accountConfig.pass;
    const proxyConfig = accountConfig.proxy;

    const log = (...args) => console.log(`[\x1b[37m${username}\x1b[0m]:`, ...args);
    const logErr = (...args) => {
        if (!config.IgnoreError) console.error(`❌ [\x1b[31m${username}\x1b[0m]:`, ...args);
    };

    let botOptions = {
        host: 'sgp.kingmc.vn',
        username: username,
        version: '1.16.5'
    };

    if (proxyConfig && proxyConfig.enable) {
        log(`Đang khởi tạo qua HTTP PROXY: ${proxyConfig.ip}:${proxyConfig.port}...`);

        botOptions.port = 25565;
        botOptions.connect = (client) => {
            const reqOptions = {
                host: proxyConfig.ip,
                port: proxyConfig.port,
                method: 'CONNECT',
                path: 'sgp.kingmc.vn:25565'
            };

            if (proxyConfig.username && proxyConfig.password) {
                const auth = Buffer.from(`${proxyConfig.username}:${proxyConfig.password}`).toString('base64');
                reqOptions.headers = { 'Proxy-Authorization': `Basic ${auth}` };
            }

            const req = http.request(reqOptions);

            req.on('connect', (res, socket) => {
                socket.on('error', (err) => logErr(`Lỗi Socket Proxy: ${err.message}`));

                if (res.statusCode !== 200) {
                    logErr(`Proxy từ chối kết nối. Mã: ${res.statusCode}`);
                    sendDiscordWebhook(username, "⛔ Proxy Từ Chối", `Mã lỗi: **${res.statusCode}**\nIP: \`${maskIp(proxyConfig.ip)}\``);
                    return;
                }
                log('\x1b[96m✔️ Proxy sống - Đã vào được server\x1b[0m');
                sendDiscordWebhook(username, "✅ LOGGED (Proxy)", `Proxy: \`${maskIp(proxyConfig.ip)}\``, 5763719);
                client.setSocket(socket);
                client.emit('connect');
            });

            req.on('error', (err) => {
                logErr('Proxy chết hoặc sai cấu hình:', err.message);
                sendDiscordWebhook(username, "❌ Proxy Chết", `Lỗi: \`${err.message}\`\nIP: \`${maskIp(proxyConfig.ip)}\``);
            });

            req.end();
        };
    } else {
        log('Đang khởi tạo bot KHÔNG dùng proxy...');
    }

    const bot = mineflayer.createBot(botOptions);

    function cleanTimers() {
        if (retryMenuTimer) { clearTimeout(retryMenuTimer); retryMenuTimer = null; }
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    }

    function handleReconnect(isGhostSession = false) {
        if (hasEnded) return;
        hasEnded = true;
        cleanTimers();

        const tracker = reconnectTracker[username];
        const now = Date.now();
        const fifteenMinutes = 15 * 60 * 1000;

        tracker.attempts = tracker.attempts.filter(t => (now - t) < fifteenMinutes);

        if (tracker.attempts.length >= 10) {
            logErr(`⚠️ Bot reconnect quá 10 lần / 15 phút → HỦY TREO BOT NÀY`);
            sendDiscordWebhook(username, "🚫 HỦY BOT", `Reconnect vượt giới hạn **${tracker.attempts.length}/10** trong 15 phút`, 16711680);
            return;
        }

        let delay = isGhostSession ? 30000 : 12000;
        if (!isGhostSession) tracker.attempts.push(now);

        log(`⚠️ Mất kết nối. Reconnect lần ${tracker.attempts.length}/10 sau ${delay / 1000}s...`);
        sendDiscordWebhook(username, "🔄 RECONNECTING", `Lần thứ **${tracker.attempts.length}/10** sau ${delay / 1000}s`, 3447003);

        reconnectTimer = setTimeout(() => startBot(username, accountConfig), delay);
    }

    function sendAuthCommand(cmd) {
        if (hasSentAuth || hasEnded) return;
        hasSentAuth = true;
        bot.chat(cmd);
        log(`⚡ Đã gửi lệnh xác thực: ${cmd}`);
    }

    function find_game_menu() {
        return bot.inventory.items().find(item => item.name === 'clock');
    }

    async function to_afk_zone() {
        if (hasEnded) return;
        log('⚡ Đang gõ lệnh /afk...');
        bot.chat('/afk');
    }

    async function selectServer() {
        if (hasEnded) return;
        if (retryMenuTimer) clearTimeout(retryMenuTimer);

        const clock = find_game_menu();
        if (!clock) {
            logErr('Không tìm thấy Đồng hồ. Thử lại sau 5s...');
            retryMenuTimer = setTimeout(selectServer, 5000);
            return;
        }

        try {
            await bot.equip(clock, 'hand');
            await new Promise(r => setTimeout(r, 500));
            if (hasEnded) return;

            bot.activateItem();
            log('⚡ Đã dùng Đồng hồ, đang đợi menu...');

            retryMenuTimer = setTimeout(() => {
                log('⚠️ Menu chưa mở. Thử lại...');
                selectServer();
            }, 6000);
        } catch (err) {
            logErr('Lỗi khi dùng đồng hồ:', err.message);
            retryMenuTimer = setTimeout(selectServer, 5000);
        }
    }

    bot.once('login', () => {
        if (hasEnded) return;
        setTimeout(() => {
            if (hasEnded || hasSentAuth) return;
            sendAuthCommand('/dn ' + pass);
        }, 1000);
    });

    bot.on('windowOpen', async (window) => {
        if (hasEnded) return;
        if (retryMenuTimer) { clearTimeout(retryMenuTimer); retryMenuTimer = null; }

        let title = '';
        try {
            title = window.title ? (JSON.parse(window.title).text || window.title) : '';
        } catch { title = window.title || ''; }

        log(`💻 Mở giao diện: "${title}"`);

        await new Promise(r => setTimeout(r, 2000));
        if (hasEnded || bot.currentWindow?.id !== window.id) return;

        if (title.length < 10) {
            const kingSmpSlot = window.slots.find(item => item && item.displayName?.includes('KingSMP'));
            const target = kingSmpSlot ? kingSmpSlot.slot : 24;
            try {
                log(`👉 Click KingSMP ô [${target}]...`);
                await bot.clickWindow(target, 0, 0);
                inkingsmp = true;
            } catch (err) {
                if (err.message.includes("didn't respond to transaction")) inkingsmp = true;
                else logErr(`Lỗi click: ${err.message}`);
            }
        } else {
            const target = 1;
            try {
                log(`👉 Click AFK 1 ô [${target}]...`);
                await bot.clickWindow(target, 0, 0);
                log('✔️ Đã chọn AFK 1 thành công!');
                bot.clearControlStates();
            } catch (err) {
                if (err.message.includes("didn't respond to transaction")) {
                    log('✔️ Đã chọn AFK 1 thành công!');
                    bot.clearControlStates();
                } else {
                    logErr('⚠️ WARNING:', err.message);
                }
            }
        }
    });

    bot.on('spawn', () => {
        if (hasEnded) return;
        log('\x1b[93mBot đã vào game thành công!\x1b[0m');

        if (find_game_menu()) {
            log('📌 Phát hiện bot đang ở sảnh HUB.');
            isverified = true;
            selectServer();
        } else if (!find_game_menu() && isverified) {
            inkingsmp = true;
            setTimeout(() => to_afk_zone(), 3000);
        } else {
            bot.chat('/dk ' + pass);
        }
    });

    bot.on('kicked', (reason) => {
        const cleanReason = resolveText(reason);
        log('Bị kick:', cleanReason);

        let isGhostSession = false;
        const normalized = cleanReason.toLowerCase();
        if (normalized.includes('đang chơi') || normalized.includes('đã kết nối tới proxy') ||
            normalized.includes('already logged in') || normalized.includes('already connected')) {
            isGhostSession = true;
        }

        sendDiscordWebhook(username, "⚠️ Bị Kick", `Lý do: \`${cleanReason}\``, 16753920);
        handleReconnect(isGhostSession);
    });

    bot.on('error', (err) => {
        logErr('Lỗi kết nối:', err.message);
        sendDiscordWebhook(username, "💥 Lỗi Kết Nối", `Lỗi: \`${err.message}\``);
    });

    bot.on('message', (jsonMsg) => {
        if (hasEnded) return;
        const plainText = jsonMsg.toString();

        if (config.Chat) log(`[CHAT]: ${plainText}`);

        if (plainText.includes('ký với lệnh') || plainText.includes('hãy đăng kí')) {
            bot.chat('/dk ' + pass);
        }
        if (plainText.includes('Đăng nhập thành công')) {
            isverified = true;
        }
        if (plainText.includes('giây rồi mới mở menu')) {
            log("⚠️ Bị limit mở menu. Chờ 5s...");
            if (retryMenuTimer) clearTimeout(retryMenuTimer);
            setTimeout(() => {
                if (hasEnded) return;
                inkingsmp = false;
                selectServer();
            }, 5000);
        }
        if (plainText.toLowerCase().includes('afk')) {
            log(`\x1b[36m✔️ Đã vào khu vực AFK thành công\x1b[0m`);
            startAntiAFK(bot, username);
        }
        if (plainText.includes("có tài khoảng cùng ip của ban") || plainText.includes("cùng ip")) {
            logErr("⚠️ Phát hiện trùng IP (hãy đổi Proxy)");
            sendDiscordWebhook(username, "⚠️ Trùng IP", "Đã có tài khoản khác chạy cùng IP");
        }
        if (plainText.includes('chưa liên kết')) {
            sendDiscordWebhook(username, "Chưa liên kết Discord", "Bị limit Shard");
        }
    });

    bot.on('end', () => {
        if (!hasEnded) handleReconnect(false);
    });
}

// ==================== COMMAND HANDLER ====================
async function handleCommand(input) {
    const args = input.trim().split(" ").filter(Boolean);
    if (args.length === 0) return null;

    const command = args[0].toLowerCase();

    if (command === 'exit') {
        running = false;
    } else if (command === 'home') {
        CurrentTab = 'Home';
    } else if (command === 'setting') {
        CurrentTab = 'Setting';
    } else if (command === 'help') {
        CurrentTab = 'Help';
    }
    else if (command === 'bulk') {
        await handleBulkAdd();
    }
    else if (command === 'add') {
        if (!args[1] || !args[2]) {
            lastError = "Cú pháp: Add <username> <pass>";
        } else {
            const username = args[1];
            if (!config.Accounts[username]) {
                config.Accounts[username] = {
                    pass: args[2],
                    proxy: { enable: false, ip: "", port: 0 }
                };
                saveConfig();
            } else {
                lastError = `Tài khoản '${username}' đã tồn tại!`;
            }
        }
    }
    else if (command === 'del') {
        if (!args[1]) {
            lastError = "Cú pháp: Del <username/index>";
        } else {
            const username = resolveUsername(args[1]);
            if (config.Accounts[username]) {
                delete config.Accounts[username];
                selectedAccounts = selectedAccounts.filter(acc => acc !== username);
                config.CurrentAccounts = selectedAccounts;
                saveConfig();
            } else {
                lastError = `Không tìm thấy tài khoản '${args[1]}'`;
            }
        }
    }
    else if (command === 'acc') {
        if (!args[1]) {
            lastError = "Cú pháp: Acc <username/index>";
        } else {
            const username = resolveUsername(args[1]);
            if (config.Accounts[username]) {
                if (selectedAccounts.includes(username)) {
                    selectedAccounts = selectedAccounts.filter(acc => acc !== username);
                } else {
                    selectedAccounts.push(username);
                }
                config.CurrentAccounts = selectedAccounts;
                saveConfig();
            } else {
                lastError = `Không tìm thấy tài khoản '${args[1]}'`;
            }
        }
    }
    else if (command === 'webhook') {
        if (!args[1]) {
            lastError = "Cú pháp: Webhook <url>";
        } else {
            config.App.Webhook = args[1];
            saveConfig();
        }
    }
    else if (command === 'proxy') {
        if (!args[1] || !args[2]) {
            lastError = "Cú pháp: Proxy <user> <proxy | ON | OFF>";
        } else {
            const username = resolveUsername(args[1]);
            if (!config.Accounts[username]) {
                lastError = `Không tìm thấy tài khoản '${args[1]}'`;
            } else {
                const action = args[2].toUpperCase();

                if (action === 'ON') {
                    if (!config.Accounts[username].proxy?.ip) {
                        lastError = "Tài khoản này chưa có proxy để bật!";
                    } else {
                        config.Accounts[username].proxy.enable = true;
                        saveConfig();
                    }
                } else if (action === 'OFF') {
                    config.Accounts[username].proxy.enable = false;
                    saveConfig();
                } else {
                    const proxyStr = args.slice(2).join(' ');
                    const parsed = parseProxyInput(proxyStr);

                    if (parsed) {
                        config.Accounts[username].proxy = parsed;
                        saveConfig();
                        console.log(`\n\x1b[37m✔ Đã gán proxy ${parsed.ip}:${parsed.port} cho ${username}\x1b[0m`);
                        await new Promise(r => setTimeout(r, 1000));
                    } else {
                        lastError = "Định dạng proxy không hợp lệ!";
                    }
                }
            }
        }
    }
    else if (command === 'run') {
        if (selectedAccounts.length === 0) {
            lastError = "Chưa chọn tài khoản nào! Dùng lệnh Acc trước.";
        } else {
            console.clear();
            console.log("\x1b[33m═══════════════════════════════════════════════════════\x1b[0m");
            console.log("\x1b[33m     HỆ THỐNG ĐANG KHỞI CHẠY BOT - TẮT MENU TƯƠNG TÁC\x1b[0m");
            console.log("\x1b[33m          BẤM CTRL + C ĐỂ DỪNG TOÀN BỘ CHƯƠNG TRÌNH\x1b[0m");
            console.log("\x1b[33m═══════════════════════════════════════════════════════\x1b[0m\n");

            selectedAccounts.forEach(acc => {
                const accConfig = config.Accounts[acc];
                console.log(`→ Starting: \x1b[37m${acc}\x1b[0m | Proxy: ${accConfig.proxy?.enable ? accConfig.proxy.ip : "Không"}`);
                startBot(acc, accConfig);
            });

            // Giữ process sống
            process.stdin.resume();
            setInterval(() => {}, 1 << 30);

            return "START_BOTS";
        }
    }
    else {
        lastError = `Lệnh '${command}' không tồn tại. Nhập Help để xem.`;
    }
    return null;
}

async function main() {
    while (running) {
        Render();
        const answer = await askQuestion("\n\x1b[36m>\x1b[0m ");
        const status = await handleCommand(answer);

        if (status === "START_BOTS") {
            rl.close();
            return;
        }
    }

    console.log("Exited.");
    rl.close();
    process.exit(0);
}

main();
