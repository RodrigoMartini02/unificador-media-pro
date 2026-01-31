/**
 * Sistema de Questionários Públicos
 * Gerencia identificação e envio de respostas via API
 */

const API_URL = '/api';

// ==================== UTILITÁRIOS ====================

const Utils = {
    toast: {
        success: (msg) => Utils.showToast(msg, 'success'),
        error: (msg) => Utils.showToast(msg, 'error'),
        warning: (msg) => Utils.showToast(msg, 'warning'),
        info: (msg) => Utils.showToast(msg, 'info')
    },

    showToast(message, type = 'info') {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const icon = document.createElement('i');
        icon.className = `fas ${icons[type]}`;

        const span = document.createElement('span');
        span.textContent = message;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close';
        const closeBtnIcon = document.createElement('i');
        closeBtnIcon.className = 'fas fa-times';
        closeBtn.appendChild(closeBtnIcon);
        closeBtn.onclick = () => toast.remove();

        toast.appendChild(icon);
        toast.appendChild(span);
        toast.appendChild(closeBtn);
        container.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => toast.remove(), 4000);
    },

    async confirm(_, message) {
        return new Promise(resolve => {
            const modal = document.getElementById('responseModal');
            const modalText = document.getElementById('responseModalText');
            const confirmBtn = document.getElementById('confirmSubmitBtn');
            const cancelBtn = document.getElementById('cancelSubmitBtn');

            if (modalText) modalText.textContent = message;
            modal.classList.remove('hidden');

            const cleanup = () => {
                modal.classList.add('hidden');
                confirmBtn.removeEventListener('click', onConfirm);
                cancelBtn.removeEventListener('click', onCancel);
            };

            const onConfirm = () => { cleanup(); resolve(true); };
            const onCancel = () => { cleanup(); resolve(false); };

            confirmBtn.addEventListener('click', onConfirm);
            cancelBtn.addEventListener('click', onCancel);
        });
    },

    cloneTemplate(templateId) {
        const template = document.getElementById(templateId);
        return template ? template.content.cloneNode(true) : null;
    },

    setText(parent, selector, text) {
        const el = parent.querySelector(selector);
        if (el) el.textContent = text;
    },

    show(el) { el?.classList.remove('hidden'); },
    hide(el) { el?.classList.add('hidden'); }
};

// ==================== API PÚBLICA ====================

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

    async getQuestionnaireById(id) {
        return this.request(`/public/questionnaire/${id}`);
    },

    async submitResponse(data) {
        return this.request('/public/submit', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
};

// ==================== GERENCIADOR DE QUESTIONÁRIOS ====================

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

    async init() {
        this.setupEventListeners();
        this.setCurrentDate();
        await this.loadActiveQuestionnaire();
    }

    setupEventListeners() {
        document.querySelectorAll('input[name="identify"]').forEach(radio => {
            radio.addEventListener('change', (e) => this.onIdentificationChoice(e.target.value));
        });

        const nameField = document.getElementById('respondentName');
        const positionField = document.getElementById('respondentPosition');

        if (nameField) nameField.addEventListener('input', () => this.validateStartButton());
        if (positionField) positionField.addEventListener('input', () => this.validateStartButton());

        document.getElementById('startQuestionnaireBtn')?.addEventListener('click', () => this.startQuestionnaire());
        document.getElementById('prevQuestionBtn')?.addEventListener('click', () => this.previousQuestion());
        document.getElementById('nextQuestionBtn')?.addEventListener('click', () => this.nextQuestion());
        document.getElementById('submitQuestionnaireBtn')?.addEventListener('click', () => this.showSubmitConfirmation());

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

    getQuestionnaireIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('q');
    }

    async loadActiveQuestionnaire() {
        try {
            this.showLoading();

            // Verifica se há um ID de questionário na URL
            const questionnaireId = this.getQuestionnaireIdFromUrl();
            let questionnaire;

            if (questionnaireId) {
                // Carrega questionário específico pelo ID
                questionnaire = await publicApi.getQuestionnaireById(questionnaireId);
            } else {
                // Carrega questionário ativo padrão
                questionnaire = await publicApi.getActiveQuestionnaire();
            }

            if (!questionnaire) {
                this.showNoQuestionnaire('Nenhum questionário ativo encontrado. Ative um questionário no painel administrativo.');
                return;
            }

            if (!questionnaire.questions || questionnaire.questions.length === 0) {
                this.showNoQuestionnaire('O questionário ativo não possui perguntas. Adicione perguntas no painel administrativo.');
                return;
            }

            if (!questionnaire.state || !questionnaire.municipality) {
                this.showNoQuestionnaire('O questionário ativo não tem um local definido. Vincule um local em "Definir Local" no painel administrativo.');
                return;
            }

            this.currentQuestionnaire = questionnaire;

            const subtitle = document.getElementById('questionnaireSubtitle');
            if (subtitle) subtitle.textContent = questionnaire.name || 'Pesquisa de Satisfação';

            const locationInfo = document.getElementById('locationInfo');
            if (locationInfo) locationInfo.textContent = `${questionnaire.municipality}, ${questionnaire.state}`;

            Utils.show(document.getElementById('identificationSection'));

        } catch (error) {
            console.error('Erro ao carregar questionário:', error);
            if (error.status === 404) {
                this.showNoQuestionnaire('Nenhum questionário ativo encontrado. Ative um questionário no painel administrativo.');
            } else {
                this.showNoQuestionnaire('Erro ao carregar questionário. Tente novamente mais tarde.');
            }
        } finally {
            this.hideLoading();
        }
    }

    showNoQuestionnaire(message) {
        Utils.hide(document.getElementById('identificationSection'));

        const container = document.querySelector('.questionnaire-container');
        if (!container) return;

        container.textContent = '';

        const template = Utils.cloneTemplate('noQuestionnaireTemplate');
        if (template) {
            Utils.setText(template, '.error-message-text', message);
            container.appendChild(template);
        } else {
            const header = document.createElement('div');
            header.className = 'questionnaire-header';

            const title = document.createElement('h1');
            title.textContent = 'Questionário Indisponível';
            header.appendChild(title);

            const msgDiv = document.createElement('div');
            msgDiv.className = 'no-template-message';

            const icon = document.createElement('h3');
            const iconEl = document.createElement('i');
            iconEl.className = 'fas fa-exclamation-triangle';
            icon.appendChild(iconEl);

            const text = document.createElement('p');
            text.textContent = message;

            msgDiv.appendChild(icon);
            msgDiv.appendChild(text);

            container.appendChild(header);
            container.appendChild(msgDiv);
        }
    }

    onIdentificationChoice(choice) {
        const identificationFields = document.getElementById('identificationFields');

        if (choice === 'yes') {
            Utils.show(identificationFields);
            this.userInfo.isAnonymous = false;
        } else {
            Utils.hide(identificationFields);
            this.userInfo.isAnonymous = true;
            this.userInfo.name = '';
            this.userInfo.position = '';
        }

        this.validateStartButton();
    }

    validateStartButton() {
        const startBtn = document.getElementById('startQuestionnaireBtn');
        if (!startBtn) return;

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

        const canStart = identificationSelected && identificationValid && this.currentQuestionnaire;
        startBtn.disabled = !canStart;
        startBtn.classList.toggle('disabled', !canStart);
    }

    startQuestionnaire() {
        if (!this.currentQuestionnaire) {
            Utils.toast.error('Nenhum questionário disponível no momento.');
            return;
        }

        Utils.hide(document.getElementById('identificationSection'));
        Utils.show(document.getElementById('questionnaireContent'));

        this.createProgressIndicator();
        this.showQuestion(0);
    }

    createProgressIndicator() {
        const progressIndicator = document.getElementById('progressIndicator');
        if (!progressIndicator || !this.currentQuestionnaire) return;

        progressIndicator.textContent = '';

        this.currentQuestionnaire.questions.forEach((_, index) => {
            const template = Utils.cloneTemplate('progressDotTemplate');
            if (template) {
                const dot = template.querySelector('.progress-dot');
                if (index === 0) dot.classList.add('active');
                progressIndicator.appendChild(template);
            } else {
                const dot = document.createElement('div');
                dot.className = 'progress-dot';
                if (index === 0) dot.classList.add('active');
                progressIndicator.appendChild(dot);
            }
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

        container.textContent = '';

        const questionElement = this.createQuestionElement(question);
        if (questionElement) {
            container.appendChild(questionElement);
        }

        this.updateNavigationButtons();
        this.updateProgressIndicator();

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    createQuestionElement(question) {
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
        const template = Utils.cloneTemplate('scaleQuestionTemplate');
        if (!template) return null;

        Utils.setText(template, '.question-text', question.text);
        const container = template.querySelector('.rating-container');

        for (let i = 1; i <= 10; i++) {
            const scaleTemplate = Utils.cloneTemplate('scaleButtonTemplate');
            if (!scaleTemplate) continue;

            const input = scaleTemplate.querySelector('.scale-input');
            const label = scaleTemplate.querySelector('.scale-label');

            if (input) {
                input.name = questionName;
                input.value = i;
                input.id = `${questionName}_${i}`;
                input.required = question.is_required;

                if (this.responses[questionName]?.value === i.toString()) {
                    input.checked = true;
                }

                input.addEventListener('change', () => {
                    this.responses[questionName] = {
                        question_id: question.id,
                        value: i.toString(),
                        numeric_value: i
                    };

                    setTimeout(() => {
                        if (this.currentQuestionIndex < this.currentQuestionnaire.questions.length - 1) {
                            this.nextQuestion();
                        }
                    }, 300);
                });
            }

            if (label) {
                label.setAttribute('for', `${questionName}_${i}`);
                label.textContent = i;
            }

            container.appendChild(scaleTemplate);
        }

        const labelsTemplate = Utils.cloneTemplate('scaleLabelsTemplate');
        if (labelsTemplate) {
            container.appendChild(labelsTemplate);
        } else {
            const labelsDiv = document.createElement('div');
            labelsDiv.className = 'scale-labels';

            const minLabel = document.createElement('span');
            minLabel.textContent = 'Muito Insatisfeito';

            const maxLabel = document.createElement('span');
            maxLabel.textContent = 'Muito Satisfeito';

            labelsDiv.appendChild(minLabel);
            labelsDiv.appendChild(maxLabel);
            container.appendChild(labelsDiv);
        }

        return template;
    }

    createMultipleChoiceQuestion(question, questionName) {
        const template = Utils.cloneTemplate('multipleChoiceQuestionTemplate');
        if (!template) return null;

        Utils.setText(template, '.question-text', question.text);
        const container = template.querySelector('.multiple-choice-container');

        const options = question.options?.options || ['Excelente', 'Bom', 'Regular', 'Ruim', 'Péssimo'];

        options.forEach((option, index) => {
            const optionTemplate = Utils.cloneTemplate('choiceOptionTemplate');
            if (!optionTemplate) return;

            const input = optionTemplate.querySelector('.form-check-input');
            const label = optionTemplate.querySelector('.form-check-label');

            if (input) {
                input.name = questionName;
                input.value = option;
                input.id = `${questionName}_${index}`;
                input.required = question.is_required;

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
            }

            if (label) {
                label.setAttribute('for', `${questionName}_${index}`);
                label.textContent = option;
            }

            container.appendChild(optionTemplate);
        });

        return template;
    }

    createBooleanQuestion(question, questionName) {
        const template = Utils.cloneTemplate('booleanQuestionTemplate');
        if (!template) return null;

        Utils.setText(template, '.question-text', question.text);

        const trueOption = template.querySelector('.true-option');
        const falseOption = template.querySelector('.false-option');
        const trueLabel = template.querySelector('.true-label');
        const falseLabel = template.querySelector('.false-label');

        if (trueOption) {
            trueOption.name = questionName;
            trueOption.id = `${questionName}_true`;
            trueOption.required = question.is_required;
        }

        if (falseOption) {
            falseOption.name = questionName;
            falseOption.id = `${questionName}_false`;
            falseOption.required = question.is_required;
        }

        if (trueLabel) trueLabel.setAttribute('for', `${questionName}_true`);
        if (falseLabel) falseLabel.setAttribute('for', `${questionName}_false`);

        if (this.responses[questionName]?.value === 'true' && trueOption) {
            trueOption.checked = true;
        } else if (this.responses[questionName]?.value === 'false' && falseOption) {
            falseOption.checked = true;
        }

        [trueOption, falseOption].filter(Boolean).forEach(option => {
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

        return template;
    }

    createTextQuestion(question, questionName) {
        const template = Utils.cloneTemplate('textQuestionTemplate');
        if (!template) return null;

        Utils.setText(template, '.question-text', question.text);

        const textarea = template.querySelector('.text-input');
        if (textarea) {
            textarea.name = questionName;
            textarea.id = questionName;
            textarea.required = question.is_required;

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
        }

        return template;
    }

    updateNavigationButtons() {
        const prevBtn = document.getElementById('prevQuestionBtn');
        const nextBtn = document.getElementById('nextQuestionBtn');
        const submitBtn = document.getElementById('submitQuestionnaireBtn');

        if (prevBtn) prevBtn.classList.toggle('hidden', this.currentQuestionIndex === 0);
        if (nextBtn) nextBtn.classList.toggle('hidden', this.currentQuestionIndex >= this.currentQuestionnaire.questions.length - 1);
        if (submitBtn) submitBtn.classList.toggle('hidden', this.currentQuestionIndex !== this.currentQuestionnaire.questions.length - 1);
    }

    previousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.showQuestion(this.currentQuestionIndex - 1);
        }
    }

    nextQuestion() {
        const currentQuestion = this.currentQuestionnaire.questions[this.currentQuestionIndex];
        const questionName = `question_${currentQuestion.id}`;

        if (currentQuestion.is_required && !this.responses[questionName]) {
            Utils.toast.warning('Por favor, responda a pergunta antes de continuar.');
            return;
        }

        if (this.currentQuestionIndex < this.currentQuestionnaire.questions.length - 1) {
            this.showQuestion(this.currentQuestionIndex + 1);
        }
    }

    async showSubmitConfirmation() {
        const unansweredRequired = this.currentQuestionnaire.questions.some(question => {
            const questionName = `question_${question.id}`;
            return question.is_required && !this.responses[questionName];
        });

        if (unansweredRequired) {
            Utils.toast.warning('Por favor, responda todas as perguntas obrigatórias antes de finalizar.');
            return;
        }

        const confirmed = await Utils.confirm('Confirmar Envio?', 'Tem certeza que deseja enviar suas respostas?');
        if (confirmed) {
            this.submitQuestionnaire();
        }
    }

    setupConfirmationModal() {
        const modal = document.getElementById('responseModal');
        const closeBtn = modal?.querySelector('.close-modal');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => Utils.hide(modal));
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    Utils.hide(modal);
                }
            });
        }
    }

    async submitQuestionnaire() {
        try {
            this.showLoading();

            Utils.hide(document.getElementById('responseModal'));

            const responseData = {
                questionnaire_id: this.currentQuestionnaire.id,
                location_id: this.currentQuestionnaire.location_id,
                respondent_name: this.userInfo.isAnonymous ? null : this.userInfo.name,
                respondent_position: this.userInfo.isAnonymous ? null : this.userInfo.position,
                is_anonymous: this.userInfo.isAnonymous,
                answers: Object.values(this.responses)
            };

            await publicApi.submitResponse(responseData);
            this.showThankYou();

        } catch (error) {
            console.error('Erro ao enviar resposta:', error);
            Utils.toast.error('Erro ao enviar suas respostas. Tente novamente.');
        } finally {
            this.hideLoading();
        }
    }

    showThankYou() {
        Utils.hide(document.querySelector('.questionnaire-container'));
        Utils.show(document.getElementById('thankyouContainer'));

        Utils.toast.success('Suas respostas foram enviadas com sucesso!');

        setTimeout(() => {
            window.location.reload();
        }, 5000);
    }

    showLoading() {
        Utils.show(document.getElementById('loadingOverlay'));
    }

    hideLoading() {
        Utils.hide(document.getElementById('loadingOverlay'));
    }
}

// ==================== INICIALIZAÇÃO ====================

document.addEventListener('DOMContentLoaded', () => {
    window.questionnaireManager = new QuestionnaireManager();
    console.log('Sistema de Questionários carregado!');
});
