/**
 * Sistema de Questionários - Quest.js
 * Gerencia apresentação de questionários, navegação entre perguntas e envio de respostas
 * @version 1.0.0
 * @author Desenvolvedor JavaScript & Data Scientist
 */

// ==================== CONFIGURAÇÕES GLOBAIS ====================
const QUEST_CONFIG = {
    STORAGE_KEYS: {
        RESPOSTAS: 'pesquisa_respostas',
        QUESTIONARIOS: 'pesquisa_questionarios',
        LOCAIS: 'pesquisa_locais',
        CURRENT_SESSION: 'quest_current_session'
    },
    QUESTION_TYPES: {
        LIKERT: 'likert',
        MULTIPLE_CHOICE: 'multiple_choice',
        BOOLEAN: 'boolean',
        TEXT: 'text',
        SCALE: 'scale'
    }
};

// ==================== GERENCIADOR DE QUESTIONÁRIOS ====================
class QuestionnaireManager {
    constructor() {
        this.currentQuestionnaire = null;
        this.currentQuestionIndex = 0;
        this.responses = {};
        this.userInfo = {};
        this.isIdentified = false;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadAvailableQuestionnaires();
        this.setCurrentDate();
        this.loadLocationInfo();
    }

    setupEventListeners() {
        // Identificação
        document.querySelectorAll('input[name="identify"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.handleIdentificationChoice(e.target.value);
            });
        });

        // Campos de identificação
        const nameField = document.getElementById('name');
        const positionField = document.getElementById('position');
        
        if (nameField && positionField) {
            nameField.addEventListener('input', () => this.validateIdentificationFields());
            positionField.addEventListener('input', () => this.validateIdentificationFields());
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

    loadAvailableQuestionnaires() {
        try {
            const questionarios = JSON.parse(localStorage.getItem(QUEST_CONFIG.STORAGE_KEYS.QUESTIONARIOS) || '[]');
            
            if (questionarios.length === 0) {
                this.showNoQuestionnairesMessage();
                return;
            }

            // Por simplicidade, carrega o primeiro questionário disponível
            // Em um cenário real, você pode implementar seleção de questionário
            this.currentQuestionnaire = questionarios[0];
            this.displayQuestionnaireInfo();
            
        } catch (error) {
            console.error('Erro ao carregar questionários:', error);
            this.showNoQuestionnairesMessage();
        }
    }

    showNoQuestionnairesMessage() {
        const subtitle = document.getElementById('questionnaireSubtitle');
        const noTemplateMsg = document.getElementById('noTemplateMessage');
        
        if (subtitle) {
            subtitle.textContent = 'Nenhum Questionário Disponível';
        }
        
        if (noTemplateMsg) {
            noTemplateMsg.classList.remove('hidden');
        }
    }

    displayQuestionnaireInfo() {
        if (!this.currentQuestionnaire) return;

        const subtitle = document.getElementById('questionnaireSubtitle');
        const questionnaireInfo = document.getElementById('questionnaireInfo');

        if (subtitle) {
            subtitle.textContent = this.currentQuestionnaire.nome;
        }

        if (questionnaireInfo) {
            questionnaireInfo.textContent = `${this.currentQuestionnaire.perguntas.length} perguntas`;
            questionnaireInfo.classList.remove('hidden');
        }
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

    loadLocationInfo() {
        try {
            const locais = JSON.parse(localStorage.getItem(QUEST_CONFIG.STORAGE_KEYS.LOCAIS) || '[]');
            const locationInfo = document.getElementById('locationInfo');
            
            if (locationInfo && locais.length > 0) {
                // Por simplicidade, usa o primeiro local disponível
                // Em um cenário real, você pode implementar seleção de local
                const local = locais[0];
                locationInfo.textContent = `${local.municipio}, ${local.estado}`;
            }
        } catch (error) {
            console.error('Erro ao carregar informações de localização:', error);
        }
    }

    handleIdentificationChoice(choice) {
        const identificationFields = document.getElementById('identificationFields');
        
        if (choice === 'yes') {
            identificationFields.classList.remove('hidden');
            this.isIdentified = true;
        } else {
            identificationFields.classList.add('hidden');
            this.isIdentified = false;
            this.userInfo = {
                nome: 'Anônimo',
                cargo: 'Não informado'
            };
            this.enableStartButton();
        }
    }

    validateIdentificationFields() {
        const nameField = document.getElementById('name');
        const positionField = document.getElementById('position');
        
        if (this.isIdentified && nameField && positionField) {
            const isValid = nameField.value.trim().length > 0 && positionField.value.trim().length > 0;
            
            if (isValid) {
                this.userInfo = {
                    nome: nameField.value.trim(),
                    cargo: positionField.value.trim()
                };
                this.enableStartButton();
            } else {
                this.disableStartButton();
            }
        }
    }

    enableStartButton() {
        const startBtn = document.getElementById('startQuestionnaireBtn');
        if (startBtn) {
            startBtn.classList.remove('disabled');
            startBtn.disabled = false;
        }
    }

    disableStartButton() {
        const startBtn = document.getElementById('startQuestionnaireBtn');
        if (startBtn) {
            startBtn.classList.add('disabled');
            startBtn.disabled = true;
        }
    }

    startQuestionnaire() {
        if (!this.currentQuestionnaire) {
            alert('Nenhum questionário disponível.');
            return;
        }

        // Ocultar seção de identificação
        const identificationSection = document.querySelector('.identification-section');
        if (identificationSection) {
            identificationSection.style.display = 'none';
        }

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
        
        this.currentQuestionnaire.perguntas.forEach((_, index) => {
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
        if (!this.currentQuestionnaire || questionIndex >= this.currentQuestionnaire.perguntas.length) {
            return;
        }

        this.currentQuestionIndex = questionIndex;
        const question = this.currentQuestionnaire.perguntas[questionIndex];
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
        const questionName = `question_${questionIndex}`;
        
        switch (question.tipo) {
            case QUEST_CONFIG.QUESTION_TYPES.LIKERT:
            case QUEST_CONFIG.QUESTION_TYPES.SCALE:
                return this.createScaleQuestion(question, questionName);
            
            case QUEST_CONFIG.QUESTION_TYPES.MULTIPLE_CHOICE:
                return this.createMultipleChoiceQuestion(question, questionName);
            
            case QUEST_CONFIG.QUESTION_TYPES.BOOLEAN:
                return this.createBooleanQuestion(question, questionName);
            
            case QUEST_CONFIG.QUESTION_TYPES.TEXT:
                return this.createTextQuestion(question, questionName);
            
            default:
                return this.createScaleQuestion(question, questionName);
        }
    }

    createScaleQuestion(question, questionName) {
        const template = document.getElementById('scaleQuestionTemplate');
        const element = template.content.cloneNode(true);
        
        element.querySelector('.question-text').textContent = question.texto;
        const container = element.querySelector('.rating-container');
        
        // Criar escala de 1 a 5
        for (let i = 1; i <= 5; i++) {
            const scaleTemplate = document.getElementById('scaleButtonTemplate');
            const scaleElement = scaleTemplate.content.cloneNode(true);
            
            const input = scaleElement.querySelector('.scale-input');
            const label = scaleElement.querySelector('.scale-label');
            
            input.name = questionName;
            input.value = i;
            input.id = `${questionName}_${i}`;
            input.required = question.obrigatoria;
            
            label.setAttribute('for', `${questionName}_${i}`);
            label.textContent = i;
            
            // Adicionar evento para navegação automática
            input.addEventListener('change', () => {
                this.responses[questionName] = {
                    pergunta: question.texto,
                    valor: i.toString(),
                    tipo: question.tipo
                };
                
                // Auto-avançar após uma pausa
                setTimeout(() => {
                    if (this.currentQuestionIndex < this.currentQuestionnaire.perguntas.length - 1) {
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
        
        element.querySelector('.question-text').textContent = question.texto;
        const container = element.querySelector('.multiple-choice-container');
        
        // Opções padrão se não estiverem definidas
        const opcoes = question.opcoes || ['Excelente', 'Bom', 'Regular', 'Ruim', 'Péssimo'];
        
        opcoes.forEach((opcao, index) => {
            const optionTemplate = document.getElementById('choiceOptionTemplate');
            const optionElement = optionTemplate.content.cloneNode(true);
            
            const input = optionElement.querySelector('.form-check-input');
            const label = optionElement.querySelector('.form-check-label');
            
            input.name = questionName;
            input.value = opcao;
            input.id = `${questionName}_${index}`;
            input.required = question.obrigatoria;
            
            label.setAttribute('for', `${questionName}_${index}`);
            label.textContent = opcao;
            
            input.addEventListener('change', () => {
                this.responses[questionName] = {
                    pergunta: question.texto,
                    valor: opcao,
                    tipo: question.tipo
                };
                
                // Auto-avançar após uma pausa
                setTimeout(() => {
                    if (this.currentQuestionIndex < this.currentQuestionnaire.perguntas.length - 1) {
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
        
        element.querySelector('.question-text').textContent = question.texto;
        
        const trueOption = element.querySelector('.true-option');
        const falseOption = element.querySelector('.false-option');
        const trueLabel = element.querySelector('.true-label');
        const falseLabel = element.querySelector('.false-label');
        
        trueOption.name = questionName;
        falseOption.name = questionName;
        trueOption.id = `${questionName}_true`;
        falseOption.id = `${questionName}_false`;
        trueOption.required = question.obrigatoria;
        falseOption.required = question.obrigatoria;
        
        trueLabel.setAttribute('for', `${questionName}_true`);
        falseLabel.setAttribute('for', `${questionName}_false`);
        
        [trueOption, falseOption].forEach(option => {
            option.addEventListener('change', (e) => {
                this.responses[questionName] = {
                    pergunta: question.texto,
                    valor: e.target.value === 'true' ? 'Sim' : 'Não',
                    tipo: question.tipo
                };
                
                // Auto-avançar após uma pausa
                setTimeout(() => {
                    if (this.currentQuestionIndex < this.currentQuestionnaire.perguntas.length - 1) {
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
        
        element.querySelector('.question-text').textContent = question.texto;
        
        const textarea = element.querySelector('.text-input');
        textarea.name = questionName;
        textarea.id = questionName;
        textarea.required = question.obrigatoria;
        
        textarea.addEventListener('input', (e) => {
            this.responses[questionName] = {
                pergunta: question.texto,
                valor: e.target.value,
                tipo: question.tipo
            };
        });
        
        return element;
    }

    updateNavigationButtons() {
        const prevBtn = document.getElementById('prevQuestionBtn');
        const nextBtn = document.getElementById('nextQuestionBtn');
        const submitBtn = document.getElementById('submitQuestionnaireBtn');
        
        // Botão anterior
        if (prevBtn) {
            if (this.currentQuestionIndex > 0) {
                prevBtn.classList.remove('hidden');
            } else {
                prevBtn.classList.add('hidden');
            }
        }
        
        // Botão próximo
        if (nextBtn) {
            if (this.currentQuestionIndex < this.currentQuestionnaire.perguntas.length - 1) {
                nextBtn.classList.remove('hidden');
            } else {
                nextBtn.classList.add('hidden');
            }
        }
        
        // Botão finalizar
        if (submitBtn) {
            if (this.currentQuestionIndex === this.currentQuestionnaire.perguntas.length - 1) {
                submitBtn.classList.remove('hidden');
            } else {
                submitBtn.classList.add('hidden');
            }
        }
    }

    previousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.showQuestion(this.currentQuestionIndex - 1);
        }
    }

    nextQuestion() {
        const currentQuestion = this.currentQuestionnaire.perguntas[this.currentQuestionIndex];
        const questionName = `question_${this.currentQuestionIndex}`;
        
        // Verificar se a pergunta obrigatória foi respondida
        if (currentQuestion.obrigatoria && !this.responses[questionName]) {
            alert('Por favor, responda a pergunta antes de continuar.');
            return;
        }
        
        if (this.currentQuestionIndex < this.currentQuestionnaire.perguntas.length - 1) {
            this.showQuestion(this.currentQuestionIndex + 1);
        }
    }

    showSubmitConfirmation() {
        // Verificar se todas as perguntas obrigatórias foram respondidas
        const unansweredRequired = this.currentQuestionnaire.perguntas.some((question, index) => {
            const questionName = `question_${index}`;
            return question.obrigatoria && !this.responses[questionName];
        });
        
        if (unansweredRequired) {
            alert('Por favor, responda todas as perguntas obrigatórias antes de finalizar.');
            return;
        }
        
        const modal = document.getElementById('responseModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    setupConfirmationModal() {
        const modal = document.getElementById('responseModal');
        const confirmBtn = document.getElementById('confirmSubmitBtn');
        const cancelBtn = document.getElementById('cancelSubmitBtn');
        const closeBtn = modal?.querySelector('.close-modal');
        
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                this.submitQuestionnaire();
            });
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }
        
        // Fechar modal clicando fora
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });
        }
    }

    submitQuestionnaire() {
        try {
            // Obter informações de localização
            const locais = JSON.parse(localStorage.getItem(QUEST_CONFIG.STORAGE_KEYS.LOCAIS) || '[]');
            const local = locais[0] || { estado: 'N/A', municipio: 'N/A' };
            
            // Preparar dados da resposta
            const respostaData = {
                id: Date.now().toString(),
                nome: this.userInfo.nome,
                cargo: this.userInfo.cargo,
                estado: local.estado,
                municipio: local.municipio,
                questionario: this.currentQuestionnaire.nome,
                data: new Date().toISOString(),
                respostas: Object.values(this.responses)
            };
            
            // Salvar no localStorage
            const respostasExistentes = JSON.parse(localStorage.getItem(QUEST_CONFIG.STORAGE_KEYS.RESPOSTAS) || '[]');
            respostasExistentes.push(respostaData);
            localStorage.setItem(QUEST_CONFIG.STORAGE_KEYS.RESPOSTAS, JSON.stringify(respostasExistentes));
            
            // Fechar modal
            const modal = document.getElementById('responseModal');
            if (modal) {
                modal.classList.add('hidden');
            }
            
            // Mostrar agradecimento
            this.showThankYou();
            
        } catch (error) {
            console.error('Erro ao salvar resposta:', error);
            alert('Erro ao salvar suas respostas. Tente novamente.');
        }
    }

    showThankYou() {
        // Ocultar questionário
        const questionnaireContainer = document.querySelector('.questionnaire-container');
        if (questionnaireContainer) {
            questionnaireContainer.style.display = 'none';
        }
        
        // Mostrar agradecimento
        const thankYouContainer = document.getElementById('thankyouContainer');
        if (thankYouContainer) {
            thankYouContainer.classList.remove('hidden');
        }
        
        // Redirecionar após alguns segundos
        setTimeout(() => {
            window.location.reload();
        }, 5000);
    }
}

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar gerenciador de questionários
    window.questionnaireManager = new QuestionnaireManager();
    
    console.log('🚀 Sistema de Questionários carregado com sucesso!');
});

// ==================== FUNÇÕES UTILITÁRIAS ====================
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('pt-BR');
}

function generateQuestionId() {
    return 'question_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Exportar para uso global
window.QUEST_CONFIG = QUEST_CONFIG;
window.formatDate = formatDate;
window.generateQuestionId = generateQuestionId;