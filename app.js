const tg = window.Telegram.WebApp;
tg.expand();

// --- REPLACE THESE WITH YOUR ACTUAL CREDENTIALS ---
const supabaseUrl = 'https://wjauprrwojmkusgyxjwm.supabase.co'; 
const supabaseKey = 'sb_publishable_8mNxeymKzR80e6E9Jagx_w_muZbzI48';
const MONETAG_ZONE_ID = "12184150"; // Rewarded Interstitial Zone ID
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

let state = { 
    balance: 0, 
    energy: 1000, 
    maxEnergy: 1000, 
    userId: null, 
    botUsername: '@mycointapbot' // Replace with your bot username without @
};

const els = {
    usernameDisplay: document.getElementById('usernameDisplay'),
    avatar: document.getElementById('avatar'),
    headerBalance: document.getElementById('headerBalance'),
    mainBalance: document.getElementById('mainBalance'),
    walletBalance: document.getElementById('walletBalance'),
    tapButton: document.getElementById('tapButton'),
    energyText: document.getElementById('energyText'),
    energyBar: document.getElementById('energyBar'),
    inviteBtn: document.getElementById('inviteBtn'),
    views: {
        game: document.getElementById('gameView'),
        earn: document.getElementById('earnView'),
        friends: document.getElementById('friendsView'),
        wallet: document.getElementById('walletView')
    },
    navs: {
        game: document.getElementById('navGame'),
        earn: document.getElementById('navEarn'),
        friends: document.getElementById('navFriends'),
        wallet: document.getElementById('navWallet')
    }
};

async function init() {
    const user = tg.initDataUnsafe?.user;
    const startParam = tg.initDataUnsafe?.start_param; // Catches referral code e.g. ref_123456

    if (user) {
        state.userId = user.id;
        els.usernameDisplay.innerText = user.username || user.first_name;
        els.avatar.innerText = (user.first_name || user.username).charAt(0).toUpperCase();

        const { data, error } = await db
            .from('users')
            .select('*')
            .eq('telegram_id', state.userId)
            .maybeSingle();

        if (error) {
            tg.showAlert("DB Read Error: " + error.message);
            updateUI();
            return;
        }

        if (data) {
            // Returning player: load balance and energy
            state.balance = Number(data.balance) || 0;
            state.energy = Number(data.energy) || 1000;
        } else {
            // Brand new player: register in database
            const { error: insertError } = await db.from('users').upsert([{ 
                telegram_id: state.userId, 
                username: user.username || user.first_name, 
                balance: 0, 
                energy: 1000 
            }], { onConflict: 'telegram_id' });

            if (insertError) {
                tg.showAlert("DB Create Error: " + insertError.message);
            }

            // Process referral link if joined via ref parameter
            if (startParam && startParam.startsWith('ref_')) {
                const referrerId = parseInt(startParam.replace('ref_', ''));
                
                if (referrerId && !isNaN(referrerId)) {
                    // Trigger Supabase RPC procedure for 10k reward & 2k welcome bonus
                    const { error: rpcError } = await db.rpc('process_referral', {
                        ref_id: referrerId,
                        new_user_id: state.userId
                    });

                    if (!rpcError) {
                        state.balance += 2000;
                        tg.showAlert("🎉 Welcome! You received a 2,000 Coin Bonus for joining via invite link!");
                    }
                }
            }
        }
    } else {
        els.usernameDisplay.innerText = "Guest Player";
    }
    updateUI();
}

async function saveProgress() {
    if (!state.userId) return;
    const { error } = await db
        .from('users')
        .upsert({ 
            telegram_id: state.userId, 
            balance: state.balance, 
            energy: state.energy 
        }, { onConflict: 'telegram_id' });

    if (error) {
        console.error("Auto-save failed:", error.message);
    }
}

function updateUI() {
    const formattedBal = state.balance.toLocaleString();
    els.headerBalance.innerText = formattedBal;
    els.mainBalance.innerText = formattedBal;
    els.walletBalance.innerText = formattedBal;
    
    els.energyText.innerText = `${state.energy} / ${state.maxEnergy}`;
    els.energyBar.style.width = `${(state.energy / state.maxEnergy) * 100}%`;

    els.tapButton.style.opacity = state.energy <= 0 ? '0.5' : '1';
}

let tapCount = 0;
els.tapButton.addEventListener('click', (e) => {
    if (state.energy > 0) {
        tg.HapticFeedback.impactOccurred('medium');
        state.balance += 1;
        state.energy -= 1;
        updateUI();
        
        // Floating +1 animation on tap
        const floatEl = document.createElement('div');
        floatEl.innerText = '+1';
        floatEl.className = 'absolute text-accentGold font-black text-3xl pointer-events-none transition-all duration-500 ease-out z-50 drop-shadow-md';
        floatEl.style.left = `${e.clientX - 15}px`;
        floatEl.style.top = `${e.clientY - 25}px`;
        document.body.appendChild(floatEl);
        
        requestAnimationFrame(() => { 
            floatEl.style.transform = 'translateY(-60px)'; 
            floatEl.style.opacity = '0'; 
        });
        setTimeout(() => floatEl.remove(), 500);
        
        // Auto-save every 10 taps
        tapCount++;
        if (tapCount >= 10) { 
            saveProgress(); 
            tapCount = 0; 
        }
    } else {
        tg.HapticFeedback.notificationOccurred('warning');
        tg.showAlert("Energy depleted! Go to the Earn tab to watch an ad and refill instantly.");
    }
});

// --- MONETAG AD REWARD ENGINE ---
window.triggerAdTask = function(rewardAmount, refillEnergy = false) {
    const sdkFuncName = `show_${MONETAG_ZONE_ID}`;
    
    if (typeof window[sdkFuncName] === 'function') {
        tg.showConfirm(`Watch a short ad to earn ${rewardAmount.toLocaleString()} Coins?`, (confirmed) => {
            if (confirmed) {
                window[sdkFuncName]({ ymid: String(state.userId || 'guest') })
                    .then((result) => {
                        if (result && result.reward_event_type === 'valued') {
                            state.balance += rewardAmount;
                            if (refillEnergy) state.energy = state.maxEnergy;
                            
                            updateUI();
                            saveProgress();
                            
                            tg.HapticFeedback.notificationOccurred('success');
                            tg.showAlert(`🎉 Ad completed! You earned ${rewardAmount.toLocaleString()} Coins!`);
                        } else {
                            tg.showAlert("Ad was closed early. Watch the complete ad to claim your reward.");
                        }
                    })
                    .catch((err) => {
                        console.error("Ad display error:", err);
                        tg.showAlert("Ad network busy. Please try again shortly.");
                    });
            }
        });
    } else {
        tg.showAlert("Ad engine initializing. Please wait a few seconds and ensure your connection allows ads.");
    }
};

// --- REFERRAL SHARE ACTION ---
els.inviteBtn.addEventListener('click', () => {
    if (!state.userId) {
        tg.showAlert("Referral link unavailable in Guest mode.");
        return;
    }
    const inviteLink = `https://t.me/${state.botUsername}?start=ref_${state.userId}`;
    const shareText = "Join me in this Tap-to-Earn game! We both get coin bonuses!";
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(shareText)}`);
});

// --- NAVIGATION LOGIC ---
window.switchTab = function(tabName) {
    Object.keys(els.views).forEach(key => {
        els.views[key].classList.add('hidden');
        els.navs[key].classList.remove('tab-active', 'text-accentGold');
        els.navs[key].classList.add('text-gray-500');
    });

    els.views[tabName].classList.remove('hidden');
    els.navs[tabName].classList.add('tab-active', 'text-accentGold');
    els.navs[tabName].classList.remove('text-gray-500');
};

init();
