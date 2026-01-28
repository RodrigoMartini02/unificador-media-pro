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
