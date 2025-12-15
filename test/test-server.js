// ============================================
// TEST-SERVER.JS - Script de Teste do Servidor
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
  blue: '\x1b[34m'
};

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
          reject(new Error(`Failed to parse response: ${error.message}`));
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

async function testRegister() {
  log('\n📝 Testing /register...', 'blue');

  // Test 1: Register new user
  try {
    const res1 = await makeRequest('POST', '/register', {
      nick: 'testuser1',
      password: 'pass1234'
    });

    if (res1.status === 200) {
      log('✅ Register new user: PASSED', 'green');
    } else {
      log(`❌ Register new user: FAILED (status ${res1.status})`, 'red');
    }
  } catch (error) {
    log(`❌ Register new user: ERROR - ${error.message}`, 'red');
  }

  // Test 2: Register same user (should succeed with same password)
  try {
    const res2 = await makeRequest('POST', '/register', {
      nick: 'testuser1',
      password: 'pass1234'
    });

    if (res2.status === 200) {
      log('✅ Register existing user (correct password): PASSED', 'green');
    } else {
      log(`❌ Register existing user: FAILED (status ${res2.status})`, 'red');
    }
  } catch (error) {
    log(`❌ Register existing user: ERROR - ${error.message}`, 'red');
  }

  // Test 3: Register with wrong password
  try {
    const res3 = await makeRequest('POST', '/register', {
      nick: 'testuser1',
      password: 'wrongpass'
    });

    if (res3.status === 401 && res3.data.error) {
      log('✅ Register wrong password: PASSED (correctly rejected)', 'green');
    } else {
      log(`❌ Register wrong password: FAILED (should be 401)`, 'red');
    }
  } catch (error) {
    log(`❌ Register wrong password: ERROR - ${error.message}`, 'red');
  }

  // Test 4: Missing fields
  try {
    const res4 = await makeRequest('POST', '/register', {
      nick: 'testuser2'
      // Missing password
    });

    if (res4.status === 400 && res4.data.error) {
      log('✅ Register missing fields: PASSED (correctly rejected)', 'green');
    } else {
      log(`❌ Register missing fields: FAILED (should be 400)`, 'red');
    }
  } catch (error) {
    log(`❌ Register missing fields: ERROR - ${error.message}`, 'red');
  }
}

async function testRanking() {
  log('\n📊 Testing /ranking...', 'blue');

  try {
    const res = await makeRequest('POST', '/ranking', {
      group: TEST_GROUP,
      size: TEST_SIZE
    });

    if (res.status === 200 && Array.isArray(res.data.ranking)) {
      log(`✅ Get ranking: PASSED (${res.data.ranking.length} entries)`, 'green');
    } else {
      log(`❌ Get ranking: FAILED (status ${res.status})`, 'red');
    }
  } catch (error) {
    log(`❌ Get ranking: ERROR - ${error.message}`, 'red');
  }

  // Test invalid size
  try {
    const res = await makeRequest('POST', '/ranking', {
      group: TEST_GROUP,
      size: 8 // Even number, should fail
    });

    if (res.status === 400 && res.data.error) {
      log('✅ Ranking invalid size: PASSED (correctly rejected)', 'green');
    } else {
      log(`❌ Ranking invalid size: FAILED (should be 400)`, 'red');
    }
  } catch (error) {
    log(`❌ Ranking invalid size: ERROR - ${error.message}`, 'red');
  }
}

async function testJoin() {
  log('\n🎮 Testing /join...', 'blue');

  // Register two test users
  await makeRequest('POST', '/register', {
    nick: 'player1',
    password: 'pass1'
  });

  await makeRequest('POST', '/register', {
    nick: 'player2',
    password: 'pass2'
  });

  // Test join
  try {
    const res1 = await makeRequest('POST', '/join', {
      group: TEST_GROUP,
      nick: 'player1',
      password: 'pass1',
      size: TEST_SIZE
    });

    if (res1.status === 200 && res1.data.game) {
      log(`✅ Join queue: PASSED (game ID: ${res1.data.game.substring(0, 8)}...)`, 'green');
    } else {
      log(`❌ Join queue: FAILED (status ${res1.status})`, 'red');
    }
  } catch (error) {
    log(`❌ Join queue: ERROR - ${error.message}`, 'red');
  }

  // Test join with wrong password
  try {
    const res2 = await makeRequest('POST', '/join', {
      group: TEST_GROUP,
      nick: 'player1',
      password: 'wrongpass',
      size: TEST_SIZE
    });

    if (res2.status === 401 && res2.data.error) {
      log('✅ Join wrong password: PASSED (correctly rejected)', 'green');
    } else {
      log(`❌ Join wrong password: FAILED (should be 401)`, 'red');
    }
  } catch (error) {
    log(`❌ Join wrong password: ERROR - ${error.message}`, 'red');
  }

  // Test invalid size
  try {
    const res3 = await makeRequest('POST', '/join', {
      group: TEST_GROUP,
      nick: 'player2',
      password: 'pass2',
      size: 20 // Too large
    });

    if (res3.status === 400 && res3.data.error) {
      log('✅ Join invalid size: PASSED (correctly rejected)', 'green');
    } else {
      log(`❌ Join invalid size: FAILED (should be 400)`, 'red');
    }
  } catch (error) {
    log(`❌ Join invalid size: ERROR - ${error.message}`, 'red');
  }
}

async function testInvalidEndpoints() {
  log('\n🚫 Testing invalid endpoints...', 'blue');

  // Test 404
  try {
    const res = await makeRequest('POST', '/invalid', {});

    if (res.status === 404) {
      log('✅ Invalid endpoint: PASSED (404)', 'green');
    } else {
      log(`❌ Invalid endpoint: FAILED (should be 404, got ${res.status})`, 'red');
    }
  } catch (error) {
    log(`❌ Invalid endpoint: ERROR - ${error.message}`, 'red');
  }

  // Test wrong method
  try {
    const res = await makeRequest('GET', '/register');

    if (res.status === 404 || res.status === 405) {
      log('✅ Wrong method: PASSED (rejected)', 'green');
    } else {
      log(`❌ Wrong method: FAILED (should be rejected)`, 'red');
    }
  } catch (error) {
    log(`❌ Wrong method: ERROR - ${error.message}`, 'red');
  }
}

async function runAllTests() {
  log('============================================', 'blue');
  log('   🧪 Servidor Tâb - Testes Automáticos', 'blue');
  log('============================================', 'blue');
  log(`   URL: ${SERVER_URL}`, 'yellow');
  log(`   Grupo: ${TEST_GROUP}`, 'yellow');
  log(`   Tamanho: ${TEST_SIZE}`, 'yellow');
  log('============================================\n', 'blue');

  try {
    await testRegister();
    await testRanking();
    await testJoin();
    await testInvalidEndpoints();

    log('\n============================================', 'blue');
    log('   ✅ Testes Concluídos', 'green');
    log('============================================\n', 'blue');
  } catch (error) {
    log(`\n❌ Erro crítico: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Verificar se servidor está a correr
async function checkServer() {
  try {
    await makeRequest('POST', '/ranking', {
      group: TEST_GROUP,
      size: TEST_SIZE
    });
    return true;
  } catch (error) {
    log(`\n❌ Servidor não está a correr em ${SERVER_URL}`, 'red');
    log('   Execute: npm start\n', 'yellow');
    return false;
  }
}

// Executar testes
(async () => {
  const serverRunning = await checkServer();

  if (serverRunning) {
    await runAllTests();
  } else {
    process.exit(1);
  }
})();