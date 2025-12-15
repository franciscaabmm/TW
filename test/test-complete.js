// ============================================
// TEST-COMPLETE.JS - Testes Completos do Servidor
// ============================================

const http = require('http');

const SERVER_URL = 'http://twserver.alunos.dcc.fc.up.pt:8137';
const TEST_GROUP = 37;
const TEST_SIZE = 9;

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

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

      res.on('data', chunk => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const response = {
            status: res.statusCode,
            data: body ? JSON.parse(body) : {}
          };
          resolve(response);
        } catch (error) {
          resolve({
            status: res.statusCode,
            data: { error: 'Invalid JSON response' }
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

function testResult(name, passed, details = '') {
  totalTests++;
  if (passed) {
    passedTests++;
    log(`  ✅ ${name}${details ? ': ' + details : ''}`, 'green');
  } else {
    failedTests++;
    log(`  ❌ ${name}${details ? ': ' + details : ''}`, 'red');
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// TESTES DE REGISTO
// ============================================

async function testRegister() {
  log('\n📝 TESTES DE REGISTO', 'cyan');
  log('─'.repeat(50), 'cyan');

  // Test 1: Registar novo utilizador
  try {
    const res = await makeRequest('POST', '/register', {
      nick: 'alice',
      password: 'secret123'
    });
    testResult('Registar novo utilizador', res.status === 200);
  } catch (error) {
    testResult('Registar novo utilizador', false, error.message);
  }

  // Test 2: Registar outro utilizador
  try {
    const res = await makeRequest('POST', '/register', {
      nick: 'bob',
      password: 'secret456'
    });
    testResult('Registar segundo utilizador', res.status === 200);
  } catch (error) {
    testResult('Registar segundo utilizador', false, error.message);
  }

  // Test 3: Verificar password existente
  try {
    const res = await makeRequest('POST', '/register', {
      nick: 'alice',
      password: 'secret123'
    });
    testResult('Verificar password correta', res.status === 200);
  } catch (error) {
    testResult('Verificar password correta', false, error.message);
  }

  // Test 4: Password errada
  try {
    const res = await makeRequest('POST', '/register', {
      nick: 'alice',
      password: 'wrongpass'
    });
    testResult('Rejeitar password errada', res.status === 401 && res.data.error);
  } catch (error) {
    testResult('Rejeitar password errada', false, error.message);
  }

  // Test 5: Campos em falta
  try {
    const res = await makeRequest('POST', '/register', {
      nick: 'charlie'
    });
    testResult('Rejeitar campos em falta', res.status === 400 && res.data.error);
  } catch (error) {
    testResult('Rejeitar campos em falta', false, error.message);
  }
}

// ============================================
// TESTES DE EMPARELHAMENTO
// ============================================

let gameId = null;

async function testJoin() {
  log('\n🎮 TESTES DE EMPARELHAMENTO', 'cyan');
  log('─'.repeat(50), 'cyan');

  // Test 1: Alice junta-se à fila
  try {
    const res = await makeRequest('POST', '/join', {
      group: TEST_GROUP,
      nick: 'alice',
      password: 'secret123',
      size: TEST_SIZE
    });
    
    if (res.status === 200 && res.data.game) {
      gameId = res.data.game;
      testResult('Alice junta-se à fila', true, `Game ID: ${gameId.substring(0, 8)}...`);
    } else {
      testResult('Alice junta-se à fila', false);
    }
  } catch (error) {
    testResult('Alice junta-se à fila', false, error.message);
  }

  await sleep(500);

  // Test 2: Bob junta-se (deve emparelhar)
  try {
    const res = await makeRequest('POST', '/join', {
      group: TEST_GROUP,
      nick: 'bob',
      password: 'secret456',
      size: TEST_SIZE
    });
    
    const matched = res.status === 200 && res.data.game === gameId;
    testResult('Bob emparelhado com Alice', matched, matched ? 'Match encontrado!' : 'IDs diferentes');
  } catch (error) {
    testResult('Bob emparelhado com Alice', false, error.message);
  }

  // Test 3: Tentar juntar-se com password errada
  try {
    const res = await makeRequest('POST', '/join', {
      group: TEST_GROUP,
      nick: 'alice',
      password: 'wrongpass',
      size: TEST_SIZE
    });
    testResult('Rejeitar credenciais inválidas', res.status === 401);
  } catch (error) {
    testResult('Rejeitar credenciais inválidas', false, error.message);
  }

  // Test 4: Tamanho inválido
  try {
    const res = await makeRequest('POST', '/join', {
      group: TEST_GROUP,
      nick: 'bob',
      password: 'secret456',
      size: 8 // Par
    });
    testResult('Rejeitar tamanho inválido', res.status === 400);
  } catch (error) {
    testResult('Rejeitar tamanho inválido', false, error.message);
  }
}

// ============================================
// TESTES DE JOGO
// ============================================

async function testGameplay() {
  log('\n🎲 TESTES DE JOGO', 'cyan');
  log('─'.repeat(50), 'cyan');

  if (!gameId) {
    log('  ⚠️  Sem Game ID - pulando testes de jogo', 'yellow');
    return;
  }

  await sleep(1000);

  // Test 1: Lançar dado (Alice)
  try {
    const res = await makeRequest('POST', '/roll', {
      nick: 'alice',
      password: 'secret123',
      game: gameId
    });
    testResult('Alice lança o dado', res.status === 200);
  } catch (error) {
    testResult('Alice lança o dado', false, error.message);
  }

  await sleep(500);

  // Test 2: Tentar jogar fora da vez (Bob)
  try {
    const res = await makeRequest('POST', '/roll', {
      nick: 'bob',
      password: 'secret456',
      game: gameId
    });
    testResult('Rejeitar jogada fora da vez', res.status === 400 && res.data.error);
  } catch (error) {
    testResult('Rejeitar jogada fora da vez', false, error.message);
  }

  // Test 3: Notificar jogada
  try {
    const res = await makeRequest('POST', '/notify', {
      nick: 'alice',
      password: 'secret123',
      game: gameId,
      cell: 0
    });
    // Pode ser 200 (válida) ou 400 (inválida dependendo do dado)
    testResult('Notificar jogada', res.status === 200 || res.status === 400);
  } catch (error) {
    testResult('Notificar jogada', false, error.message);
  }

  // Test 4: Game ID inválido
  try {
    const res = await makeRequest('POST', '/roll', {
      nick: 'alice',
      password: 'secret123',
      game: 'invalid-game-id'
    });
    testResult('Rejeitar Game ID inválido', res.status === 400);
  } catch (error) {
    testResult('Rejeitar Game ID inválido', false, error.message);
  }
}

// ============================================
// TESTES DE LEAVE
// ============================================

async function testLeave() {
  log('\n🚪 TESTES DE SAÍDA', 'cyan');
  log('─'.repeat(50), 'cyan');

  if (!gameId) {
    log('  ⚠️  Sem Game ID - pulando testes de leave', 'yellow');
    return;
  }

  // Test 1: Bob sai do jogo
  try {
    const res = await makeRequest('POST', '/leave', {
      nick: 'bob',
      password: 'secret456',
      game: gameId
    });
    testResult('Bob sai do jogo', res.status === 200);
  } catch (error) {
    testResult('Bob sai do jogo', false, error.message);
  }

  // Test 2: Tentar sair com credenciais erradas
  try {
    const res = await makeRequest('POST', '/leave', {
      nick: 'alice',
      password: 'wrongpass',
      game: gameId
    });
    testResult('Rejeitar credenciais inválidas', res.status === 401);
  } catch (error) {
    testResult('Rejeitar credenciais inválidas', false, error.message);
  }
}

// ============================================
// TESTES DE RANKING
// ============================================

async function testRanking() {
  log('\n🏆 TESTES DE RANKING', 'cyan');
  log('─'.repeat(50), 'cyan');

  // Test 1: Obter ranking
  try {
    const res = await makeRequest('POST', '/ranking', {
      group: TEST_GROUP,
      size: TEST_SIZE
    });
    
    if (res.status === 200 && Array.isArray(res.data.ranking)) {
      testResult('Obter ranking', true, `${res.data.ranking.length} entradas`);
      
      // Mostrar ranking se houver dados
      if (res.data.ranking.length > 0) {
        log('\n  📊 Ranking atual:', 'blue');
        res.data.ranking.forEach((entry, i) => {
          log(`    ${i + 1}. ${entry.nick} - ${entry.victories}V / ${entry.games}J`, 'blue');
        });
      }
    } else {
      testResult('Obter ranking', false);
    }
  } catch (error) {
    testResult('Obter ranking', false, error.message);
  }

  // Test 2: Tamanho inválido
  try {
    const res = await makeRequest('POST', '/ranking', {
      group: TEST_GROUP,
      size: 6 // Par
    });
    testResult('Rejeitar tamanho inválido', res.status === 400);
  } catch (error) {
    testResult('Rejeitar tamanho inválido', false, error.message);
  }

  // Test 3: Grupo inválido
  try {
    const res = await makeRequest('POST', '/ranking', {
      group: 'invalid',
      size: TEST_SIZE
    });
    testResult('Rejeitar grupo inválido', res.status === 400);
  } catch (error) {
    testResult('Rejeitar grupo inválido', false, error.message);
  }
}

// ============================================
// TESTES DE ENDPOINTS INVÁLIDOS
// ============================================

async function testInvalidEndpoints() {
  log('\n🚫 TESTES DE VALIDAÇÃO', 'cyan');
  log('─'.repeat(50), 'cyan');

  // Test 1: Endpoint inexistente
  try {
    const res = await makeRequest('POST', '/invalid', {});
    testResult('Endpoint inexistente (404)', res.status === 404);
  } catch (error) {
    testResult('Endpoint inexistente (404)', false, error.message);
  }

  // Test 2: Método inválido
  try {
    const res = await makeRequest('GET', '/register');
    testResult('Método inválido (404/405)', res.status === 404 || res.status === 405);
  } catch (error) {
    testResult('Método inválido (404/405)', false, error.message);
  }
}

// ============================================
// VERIFICAR SERVIDOR
// ============================================

async function checkServer() {
  try {
    const res = await makeRequest('POST', '/ranking', {
      group: TEST_GROUP,
      size: TEST_SIZE
    });
    return res.status === 200;
  } catch (error) {
    return false;
  }
}

// ============================================
// EXECUTAR TODOS OS TESTES
// ============================================

async function runAllTests() {
  log('\n' + '='.repeat(50), 'magenta');
  log('   🧪 SERVIDOR TÂB - TESTES COMPLETOS', 'magenta');
  log('='.repeat(50), 'magenta');
  log(`   URL: ${SERVER_URL}`, 'yellow');
  log(`   Grupo: ${TEST_GROUP}`, 'yellow');
  log(`   Tamanho: ${TEST_SIZE}`, 'yellow');
  log('='.repeat(50) + '\n', 'magenta');

  try {
    await testRegister();
    await testJoin();
    await testGameplay();
    await testLeave();
    await testRanking();
    await testInvalidEndpoints();

    // Resumo final
    log('\n' + '='.repeat(50), 'magenta');
    log('   📊 RESUMO DOS TESTES', 'magenta');
    log('='.repeat(50), 'magenta');
    log(`   Total de testes: ${totalTests}`, 'blue');
    log(`   ✅ Passou: ${passedTests}`, 'green');
    log(`   ❌ Falhou: ${failedTests}`, 'red');
    
    const percentage = ((passedTests / totalTests) * 100).toFixed(1);
    log(`   📈 Taxa de sucesso: ${percentage}%`, percentage >= 80 ? 'green' : 'yellow');
    log('='.repeat(50) + '\n', 'magenta');

    if (failedTests === 0) {
      log('   🎉 PARABÉNS! Todos os testes passaram!', 'green');
      log('   ✅ Servidor pronto para deploy!\n', 'green');
    } else {
      log('   ⚠️  Alguns testes falharam. Verifique os erros acima.\n', 'yellow');
    }

  } catch (error) {
    log(`\n❌ Erro crítico: ${error.message}`, 'red');
    process.exit(1);
  }
}

// ============================================
// MAIN
// ============================================

(async () => {
  log('\n🔍 Verificando servidor...', 'blue');
  
  const serverRunning = await checkServer();

  if (!serverRunning) {
    log('\n❌ Servidor não está a correr em ' + SERVER_URL, 'red');
    log('   Execute: cd server && node index.js\n', 'yellow');
    process.exit(1);
  }

  log('✅ Servidor está a correr!\n', 'green');
  
  await runAllTests();
})();