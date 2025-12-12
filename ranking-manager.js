// ============================================
// RANKING-MANAGER.JS - GESTÃO DE CLASSIFICAÇÕES
// ============================================

const fs = require('fs');
const path = require('path');

class RankingManager {
  constructor() {
    this.rankings = new Map(); // "group-size" -> Map(nick -> {games, victories})
    this.dataFile = path.join(__dirname, 'data', 'rankings.json');
    this.ensureDataDir();
  }

  ensureDataDir() {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  getKey(group, size) {
    return `${group}-${size}`;
  }

  addResult(group, size, winner, loser) {
    const key = this.getKey(group, size);
    
    if (!this.rankings.has(key)) {
      this.rankings.set(key, new Map());
    }

    const ranking = this.rankings.get(key);

    // Atualizar vencedor
    if (!ranking.has(winner)) {
      ranking.set(winner, { nick: winner, games: 0, victories: 0 });
    }
    const winnerStats = ranking.get(winner);
    winnerStats.games++;
    winnerStats.victories++;

    // Atualizar perdedor
    if (!ranking.has(loser)) {
      ranking.set(loser, { nick: loser, games: 0, victories: 0 });
    }
    const loserStats = ranking.get(loser);
    loserStats.games++;

    console.log(`📊 Ranking atualizado: ${winner} venceu ${loser} (${group}/${size})`);
  }

  getRanking(group, size) {
    const key = this.getKey(group, size);
    
    if (!this.rankings.has(key)) {
      return [];
    }

    const ranking = this.rankings.get(key);
    const list = Array.from(ranking.values());

    // Ordenar por vitórias (decrescente) e depois por jogos (crescente)
    list.sort((a, b) => {
      if (b.victories !== a.victories) {
        return b.victories - a.victories;
      }
      return a.games - b.games;
    });

    // Retornar top 10
    return list.slice(0, 10);
  }

  save() {
    try {
      const data = {};
      
      this.rankings.forEach((ranking, key) => {
        data[key] = {};
        ranking.forEach((stats, nick) => {
          data[key][nick] = stats;
        });
      });

      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
      console.log('✅ Rankings guardados');
    } catch (error) {
      console.error('❌ Erro ao guardar rankings:', error);
    }
  }

  load() {
    try {
      if (!fs.existsSync(this.dataFile)) {
        console.log('ℹ️ Ficheiro de rankings não existe ainda');
        return;
      }

      const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
      
      Object.keys(data).forEach(key => {
        const rankingMap = new Map();
        Object.keys(data[key]).forEach(nick => {
          rankingMap.set(nick, data[key][nick]);
        });
        this.rankings.set(key, rankingMap);
      });

      console.log(`✅ Rankings carregados para ${this.rankings.size} grupos/tamanhos`);
    } catch (error) {
      console.error('❌ Erro ao carregar rankings:', error);
    }
  }

  // Métodos auxiliares para estatísticas
  getPlayerStats(group, size, nick) {
    const key = this.getKey(group, size);
    
    if (!this.rankings.has(key)) {
      return null;
    }

    const ranking = this.rankings.get(key);
    return ranking.get(nick) || null;
  }

  getTopPlayers(group, size, limit = 10) {
    return this.getRanking(group, size).slice(0, limit);
  }

  getAllRankings() {
    const result = {};
    
    this.rankings.forEach((ranking, key) => {
      result[key] = this.getRanking(...key.split('-'));
    });

    return result;
  }
}

module.exports = { RankingManager };
