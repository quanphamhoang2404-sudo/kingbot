const originalWarn = console.warn;
console.warn = function (...args) {
    if (typeof args[0] === 'string' && args[0].includes('Ignoring block entities as chunk failed to load')) { return; }
    originalWarn.apply(console, args);
};

const mineflayer = require('mineflayer');
const http = require('http');
const readline = require("readline");
const fs = require('fs');

process.on('uncaughtException', (err) => {
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.message.includes('ECONNRESET')) {
        return; 
    }
    console.error('[Hệ Thống] Phát hiện lỗi bất ngờ:', err);
});

let config;
try {
    config = require('./app2.json');
} catch (e) {
    console.log("Không tìm thấy file app.json hoặc file bị lỗi format!");
    process.exit(1);
}

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
        try {
            obj = JSON.parse(raw);
        } catch (e) {
            return raw.replace(/§[0-9a-fk-or]/gi, '').trim();
        }
    }
    
    let text = '';
    if (obj.text !== undefined) {
        text = obj.text;
    }
    if (obj.extra && Array.isArray(obj.extra)) {
        text += obj.extra.map(item => {
            if (typeof item === 'string') return item;
            return item.text || JSON.stringify(item);
        }).join('');
    }
    
    if (!text && typeof obj === 'object') {
        text = JSON.stringify(obj);
    } else if (!text) {
        text = String(obj);
    }
    
    return text.replace(/§[0-9a-fk-or]/gi, '').trim();
}

function render_logo() {
    console.log(`
\x1b[92m_______________________________________________\x1b[0m

\x1b[1m\x1b[34m    ╦ ╦┌─┐┬  ┬  ┌─┐  ┬ ┬┌─┐┬─┐┬  ┌┬┐
\x1b[35m    ╠═╣├┤ │  │  │ │  ││││ │├┬┘│   ││
\x1b[36m    ╩ ╩└─┘┴─┘┴─┘└─┘  └┴┘└─┘┴└─┴─┘─┴┘\x1b[0m
\x1b[94mcreated by\x1b[0m: \x1b[46m @dkhanh \x1b[0m - \x1b[33mHave a good day:3
\x1b[92m_______________________________________________\x1b[0m\n`)
}
function Render() {
    console.clear();
    console.log('\n')
    render_logo()
    const accountKeys = Object.keys(config.Accounts);

    if (CurrentTab === "Home") {
        console.log(`\x1b[33mDanh sách tài khoản đã thêm (${accountKeys.length}):\x1b[0m`);
        accountKeys.forEach((acc, index) => {
            const isProxy = config.Accounts[acc].proxy && config.Accounts[acc].proxy.enable;
            console.log(`[${index + 1}]: \x1b[32m${acc} \x1b[0m ${isProxy ? '(Proxy)' : ''}`);
        });

        console.log(`\n\x1b[36mTài khoản đã chọn (${selectedAccounts.length}):\x1b[0m`);
        selectedAccounts.forEach((acc, index) => {
            const isProxy = config.Accounts[acc].proxy && config.Accounts[acc].proxy.enable;
            console.log(`[${index + 1}]: \x1b[4m\x1b[32m${acc}\x1b[0m ${isProxy ? '(Proxy)' : ''}`);
        });

        console.log(`\n- \x1b[38;5;129mNhập \x1b[92m'Exit' \x1b[94mđể thoát`);
        console.log(`- \x1b[38;5;129mNhập \x1b[92m'Help' \x1b[94mđể xem lệnh`);
        console.log(`- \x1b[38;5;129mNhập \x1b[92m'Run' \x1b[94mđể chạy bot`);
        console.log(`- \x1b[38;5;129mNhập \x1b[92m'Acc <username/index>' \x1b[94mđể thêm/xóa bot khỏi danh sách treo`);
        console.log(`- \x1b[38;5;129mNhập \x1b[92m'Setting' \x1b[94mđể cài đặt proxy/account\x1b[0m`);

    }
    else if (CurrentTab === "Setting") {
        console.log(`\x1b[33mDanh sách tài khoản đã thêm (${accountKeys.length}):\x1b[0m`);
        accountKeys.forEach((acc, index) => {
            const isProxy = config.Accounts[acc].proxy && config.Accounts[acc].proxy.enable;
            console.log(`[${index + 1}]: \x1b[32m${acc} \x1b[0m ${isProxy ? '(Proxy)' : ''}`);
        });

        const webhookStatus = config.App.Webhook ? "Online" : "Offline";
        console.log(`\nWebhook Url [Status: \x1b[32m${webhookStatus}\x1b[0m]: \x1b[34m${config.App.Webhook || "Trống"}\x1b[0m`);

        console.log(`\n- \x1b[94mNhập \x1b[92m'Exit' \x1b[93mđể thoát`);
        console.log(`- \x1b[94mNhập \x1b[92m'Help' \x1b[93mđể xem lệnh`);
        console.log(`- \x1b[94mNhập \x1b[92m'Home' \x1b[93mđể về Tab chính`);
        console.log(`- \x1b[94mNhập \x1b[92m'Add <username> <pass>' \x1b[93mđể thêm tài khoản`);
        console.log(`- \x1b[94mNhập \x1b[92m'Del <username/index>' \x1b[93mđể xóa tài khoản`);
        console.log(`- \x1b[94mNhập \x1b[92m'Proxy' \x1b[93mđể thêm/tắt-bật proxy`);
        console.log(`- \x1b[94mNhập \x1b[92m'Webhook <url>' \x1b[93mđể thêm webhook Discord\x1b[0m`);
    }
    else if (CurrentTab === "Help") {
        console.log(`- Các lệnh:`);
        console.log(`  + "Help"`);
        console.log(`  + "Run"`);
        console.log(`  + "Add <username> <pass>"`);
        console.log(`  + "Del <username/index>"`);
        console.log(`  + "Acc <username/index>"`);
        console.log(`  + "Exit"`);
        console.log(`  + "Proxy <username/index> <IP> <PORT>"`);
        console.log(`  + "Proxy <username/index> <IP:PORT>"`);
        console.log(`  + "Proxy <username/index> ON"`);
        console.log(`  + "Proxy <username/index> OFF"`);
        console.log(`  + "Webhook <url webhook>"`);

        console.log(`\n- \x1b[38;5;129mNhập \x1b[92m'Exit' \x1b[94mđể thoát`);
        console.log(`- \x1b[38;5;129mNhập \x1b[92m'Help' \x1b[94mđể xem lệnh`);
        console.log(`- \x1b[38;5;129mNhập \x1b[92m'Setting' \x1b[94mđể cài đặt proxy/account\x1b[0m`);
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
        username: "bot shard afk [KINGSMP]",
        avatar_url: "https://i.pinimg.com/736x/2c/8e/d8/2c8ed804aa99adbae923768f134c2f63.jpg",
        embeds: [{
            title: title,
            description: `**user:** \`${username}\`\n${description}`,
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
    } catch (err) {
        console.error(`[Webhook Error] Không thể gửi thông báo tới Discord: ${err.message}`);
    }
}

function maskIp(ip) {
    if (!ip) return 'Unknown';
    const parts = ip.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.***.***`;
    return ip;
}

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

    const log = (...args) => console.log(`[\x1b[32m${username}\x1b[0m]:`, ...args);
    const logErr = (...args) => {
        if (!config.IgnoreError) {
            console.error(`❌ [\x1b[31m${username}\x1b[0m]:`, ...args);
        }
    };

    let botOptions = {
        host: 'sgp.kingmc.vn',
        username: username,
        version: '1.16.5'
    };

    if (proxyConfig && proxyConfig.enable) {
        log(`Đang khởi tạo Bot QUA HTTP PROXY: ${proxyConfig.ip}:${proxyConfig.port}...`);

        botOptions.port = 25565;
        botOptions.connect = (client) => {
            const req = http.request({
                host: proxyConfig.ip,
                port: proxyConfig.port,
                method: 'CONNECT',
                path: 'sgp.kingmc.vn:25565'
            });

            req.on('connect', (res, socket, head) => {
                socket.on('error', (err) => {
                    logErr(`Lỗi kết nối Socket Proxy: ${err.message}`);
                });

                if (res.statusCode !== 200) {
                    logErr(`Lỗi kết nối proxy. Mã lỗi: ${res.statusCode}`);
                    sendDiscordWebhook(
                        username,
                        "⛔ Proxy Từ Chối Kết Nối",
                        `Mã lỗi HTTP: **${res.statusCode}**\nIP Proxy: \`${maskIp(proxyConfig.ip)}\``
                    );
                    return;
                }
                log('\x1b[96m✔️ Đã vào được server / Proxy sống\x1b[0m');
                sendDiscordWebhook(username, "LOGGED", `**Proxy**: ${proxyConfig.ip}`)
                client.setSocket(socket);
                client.emit('connect');
            });

            req.on('error', (err) => {
                logErr('Proxy chết hoặc sai cấu hình:', err.message);
                sendDiscordWebhook(
                    username,
                    "❌ Proxy Bị Chết / Hỏng",
                    `Chi tiết lỗi: \`${err.message}\`\nIP Proxy: \`${maskIp(proxyConfig.ip)}\``
                );
            });

            req.end();
        };
    } else {
        log('\nĐang khởi tạo Bot KHÔNG DÙNG PROXY...');
    }

    const bot = mineflayer.createBot(botOptions);

    function cleanTimers() {
        if (retryMenuTimer) {
            clearTimeout(retryMenuTimer);
            retryMenuTimer = null;
        }
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    }

    function handleReconnect(isGhostSession = false) {
        if (hasEnded) return;
        hasEnded = true;

        cleanTimers();

        const tracker = reconnectTracker[username];
        const now = Date.now();
        const fifteenMinutes = 15 * 60 * 1000;

        tracker.attempts = tracker.attempts.filter(timestamp => (now - timestamp) < fifteenMinutes);

        if (tracker.attempts.length >= 10) {
            logErr(`⚠️ Bot đã tự động ngắt kết nối quá 10 lần trong vòng 15 phút. TIẾN HÀNH HỦY TREO BOT NÀY.`);
            sendDiscordWebhook(
                username,
                "🚫 HỦY BOT - QUÁ GIỚI HẠN RECONNECT",
                `Bot đã bị dừng treo hoàn toàn do thực hiện kết nối lại vượt quá **${tracker.attempts.length} lần** trong vòng 15 phút.`,
                16711680
            );
            return;
        }

        let delay = 12000;

        if (isGhostSession) {
            delay = 30000; 
            log(`⚠️ Phát hiện lỗi kẹt nick (Ghost Session). Sẽ chờ 30 giây để máy chủ giải phóng phiên treo cũ...`);
        } else {
            tracker.attempts.push(now);
        }

        log(`⚠️ Bot mất kết nối. Chuẩn bị reconnect (Lần thứ ${tracker.attempts.length}/10 trong 15p) sau ${delay / 1000} giây...`);
        
        sendDiscordWebhook(
            username,
            "🔄 RECONNECTED",
            `Đang kết nối lại bot (Lần thứ ${tracker.attempts.length}/10 trong 15 phút) sau ${delay / 1000} giây...`,
            3447003
        );

        reconnectTimer = setTimeout(() => {
            startBot(username, accountConfig);
        }, delay);
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
            logErr('Không tìm thấy Đồng hồ trong túi đồ. Sẽ quét lại sau 5s...');
            retryMenuTimer = setTimeout(selectServer, 5000);
            return;
        }

        try {
            await bot.equip(clock, 'hand');
            await new Promise(resolve => setTimeout(resolve, 500));

            if (hasEnded) return;
            bot.activateItem();
            log('⚡ Đã dùng Đồng hồ, đang đợi cửa sổ rương hiển thị...');

            retryMenuTimer = setTimeout(() => {
                log('⚠️ Rương chưa mở. Đang thử bấm lại Đồng hồ...');
                selectServer();
            }, 6000);

        } catch (err) {
            logErr('Lỗi khi cầm/sử dụng đồng hồ:', err);
            retryMenuTimer = setTimeout(selectServer, 5000);
        }
    }

    function normalizeSmallCaps(str) {
        if (!str) return '';
        const smallCaps = "ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ";
        const normalCaps = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        return str.split('').map(char => {
            const idx = smallCaps.indexOf(char);
            return idx !== -1 ? normalCaps[idx] : char;
        }).join('');
    }

    function parseShardNum(text) {
        if (!text) return null;

        const codes = [];
        for (let i = 0; i < text.length; i++) {
            codes.push(text.charCodeAt(i));
        }

        const unicodeShard = [42801, 668, 7424, 640, 7429].join(',');
        const asciiShard = [83, 72, 65, 82, 68].join(',');

        const codesString = codes.join(',');
        const hasShard = codesString.includes(unicodeShard) || codesString.includes(asciiShard) || text.includes('MẢNH');

        if (!hasShard) return null;

        for (const m of text.matchAll(/(\d[\d,.]*)\s*(k|K|M)?/g)) {
            let n = parseFloat(m[1].replace(/[,.]/g, ''));
            if (isNaN(n)) continue;
            if (m[2] === 'k' || m[2] === 'K') n *= 1e3;
            if (m[2] === 'M') n *= 1e6;
            if (n >= 1) return Math.round(n);
        }
        return null;
    }

    function getShardFromScoreboard() {
        const sb = bot.scoreboard?.sidebar;
        if (!sb || !sb.items) return null;

        for (const item of sb.items) {
            const entry = item.name;
            const team = bot.teamMap ? bot.teamMap[entry] : null;

            const prefix = team?.prefix ? team.prefix.toString() : '';
            const suffix = team?.suffix ? team.suffix.toString() : '';

            const fullLineText = `${prefix}${entry}${suffix}`;
            const cleanLine = resolveText(fullLineText);
            const shard = parseShardNum(cleanLine);

            if (shard !== null) {
                return shard;
            }
        }
        return null;
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
        if (retryMenuTimer) {
            clearTimeout(retryMenuTimer);
            retryMenuTimer = null;
        }

        const title = window.title ? JSON.parse(window.title).text || window.title : '';
        log(`💻 Đã mở giao diện: "${title}" - ${title.length}`);

        await new Promise(resolve => setTimeout(resolve, 2000));

        if (hasEnded || bot.currentWindow?.id !== window.id) return;

        if (title.length < 10) {
            const kingSmpSlot = window.slots.find(item => item && item.displayName.includes('KingSMP'));
            const target = kingSmpSlot ? kingSmpSlot.slot : 24;

            try {
                log(`👉 Đang click vào KingSMP ở ô [${target}]...`);
                await bot.clickWindow(target, 0, 0);
                inkingsmp = true;
            } catch (err) {
                if (err.message.includes("didn't respond to transaction")) {
                    inkingsmp = true;
                } else {
                    logErr(`Lỗi khi click ${title}:`, err.message);
                }
            }
        }
        else {
            const afkSlot = window.slots.find(item => item && item.displayName.includes('AFK 1'));
            const target = 1;

            try {
                log(`👉 Đang click vào AFK 1 ở ô [${target}]...`);
                await bot.clickWindow(target, 0, 0);
                log('✔️ Đã click chọn AFK 1 thành công!');
                log('⏳ Hệ thống yêu cầu chờ 5 giây. Đang giữ bot ĐỨNG YÊN để dịch chuyển...');
                bot.clearControlStates();
            } catch (err) {
                if (err.message.includes("didn't respond to transaction")) {
                    log('✔️ Đã click chọn AFK 1 thành công!');
                    log('⏳ Hệ thống yêu cầu chờ 5 giây. Đang giữ bot ĐỨNG YÊN để dịch chuyển...');
                    bot.clearControlStates();
                } else {
                    logErr('⚠️ WARNING (Có thể bỏ qua):', err.message);
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
        }
        else if (!find_game_menu() && isverified) {
            inkingsmp = true;
            setTimeout(() => {
                to_afk_zone();
            }, 3000);
        } else {
            bot.chat('/dk ' + pass);
        }
    });

    bot.on('kicked', (reason) => {
        const cleanReason = resolveText(reason);
        log('Bị kick khỏi server:', cleanReason);
        
        let isGhostSession = false;
        const normalizedReason = cleanReason.toLowerCase();
        if (
            normalizedReason.includes('đang chơi') || 
            normalizedReason.includes('đã kết nối tới proxy') || 
            normalizedReason.includes('already logged in') || 
            normalizedReason.includes('already connected')
        ) {
            isGhostSession = true;
        }

        sendDiscordWebhook(
            username,
            "⚠️ Bot Bị Kick Khỏi Server",
            `Lý do: \`${cleanReason}\``,
            16753920
        );
        handleReconnect(isGhostSession);
    });

    bot.on('error', (err) => {
        logErr('Lỗi kết nối Minecraft:', err.message);
        sendDiscordWebhook(
            username,
            "💥 Bot Bị Lỗi Kết Nối",
            `Lỗi phát sinh: \`${err.message}\``
        );
        // handleReconnect(false);
    });

    bot.on('message', (jsonMsg) => {
        if (hasEnded) return;
        const plainText = jsonMsg.toString();

        if (config.Chat) {
            log(`[KHUNG CHAT]: ${plainText}`);
        }

        if (plainText.includes('ký với lệnh')) {
            bot.chat('/dk ' + pass);
        }
        if (plainText.includes('hãy đăng kí')) {
            bot.chat('/dk ' + pass);
        }
        if (plainText.includes('Đăng nhập thành công')) {
            isverified = true;
        }
        if (plainText.includes('giây rồi mới mở menu')) {
            log("⚠️ Bị giới hạn thời gian mở rương. Đang chờ 5 giây để thử lại...");
            if (retryMenuTimer) clearTimeout(retryMenuTimer);
            setTimeout(() => {
                if (hasEnded) return;
                inkingsmp = false;
                selectServer();
            }, 5000);
        }
        if (plainText.includes('afk')) {
            log(`\x1b[36mĐã vào khu vực AFK Thành Công\x1b[0m`)
            bot.chat(`/msg dkhanhhhh tao la ${username}`);
        }
        if (plainText.includes("có tài khoảng cùng ip của ban")) {
            logErr("Đã có tài khoản nào đó chạy cùng IP \x1b[33m(Vui lòng thêm hoặc đổi Proxy khác)\x1b[0m")
            sendDiscordWebhook(username, "Trùng IP", "Đã có tài khoản nào đó chạy cùng IP (Vui lòng thêm hoặc đổi Proxy khác)")
        }
        if (plainText.includes('chưa liên kết')) {
            sendDiscordWebhook(username, "Chưa liên kết discord", "Bị limit Shard")
        }
    });
}
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

    else if (command === 'add') {
        if (!args[1] || !args[2]) {
            lastError = "Cú pháp không hợp lệ! Hãy dùng: Add <username> <pass>";
        } else {
            const username = args[1];
            if (!config.Accounts[username]) {
                config.Accounts[username] = { pass: args[2], proxy: { enable: false, ip: "", port: 0 } };
                saveConfig();
            } else {
                lastError = `Tài khoản '${username}' đã tồn tại trong danh sách!`;
            }
        }
    }
    else if (command === 'del') {
        if (!args[1]) {
            lastError = "Cú pháp không hợp lệ! Hãy dùng: Del <username/index>";
        } else {
            const username = resolveUsername(args[1]);
            if (config.Accounts[username]) {
                delete config.Accounts[username];
                selectedAccounts = selectedAccounts.filter(acc => acc !== username);

                config.CurrentAccounts = selectedAccounts;
                saveConfig();
            } else {
                lastError = `Không tìm thấy tài khoản '${args[1]}' để xóa!`;
            }
        }
    }
    else if (command === 'acc') {
        if (!args[1]) {
            lastError = "Cú pháp không hợp lệ! Hãy dùng: Acc <username/index>";
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
                lastError = `Không tìm thấy tài khoản '${args[1]}' trong danh sách!`;
            }
        }
    }
    else if (command === 'webhook') {
        if (!args[1]) {
            lastError = "Cú pháp không hợp lệ! Hãy dùng: Webhook <url webhook>";
        } else {
            config.App.Webhook = args[1];
            saveConfig();
        }
    }
    else if (command === 'proxy') {
        if (!args[1] || !args[2]) {
            lastError = "Cú pháp không hợp lệ! Hãy dùng: Proxy <username/index> <ON/OFF/IP:PORT/IP PORT>";
        } else {
            const username = resolveUsername(args[1]);
            if (!config.Accounts[username]) {
                lastError = `Không tìm thấy tài khoản '${args[1]}' để cài đặt Proxy!`;
            } else {
                const action = args[2].toUpperCase();
                if (action === 'ON') {
                    config.Accounts[username].proxy.enable = true;
                    saveConfig();
                } else if (action === 'OFF') {
                    config.Accounts[username].proxy.enable = false;
                    saveConfig();
                } else {
                    let ip, port;
                    if (args[2].includes(':')) {
                        [ip, port] = args[2].split(':');
                    } else if (args[3]) {
                        ip = args[2];
                        port = args[3];
                    }

                    if (ip && port) {
                        config.Accounts[username].proxy = {
                            enable: true,
                            ip: ip,
                            port: parseInt(port)
                        };
                        saveConfig();
                    } else {
                        lastError = "Định dạng IP:PORT hoặc IP PORT không hợp lệ!";
                    }
                }
            }
        }
    }
    else if (command === 'run') {
        if (selectedAccounts.length === 0) {
            lastError = "Chưa chọn tài khoản nào để chạy! Hãy dùng lệnh 'Acc' trước.";
        } else {
            console.clear();
            console.log("\x1b[33m====================================================\x1b[0m");
            console.log("\x1b[33m  HỆ THỐNG ĐANG KHỞI CHẠY BOT - ĐÃ TẮT MENU TƯƠNG TÁC \x1b[0m");
            console.log("\x1b[33m  BẤM CTRL + C ĐỂ DỪNG TOÀN BỘ CHƯƠNG TRÌNH         \x1b[0m");
            console.log("\x1b[33m====================================================\x1b[0m\n");

            selectedAccounts.forEach(acc => {
                const accConfig = config.Accounts[acc];
                console.log(`-> Starting: ${acc} | Proxy: ${accConfig.proxy.enable ? accConfig.proxy.ip : "Không dùng"}`);
                startBot(acc, accConfig);
            });

            return "START_BOTS";
        }
    }
    else {
        lastError = `Lệnh '${command}' không tồn tại! Nhập 'Help' để xem danh sách các lệnh.`;
    }
    return null;
}

async function main() {
    while (running) {
        Render();
        const answer = await askQuestion("\n> ");
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
