// js/ai.js

/**
 * Implementação básica de IA.
 * Por agora, escolhe jogadas aleatórias.
 */
export class AI {
    constructor(level = 'random') {
        this.level = level;
    }

    /** Decide a jogada com base no nível da IA */
    decideMove(board) {
        console.log(`🤖 IA (${this.level}) está a pensar...`);

        if (this.level === 'random') {
            return this.randomMove(board);
        }
        // Futuramente: outros modos (captura, minimax)
        return null;
    }

    randomMove(board) {
        const moves = [];
        for (let y = 0; y < board.size; y++) {
            for (let x = 0; x < board.size; x++) {
                if (board.state[y][x] === null) moves.push({ x, y });
            }
        }
        return moves.length ? moves[Math.floor(Math.random() * moves.length)] : null;
    }
}
