(() => {
        'use strict';
        const USER_KEY = 'gogames.wallet.userId';
        const EMAIL_KEY = 'gogames.wallet.email';
        const BET_KEY = 'gogames.wallet.defaultBet';
        const $ = selector => document.querySelector(selector);
        const wallet = { userId: '', email: '', balance: null, battles: [] };

        function read(key) { try { return localStorage.getItem(key) || ''; } catch (_) { return ''; } }
        function write(key, value) { try { value ? localStorage.setItem(key, value) : localStorage.removeItem(key); } catch (_) {} }
        function setStatus(message, type = '') {
            const el = $('#wallet-status');
            if (!el) return;
            el.textContent = message;
            el.className = `platform-status ${type}`.trim();
        }
        async function api(path, options = {}) {
            const response = await fetch(path, {
                ...options,
                headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
            return data;
        }
        function renderWallet() {
            const connected = Boolean(wallet.userId);
            $('#wallet-connect').classList.toggle('hidden', connected);
            $('#wallet-dashboard').classList.toggle('hidden', !connected);
            const balance = Number.isFinite(wallet.balance) ? wallet.balance : 0;
            $('#wallet-balance').textContent = connected ? `${balance} GGX` : 'GGX';
            $('#wallet-balance-large').textContent = balance;
            $('#wallet-email').value = wallet.email || read(EMAIL_KEY);
        }
        async function refreshBalance(silent = false) {
            if (!wallet.userId) return;
            if (!silent) setStatus('Refreshing GGX balance…');
            const data = await api(`/api/users/${encodeURIComponent(wallet.userId)}/balance`);
            wallet.balance = Number(data.balance) || 0;
            renderWallet();
            if (!silent) setStatus('Balance updated.', 'success');
        }
        async function connectWallet() {
            const email = $('#wallet-email').value.trim();
            if (!/^\S+@\S+\.\S+$/.test(email)) { setStatus('Enter a valid email address.', 'error'); return; }
            setStatus('Connecting GoGames wallet…');
            const data = await api('/api/users', { method: 'POST', body: JSON.stringify({ email }) });
            wallet.userId = data.userId;
            wallet.email = email;
            wallet.balance = Number(data.balance) || 0;
            write(USER_KEY, wallet.userId); write(EMAIL_KEY, wallet.email);
            renderWallet();
            setStatus('Wallet connected.', 'success');
            loadBattles();
        }
        function disconnectWallet() {
            wallet.userId = ''; wallet.email = ''; wallet.balance = null; wallet.battles = [];
            write(USER_KEY, ''); write(EMAIL_KEY, '');
            renderWallet();
            $('#wallet-battles').innerHTML = '<p style="color:var(--muted);">Connect a wallet to view arenas.</p>';
            setStatus('Wallet disconnected.');
        }
        function battleMarkup(battle) {
            const id = String(battle.id || '');
            const a = String(battle.modelAName || 'Model A');
            const b = String(battle.modelBName || 'Model B');
            return `<article class="battle-card" data-battle-id="${id}">
                <div class="battle-title"><span>${a} ⚔ ${b}</span><span>${String(battle.game || 'game')}</span></div>
                <div class="battle-meta">Pools · A ${Number(battle.poolA)||0} · Draw ${Number(battle.poolDraw)||0} · B ${Number(battle.poolB)||0}</div>
                <div class="platform-row">
                    <select class="platform-select battle-choice" aria-label="Choose outcome"><option value="a">${a}</option><option value="draw">Draw</option><option value="b">${b}</option></select>
                    <button class="gold-btn battle-bet-btn" type="button">Place bet</button>
                </div>
            </article>`;
        }
        async function loadBattles() {
            if (!wallet.userId) { setStatus('Connect your wallet first.', 'error'); return; }
            setStatus('Loading live arenas…');
            const battles = await api('/api/battles');
            wallet.battles = Array.isArray(battles) ? battles.filter(b => b && b.status === 'live' && b.bettingOpen) : [];
            $('#wallet-battles').innerHTML = wallet.battles.length
                ? wallet.battles.map(battleMarkup).join('')
                : '<p style="color:var(--muted);">No server-listed betting arenas are open right now.</p>';
            setStatus(wallet.battles.length ? `${wallet.battles.length} arena(s) open.` : 'No arenas currently open.', wallet.battles.length ? 'success' : '');
        }
        async function placeBet(card) {
            if (!wallet.userId) throw new Error('Connect your wallet first.');
            const battleId = card.dataset.battleId;
            const choice = card.querySelector('.battle-choice').value;
            const amount = Number($('#wallet-bet-amount').value);
            if (!Number.isInteger(amount) || amount < 1) throw new Error('Choose a valid GGX stake.');
            if (Number.isFinite(wallet.balance) && wallet.balance < amount) throw new Error('Insufficient GGX balance.');
            setStatus(`Placing ${amount} GGX bet…`);
            const data = await api('/api/bets', { method: 'POST', body: JSON.stringify({ battleId, userId: wallet.userId, choice, amount }) });
            wallet.balance = Number(data.balance) || 0;
            renderWallet();
            write(BET_KEY, String(amount));
            setStatus(`Bet accepted. Reference ${String(data.betId || '').slice(0, 8)}.`, 'success');
            await loadBattles();
        }
        function openWallet() {
            $('#wallet-modal').classList.remove('hidden');
            renderWallet();
            if (wallet.userId) refreshBalance(true).then(loadBattles).catch(error => setStatus(error.message, 'error'));
            setTimeout(() => (wallet.userId ? $('#wallet-refresh-btn') : $('#wallet-email')).focus(), 40);
        }

        wallet.userId = read(USER_KEY); wallet.email = read(EMAIL_KEY);
        const savedBet = Number(read(BET_KEY));
        if ([5,10,25,50].includes(savedBet)) $('#wallet-bet-amount').value = String(savedBet);
        renderWallet();
        if (wallet.userId) refreshBalance(true).catch(() => disconnectWallet());

        $('#btn-wallet').addEventListener('click', openWallet);
        $('#wallet-connect-btn').addEventListener('click', () => connectWallet().catch(error => setStatus(error.message, 'error')));
        $('#wallet-refresh-btn').addEventListener('click', () => refreshBalance().catch(error => setStatus(error.message, 'error')));
        $('#wallet-disconnect-btn').addEventListener('click', disconnectWallet);
        $('#wallet-load-battles-btn').addEventListener('click', () => loadBattles().catch(error => setStatus(error.message, 'error')));
        $('#wallet-bet-amount').addEventListener('change', event => write(BET_KEY, event.target.value));
        $('#wallet-battles').addEventListener('click', event => {
            const button = event.target.closest('.battle-bet-btn');
            if (!button) return;
            button.disabled = true;
            placeBet(button.closest('.battle-card')).catch(error => setStatus(error.message, 'error')).finally(() => { button.disabled = false; });
        });
        $('#wallet-email').addEventListener('keydown', event => {
            if (event.key === 'Enter') connectWallet().catch(error => setStatus(error.message, 'error'));
        });
        window.addEventListener('gogames:spades-match-complete', event => {
            const detail = event.detail || {};
            console.info('[GoGames] Local Spades match complete; no GGX settlement attempted.', detail);
        });
    })();
