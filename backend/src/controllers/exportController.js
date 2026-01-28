const { ResponseModel, QuestionnaireModel } = require('../models');
const PDFDocument = require('pdfkit');

const exportController = {
    async exportCSV(req, res, next) {
        try {
            const filters = {
                questionnaire_id: req.query.questionnaire_id,
                location_id: req.query.location_id,
                state: req.query.state,
                date_from: req.query.date_from,
                date_to: req.query.date_to
            };

            const responses = await ResponseModel.findAll(filters);

            // Cabeçalho CSV
            const headers = [
                'ID',
                'Questionario',
                'Estado',
                'Municipio',
                'Respondente',
                'Cargo',
                'Anonimo',
                'Data Submissao'
            ];

            let csv = headers.join(';') + '\n';

            for (const response of responses) {
                const row = [
                    response.id,
                    response.questionnaire_name || '',
                    response.state || '',
                    response.municipality || '',
                    response.respondent_name || '',
                    response.respondent_position || '',
                    response.is_anonymous ? 'Sim' : 'Não',
                    new Date(response.submitted_at).toLocaleString('pt-BR')
                ];
                csv += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';') + '\n';
            }

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename=respostas.csv');
            res.send('\uFEFF' + csv); // BOM para Excel
        } catch (error) {
            next(error);
        }
    },

    async exportJSON(req, res, next) {
        try {
            const filters = {
                questionnaire_id: req.query.questionnaire_id,
                location_id: req.query.location_id,
                state: req.query.state,
                date_from: req.query.date_from,
                date_to: req.query.date_to
            };

            const responses = await ResponseModel.findAll(filters);

            // Buscar detalhes completos de cada resposta
            const detailedResponses = await Promise.all(
                responses.map(r => ResponseModel.findWithAnswers(r.id))
            );

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename=respostas.json');
            res.json(detailedResponses);
        } catch (error) {
            next(error);
        }
    },

    async exportPDF(req, res, next) {
        try {
            const { id } = req.params;
            const response = await ResponseModel.findWithAnswers(id);

            if (!response) {
                return res.status(404).json({ error: 'Response not found' });
            }

            const doc = new PDFDocument({ margin: 50 });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=resposta-${id}.pdf`);

            doc.pipe(res);

            // Título
            doc.fontSize(20).text('Resposta de Questionário', { align: 'center' });
            doc.moveDown();

            // Informações gerais
            doc.fontSize(12);
            doc.text(`Questionário: ${response.questionnaire_name}`);
            doc.text(`Local: ${response.state} - ${response.municipality}`);
            doc.text(`Respondente: ${response.is_anonymous ? 'Anônimo' : response.respondent_name || 'Não informado'}`);
            if (response.respondent_position) {
                doc.text(`Cargo: ${response.respondent_position}`);
            }
            doc.text(`Data: ${new Date(response.submitted_at).toLocaleString('pt-BR')}`);

            doc.moveDown();
            doc.text('─'.repeat(50));
            doc.moveDown();

            // Respostas
            doc.fontSize(14).text('Respostas:', { underline: true });
            doc.moveDown();

            doc.fontSize(11);
            for (const answer of response.answers) {
                doc.text(`${answer.question_text}`, { continued: false });
                doc.fillColor('#666666');

                let answerText = answer.value;
                if (answer.question_type === 'scale') {
                    answerText = `${answer.numeric_value}/10`;
                } else if (answer.question_type === 'boolean') {
                    answerText = answer.value === 'true' || answer.value === '1' ? 'Sim' : 'Não';
                }

                doc.text(`Resposta: ${answerText}`);
                doc.fillColor('#000000');
                doc.moveDown(0.5);
            }

            doc.end();
        } catch (error) {
            next(error);
        }
    }
};

module.exports = exportController;
