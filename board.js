// js/board.js

/**
 * Representa o tabuleiro e a lógica básica do jogo.
 */
export class Board {
    constructor() {
        this.size = 8; // Exemplo: 8x8
        this.state = this.createEmptyBoard();
    }

    /** Cria um tabuleiro vazio */
    createEmptyBoard() {
        return Array.from({ length: this.size }, () =>
            Array.from({ length: this.size }, () => null)
        );
    }

    /** Reinicia o tabuleiro */
    reset() {
        this.state = this.createEmptyBoard();
        console.log("♻️ Tabuleiro reiniciado.");
    }

    /** Coloca uma peça no tabuleiro */
    placePiece(x, y, player) {
        if (this.state[y][x] === null) {
            this.state[y][x] = player;
            return true;
        }
        return false;
    }
}
