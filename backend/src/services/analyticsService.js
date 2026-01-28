const { query } = require('../config/database');

class AnalyticsService {
    // Estatísticas gerais do dashboard
    async getOverview(filters = {}) {
        const baseWhere = this.buildWhereClause(filters);

        // Total de respostas
        const totalResponses = await query(`
            SELECT COUNT(*) as total FROM responses r
            LEFT JOIN locations l ON r.location_id = l.id
            ${baseWhere.sql}
        `, baseWhere.params);

        // Respostas de hoje
        const todayResponses = await query(`
            SELECT COUNT(*) as total FROM responses r
            LEFT JOIN locations l ON r.location_id = l.id
            ${baseWhere.sql} ${baseWhere.sql ? 'AND' : 'WHERE'} DATE(r.submitted_at) = CURRENT_DATE
        `, baseWhere.params);

        // Total de localizações com respostas
        const totalLocations = await query(`
            SELECT COUNT(DISTINCT r.location_id) as total FROM responses r
            LEFT JOIN locations l ON r.location_id = l.id
            ${baseWhere.sql}
        `, baseWhere.params);

        // Média de satisfação (perguntas tipo escala)
        const avgSatisfaction = await query(`
            SELECT AVG(ra.numeric_value) as average
            FROM response_answers ra
            JOIN responses r ON ra.response_id = r.id
            JOIN questions q ON ra.question_id = q.id
            LEFT JOIN locations l ON r.location_id = l.id
            ${baseWhere.sql} ${baseWhere.sql ? 'AND' : 'WHERE'} q.type = 'scale' AND ra.numeric_value IS NOT NULL
        `, baseWhere.params);

        return {
            totalResponses: parseInt(totalResponses.rows[0].total),
            todayResponses: parseInt(todayResponses.rows[0].total),
            totalLocations: parseInt(totalLocations.rows[0].total),
            avgSatisfaction: parseFloat(avgSatisfaction.rows[0].average) || 0
        };
    }

    // Distribuição de satisfação
    async getSatisfactionDistribution(filters = {}) {
        const baseWhere = this.buildWhereClause(filters);

        const result = await query(`
            SELECT
                CASE
                    WHEN ra.numeric_value <= 2 THEN 'Muito Insatisfeito'
                    WHEN ra.numeric_value <= 4 THEN 'Insatisfeito'
                    WHEN ra.numeric_value <= 6 THEN 'Neutro'
                    WHEN ra.numeric_value <= 8 THEN 'Satisfeito'
                    ELSE 'Muito Satisfeito'
                END as category,
                COUNT(*) as count
            FROM response_answers ra
            JOIN responses r ON ra.response_id = r.id
            JOIN questions q ON ra.question_id = q.id
            LEFT JOIN locations l ON r.location_id = l.id
            ${baseWhere.sql} ${baseWhere.sql ? 'AND' : 'WHERE'} q.type = 'scale' AND ra.numeric_value IS NOT NULL
            GROUP BY category
            ORDER BY
                CASE category
                    WHEN 'Muito Insatisfeito' THEN 1
                    WHEN 'Insatisfeito' THEN 2
                    WHEN 'Neutro' THEN 3
                    WHEN 'Satisfeito' THEN 4
                    WHEN 'Muito Satisfeito' THEN 5
                END
        `, baseWhere.params);

        return result.rows;
    }

    // Tendências de respostas ao longo do tempo
    async getResponseTrends(filters = {}, period = '30d') {
        const baseWhere = this.buildWhereClause(filters);

        let dateFormat, interval;
        switch (period) {
            case '7d':
                dateFormat = 'YYYY-MM-DD';
                interval = "7 days";
                break;
            case '30d':
                dateFormat = 'YYYY-MM-DD';
                interval = "30 days";
                break;
            case '90d':
                dateFormat = 'YYYY-MM-DD';
                interval = "90 days";
                break;
            default:
                dateFormat = 'YYYY-MM';
                interval = "12 months";
        }

        const result = await query(`
            SELECT
                TO_CHAR(r.submitted_at, '${dateFormat}') as date,
                COUNT(*) as count,
                AVG(ra.numeric_value) as avg_satisfaction
            FROM responses r
            LEFT JOIN response_answers ra ON r.id = ra.response_id
            LEFT JOIN questions q ON ra.question_id = q.id AND q.type = 'scale'
            LEFT JOIN locations l ON r.location_id = l.id
            ${baseWhere.sql} ${baseWhere.sql ? 'AND' : 'WHERE'} r.submitted_at >= CURRENT_DATE - INTERVAL '${interval}'
            GROUP BY TO_CHAR(r.submitted_at, '${dateFormat}')
            ORDER BY date
        `, baseWhere.params);

        return result.rows;
    }

    // Comparativo por localização
    async getLocationComparison(filters = {}) {
        const baseWhere = this.buildWhereClause(filters);

        const result = await query(`
            SELECT
                l.state,
                l.municipality,
                COUNT(DISTINCT r.id) as total_responses,
                AVG(ra.numeric_value) as avg_satisfaction
            FROM locations l
            LEFT JOIN responses r ON l.id = r.location_id
            LEFT JOIN response_answers ra ON r.id = ra.response_id
            LEFT JOIN questions q ON ra.question_id = q.id AND q.type = 'scale'
            ${baseWhere.sql.replace('WHERE', baseWhere.sql ? 'WHERE' : '')}
            GROUP BY l.id, l.state, l.municipality
            HAVING COUNT(r.id) > 0
            ORDER BY avg_satisfaction DESC NULLS LAST
        `, baseWhere.params);

        return result.rows;
    }

    // Análise por pergunta específica
    async getQuestionAnalysis(questionId, filters = {}) {
        const baseWhere = this.buildWhereClause(filters);

        // Informações da pergunta
        const questionInfo = await query('SELECT * FROM questions WHERE id = $1', [questionId]);
        if (!questionInfo.rows[0]) {
            throw { statusCode: 404, message: 'Question not found' };
        }

        const question = questionInfo.rows[0];

        let analysisResult;

        if (question.type === 'scale') {
            // Distribuição de valores para escala
            analysisResult = await query(`
                SELECT
                    ra.numeric_value as value,
                    COUNT(*) as count
                FROM response_answers ra
                JOIN responses r ON ra.response_id = r.id
                LEFT JOIN locations l ON r.location_id = l.id
                WHERE ra.question_id = $1 AND ra.numeric_value IS NOT NULL
                ${baseWhere.sql.replace('WHERE', 'AND')}
                GROUP BY ra.numeric_value
                ORDER BY ra.numeric_value
            `, [questionId, ...baseWhere.params]);
        } else if (question.type === 'boolean') {
            // Distribuição sim/não
            analysisResult = await query(`
                SELECT
                    ra.value,
                    COUNT(*) as count
                FROM response_answers ra
                JOIN responses r ON ra.response_id = r.id
                LEFT JOIN locations l ON r.location_id = l.id
                WHERE ra.question_id = $1
                ${baseWhere.sql.replace('WHERE', 'AND')}
                GROUP BY ra.value
            `, [questionId, ...baseWhere.params]);
        } else if (question.type === 'text') {
            // Respostas de texto
            analysisResult = await query(`
                SELECT
                    ra.value as text,
                    r.submitted_at,
                    l.state,
                    l.municipality
                FROM response_answers ra
                JOIN responses r ON ra.response_id = r.id
                LEFT JOIN locations l ON r.location_id = l.id
                WHERE ra.question_id = $1 AND ra.value IS NOT NULL AND ra.value != ''
                ${baseWhere.sql.replace('WHERE', 'AND')}
                ORDER BY r.submitted_at DESC
                LIMIT 100
            `, [questionId, ...baseWhere.params]);
        }

        return {
            question,
            data: analysisResult.rows
        };
    }

    // Análise por questionário
    async getQuestionnaireAnalysis(questionnaireId, filters = {}) {
        const baseWhere = this.buildWhereClause(filters);

        // Total de respostas do questionário
        const totalResult = await query(`
            SELECT COUNT(*) as total FROM responses r
            LEFT JOIN locations l ON r.location_id = l.id
            WHERE r.questionnaire_id = $1
            ${baseWhere.sql.replace('WHERE', 'AND')}
        `, [questionnaireId, ...baseWhere.params]);

        // Média geral de satisfação
        const avgResult = await query(`
            SELECT AVG(ra.numeric_value) as average
            FROM response_answers ra
            JOIN responses r ON ra.response_id = r.id
            JOIN questions q ON ra.question_id = q.id
            LEFT JOIN locations l ON r.location_id = l.id
            WHERE r.questionnaire_id = $1 AND q.type = 'scale' AND ra.numeric_value IS NOT NULL
            ${baseWhere.sql.replace('WHERE', 'AND')}
        `, [questionnaireId, ...baseWhere.params]);

        // Média por pergunta
        const questionAvgResult = await query(`
            SELECT
                q.id,
                q.text,
                q.type,
                AVG(ra.numeric_value) as average,
                COUNT(*) as count
            FROM questions q
            LEFT JOIN response_answers ra ON q.id = ra.question_id
            LEFT JOIN responses r ON ra.response_id = r.id
            LEFT JOIN locations l ON r.location_id = l.id
            WHERE q.questionnaire_id = $1
            ${baseWhere.sql.replace('WHERE', 'AND')}
            GROUP BY q.id, q.text, q.type
            ORDER BY q.display_order
        `, [questionnaireId, ...baseWhere.params]);

        return {
            totalResponses: parseInt(totalResult.rows[0].total),
            avgSatisfaction: parseFloat(avgResult.rows[0].average) || 0,
            questionStats: questionAvgResult.rows
        };
    }

    // Helper para construir cláusula WHERE
    buildWhereClause(filters) {
        const conditions = [];
        const params = [];
        let paramCount = 0;

        if (filters.questionnaire_id) {
            paramCount++;
            conditions.push(`r.questionnaire_id = $${paramCount}`);
            params.push(filters.questionnaire_id);
        }

        if (filters.location_id) {
            paramCount++;
            conditions.push(`r.location_id = $${paramCount}`);
            params.push(filters.location_id);
        }

        if (filters.state) {
            paramCount++;
            conditions.push(`l.state = $${paramCount}`);
            params.push(filters.state);
        }

        if (filters.date_from) {
            paramCount++;
            conditions.push(`r.submitted_at >= $${paramCount}`);
            params.push(filters.date_from);
        }

        if (filters.date_to) {
            paramCount++;
            conditions.push(`r.submitted_at <= $${paramCount}`);
            params.push(filters.date_to);
        }

        return {
            sql: conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '',
            params
        };
    }
}

module.exports = new AnalyticsService();
