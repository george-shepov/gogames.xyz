'use strict';

            $('#btn-new-game').addEventListener('click', startNewMatch);
            $('#btn-tutorial').addEventListener('click', tutorialStart);
            $('#btn-sound').addEventListener('click', () => {
                state.sound = !state.sound;
                const btn = $('#btn-sound');
                btn.textContent = state.sound ? '🔊' : '🔇';
                btn.setAttribute('aria-pressed', String(state.sound));
                try { localStorage.setItem(SOUND_KEY, state.sound ? 'on' : 'off'); } catch (_) {}
                if (state.sound) beep(520, 0.06, 0.02);
            });
            $('#btn-rules').addEventListener('click', () => openModal('rules-modal'));
            $('#btn-stats').addEventListener('click', () => { updateStatsUI(); openModal('stats-modal'); });
            $('#btn-reset-stats').addEventListener('click', () => {
                stats = { matches: 0, wins: 0, bestScore: 0 };
                try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (_) {}
                updateStatsUI();
            });
            $('#btn-install').addEventListener('click', async () => {
                if (!installPrompt) return;
                installPrompt.prompt();
                await installPrompt.userChoice.catch(() => null);
                installPrompt = null;
                $('#btn-install').classList.add('hidden');
            });
            window.addEventListener('beforeinstallprompt', event => {
                event.preventDefault();
                installPrompt = event;
                $('#btn-install').classList.remove('hidden');
            });
            $('#btn-confirm-bid').addEventListener('click', confirmBid);
            $('#btn-suggestion').addEventListener('click', () => {
                const sug = shouldBidNil(state.hands[0]) ? 0 : estimateBid(state.hands[0]);
                selectBid(sug);
            });
            $('#btn-next-round').addEventListener('click', nextRound);
            $('#btn-end-match').addEventListener('click', endMatch);

            $$('[data-close]').forEach(btn => btn.addEventListener('click', () => closeModal(btn.dataset.close)));
            $$('.modal-backdrop').forEach(bd => {
                bd.addEventListener('click', e => {
                    if (e.target === bd && bd.id !== 'bid-modal' && bd.id !== 'round-modal') closeModal(bd.id);
                });
            });

            document.addEventListener('keydown', e => {
                if (e.key !== 'Escape') return;
                if (tutorial.active) {
                    tutorialEnd('Tutorial skipped. Start a new match when ready.', true);
                    return;
                }
                ['rules-modal', 'stats-modal', 'wallet-modal'].forEach(id => {
                    const el = $(`#${id}`);
                    if (el && !el.classList.contains('hidden')) closeModal(id);
                });
            });

            $('#btn-sound').textContent = state.sound ? '🔊' : '🔇';
            $('#btn-sound').setAttribute('aria-pressed', String(state.sound));
            updateStatsUI();

            if (restoreGameState()) {
                renderAll();
                clearSlots();
                state.trick.forEach(play => renderPlayedCard(play.player, play.card));
                if (state.phase === 'bidding') {
                    startBidding();
                } else if (state.phase === 'dealing') {
                    dealRound();
                } else if (state.phase === 'playing') {
                    $('#center-msg').textContent = state.turn === 0 ? 'Your turn.' : `${NAMES[state.turn]}'s turn.`;
                    toast('Saved match restored.', true);
                    if (state.trick.length === 4) timer = setTimeout(resolveTrick, 500);
                    else if (state.turn !== 0) timer = setTimeout(() => aiPlay(state.turn), AI_DELAY);
                } else if (state.phase === 'round-end' && state.roundSummary) {
                    $('#center-msg').textContent = `Round ${state.round} complete.`;
                    toast('Saved match restored.', true);
                    renderRoundResultModal();
                }
            } else {
                renderAll();
                const tutorialDone = localStorage.getItem(TUTORIAL_KEY) === 'done';
                if (!tutorialDone) toast('Welcome! 👋 New to Spades? Click <strong>📖 Tutorial</strong> for a quick walkthrough.', true);
                else toast('Welcome to GoGames Spades Royale. Start a new match to begin.', true);
                $('#center-msg').textContent = 'Press ✦ New Match or 📖 Tutorial.';
            }
