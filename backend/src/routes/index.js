const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validationMiddleware');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

const authController = require('../controllers/authController');
const locationController = require('../controllers/locationController');
const questionnaireController = require('../controllers/questionnaireController');
const responseController = require('../controllers/responseController');
const analyticsController = require('../controllers/analyticsController');
const exportController = require('../controllers/exportController');

const router = express.Router();

// ==================== AUTH ROUTES ====================
// No seu arquivo de rotas, altere o bloco AUTH ROUTES:
router.post('/auth/login', [
    body('cpf').notEmpty().withMessage('CPF é obrigatório'), // Alterado de email para cpf
    body('password').notEmpty().withMessage('Senha é obrigatória'),
    validate
], authController.login);

router.get('/auth/me', authMiddleware, authController.me);

router.put('/auth/change-password', authMiddleware, [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 4 }),
    validate
], authController.changePassword);

// ==================== LOCATION ROUTES ====================
router.get('/locations', authMiddleware, locationController.findAll);
router.get('/locations/states', authMiddleware, locationController.getStates);
router.get('/locations/states/:state/municipalities', authMiddleware, locationController.getMunicipalities);

router.post('/locations', authMiddleware, [
    body('state').notEmpty().withMessage('State is required'),
    body('municipality').notEmpty().withMessage('Municipality is required'),
    validate
], locationController.create);

router.delete('/locations/:id', authMiddleware, locationController.delete);

// ==================== QUESTIONNAIRE ROUTES ====================
router.get('/questionnaires', authMiddleware, questionnaireController.findAll);
router.get('/questionnaires/:id', authMiddleware, questionnaireController.findById);

router.post('/questionnaires', authMiddleware, [
    body('name').notEmpty().withMessage('Name is required'),
    validate
], questionnaireController.create);

router.put('/questionnaires/:id', authMiddleware, questionnaireController.update);
router.patch('/questionnaires/:id/toggle', authMiddleware, questionnaireController.toggleActive);
router.delete('/questionnaires/:id', authMiddleware, questionnaireController.delete);

// Questions
router.post('/questionnaires/:id/questions', authMiddleware, [
    body('text').notEmpty().withMessage('Question text is required'),
    body('type').isIn(['scale', 'boolean', 'text', 'multiple']).withMessage('Invalid question type'),
    validate
], questionnaireController.addQuestion);

router.put('/questionnaires/:id/questions/:questionId', authMiddleware, questionnaireController.updateQuestion);
router.delete('/questionnaires/:id/questions/:questionId', authMiddleware, questionnaireController.deleteQuestion);
router.put('/questionnaires/:id/questions/reorder', authMiddleware, questionnaireController.reorderQuestions);

// Set location for questionnaire (state and municipality can be null to unlink)
router.patch('/questionnaires/:id/location', authMiddleware, questionnaireController.setLocation);

// ==================== RESPONSE ROUTES ====================
router.get('/responses', authMiddleware, responseController.findAll);
router.get('/responses/:id', authMiddleware, responseController.findById);
router.delete('/responses/:id', authMiddleware, responseController.delete);
router.post('/responses/bulk-delete', authMiddleware, responseController.bulkDelete);

// ==================== PUBLIC ROUTES (sem autenticação) ====================
// Obter questionário ativo (novo endpoint unificado)
router.get('/public/questionnaire/active', async (req, res, next) => {
    try {
        const { QuestionnaireModel } = require('../models');
        const questionnaires = await QuestionnaireModel.findAll(true);
        if (questionnaires.length === 0) {
            return res.status(404).json({ error: 'No active questionnaire found' });
        }
        const questionnaire = await QuestionnaireModel.findWithQuestions(questionnaires[0].id);
        res.json(questionnaire);
    } catch (error) {
        next(error);
    }
});

// Obter questionário ativo para responder (legacy - por locationId)
router.get('/public/questionnaire/:locationId', async (req, res, next) => {
    try {
        const { QuestionnaireModel } = require('../models');
        const questionnaires = await QuestionnaireModel.findAll(true);
        if (questionnaires.length === 0) {
            return res.status(404).json({ error: 'No active questionnaire found' });
        }
        const questionnaire = await QuestionnaireModel.findWithQuestions(questionnaires[0].id);
        res.json(questionnaire);
    } catch (error) {
        next(error);
    }
});

// Obter questionário por ID (público)
router.get('/public/questionnaire-by-id/:id', async (req, res, next) => {
    try {
        const { QuestionnaireModel } = require('../models');
        const questionnaire = await QuestionnaireModel.findWithQuestions(req.params.id);
        if (!questionnaire || !questionnaire.is_active) {
            return res.status(404).json({ error: 'Questionnaire not found or inactive' });
        }
        res.json(questionnaire);
    } catch (error) {
        next(error);
    }
});

// Obter localizações (público - para o formulário)
router.get('/public/locations', async (req, res, next) => {
    try {
        const { LocationModel } = require('../models');
        const locations = await LocationModel.findAll();
        res.json(locations);
    } catch (error) {
        next(error);
    }
});

router.get('/public/locations/states', async (req, res, next) => {
    try {
        const { LocationModel } = require('../models');
        const states = await LocationModel.getStates();
        res.json(states);
    } catch (error) {
        next(error);
    }
});

router.get('/public/locations/states/:state/municipalities', async (req, res, next) => {
    try {
        const { LocationModel } = require('../models');
        const municipalities = await LocationModel.getMunicipalitiesByState(req.params.state);
        res.json(municipalities);
    } catch (error) {
        next(error);
    }
});

// Submeter resposta (público)
router.post('/public/submit', [
    body('questionnaire_id').notEmpty().withMessage('Questionnaire ID is required'),
    body('answers').isArray().withMessage('Answers must be an array'),
    validate
], responseController.submit);

// ==================== ANALYTICS ROUTES ====================
router.get('/analytics/overview', authMiddleware, analyticsController.getOverview);
router.get('/analytics/satisfaction', authMiddleware, analyticsController.getSatisfaction);
router.get('/analytics/trends', authMiddleware, analyticsController.getTrends);
router.get('/analytics/locations', authMiddleware, analyticsController.getLocationComparison);
router.get('/analytics/questions/:questionId', authMiddleware, analyticsController.getQuestionAnalysis);
router.get('/analytics/questionnaire/:id', authMiddleware, analyticsController.getQuestionnaireAnalysis);

// ==================== EXPORT ROUTES ====================
router.get('/export/csv', authMiddleware, exportController.exportCSV);
router.get('/export/json', authMiddleware, exportController.exportJSON);
router.get('/export/pdf/:id', authMiddleware, exportController.exportPDF);

module.exports = router;
