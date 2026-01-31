const analyticsService = require('../services/analyticsService');

const analyticsController = {
    async getOverview(req, res, next) {
        try {
            const filters = extractFilters(req.query);
            const overview = await analyticsService.getOverview(filters);
            res.json(overview);
        } catch (error) {
            next(error);
        }
    },

    async getSatisfaction(req, res, next) {
        try {
            const filters = extractFilters(req.query);
            const distribution = await analyticsService.getSatisfactionDistribution(filters);
            res.json(distribution);
        } catch (error) {
            next(error);
        }
    },

    async getTrends(req, res, next) {
        try {
            const filters = extractFilters(req.query);
            const { period = '30d' } = req.query;
            const trends = await analyticsService.getResponseTrends(filters, period);
            res.json(trends);
        } catch (error) {
            next(error);
        }
    },

    async getLocationComparison(req, res, next) {
        try {
            const filters = extractFilters(req.query);
            const comparison = await analyticsService.getLocationComparison(filters);
            res.json(comparison);
        } catch (error) {
            next(error);
        }
    },

    async getQuestionAnalysis(req, res, next) {
        try {
            const { questionId } = req.params;
            const filters = extractFilters(req.query);
            const analysis = await analyticsService.getQuestionAnalysis(questionId, filters);
            res.json(analysis);
        } catch (error) {
            next(error);
        }
    },

    async getQuestionnaireAnalysis(req, res, next) {
        try {
            const { id } = req.params;
            const filters = extractFilters(req.query);
            const analysis = await analyticsService.getQuestionnaireAnalysis(id, filters);
            res.json(analysis);
        } catch (error) {
            next(error);
        }
    },

    // ==================== NOVOS ENDPOINTS ====================

    // Visão macro de todos os questionários
    async getMacro(req, res, next) {
        try {
            const filters = extractFilters(req.query);
            const macro = await analyticsService.getMacroAnalysis(filters);
            res.json(macro);
        } catch (error) {
            next(error);
        }
    },

    // NPS Score
    async getNPS(req, res, next) {
        try {
            const filters = extractFilters(req.query);
            const nps = await analyticsService.getNPSScore(filters);
            res.json(nps);
        } catch (error) {
            next(error);
        }
    },

    // Perguntas críticas (baixa satisfação)
    async getCritical(req, res, next) {
        try {
            const filters = extractFilters(req.query);
            const threshold = parseFloat(req.query.threshold) || 5;
            const critical = await analyticsService.getCriticalQuestions(filters, threshold);
            res.json(critical);
        } catch (error) {
            next(error);
        }
    },

    // Análise detalhada por estado
    async getStateDetail(req, res, next) {
        try {
            const { state } = req.params;
            const filters = extractFilters(req.query);
            const analysis = await analyticsService.getStateAnalysis(state, filters);
            res.json(analysis);
        } catch (error) {
            next(error);
        }
    },

    // Análise por município
    async getMunicipalityDetail(req, res, next) {
        try {
            const { state, municipality } = req.params;
            const filters = extractFilters(req.query);
            const analysis = await analyticsService.getMunicipalityAnalysis(state, municipality, filters);
            if (!analysis) {
                return res.status(404).json({ error: 'Município não encontrado' });
            }
            res.json(analysis);
        } catch (error) {
            next(error);
        }
    },

    // Análise de todas as perguntas de um questionário
    async getQuestionnaireQuestions(req, res, next) {
        try {
            const { id } = req.params;
            const filters = extractFilters(req.query);
            const questions = await analyticsService.getQuestionnaireQuestionsAnalysis(id, filters);
            res.json(questions);
        } catch (error) {
            next(error);
        }
    },

    // Comparativo de pergunta entre estados
    async getQuestionStateComparison(req, res, next) {
        try {
            const { questionId } = req.params;
            const filters = extractFilters(req.query);
            const comparison = await analyticsService.getQuestionStateComparison(questionId, filters);
            res.json(comparison);
        } catch (error) {
            next(error);
        }
    }
};

// Helper para extrair filtros da query
function extractFilters(query) {
    return {
        questionnaire_id: query.questionnaire_id,
        location_id: query.location_id,
        state: query.state,
        date_from: query.date_from,
        date_to: query.date_to
    };
}

module.exports = analyticsController;
