(function () {
  'use strict';

  if (window.__fieldKitTicTacToeLayout) return;
  window.__fieldKitTicTacToeLayout = true;

  function installStyles() {
    if (document.getElementById('fieldkitTicTacToeLayoutStyle')) return;
    const style = document.createElement('style');
    style.id = 'fieldkitTicTacToeLayoutStyle';
    style.textContent = `
      body.fk-tic-tac-toe {
        min-height: 100dvh;
        height: 100dvh;
        overflow: hidden;
        gap: 5px !important;
      }

      body.fk-tic-tac-toe > .s-header,
      body.fk-tic-tac-toe > .fk-shell-header {
        flex: 0 0 auto;
        width: 100%;
        margin-bottom: 0 !important;
      }

      body.fk-tic-tac-toe #topbar,
      body.fk-tic-tac-toe #message,
      body.fk-tic-tac-toe #turnbar,
      body.fk-tic-tac-toe #scoreboard {
        flex: 0 0 auto;
      }

      body.fk-tic-tac-toe #topbar {
        min-height: 38px;
        padding-top: 2px;
      }

      body.fk-tic-tac-toe #message,
      body.fk-tic-tac-toe #turnbar {
        min-height: 20px;
        line-height: 20px;
      }

      body.fk-tic-tac-toe #board {
        flex: 0 0 auto;
        max-width: calc(100vw - 12px);
        max-height: calc(100dvh - 160px);
      }

      body.fk-tic-tac-toe #scoreboard {
        width: min(98vw, 1100px) !important;
        min-height: 42px;
        display: grid;
        grid-template-columns: auto repeat(3, minmax(105px, 1fr)) auto;
        align-items: center;
        gap: 8px 14px;
        padding: 5px 10px !important;
      }

      body.fk-tic-tac-toe #scoreboard h3 {
        margin: 0 !important;
        font-size: .72rem !important;
        white-space: nowrap;
      }

      body.fk-tic-tac-toe #scoreboard .score-row {
        min-width: 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin: 0 !important;
        font-size: .76rem !important;
        white-space: nowrap;
      }

      body.fk-tic-tac-toe #scoreboard .score-actions {
        display: flex;
        gap: 5px;
        margin: 0 !important;
      }

      body.fk-tic-tac-toe #scoreboard button {
        min-height: 30px !important;
        height: 30px !important;
        padding: 0 9px !important;
        font-size: .72rem !important;
      }

      @media (max-width: 720px) {
        body.fk-tic-tac-toe #scoreboard {
          grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
          gap: 5px;
          padding: 4px 7px !important;
        }

        body.fk-tic-tac-toe #scoreboard h3 {
          display: none;
        }

        body.fk-tic-tac-toe #scoreboard .score-row {
          display: grid;
          justify-items: center;
          gap: 1px;
          font-size: .65rem !important;
          white-space: normal;
          text-align: center;
        }

        body.fk-tic-tac-toe #scoreboard .score-row > div:last-child {
          font-size: .78rem;
        }

        body.fk-tic-tac-toe #scoreboard .score-actions button {
          width: 30px;
          min-width: 30px;
          padding: 0 !important;
          overflow: hidden;
          color: transparent !important;
          position: relative;
        }

        body.fk-tic-tac-toe #downloadScoreBtn::after,
        body.fk-tic-tac-toe #uploadScoreBtn::after {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          color: #06131a;
          font-size: .86rem;
        }

        body.fk-tic-tac-toe #downloadScoreBtn::after { content: '↓'; }
        body.fk-tic-tac-toe #uploadScoreBtn::after { content: '↑'; }
      }

      @media (max-height: 720px) {
        body.fk-tic-tac-toe #topbar h1 {
          font-size: .96rem;
        }

        body.fk-tic-tac-toe #message,
        body.fk-tic-tac-toe #turnbar {
          font-size: .78rem;
          min-height: 17px;
          line-height: 17px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function init() {
    const board = document.getElementById('board');
    const scoreboard = document.getElementById('scoreboard');
    const sizeInput = document.getElementById('boardSize');
    if (!board || !scoreboard || !sizeInput) return;

    installStyles();
    document.body.classList.add('fk-tic-tac-toe');

    let frame = 0;
    function fitBoard() {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(function () {
        frame = 0;
        const viewport = window.visualViewport;
        const viewportHeight = viewport ? viewport.height : window.innerHeight;
        const viewportWidth = viewport ? viewport.width : window.innerWidth;

        const chromeNodes = [
          document.querySelector('.fk-shell-header'),
          document.querySelector('.s-header'),
          document.getElementById('topbar'),
          document.getElementById('message'),
          document.getElementById('turnbar'),
          scoreboard
        ].filter(Boolean);

        const chromeHeight = chromeNodes.reduce(function (total, node) {
          const style = getComputedStyle(node);
          if (style.display === 'none' || style.position === 'fixed') return total;
          return total + node.getBoundingClientRect().height;
        }, 0);

        const bodyStyle = getComputedStyle(document.body);
        const gap = parseFloat(bodyStyle.rowGap || bodyStyle.gap) || 0;
        const bodyPadding = (parseFloat(bodyStyle.paddingTop) || 0) + (parseFloat(bodyStyle.paddingBottom) || 0);
        const availableHeight = Math.max(150, viewportHeight - chromeHeight - bodyPadding - (gap * Math.max(0, chromeNodes.length - 1)) - 8);
        const availableWidth = Math.max(150, Math.min(1200, viewportWidth - 12));
        const pixels = Math.floor(Math.min(availableHeight, availableWidth));
        const dimension = Math.max(3, parseInt(sizeInput.value, 10) || Math.round(Math.sqrt(board.children.length)) || 10);

        board.style.setProperty('width', pixels + 'px', 'important');
        board.style.setProperty('height', pixels + 'px', 'important');
        board.style.gridTemplateColumns = 'repeat(' + dimension + ', minmax(0, 1fr))';
        board.style.gridTemplateRows = 'repeat(' + dimension + ', minmax(0, 1fr))';
      });
    }

    const boardObserver = new MutationObserver(fitBoard);
    boardObserver.observe(board, { childList: true });

    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(fitBoard);
      [scoreboard, document.getElementById('topbar'), document.getElementById('message'), document.getElementById('turnbar')]
        .filter(Boolean)
        .forEach(function (node) { resizeObserver.observe(node); });
    }

    window.addEventListener('resize', fitBoard);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', fitBoard);
    [0, 100, 350].forEach(function (delay) { window.setTimeout(fitBoard, delay); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
