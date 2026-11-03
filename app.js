// Put this at the very top of your file
const supabaseUrl = 'https://wjauprrwojmkusgyxjwm.supabase.co'; 
const supabaseKey = 'sb_publishable_8mNxeymKzR80e6E9Jagx_w_muZbzI48';
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

const tg = window.Telegram.WebApp;
tg.expand();

// Game State
let state = {
    balance: 0,
    energy: 1000,
    maxEnergy: 1000,
    referrals: 0,
    multiplier: 1,
    userId: null,
    botUsername: 'YourBotUsername' // Replace with your actual bot username
};

// DOM Elements
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
    navGame: document.getElementById('navGame'),
    navFriends: document.getElementById('navFriends'),
    referralCount: document.getElementById('referralCount'),
    referralBar: document.getElementById('referralBar')
};

// Initialization
function init() {
    const user = tg.initDataUnsafe?.user;
    if (user) {
        state.userId = user.id;
        els.usernameDisplay.innerText = user.username || user.first_name;
        els.avatar.innerText = (user.first_name || user.username).charAt(0).toUpperCase();
    } else {
        els.usernameDisplay.innerText = "Guest Player";
    }
    
    // In production, fetch state from backend here using tg.initData
    updateUI();
}

// Core Gameplay Loop
els.tapButton.addEventListener('click', (e) => {
    if (state.energy > 0) {
        tg.HapticFeedback.impactOccurred('medium');
        state.balance += (1 * state.multiplier);
        state.energy -= 1;
        updateUI();
        
        // Float animation for coins
        createFloatingText(e.clientX, e.clientY, `+${1 * state.multiplier}`);
        
        // Debounced sync to backend would go here
    }
});

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

    // Referral UI
    els.referralCount.innerText = `${state.referrals} / 3`;
    els.referralBar.style.width = `${Math.min((state.referrals / 3) * 100, 100)}%`;
}

function createFloatingText(x, y, text) {
    const floatEl = document.createElement('div');
    floatEl.innerText = text;
    floatEl.className = 'absolute text-accentGold font-bold text-2xl pointer-events-none transition-all duration-700 ease-out z-50';
    floatEl.style.left = `${x - 10}px`;
    floatEl.style.top = `${y - 20}px`;
    document.body.appendChild(floatEl);

    requestAnimationFrame(() => {
        floatEl.style.transform = 'translateY(-50px)';
        floatEl.style.opacity = '0';
    });
    setTimeout(() => floatEl.remove(), 700);
}

// Monetag Ad Integration Logic
// Replace 8123456 with your actual Monetag Main Zone ID
const MONETAG_ZONE_ID = "12184150";

els.rechargeBtn.addEventListener('click', () => {
    const sdkFuncName = `show_${MONETAG_ZONE_ID}`;

    // 1. Check if Monetag SDK is loaded
    if (typeof window[sdkFuncName] === 'function') {

        // 2. Trigger Rewarded Interstitial
        window[sdkFuncName]({ ymid: String(state.userId || 'guest') })
            .then((result) => {
                // 3. Verify user watched the complete ad
                if (result && result.reward_event_type === 'valued') {
                    state.energy = state.maxEnergy; // Refill 100%
                    state.balance += 500;           // Add bonus coins
                    updateUI();

                    tg.HapticFeedback.notificationOccurred('success');
                    tg.showAlert("⚡ Energy fully restored + 500 bonus coins!");
                } else {
                    tg.showAlert("Ad closed early! Watch the complete ad to get rewarded.");
                }
            })
            .catch((error) => {
                console.error("Ad failed or rejected:", error);
                tg.showAlert("Ad currently unavailable. Please try again shortly.");
            });

    } else {
        tg.showAlert("Ad system is initializing. Please try again in a few seconds.");
    }
});

// Monetag Wrapper Placeholder (Replace with actual Monetag API integration)
function showMonetagRewardedAd() {
    return new Promise((resolve, reject) => {
        // Assuming Monetag exposes a global object, e.g., 'MonetagApp'
        /* 
        MonetagApp.showInterstitial({
            onClose: () => reject('closed'),
            onComplete: () => resolve()
        }); 
        */
        // Simulated API call
        setTimeout(() => resolve(), 2000); 
    });
}

// Viral Loop & Referrals
els.inviteBtn.addEventListener('click', () => {
    if (!state.userId) return;
    const inviteLink = `https://t.me/${state.botUsername}?start=ref_${state.userId}`;
    const text = `Join me in this Tap-to-Earn game! We both get 1000 coins.`;
    
    // Use Telegram native share dialog
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(text)}`;
    tg.openTelegramLink(shareUrl);
});

// Navigation
els.navGame.addEventListener('click', () => switchTab('game'));
els.navFriends.addEventListener('click', () => switchTab('friends'));

function switchTab(tab) {
    if (tab === 'game') {
        els.gameView.classList.remove('hidden');
        els.friendsView.classList.add('hidden');
        els.navGame.classList.add('tab-active', 'text-accentGold');
        els.navGame.classList.remove('text-gray-400');
        els.navFriends.classList.remove('tab-active', 'text-accentGold');
        els.navFriends.classList.add('text-gray-400');
    } else {
        els.gameView.classList.add('hidden');
        els.friendsView.classList.remove('hidden');
        els.navFriends.classList.add('tab-active', 'text-accentGold');
        els.navFriends.classList.remove('text-gray-400');
        els.navGame.classList.remove('tab-active', 'text-accentGold');
        els.navGame.classList.add('text-gray-400');
    }
}

init();
