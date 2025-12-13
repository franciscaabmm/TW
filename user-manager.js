// ============================================
// USER-MANAGER.JS - GESTÃO DE UTILIZADORES
// ============================================

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

class UserManager {
  constructor() {
    this.users = new Map(); // nick -> { passwordHash }
    this.dataFile = path.join(__dirname, 'data', 'users.json');
    this.ensureDataDir();
  }

  ensureDataDir() {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  // Hash da password
  hashPassword(password) {
    return crypto
      .createHash('sha256')
      .update(password)
      .digest('hex');
  }

  // Registar utilizador
  register(nick, password) {
    const passwordHash = this.hashPassword(password);

    if (this.users.has(nick)) {
      const existing = this.users.get(nick);
      if (existing.passwordHash !== passwordHash) {
        throw new Error('User registered with a different password');
      }
      // Mesma password - OK (pode ser re-login)
      return true;
    }

    this.users.set(nick, { passwordHash });
    return true;
  }

  // Autenticar utilizador
  authenticate(nick, password) {
    if (!this.users.has(nick)) {
      return false;
    }

    const user = this.users.get(nick);
    const passwordHash = this.hashPassword(password);
    
    return user.passwordHash === passwordHash;
  }

  // Verificar se utilizador existe
  exists(nick) {
    return this.users.has(nick);
  }

  // Guardar utilizadores em ficheiro
  save() {
    try {
      const data = {};
      this.users.forEach((user, nick) => {
        data[nick] = user;
      });

      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
      console.log('✅ Utilizadores guardados');
    } catch (error) {
      console.error('❌ Erro ao guardar utilizadores:', error);
    }
  }

  // Carregar utilizadores do ficheiro
  load() {
    try {
      if (!fs.existsSync(this.dataFile)) {
        console.log('ℹ️ Ficheiro de utilizadores não existe ainda');
        return;
      }

      const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
      
      Object.keys(data).forEach(nick => {
        this.users.set(nick, data[nick]);
      });

      console.log(`✅ ${this.users.size} utilizadores carregados`);
    } catch (error) {
      console.error('❌ Erro ao carregar utilizadores:', error);
    }
  }
}

module.exports = { UserManager };