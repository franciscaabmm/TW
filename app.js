// ============================================
// APP.JS ATUALIZADO COM SISTEMA ONLINE
// ============================================

// Importar classes do servidor (assumindo que está em server-api.js)
import { ServerAPI, SessionManager, OnlineGameManager } from './server-api.js';

// Classes do jogo local (mantidas da parte 1)
class Piece {
  constructor(id, player, row, col) {
    this.id = id;
    this.player = player;
    this.row = row;
    this.col = col;
    this.moved = false;
    this.reachedTop = false;
  }
}

class TabGame {
  constructor() {
    this.boardSize = 9;
    this.gameMode = 'ai';
    this.firstPlayer = 'player1';
    this.aiLevel = 'medium';
    this.currentPlayer = null;
    this.diceValue = null;
    this.diceRolled = false;
    this.selectedPiece = null;
    this.gameStarted = false;
    this.gameOver = false;
    this.board = [];
    this.player1Pieces = [];
    this.player2Pieces = [];
    this.rankings = this.loadRankings();
  }

  initializeBoard() {
    this.board = Array(4).fill(null).map(() => Array(this.boardSize).fill(null));
    this.player1Pieces = [];
    this.player2Pieces = [];

    for (let i = 0; i < this.boardSize; i++) {
      const piece = new Piece(`p1-${i}`, 'player1', 0, i);
      this.player1Pieces.push(piece);
      this.board[0][i] = piece;
    }

    for (let i = 0; i < this.boardSize; i++) {
      const piece = new Piece(`p2-${i}`, 'player2', 3, this.boardSize - 1 - i);
      this.player2Pieces.push(piece);
      this.board[3][this.boardSize - 1 - i] = piece;
    }
  }

  rollDice() {
    const rand = Math.random();
    let value;
    if (rand < 0.06) value = 6;
    else if (rand < 0.31) value = 1;
    else if (rand < 0.69) value = 2;
    else if (rand < 0.94) value = 3;
    else value = 4;
    return value;
  }

  calculateNewPosition(row, col, steps, player) {
    let newRow = row;
    let newCol = col;
    let remaining = steps;

    while (remaining > 0) {
      if (player === 'player1') {
        if (newRow === 0 || newRow === 2) {
          newCol++;
          if (newCol >= this.boardSize) {
            newRow++;
            newCol = this.boardSize - 1;
          }
        } else {
          newCol--;
          if (newCol < 0) {
            if (newRow === 1) {
              newRow++;
              newCol = 0;
            } else if (newRow === 3) {
              newRow = 2;
              newCol = this.boardSize - 1;
            }
          }
        }
      } else {
        if (newRow === 3 || newRow === 1) {
          newCol--;
          if (newCol < 0) {
            newRow--;
            newCol = 0;
          }
        } else {
          newCol++;
          if (newCol >= this.boardSize) {
            if (newRow === 2) {
              newRow--;
              newCol = this.boardSize - 1;
            } else if (newRow === 0) {
              newRow = 1;
              newCol = 0;
            }
          }
        }
      }
      remaining--;
    }

    if (newRow < 0 || newRow >= 4) return null;
    return { row: newRow, col: newCol };
  }

  isValidMove(piece, steps) {
    if (!piece) return false;
    if (!piece.moved && steps !== 1) return false;

    const newPos = this.calculateNewPosition(piece.row, piece.col, steps, piece.player);
    if (!newPos) return false;

    const { row: newRow, col: newCol } = newPos;
    const targetCell = this.board[newRow][newCol];
    if (targetCell && targetCell.player === piece.player) return false;

    const pieces = piece.player === 'player1' ? this.player1Pieces : this.player2Pieces;
    const topRow = piece.player === 'player1' ? 3 : 0;
    const baseRow = piece.player === 'player1' ? 0 : 3;

    if (piece.reachedTop && newRow === topRow) return false;

    if (piece.row === topRow) {
      const hasBasePieces = pieces.some(p => p.row === baseRow);
      if (hasBasePieces) return false;
    }

    return true;
  }

  getValidMoves(player) {
    const pieces = player === 'player1' ? this.player1Pieces : this.player2Pieces;
    return pieces.filter(p => this.isValidMove(p, this.diceValue));
  }

  movePiece(piece, steps) {
    const newPos = this.calculateNewPosition(piece.row, piece.col, steps, piece.player);
    if (!newPos) return false;

    const { row: newRow, col: newCol } = newPos;
    this.board[piece.row][piece.col] = null;

    const targetCell = this.board[newRow][newCol];
    if (targetCell && targetCell.player !== piece.player) {
      if (piece.player === 'player1') {
        this.player2Pieces = this.player2Pieces.filter(p => p.id !== targetCell.id);
      } else {
        this.player1Pieces = this.player1Pieces.filter(p => p.id !== targetCell.id);
      }
    }

    piece.row = newRow;
    piece.col = newCol;
    piece.moved = true;

    const topRow = piece.player === 'player1' ? 3 : 0;
    if (newRow === topRow) {
      piece.reachedTop = true;
    }

    this.board[newRow][newCol] = piece;
    return true;
  }

  makeAIMove() {
    const validPieces = this.getValidMoves('player2');
    if (validPieces.length === 0) return null;

    let chosenPiece;
    if (this.aiLevel === 'easy' || (this.aiLevel === 'medium' && Math.random() < 0.5)) {
      chosenPiece = validPieces[Math.floor(Math.random() * validPieces.length)];
    } else {
      const captureMoves = validPieces.filter(p => {
        const newPos = this.calculateNewPosition(p.row, p.col, this.diceValue, 'player2');
        if (!newPos) return false;
        const target = this.board[newPos.row][newPos.col];
        return target && target.player === 'player1';
      });

      chosenPiece = captureMoves.length > 0
        ? captureMoves[Math.floor(Math.random() * captureMoves.length)]
        : validPieces[Math.floor(Math.random() * validPieces.length)];
    }

    return chosenPiece;
  }

  checkWinner() {
    if (this.player1Pieces.length === 0) return 'player2';
    if (this.player2Pieces.length === 0) return 'player1';
    return null;
  }

  saveRanking(winner, mode) {
    const ranking = {
      date: new Date().toLocaleString('pt-PT'),
      winner: winner,
      mode: mode,
      boardSize: this.boardSize,
      aiLevel: this.aiLevel
    };

    this.rankings.unshift(ranking);
    this.rankings = this.rankings.slice(0, 10);
    localStorage.setItem('tabRankings', JSON.stringify(this.rankings));
  }

  loadRankings() {
    const stored = localStorage.getItem('tabRankings');
    return stored ? JSON.parse(stored) : [];
  }
}

// ============================================
// INTERFACE ATUALIZADA
// ============================================

class GameUI {
  constructor(game, api, session) {
    this.game = game;
    this.api = api;
    this.session = session;
    this.gamePanel = document.querySelector('.game-panel');
    this.onlineManager = new OnlineGameManager(game, this, api, session);
    this.setupEventListeners();
    this.updateLoginUI();
  }

  setupEventListeners() {
    const settingsItems = document.querySelectorAll('.comando-box ul li');
    settingsItems.forEach(item => {
      item.addEventListener('click', () => this.handleSettingClick(item));
    });
  }

  updateLoginUI() {
    const loginSection = document.querySelector('.comando-box[aria-labelledby="login-title"]');
    if (!loginSection) return;

    if (this.session.isAuthenticated) {
      loginSection.innerHTML = `
        <h2 id="login-title">👤 Utilizador</h2>
        <div style="padding: 15px;">
          <p><strong>Nick:</strong> ${this.session.nick}</p>
          <button class="logout-btn" style="margin-top: 10px;">🚪 Terminar Sessão</button>
        </div>
      `;

      loginSection.querySelector('.logout-btn').addEventListener('click', () => {
        this.session.logout();
        this.updateLoginUI();
        this.showMessage('Sessão terminada');
      });
    } else {
      loginSection.innerHTML = `
        <h2 id="login-title">🔐 Login</h2>
        <form class="login-form">
          <label for="username">Username:</label>
          <input id="username" type="text" placeholder="Nick" required>
          
          <label for="password">Password:</label>
          <input id="password" type="password" placeholder="Password" required>
          
          <button type="submit">Login / Registar</button>
        </form>
      `;

      loginSection.querySelector('.login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleLogin();
      });
    }
  }

  async handleLogin() {
    const nick = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!nick || !password) {
      this.showMessage('❌ Preencha todos os campos');
      return;
    }

    try {
      await this.api.register(nick, password);
      this.session.saveSession(nick, password);
      this.updateLoginUI();
      this.showMessage('✅ Login efetuado com sucesso!');
    } catch (error) {
      this.showMessage(`❌ ${error.message}`);
    }
  }

  handleSettingClick(item) {
    const text = item.textContent.toLowerCase();
    
    if (text.includes('tamanho')) {
      this.showBoardSizeSelector();
    } else if (text.includes('inteligência')) {
      this.showAILevelSelector();
    } else if (text.includes('primeiro jogador')) {
      this.showFirstPlayerSelector();
    } else if (text.includes('modo') || text.includes('escolha')) {
      this.showModeSelector();
    } else if (text.includes('desistir') || text.includes('quit')) {
      this.forfeitGame();
    } else if (text.includes('classificações') || text.includes('rankings')) {
      this.showRankings();
    }
  }

  showModeSelector() {
    if (!this.session.isAuthenticated) {
      this.showMessage('❌ Faça login primeiro!');
      return;
    }

    this.gamePanel.innerHTML = `
      <h2>🎮 Modo de Jogo</h2>
      <p>Escolha o modo:</p>
      <div class="mode-buttons">
        <button class="mode-btn" data-mode="ai">🤖 Jogador vs Computador</button>
        <button class="mode-btn" data-mode="pvp">👥 Jogador vs Jogador (Online)</button>
      </div>
      <button class="back-btn">← Voltar</button>
    `;

    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.game.gameMode = e.target.dataset.mode;
        if (this.game.gameMode === 'ai') {
          this.showMessage('Modo: Jogador vs Computador');
          setTimeout(() => this.startGame(), 500);
        } else {
          this.showBoardSizeSelector(true); // true = online mode
        }
      });
    });

    document.querySelector('.back-btn').addEventListener('click', () => {
      this.showWelcomeScreen();
    });
  }

  showBoardSizeSelector(forOnline = false) {
    this.gamePanel.innerHTML = `
      <h2>📐 Tamanho do Tabuleiro</h2>
      <p>Escolha o número de colunas (ímpar):</p>
      <div class="size-buttons">
        ${[7, 9, 11, 13, 15].map(size => 
          `<button class="size-btn" data-size="${size}">${size} colunas</button>`
        ).join('')}
      </div>
      <button class="back-btn">← Voltar</button>
    `;

    document.querySelectorAll('.size-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const size = parseInt(e.target.dataset.size);
        this.game.boardSize = size;
        
        if (forOnline) {
          await this.onlineManager.startOnlineGame(size);
        } else {
          this.showMessage(`Tabuleiro: ${size} colunas`);
          this.showWelcomeScreen();
        }
      });
    });

    document.querySelector('.back-btn').addEventListener('click', () => {
      this.showWelcomeScreen();
    });
  }

  showAILevelSelector() {
    this.gamePanel.innerHTML = `
      <h2>🤖 Nível da IA</h2>
      <p>Escolha a dificuldade:</p>
      <div class="level-buttons">
        <button class="level-btn" data-level="easy">Fácil</button>
        <button class="level-btn" data-level="medium">Médio</button>
        <button class="level-btn" data-level="hard">Difícil</button>
      </div>
      <button class="back-btn">← Voltar</button>
    `;

    document.querySelectorAll('.level-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.game.aiLevel = e.target.dataset.level;
        const names = { easy: 'Fácil', medium: 'Médio', hard: 'Difícil' };
        this.showMessage(`Nível: ${names[this.game.aiLevel]}`);
      });
    });

    document.querySelector('.back-btn').addEventListener('click', () => {
      this.showWelcomeScreen();
    });
  }

  showFirstPlayerSelector() {
    this.gamePanel.innerHTML = `
      <h2>🙋‍♂️ Primeiro Jogador</h2>
      <p>Quem começa?</p>
      <div class="player-buttons">
        <button class="player-btn" data-player="player1">Jogador 1</button>
        <button class="player-btn" data-player="player2">Jogador 2 / IA</button>
      </div>
      <button class="back-btn">← Voltar</button>
    `;

    document.querySelectorAll('.player-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.game.firstPlayer = e.target.dataset.player;
        const names = { player1: 'Jogador 1', player2: 'Jogador 2 / IA' };
        this.showMessage(`Primeiro: ${names[this.game.firstPlayer]}`);
      });
    });

    document.querySelector('.back-btn').addEventListener('click', () => {
      this.showWelcomeScreen();
    });
  }

  startGame() {
    this.game.initializeBoard();
    this.game.gameStarted = true;
    this.game.gameOver = false;
    this.game.currentPlayer = this.game.firstPlayer;
    this.game.diceValue = null;
    this.game.diceRolled = false;

    this.renderBoard();
    this.showMessage(`Jogo iniciado! Vez de ${this.game.currentPlayer === 'player1' ? 'Jogador 1' : 'Jogador 2'}`);

    if (this.game.currentPlayer === 'player2' && this.game.gameMode === 'ai') {
      setTimeout(() => this.aiTurn(), 1000);
    }
  }

  renderBoard() {
    // Código de renderização mantido da parte 1
    // ... (mesmo código do ficheiro original)
  }

  renderOnlineBoard(onlineManager) {
    const isMyTurn = this.game.currentPlayer === 'player1';
    
    let html = `
      <h2>🎲 Jogo Tâb Online</h2>
      <div class="game-info">
        <p><strong>Você:</strong> ${this.session.nick} (${onlineManager.localPlayerColor})</p>
        <p><strong>Adversário:</strong> ${onlineManager.opponentNick}</p>
        <p><strong>Turno:</strong> ${isMyTurn ? 'SEU TURNO' : 'Adversário'}</p>
        <p><strong>Peças:</strong> Azuis: ${this.game.player1Pieces.length} | Vermelhas: ${this.game.player2Pieces.length}</p>
      </div>
      
      <div class="dice-area">
        <button id="roll-dice" ${!isMyTurn || this.game.diceRolled ? 'disabled' : ''}>
          ${this.game.diceValue ? this.game.diceValue : '🎲 Lançar Dado'}
        </button>
        ${this.game.diceValue ? `<p class="dice-name">${this.getDiceName(this.game.diceValue)}</p>` : ''}
      </div>

      <div class="board">
        ${this.renderBoardGrid()}
      </div>

      <div class="game-controls">
        <button id="pass-turn" ${isMyTurn && this.canPassOnline() ? '' : 'disabled'}>⏭️ Passar Vez</button>
        <button id="forfeit">🏳️ Desistir</button>
      </div>
    `;

    this.gamePanel.innerHTML = html;
    this.attachOnlineBoardListeners(onlineManager);
  }

  attachOnlineBoardListeners(onlineManager) {
    const rollBtn = document.getElementById('roll-dice');
    if (rollBtn) {
      rollBtn.addEventListener('click', () => onlineManager.rollDice());
    }

    document.querySelectorAll('.cell').forEach(cell => {
      cell.addEventListener('click', (e) => {
        const row = parseInt(e.target.dataset.row);
        const col = parseInt(e.target.dataset.col);
        onlineManager.notifyMove(row, col);
      });
    });

    const passBtn = document.getElementById('pass-turn');
    if (passBtn) {
      passBtn.addEventListener('click', () => onlineManager.passTurn());
    }

    const forfeitBtn = document.getElementById('forfeit');
    if (forfeitBtn) {
      forfeitBtn.addEventListener('click', () => onlineManager.forfeit());
    }
  }

  canPassOnline() {
    if (!this.game.diceRolled || this.game.gameOver) return false;
    const validMoves = this.game.getValidMoves(this.game.currentPlayer);
    const repeats = [1, 4, 6].includes(this.game.diceValue);
    return validMoves.length === 0 && !repeats;
  }

  async showRankings() {
    if (!this.session.isAuthenticated) {
      this.showMessage('❌ Faça login para ver rankings online');
      this.showLocalRankings();
      return;
    }

    try {
      const result = await this.api.ranking(this.game.boardSize);
      this.displayRankings(result.ranking, true);
    } catch (error) {
      this.showMessage('❌ Erro ao obter rankings');
      this.showLocalRankings();
    }
  }

  showLocalRankings() {
    const rankings = this.game.rankings;
    this.displayRankings(rankings, false);
  }

  displayRankings(rankings, isOnline) {
    let html = `
      <h2>🏆 Classificações ${isOnline ? '(Online)' : '(Local)'}</h2>
      ${rankings.length === 0 ? '<p>Ainda não há jogos registados.</p>' : ''}
      <div class="rankings-list">
        <table>
          <thead>
            <tr>
              <th>Nick</th>
              <th>Jogos</th>
              <th>Vitórias</th>
            </tr>
          </thead>
          <tbody>
            ${rankings.map(r => `
              <tr>
                <td>${r.nick || r.winner}</td>
                <td>${r.games || '-'}</td>
                <td>${r.victories || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <button class="back-btn">← Voltar</button>
    `;

    this.gamePanel.innerHTML = html;
    document.querySelector('.back-btn').addEventListener('click', () => {
      if (this.game.gameStarted) {
        if (this.onlineManager.isOnlineMode) {
          this.renderOnlineBoard(this.onlineManager);
        } else {
          this.renderBoard();
        }
      } else {
        this.showWelcomeScreen();
      }
    });
  }

  // Métodos mantidos da parte 1...
  renderBoardGrid() {
    let html = '<table class="game-board">';
    for (let row = 3; row >= 0; row--) {
      html += '<tr>';
      for (let col = 0; col < this.game.boardSize; col++) {
        const cell = this.game.board[row][col];
        let cellClass = 'cell';
        let cellContent = '';

        if (cell) {
          cellClass += cell.player === 'player1' ? ' player1-piece' : ' player2-piece';
          cellContent = cell.player === 'player1' ? '🔵' : '🔴';
          
          if (this.game.selectedPiece === cell) {
            cellClass += ' selected';
          }
        }

        html += `<td class="${cellClass}" data-row="${row}" data-col="${col}">${cellContent}</td>`;
      }
      html += '</tr>';
    }
    html += '</table>';
    return html;
  }

  forfeitGame() {
    if (this.onlineManager.isOnlineMode) {
      this.onlineManager.forfeit();
    } else if (this.game.gameStarted && !this.game.gameOver) {
      const winner = this.game.currentPlayer === 'player1' ? 'player2' : 'player1';
      this.endGame(winner, true);
    } else {
      this.showMessage('Nenhum jogo em andamento');
    }
  }

  endGame(winner, forfeit = false) {
    this.game.gameOver = true;
    const winnerName = winner === 'player1' ? 'Jogador 1' : 'Jogador 2';
    const message = forfeit 
      ? `🏳️ Desistência! ${winnerName} venceu!`
      : `🏆 ${winnerName} venceu!`;

    this.game.saveRanking(winner, this.game.gameMode);
    this.showMessage(message);
    this.renderBoard();
  }

  showWelcomeScreen() {
    this.gamePanel.innerHTML = `
      <h2>🧩 Game Panel</h2>
      <p>Bem-vindo ao Jogo Tâb!</p>
      ${!this.session.isAuthenticated ? '<p style="color: #ffd700;">⚠️ Faça login para jogar online!</p>' : ''}
      <div class="welcome-buttons">
        <button class="start-btn">▶️ Iniciar Jogo</button>
        <button class="rankings-btn">🏆 Ver Classificações</button>
      </div>
    `;

    document.querySelector('.start-btn')?.addEventListener('click', () => {
      this.showModeSelector();
    });

    document.querySelector('.rankings-btn')?.addEventListener('click', () => {
      this.showRankings();
    });
  }

  showMessage(msg) {
    console.log(`[TAB GAME] ${msg}`);
    
    // Criar elemento de mensagem
    const msgEl = document.createElement('div');
    msgEl.className = 'game-message';
    msgEl.textContent = msg;
    document.body.appendChild(msgEl);
    
    setTimeout(() => msgEl.remove(), 3000);
  }

  getDiceName(value) {
    const names = {
      1: 'Tâb',
      2: 'Itneyn',
      3: 'Teláteh',
      4: "Arba'ah",
      6: 'Sitteh'
    };
    return names[value] || '';
  }

  // Métodos da IA mantidos...
  aiTurn() {
    if (!this.game.diceRolled) {
      this.game.diceValue = this.game.rollDice();
      this.game.diceRolled = true;
      
      const repeats = [1, 4, 6].includes(this.game.diceValue);
      this.showMessage(`IA lançou: ${this.game.diceValue}`);
      this.renderBoard();

      setTimeout(() => this.aiTurn(), 1500);
      return;
    }

    const piece = this.game.makeAIMove();

    if (!piece) {
      const repeats = [1, 4, 6].includes(this.game.diceValue);
      if (repeats) {
        this.game.diceRolled = false;
        this.game.diceValue = null;
        setTimeout(() => this.aiTurn(), 500);
      } else {
        this.showMessage('IA passa a vez');
        this.switchTurn();
        this.renderBoard();
      }
      return;
    }

    this.game.movePiece(piece, this.game.diceValue);
    
    const winner = this.game.checkWinner();
    if (winner) {
      this.endGame(winner);
      return;
    }

    const repeats = [1, 4, 6].includes(this.game.diceValue);
    
    if (repeats) {
      this.game.diceRolled = false;
      this.game.diceValue = null;
      this.showMessage('IA joga novamente!');
      this.renderBoard();
      setTimeout(() => this.aiTurn(), 1500);
    } else {
      this.switchTurn();
      this.renderBoard();
    }
  }

  switchTurn() {
    this.game.currentPlayer = this.game.currentPlayer === 'player1' ? 'player2' : 'player1';
    this.game.diceValue = null;
    this.game.diceRolled = false;
    this.game.selectedPiece = null;

    this.showMessage(`Vez de ${this.game.currentPlayer === 'player1' ? 'Jogador 1' : 'Jogador 2'}`);

    if (this.game.currentPlayer === 'player2' && this.game.gameMode === 'ai') {
      setTimeout(() => this.aiTurn(), 1000);
    }
  }

  // Restantes métodos mantidos da parte 1...
}

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  const game = new TabGame();
  const api = new ServerAPI();
  const session = new SessionManager();
  const ui = new GameUI(game, api, session);
  
  ui.showWelcomeScreen();
  
  console.log('🎮 Jogo Tâb carregado com sucesso!');
  console.log('📡 Sistema online ativado');
});
