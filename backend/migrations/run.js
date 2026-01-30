require('dotenv').config();
const { pool } = require('../src/config/database');

const migrations = [
    // 1. Create quest_users table (renamed to avoid conflicts with other projects)
    `CREATE TABLE IF NOT EXISTS quest_users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        documento VARCHAR(20) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,

    // 2. Create locations table
    `CREATE TABLE IF NOT EXISTS locations (
        id SERIAL PRIMARY KEY,
        state VARCHAR(100) NOT NULL,
        municipality VARCHAR(255) NOT NULL,
        created_by INTEGER REFERENCES quest_users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(state, municipality)
    )`,

    // 3. Create questionnaires table
    `CREATE TABLE IF NOT EXISTS questionnaires (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_by INTEGER REFERENCES quest_users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,

    // 4. Create questions table
    `CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        questionnaire_id INTEGER NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        type VARCHAR(50) NOT NULL CHECK (type IN ('scale', 'boolean', 'text', 'multiple')),
        options JSONB DEFAULT '{}',
        display_order INTEGER NOT NULL DEFAULT 0,
        is_required BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,

    // 5. Create responses table
    `CREATE TABLE IF NOT EXISTS responses (
        id SERIAL PRIMARY KEY,
        questionnaire_id INTEGER NOT NULL REFERENCES questionnaires(id),
        location_id INTEGER REFERENCES locations(id),
        respondent_name VARCHAR(255),
        respondent_position VARCHAR(255),
        is_anonymous BOOLEAN DEFAULT false,
        submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,

    // 6. Create response_answers table
    `CREATE TABLE IF NOT EXISTS response_answers (
        id SERIAL PRIMARY KEY,
        response_id INTEGER NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
        question_id INTEGER NOT NULL REFERENCES questions(id),
        value TEXT,
        numeric_value DECIMAL(5,2),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,

    // Indexes for performance
    `CREATE INDEX IF NOT EXISTS idx_responses_questionnaire ON responses(questionnaire_id)`,
    `CREATE INDEX IF NOT EXISTS idx_responses_location ON responses(location_id)`,
    `CREATE INDEX IF NOT EXISTS idx_responses_submitted_at ON responses(submitted_at)`,
    `CREATE INDEX IF NOT EXISTS idx_response_answers_response ON response_answers(response_id)`,
    `CREATE INDEX IF NOT EXISTS idx_response_answers_question ON response_answers(question_id)`,
    `CREATE INDEX IF NOT EXISTS idx_questions_questionnaire ON questions(questionnaire_id)`,
    `CREATE INDEX IF NOT EXISTS idx_locations_state ON locations(state)`
];

async function runMigrations() {
    const client = await pool.connect();

    try {
        console.log('Starting migrations...\n');

        for (let i = 0; i < migrations.length; i++) {
            const migration = migrations[i];
            const shortDesc = migration.substring(0, 60).replace(/\s+/g, ' ');
            console.log(`Running migration ${i + 1}/${migrations.length}: ${shortDesc}...`);

            await client.query(migration);
            console.log(`  ✓ Complete\n`);
        }

        console.log('All migrations completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigrations();
