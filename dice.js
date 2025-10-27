// js/dice.js

/**
 * Responsável pela lógica dos dados.
 */
export class Dice {
    constructor(sides = 6) {
        this.sides = sides;
    }

    /** Lança o dado e retorna o valor */
    roll() {
        const result = Math.floor(Math.random() * this.sides) + 1;
        console.log(`🎲 Resultado do dado: ${result}`);
        return result;
    }
}
