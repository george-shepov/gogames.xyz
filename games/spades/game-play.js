'use strict';

            // ── AI Bidding ──
            function estimateBid(hand) {
                const counts = {};
                SUITS.forEach(s => counts[s] = hand.filter(c => c.suit === s).length);
                let strength = 0;
                hand.forEach(c => {
                    if (c.rank === 'A') strength += 0.9;
                    if (c.rank === 'K') strength += counts[c.suit] >= 2 ? 0.7 : 0.4;
                    if (c.rank === 'Q') strength += counts[c.suit] >= 3 ? 0.35 : 0.1;
                    if (c.suit === '♠') {
                        if (c.value >= 12) strength += 0.6;
                        else if (c.value >= 9) strength += 0.3;
                        else strength += 0.1;
                    }
                });
                SUITS.filter(s => s !== '♠').forEach(s => {
                    if (counts[s] === 0) strength += Math.max(0, counts['♠'] - 2) * 0.25;
                    if (counts[s] === 1) strength += Math.max(0, counts['♠'] - 3) * 0.12;
                });
                return Math.max(1, Math.min(8, Math.round(strength)));
            }

            function shouldBidNil(hand) {
                const risky = hand.filter(c =>
                    c.rank === 'A' || (c.rank === 'K' && hand.filter(x => x.suit === c.suit).length >= 2) || (c
                        .suit === '♠' && c.value >= 11)
                );
                return risky.length === 0 && hand.filter(c => c.suit === '♠').length <= 3;
            }

            // ── AI Play ──
            function getTrickWinner(trick) {
                let best = trick[0];
                for (let i = 1; i < trick.length; i++) {
                    const p = trick[i];
                    const bestTrump = best.card.suit === '♠';
                    const playTrump = p.card.suit === '♠';
                    if (playTrump && !bestTrump) best = p;
                    else if (playTrump === bestTrump && p.card.suit === best.card.suit && p.card.value > best.card
                        .value) best = p;
                }
                return best;
            }

            function cardWouldWin(card, player) {
                const hypo = [...state.trick, { player, card }];
                return getTrickWinner(hypo).player === player;
            }

            function aiPlay(player) {
                if (state.phase !== 'playing' || state.turn !== player) return;
                const legal = getLegalCards(player);
                const currWinner = state.trick.length ? getTrickWinner(state.trick) : null;
                const teammateWinning = currWinner && TEAM(currWinner.player) === TEAM(player);
                const needsTricks = state.bids[player] > state.tricks[player];
                const isNil = state.bids[player] === 0;

                const byLow = [...legal].sort((a, b) => a.value - b.value || (a.suit === '♠') - (b.suit === '♠'));
                const byHigh = [...legal].sort((a, b) => b.value - a.value || (b.suit === '♠') - (a.suit === '♠'));
                let chosen;

                if (!state.trick.length) {
                    const nonSpades = legal.filter(c => c.suit !== '♠');
                    const pool = nonSpades.length ? nonSpades : legal;
                    if (isNil) chosen = [...pool].sort((a, b) => a.value - b.value)[0];
                    else if (needsTricks) {
                        const aces = pool.filter(c => c.rank === 'A');
                        chosen = aces[0] || [...pool].sort((a, b) => b.value - a.value)[0];
                    } else chosen = [...pool].sort((a, b) => a.value - b.value)[0];
                } else if (isNil || teammateWinning) {
                    chosen = byLow[0];
                } else {
                    const winners = byLow.filter(c => cardWouldWin(c, player));
                    chosen = winners.length && needsTricks ? winners[0] : byLow[0];
                    if (!needsTricks && winners.length && rng(100) < 25) chosen = winners[0];
                }

                commitPlay(player, chosen || byHigh[0]);
            }

            // ── Commit Play ──
            function commitPlay(player, card) {
                const idx = state.hands[player].findIndex(c => c.id === card.id);
                if (idx < 0) return;
                state.hands[player].splice(idx, 1);

                if (!state.leadSuit) state.leadSuit = card.suit;
                if (card.suit === '♠') state.spadesBroken = true;

                state.trick.push({ player, card });
                renderPlayedCard(player, card);
                beep(card.suit === '♠' ? 450 : 340, 0.06, 0.02);
                renderAll();

                if (state.trick.length === 4) {
                    timer = setTimeout(resolveTrick, 950);
                    return;
                }

                state.turn = (player + 1) % 4;
                $('#center-msg').textContent = state.turn === 0 ? 'Your turn.' : `${NAMES[state.turn]}'s turn.`;
                renderAll();

                if (tutorial.active) {
                    tutorialHandleTurn();
                    return;
                }

                if (state.turn === 0) {
                    toast('Your turn.');
                } else {
                    toast(`${NAMES[state.turn]} is thinking…`);
                    timer = setTimeout(() => aiPlay(state.turn), AI_DELAY + rng(200));
                }
            }

            function handleHumanPlay(cardId) {
                if (tutorial.active) {
                    tutorialHandleCardClick(cardId);
                    return;
                }
                if (state.phase !== 'playing' || state.turn !== 0) return;
                if (!isLegal(0, cardId)) {
                    toast(state.leadSuit ? '⚠️ Follow suit!' : '⚠️ Spades not broken yet.');
                    beep(150, 0.15, 0.04);
                    return;
                }
                const card = state.hands[0].find(c => c.id === cardId);
                if (!card) return;
                commitPlay(0, card);
            }

            // ── Trick Resolution ──
            function resolveTrick() {
                const winner = getTrickWinner(state.trick);
                state.tricks[winner.player]++;

                const seat = $(`#seat-${winner.player}`);
                seat.classList.add('winner-pulse');
                setTimeout(() => seat.classList.remove('winner-pulse'), 700);

                const slot = $(`#played-${winner.player} .card`);
                if (slot) slot.classList.add('winning-card');

                toast(winner.player === 0 ? `You win with ${winner.card.rank}${winner.card.suit}.` :
                    `${NAMES[winner.player]} wins with ${winner.card.rank}${winner.card.suit}.`);
                beep(620, 0.1, 0.03);
                renderAll();

                timer = setTimeout(() => {
                    clearSlots();
                    state.trick = [];
                    state.leadSuit = null;

                    if (state.hands.every(h => h.length === 0)) {
                        if (tutorial.active) {
                            tutorialEnd('🎉 Tutorial complete! You\'re ready to play a real match. Press ✦ New Match to start.');
                            return;
                        }
                        timer = setTimeout(endRound, 600);
                    } else {
                        state.turn = winner.player;
                        $('#center-msg').textContent = state.turn === 0 ? 'Your lead.' :
                            `${NAMES[state.turn]} leads.`;
                        renderAll();
                        if (tutorial.active) {
                            tutorialHandleTurn();
                            return;
                        }
                        if (state.turn === 0) {
                            toast('Your lead.');
                        } else {
                            toast(`${NAMES[state.turn]} leads.`);
                            timer = setTimeout(() => aiPlay(state.turn), AI_DELAY);
                        }
                    }
                }, 1100);
            }

            // ── Scoring ──
            function scoreTeam(team) {
                const players = team === 0 ? [0, 2] : [1, 3];
                const teamTricks = players.reduce((s, p) => s + state.tricks[p], 0);
                let contract = 0;
                let delta = 0;
                let bagDelta = 0;
                const notes = [];

                players.forEach(p => {
                    if (state.bids[p] === 0) {
                        if (state.tricks[p] === 0) { delta += 100;
                            notes.push(`${NAMES[p]} nil +100`); } else { delta -= 100;
                            notes.push(`${NAMES[p]} nil −100`); }
                    } else {
                        contract += state.bids[p];
                    }
                });

                if (contract > 0) {
                    if (teamTricks >= contract) {
                        const extra = teamTricks - contract;
                        delta += contract * 10 + extra;
                        bagDelta += extra;
                        notes.push(`Made contract +${contract*10+extra}`);
                    } else {
                        delta -= contract * 10;
                        notes.push(`Missed contract −${contract*10}`);
                    }
                }

                let newBags = state.bags[team] + bagDelta;
                while (newBags >= 10) {
                    newBags -= 10;
                    delta -= 100;
                    notes.push('10-bag penalty −100');
                }
                state.bags[team] = newBags;
                state.scores[team] += delta;
                return { teamTricks, contract, delta, notes };
            }

            function matchWinner() {
                const [a, b] = state.scores;
                if (a < TARGET && b < TARGET) return null;
                if (a === b) return null;
                return a > b ? 0 : 1;
            }

            function renderRoundResultModal() {
                const summary = state.roundSummary;
                if (!summary) return;
                const { a, b, mw } = summary;
                const isMatchEnd = mw !== null;

                $('#round-title').textContent = isMatchEnd ?
                    (mw === 0 ? '🎉 Royal Victory!' : 'Match Complete') :
                    `Round ${state.round} Complete`;

                $('#round-results').innerHTML = `
                    <div class="rule-grid">
                        <div class="rule-card">
                            <strong>Your Team · ${a.delta >= 0 ? '+' : ''}${a.delta}</strong>
                            <p>${a.teamTricks} tricks on ${a.contract} bid.<br>${a.notes.join(' · ')}</p>
                        </div>
                        <div class="rule-card">
                            <strong>Rival Team · ${b.delta >= 0 ? '+' : ''}${b.delta}</strong>
                            <p>${b.teamTricks} tricks on ${b.contract} bid.<br>${b.notes.join(' · ')}</p>
                        </div>
                    </div>
                    <p style="margin-top:12px;"><strong>Score:</strong> Your Team ${state.scores[0]} · Rivals ${state.scores[1]}</p>
                    ${isMatchEnd ? `<p style="color:var(--gold-light); font-weight:700;">${mw === 0 ? 'Your Team wins the match!' : 'Rival Team wins the match.'}</p>` : ''}
                `;

                $('#btn-next-round').textContent = isMatchEnd ? 'Play Again' : 'Next Round';
                openModal('round-modal');
            }

            function endRound() {
                state.phase = 'round-end';
                clearTimer();
                const a = scoreTeam(0);
                const b = scoreTeam(1);
                const mw = matchWinner();
                const isMatchEnd = mw !== null;
                state.roundSummary = { a, b, mw };
                if (isMatchEnd) recordMatch(mw);
                renderAll();
                renderRoundResultModal();

                if (isMatchEnd && mw === 0) launchConfetti();
            }

            function nextRound() {
                const mw = matchWinner();
                closeModal('round-modal');
                if (mw !== null) {
                    startNewMatch();
                    return;
                }
                state.round++;
                state.dealer = (state.dealer + 1) % 4;
                state.roundSummary = null;
                dealRound();
            }

            function endMatch() {
                closeModal('round-modal');
                state.phase = 'idle';
                clearSavedGame();
                clearSlots();
                state.hands = [
                    [],
                    [],
                    [],
                    []
                ];
                renderAll();
                $('#center-msg').textContent = 'Match ended. Start a new match to play.';
                toast('Match ended. Thanks for playing!');
            }

            // ── Confetti ──
            function launchConfetti() {
                const container = $('#confetti');
                container.classList.remove('hidden');
                container.innerHTML = '';
                const colors = ['#e7c36b', '#fff0a7', '#64e2a8', '#ffffff', '#ff6b6b'];
                for (let i = 0; i < 80; i++) {
                    const piece = document.createElement('div');
                    piece.className = 'confetti-piece';
                    piece.style.left = `${rng(100)}%`;
                    piece.style.background = colors[rng(colors.length)];
                    piece.style.animationDelay = `${rng(600)}ms`;
                    piece.style.setProperty('--drift', `${rng(240)-120}px`);
                    container.appendChild(piece);
                }
                setTimeout(() => container.classList.add('hidden'), 3000);
            }

            // ── Modals ──
            function openModal(id) {
                $(`#${id}`).classList.remove('hidden');
                const btn = $(`#${id} button:not([disabled])`);
                if (btn) setTimeout(() => btn.focus(), 50);
            }

            function closeModal(id) {
                $(`#${id}`).classList.add('hidden');
            }
