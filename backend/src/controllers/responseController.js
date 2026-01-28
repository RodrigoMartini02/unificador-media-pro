const { ResponseModel, ResponseAnswerModel, QuestionnaireModel, LocationModel, transaction } = require('../models');

const responseController = {
    async findAll(req, res, next) {
        try {
            const {
                questionnaire_id,
                location_id,
                state,
                date_from,
                date_to,
                page = 1,
                limit = 20
            } = req.query;

            const offset = (page - 1) * limit;

            const responses = await ResponseModel.findAll({
                questionnaire_id,
                location_id,
                state,
                date_from,
                date_to,
                limit: parseInt(limit),
                offset
            });

            const total = await ResponseModel.count({
                questionnaire_id,
                state,
                date_from,
                date_to
            });

            res.json({
                data: responses,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            next(error);
        }
    },

    async findById(req, res, next) {
        try {
            const { id } = req.params;
            const response = await ResponseModel.findWithAnswers(id);
            if (!response) {
                return res.status(404).json({ error: 'Response not found' });
            }
            res.json(response);
        } catch (error) {
            next(error);
        }
    },

    // Endpoint público para submeter resposta (sem autenticação)
    async submit(req, res, next) {
        try {
            const {
                questionnaire_id,
                location_id,
                respondent_name,
                respondent_position,
                is_anonymous,
                answers
            } = req.body;

            // Verificar se questionário existe e está ativo
            const questionnaire = await QuestionnaireModel.findById(questionnaire_id);
            if (!questionnaire) {
                return res.status(404).json({ error: 'Questionnaire not found' });
            }
            if (!questionnaire.is_active) {
                return res.status(400).json({ error: 'Questionnaire is not active' });
            }

            // Verificar se localização existe
            if (location_id) {
                const location = await LocationModel.findById(location_id);
                if (!location) {
                    return res.status(404).json({ error: 'Location not found' });
                }
            }

            // Criar resposta e respostas individuais em transação
            const result = await transaction(async (client) => {
                // Criar resposta principal
                const responseResult = await client.query(
                    'INSERT INTO responses (questionnaire_id, location_id, respondent_name, respondent_position, is_anonymous) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                    [questionnaire_id, location_id, respondent_name, respondent_position, is_anonymous || false]
                );
                const response = responseResult.rows[0];

                // Criar respostas individuais
                for (const answer of answers) {
                    await client.query(
                        'INSERT INTO response_answers (response_id, question_id, value, numeric_value) VALUES ($1, $2, $3, $4)',
                        [response.id, answer.question_id, answer.value, answer.numeric_value]
                    );
                }

                return response;
            });

            res.status(201).json({
                message: 'Response submitted successfully',
                response_id: result.id
            });
        } catch (error) {
            next(error);
        }
    },

    async delete(req, res, next) {
        try {
            const { id } = req.params;
            await ResponseModel.delete(id);
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    },

    async bulkDelete(req, res, next) {
        try {
            const { ids } = req.body;
            for (const id of ids) {
                await ResponseModel.delete(id);
            }
            res.json({ message: `${ids.length} responses deleted` });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = responseController;
