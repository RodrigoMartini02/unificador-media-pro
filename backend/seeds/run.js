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

// Localizações de exemplo
const SAMPLE_LOCATIONS = [
    { state: 'São Paulo', municipality: 'São Paulo' },
    { state: 'São Paulo', municipality: 'Campinas' },
    { state: 'São Paulo', municipality: 'Santos' },
    { state: 'Rio de Janeiro', municipality: 'Rio de Janeiro' },
    { state: 'Rio de Janeiro', municipality: 'Niterói' },
    { state: 'Minas Gerais', municipality: 'Belo Horizonte' },
    { state: 'Minas Gerais', municipality: 'Uberlândia' },
    { state: 'Paraná', municipality: 'Curitiba' },
    { state: 'Rio Grande do Sul', municipality: 'Porto Alegre' },
    { state: 'Bahia', municipality: 'Salvador' }
];

// Questionário de exemplo
const SAMPLE_QUESTIONNAIRE = {
    name: 'Pesquisa de Satisfação Geral',
    description: 'Questionário para avaliar a satisfação dos usuários com os serviços prestados.',
    questions: [
        {
            text: 'Como você avalia a qualidade do atendimento recebido?',
            type: 'scale',
            options: { min: 1, max: 10 },
            is_required: true
        },
        {
            text: 'O tempo de espera foi adequado?',
            type: 'boolean',
            options: {},
            is_required: true
        },
        {
            text: 'Como você avalia a infraestrutura do local?',
            type: 'scale',
            options: { min: 1, max: 10 },
            is_required: true
        },
        {
            text: 'Os funcionários foram prestativos e educados?',
            type: 'boolean',
            options: {},
            is_required: true
        },
        {
            text: 'Como você avalia a clareza das informações fornecidas?',
            type: 'scale',
            options: { min: 1, max: 10 },
            is_required: true
        },
        {
            text: 'Você recomendaria nossos serviços a outras pessoas?',
            type: 'boolean',
            options: {},
            is_required: true
        },
        {
            text: 'Deixe sua sugestão ou comentário para melhorarmos:',
            type: 'text',
            options: {},
            is_required: false
        }
    ]
};

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

        // Obter ID do admin para usar como created_by
        const adminResult = await client.query('SELECT id FROM quest_users WHERE role = $1 LIMIT 1', ['admin']);
        const adminId = adminResult.rows[0]?.id;

        // 2. Criar localizações de exemplo
        console.log('\nCreating sample locations...');
        for (const location of SAMPLE_LOCATIONS) {
            try {
                await client.query(
                    `INSERT INTO locations (state, municipality, created_by)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (state, municipality) DO NOTHING`,
                    [location.state, location.municipality, adminId]
                );
                console.log(`  ✓ Location: ${location.state} - ${location.municipality}`);
            } catch (err) {
                console.log(`  - Location already exists: ${location.state} - ${location.municipality}`);
            }
        }

        // 3. Criar questionário de exemplo
        console.log('\nCreating sample questionnaire...');
        const existingQ = await client.query('SELECT id FROM questionnaires WHERE name = $1', [SAMPLE_QUESTIONNAIRE.name]);

        if (existingQ.rows.length === 0) {
            const qResult = await client.query(
                `INSERT INTO questionnaires (name, description, is_active, created_by)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id`,
                [SAMPLE_QUESTIONNAIRE.name, SAMPLE_QUESTIONNAIRE.description, true, adminId]
            );
            const questionnaireId = qResult.rows[0].id;

            for (let i = 0; i < SAMPLE_QUESTIONNAIRE.questions.length; i++) {
                const q = SAMPLE_QUESTIONNAIRE.questions[i];
                await client.query(
                    `INSERT INTO questions (questionnaire_id, text, type, options, display_order, is_required)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [questionnaireId, q.text, q.type, JSON.stringify(q.options), i, q.is_required]
                );
            }
            console.log(`  ✓ Questionnaire created: ${SAMPLE_QUESTIONNAIRE.name}`);
            console.log(`  ✓ ${SAMPLE_QUESTIONNAIRE.questions.length} questions added`);
        } else {
            console.log(`  - Questionnaire already exists: ${SAMPLE_QUESTIONNAIRE.name}`);
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
