/**
 * PublicQuestionnaireForm - Formulário Público de Questionário
 * Gerencia o formulário que os usuários externos usam para responder
 */
class PublicQuestionnaireForm {
    constructor() {
        this.questionnaire = null;
        this.currentQuestionIndex = 0;
        this.answers = {};
        this.identification = {
            name: '',
            position: '',
            is_anonymous: false
        };
        this.location = {
            state: null,
            municipality_id: null
        };
    }

    async init() {
        // Carregar localizações
        await this.loadLocations();

        // Setup eventos
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Seleção de estado
        const stateSelect = document.getElementById('quest-state');
        if (stateSelect) {
            stateSelect.addEventListener('change', (e) => this.onStateChange(e.target.value));
        }

        // Botão iniciar questionário
        const startBtn = document.getElementById('start-questionnaire');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startQuestionnaire());
        }

        // Navegação entre perguntas
        document.getElementById('prev-question')?.addEventListener('click', () => this.prevQuestion());
        document.getElementById('next-question')?.addEventListener('click', () => this.nextQuestion());
        document.getElementById('submit-questionnaire')?.addEventListener('click', () => this.submitQuestionnaire());

        // Checkbox anônimo
        const anonCheckbox = document.getElementById('quest-anonymous');
        if (anonCheckbox) {
            anonCheckbox.addEventListener('change', (e) => {
                this.identification.is_anonymous = e.target.checked;
                const nameFields = document.querySelectorAll('.identification-fields');
                nameFields.forEach(el => {
                    el.style.display = e.target.checked ? 'none' : 'block';
                });
            });
        }
    }

    async loadLocations() {
        try {
            const states = await LocationsAPI.getPublicStates();
            const stateSelect = document.getElementById('quest-state');

            if (stateSelect) {
                stateSelect.innerHTML = '<option value="">Selecione o Estado</option>';
                states.forEach(state => {
                    const option = document.createElement('option');
                    option.value = state;
                    option.textContent = state;
                    stateSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading locations:', error);
        }
    }

    async onStateChange(state) {
        const municipalitySelect = document.getElementById('quest-municipality');
        if (!municipalitySelect) return;

        municipalitySelect.innerHTML = '<option value="">Selecione o Município</option>';
        this.location.state = state;

        if (state) {
            try {
                const municipalities = await LocationsAPI.getPublicMunicipalities(state);
                municipalities.forEach(m => {
                    const option = document.createElement('option');
                    option.value = m.id;
                    option.textContent = m.municipality;
                    municipalitySelect.appendChild(option);
                });
            } catch (error) {
                console.error('Error loading municipalities:', error);
            }
        }
    }

    async startQuestionnaire() {
        // Validar localização
        const municipalityId = document.getElementById('quest-municipality')?.value;
        if (!municipalityId) {
            Swal.fire('Atenção', 'Selecione o estado e município', 'warning');
            return;
        }

        this.location.municipality_id = parseInt(municipalityId);

        // Coletar identificação
        this.identification.name = document.getElementById('quest-name')?.value || '';
        this.identification.position = document.getElementById('quest-position')?.value || '';
        this.identification.is_anonymous = document.getElementById('quest-anonymous')?.checked || false;

        // Carregar questionário
        try {
            this.showLoading();
            this.questionnaire = await QuestionnairesAPI.getPublicQuestionnaire(municipalityId);

            if (!this.questionnaire || !this.questionnaire.questions?.length) {
                Swal.fire('Atenção', 'Nenhum questionário disponível no momento', 'info');
                return;
            }

            // Mostrar seção de perguntas
            this.showQuestionsSection();
            this.renderCurrentQuestion();

        } catch (error) {
            console.error('Error loading questionnaire:', error);
            Swal.fire('Erro', 'Erro ao carregar questionário', 'error');
        } finally {
            this.hideLoading();
        }
    }

    showQuestionsSection() {
        document.getElementById('identification-section')?.classList.add('hidden');
        document.getElementById('questions-section')?.classList.remove('hidden');

        // Atualizar info do questionário
        document.getElementById('questionnaire-title').textContent = this.questionnaire.name;
        document.getElementById('total-questions').textContent = this.questionnaire.questions.length;
    }

    renderCurrentQuestion() {
        const question = this.questionnaire.questions[this.currentQuestionIndex];
        const container = document.getElementById('question-container');

        if (!container || !question) return;

        // Atualizar progresso
        document.getElementById('current-question-number').textContent = this.currentQuestionIndex + 1;
        this.updateProgressBar();

        // Renderizar pergunta baseado no tipo
        let questionHtml = `
            <div class="question-card">
                <h3 class="question-text">${question.text}</h3>
                ${question.is_required ? '<span class="required-indicator">*Obrigatória</span>' : ''}
                <div class="question-input">
                    ${this.renderQuestionInput(question)}
                </div>
            </div>
        `;

        container.innerHTML = questionHtml;

        // Restaurar resposta anterior se existir
        this.restorePreviousAnswer(question);

        // Atualizar botões de navegação
        this.updateNavigationButtons();
    }

    renderQuestionInput(question) {
        const savedValue = this.answers[question.id]?.value;

        switch (question.type) {
            case 'scale':
                const min = question.options?.min || 1;
                const max = question.options?.max || 10;
                let scaleHtml = '<div class="scale-input">';
                for (let i = min; i <= max; i++) {
                    scaleHtml += `
                        <button type="button" class="scale-btn ${savedValue == i ? 'selected' : ''}"
                            data-value="${i}" onclick="publicForm.selectScale(${question.id}, ${i})">
                            ${i}
                        </button>
                    `;
                }
                scaleHtml += '</div>';
                scaleHtml += '<div class="scale-labels"><span>Muito Insatisfeito</span><span>Muito Satisfeito</span></div>';
                return scaleHtml;

            case 'boolean':
                return `
                    <div class="boolean-input">
                        <button type="button" class="boolean-btn ${savedValue === 'true' ? 'selected' : ''}"
                            data-value="true" onclick="publicForm.selectBoolean(${question.id}, 'true')">
                            <i class="fas fa-check"></i> Sim
                        </button>
                        <button type="button" class="boolean-btn ${savedValue === 'false' ? 'selected' : ''}"
                            data-value="false" onclick="publicForm.selectBoolean(${question.id}, 'false')">
                            <i class="fas fa-times"></i> Não
                        </button>
                    </div>
                `;

            case 'text':
                return `
                    <textarea class="text-input" id="text-answer-${question.id}"
                        placeholder="Digite sua resposta..."
                        rows="4"
                        oninput="publicForm.saveTextAnswer(${question.id})">${savedValue || ''}</textarea>
                `;

            default:
                return '<p>Tipo de pergunta não suportado</p>';
        }
    }

    restorePreviousAnswer(question) {
        const saved = this.answers[question.id];
        if (!saved) return;

        if (question.type === 'scale') {
            const btn = document.querySelector(`.scale-btn[data-value="${saved.value}"]`);
            if (btn) btn.classList.add('selected');
        } else if (question.type === 'boolean') {
            const btn = document.querySelector(`.boolean-btn[data-value="${saved.value}"]`);
            if (btn) btn.classList.add('selected');
        }
    }

    selectScale(questionId, value) {
        document.querySelectorAll('.scale-btn').forEach(btn => btn.classList.remove('selected'));
        document.querySelector(`.scale-btn[data-value="${value}"]`)?.classList.add('selected');

        this.answers[questionId] = {
            question_id: questionId,
            value: value.toString(),
            numeric_value: value
        };
    }

    selectBoolean(questionId, value) {
        document.querySelectorAll('.boolean-btn').forEach(btn => btn.classList.remove('selected'));
        document.querySelector(`.boolean-btn[data-value="${value}"]`)?.classList.add('selected');

        this.answers[questionId] = {
            question_id: questionId,
            value: value,
            numeric_value: null
        };
    }

    saveTextAnswer(questionId) {
        const textarea = document.getElementById(`text-answer-${questionId}`);
        if (textarea) {
            this.answers[questionId] = {
                question_id: questionId,
                value: textarea.value,
                numeric_value: null
            };
        }
    }

    updateProgressBar() {
        const progress = ((this.currentQuestionIndex + 1) / this.questionnaire.questions.length) * 100;
        const progressBar = document.getElementById('progress-bar');
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
    }

    updateNavigationButtons() {
        const prevBtn = document.getElementById('prev-question');
        const nextBtn = document.getElementById('next-question');
        const submitBtn = document.getElementById('submit-questionnaire');

        if (prevBtn) {
            prevBtn.style.display = this.currentQuestionIndex > 0 ? 'block' : 'none';
        }

        const isLast = this.currentQuestionIndex === this.questionnaire.questions.length - 1;
        if (nextBtn) nextBtn.style.display = isLast ? 'none' : 'block';
        if (submitBtn) submitBtn.style.display = isLast ? 'block' : 'none';
    }

    prevQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.renderCurrentQuestion();
        }
    }

    nextQuestion() {
        const currentQuestion = this.questionnaire.questions[this.currentQuestionIndex];

        // Validar resposta obrigatória
        if (currentQuestion.is_required && !this.answers[currentQuestion.id]) {
            Swal.fire('Atenção', 'Esta pergunta é obrigatória', 'warning');
            return;
        }

        if (this.currentQuestionIndex < this.questionnaire.questions.length - 1) {
            this.currentQuestionIndex++;
            this.renderCurrentQuestion();
        }
    }

    async submitQuestionnaire() {
        const currentQuestion = this.questionnaire.questions[this.currentQuestionIndex];

        // Validar última pergunta
        if (currentQuestion.is_required && !this.answers[currentQuestion.id]) {
            Swal.fire('Atenção', 'Esta pergunta é obrigatória', 'warning');
            return;
        }

        // Confirmar envio
        const confirm = await Swal.fire({
            title: 'Enviar Respostas?',
            text: 'Após o envio, não será possível alterar as respostas.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Enviar',
            cancelButtonText: 'Revisar'
        });

        if (!confirm.isConfirmed) return;

        try {
            this.showLoading();

            const data = {
                questionnaire_id: this.questionnaire.id,
                location_id: this.location.municipality_id,
                respondent_name: this.identification.is_anonymous ? null : this.identification.name,
                respondent_position: this.identification.is_anonymous ? null : this.identification.position,
                is_anonymous: this.identification.is_anonymous,
                answers: Object.values(this.answers)
            };

            await ResponsesAPI.submit(data);

            // Mostrar tela de agradecimento
            this.showThankYouScreen();

        } catch (error) {
            console.error('Error submitting questionnaire:', error);
            Swal.fire('Erro', 'Erro ao enviar respostas. Tente novamente.', 'error');
        } finally {
            this.hideLoading();
        }
    }

    showThankYouScreen() {
        document.getElementById('questions-section')?.classList.add('hidden');
        document.getElementById('thank-you-section')?.classList.remove('hidden');
    }

    showLoading() {
        document.getElementById('quest-loader')?.classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('quest-loader')?.classList.add('hidden');
    }

    restart() {
        this.currentQuestionIndex = 0;
        this.answers = {};
        this.identification = { name: '', position: '', is_anonymous: false };
        this.location = { state: null, municipality_id: null };
        this.questionnaire = null;

        document.getElementById('thank-you-section')?.classList.add('hidden');
        document.getElementById('questions-section')?.classList.add('hidden');
        document.getElementById('identification-section')?.classList.remove('hidden');

        // Limpar formulário
        document.getElementById('quest-form')?.reset();
    }
}

// Instância global
window.publicForm = new PublicQuestionnaireForm();
