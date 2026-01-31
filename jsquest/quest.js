/**
 * Sistema de Questionários Públicos
 * Gerencia identificação e envio de respostas via API
 * O local é definido pelo admin no questionário
 */

// ================================================================
// CONFIGURAÇÃO DA API
// ================================================================

const API_URL = '/api';

const publicApi = {
    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        try {
            const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
            const data = await response.json();

            if (!response.ok) {
                throw { status: response.status, ...data };
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    async getActiveQuestionnaire() {
        return this.request('/public/questionnaire/active');
    },

    async submitResponse(data) {
        return this.request('/public/submit', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
};

// ================================================================
// GERENCIADOR DE QUESTIONÁRIOS
// ================================================================

class QuestionnaireManager {
    constructor() {
        this.currentQuestionnaire = null;
        this.currentQuestionIndex = 0;
        this.responses = {};
        this.userInfo = {
            isAnonymous: true,
            name: '',
            position: ''
        };

        this.init();
    }

    // ==================== INICIALIZAÇÃO ====================

    async init() {
        this.setupEventListeners();
        this.setCurrentDate();
        await this.loadActiveQuestionnaire();
    }

    setupEventListeners() {
        // Identificação
        document.querySelectorAll('input[name="identify"]').forEach(radio => {
            radio.addEventListener('change', (e) => this.onIdentificationChoice(e.target.value));
        });

        // Campos de identificação
        const nameField = document.getElementById('respondentName');
        const positionField = document.getElementById('respondentPosition');

        if (nameField) {
            nameField.addEventListener('input', () => this.validateStartButton());
        }
        if (positionField) {
            positionField.addEventListener('input', () => this.validateStartButton());
        }

        // Botão iniciar questionário
        const startBtn = document.getElementById('startQuestionnaireBtn');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startQuestionnaire());
        }

        // Navegação
        const prevBtn = document.getElementById('prevQuestionBtn');
        const nextBtn = document.getElementById('nextQuestionBtn');
        const submitBtn = document.getElementById('submitQuestionnaireBtn');

        if (prevBtn) prevBtn.addEventListener('click', () => this.previousQuestion());
        if (nextBtn) nextBtn.addEventListener('click', () => this.nextQuestion());
        if (submitBtn) submitBtn.addEventListener('click', () => this.showSubmitConfirmation());

        // Modal de confirmação
        this.setupConfirmationModal();
    }

    setCurrentDate() {
        const dateInfo = document.getElementById('dateInfo');
        if (dateInfo) {
            const today = new Date();
            dateInfo.textContent = today.toLocaleDateString('pt-BR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    }

    // ==================== CARREGAR QUESTIONÁRIO ====================

    async loadActiveQuestionnaire() {
        try {
            this.showLoading();
            const questionnaire = await publicApi.getActiveQuestionnaire();

            if (!questionnaire || !questionnaire.questions || questionnaire.questions.length === 0) {
                this.showNoQuestionnaire('Nenhum questionário disponível no momento.');
                return;
            }

            // Verificar se o questionário tem local definido
            if (!questionnaire.state || !questionnaire.municipality) {
                this.showNoQuestionnaire('Este questionário ainda não tem um local definido. Entre em contato com o administrador.');
                return;
            }

            this.currentQuestionnaire = questionnaire;

            // Atualizar título
            const subtitle = document.getElementById('questionnaireSubtitle');
            if (subtitle) {
                subtitle.textContent = questionnaire.name || 'Pesquisa de Satisfação';
            }

            // Atualizar local na tela
            const locationInfo = document.getElementById('locationInfo');
            if (locationInfo) {
                locationInfo.textContent = `${questionnaire.municipality}, ${questionnaire.state}`;
            }

            // Mostrar seção de identificação
            document.getElementById('identificationSection')?.classList.remove('hidden');

        } catch (error) {
            console.error('Erro ao carregar questionário:', error);
            this.showNoQuestionnaire('Erro ao carregar questionário. Tente novamente mais tarde.');
        } finally {
            this.hideLoading();
        }
    }

    showNoQuestionnaire(message) {
        // Ocultar seção de identificação
        document.getElementById('identificationSection')?.classList.add('hidden');

        // Mostrar mensagem de erro
        const container = document.querySelector('.questionnaire-container');
        if (container) {
            container.innerHTML = `
                <div class="questionnaire-header">
                    <h1 id="questionnaireSubtitle">Questionário Indisponível</h1>
                </div>
                <div class="no-template-message">
                    <h3><i class="fas fa-exclamation-triangle"></i></h3>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    // ==================== IDENTIFICAÇÃO ====================

    onIdentificationChoice(choice) {
        const identificationFields = document.getElementById('identificationFields');

        if (choice === 'yes') {
            identificationFields?.classList.remove('hidden');
            this.userInfo.isAnonymous = false;
        } else {
            identificationFields?.classList.add('hidden');
            this.userInfo.isAnonymous = true;
            this.userInfo.name = '';
            this.userInfo.position = '';
        }

        this.validateStartButton();
    }

    validateStartButton() {
        const startBtn = document.getElementById('startQuestionnaireBtn');
        if (!startBtn) return;

        // Verificar identificação
        const identifyYes = document.getElementById('identifyYes');
        const identifyNo = document.getElementById('identifyNo');
        const identificationSelected = identifyYes?.checked || identifyNo?.checked;

        let identificationValid = false;

        if (this.userInfo.isAnonymous) {
            identificationValid = true;
        } else {
            const nameField = document.getElementById('respondentName');
            const positionField = document.getElementById('respondentPosition');

            if (nameField && positionField) {
                const nameValid = nameField.value.trim().length > 0;
                const positionValid = positionField.value.trim().length > 0;

                if (nameValid && positionValid) {
                    this.userInfo.name = nameField.value.trim();
                    this.userInfo.position = positionField.value.trim();
                    identificationValid = true;
                }
            }
        }

        // Habilitar/desabilitar botão
        const canStart = identificationSelected && identificationValid && this.currentQuestionnaire;

        startBtn.disabled = !canStart;
        startBtn.classList.toggle('disabled', !canStart);
    }

    // ==================== QUESTIONÁRIO ====================

    startQuestionnaire() {
        if (!this.currentQuestionnaire) {
            this.showError('Nenhum questionário disponível no momento.');
            return;
        }

        // Ocultar seção de identificação
        document.getElementById('identificationSection')?.classList.add('hidden');

        // Mostrar conteúdo do questionário
        const questionnaireContent = document.getElementById('questionnaireContent');
        if (questionnaireContent) {
            questionnaireContent.classList.remove('hidden');
        }

        this.createProgressIndicator();
        this.showQuestion(0);
    }

    createProgressIndicator() {
        const progressIndicator = document.getElementById('progressIndicator');
        if (!progressIndicator || !this.currentQuestionnaire) return;

        progressIndicator.innerHTML = '';

        this.currentQuestionnaire.questions.forEach((_, index) => {
            const dot = document.createElement('div');
            dot.className = 'progress-dot';
            if (index === 0) dot.classList.add('active');
            progressIndicator.appendChild(dot);
        });
    }

    updateProgressIndicator() {
        const dots = document.querySelectorAll('.progress-dot');
        dots.forEach((dot, index) => {
            dot.classList.remove('active', 'completed');

            if (index < this.currentQuestionIndex) {
                dot.classList.add('completed');
            } else if (index === this.currentQuestionIndex) {
                dot.classList.add('active');
            }
        });
    }

    showQuestion(questionIndex) {
        if (!this.currentQuestionnaire || questionIndex >= this.currentQuestionnaire.questions.length) {
            return;
        }

        this.currentQuestionIndex = questionIndex;
        const question = this.currentQuestionnaire.questions[questionIndex];
        const container = document.getElementById('questionContainer');

        if (!container) return;

        container.innerHTML = '';

        const questionElement = this.createQuestionElement(question, questionIndex);
        container.appendChild(questionElement);

        this.updateNavigationButtons();
        this.updateProgressIndicator();

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    createQuestionElement(question, questionIndex) {
        const questionName = `question_${question.id}`;

        switch (question.type) {
            case 'scale':
                return this.createScaleQuestion(question, questionName);

            case 'multiple':
                return this.createMultipleChoiceQuestion(question, questionName);

            case 'boolean':
                return this.createBooleanQuestion(question, questionName);

            case 'text':
                return this.createTextQuestion(question, questionName);

            default:
                return this.createScaleQuestion(question, questionName);
        }
    }

    createScaleQuestion(question, questionName) {
        const template = document.getElementById('scaleQuestionTemplate');
        const element = template.content.cloneNode(true);

        element.querySelector('.question-text').textContent = question.text;
        const container = element.querySelector('.rating-container');

        // Criar escala de 1 a 10
        for (let i = 1; i <= 10; i++) {
            const scaleTemplate = document.getElementById('scaleButtonTemplate');
            const scaleElement = scaleTemplate.content.cloneNode(true);

            const input = scaleElement.querySelector('.scale-input');
            const label = scaleElement.querySelector('.scale-label');

            input.name = questionName;
            input.value = i;
            input.id = `${questionName}_${i}`;
            input.required = question.is_required;

            label.setAttribute('for', `${questionName}_${i}`);
            label.textContent = i;

            // Restaurar resposta se existir
            if (this.responses[questionName]?.value === i.toString()) {
                input.checked = true;
            }

            input.addEventListener('change', () => {
                this.responses[questionName] = {
                    question_id: question.id,
                    value: i.toString(),
                    numeric_value: i
                };

                // Auto-avançar
                setTimeout(() => {
                    if (this.currentQuestionIndex < this.currentQuestionnaire.questions.length - 1) {
                        this.nextQuestion();
                    }
                }, 300);
            });

            container.appendChild(scaleElement);
        }

        // Labels para os extremos
        const labelsDiv = document.createElement('div');
        labelsDiv.className = 'scale-labels';
        labelsDiv.innerHTML = `
            <span>Muito Insatisfeito</span>
            <span>Muito Satisfeito</span>
        `;
        container.appendChild(labelsDiv);

        return element;
    }

    createMultipleChoiceQuestion(question, questionName) {
        const template = document.getElementById('multipleChoiceQuestionTemplate');
        const element = template.content.cloneNode(true);

        element.querySelector('.question-text').textContent = question.text;
        const container = element.querySelector('.multiple-choice-container');

        const options = question.options?.options || ['Excelente', 'Bom', 'Regular', 'Ruim', 'Péssimo'];

        options.forEach((option, index) => {
            const optionTemplate = document.getElementById('choiceOptionTemplate');
            const optionElement = optionTemplate.content.cloneNode(true);

            const input = optionElement.querySelector('.form-check-input');
            const label = optionElement.querySelector('.form-check-label');

            input.name = questionName;
            input.value = option;
            input.id = `${questionName}_${index}`;
            input.required = question.is_required;

            label.setAttribute('for', `${questionName}_${index}`);
            label.textContent = option;

            // Restaurar resposta
            if (this.responses[questionName]?.value === option) {
                input.checked = true;
            }

            input.addEventListener('change', () => {
                this.responses[questionName] = {
                    question_id: question.id,
                    value: option,
                    numeric_value: null
                };

                setTimeout(() => {
                    if (this.currentQuestionIndex < this.currentQuestionnaire.questions.length - 1) {
                        this.nextQuestion();
                    }
                }, 300);
            });

            container.appendChild(optionElement);
        });

        return element;
    }

    createBooleanQuestion(question, questionName) {
        const template = document.getElementById('booleanQuestionTemplate');
        const element = template.content.cloneNode(true);

        element.querySelector('.question-text').textContent = question.text;

        const trueOption = element.querySelector('.true-option');
        const falseOption = element.querySelector('.false-option');
        const trueLabel = element.querySelector('.true-label');
        const falseLabel = element.querySelector('.false-label');

        trueOption.name = questionName;
        falseOption.name = questionName;
        trueOption.id = `${questionName}_true`;
        falseOption.id = `${questionName}_false`;
        trueOption.required = question.is_required;
        falseOption.required = question.is_required;

        trueLabel.setAttribute('for', `${questionName}_true`);
        falseLabel.setAttribute('for', `${questionName}_false`);

        // Restaurar resposta
        if (this.responses[questionName]?.value === 'true') {
            trueOption.checked = true;
        } else if (this.responses[questionName]?.value === 'false') {
            falseOption.checked = true;
        }

        [trueOption, falseOption].forEach(option => {
            option.addEventListener('change', (e) => {
                this.responses[questionName] = {
                    question_id: question.id,
                    value: e.target.value,
                    numeric_value: e.target.value === 'true' ? 1 : 0
                };

                setTimeout(() => {
                    if (this.currentQuestionIndex < this.currentQuestionnaire.questions.length - 1) {
                        this.nextQuestion();
                    }
                }, 300);
            });
        });

        return element;
    }

    createTextQuestion(question, questionName) {
        const template = document.getElementById('textQuestionTemplate');
        const element = template.content.cloneNode(true);

        element.querySelector('.question-text').textContent = question.text;

        const textarea = element.querySelector('.text-input');
        textarea.name = questionName;
        textarea.id = questionName;
        textarea.required = question.is_required;

        // Restaurar resposta
        if (this.responses[questionName]?.value) {
            textarea.value = this.responses[questionName].value;
        }

        textarea.addEventListener('input', (e) => {
            this.responses[questionName] = {
                question_id: question.id,
                value: e.target.value,
                numeric_value: null
            };
        });

        return element;
    }

    // ==================== NAVEGAÇÃO ====================

    updateNavigationButtons() {
        const prevBtn = document.getElementById('prevQuestionBtn');
        const nextBtn = document.getElementById('nextQuestionBtn');
        const submitBtn = document.getElementById('submitQuestionnaireBtn');

        if (prevBtn) {
            prevBtn.classList.toggle('hidden', this.currentQuestionIndex === 0);
        }

        if (nextBtn) {
            nextBtn.classList.toggle('hidden', this.currentQuestionIndex >= this.currentQuestionnaire.questions.length - 1);
        }

        if (submitBtn) {
            submitBtn.classList.toggle('hidden', this.currentQuestionIndex !== this.currentQuestionnaire.questions.length - 1);
        }
    }

    previousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.showQuestion(this.currentQuestionIndex - 1);
        }
    }

    nextQuestion() {
        const currentQuestion = this.currentQuestionnaire.questions[this.currentQuestionIndex];
        const questionName = `question_${currentQuestion.id}`;

        // Verificar se a pergunta obrigatória foi respondida
        if (currentQuestion.is_required && !this.responses[questionName]) {
            this.showError('Por favor, responda a pergunta antes de continuar.');
            return;
        }

        if (this.currentQuestionIndex < this.currentQuestionnaire.questions.length - 1) {
            this.showQuestion(this.currentQuestionIndex + 1);
        }
    }

    // ==================== SUBMISSÃO ====================

    showSubmitConfirmation() {
        // Verificar se todas as perguntas obrigatórias foram respondidas
        const unansweredRequired = this.currentQuestionnaire.questions.some(question => {
            const questionName = `question_${question.id}`;
            return question.is_required && !this.responses[questionName];
        });

        if (unansweredRequired) {
            this.showError('Por favor, responda todas as perguntas obrigatórias antes de finalizar.');
            return;
        }

        // Usar SweetAlert2 se disponível
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Confirmar Envio?',
                text: 'Tem certeza que deseja enviar suas respostas?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#10B981',
                cancelButtonColor: '#6B7280',
                confirmButtonText: 'Sim, enviar!',
                cancelButtonText: 'Cancelar'
            }).then((result) => {
                if (result.isConfirmed) {
                    this.submitQuestionnaire();
                }
            });
        } else {
            // Fallback para modal HTML
            const modal = document.getElementById('responseModal');
            if (modal) {
                modal.classList.remove('hidden');
            }
        }
    }

    setupConfirmationModal() {
        const modal = document.getElementById('responseModal');
        const confirmBtn = document.getElementById('confirmSubmitBtn');
        const cancelBtn = document.getElementById('cancelSubmitBtn');
        const closeBtn = modal?.querySelector('.close-modal');

        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => this.submitQuestionnaire());
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => modal?.classList.add('hidden'));
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => modal?.classList.add('hidden'));
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });
        }
    }

    async submitQuestionnaire() {
        try {
            this.showLoading();

            // Fechar modal se estiver aberto
            document.getElementById('responseModal')?.classList.add('hidden');

            // Preparar dados da resposta - usar location_id do questionário
            const responseData = {
                questionnaire_id: this.currentQuestionnaire.id,
                location_id: this.currentQuestionnaire.location_id,
                respondent_name: this.userInfo.isAnonymous ? null : this.userInfo.name,
                respondent_position: this.userInfo.isAnonymous ? null : this.userInfo.position,
                is_anonymous: this.userInfo.isAnonymous,
                answers: Object.values(this.responses)
            };

            // Enviar para API
            await publicApi.submitResponse(responseData);

            // Mostrar agradecimento
            this.showThankYou();

        } catch (error) {
            console.error('Erro ao enviar resposta:', error);
            this.showError('Erro ao enviar suas respostas. Tente novamente.');
        } finally {
            this.hideLoading();
        }
    }

    showThankYou() {
        // Ocultar questionário
        document.querySelector('.questionnaire-container')?.classList.add('hidden');

        // Mostrar agradecimento
        const thankYouContainer = document.getElementById('thankyouContainer');
        if (thankYouContainer) {
            thankYouContainer.classList.remove('hidden');
        }

        // Usar SweetAlert2 se disponível
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Obrigado!',
                text: 'Suas respostas foram enviadas com sucesso.',
                icon: 'success',
                confirmButtonColor: '#10B981',
                timer: 5000,
                timerProgressBar: true
            }).then(() => {
                window.location.reload();
            });
        } else {
            // Recarregar após 5 segundos
            setTimeout(() => {
                window.location.reload();
            }, 5000);
        }
    }

    // ==================== UTILITÁRIOS ====================

    showLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.remove('hidden');
        }
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    showError(message) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Erro',
                text: message,
                icon: 'error',
                confirmButtonColor: '#EF4444'
            });
        } else {
            alert(message);
        }
    }
}

// ==================== INICIALIZAÇÃO ====================

document.addEventListener('DOMContentLoaded', () => {
    window.questionnaireManager = new QuestionnaireManager();
    console.log('Sistema de Questionários carregado!');
});
