// js/storage.js

/**
 * Gestão de classificações (Leaderboard) usando localStorage.
 */
export class StorageManager {
    constructor() {
        this.key = 'gameTabLeaderboard';
        this.defaultData = [
            { name: 'n1', score: 'w/l' },
            { name: 'n2', score: 'w/l' },
            { name: 'n3', score: 'w/l' },
            { name: 'n4', score: 'w/l' },
            { name: 'n5', score: 'w/l' }
        ];
    }

    /** Obtém a leaderboard */
    getLeaderboard() {
        const data = localStorage.getItem(this.key);
        return data ? JSON.parse(data) : this.defaultData;
    }

    /** Atualiza a leaderboard */
    setLeaderboard(entries) {
        localStorage.setItem(this.key, JSON.stringify(entries));
    }

    /** Adiciona um novo resultado */
    addEntry(name, score) {
        const entries = this.getLeaderboard();
        entries.push({ name, score });
        this.setLeaderboard(entries);
    }
}
