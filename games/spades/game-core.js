'use strict';

            const SUITS = ['♣', '♦', '♥', '♠'];
            const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
            const VALUES = Object.fromEntries(RANKS.map((r, i) => [r, i + 2]));
            const NAMES = ['You', 'Vega', 'Nova', 'Orion'];
            const TEAM = p => p % 2;
            const TARGET = 250;
            const AI_DELAY = 550;
            const GAME_KEY = 'gogames.spades.game.v3';
            const STATS_KEY = 'gogames.spades.stats.v1';
            const SOUND_KEY = 'gogames.spades.sound';
            const TUTORIAL_KEY = 'gogames.spades.tutorial.done';
            const SUIT_NAMES = { '♣': 'clubs', '♦': 'diamonds', '♥': 'hearts', '♠': 'spades' };

            function readJSON(key, fallback) {
                try {
                    const value = JSON.parse(localStorage.getItem(key));
                    return value ?? fallback;
                } catch (_) { return fallback; }
            }

            function loadStats() {
                return { matches: 0, wins: 0, bestScore: 0, ...readJSON(STATS_KEY, {}) };
            }

            function loadSoundPreference() {
                try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch (_) { return true; }
            }

            const state = {
                hands: [[], [], [], []],
                bids: [null, null, null, null],
                tricks: [0, 0, 0, 0],
                scores: [0, 0],
                bags: [0, 0],
                dealer: 0,
                leader: 1,
                turn: 1,
                leadSuit: null,
                spadesBroken: false,
                trick: [],
                round: 1,
                phase: 'idle',
                selectedBid: null,
                sound: loadSoundPreference(),
                matchRecorded: false,
                roundSummary: null,
            };

            // ── Tutorial State ──
            const tutorial = {
                active: false,
                step: 0,
                originalState: null,
            };

            let stats = loadStats();
            let installPrompt = null;
            let timer = null;
            let audioCtx = null;

            const $ = s => document.querySelector(s);
            const $$ = s => [...document.querySelectorAll(s)];

            function rng(max) {
                const arr = new Uint32Array(1);
                crypto.getRandomValues(arr);
                return arr[0] % max;
            }

            function shuffle(arr) {
                const a = [...arr];
                for (let i = a.length - 1; i > 0; i--) {
                    const j = rng(i + 1);
                    [a[i], a[j]] = [a[j], a[i]];
                }
                return a;
            }

            function deck() {
                return SUITS.flatMap(s => RANKS.map(r => ({ suit: s, rank: r, value: VALUES[r], id: `${r}${s}` })));
            }

            function sortHand(h) {
                const order = { '♣': 0, '♦': 1, '♥': 2, '♠': 3 };
                h.sort((a, b) => order[a.suit] - order[b.suit] || a.value - b.value);
            }

            function clearTimer() {
                if (timer) { clearTimeout(timer); timer = null; }
            }

            // ── Audio ──
            function beep(freq = 400, dur = 0.08, vol = 0.03) {
                if (!state.sound) return;
                try {
                    audioCtx = audioCtx || new(window.AudioContext || window.webkitAudioContext)();
                    const o = audioCtx.createOscillator();
                    const g = audioCtx.createGain();
                    o.type = 'sine';
                    o.frequency.value = freq;
                    g.gain.setValueAtTime(vol, audioCtx.currentTime);
                    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
                    o.connect(g);
                    g.connect(audioCtx.destination);
                    o.start();
                    o.stop(audioCtx.currentTime + dur);
                } catch (_) {}
            }

            // ── Toast ──
            let toastTimer = null;

            function toast(msg, persist = false, tutorialStyle = false) {
                const el = $('#toast-msg');
                el.innerHTML = msg;
                el.classList.toggle('tutorial-highlight', tutorialStyle);
                el.style.animation = 'none';
                void el.offsetWidth;
                el.style.animation = 'toastPopIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';
                if (toastTimer) clearTimeout(toastTimer);
                if (!persist) {
                    toastTimer = setTimeout(() => {
                        el.style.animation = 'none';
                        el.style.opacity = '0';
                        setTimeout(() => { el.style.opacity = '1';
                            el.style.animation = ''; }, 300);
                    }, 4000);
                }
            }

            // ── Card Rendering ──
            function cardHTML(card) {
                return `
                    <span class="card-corner">${card.rank}<small>${card.suit}</small></span>
                    <span class="card-center">${card.suit}</span>
                    <span class="card-corner bottom">${card.rank}<small>${card.suit}</small></span>`;
            }

            function createCardEl(card, opts = {}) {
                const el = document.createElement(opts.interactive ? 'button' : 'div');
                el.className = `card ${card.suit === '♥' || card.suit === '♦' ? 'red' : 'black'}`;
                el.innerHTML = cardHTML(card);
                if (opts.interactive) {
                    el.type = 'button';
                    el.setAttribute('role', 'listitem');
                    el.dataset.cardId = card.id;
                    if (!opts.legal) el.classList.add('disabled');
                    if (opts.legal) el.addEventListener('click', () => handleHumanPlay(card.id));
                }
                if (opts.played) el.classList.add('played-card');
                if (opts.winning) el.classList.add('winning-card');
                if (opts.tutorialHighlight) el.classList.add('tutorial-card');
                el.setAttribute('aria-label', `${card.rank} of ${SUIT_NAMES[card.suit]}`);
                return el;
            }

            // ── Legal Cards ──
            function getLegalCards(player) {
                const hand = state.hands[player];
                if (!state.leadSuit) {
                    if (!state.spadesBroken) {
                        const nonSpades = hand.filter(c => c.suit !== '♠');
                        if (nonSpades.length) return nonSpades;
                    }
                    return [...hand];
                }
                const following = hand.filter(c => c.suit === state.leadSuit);
                return following.length ? following : [...hand];
            }

            function isLegal(player, cardId) {
                return getLegalCards(player).some(c => c.id === cardId);
            }

            function saveGameState() {
                try {
                    if (state.phase === 'playing' || state.phase === 'bidding' || state.phase === 'dealing' || state.phase === 'round-end') {
                        const snapshot = { ...state, sound: undefined };
                        localStorage.setItem(GAME_KEY, JSON.stringify(snapshot));
                    } else if (state.phase === 'idle') {
                        localStorage.removeItem(GAME_KEY);
                    }
                } catch (_) {}
            }

            function restoreGameState() {
                const saved = readJSON(GAME_KEY, null);
                if (!saved || !Array.isArray(saved.hands) || saved.hands.length !== 4) return false;
                Object.assign(state, saved, { sound: loadSoundPreference() });
                return true;
            }

            function clearSavedGame() {
                try { localStorage.removeItem(GAME_KEY); } catch (_) {}
            }

            function updateStatsUI() {
                const matches = stats.matches || 0;
                $('#stat-matches').textContent = matches;
                $('#stat-wins').textContent = stats.wins || 0;
                $('#stat-best-score').textContent = stats.bestScore || 0;
                $('#stat-win-rate').textContent = matches ? `${Math.round((stats.wins / matches) * 100)}%` : '0%';
            }

            function recordMatch(winner) {
                if (state.matchRecorded) return;
                state.matchRecorded = true;
                stats.matches = (stats.matches || 0) + 1;
                if (winner === 0) stats.wins = (stats.wins || 0) + 1;
                stats.bestScore = Math.max(stats.bestScore || 0, state.scores[0]);
                try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (_) {}
                updateStatsUI();
                window.dispatchEvent(new CustomEvent('gogames:spades-match-complete', {
                    detail: { winner, scores: [...state.scores], bags: [...state.bags], round: state.round }
                }));
            }

            // ── Render ──
            function renderAll() {
                $('#team-a-score').textContent = state.scores[0];
                $('#team-b-score').textContent = state.scores[1];
                $('#team-a-bags').textContent = state.bags[0];
                $('#team-b-bags').textContent = state.bags[1];
                $('#round-num').textContent = state.round;
                $('#target-score').textContent = TARGET;

                const taBid = teamBid(0);
                const tbBid = teamBid(1);
                $('#team-a-bid').textContent = taBid !== null ? taBid : '—';
                $('#team-b-bid').textContent = tbBid !== null ? tbBid : '—';

                for (let p = 0; p < 4; p++) {
                    $(`#tricks-${p}`).textContent = state.tricks[p];
                    $(`#bid-${p}`).textContent = state.bids[p] !== null ? (state.bids[p] === 0 ? 'NIL' : state.bids[p]) : '—';
                    const seat = $(`#seat-${p}`);
                    seat.classList.toggle('active', state.phase === 'playing' && state.turn === p);
                }

                for (let p = 1; p <= 3; p++) {
                    const holder = $(`#cards-${p}`);
                    holder.innerHTML = '';
                    const count = Math.min(state.hands[p].length, 10);
                    for (let i = 0; i < count; i++) {
                        const mc = document.createElement('span');
                        mc.className = 'mini-card';
                        holder.appendChild(mc);
                    }
                }

                renderPlayerHand();
                $('#hand-count').textContent = state.hands[0].length;
                if (!tutorial.active) saveGameState();
            }

            function renderPlayerHand() {
                const container = $('#player-hand');
                container.innerHTML = '';
                const legalIds = new Set(
                    state.phase === 'playing' && state.turn === 0 ? getLegalCards(0).map(c => c.id) : []
                );
                const total = state.hands[0].length;
                state.hands[0].forEach((card, idx) => {
                    const legal = legalIds.has(card.id);
                    const isTutorialCard = tutorial.active && tutorial.highlightCardIds &&
                        tutorial.highlightCardIds.has(card.id);
                    const el = createCardEl(card, {
                        interactive: true,
                        legal,
                        tutorialHighlight: isTutorialCard
                    });
                    const fanStep = window.innerWidth <= 500 ? 2.2 : 4;
                    const rotate = (idx - (total - 1) / 2) * fanStep;
                    el.style.setProperty('--fan-rotate', `${rotate}deg`);
                    container.appendChild(el);
                });
            }

            function clearSlots() {
                for (let p = 0; p < 4; p++) $(`#played-${p}`).innerHTML = '';
            }

            function renderPlayedCard(player, card, winning = false) {
                const slot = $(`#played-${player}`);
                slot.innerHTML = '';
                slot.appendChild(createCardEl(card, { played: true, winning }));
            }

            function teamBid(team) {
                const members = team === 0 ? [0, 2] : [1, 3];
                if (members.some(p => state.bids[p] === null)) return null;
                return members.reduce((sum, p) => sum + (state.bids[p] || 0), 0);
            }
