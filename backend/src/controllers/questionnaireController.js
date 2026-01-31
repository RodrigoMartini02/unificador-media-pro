const { QuestionnaireModel, QuestionModel, LocationModel } = require('../models');

const questionnaireController = {
    async findAll(req, res, next) {
        try {
            const { active } = req.query;
            const questionnaires = await QuestionnaireModel.findAll(active === 'true');
            res.json(questionnaires);
        } catch (error) {
            next(error);
        }
    },

    async findById(req, res, next) {
        try {
            const { id } = req.params;
            const questionnaire = await QuestionnaireModel.findWithQuestions(id);
            if (!questionnaire) {
                return res.status(404).json({ error: 'Questionnaire not found' });
            }
            res.json(questionnaire);
        } catch (error) {
            next(error);
        }
    },

    async create(req, res, next) {
        try {
            const { name, description, is_active, questions } = req.body;
            const questionnaire = await QuestionnaireModel.create({
                name,
                description,
                is_active,
                created_by: req.userId
            });

            // Criar perguntas se fornecidas
            if (questions && questions.length > 0) {
                for (let i = 0; i < questions.length; i++) {
                    await QuestionModel.create({
                        questionnaire_id: questionnaire.id,
                        text: questions[i].text,
                        type: questions[i].type,
                        options: questions[i].options,
                        display_order: i,
                        is_required: questions[i].is_required
                    });
                }
            }

            const result = await QuestionnaireModel.findWithQuestions(questionnaire.id);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    },

    async update(req, res, next) {
        try {
            const { id } = req.params;
            const { name, description, is_active } = req.body;
            const questionnaire = await QuestionnaireModel.update(id, { name, description, is_active });
            if (!questionnaire) {
                return res.status(404).json({ error: 'Questionnaire not found' });
            }
            res.json(questionnaire);
        } catch (error) {
            next(error);
        }
    },

    async toggleActive(req, res, next) {
        try {
            const { id } = req.params;
            const questionnaire = await QuestionnaireModel.toggleActive(id);
            if (!questionnaire) {
                return res.status(404).json({ error: 'Questionnaire not found' });
            }
            res.json(questionnaire);
        } catch (error) {
            next(error);
        }
    },

    async delete(req, res, next) {
        try {
            const { id } = req.params;
            await QuestionnaireModel.delete(id);
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    },

    // Questions
    async addQuestion(req, res, next) {
        try {
            const { id } = req.params;
            const { text, type, options, is_required } = req.body;

            const questions = await QuestionModel.findByQuestionnaire(id);
            const display_order = questions.length;

            const question = await QuestionModel.create({
                questionnaire_id: id,
                text,
                type,
                options,
                display_order,
                is_required
            });

            res.status(201).json(question);
        } catch (error) {
            next(error);
        }
    },

    async updateQuestion(req, res, next) {
        try {
            const { questionId } = req.params;
            const { text, type, options, is_required } = req.body;
            const question = await QuestionModel.update(questionId, { text, type, options, is_required });
            if (!question) {
                return res.status(404).json({ error: 'Question not found' });
            }
            res.json(question);
        } catch (error) {
            next(error);
        }
    },

    async deleteQuestion(req, res, next) {
        try {
            const { questionId } = req.params;
            await QuestionModel.delete(questionId);
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    },

    async reorderQuestions(req, res, next) {
        try {
            const { id } = req.params;
            const { orderedIds } = req.body;
            await QuestionModel.reorder(id, orderedIds);
            const questionnaire = await QuestionnaireModel.findWithQuestions(id);
            res.json(questionnaire);
        } catch (error) {
            next(error);
        }
    },

    async setLocation(req, res, next) {
        try {
            const { id } = req.params;
            const { state, municipality } = req.body;

            // Verificar se o questionário existe
            const questionnaire = await QuestionnaireModel.findById(id);
            if (!questionnaire) {
                return res.status(404).json({ error: 'Questionnaire not found' });
            }

            let locationId = null;

            // Se state e municipality forem fornecidos, buscar ou criar a localização
            if (state && municipality) {
                let location = await LocationModel.findByStateAndMunicipality(state, municipality);
                if (!location) {
                    location = await LocationModel.create({ state, municipality });
                }
                locationId = location.id;
            }

            // Vincular/desvincular localização ao questionário
            await QuestionnaireModel.setLocation(id, locationId);

            // Retornar questionário atualizado
            const updated = await QuestionnaireModel.findWithQuestions(id);
            res.json(updated);
        } catch (error) {
            next(error);
        }
    }
};

module.exports = questionnaireController;
