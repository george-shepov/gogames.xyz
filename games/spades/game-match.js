'use strict';

            // ── New Match ──
            function startNewMatch() {
                if (tutorial.active) tutorialEnd(null);
                clearTimer();
                clearSlots();
                Object.assign(state, {
                    hands: [
                        [],
                        [],
                        [],
                        []
                    ],
                    bids: [null, null, null, null],
                    tricks: [0, 0, 0, 0],
                    scores: [0, 0],
                    bags: [0, 0],
                    dealer: rng(4),
                    leader: 1,
                    turn: 1,
                    leadSuit: null,
                    spadesBroken: false,
                    trick: [],
                    round: 1,
                    phase: 'dealing',
                    selectedBid: null,
                    matchRecorded: false,
                    roundSummary: null,
                });
                closeModal('round-modal');
                renderAll();
                dealRound();
            }

            function dealRound() {
                state.phase = 'dealing';
                state.bids = [null, null, null, null];
                state.tricks = [0, 0, 0, 0];
                state.spadesBroken = false;
                state.leadSuit = null;
                state.trick = [];
                state.selectedBid = null;
                state.roundSummary = null;
                clearSlots();
                $('#center-msg').textContent = 'Dealing…';
                toast('Shuffling and dealing…');

                const d = shuffle(deck());
                state.hands = [
                    [],
                    [],
                    [],
                    []
                ];
                let p = (state.dealer + 1) % 4;
                d.forEach(c => { state.hands[p].push(c);
                    p = (p + 1) % 4; });
                state.hands.forEach(sortHand);
                state.leader = (state.dealer + 1) % 4;
                renderAll();
                beep(320, 0.06, 0.015);

                timer = setTimeout(startBidding, 600);
            }

            function startBidding() {
                state.phase = 'bidding';
                [1, 2, 3].forEach(p => {
                    const est = estimateBid(state.hands[p]);
                    state.bids[p] = shouldBidNil(state.hands[p]) && rng(100) < 18 ? 0 : est;
                    $(`#modal-bid-${p}`).textContent = state.bids[p] === 0 ? 'NIL' : state.bids[p];
                });
                $('#modal-bid-0').textContent = '?';
                const suggestion = shouldBidNil(state.hands[0]) ? 0 : estimateBid(state.hands[0]);
                $('#partner-bid-display').textContent = state.bids[2] === 0 ? 'NIL' : state.bids[2];

                buildBidGrid();
                $('#btn-confirm-bid').disabled = true;
                state.selectedBid = null;

                renderAll();
                openModal('bid-modal');
                toast('Choose your bid. Partner bid: ' + (state.bids[2] === 0 ? 'NIL' : state.bids[2]), true);
            }

            function buildBidGrid() {
                const grid = $('#bid-grid');
                grid.innerHTML = '';
                for (let bid = 0; bid <= 13; bid++) {
                    const chip = document.createElement('button');
                    chip.type = 'button';
                    chip.className = `bid-chip${bid === 0 ? ' nil' : ''}`;
                    chip.textContent = bid === 0 ? 'NIL' : bid;
                    chip.dataset.bid = bid;
                    chip.addEventListener('click', () => selectBid(bid));
                    grid.appendChild(chip);
                }
            }

            function selectBid(bid) {
                state.selectedBid = bid;
                $$('.bid-chip').forEach(c => c.classList.toggle('selected', +c.dataset.bid === bid));
                $('#modal-bid-0').textContent = bid === 0 ? 'NIL' : bid;
                $('#btn-confirm-bid').disabled = false;
                beep(500, 0.05, 0.02);
            }

            function confirmBid() {
                if (state.selectedBid === null) return;
                state.bids[0] = state.selectedBid;
                closeModal('bid-modal');
                state.phase = 'playing';
                state.turn = state.leader;
                renderAll();
                $('#center-msg').textContent = state.leader === 0 ? 'You lead.' : `${NAMES[state.leader]} leads.`;
                if (state.turn === 0) {
                    toast('Your lead.');
                } else {
                    toast(`${NAMES[state.turn]} leads.`);
                    timer = setTimeout(() => aiPlay(state.turn), AI_DELAY);
                }
            }

            // ═══════════════════════════════════════════
            // 🎓 TUTORIAL SYSTEM
            // ═══════════════════════════════════════════

            function clearTutorialHighlights() {
                $$('.tutorial-card').forEach(c => c.classList.remove('tutorial-card'));
                $$('.seat').forEach(s => s.classList.remove('tutorial-spotlight'));
                $$('.card').forEach(c => c.classList.remove('disabled'));
                $('#toast-msg').classList.remove('tutorial-highlight');
            }

            function tutorialStart() {
                if (state.phase === 'playing' || state.phase === 'bidding') {
                    toast('Please finish the current match first, or end it before starting the tutorial.',
                        true);
                    return;
                }

                tutorial.active = true;
                tutorial.step = 0;
                tutorial.originalState = {
                    phase: state.phase,
                    hands: state.hands.map(h => [...h]),
                    bids: [...state.bids],
                    tricks: [...state.tricks],
                    scores: [...state.scores],
                    bags: [...state.bags],
                    dealer: state.dealer,
                    leader: state.leader,
                    turn: state.turn,
                    leadSuit: state.leadSuit,
                    spadesBroken: state.spadesBroken,
                    trick: [...state.trick],
                    round: state.round,
                    selectedBid: state.selectedBid,
                    roundSummary: state.roundSummary ? JSON.parse(JSON.stringify(state.roundSummary)) : null,
                    matchRecorded: state.matchRecorded,
                };

                clearTimer();
                clearSlots();

                state.hands = [
                    [
                        { suit: '♥', rank: 'A', value: 14, id: 'A♥' },
                        { suit: '♥', rank: 'K', value: 13, id: 'K♥' },
                        { suit: '♠', rank: '5', value: 7, id: '5♠' },
                        { suit: '♣', rank: '3', value: 5, id: '3♣' },
                    ],
                    [{ suit: '♥', rank: '2', value: 4, id: '2♥' }],
                    [{ suit: '♥', rank: 'Q', value: 12, id: 'Q♥' }],
                    [{ suit: '♥', rank: 'J', value: 11, id: 'J♥' }],
                ];
                state.hands.forEach(sortHand);
                state.bids = [2, 1, 1, 1];
                state.tricks = [0, 0, 0, 0];
                state.spadesBroken = false;
                state.leadSuit = null;
                state.trick = [];
                state.phase = 'playing';
                state.turn = 0;
                state.round = 1;
                state.scores = [0, 0];
                state.bags = [0, 0];

                renderAll();
                $('#center-msg').textContent = 'Tutorial: Your turn.';
                tutorialShowStep(0);
            }

            function tutorialShowStep(step) {
                tutorial.step = step;
                clearTutorialHighlights();
                $$('.card').forEach(c => c.classList.add('disabled'));

                switch (step) {
                    case 0:
                        $('#seat-0').classList.add('tutorial-spotlight');
                        toast('🎓 <strong>Welcome to Spades!</strong><br>Spades (♠) are always trump — they beat any other suit. You have 4 cards. Let\'s learn by playing a practice trick. Click <strong>Continue</strong> below.', true, true);
                        tutorialShowContinueButton('Start Trick 1 →');
                        break;
                    case 1:
                        $('#seat-0').classList.add('tutorial-spotlight');
                        tutorial.highlightCardIds = new Set(['A♥', 'K♥']);
                        renderPlayerHand();
                        toast('🎓 <strong>Trick 1: Lead High.</strong><br>You\'re first to play. Lead your <strong>A♥</strong> — highest heart wins the trick. Click the glowing A♥.', true, true);
                        tutorialHideContinueButton();
                        break;
                    case 2:
                        tutorial.highlightCardIds = null;
                        renderPlayerHand();
                        toast('🎓 <strong>Great lead!</strong><br>Now watch as the others follow suit. They must play hearts if they have one.', true, true);
                        tutorialHideContinueButton();
                        timer = setTimeout(() => {
                            commitPlay(1, state.hands[1][0]);
                            timer = setTimeout(() => {
                                commitPlay(2, state.hands[2][0]);
                                timer = setTimeout(() => commitPlay(3, state.hands[3][0]), 600);
                            }, 600);
                        }, 800);
                        break;
                    case 3:
                        $('#seat-0').classList.add('tutorial-spotlight');
                        toast('🎓 <strong>You win the trick!</strong><br>Your A♥ beat their 2♥, Q♥, and J♥. You now have 1 trick. Click Continue.', true, true);
                        tutorialShowContinueButton('Next →');
                        break;
                    case 4:
                        clearSlots();
                        state.trick = [];
                        state.leadSuit = null;
                        state.turn = 1;
                        state.hands[1] = [{ suit: '♦', rank: '7', value: 9, id: '7♦' }];
                        state.hands[2] = [{ suit: '♦', rank: '9', value: 11, id: '9♦' }];
                        state.hands[3] = [{ suit: '♦', rank: 'K', value: 13, id: 'K♦' }];
                        state.hands[0] = [
                            { suit: '♥', rank: 'K', value: 13, id: 'K♥' },
                            { suit: '♠', rank: '5', value: 7, id: '5♠' },
                            { suit: '♣', rank: '3', value: 5, id: '3♣' },
                        ];
                        state.hands.forEach(sortHand);
                        renderAll();
                        $('#seat-1').classList.add('tutorial-spotlight');
                        toast('🎓 <strong>Trick 2: Trumping.</strong><br>Vega leads 7♦. You have no diamonds! But you have a spade… Watch Vega play.', true, true);
                        tutorialHideContinueButton();
                        timer = setTimeout(() => {
                            commitPlay(1, state.hands[1][0]);
                            timer = setTimeout(() => {
                                commitPlay(2, state.hands[2][0]);
                                timer = setTimeout(() => commitPlay(3, state.hands[3][0]), 600);
                            }, 600);
                        }, 1000);
                        break;
                    case 5:
                        $('#seat-0').classList.add('tutorial-spotlight');
                        tutorial.highlightCardIds = new Set(['5♠']);
                        renderPlayerHand();
                        toast('🎓 <strong>Your turn!</strong><br>You\'re void in diamonds. Play your <strong>5♠</strong> to trump — even a low spade beats any non-spade!', true, true);
                        tutorialHideContinueButton();
                        break;
                    case 6:
                        tutorial.highlightCardIds = null;
                        renderPlayerHand();
                        toast('🎓 <strong>Spades broken!</strong><br>Your 5♠ trumps the three diamonds. Let the table resolve the trick.', true, true);
                        tutorialHideContinueButton();
                        break;
                    case 7:
                        $('#seat-0').classList.add('tutorial-spotlight');
                        toast('🎓 <strong>Trump wins!</strong><br>Your 5♠ beats all diamonds. You now have 2 tricks — exactly your bid! Click Continue.', true, true);
                        tutorialShowContinueButton('Finish Tutorial →');
                        break;
                    case 8:
                        tutorialEnd('🎓 <strong>Tutorial Complete!</strong><br>You learned: leading high cards, following suit, and trumping with spades. You\'re ready for a real match! Press ✦ New Match to play.', true);
                        break;
                }
            }

            function tutorialHandleCardClick(cardId) {
                if (state.turn !== 0) return;
                const card = state.hands[0].find(c => c.id === cardId);
                if (!card) return;
                if (tutorial.step === 1) {
                    if (card.id === 'A♥') {
                        tutorialShowStep(2);
                        commitPlay(0, card);
                    } else {
                        toast('⚠️ Play the <strong>A♥</strong> (the glowing Ace of Hearts) to lead the trick.', true);
                        beep(150, 0.15, 0.04);
                    }
                } else if (tutorial.step === 5) {
                    if (card.id === '5♠') {
                        tutorialShowStep(6);
                        commitPlay(0, card);
                    } else {
                        toast('⚠️ Play the <strong>5♠</strong> — you have no diamonds, so trump with a spade!', true);
                        beep(150, 0.15, 0.04);
                    }
                }
            }

            function tutorialHandleTurn() {
                if (state.trick.length === 4 || state.turn !== 0) return;
                if (tutorial.step === 2) tutorialShowStep(3);
                else if (tutorial.step === 4) tutorialShowStep(5);
                else if (tutorial.step === 6) tutorialShowStep(7);
            }

            function tutorialShowContinueButton(label) {
                let btn = $('#tutorial-continue-btn');
                if (!btn) {
                    btn = document.createElement('button');
                    btn.id = 'tutorial-continue-btn';
                    btn.className = 'gold-btn';
                    btn.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:170;pointer-events:auto;';
                    btn.addEventListener('click', tutorialContinueClicked);
                    document.body.appendChild(btn);
                }
                btn.textContent = label;
                btn.classList.remove('hidden');
            }

            function tutorialHideContinueButton() {
                const btn = $('#tutorial-continue-btn');
                if (btn) btn.classList.add('hidden');
            }

            function tutorialContinueClicked() {
                const nextStep = tutorial.step + 1;
                if (nextStep <= 8) tutorialShowStep(nextStep);
            }

            function tutorialEnd(message, showToast = false) {
                clearTutorialHighlights();
                tutorialHideContinueButton();
                tutorial.active = false;
                tutorial.step = 0;
                tutorial.highlightCardIds = null;
                clearTimer();
                clearSlots();

                if (tutorial.originalState) {
                    Object.assign(state, tutorial.originalState);
                    state.hands = tutorial.originalState.hands.map(h => [...h]);
                    state.trick = [...tutorial.originalState.trick];
                    state.bids = [...tutorial.originalState.bids];
                    state.tricks = [...tutorial.originalState.tricks];
                    state.scores = [...tutorial.originalState.scores];
                    state.bags = [...tutorial.originalState.bags];
                    tutorial.originalState = null;
                } else {
                    state.phase = 'idle';
                    state.hands = [[], [], [], []];
                }

                renderAll();
                clearSlots();
                $('#center-msg').textContent = 'Press ✦ New Match or 📖 Tutorial.';
                if (showToast && message) toast(message, true);
                try { localStorage.setItem(TUTORIAL_KEY, 'done'); } catch (_) {}
            }
