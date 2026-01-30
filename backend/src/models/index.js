const { query, transaction } = require('../config/database');

// ==================== USERS ====================
const UserModel = {
    async findByEmail(email) {
        const result = await query('SELECT * FROM users WHERE email = $1', [email]);
        return result.rows[0];
    },

    async findByCpf(cpf) {
        const result = await query('SELECT * FROM users WHERE documento = $1', [cpf]);
        return result.rows[0];
    },

    async findById(id) {
        const result = await query('SELECT id, name, email, documento, role, created_at FROM users WHERE id = $1', [id]);
        return result.rows[0];
    },

    async findAll() {
        const result = await query('SELECT id, name, email, documento, role, created_at FROM users ORDER BY name');
        return result.rows;
    },

    async create({ name, email, documento, password_hash, role = 'user' }) {
        const result = await query(
            'INSERT INTO users (name, email, documento, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, documento, role, created_at',
            [name, email, documento, password_hash, role]
        );
        return result.rows[0];
    },

    async updatePassword(id, password_hash) {
        await query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, id]);
    }
};

// ==================== LOCATIONS ====================
const LocationModel = {
    async findAll() {
        const result = await query('SELECT * FROM locations ORDER BY state, municipality');
        return result.rows;
    },

    async findById(id) {
        const result = await query('SELECT * FROM locations WHERE id = $1', [id]);
        return result.rows[0];
    },

    async findByStateAndMunicipality(state, municipality) {
        const result = await query('SELECT * FROM locations WHERE state = $1 AND municipality = $2', [state, municipality]);
        return result.rows[0];
    },

    async getStates() {
        const result = await query('SELECT DISTINCT state FROM locations ORDER BY state');
        return result.rows.map(r => r.state);
    },

    async getMunicipalitiesByState(state) {
        const result = await query('SELECT id, municipality FROM locations WHERE state = $1 ORDER BY municipality', [state]);
        return result.rows;
    },

    async create({ state, municipality, created_by }) {
        const result = await query(
            'INSERT INTO locations (state, municipality, created_by) VALUES ($1, $2, $3) RETURNING *',
            [state, municipality, created_by]
        );
        return result.rows[0];
    },

    async delete(id) {
        await query('DELETE FROM locations WHERE id = $1', [id]);
    }
};

// ==================== QUESTIONNAIRES ====================
const QuestionnaireModel = {
    async findAll(activeOnly = false) {
        let sql = 'SELECT * FROM questionnaires';
        if (activeOnly) sql += ' WHERE is_active = true';
        sql += ' ORDER BY created_at DESC';
        const result = await query(sql);
        return result.rows;
    },

    async findById(id) {
        const result = await query('SELECT * FROM questionnaires WHERE id = $1', [id]);
        return result.rows[0];
    },

    async findWithQuestions(id) {
        const questionnaire = await this.findById(id);
        if (!questionnaire) return null;

        const questions = await query(
            'SELECT * FROM questions WHERE questionnaire_id = $1 ORDER BY display_order',
            [id]
        );
        questionnaire.questions = questions.rows;
        return questionnaire;
    },

    async create({ name, description, is_active = true, created_by }) {
        const result = await query(
            'INSERT INTO questionnaires (name, description, is_active, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, description, is_active, created_by]
        );
        return result.rows[0];
    },

    async update(id, { name, description, is_active }) {
        const result = await query(
            'UPDATE questionnaires SET name = COALESCE($1, name), description = COALESCE($2, description), is_active = COALESCE($3, is_active), updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
            [name, description, is_active, id]
        );
        return result.rows[0];
    },

    async toggleActive(id) {
        const result = await query(
            'UPDATE questionnaires SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    },

    async delete(id) {
        await query('DELETE FROM questionnaires WHERE id = $1', [id]);
    }
};

// ==================== QUESTIONS ====================
const QuestionModel = {
    async findByQuestionnaire(questionnaireId) {
        const result = await query(
            'SELECT * FROM questions WHERE questionnaire_id = $1 ORDER BY display_order',
            [questionnaireId]
        );
        return result.rows;
    },

    async findById(id) {
        const result = await query('SELECT * FROM questions WHERE id = $1', [id]);
        return result.rows[0];
    },

    async create({ questionnaire_id, text, type, options = {}, display_order, is_required = true }) {
        const result = await query(
            'INSERT INTO questions (questionnaire_id, text, type, options, display_order, is_required) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [questionnaire_id, text, type, JSON.stringify(options), display_order, is_required]
        );
        return result.rows[0];
    },

    async update(id, { text, type, options, is_required }) {
        const result = await query(
            'UPDATE questions SET text = COALESCE($1, text), type = COALESCE($2, type), options = COALESCE($3, options), is_required = COALESCE($4, is_required) WHERE id = $5 RETURNING *',
            [text, type, options ? JSON.stringify(options) : null, is_required, id]
        );
        return result.rows[0];
    },

    async delete(id) {
        await query('DELETE FROM questions WHERE id = $1', [id]);
    },

    async reorder(questionnaireId, orderedIds) {
        for (let i = 0; i < orderedIds.length; i++) {
            await query(
                'UPDATE questions SET display_order = $1 WHERE id = $2 AND questionnaire_id = $3',
                [i, orderedIds[i], questionnaireId]
            );
        }
    }
};

// ==================== RESPONSES ====================
const ResponseModel = {
    async findAll(filters = {}) {
        let sql = `
            SELECT r.*, q.name as questionnaire_name, l.state, l.municipality
            FROM responses r
            LEFT JOIN questionnaires q ON r.questionnaire_id = q.id
            LEFT JOIN locations l ON r.location_id = l.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 0;

        if (filters.questionnaire_id) {
            paramCount++;
            sql += ` AND r.questionnaire_id = $${paramCount}`;
            params.push(filters.questionnaire_id);
        }

        if (filters.location_id) {
            paramCount++;
            sql += ` AND r.location_id = $${paramCount}`;
            params.push(filters.location_id);
        }

        if (filters.state) {
            paramCount++;
            sql += ` AND l.state = $${paramCount}`;
            params.push(filters.state);
        }

        if (filters.date_from) {
            paramCount++;
            sql += ` AND r.submitted_at >= $${paramCount}`;
            params.push(filters.date_from);
        }

        if (filters.date_to) {
            paramCount++;
            sql += ` AND r.submitted_at <= $${paramCount}`;
            params.push(filters.date_to);
        }

        sql += ' ORDER BY r.submitted_at DESC';

        if (filters.limit) {
            paramCount++;
            sql += ` LIMIT $${paramCount}`;
            params.push(filters.limit);
        }

        if (filters.offset) {
            paramCount++;
            sql += ` OFFSET $${paramCount}`;
            params.push(filters.offset);
        }

        const result = await query(sql, params);
        return result.rows;
    },

    async findById(id) {
        const result = await query(`
            SELECT r.*, q.name as questionnaire_name, l.state, l.municipality
            FROM responses r
            LEFT JOIN questionnaires q ON r.questionnaire_id = q.id
            LEFT JOIN locations l ON r.location_id = l.id
            WHERE r.id = $1
        `, [id]);
        return result.rows[0];
    },

    async findWithAnswers(id) {
        const response = await this.findById(id);
        if (!response) return null;

        const answers = await query(`
            SELECT ra.*, q.text as question_text, q.type as question_type
            FROM response_answers ra
            JOIN questions q ON ra.question_id = q.id
            WHERE ra.response_id = $1
            ORDER BY q.display_order
        `, [id]);

        response.answers = answers.rows;
        return response;
    },

    async create({ questionnaire_id, location_id, respondent_name, respondent_position, is_anonymous = false }) {
        const result = await query(
            'INSERT INTO responses (questionnaire_id, location_id, respondent_name, respondent_position, is_anonymous) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [questionnaire_id, location_id, respondent_name, respondent_position, is_anonymous]
        );
        return result.rows[0];
    },

    async delete(id) {
        await query('DELETE FROM responses WHERE id = $1', [id]);
    },

    async count(filters = {}) {
        let sql = 'SELECT COUNT(*) FROM responses r LEFT JOIN locations l ON r.location_id = l.id WHERE 1=1';
        const params = [];
        let paramCount = 0;

        if (filters.questionnaire_id) {
            paramCount++;
            sql += ` AND r.questionnaire_id = $${paramCount}`;
            params.push(filters.questionnaire_id);
        }

        if (filters.state) {
            paramCount++;
            sql += ` AND l.state = $${paramCount}`;
            params.push(filters.state);
        }

        if (filters.date_from) {
            paramCount++;
            sql += ` AND r.submitted_at >= $${paramCount}`;
            params.push(filters.date_from);
        }

        if (filters.date_to) {
            paramCount++;
            sql += ` AND r.submitted_at <= $${paramCount}`;
            params.push(filters.date_to);
        }

        const result = await query(sql, params);
        return parseInt(result.rows[0].count);
    }
};

// ==================== RESPONSE ANSWERS ====================
const ResponseAnswerModel = {
    async create({ response_id, question_id, value, numeric_value }) {
        const result = await query(
            'INSERT INTO response_answers (response_id, question_id, value, numeric_value) VALUES ($1, $2, $3, $4) RETURNING *',
            [response_id, question_id, value, numeric_value]
        );
        return result.rows[0];
    },

    async findByResponse(response_id) {
        const result = await query(
            'SELECT * FROM response_answers WHERE response_id = $1',
            [response_id]
        );
        return result.rows;
    },

    async createBulk(response_id, answers) {
        const results = [];
        for (const answer of answers) {
            const result = await this.create({
                response_id,
                question_id: answer.question_id,
                value: answer.value,
                numeric_value: answer.numeric_value
            });
            results.push(result);
        }
        return results;
    }
};

module.exports = {
    UserModel,
    LocationModel,
    QuestionnaireModel,
    QuestionModel,
    ResponseModel,
    ResponseAnswerModel,
    transaction
};
