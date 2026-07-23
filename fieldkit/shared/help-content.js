(function () {
  window.SUITE_HELP_CONTENT = {
    apps: {
      "acronym-list": {
        title: "Acronym List",
        about: "Central glossary of acronyms with filtering and quiz practice.",
        operations: [
          "Browse and search acronym entries.",
          "Filter by tags and categories.",
          "Run quiz mode to test recall."
        ],
        keys: ["Use on-screen controls. No required keyboard shortcuts."],
        commands: ["No CLI commands."],
        scenarios: [
          "Onboard new team members to company language.",
          "Refresh terminology before meetings or interviews."
        ]
      },
      "accent-speaker": {
        title: "Accent Voice Lab",
        about: "Phrase playback app using system/browser speech voices with accent-style presets and tuning controls.",
        operations: [
          "Type or paste a phrase and choose an accent-style preset.",
          "Pick detected voice, tune rate/pitch, and play or stop speech output.",
          "Load sample phrases quickly for testing."
        ],
        keys: ["Use touch/click controls. F1 opens app help."],
        commands: ["No CLI commands."],
        scenarios: [
          "Practice situational lines with different delivery styles.",
          "Entertainment and tone experimentation for scripts or roleplay."
        ]
      },
      "authority-assistant": {
        title: "Authority Assistant",
        about: "Stress-mode communication helper for encounters with officials, with large speak controls and optional incident alerts.",
        operations: [
          "Review consent gate and choose the appropriate path (real emergency vs pulled-over scenario).",
          "Select encounter type and enter profile details.",
          "Toggle rights statements and generate a calm script.",
          "Use large SPEAK controls to play intro, rights, or full statement.",
          "Switch to pre-recorded clip mode for more natural voice playback and load local intro/rights/full audio files.",
          "Capture location and send alert payload to contacts, webhook, and optional /api/support/ticket endpoint.",
          "Open Legal Library for references, pinned docs, and imported materials."
        ],
        keys: ["Use touch/click controls. F1 opens app help."],
        commands: ["No CLI commands. Optional POST webhook and POST /api/support/ticket."],
        scenarios: [
          "Communicate consistently under stress during a stop/check encounter.",
          "Send structured incident context to your emergency network quickly."
        ]
      },
      "legal-library": {
        title: "Legal Library",
        about: "Standalone legal references app with local document import, full-text search, pinned stress-mode docs, and recent access.",
        operations: [
          "Search across built-in references and imported documents.",
          "Import local .pdf/.epub/.md/.txt documents for offline access.",
          "Pin high-priority items for stress-mode quick retrieval.",
          "Open recently used items quickly."
        ],
        keys: ["Use touch/click controls. F1 opens app help."],
        commands: ["No CLI commands."],
        scenarios: [
          "Maintain a portable legal reference shelf for offline use.",
          "Access key references quickly during high-stress encounters."
        ]
      },
      "clock": {
        title: "Clock",
        about: "Local time utility with alarm, countdown timer, and stopwatch.",
        operations: [
          "View live date/time display.",
          "Set alarm with loud tone, vibration, and full-screen flashing alert.",
          "Run countdown timers.",
          "Use stopwatch with lap tracking."
        ],
        keys: ["Use on-screen controls."],
        commands: ["No CLI commands."],
        scenarios: [
          "Reliable wake/alert flow when visual border-only alarms are insufficient.",
          "Focus blocks, workouts, drills, and timing tasks."
        ]
      },
      "profile": {
        title: "Profile Manager",
        about: "Global username/password manager shared by protected apps.",
        operations: [
          "Create or update a single global username/password.",
          "Sign out the current device quickly.",
          "Delete profile credentials when rotating access."
        ],
        keys: ["Use form controls and buttons. F1 opens app help."],
        commands: ["No CLI commands."],
        scenarios: [
          "Set credentials once and reuse for GigTax and Snippet Board.",
          "Lock down shared devices with quick sign-out."
        ]
      },
      "docketpro": {
        title: "DocketPro",
        about: "Legal docket and deadline manager.",
        operations: [
          "Create and track docket records.",
          "Manage matter status and deadlines.",
          "Export or import records for continuity."
        ],
        keys: ["Use app buttons/forms. Some pages may support Enter-to-save."],
        commands: ["No CLI commands."],
        scenarios: [
          "Daily case review and next-action planning.",
          "Prepare docket timelines before hearings."
        ]
      },
      "drivers-license": {
        title: "Driver License Study Lab",
        about: "Multilingual permit prep with digest, Q&A, and flashcards.",
        operations: [
          "Select language and choose built-in or custom deck.",
          "Study Q&A with Show Answer flow.",
          "Use flashcards and load custom Question||Answer material."
        ],
        keys: ["Arrow keys for navigation in study views.", "Space flips flashcard."],
        commands: ["No CLI commands."],
        scenarios: [
          "Prepare for permit tests in preferred language.",
          "Repurpose for other short study decks."
        ]
      },
      "employee-skills": {
        title: "Employee Skills",
        about: "Skill matrix and capability mapping for team planning.",
        operations: [
          "Track skill levels by person.",
          "Compare role requirements to current coverage.",
          "Run what-if staffing views."
        ],
        keys: ["Use form controls and action buttons."],
        commands: ["No CLI commands."],
        scenarios: [
          "Identify team skill gaps.",
          "Support hiring and upskilling plans."
        ]
      },
      "wishlist": {
        title: "Wishlist Studio",
        about: "Request intake app for custom feature/app ideas with local queue plus optional server submit.",
        operations: [
          "Configure endpoint, API key, and device ID for optional online submit.",
          "Capture request title, scenario, budget, timeline, and tags.",
          "Save requests locally and submit immediately or later.",
          "Track item state: local, submitted, or submit-error."
        ],
        keys: ["Use touch/click controls. F1 opens app help."],
        commands: ["No CLI commands. Optional POST /api/wishlist/submit endpoint."],
        scenarios: [
          "Collect customer ideas and price-range signals in one intake funnel.",
          "Convert wishlist items into short custom app delivery cycles."
        ]
      },
      "support": {
        title: "Support Desk",
        about: "Offline-first support ticket intake with optional online submit to backend queue.",
        operations: [
          "Configure support endpoint, API key, device ID, and default contact.",
          "Create tickets with subject, severity, repro steps, expected/actual behavior, and screenshot URL.",
          "Save tickets locally when offline.",
          "Submit now or resubmit later from queue."
        ],
        keys: ["Use touch/click controls. F1 opens app help."],
        commands: ["No CLI commands. Optional POST /api/support/ticket endpoint."],
        scenarios: [
          "Provide built-in customer support without external community tooling.",
          "Capture reliable bug reports with reproducible details."
        ]
      },
      "first-aid": {
        title: "First Aid & CPR",
        about: "Offline quick-reference for CPR and common first-aid scenarios with a compression coach timer/metronome.",
        operations: [
          "Open tabbed guidance for CPR, choking, severe bleeding, burns, and recovery position.",
          "Run CPR coach with 100/110/120 BPM pacing and 2-minute cycle timer.",
          "Use diagrams and concise step lists for fast field recall."
        ],
        keys: ["Use on-screen controls. F1 opens app help."],
        commands: ["No CLI commands."],
        scenarios: [
          "Emergency refresher when connectivity or printed material is unavailable.",
          "Practice compression pacing with metronome before formal training refresh."
        ]
      },
      "gigtax": {
        title: "GigTax",
        about: "1099 tax estimator for self-employed and freelance income.",
        operations: [
          "Enter income and deduction data.",
          "Review estimated obligations.",
          "Adjust assumptions for planning."
        ],
        keys: ["Enter can submit in many fields."],
        commands: ["No CLI commands."],
        scenarios: [
          "Plan quarterly payments.",
          "Estimate year-end tax exposure."
        ]
      },
      "habit-tracker": {
        title: "Habit Tracker",
        about: "Track recurring habits and consistency over time.",
        operations: [
          "Create habits and mark completions.",
          "Review streaks and historical patterns.",
          "Export/import data for backup."
        ],
        keys: ["Use app controls for check-ins and edits."],
        commands: ["No CLI commands."],
        scenarios: [
          "Build personal routines.",
          "Track behavior-change consistency."
        ]
      },
      "js-trainer": {
        title: "JavaScript Trainer",
        about: "Interactive JS learning terminal with quiz modules and REPL behavior.",
        operations: [
          "Type help to list modules and trainer commands.",
          "Start modules and answer prompts.",
          "Use live JS-style command interactions."
        ],
        keys: ["Enter runs input.", "Arrow Up/Down navigates input history."],
        commands: [
          "help, toc, start <id|#>, status, review, hint, skip, exit, clear, reset"
        ],
        scenarios: [
          "Practice JS syntax under pressure.",
          "Reinforce interview-priority concepts."
        ]
      },
      "kanban": {
        title: "Kanban Board",
        about: "Visual task management across workflow stages.",
        operations: [
          "Create, edit, and move task cards.",
          "Track todo, doing, done states.",
          "Use import/export for persistence."
        ],
        keys: ["Check app shortcut modal from menu for board-specific keys."],
        commands: ["No CLI commands."],
        scenarios: [
          "Plan weekly workload.",
          "Run simple sprint board with priorities."
        ]
      },
      "light-messenger": {
        title: "Light Messenger",
        about: "Line-of-sight backup communication using Morse-framed flashes and camera decoding.",
        operations: [
          "Transmit: build message, set unit speed, repeats, then start flash transmission.",
          "Receive: start camera, tune threshold, decode validated frames.",
          "Use presets for emergency short phrases."
        ],
        keys: ["Use touch/click controls. F1 opens app help."],
        commands: ["No CLI commands."],
        scenarios: [
          "Off-grid short message exchange in visual range.",
          "Emergency signaling when network is unavailable."
        ]
      },
      "outdoor-kit": {
        title: "Outdoor Kit",
        about: "Autonomous field toolkit with compass, GPS speed/altitude, distance + sun/star helpers, sunrise/sunset timing, tap-map measuring, SOS/flashlight, direct chat, optional online AI, and a scientific calculator.",
        operations: [
          "Navigation tab: start compass and GPS tracking for heading, speed, altitude, and trip distance.",
          "Distance/Sun helper: compute distance/bearing between coordinates and get sun azimuth/altitude, sunrise/sunset/solar-noon, and Polaris guidance.",
          "Tap-map helper: tap two points to measure map distance or calibrate meters-per-pixel using a known segment.",
          "Signal tab: toggle flashlight and run SOS beacon pattern.",
          "Direct Chat tab: create/join WebRTC connection using manual offer/answer exchange and optional QR helper.",
          "AI tab: optionally configure Ollama or OpenAI-compatible endpoint when internet is available.",
          "Calculator tab: evaluate scientific expressions, switch DEG/RAD trig mode, save formulas, review history, and run field conversions offline."
        ],
        keys: [
          "Enter sends peer chat messages and AI prompts in input fields.",
          "Enter evaluates calculator expressions.",
          "F1 opens app help."
        ],
        commands: [
          "No CLI commands. Uses browser sensor APIs and optional network APIs."
        ],
        scenarios: [
          "Primary off-grid utility app for orientation and signaling.",
          "Field geometry/navigation checks with map tapping and trig formulas.",
          "LAN peer communication when Wi-Fi exists without backend.",
          "Online augmentation with LLM guidance when connectivity is available."
        ]
      },
      "field-checkin": {
        title: "Field Check-In",
        about: "Registration and heartbeat client for VPS/cloud monitoring workflows.",
        operations: [
          "Configure API base URL, API key (optional), device ID, and app version.",
          "Run Pulse test to verify server reachability.",
          "Submit registration with owner and emergency contact details.",
          "Send heartbeat status updates with optional battery/GPS/location notes.",
          "Enable auto-heartbeat mode for periodic check-ins while online."
        ],
        keys: ["Use touch/click controls. F1 opens app help."],
        commands: ["No CLI commands. Uses /api/register and /api/heartbeat endpoints."],
        scenarios: [
          "Customer onboarding after purchase with license/device registration.",
          "Field expedition monitoring with last-known status and route notes.",
          "Optional emergency workflow based on stale heartbeat detection."
        ]
      },
      "privacy-camera": {
        title: "Privacy Camera",
        about: "Photo capture utility that keeps shots in memory by default and only exports on explicit user action.",
        operations: [
          "Start/stop camera and flip front/rear mode.",
          "Capture photos into in-memory blobs (tab session).",
          "Monitor online/offline pulse and queue pending media.",
          "Configure sync endpoint and auto-upload pending shots when online.",
          "Download or delete individual shots, or clear all."
        ],
        keys: ["Use touch/click controls. F1 opens app help."],
        commands: ["No CLI commands."],
        scenarios: [
          "Sensitive capture workflows where automatic gallery saves are undesirable.",
          "Quick field snapshots with explicit retention control."
        ]
      },
      "privacy-recorder": {
        title: "Privacy Video Recorder",
        about: "Video recorder that buffers clips in memory first and exports only when requested.",
        operations: [
          "Start/stop camera, toggle mic, and flip front/rear mode.",
          "Record clips with MediaRecorder into temporary in-memory blobs.",
          "Monitor online/offline pulse and queue pending clips.",
          "Configure sync endpoint and auto-upload pending clips when online.",
          "Preview, download, delete clips, or clear all."
        ],
        keys: ["Use touch/click controls. F1 opens app help."],
        commands: ["No CLI commands."],
        scenarios: [
          "Short evidence or field recordings with explicit save decisions.",
          "Privacy-first capture where auto-sync/auto-gallery is discouraged."
        ]
      },
      "image-rater": {
        title: "Image Rater Lab",
        about: "Offline-first image rating and preference profiling tool for products, outfits, and visual concepts.",
        operations: [
          "Load decks from uploaded images, URL rows, or JSON import.",
          "Rate each item from 1 to 5, skip/next/previous, and jump to unrated items.",
          "Use swipe left/right on touch devices to move between items quickly.",
          "Optionally configure OpenAI-compatible caption API settings and auto-tag the current image or unrated batches when online.",
          "Track points and credits from completed ratings.",
          "Review tag-based preference profile and recent rating history.",
          "Export full session (deck, ratings, profile) to JSON for transfer or analysis."
        ],
        keys: [
          "1-5 applies rating to current image.",
          "Arrow Right/Arrow Left moves next/previous.",
          "S skips current item.",
          "Swipe left/right on image viewer for next/previous on touch devices.",
          "F1 opens app help."
        ],
        commands: ["No CLI commands."],
        scenarios: [
          "Collect user taste signals for fashion/product recommendation loops.",
          "Create engagement mechanics where rating actions earn in-app credits.",
          "Run visual preference studies offline and enrich with AI-generated captions/tags when connectivity returns."
        ]
      },
      "linux-trainer": {
        title: "Linux Trainer",
        about: "Terminal-style Linux command trainer with module quizzes.",
        operations: [
          "Type help to see modules and meta-commands.",
          "Start modules and answer command prompts.",
          "Use review mode for missed questions."
        ],
        keys: ["Enter runs command.", "Arrow Up/Down navigates command history."],
        commands: [
          "help, toc, start <id|#>, status, review, hint, skip, exit, clear, reset"
        ],
        scenarios: [
          "Build command recall speed.",
          "Prepare for Linux interviews and practical tasks."
        ]
      },
      "math-trainer": {
        title: "Math Trainer",
        about: "Timed arithmetic drills with scoring and progress feedback.",
        operations: [
          "Select drill mode and difficulty.",
          "Solve prompt sets and review scores.",
          "Track improvements over sessions."
        ],
        keys: ["Numeric input + Enter for fast answers."],
        commands: ["No CLI commands."],
        scenarios: [
          "Daily mental-math warmups.",
          "Skill refresh before exams."
        ]
      },
      "music-player": {
        title: "Music Player",
        about: "Local audio player with simple playlist controls and offline-friendly behavior.",
        operations: [
          "Load one or many local audio files.",
          "Use playlist controls for play/pause/next/prev and volume.",
          "Delete tracks or clear playlist."
        ],
        keys: ["Use on-screen controls. F1 opens app help."],
        commands: ["No CLI commands."],
        scenarios: [
          "Offline music playback during field work or travel.",
          "Simple audio utility on older machines."
        ]
      },
      "music-trainer": {
        title: "Music Theory",
        about: "Interactive ear training and theory practice environment.",
        operations: [
          "Run ear/chord/rhythm exercises.",
          "Use piano and drill tools.",
          "Review logs and training data."
        ],
        keys: ["Use on-screen controls for each training module."],
        commands: ["No CLI commands."],
        scenarios: [
          "Structured daily musicianship training.",
          "Target weak spots in interval/chord recognition."
        ]
      },
      "audio-notes": {
        title: "Audio Notes Recorder",
        about: "Voice note recorder with local playback/download and optional cloud sync.",
        operations: [
          "Configure sync endpoint/API key/device ID (optional).",
          "Start/stop microphone recording and create titled notes.",
          "Play back and download notes locally.",
          "Sync individual notes when online."
        ],
        keys: ["Use touch/click controls. F1 opens app help."],
        commands: ["No CLI commands. Optional POST /api/media/upload endpoint."],
        scenarios: [
          "Capture quick voice memos and field journals.",
          "Keep notes offline first, sync selectively later."
        ]
      },
      "midi-note-helper": {
        title: "MIDI Note Helper",
        about: "Fast MIDI number <-> note/octave mapper with frequency reference.",
        operations: [
          "Enter MIDI number (0-127) or use slider to map to note name and octave.",
          "Adjust A4 reference frequency and view recalculated pitch frequencies.",
          "Convert note name + octave back to MIDI number.",
          "Use built-in C-note octave table (including 24/36/48/60/72 anchors)."
        ],
        keys: ["Use on-screen inputs/sliders. F1 opens app help."],
        commands: ["No CLI commands."],
        scenarios: [
          "Reconnect piano memory by mapping keyboard notes to MIDI values.",
          "Support MIDI scripting and training workflows."
        ]
      },
      "odd-one-out": {
        title: "Odd One Out",
        about: "Pattern discrimination game for focus and visual scanning.",
        operations: [
          "Start round and find the different item quickly.",
          "Advance through harder rounds with less obvious differences."
        ],
        keys: ["R can restart in many builds.", "Pointer/touch selects cells."],
        commands: ["No CLI commands."],
        scenarios: [
          "Short cognitive warmups.",
          "Attention and perception drills."
        ]
      },
      "pattern-mirror": {
        title: "Pattern Mirror",
        about: "Memory challenge for sequence retention and replay.",
        operations: [
          "Observe generated pattern.",
          "Repeat sequence accurately.",
          "Scale difficulty over rounds."
        ],
        keys: ["Use pointer/touch input."],
        commands: ["No CLI commands."],
        scenarios: [
          "Quick concentration sessions.",
          "Memory and reaction training."
        ]
      },
      "pomodoro": {
        title: "Pomodoro Timer",
        about: "Focus timer with work/break cycles and session tracking.",
        operations: [
          "Start and pause sessions.",
          "Skip/reset intervals as needed.",
          "Export logs and settings."
        ],
        keys: [
          "Space start/pause, S skip, N skip-no-log, R reset.",
          "Arrow Up/Down adjust timer in some modes."
        ],
        commands: ["No CLI commands."],
        scenarios: [
          "Deep-work blocks.",
          "Structured breaks to reduce burnout."
        ]
      },
      "receipt-tracker": {
        title: "Receipt Tracker",
        about: "Capture receipts and maintain expense records.",
        operations: [
          "Upload receipt files/images.",
          "Edit metadata and categorize entries.",
          "Filter and export for reporting."
        ],
        keys: ["Use table/form controls for edits."],
        commands: ["No CLI commands."],
        scenarios: [
          "Monthly bookkeeping cleanup.",
          "Tax-season preparation."
        ]
      },
      "battleship": {
        title: "Battleship",
        about: "Classic naval strategy game where you locate and sink the opponent fleet.",
        operations: [
          "Start a new match and place/confirm ships as required by the game flow.",
          "Select target coordinates and fire each turn.",
          "Track hits, misses, and remaining ship cells."
        ],
        keys: ["Use pointer/touch input to target cells."],
        commands: ["No CLI commands."],
        scenarios: [
          "Quick strategy break sessions.",
          "Two-player style tactical gameplay practice."
        ]
      },
      "game-academy": {
        title: "Game Academy",
        about: "2-in-1 strategy app with Chess and Checkers, featuring Play mode and Watch-and-Learn commentary mode.",
        operations: [
          "Switch between Chess and Checkers from the top game tabs.",
          "Play mode: choose AI level/color and make moves directly on the board.",
          "Watch mode: assign AI levels for both sides, set speed, and run auto-play or step-by-step analysis.",
          "Review teaching log tags for tactical and positional concepts while the game progresses."
        ],
        keys: [
          "Use pointer/touch controls to select and play moves.",
          "F1 opens app help."
        ],
        commands: ["No CLI commands."],
        scenarios: [
          "Learn tactical patterns by watching two AIs with commentary.",
          "Practice direct play against configurable opponents in either game."
        ]
      },
      "reversi": {
        title: "Reversi",
        about: "Classic 8x8 disc-flipping strategy game with Play mode and Watch-and-Learn mode.",
        operations: [
          "Play mode: choose AI difficulty and place legal moves as black.",
          "Watch mode: set black/white AI levels, speed, and observe move-by-move explanations.",
          "Use Start/Pause/Next/Reset in Watch mode to step through decisions.",
          "Review move log tags for concepts like corner control, mobility, danger, and edge play."
        ],
        keys: [
          "Use pointer/touch controls for move selection.",
          "F1 opens app help."
        ],
        commands: ["No CLI commands."],
        scenarios: [
          "Learn core Othello/Reversi strategy by watching stronger AI explain choices.",
          "Practice tactical and positional play against increasing difficulty."
        ]
      },
      "positive-iq": {
        title: "Positive IQ Test",
        about: "Cognitive mini-test experience focused on logic, memory, and speed tasks.",
        operations: [
          "Start a test run and complete each section.",
          "Follow stage instructions and submit responses within time limits.",
          "Review final score and best result."
        ],
        keys: ["Keyboard and pointer controls depend on active test stage."],
        commands: ["No CLI commands."],
        scenarios: [
          "Daily cognition warmup.",
          "Personal progress tracking over repeated test runs."
        ]
      },
      "math-raindrops": {
        title: "Math Raindrops",
        about: "Fast-paced arithmetic game with adaptive falling problems.",
        operations: [
          "Start game and answer falling math prompts quickly.",
          "Switch between free input and no-typing directional multiple-choice mode.",
          "Pause/resume and chase higher accuracy/speed."
        ],
        keys: [
          "Space clears current typed input in free-input mode.",
          "P pauses/resumes the game.",
          "Enter submits typed answers in free-input mode.",
          "Arrow keys select directional answers in multiple-choice mode."
        ],
        commands: ["No CLI commands."],
        scenarios: [
          "Mental math reflex training.",
          "Short high-focus challenge rounds."
        ]
      },
      "tetris": {
        title: "Block Drop",
        about: "Offline falling-block arcade game with a modern 7-bag piece system, hold slot, ghost piece, next queue, scoring, and local best score.",
        operations: [
          "Move and rotate pieces to complete horizontal lines.",
          "Use Hold once per piece to save a difficult shape for later.",
          "Clear ten lines to advance a level and increase the drop speed.",
          "Use New game to restart a run; the best score remains on this device."
        ],
        keys: [
          "Arrow keys move, rotate, and soft drop; Space hard drops.",
          "C holds the active piece and P pauses or resumes.",
          "On touch screens, swipe left/right/down or tap the board to rotate."
        ],
        commands: ["No CLI commands."],
        scenarios: [
          "Quick offline arcade break.",
          "Practice planning, spatial rotation, and increasing-speed play."
        ]
      },
      "snake": {
        title: "Snake",
        about: "Classic snake game for quick breaks.",
        operations: [
          "Start game and steer to collect items.",
          "Avoid collisions while maximizing score."
        ],
        keys: ["Arrow keys / WASD depending on platform build."],
        commands: ["No CLI commands."],
        scenarios: [
          "Short mental reset between work sessions."
        ]
      },
      "snippet-board": {
        title: "Snippet Board",
        about: "Store and organize reusable code snippets.",
        operations: [
          "Create snippets with tags/groups.",
          "Search/filter to find reusable blocks.",
          "Export/import local DB snapshots."
        ],
        keys: ["Use app controls and editor input."],
        commands: ["No CLI commands."],
        scenarios: [
          "Reduce repetitive coding.",
          "Maintain reusable implementation library."
        ]
      },
      "tic-tac-toe": {
        title: "Tic-Tac-Toe",
        about: "Simple strategy game with score tracking.",
        operations: [
          "Place marks and complete rows/columns/diagonals.",
          "Reset board for new rounds."
        ],
        keys: ["Pointer/touch controls."],
        commands: ["No CLI commands."],
        scenarios: ["Quick logic break."]
      },
      "time-tracker": {
        title: "Time Tracker",
        about: "Session-based activity tracking for productivity and billing.",
        operations: [
          "Start/stop named sessions.",
          "Categorize and review timelines.",
          "Export data for reporting/invoicing."
        ],
        keys: ["Use app controls. Enter may submit forms in some fields."],
        commands: ["No CLI commands."],
        scenarios: [
          "Client billable-hour tracking.",
          "Review time allocation by project."
        ]
      },
      "cns-tap-test": {
        title: "CNS Tap Test",
        about: "Rapid tap test for readiness checks before training.",
        operations: [
          "Select test duration and run tap attempts.",
          "Compare score to rolling baseline.",
          "Follow recommendation: heavy, maintain, or recover."
        ],
        keys: ["Space can start test in supported views.", "Tap area captures all taps during active test."],
        commands: ["No CLI commands."],
        scenarios: [
          "Decide training intensity for the day.",
          "Track CNS readiness trends week-to-week."
        ]
      },
      "inventory": {
        title: "Inventory Manager",
        about: "Catalog manager for physical stock and software offers (modules/packages/customizations) with intake-to-GitHub workflow.",
        operations: [
          "Create and edit offerings with SKU/name/type/billing/status/pricing/delivery link.",
          "Track stock states for physical goods and lifecycle states for software/services.",
          "Load support tickets and wishlist requests from local queue.",
          "Open prefilled GitHub issues (or copy markdown) with reward policy section.",
          "Export and import JSON snapshots for catalog and pipeline config."
        ],
        keys: ["Use touch/click controls. F1 opens app help."],
        commands: ["No CLI commands."],
        scenarios: [
          "Sell software modules/packages/customizations from a single internal catalog.",
          "Convert customer support and feature demand into structured GitHub backlog quickly."
        ]
      },
      "chatgpt-viewer": {
        title: "ChatGPT Viewer",
        about: "Private local viewer for ChatGPT conversation exports.",
        operations: ["Import an exported conversation file.", "Browse and search conversations locally."],
        keys: ["Use on-screen controls. F1 opens FieldKit help."],
        commands: ["N/A"],
        scenarios: ["Use when viewer app is added."]
      },
      "qr-generator": {
        title: "QR Generator",
        about: "Generate QR codes from text or links without sending data to a server.",
        operations: ["Enter text or a URL.", "Generate and save a QR code."],
        keys: ["N/A"],
        commands: ["N/A"],
        scenarios: ["Use when generator app is added."]
      },
      "markdown-slides": {
        title: "Markdown Slides",
        about: "Create presentations from Markdown slide content.",
        operations: ["Write or paste Markdown.", "Present and export your deck."],
        keys: ["N/A"],
        commands: ["N/A"],
        scenarios: ["Use when slides app is added."]
      },
      "meal-tracker": {
        title: "Meal Tracker",
        about: "Placeholder app in launcher registry.",
        operations: ["Not installed in this bundle."],
        keys: ["N/A"],
        commands: ["N/A"],
        scenarios: ["Use when meal tracker is added."]
      },
      "quiz-builder": {
        title: "Quiz Builder",
        about: "Build interactive, local-first quizzes.",
        operations: ["Create question banks.", "Take quizzes and review results."],
        keys: ["N/A"],
        commands: ["N/A"],
        scenarios: ["Use when quiz builder is added."]
      },
      "online-academy": {
        title: "Online Academy",
        about: "Placeholder app in launcher registry.",
        operations: ["Not installed in this bundle."],
        keys: ["N/A"],
        commands: ["N/A"],
        scenarios: ["Use when academy module is added."]
      }
    }
  };
})();
