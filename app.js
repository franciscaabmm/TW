// js/app.js
import { initUI, updateLeaderboard } from './ui.js';
import { Board } from './board.js';
import { Dice } from './dice.js';
import { AI } from './ai.js';
import { StorageManager } from './storage.js';

/**
 * Ponto de entrada da aplicação Game-Tab.
 * Aguarda o carregamento completo do DOM e inicializa o jogo.
 */
window.addEventListener('DOMContentLoaded', () => {
    console.log("🎮 Game-Tab iniciado...");

    // Elementos principais
    const gamePanel = document.querySelector('.game-panel');
    const loginButton = document.querySelector('.comando-box button');
    const usernameInput = document.querySelector('.comando-box input[type="text"]');
    const passwordInput = document.querySelector('.comando-box input[type="password"]');

    if (!gamePanel || !loginButton) {
        console.error("❌ Erro: elementos essenciais do DOM não encontrados.");
        return;
    }

    // Inicializa módulos principais
    const board = new Board();
    const dice = new Dice();
    const ai = new AI();
    const storage = new StorageManager();

    // Inicializa UI e listeners
    initUI(board, dice, ai);
    updateLeaderboard(storage.getLeaderboard());

    // Login simples de demonstração
    loginButton.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            alert("⚠️ Por favor, insere username e password.");
            return;
        }

        alert(`Bem-vindo(a), ${username}! 🎲`);
        console.log(`👤 Login efetuado por: ${username}`);
    });
});
