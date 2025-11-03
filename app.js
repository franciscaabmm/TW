// GAME TAB - JavaScript 

// CLASSES AND DATA STRUCTURES

/**
 * Represents a game piece on the board
 */
class Piece {
  constructor(id, player, row, col) {
    this.id = id;           // Unique identifier for the piece
    this.player = player;   // 'player1' or 'player2'
    this.row = row;         // Current row position
    this.col = col;         // Current column position
    this.moved = false;     // Whether the piece has moved at least once
    this.reachedTop = false; // Whether the piece has reached the opponent's side
  }
}

/**
 * Main game controller managing game state and logic
 */
class TabGame {
  constructor() {
    this.boardSize = 9;     // Number of columns on the board
    this.gameMode = 'ai';   // 'ai' or 'pvp' (player vs player)
    this.firstPlayer = 'player1'; // Who starts the game
    this.aiLevel = 'medium'; // AI difficulty: 'easy', 'medium', 'hard'
    this.currentPlayer = null; // Current active player
    this.diceValue = null;  // Current dice roll value
    this.diceRolled = false; // Whether dice has been rolled this turn
    this.selectedPiece = null; // Currently selected piece
    this.gameStarted = false; // Whether game is in progress
    this.gameOver = false;  // Whether game has ended
    this.board = [];        // 2D array representing game board
    this.player1Pieces = []; // Array of player 1 pieces
    this.player2Pieces = []; // Array of player 2 pieces
    this.rankings = this.loadRankings(); // Load saved rankings from storage
  }

  /**
   * Initialize the game board with starting positions
   */
  initializeBoard() {
    // Create empty 4xN board
    this.board = Array(4).fill().map(() => Array(this.boardSize).fill(null));
    this.player1Pieces = [];
    this.player2Pieces = [];

    // Player 1 (blue) - bottom row (row 0)
    for (let i = 0; i < this.boardSize; i++) {
      const piece = new Piece(`p1-${i}`, 'player1', 0, i);
      this.player1Pieces.push(piece);
      this.board[0][i] = piece;
    }

    // Player 2 (red) - top row (row 3)
    for (let i = 0; i < this.boardSize; i++) {
      const piece = new Piece(`p2-${i}`, 'player2', 3, this.boardSize - 1 - i);
      this.player2Pieces.push(piece);
      this.board[3][this.boardSize - 1 - i] = piece;
    }
  }

  /**
   * Roll the dice with weighted probabilities
   * @returns {number} Dice value (1, 2, 3, 4, or 6)
   */
  rollDice() {
    const rand = Math.random();
    if (rand < 0.06) return 6;    // 6% chance for 6
    else if (rand < 0.31) return 1; // 25% chance for 1
    else if (rand < 0.69) return 2; // 38% chance for 2
    else if (rand < 0.94) return 3; // 25% chance for 3
    else return 4;                 // 6% chance for 4
  }

  /**
   * Calculate new position after moving a piece
   * @param {number} row - Starting row
   * @param {number} col - Starting column
   * @param {number} steps - Number of spaces to move
   * @param {string} player - Player making the move
   * @returns {Object|null} New position {row, col} or null if invalid
   */
  calculateNewPosition(row, col, steps, player) {
    let currentRow = row;
    let currentCol = col;
    let stepsLeft = steps;

    while (stepsLeft > 0) {
      if (player === 'player1') {
        if (currentRow === 0 || currentRow === 2) {
          // Move right on rows 0 and 2
          currentCol++;
          if (currentCol >= this.boardSize) {
            currentRow++;
            currentCol = this.boardSize - 1;
          }
        } else {
          // Move left on rows 1 and 3
          currentCol--;
          if (currentCol < 0) {
            if (currentRow === 1) {
              currentRow = 2;
              currentCol = 0;
            } else if (currentRow === 3) {
              currentRow = 0;
              currentCol = 0;
            }
          }
        }
      } else {
        if (currentRow === 3 || currentRow === 1) {
          // Move left on rows 3 and 1
          currentCol--;
          if (currentCol < 0) {
            currentRow--;
            currentCol = 0;
          }
        } else {
          // Move right on rows 2 and 0
          currentCol++;
          if (currentCol >= this.boardSize) {
            if (currentRow === 2) {
              currentRow = 1;
              currentCol = this.boardSize - 1;
            } else if (currentRow === 0) {
              currentRow = 3;
              currentCol = this.boardSize - 1;
            }
          }
        }
      }
      
      stepsLeft--;
      if (currentRow < 0 || currentRow >= 4 || currentCol < 0 || currentCol >= this.boardSize) {
        return null;
      }
    }
    return { row: currentRow, col: currentCol };
  }

  /**
   * Check if a move is valid
   * @param {Piece} piece - Piece to move
   * @param {number} steps - Number of spaces to move
   * @returns {boolean} True if move is valid
   */
  isValidMove(piece, steps) {
    if (!piece || !steps) return false;
    // First move must be exactly 1 space
    if (!piece.moved && steps !== 1) return false;

    const newPos = this.calculateNewPosition(piece.row, piece.col, steps, piece.player);
    if (!newPos) return false;

    const targetCell = this.board[newPos.row][newPos.col];
    // Cannot capture own pieces
    if (targetCell && targetCell.player === piece.player) return false;

    return true;
  }

  /**
   * Get all valid moves for current player
   * @param {string} player - Player to check moves for
   * @returns {Array} Array of valid pieces that can move
   */
  getValidMoves(player) {
    const pieces = player === 'player1' ? this.player1Pieces : this.player2Pieces;
    return pieces.filter(p => this.isValidMove(p, this.diceValue));
  }

  /**
   * Move a piece on the board
   * @param {Piece} piece - Piece to move
   * @param {number} steps - Number of spaces to move
   * @returns {Object} Move result {success, captured}
   */
  movePiece(piece, steps) {
    const newPos = this.calculateNewPosition(piece.row, piece.col, steps, piece.player);
    if (!newPos) return { success: false };

    // Clear original position
    this.board[piece.row][piece.col] = null;

    const targetCell = this.board[newPos.row][newPos.col];
    let capturedPiece = null;
    
    // Capture opponent's piece if present
    if (targetCell && targetCell.player !== piece.player) {
      capturedPiece = targetCell;
      if (piece.player === 'player1') {
        this.player2Pieces = this.player2Pieces.filter(p => p.id !== targetCell.id);
      } else {
        this.player1Pieces = this.player1Pieces.filter(p => p.id !== targetCell.id);
      }
    }

    // Update piece position
    piece.row = newPos.row;
    piece.col = newPos.col;
    piece.moved = true;

    // Check if piece reached opponent's side
    const topRow = piece.player === 'player1' ? 3 : 0;
    if (newPos.row === topRow) {
      piece.reachedTop = true;
    }

    // Place piece in new position
    this.board[newPos.row][newPos.col] = piece;
    
    return { success: true, captured: capturedPiece };
  }

  /**
   * AI decision making for moves
   * @returns {Piece|null} Chosen piece to move or null if no valid moves
   */
  makeAIMove() {
    const validPieces = this.getValidMoves('player2');
    if (validPieces.length === 0) return null;

    let chosenPiece;
    const aiPlayer = 'player2';
    const opponentPlayer = 'player1';

    /**
     * Find pieces that can capture opponent pieces
     * @param {Array} pieces - Array of pieces to check
     * @returns {Array} Pieces that can capture
     */
    const findCaptureMoves = (pieces) => {
      return pieces.filter(p => {
        const newPos = this.calculateNewPosition(p.row, p.col, this.diceValue, aiPlayer);
        if (!newPos) return false;
        const targetCell = this.board[newPos.row][newPos.col];
        // It's a capture if target cell has opponent's piece
        return targetCell && targetCell.player === opponentPlayer;
      });
    };

    /**
     * Pick random element from array
     * @param {Array} arr - Array to pick from
     * @returns {*} Random element
     */
    const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

    switch (this.aiLevel) {
      
      // Level 1 — Random (easy)
      case 'easy':
        chosenPiece = pickRandom(validPieces);
        break;

      // Level 2 — Prioritize Capture (medium)
      case 'medium':
        const captureMoves = findCaptureMoves(validPieces);
        if (captureMoves.length > 0) {
          // If there are possible captures, choose one randomly
          chosenPiece = pickRandom(captureMoves);
        } else {
          // If there aren't possible captures, choose randomly
          chosenPiece = pickRandom(validPieces);
        }
        break;

      // Level 3 — Minimax (hard)
      case 'hard':
        // **TODO: Implement Minimax here**
        console.warn("AI Level 'hard' (Minimax) not implemented. Using Level 'medium' as fallback.");
        const captureMovesHard = findCaptureMoves(validPieces);
        if (captureMovesHard.length > 0) {
          chosenPiece = pickRandom(captureMovesHard);
        } else {
          chosenPiece = pickRandom(validPieces);
        }
        break;

      // Default: if the level is not recognized, use "easy" mode
      default:
        chosenPiece = pickRandom(validPieces);
        break;
    }

    return chosenPiece;
  }

  /**
   * Check if there's a winner
   * @returns {string|null} Winning player or null if no winner
   */
  checkWinner() {
    // Win by capturing all opponent pieces
    if (this.player1Pieces.length === 0) return 'player2';
    if (this.player2Pieces.length === 0) return 'player1';
    
    // Win by getting all pieces to opponent's side
    const player1AllTop = this.player1Pieces.length > 0 && this.player1Pieces.every(piece => piece.reachedTop);
    const player2AllTop = this.player2Pieces.length > 0 && this.player2Pieces.every(piece => piece.reachedTop);
    
    if (player1AllTop) return 'player1';
    if (player2AllTop) return 'player2';
    
    return null;
  }

  /**
   * Save game result to rankings
   * @param {string} winner - Winning player
   * @param {string} mode - Game mode
   */
  saveRanking(winner, mode) {
    const ranking = {
      date: new Date().toLocaleString('en-US'),
      winner: winner,
      mode: mode,
      boardSize: this.boardSize,
      aiLevel: this.aiLevel
    };
    this.rankings.unshift(ranking);
    this.rankings = this.rankings.slice(0, 10); // Keep only top 10
    localStorage.setItem('tabRankings', JSON.stringify(this.rankings));
  }

  /**
   * Load rankings from local storage
   * @returns {Array} Array of ranking objects
   */
  loadRankings() {
    const stored = localStorage.getItem('tabRankings');
    return stored ? JSON.parse(stored) : [];
  }
}

// USER INTERFACE

/**
 * Handles all UI interactions and rendering
 */
class GameUI {
  constructor(game) {
    this.game = game; // Reference to game logic
    this.gamePanel = document.querySelector('.game-panel');
    this.currentMessage = 'Welcome to Tâb! Set up the game and click "Start".'; 
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for UI elements
   */
  setupEventListeners() {
    const settingsItems = document.querySelectorAll('.comando-box ul li');
    settingsItems.forEach(item => {
      item.style.cursor = 'pointer';
      item.addEventListener('click', () => this.handleSettingClick(item));
    });

    const loginBtn = document.querySelector('.login-form button');
    if (loginBtn) {
      loginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.showMessage('Login functionality would be implemented here!');
      });
    }
  }

  /**
   * Handle clicks on settings menu items
   * @param {HTMLElement} item - Clicked menu item
   */
  handleSettingClick(item) {
    const text = item.textContent.toLowerCase();
    if (text.includes('tamanho') || text.includes('size') || text.includes('📏')) {
      this.showBoardSizeSelector();
    } else if (text.includes('inteligência') || text.includes('ai') || text.includes('level') || text.includes('🤖')) {
      this.showAILevelSelector();
    } else if (text.includes('primeiro jogador') || text.includes('first') || text.includes('🙋')) {
      this.showFirstPlayerSelector();
    } else if (text.includes('player vs computer') || text.includes('computer') || text.includes('⏭️')) {
      this.game.gameMode = 'ai';
      this.showMessage('Mode: Player vs Computer');
    } else if (text.includes('player vs player') || text.includes('pvp') || text.includes('▶️')) {
      this.game.gameMode = 'pvp';
      this.showMessage('Mode: Player vs Player');
    } else if (text.includes('desistir') || text.includes('quit') || text.includes('🏳️')) {
      this.forfeitGame();
    } else if (text.includes('classificações') || text.includes('ratings') || text.includes('📊')) {
      this.showRankings();
    } else if (text.includes('choose') || text.includes('mode') || text.includes('📖')) {
      this.showModeSelector();
    }
  }

  /**
   * Show board size selection interface
   */
  showBoardSizeSelector() {
    this.gamePanel.innerHTML = `
      <h2>📏 Board Size</h2>
      <p>Choose the number of columns:</p>
      <div class="size-buttons">
        ${[7, 9, 11].map(size => 
          `<button class="size-btn" data-size="${size}">${size} columns</button>`
        ).join('')}
      </div>
      <div class="game-controls">
        <button class="back-btn">← Back</button>
      </div>
    `;

    document.querySelectorAll('.size-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.game.boardSize = parseInt(e.target.dataset.size);
        this.showMessage(`Board configured: ${this.game.boardSize} columns`);
        this.showWelcomeScreen();
      });
    });

    document.querySelector('.back-btn').addEventListener('click', () => {
      this.showWelcomeScreen();
    });
  }

  /**
   * Show AI difficulty selection interface
   */
  showAILevelSelector() {
    this.gamePanel.innerHTML = `
      <h2>🤖 AI Level</h2>
      <p>Choose the difficulty:</p>
      <div class="level-buttons">
        <button class="level-btn" data-level="easy">Easy</button>
        <button class="level-btn" data-level="medium">Medium</button>
        <button class="level-btn" data-level="hard">Hard</button>
      </div>
      <div class="game-controls">
        <button class="back-btn">← Back</button>
      </div>
    `;

    document.querySelectorAll('.level-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.game.aiLevel = e.target.dataset.level;
        const levelNames = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
        this.showMessage(`AI: ${levelNames[this.game.aiLevel]}`);
        this.showWelcomeScreen();
      });
    });

    document.querySelector('.back-btn').addEventListener('click', () => {
      this.showWelcomeScreen();
    });
  }

  /**
   * Show first player selection interface
   */
  showFirstPlayerSelector() {
    this.gamePanel.innerHTML = `
      <h2>🙋 First Player</h2>
      <p>Who Starts?</p>
      <div class="player-buttons">
        <button class="player-btn" data-player="player1">Player 1</button>
        <button class="player-btn" data-player="player2">Player 2 / AI</button>
      </div>
      <div class="game-controls">
        <button class="back-btn">← Back</button>
      </div>
    `;

    document.querySelectorAll('.player-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.game.firstPlayer = e.target.dataset.player;
        const playerNames = { player1: 'Player 1', player2: 'Player 2 / AI' };
        this.showMessage(`First to Play: ${playerNames[this.game.firstPlayer]}`);
        this.showWelcomeScreen();
      });
    });

    document.querySelector('.back-btn').addEventListener('click', () => {
      this.showWelcomeScreen();
    });
  }

  /**
   * Show game mode selection interface
   */
  showModeSelector() {
    this.gamePanel.innerHTML = `
      <h2>🎮 Game Mode</h2>
      <p>Choose a Mode:</p>
      <div class="mode-buttons">
        <button class="mode-btn" data-mode="ai">🤖 Player vs Computer</button>
        <button class="mode-btn" data-mode="pvp">👥 Player vs Player</button>
      </div>
      <div class="game-controls">
        <button class="start-btn">▶️ Start Game</button>
        <button class="back-btn">← Back</button>
      </div>
      <div class="game-info">
        <p><strong>Selected Mode:</strong> <span id="selected-mode">${this.game.gameMode === 'ai' ? 'Player vs Computer' : 'Player vs Player'}</span></p>
      </div>
    `;

    let selectedMode = this.game.gameMode;

    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        selectedMode = e.target.dataset.mode;
        this.game.gameMode = selectedMode;
        const modeNames = { ai: 'Player vs Computer', pvp: 'Player vs Player' };
        const modeDisplay = document.getElementById('selected-mode');
        if (modeDisplay) modeDisplay.textContent = modeNames[selectedMode];
        this.showMessage(`Mode: ${modeNames[selectedMode]}`);
      });
    });

    document.querySelector('.start-btn').addEventListener('click', () => {
      this.game.gameMode = selectedMode;
      this.startGame();
    });

    document.querySelector('.back-btn').addEventListener('click', () => {
      this.showWelcomeScreen();
    });
  }

  /**
   * Show welcome screen with game settings
   */
  showWelcomeScreen() {
    this.gamePanel.innerHTML = `
      <h2>🧩 Game Panel</h2>
      <p>Welcome to the Game Tâb!</p>
      <p>Set up the game and choose a mode to start.</p>
      <div class="welcome-buttons">
        <button class="start-btn">▶️ Start Game</button>
        <button class="rankings-btn">🏆 See Rankings</button>
      </div>
      <div class="game-info">
        <p><strong>Current Settings:</strong></p>
        <p>Mode: ${this.game.gameMode === 'ai' ? 'Player vs Computer' : 'Player vs Player'}</p>
        <p>AI Level: ${this.game.aiLevel}</p>
        <p>Board: ${this.game.boardSize} columns</p>
        <p>First Player: ${this.game.firstPlayer === 'player1' ? 'Player 1' : 'Player 2'}</p>
      </div>
    `;

    document.querySelector('.start-btn').addEventListener('click', () => {
      this.showModeSelector();
    });

    document.querySelector('.rankings-btn').addEventListener('click', () => {
      this.showRankings();
    });
  }

  /**
   * Display temporary message to user
   * @param {string} msg - Message to display
   */
  showMessage(msg) {
    console.log(`[TAB GAME] ${msg}`); 
    this.currentMessage = msg;

    let messageElement = document.querySelector('.game-message');
    if (!messageElement) {
      messageElement = document.createElement('div');
      messageElement.className = 'game-message';
      document.body.appendChild(messageElement);
    }
    
    messageElement.textContent = msg;
    
    // Auto-remove message after 3 seconds
    setTimeout(() => {
      if (messageElement && messageElement.parentNode) {
        messageElement.remove();
      }
    }, 3000);
  }

  /**
   * Start a new game with current settings
   */
  startGame() {
    console.log('Starting game...');
    this.game.initializeBoard();
    this.game.gameStarted = true;
    this.game.gameOver = false;
    this.game.currentPlayer = this.game.firstPlayer;
    this.game.diceValue = null;
    this.game.diceRolled = false;
    this.game.selectedPiece = null;

    this.renderBoard();
    
    // Check if starting player has any movable pieces
    const startingPlayerPieces = this.game.firstPlayer === 'player1' ? 
      this.game.player1Pieces : this.game.player2Pieces;
    
    if (startingPlayerPieces.length === 0) {
      this.showMessage('⚠️ Starting player has no pieces! Switching turns automatically.');
      setTimeout(() => this.switchTurn(), 1500);
    } else {
      const playerName = this.game.currentPlayer === 'player1' ? 'Player 1' : 'Player 2';
      this.showMessage(`🎮 It's ${playerName}'s turn! Roll the dice and move a piece.`);
    }

    // Start AI turn if applicable
    if (this.game.currentPlayer === 'player2' && this.game.gameMode === 'ai') {
      setTimeout(() => this.aiTurn(), 1000);
    }
  }

  /**
   * Render the game board and interface
   */
  renderBoard() {
    let html = `
      <div class="message-bar">
        <p id="game-message">${this.currentMessage}</p> 
      </div>
      <h2>🎲 Game Tâb</h2>
      <div class="game-info">
        <p><strong>Turn:</strong> ${this.game.currentPlayer === 'player1' ? 'Player 1 (Blue)' : 'Player 2 (Red)'}</p>
        <p><strong>Pieces - Player 1:</strong> ${this.game.player1Pieces.length} | <strong>Player 2:</strong> ${this.game.player2Pieces.length}</p>
      </div>
      
      <div class="dice-area">
        <button id="roll-dice" ${this.game.diceRolled ? 'disabled' : ''}>
          ${this.game.diceValue ? this.game.diceValue : '🎲'}
        </button>
        ${this.game.diceValue ? `<p class="dice-name">${this.getDiceName(this.game.diceValue)}</p>` : ''}
      </div>

      <div class="board">
        ${this.renderBoardGrid()}
      </div>

      <div class="game-controls">
        <button id="pass-turn" ${this.canPass() ? '' : 'disabled'}>⏭️ Pass Turn</button>
        <button id="forfeit">🏳️ Quit</button>
        <button id="new-game">🔄 New Game</button>
      </div>
    `;

    this.gamePanel.innerHTML = html;
    this.attachBoardListeners();
  }

  /**
   * Render the game board grid
   * @returns {string} HTML string of the board
   */
  renderBoardGrid() {
    let html = '<table class="game-board">';
    // Render from top row to bottom (row 3 to 0)
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

  /**
   * Attach event listeners to board elements
   */
  attachBoardListeners() {
    const rollBtn = document.getElementById('roll-dice');
    if (rollBtn) {
      rollBtn.addEventListener('click', () => this.rollDice());
    }

    document.querySelectorAll('.cell').forEach(cell => {
      cell.addEventListener('click', (e) => {
        const row = parseInt(e.target.dataset.row);
        const col = parseInt(e.target.dataset.col);
        if (!isNaN(row) && !isNaN(col)) {
          this.handleCellClick(row, col);
        }
      });
    });

    const passBtn = document.getElementById('pass-turn');
    if (passBtn) {
      passBtn.addEventListener('click', () => this.passTurn());
    }

    const forfeitBtn = document.getElementById('forfeit');
    if (forfeitBtn) {
      forfeitBtn.addEventListener('click', () => this.forfeitGame());
    }

    const newGameBtn = document.getElementById('new-game');
    if (newGameBtn) {
      newGameBtn.addEventListener('click', () => this.showModeSelector());
    }
  }

  /**
   * Handle dice roll action
   */
  rollDice() {
    if (this.game.diceRolled || this.game.gameOver) return;
    if (this.game.currentPlayer === 'player2' && this.game.gameMode === 'ai') return;

    this.game.diceValue = this.game.rollDice();
    this.game.diceRolled = true;
    const repeats = [1, 4, 6].includes(this.game.diceValue);

    this.showMessage(`🎲 Dice: ${this.game.diceValue} (${this.getDiceName(this.game.diceValue)})${repeats ? ' - Play Again!' : ''}`);
    this.renderBoard();

    const validMoves = this.game.getValidMoves(this.game.currentPlayer);
    if (validMoves.length === 0) {
      if (repeats) {
        this.showMessage(`❌ No possible moves... Roll the dice again!`);
        this.game.diceRolled = false;
        this.game.diceValue = null;
        setTimeout(() => this.renderBoard(), 1000);
      } else {
        this.showMessage('❌ No valid moves! Click "Pass Turn" to end your turn.');
      }
    } else {
      const playerName = this.game.currentPlayer === 'player1' ? 'Player 1' : 'Player 2';
      this.showMessage(`✅ ${playerName}, click on a piece to move it ${this.game.diceValue} spaces.`);
    }
  }

  /**
   * Handle cell click on the board
   * @param {number} row - Clicked row
   * @param {number} col - Clicked column
   */
  handleCellClick(row, col) {
    if (this.game.gameOver) {
      this.showMessage('🏁 The game is over! Start a new game.');
      return;
    }
    
    if (!this.game.diceRolled) {
      this.showMessage('🎲 You need to roll the dice first!');
      return;
    }
    
    if (this.game.currentPlayer === 'player2' && this.game.gameMode === 'ai') {
      this.showMessage("⏳ It's the opponent's turn! Please wait...");
      return;
    }

    const cell = this.game.board[row][col];
    if (!cell) {
      this.showMessage('💡 No piece here! Click on one of your pieces.');
      return;
    }
    
    if (cell.player !== this.game.currentPlayer) {
      this.showMessage("🚫 This piece belongs to the opponent!");
      return;
    }
    
    if (!this.game.isValidMove(cell, this.game.diceValue)) {
      this.showMessage('❌ Move not possible with this dice value!');
      return;
    }

    const result = this.game.movePiece(cell, this.game.diceValue);
    if (result.success) {
      let message = `✅ Piece moved ${this.game.diceValue} spaces.`;
      
      // Capture message
      if (result.captured) {
        message = `🎯 Captured an opponent's piece! ${message}`;
      }
      
      // Check if reached the top
      const topRow = cell.player === 'player1' ? 3 : 0;
      if (cell.row === topRow) {
        message += ` 🏁 Piece reached the top!`;
      }

      this.showMessage(message);

      const repeats = [1, 4, 6].includes(this.game.diceValue);
      const winner = this.game.checkWinner();
      
      if (winner) {
        this.endGame(winner);
        return;
      }

      if (repeats) {
        this.game.diceRolled = false;
        this.game.diceValue = null;
        this.showMessage('🔄 Play again!');
      } else {
        this.switchTurn();
      }
      this.renderBoard();
    } else {
      this.showMessage('❌ Failed to move the piece!');
    }
  }

  /**
   * Handle AI turn logic
   */
  aiTurn() {
    // Roll dice if not already rolled
    if (!this.game.diceRolled) {
      this.game.diceValue = this.game.rollDice();
      this.game.diceRolled = true;
      const repeats = [1, 4, 6].includes(this.game.diceValue);
      this.showMessage(`🤖 AI rolled: ${this.game.diceValue} (${this.getDiceName(this.game.diceValue)})`);
      this.renderBoard();
      
      // Check for valid moves after AI rolls
      const validMoves = this.game.getValidMoves('player2');
      if (validMoves.length === 0 && !repeats) {
        this.showMessage('🤖 AI has no valid moves and must pass the turn.');
        setTimeout(() => {
          this.switchTurn();
        }, 1000);
        return;
      }
      
      setTimeout(() => this.aiTurn(), 1500);
      return;
    }

    // Make move decision
    const piece = this.game.makeAIMove();
    if (!piece) {
      const repeats = [1, 4, 6].includes(this.game.diceValue);
      if (repeats) {
        this.game.diceRolled = false;
        this.game.diceValue = null;
        this.showMessage('🤖 AI has no moves... Rolling again');
        setTimeout(() => this.aiTurn(), 500);
      } else {
        this.showMessage('🤖 AI has no valid moves and passes the turn.');
        this.switchTurn();
      }
      return;
    }

    // Execute AI move
    const result = this.game.movePiece(piece, this.game.diceValue);
    let aiMessage = `🤖 AI moved a piece ${this.game.diceValue} spaces.`;
    
    if (result.captured) {
      aiMessage = `🎯 ${aiMessage} Captured one of your pieces!`;
    }

    this.showMessage(aiMessage);

    // Check for winner
    const winner = this.game.checkWinner();
    if (winner) {
      this.endGame(winner);
      return;
    }

    // Handle repeat turns
    const repeats = [1, 4, 6].includes(this.game.diceValue);
    if (repeats) {
      this.game.diceRolled = false;
      this.game.diceValue = null;
      this.showMessage('🔄 AI plays again!');
      this.renderBoard();
      setTimeout(() => this.aiTurn(), 1500);
    } else {
      this.switchTurn();
      this.renderBoard();
    }
  }

  /**
   * Switch to next player's turn
   */
  switchTurn() {
    this.game.currentPlayer = this.game.currentPlayer === 'player1' ? 'player2' : 'player1';
    this.game.diceValue = null;
    this.game.diceRolled = false;
    this.game.selectedPiece = null;
    
    const playerName = this.game.currentPlayer === 'player1' ? 'Player 1' : 'Player 2';
    
    // Check if the new player has any possible moves before their turn starts
    if (this.game.currentPlayer === 'player2' && this.game.gameMode === 'ai') {
      // For AI, this will be handled in aiTurn()
      this.showMessage(`🎮 It's AI's turn! Rolling the dice...`);
      setTimeout(() => this.aiTurn(), 1000);
    } else {
      // For human players, check if they have any pieces that can move
      const hasPieces = this.game.currentPlayer === 'player1' ? 
        this.game.player1Pieces.length > 0 : 
        this.game.player2Pieces.length > 0;
      
      if (!hasPieces) {
        this.showMessage(`⚠️ ${playerName} has no pieces left! Passing turn automatically.`);
        setTimeout(() => this.switchTurn(), 1500);
      } else {
        this.showMessage(`🎮 It's ${playerName}'s turn! Roll the dice and move a piece.`);
      }
    }
  }

  /**
   * Check if current player can pass their turn
   * @returns {boolean} True if passing is allowed
   */
  canPass() {
    if (!this.game.diceRolled || this.game.gameOver) return false;
    if (this.game.currentPlayer === 'player2' && this.game.gameMode === 'ai') return false;
    
    const validMoves = this.game.getValidMoves(this.game.currentPlayer);
    const repeats = [1, 4, 6].includes(this.game.diceValue);
    
    // Can pass if no valid moves and not a repeat turn
    return validMoves.length === 0 && !repeats;
  }

  /**
   * Handle pass turn action
   */
  passTurn() {
    if (!this.canPass()) {
      const validMoves = this.game.getValidMoves(this.game.currentPlayer);
      const repeats = [1, 4, 6].includes(this.game.diceValue);
      
      if (validMoves.length > 0) {
        this.showMessage('❌ You have valid moves available! Please move a piece instead of passing.');
      } else if (repeats) {
        this.showMessage('❌ You rolled a repeat value! You must play again, not pass.');
      } else {
        this.showMessage('❌ Cannot pass the turn at this moment.');
      }
      return;
    }
    
    const playerName = this.game.currentPlayer === 'player1' ? 'Player 1' : '
