const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

(async () => {
  try {
    const email = 'admin@carreirausa.com';
    const password = 'Admin123456';

    console.log('🔄 Resetando senha para:', email);
    console.log('🔑 Nova senha:', password);

    // Criar hash
    const hash = await bcrypt.hash(password, 12);
    console.log('✅ Hash criado');

    // Buscar ou criar usuário
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      console.log('📝 Criando novo usuário...');
      user = await prisma.user.create({
        data: {
          email: email,
          name: 'Admin User',
          role: 'ADMIN',
          active: true,
          password: hash
        }
      });
      console.log('✅ Usuário criado!');
    } else {
      console.log('📝 Atualizando senha...');
      await prisma.user.update({
        where: { email: email },
        data: {
          password: hash,
          active: true
        }
      });
      console.log('✅ Senha atualizada!');
    }

    // Testar senha
    console.log('\n🧪 Testando autenticação...');
    const testUser = await prisma.user.findUnique({
      where: { email: email },
      select: { password: true, active: true }
    });

    const valid = await bcrypt.compare(password, testUser.password);
    console.log('   Ativo:', testUser.active);
    console.log('   Senha válida:', valid ? '✅ SIM' : '❌ NÃO');

    if (valid) {
      console.log('\n' + '='.repeat(50));
      console.log('✅ CREDENCIAIS PRONTAS PARA USO:');
      console.log('='.repeat(50));
      console.log('Email:', email);
      console.log('Senha:', password);
      console.log('URL: https://app.carreirausa.com/auth/signin');
      console.log('='.repeat(50));
    } else {
      console.log('\n❌ ERRO: Senha não validou corretamente!');
    }

    await prisma.$disconnect();
  } catch (e) {
    console.error('\n❌ ERRO:', e.message);
    console.error(e);
    process.exit(1);
  }
})();
