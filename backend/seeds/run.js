require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/database');

// Usuários admin para criar via seed
const ADMIN_USERS = [
    {
        name: 'Rodrigo',
        email: 'martini.rodrigo1992@gmail.com',
        documento: '08996441988',
        password: 'qwe123',
        role: 'admin'
    }
    // Adicione mais usuários aqui se necessário
];

async function runSeeds() {
    const client = await pool.connect();

    try {
        console.log('Starting seeds...\n');

        // 1. Criar usuários admin
        console.log('Creating admin users...');
        for (const user of ADMIN_USERS) {
            const hashedPassword = await bcrypt.hash(user.password, 10);

            try {
                await client.query(
                    `INSERT INTO quest_users (name, email, documento, password_hash, role)
                     VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT (email) DO NOTHING`,
                    [user.name, user.email, user.documento, hashedPassword, user.role]
                );
                console.log(`  ✓ User created: ${user.email}`);
            } catch (err) {
                console.log(`  - User already exists: ${user.email}`);
            }
        }

        console.log('\n========================================');
        console.log('Seeds completed successfully!');
        console.log('========================================');
        console.log('\nAdmin login credentials:');
        console.log(`  Nome: ${ADMIN_USERS[0].name}`);
        console.log(`  CPF: ${ADMIN_USERS[0].documento}`);
        console.log(`  Email: ${ADMIN_USERS[0].email}`);
        console.log(`  Senha: ${ADMIN_USERS[0].password}`);
        console.log('\n');

    } catch (error) {
        console.error('Seed failed:', error.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runSeeds();
