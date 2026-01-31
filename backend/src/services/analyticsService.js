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

    // ==================== NOVOS MÉTODOS DE ANÁLISE AVANÇADA ====================

    // Visão macro consolidada de todos os questionários
    async getMacroAnalysis(filters = {}) {
        const baseWhere = this.buildWhereClause(filters);

        // Estatísticas por questionário
        const questionnaireStats = await query(`
            SELECT
                q.id,
                q.name,
                q.is_active,
                COUNT(DISTINCT r.id) as total_responses,
                AVG(ra.numeric_value) as avg_satisfaction,
                COUNT(DISTINCT r.location_id) as total_locations
            FROM questionnaires q
            LEFT JOIN responses r ON q.id = r.questionnaire_id
            LEFT JOIN response_answers ra ON r.id = ra.response_id
            LEFT JOIN questions qu ON ra.question_id = qu.id AND qu.type = 'scale'
            LEFT JOIN locations l ON r.location_id = l.id
            ${baseWhere.sql.replace('WHERE', baseWhere.sql ? 'WHERE' : '')}
            GROUP BY q.id, q.name, q.is_active
            ORDER BY total_responses DESC
        `, baseWhere.params);

        // Estatísticas por estado
        const stateStats = await query(`
            SELECT
                l.state,
                COUNT(DISTINCT r.id) as total_responses,
                AVG(ra.numeric_value) as avg_satisfaction,
                COUNT(DISTINCT l.id) as total_municipalities
            FROM locations l
            LEFT JOIN responses r ON l.id = r.location_id
            LEFT JOIN response_answers ra ON r.id = ra.response_id
            LEFT JOIN questions q ON ra.question_id = q.id AND q.type = 'scale'
            ${baseWhere.sql.replace('WHERE', baseWhere.sql ? 'WHERE' : '')}
            GROUP BY l.state
            HAVING COUNT(r.id) > 0
            ORDER BY total_responses DESC
        `, baseWhere.params);

        // Totais gerais
        const totals = await query(`
            SELECT
                COUNT(DISTINCT r.id) as total_responses,
                COUNT(DISTINCT r.questionnaire_id) as total_questionnaires,
                COUNT(DISTINCT l.state) as total_states,
                COUNT(DISTINCT r.location_id) as total_locations,
                AVG(ra.numeric_value) as avg_satisfaction
            FROM responses r
            LEFT JOIN response_answers ra ON r.id = ra.response_id
            LEFT JOIN questions q ON ra.question_id = q.id AND q.type = 'scale'
            LEFT JOIN locations l ON r.location_id = l.id
            ${baseWhere.sql}
        `, baseWhere.params);

        // Comparativo com período anterior (últimos 30 dias vs 30 dias anteriores)
        const currentPeriod = await query(`
            SELECT COUNT(*) as count
            FROM responses r
            LEFT JOIN locations l ON r.location_id = l.id
            WHERE r.submitted_at >= CURRENT_DATE - INTERVAL '30 days'
            ${baseWhere.sql.replace('WHERE', 'AND')}
        `, baseWhere.params);

        const previousPeriod = await query(`
            SELECT COUNT(*) as count
            FROM responses r
            LEFT JOIN locations l ON r.location_id = l.id
            WHERE r.submitted_at >= CURRENT_DATE - INTERVAL '60 days'
              AND r.submitted_at < CURRENT_DATE - INTERVAL '30 days'
            ${baseWhere.sql.replace('WHERE', 'AND')}
        `, baseWhere.params);

        const current = parseInt(currentPeriod.rows[0].count);
        const previous = parseInt(previousPeriod.rows[0].count);
        const growthRate = previous > 0 ? ((current - previous) / previous * 100).toFixed(1) : 0;

        return {
            totals: {
                totalResponses: parseInt(totals.rows[0].total_responses) || 0,
                totalQuestionnaires: parseInt(totals.rows[0].total_questionnaires) || 0,
                totalStates: parseInt(totals.rows[0].total_states) || 0,
                totalLocations: parseInt(totals.rows[0].total_locations) || 0,
                avgSatisfaction: parseFloat(totals.rows[0].avg_satisfaction) || 0,
                growthRate: parseFloat(growthRate)
            },
            questionnaireStats: questionnaireStats.rows,
            stateStats: stateStats.rows
        };
    }

    // Cálculo do NPS Score
    async getNPSScore(filters = {}) {
        const baseWhere = this.buildWhereClause(filters);

        // Buscar todas as respostas de escala
        const result = await query(`
            SELECT ra.numeric_value
            FROM response_answers ra
            JOIN responses r ON ra.response_id = r.id
            JOIN questions q ON ra.question_id = q.id
            LEFT JOIN locations l ON r.location_id = l.id
            WHERE q.type = 'scale' AND ra.numeric_value IS NOT NULL
            ${baseWhere.sql.replace('WHERE', 'AND')}
        `, baseWhere.params);

        const answers = result.rows;
        const total = answers.length;

        if (total === 0) {
            return {
                nps: 0,
                promoters: 0,
                passives: 0,
                detractors: 0,
                totalResponses: 0,
                promotersPercent: 0,
                passivesPercent: 0,
                detractorsPercent: 0
            };
        }

        // NPS: Promotores (9-10), Passivos (7-8), Detratores (1-6)
        const promoters = answers.filter(a => a.numeric_value >= 9).length;
        const passives = answers.filter(a => a.numeric_value >= 7 && a.numeric_value <= 8).length;
        const detractors = answers.filter(a => a.numeric_value <= 6).length;

        const nps = Math.round(((promoters - detractors) / total) * 100);

        return {
            nps,
            promoters,
            passives,
            detractors,
            totalResponses: total,
            promotersPercent: Math.round((promoters / total) * 100),
            passivesPercent: Math.round((passives / total) * 100),
            detractorsPercent: Math.round((detractors / total) * 100)
        };
    }

    // Perguntas críticas (baixa satisfação)
    async getCriticalQuestions(filters = {}, threshold = 5) {
        const baseWhere = this.buildWhereClause(filters);

        const result = await query(`
            SELECT
                q.id,
                q.text,
                q.type,
                qn.id as questionnaire_id,
                qn.name as questionnaire_name,
                AVG(ra.numeric_value) as avg_satisfaction,
                COUNT(ra.id) as total_responses,
                MIN(ra.numeric_value) as min_value,
                MAX(ra.numeric_value) as max_value
            FROM questions q
            JOIN questionnaires qn ON q.questionnaire_id = qn.id
            LEFT JOIN response_answers ra ON q.id = ra.question_id
            LEFT JOIN responses r ON ra.response_id = r.id
            LEFT JOIN locations l ON r.location_id = l.id
            WHERE q.type = 'scale'
            ${baseWhere.sql.replace('WHERE', 'AND')}
            GROUP BY q.id, q.text, q.type, qn.id, qn.name
            HAVING AVG(ra.numeric_value) < $1 AND COUNT(ra.id) > 0
            ORDER BY avg_satisfaction ASC
            LIMIT 10
        `, [threshold, ...baseWhere.params]);

        return result.rows.map(row => ({
            ...row,
            avg_satisfaction: parseFloat(row.avg_satisfaction) || 0,
            severity: row.avg_satisfaction < 3 ? 'critical' : row.avg_satisfaction < 4 ? 'high' : 'medium'
        }));
    }

    // Análise detalhada por estado
    async getStateAnalysis(state, filters = {}) {
        // Adiciona filtro de estado
        const stateFilters = { ...filters, state };
        const baseWhere = this.buildWhereClause(stateFilters);

        // Estatísticas gerais do estado
        const overview = await query(`
            SELECT
                COUNT(DISTINCT r.id) as total_responses,
                AVG(ra.numeric_value) as avg_satisfaction,
                COUNT(DISTINCT r.location_id) as total_municipalities
            FROM responses r
            LEFT JOIN response_answers ra ON r.id = ra.response_id
            LEFT JOIN questions q ON ra.question_id = q.id AND q.type = 'scale'
            LEFT JOIN locations l ON r.location_id = l.id
            ${baseWhere.sql}
        `, baseWhere.params);

        // Ranking de municípios
        const municipalityRanking = await query(`
            SELECT
                l.municipality,
                COUNT(DISTINCT r.id) as total_responses,
                AVG(ra.numeric_value) as avg_satisfaction
            FROM locations l
            LEFT JOIN responses r ON l.id = r.location_id
            LEFT JOIN response_answers ra ON r.id = ra.response_id
            LEFT JOIN questions q ON ra.question_id = q.id AND q.type = 'scale'
            WHERE l.state = $1
            GROUP BY l.municipality
            HAVING COUNT(r.id) > 0
            ORDER BY avg_satisfaction DESC
        `, [state]);

        // Distribuição de satisfação no estado
        const satisfaction = await this.getSatisfactionDistribution(stateFilters);

        // Tendências do estado
        const trends = await this.getResponseTrends(stateFilters, '30d');

        // NPS do estado
        const nps = await this.getNPSScore(stateFilters);

        // Média geral para comparação
        const generalAvg = await query(`
            SELECT AVG(ra.numeric_value) as average
            FROM response_answers ra
            JOIN responses r ON ra.response_id = r.id
            JOIN questions q ON ra.question_id = q.id
            WHERE q.type = 'scale' AND ra.numeric_value IS NOT NULL
        `);

        const stateAvg = parseFloat(overview.rows[0].avg_satisfaction) || 0;
        const overallAvg = parseFloat(generalAvg.rows[0].average) || 0;

        return {
            state,
            overview: {
                totalResponses: parseInt(overview.rows[0].total_responses) || 0,
                avgSatisfaction: stateAvg,
                totalMunicipalities: parseInt(overview.rows[0].total_municipalities) || 0,
                vsOverall: (stateAvg - overallAvg).toFixed(2)
            },
            municipalityRanking: municipalityRanking.rows.map(m => ({
                ...m,
                avg_satisfaction: parseFloat(m.avg_satisfaction) || 0
            })),
            satisfaction,
            trends,
            nps
        };
    }

    // Análise por município
    async getMunicipalityAnalysis(state, municipality, filters = {}) {
        // Busca location_id
        const locationResult = await query(
            'SELECT id FROM locations WHERE state = $1 AND municipality = $2',
            [state, municipality]
        );

        if (!locationResult.rows[0]) {
            return null;
        }

        const locationId = locationResult.rows[0].id;
        const municipalityFilters = { ...filters, location_id: locationId };
        const baseWhere = this.buildWhereClause(municipalityFilters);

        // Estatísticas do município
        const overview = await query(`
            SELECT
                COUNT(DISTINCT r.id) as total_responses,
                AVG(ra.numeric_value) as avg_satisfaction
            FROM responses r
            LEFT JOIN response_answers ra ON r.id = ra.response_id
            LEFT JOIN questions q ON ra.question_id = q.id AND q.type = 'scale'
            LEFT JOIN locations l ON r.location_id = l.id
            ${baseWhere.sql}
        `, baseWhere.params);

        // Questionários respondidos no município
        const questionnaires = await query(`
            SELECT
                qn.id,
                qn.name,
                COUNT(DISTINCT r.id) as total_responses,
                AVG(ra.numeric_value) as avg_satisfaction
            FROM questionnaires qn
            LEFT JOIN responses r ON qn.id = r.questionnaire_id AND r.location_id = $1
            LEFT JOIN response_answers ra ON r.id = ra.response_id
            LEFT JOIN questions q ON ra.question_id = q.id AND q.type = 'scale'
            WHERE r.id IS NOT NULL
            GROUP BY qn.id, qn.name
            ORDER BY total_responses DESC
        `, [locationId]);

        // Distribuição de satisfação
        const satisfaction = await this.getSatisfactionDistribution(municipalityFilters);

        // Tendências
        const trends = await this.getResponseTrends(municipalityFilters, '30d');

        // NPS
        const nps = await this.getNPSScore(municipalityFilters);

        return {
            state,
            municipality,
            overview: {
                totalResponses: parseInt(overview.rows[0].total_responses) || 0,
                avgSatisfaction: parseFloat(overview.rows[0].avg_satisfaction) || 0
            },
            questionnaires: questionnaires.rows.map(q => ({
                ...q,
                avg_satisfaction: parseFloat(q.avg_satisfaction) || 0
            })),
            satisfaction,
            trends,
            nps
        };
    }

    // Análise detalhada de todas as perguntas de um questionário
    async getQuestionnaireQuestionsAnalysis(questionnaireId, filters = {}) {
        const baseWhere = this.buildWhereClause(filters);

        // Todas as perguntas com estatísticas detalhadas
        const questions = await query(`
            SELECT
                q.id,
                q.text,
                q.type,
                q.display_order,
                COUNT(DISTINCT ra.id) as total_responses,
                AVG(ra.numeric_value) as avg_satisfaction,
                MIN(ra.numeric_value) as min_value,
                MAX(ra.numeric_value) as max_value,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ra.numeric_value) as median_value
            FROM questions q
            LEFT JOIN response_answers ra ON q.id = ra.question_id
            LEFT JOIN responses r ON ra.response_id = r.id
            LEFT JOIN locations l ON r.location_id = l.id
            WHERE q.questionnaire_id = $1
            ${baseWhere.sql.replace('WHERE', 'AND')}
            GROUP BY q.id, q.text, q.type, q.display_order
            ORDER BY q.display_order
        `, [questionnaireId, ...baseWhere.params]);

        // Para cada pergunta de escala, buscar distribuição
        const questionsWithDistribution = await Promise.all(
            questions.rows.map(async (q) => {
                if (q.type === 'scale') {
                    const distribution = await query(`
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
                    `, [q.id, ...baseWhere.params]);

                    return {
                        ...q,
                        avg_satisfaction: parseFloat(q.avg_satisfaction) || 0,
                        median_value: parseFloat(q.median_value) || 0,
                        distribution: distribution.rows,
                        isCritical: q.avg_satisfaction && parseFloat(q.avg_satisfaction) < 5
                    };
                }
                return {
                    ...q,
                    avg_satisfaction: parseFloat(q.avg_satisfaction) || 0
                };
            })
        );

        return questionsWithDistribution;
    }

    // Comparativo de uma pergunta entre estados
    async getQuestionStateComparison(questionId, filters = {}) {
        const result = await query(`
            SELECT
                l.state,
                AVG(ra.numeric_value) as avg_satisfaction,
                COUNT(*) as total_responses
            FROM response_answers ra
            JOIN responses r ON ra.response_id = r.id
            JOIN locations l ON r.location_id = l.id
            WHERE ra.question_id = $1 AND ra.numeric_value IS NOT NULL
            GROUP BY l.state
            HAVING COUNT(*) > 0
            ORDER BY avg_satisfaction DESC
        `, [questionId]);

        return result.rows.map(row => ({
            ...row,
            avg_satisfaction: parseFloat(row.avg_satisfaction) || 0
        }));
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
