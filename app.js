const tg = window.Telegram.WebApp;
tg.expand();

// ==========================================
// 🔴 REQUIRED CREDENTIALS - REPLACE THESE! 🔴
// ==========================================
const supabaseUrl = 'https://wjauprrwojmkusgyxjwm.supabase.co'; 
const supabaseKey = 'sb_publishable_8mNxeymKzR80e6E9Jagx_w_muZbzI48';
const MONETAG_ZONE_ID = "12184150"; 
const BOT_USERNAME = "mycointapbot"; 
const EDGEONE_LIVE_URL = "https://cointapearner.edgeone.dev"; 
// ==========================================

const db = window.supabase.createClient(supabaseUrl, supabaseKey);

let state = { 
    balance: 0, 
    energy: 1000, 
    maxEnergy: 1000, 
    userId: null,
    streakCount: 0,
    lastCheckinDate: null,
    wallet: null
};

const els = {
    usernameDisplay: document.getElementById('usernameDisplay'),
    avatar: document.getElementById('avatar'),
    headerBalance: document.getElementById('headerBalance'),
    mainBalance: document.getElementById('mainBalance'),
    walletBalance: document.getElementById('walletBalance'),
    usdValue: document.getElementById('usdValue'),
    walletAddressDisplay: document.getElementById('walletAddressDisplay'),
    tapButton: document.getElementById('tapButton'),
    energyText: document.getElementById('energyText'),
    energyBar: document.getElementById('energyBar'),
    inviteBtn: document.getElementById('inviteBtn'),
    dailyCheckinBtn: document.getElementById('dailyCheckinBtn'),
    streakText: document.getElementById('streakText'),
    leaderboardList: document.getElementById('leaderboardList'),
    views: {
        game: document.getElementById('gameView'),
        earn: document.getElementById('earnView'),
        friends: document.getElementById('friendsView'),
        leaderboard: document.getElementById('leaderboardView'),
        wallet: document.getElementById('walletView')
    },
    navs: {
        game: document.getElementById('navGame'),
        earn: document.getElementById('navEarn'),
        friends: document.getElementById('navFriends'),
        leaderboard: document.getElementById('navRank'),
        wallet: document.getElementById('navWallet')
    }
};

const DAILY_BASE_REWARD = 500;
let sessionTapCount = 0; 

// --- INITIALIZATION ---
async function init() {
    const user = tg.initDataUnsafe?.user;
    const startParam = tg.initDataUnsafe?.start_param; 

    if (user) {
        state.userId = user.id;
        els.usernameDisplay.innerText = user.username || user.first_name;
        els.avatar.innerText = (user.first_name || user.username).charAt(0).toUpperCase();

        const { data } = await db.from('users').select('*').eq('telegram_id', state.userId).maybeSingle();

        if (data) {
            state.balance = Number(data.balance) || 0;
            state.energy = Number(data.energy) || 1000;
            state.streakCount = data.streak_count || 0;
            state.lastCheckinDate = data.last_checkin_date || null;
            state.wallet = data.wallet_address || null;
        } else {
            await db.from('users').upsert([{ 
                telegram_id: state.userId, 
                username: user.username || user.first_name, 
                balance: 0, 
                energy: 1000,
                streak_count: 0
            }], { onConflict: 'telegram_id' });

            if (startParam && startParam.startsWith('ref_')) {
                const referrerId = parseInt(startParam.replace('ref_', ''));
                if (referrerId) {
                    await db.rpc('process_referral', { ref_id: referrerId, new_user_id: state.userId });
                    state.balance += 2000;
                    tg.showAlert("🎉 Welcome! You received a 2,000 Coin Bonus for joining via invite link!");
                }
            }
        }
    } else {
        els.usernameDisplay.innerText = "Guest Player";
    }
    updateUI();
    checkDailyStatus();
}

// --- DIRECT DATABASE SAVING ---
async function saveProgress() {
    if (!state.userId) return;
    const { error } = await db.from('users').upsert({
        telegram_id: state.userId,
        balance: state.balance,
        energy: state.energy,
        streak_count: state.streakCount,
        last_checkin_date: state.lastCheckinDate,
        wallet_address: state.wallet
    }, { onConflict: 'telegram_id' });

    if (error) {
        console.error("Save failed:", error.message);
    }
}

// --- UI & EXCHANGE RATE ---
function updateUI() {
    const formattedBal = state.balance.toLocaleString();
    els.headerBalance.innerText = formattedBal;
    els.mainBalance.innerText = formattedBal;
    els.walletBalance.innerText = formattedBal;
    
    const usdConversion = (state.balance * 0.000000001).toFixed(6);
    els.usdValue.innerText = `≈ $${usdConversion} USD`;
    
    els.energyText.innerText = `${state.energy} / ${state.maxEnergy}`;
    els.energyBar.style.width = `${(state.energy / state.maxEnergy) * 100}%`;
    els.tapButton.style.opacity = state.energy <= 0 ? '0.5' : '1';
}

// --- DAILY CHECK-IN SYSTEM ---
function checkDailyStatus() {
    const today = new Date().toISOString().split('T')[0];
    
    if (state.lastCheckinDate === today) {
        els.dailyCheckinBtn.innerText = "Claimed";
        els.dailyCheckinBtn.classList.replace('bg-white', 'bg-gray-400');
        els.dailyCheckinBtn.classList.replace('text-blue-900', 'text-white');
        els.dailyCheckinBtn.disabled = true;
        els.streakText.innerText = `Streak: ${state.streakCount} Days (Come back tomorrow)`;
    } else {
        let expectedReward = DAILY_BASE_REWARD;
        if (state.lastCheckinDate) {
            const lastDate = new Date(state.lastCheckinDate);
            const currentDate = new Date(today);
            const diffDays = Math.ceil(Math.abs(currentDate - lastDate) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) expectedReward = DAILY_BASE_REWARD * (state.streakCount + 1);
        }
        
        els.dailyCheckinBtn.innerText = "Claim";
        els.dailyCheckinBtn.disabled = false;
        els.streakText.innerText = `Streak: ${state.streakCount} Days (Next: +${expectedReward.toLocaleString()})`;
    }
}

els.dailyCheckinBtn.addEventListener('click', async () => {
    const today = new Date().toISOString().split('T')[0];
    if (state.lastCheckinDate === today) return;

    let newStreak = 1;
    if (state.lastCheckinDate) {
        const lastDate = new Date(state.lastCheckinDate);
        const currentDate = new Date(today);
        const diffDays = Math.ceil(Math.abs(currentDate - lastDate) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) newStreak = state.streakCount + 1;
    }

    const reward = DAILY_BASE_REWARD * newStreak;
    state.balance += reward;
    state.streakCount = newStreak;
    state.lastCheckinDate = today;
    
    updateUI();
    checkDailyStatus();
    saveProgress(); // Saves immediately
    
    tg.HapticFeedback.notificationOccurred('success');
    tg.showAlert(`🎉 Day ${newStreak} Streak! You claimed ${reward.toLocaleString()} Coins!`);
});

// --- CORE GAME LOGIC (TAP) ---
els.tapButton.addEventListener('click', (e) => {
    if (state.energy > 0) {
        tg.HapticFeedback.impactOccurred('medium');
        state.balance += 1;
        state.energy -= 1;
        sessionTapCount++;
        
        updateUI();
        
        const floatEl = document.createElement('div');
        floatEl.innerText = '+1';
        floatEl.className = 'absolute text-accentGold font-black text-3xl pointer-events-none transition-all duration-500 ease-out z-50 drop-shadow-md';
        floatEl.style.left = `${e.clientX - 15}px`;
        floatEl.style.top = `${e.clientY - 25}px`;
        document.body.appendChild(floatEl);
        
        requestAnimationFrame(() => { floatEl.style.transform = 'translateY(-60px)'; floatEl.style.opacity = '0'; });
        setTimeout(() => floatEl.remove(), 500);
        
        if (sessionTapCount % 10 === 0) { 
            saveProgress(); 
        }

        if (sessionTapCount % 100 === 0) {
            forceAutoAd();
        }
    } else {
        tg.HapticFeedback.notificationOccurred('warning');
        tg.showAlert("Energy depleted! Go to the Earn tab to watch an ad and refill instantly.");
    }
});

// --- INSTANT AD REWARD ENGINE ---
window.triggerAdTask = function(rewardAmount, refillEnergy = false) {
    const sdkFuncName = `show_${MONETAG_ZONE_ID}`;
    if (typeof window[sdkFuncName] === 'function') {
        tg.showConfirm(`Watch an ad to earn ${rewardAmount.toLocaleString()} Coins?`, (confirmed) => {
            if (confirmed) {
                window[sdkFuncName]({ ymid: String(state.userId || 'guest') })
                .then((result) => {
                    if (result && result.reward_event_type === 'valued') {
                        // Instantly grant coins on screen
                        state.balance += rewardAmount;
                        if (refillEnergy) state.energy = state.maxEnergy;
                        
                        updateUI();
                        saveProgress(); // Immediately save to database
                        tg.HapticFeedback.notificationOccurred('success');
                        tg.showAlert(`🎉 Ad completed! You earned ${rewardAmount.toLocaleString()} Coins!`);
                    } else {
                        tg.showAlert("Ad closed early. Watch completely to claim reward.");
                    }
                })
                .catch(() => console.error("Ad network busy."));
            }
        });
    } else {
        tg.showAlert("Ad engine initializing. Please wait a few seconds.");
    }
};

function forceAutoAd() {
    const sdkFuncName = `show_${MONETAG_ZONE_ID}`;
    if (typeof window[sdkFuncName] === 'function') {
        window[sdkFuncName]({ ymid: String(state.userId || 'guest') })
        .then((result) => {
            if (result && result.reward_event_type === 'valued') {
                // Instantly grant surprise coins
                state.balance += 250;
                updateUI();
                saveProgress();
                tg.showAlert("🎁 Surprise! Server added a 250 Coin bonus for your playtime!");
            }
        })
        .catch(() => console.log("Auto ad skipped/busy."));
    }
}

// --- REFERRALS ---
els.inviteBtn.addEventListener('click', () => {
    if (!state.userId) return;
    const inviteLink = `https://t.me/${BOT_USERNAME}?start=ref_${state.userId}`;
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=Join me in this Tap-to-Earn game!`);
});

// --- LEADERBOARD ---
async function loadLeaderboard() {
    els.leaderboardList.innerHTML = '<div class="text-center text-gray-400 mt-10 animate-pulse font-bold">Loading Top 50...</div>';
    const { data, error } = await db.from('users').select('username, balance, telegram_id').order('balance', { ascending: false }).limit(50);
    
    if (error) {
        els.leaderboardList.innerHTML = '<div class="text-center text-red-500 mt-10">Failed to load ranks.</div>';
        return;
    }
    
    els.leaderboardList.innerHTML = '';
    data.forEach((player, index) => {
        const isMe = player.telegram_id === state.userId;
        const rank = index + 1;
        let rankColor = 'text-gray-400';
        if (rank === 1) rankColor = 'text-yellow-400 font-black text-2xl drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]'; 
        else if (rank === 2) rankColor = 'text-gray-300 font-bold text-xl drop-shadow-md'; 
        else if (rank === 3) rankColor = 'text-orange-400 font-bold text-xl drop-shadow-md'; 
        
        const item = document.createElement('div');
        item.className = `flex justify-between items-center p-4 rounded-2xl border ${isMe ? 'bg-white/10 border-accentGold shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-white/5 border-white/10'}`;
        item.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-8 text-center ${rankColor}">#${rank}</div>
                <div class="font-bold ${isMe ? 'text-accentGold' : 'text-white'}">${player.username || 'Anonymous'}</div>
            </div>
            <div class="font-black text-accentNeon">${Number(player.balance).toLocaleString()}</div>
        `;
        els.leaderboardList.appendChild(item);
    });
}

// --- NAVIGATION ---
window.switchTab = function(tabName) {
    Object.keys(els.views).forEach(key => {
        els.views[key].classList.add('hidden');
        els.navs[key].classList.remove('tab-active', 'text-accentGold');
        els.navs[key].classList.add('text-gray-500');
    });

    els.views[tabName].classList.remove('hidden');
    els.navs[tabName].classList.add('tab-active', 'text-accentGold');
    els.navs[tabName].classList.remove('text-gray-500');

    if (tabName === 'leaderboard') loadLeaderboard();
};

// --- TON WALLET CONNECT ---
const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: `${EDGEONE_LIVE_URL}/tonconnect-manifest.json`,
    buttonRootId: 'ton-connect-button'
});

tonConnectUI.onStatusChange(async (walletInfo) => {
    if (walletInfo) {
        const rawAddress = walletInfo.account.address;
        state.wallet = rawAddress;
        els.walletAddressDisplay.innerText = "Wallet: " + rawAddress.substring(0, 8) + "..." + rawAddress.slice(-4);
        await saveProgress();
    } else {
        state.wallet = null;
        els.walletAddressDisplay.innerText = "";
        await saveProgress();
    }
});

init();
