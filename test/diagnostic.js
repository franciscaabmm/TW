// ============================================
// DIAGNOSTIC.JS - Diagnóstico do Emparelhamento
// ============================================

const http = require('http');

const SERVER_URL = 'http://twserver.alunos.dcc.fc.up.pt:8137';
const TEST_GROUP = 42;
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function diagnoseMatching() {
  console.log('\n🔍 DIAGNÓSTICO DO EMPARELHAMENTO\n');
  console.log('═'.repeat(60));

  // 1. Registar utilizadores
  console.log('\n1️⃣ Registando utilizadores...');
  
  await makeRequest('POST', '/register', {
    nick: 'alice',
    password: 'secret123'
  });
  console.log('   ✅ Alice registada');

  await makeRequest('POST', '/register', {
    nick: 'bob',
    password: 'secret456'
  });
  console.log('   ✅ Bob registado');

  // 2. Alice junta-se à fila
  console.log('\n2️⃣ Alice junta-se à fila...');
  const aliceJoin = await makeRequest('POST', '/join', {
    group: TEST_GROUP,
    nick: 'alice',
    password: 'secret123',
    size: TEST_SIZE
  });

  console.log('   📋 Resposta de Alice:');
  console.log('      Status:', aliceJoin.status);
  console.log('      Game ID:', aliceJoin.data.game);
  console.log('      Dados completos:', JSON.stringify(aliceJoin.data, null, 2));

  const aliceGameId = aliceJoin.data.game;

  // Esperar um pouco
  console.log('\n   ⏳ Aguardando 1 segundo...');
  await sleep(1000);

  // 3. Bob junta-se à fila
  console.log('\n3️⃣ Bob junta-se à fila...');
  const bobJoin = await makeRequest('POST', '/join', {
    group: TEST_GROUP,
    nick: 'bob',
    password: 'secret456',
    size: TEST_SIZE
  });

  console.log('   📋 Resposta de Bob:');
  console.log('      Status:', bobJoin.status);
  console.log('      Game ID:', bobJoin.data.game);
  console.log('      Dados completos:', JSON.stringify(bobJoin.data, null, 2));

  const bobGameId = bobJoin.data.game;

  // 4. Comparar Game IDs
  console.log('\n4️⃣ Análise dos Game IDs:');
  console.log('   Alice Game ID:', aliceGameId);
  console.log('   Bob Game ID:  ', bobGameId);
  
  if (aliceGameId === bobGameId) {
    console.log('   ✅ MATCH ENCONTRADO! IDs são iguais');
  } else {
    console.log('   ❌ PROBLEMA: IDs são diferentes!');
    console.log('   🔍 Isto significa que foram criados 2 jogos separados');
    console.log('   🔍 O emparelhamento não está a funcionar');
  }

  // 5. Testar lançamento de dado
  console.log('\n5️⃣ Testando lançamento de dado...');
  const rollResult = await makeRequest('POST', '/roll', {
    nick: 'alice',
    password: 'secret123',
    game: aliceGameId
  });

  console.log('   📋 Resposta do roll:');
  console.log('      Status:', rollResult.status);
  console.log('      Dados:', JSON.stringify(rollResult.data, null, 2));

  if (rollResult.status !== 200) {
    console.log('   ❌ Erro ao lançar dado');
    console.log('   💡 Possível causa: jogo não iniciado corretamente');
  } else {
    console.log('   ✅ Dado lançado com sucesso');
  }

  // 6. Verificar estado do jogo
  console.log('\n6️⃣ Verificando se o jogo existe no servidor...');
  console.log('   💡 Verifique os logs do servidor para:');
  console.log('      - Mensagens de "[GAME] Match created"');
  console.log('      - Tamanho da fila após cada join');
  console.log('      - Estrutura do objeto games');

  console.log('\n═'.repeat(60));
  console.log('\n📊 RESUMO:');
  console.log('   • Alice e Bob registados: ✅');
  console.log(`   • Emparelhamento: ${aliceGameId === bobGameId ? '✅' : '❌'}`);
  console.log(`   • Lançamento de dado: ${rollResult.status === 200 ? '✅' : '❌'}`);
  
  console.log('\n💡 PRÓXIMOS PASSOS:');
  if (aliceGameId !== bobGameId) {
    console.log('   1. Verificar a lógica de emparelhamento em game.js');
    console.log('   2. Confirmar que a fila está sendo gerida corretamente');
    console.log('   3. Ver logs do servidor durante o join');
  }
  
  console.log('\n');
}

// Verificar servidor
async function checkServer() {
  try {
    await makeRequest('POST', '/ranking', {
      group: TEST_GROUP,
      size: TEST_SIZE
    });
    return true;
  } catch (error) {
    return false;
  }
}

(async () => {
  const serverRunning = await checkServer();

  if (!serverRunning) {
    console.log('\n❌ Servidor não está a correr em ' + SERVER_URL);
    console.log('   Execute: cd server && node index.js\n');
    process.exit(1);
  }

  await diagnoseMatching();
})();