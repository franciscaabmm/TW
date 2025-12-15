// ============================================
// TEST-FIXES.JS - Testar correções dos bugs
// ============================================

const http = require('http');

const SERVER_URL = 'http://twserver.alunos.dcc.fc.up.pt:8137';
const TEST_GROUP = 37;
const TEST_SIZE = 9;

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SERVER_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: body ? JSON.parse(body) : {}
          });
        } catch (error) {
          resolve({ status: res.statusCode, data: {} });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testRankingPersistence() {
  console.log('\n🏆 TESTE: Persistência de Rankings\n');
  console.log('═'.repeat(50));
  
  // Ver ranking inicial
  const before = await makeRequest('POST', '/ranking', {
    group: TEST_GROUP,
    size: TEST_SIZE
  });
  
  console.log('\n📊 Ranking ANTES do jogo:');
  if (before.data.ranking && before.data.ranking.length > 0) {
    before.data.ranking.forEach((p, i) => {
      console.log(`   ${i+1}. ${p.nick}: ${p.victories}V / ${p.games}J`);
    });
  } else {
    console.log('   (vazio)');
  }
  
  // Registar jogadores
  await makeRequest('POST', '/register', { nick: 'test1', password: 'pass' });
  await makeRequest('POST', '/register', { nick: 'test2', password: 'pass' });
  
  // Criar jogo
  const j1 = await makeRequest('POST', '/join', {
    group: TEST_GROUP,
    nick: 'test1',
    password: 'pass',
    size: TEST_SIZE
  });
  
  await sleep(500);
  
  const j2 = await makeRequest('POST', '/join', {
    group: TEST_GROUP,
    nick: 'test2',
    password: 'pass',
    size: TEST_SIZE
  });
  
  const gameId = j1.data.game;
  console.log(`\n🎮 Jogo criado: ${gameId.substring(0, 8)}...`);
  
  // test1 desiste, test2 ganha
  await makeRequest('POST', '/leave', {
    nick: 'test1',
    password: 'pass',
    game: gameId
  });
  
  console.log('   test1 desistiu → test2 ganhou');
  
  await sleep(1000);
  
  // Ver ranking depois
  const after = await makeRequest('POST', '/ranking', {
    group: TEST_GROUP,
    size: TEST_SIZE
  });
  
  console.log('\n📊 Ranking DEPOIS do jogo:');
  if (after.data.ranking && after.data.ranking.length > 0) {
    after.data.ranking.forEach((p, i) => {
      console.log(`   ${i+1}. ${p.nick}: ${p.victories}V / ${p.games}J`);
    });
    console.log('\n✅ Rankings estão a persistir!');
  } else {
    console.log('   ❌ Ranking vazio - BUG!');
  }
}

async function testDiceWithNoMoves() {
  console.log('\n\n🎲 TESTE: Dado 1,4,6 sem peças movidas\n');
  console.log('═'.repeat(50));
  
  // Registar jogadores
  await makeRequest('POST', '/register', { nick: 'dice1', password: 'pass' });
  await makeRequest('POST', '/register', { nick: 'dice2', password: 'pass' });
  
  // Criar jogo
  const j1 = await makeRequest('POST', '/join', {
    group: TEST_GROUP + 1,
    nick: 'dice1',
    password: 'pass',
    size: 7
  });
  
  await sleep(500);
  
  await makeRequest('POST', '/join', {
    group: TEST_GROUP + 1,
    nick: 'dice2',
    password: 'pass',
    size: 7
  });
  
  const gameId = j1.data.game;
  console.log(`\n🎮 Jogo criado: ${gameId.substring(0, 8)}...`);
  
  // Tentar lançar dado várias vezes
  console.log('\n🎲 Lançando dado 5 vezes:');
  
  for (let i = 1; i <= 5; i++) {
    const roll = await makeRequest('POST', '/roll', {
      nick: 'dice1',
      password: 'pass',
      game: gameId
    });
    
    if (roll.status === 200 && roll.data.update) {
      const dice = roll.data.update.dice;
      const mustPass = roll.data.update.mustPass;
      
      console.log(`   ${i}. Valor: ${dice.value}, KeepPlaying: ${dice.keepPlaying}, MustPass: ${mustPass || 'null'}`);
      
      if (dice.keepPlaying && !mustPass) {
        console.log('      → Pode lançar novamente ✅');
      } else if (mustPass) {
        console.log('      → Deve passar a vez');
        await makeRequest('POST', '/pass', {
          nick: 'dice1',
          password: 'pass',
          game: gameId
        });
        break;
      }
    } else {
      console.log(`   ${i}. ERRO: ${roll.data.error || 'Unknown'}`);
    }
    
    await sleep(300);
  }
  
  // Limpar
  await makeRequest('POST', '/leave', {
    nick: 'dice1',
    password: 'pass',
    game: gameId
  });
  
  console.log('\n✅ Teste concluído!');
}

async function runTests() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║        TESTE DAS CORREÇÕES - BUGS CRÍTICOS            ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  
  try {
    await testRankingPersistence();
    await testDiceWithNoMoves();
    
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║                 TESTES CONCLUÍDOS                      ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    process.exit(1);
  }
}

// Verificar servidor
(async () => {
  try {
    await makeRequest('POST', '/ranking', { group: 1, size: 9 });
    console.log('✅ Servidor a correr em ' + SERVER_URL);
    await runTests();
  } catch {
    console.log('\n❌ Servidor não está a correr em ' + SERVER_URL);
    console.log('   Execute: node server/index.js\n');
    process.exit(1);
  }
})();