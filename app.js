const tg = window.Telegram.WebApp;
tg.expand();

// --- REPLACE THESE 3 LINES WITH YOUR ACTUAL KEYS ---
const supabaseUrl = 'https://wjauprrwojmkusgyxjwm.supabase.co'; 
const supabaseKey = 'sb_publishable_8mNxeymKzR80e6E9Jagx_w_muZbzI48';
const MONETAG_ZONE_ID = "12184150";
// ---------------------------------------------------

const db = window.supabase.createClient(supabaseUrl, supabaseKey);

let state = { balance: 0, energy: 1000, maxEnergy: 1000, referrals: 0, multiplier: 1, userId: null, botUsername: '@mycointapbot' };

const els = {
    usernameDisplay: document.getElementById('usernameDisplay'),
    avatar: document.getElementById('avatar'),
    balance: document.getElementById('balance'),
    tapButton: document.getElementById('tapButton'),
    energyText: document.getElementById('energyText'),
    energyBar: document.getElementById('energyBar'),
    rechargeBtn: document.getElementById('rechargeBtn'),
    inviteBtn: document.getElementById('inviteBtn'),
    gameView: document.getElementById('gameView'),
    friendsView: document.getElementById('friendsView'),
    leaderboardView: document.getElementById('leaderboardView'),
    leaderboardList: document.getElementById('leaderboardList'),
    navGame: document.getElementById('navGame'),
    navFriends: document.getElementById('navFriends'),
    navLeaderboard: document.getElementById('navLeaderboard'),
    referralCount: document.getElementById('referralCount'),
    referralBar: document.getElementById('referralBar')
};

async function init() {
    const user = tg.initDataUnsafe?.user;
    if (user) {
        state.userId = user.id;
        els.usernameDisplay.innerText = user.username || user.first_name;
        els.avatar.innerText = (user.first_name || user.username).charAt(0).toUpperCase();

        const { data } = await db.from('users').select('*').eq('telegram_id', state.userId).single();

        if (data) {
            state.balance = data.balance;
            state.energy = data.energy;
        } else {
            await db.from('users').insert([{
                telegram_id: state.userId,
                username: user.username || user.first_name,
                balance: 0,
                energy: 1000
            }]);
        }
    } else {
        els.usernameDisplay.innerText = "Guest Player";
    }
    updateUI();
}

async function saveProgress() {
    if (!state.userId) return;
    await db.from('users').update({ balance: state.balance, energy: state.energy }).eq('telegram_id', state.userId);
}

function updateUI() {
    els.balance.innerText = state.balance.toLocaleString();
    els.energyText.innerText = `${state.energy} / ${state.maxEnergy}`;
    els.energyBar.style.width = `${(state.energy / state.maxEnergy) * 100}%`;

    if (state.energy <= 0) {
        els.tapButton.style.opacity = '0.5';
        els.rechargeBtn.classList.remove('hidden');
    } else {
        els.tapButton.style.opacity = '1';
        els.rechargeBtn.classList.add('hidden');
    }
}

function createFloatingText(x, y, text) {
    const floatEl = document.createElement('div');
    floatEl.innerText = text;
    floatEl.className = 'absolute text-accentGold font-bold text-2xl pointer-events-none transition-all duration-700 ease-out z-50';
    floatEl.style.left = `${x - 10}px`;
    floatEl.style.top = `${y - 20}px`;
    document.body.appendChild(floatEl);

    requestAnimationFrame(() => { floatEl.style.transform = 'translateY(-50px)'; floatEl.style.opacity = '0'; });
    setTimeout(() => floatEl.remove(), 700);
}

let tapCount = 0;
els.tapButton.addEventListener('click', (e) => {
    if (state.energy > 0) {
        tg.HapticFeedback.impactOccurred('medium');
        state.balance += (1 * state.multiplier);
        state.energy -= 1;
        updateUI();
        createFloatingText(e.clientX, e.clientY, `+${1 * state.multiplier}`);
        
        tapCount++;
        if (tapCount >= 10) {
            saveProgress();
            tapCount = 0;
        }
    }
});

els.rechargeBtn.addEventListener('click', () => {
    const sdkFuncName = `show_${MONETAG_ZONE_ID}`;
    if (typeof window[sdkFuncName] === 'function') {
        window[sdkFuncName]({ ymid: String(state.userId || 'guest') })
            .then((result) => {
                if (result && result.reward_event_type === 'valued') {
                    state.energy = state.maxEnergy;
                    state.balance += 500;
                    updateUI();
                    saveProgress();
                    tg.HapticFeedback.notificationOccurred('success');
                    tg.showAlert("⚡ Energy fully restored + 500 bonus coins!");
                } else {
                    tg.showAlert("Ad closed early! Watch the complete ad to get rewarded.");
                }
            })
            .catch(() => tg.showAlert("Ad currently unavailable."));
    } else {
        tg.showAlert("Ad system is initializing. Please try again in a few seconds.");
    }
});

els.inviteBtn.addEventListener('click', () => {
    if (!state.userId) return;
    const inviteLink = `https://t.me/${state.botUsername}?start=ref_${state.userId}`;
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=Join me!`);
});

async function loadLeaderboard() {
    els.leaderboardList.innerHTML = '<div class="text-center text-gray-400 mt-10 animate-pulse">Loading ranks...</div>';
    const { data, error } = await db.from('users').select('username, balance, telegram_id').order('balance', { ascending: false }).limit(50);
    
    if (error) {
        els.leaderboardList.innerHTML = '<div class="text-center text-red-500 mt-10">Failed to load leaderboard.</div>';
        return;
    }
    
    els.leaderboardList.innerHTML = '';
    data.forEach((player, index) => {
        const isMe = player.telegram_id === state.userId;
        const rank = index + 1;
        let rankColor = 'text-gray-400';
        if (rank === 1) rankColor = 'text-yellow-400 font-black text-2xl drop-shadow-md'; 
        else if (rank === 2) rankColor = 'text-gray-300 font-bold text-xl'; 
        else if (rank === 3) rankColor = 'text-orange-400 font-bold text-xl'; 
        
        const item = document.createElement('div');
        item.className = `flex justify-between items-center p-3 rounded-xl border ${isMe ? 'bg-white/10 border-accentGold shadow-[0_0_10px_rgba(255,215,0,0.2)]' : 'bg-white/5 border-white/10'}`;
        item.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-8 text-center ${rankColor}">#${rank}</div>
                <div class="font-semibold ${isMe ? 'text-accentGold' : 'text-white'}">${player.username || 'Anonymous'}</div>
            </div>
            <div class="font-bold text-accentNeon">${player.balance.toLocaleString()}</div>
        `;
        els.leaderboardList.appendChild(item);
    });
}

function switchTab(tab) {
    els.gameView.classList.add('hidden');
    els.friendsView.classList.add('hidden');
    els.leaderboardView.classList.add('hidden');
    
    [els.navGame, els.navFriends, els.navLeaderboard].forEach(nav => {
        nav.classList.remove('tab-active', 'text-accentGold');
        nav.classList.add('text-gray-400');
    });

    if (tab === 'game') {
        els.gameView.classList.remove('hidden');
        els.navGame.classList.add('tab-active', 'text-accentGold');
    } else if (tab === 'friends') {
        els.friendsView.classList.remove('hidden');
        els.navFriends.classList.add('tab-active', 'text-accentGold');
    } else if (tab === 'leaderboard') {
        els.leaderboardView.classList.remove('hidden');
        els.navLeaderboard.classList.add('tab-active', 'text-accentGold');
    }
}

els.navGame.addEventListener('click', () => switchTab('game'));
els.navFriends.addEventListener('click', () => switchTab('friends'));
els.navLeaderboard.addEventListener('click', () => {
    switchTab('leaderboard');
    loadLeaderboard();
});

init();
