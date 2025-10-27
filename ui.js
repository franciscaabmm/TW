// js/ui.js

/**
 * Funções de manipulação e renderização do DOM.
 */
export function initUI(board, dice, ai) {
    console.log("🧩 Interface inicializada.");

    const gamePanel = document.querySelector('.game-panel');
    if (!gamePanel) return;

    gamePanel.innerHTML = `
        <h2>🧩 Game Panel</h2>
        <p>O jogo está pronto para começar!</p>
        <button id="start-btn">🎮 Iniciar Jogo</button>
    `;

    const startBtn = document.getElementById('start-btn');
    startBtn.addEventListener('click', () => {
        board.reset();
        const result = dice.roll();
        alert(`🎲 Dado lançado: ${result}`);
    });
}

/** Atualiza a leaderboard no DOM */
export function updateLeaderboard(entries = []) {
    const list = document.querySelector('.leaderboard ol');
    if (!list) return;

    list.innerHTML = entries.map(
        (e, i) => `
        <li>
          <span class="rank">${i + 1}</span>
          <span class="name">${e.name}</span>
          <span class="w/l">${e.score}</span>
        </li>`
    ).join('');
}
