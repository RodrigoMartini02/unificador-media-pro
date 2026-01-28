/**
 * QuestionnaireManager - Gerenciador de Questionários (Admin)
 * CRUD de questionários e perguntas
 */
class QuestionnaireManager {
    constructor() {
        this.questionnaires = [];
        this.currentQuestionnaire = null;
    }

    async init() {
        if (!AuthManager.checkAuth()) return;

        await this.loadQuestionnaires();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Botão de novo questionário
        const newBtn = document.getElementById('new-questionnaire-btn');
        if (newBtn) {
            newBtn.addEventListener('click', () => this.showCreateModal());
        }

        // Form de criação
        const createForm = document.getElementById('questionnaire-form');
        if (createForm) {
            createForm.addEventListener('submit', (e) => this.handleCreateSubmit(e));
        }
    }

    async loadQuestionnaires() {
        try {
            this.questionnaires = await QuestionnairesAPI.getAll();
            this.renderQuestionnaireList();
        } catch (error) {
            console.error('Error loading questionnaires:', error);
        }
    }

    renderQuestionnaireList() {
        const container = document.getElementById('questionnaires-list');
        if (!container) return;

        if (this.questionnaires.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>Nenhum questionário cadastrado.</p>
                    <button class="btn btn-primary" onclick="questionnaireManager.showCreateModal()">
                        Criar Questionário
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.questionnaires.map(q => `
            <div class="questionnaire-card ${q.is_active ? '' : 'inactive'}" data-id="${q.id}">
                <div class="card-header">
                    <h3>${q.name}</h3>
                    <span class="badge ${q.is_active ? 'badge-success' : 'badge-secondary'}">
                        ${q.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                </div>
                <p class="card-description">${q.description || 'Sem descrição'}</p>
                <div class="card-meta">
                    <span>Criado em: ${new Date(q.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
                <div class="card-actions">
                    <button class="btn btn-sm btn-outline" onclick="questionnaireManager.viewQuestionnaire(${q.id})">
                        <i class="fas fa-eye"></i> Ver
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="questionnaireManager.editQuestionnaire(${q.id})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="questionnaireManager.toggleActive(${q.id})">
                        <i class="fas fa-${q.is_active ? 'pause' : 'play'}"></i>
                        ${q.is_active ? 'Desativar' : 'Ativar'}
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="questionnaireManager.deleteQuestionnaire(${q.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    showCreateModal() {
        const modal = document.getElementById('questionnaire-modal');
        if (modal) {
            modal.classList.remove('hidden');
            document.getElementById('modal-title').textContent = 'Novo Questionário';
            document.getElementById('questionnaire-form').reset();
            this.currentQuestionnaire = null;
            this.clearQuestionsList();
        }
    }

    hideModal() {
        const modal = document.getElementById('questionnaire-modal');
        if (modal) modal.classList.add('hidden');
    }

    async handleCreateSubmit(e) {
        e.preventDefault();

        const formData = {
            name: document.getElementById('q-name').value,
            description: document.getElementById('q-description').value,
            is_active: document.getElementById('q-active').checked,
            questions: this.getQuestionsFromForm()
        };

        try {
            if (this.currentQuestionnaire) {
                await QuestionnairesAPI.update(this.currentQuestionnaire.id, formData);
            } else {
                await QuestionnairesAPI.create(formData);
            }

            this.hideModal();
            await this.loadQuestionnaires();

            if (window.Swal) {
                Swal.fire('Sucesso', 'Questionário salvo com sucesso!', 'success');
            }
        } catch (error) {
            console.error('Error saving questionnaire:', error);
            if (window.Swal) {
                Swal.fire('Erro', 'Erro ao salvar questionário', 'error');
            }
        }
    }

    getQuestionsFromForm() {
        const questionItems = document.querySelectorAll('.question-item');
        const questions = [];

        questionItems.forEach((item, index) => {
            questions.push({
                text: item.querySelector('.question-text').value,
                type: item.querySelector('.question-type').value,
                is_required: item.querySelector('.question-required').checked,
                options: {}
            });
        });

        return questions;
    }

    addQuestionToForm() {
        const container = document.getElementById('questions-list');
        const index = container.children.length;

        const questionHtml = `
            <div class="question-item" data-index="${index}">
                <div class="question-header">
                    <span class="question-number">${index + 1}</span>
                    <button type="button" class="btn-remove" onclick="questionnaireManager.removeQuestion(this)">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="form-group">
                    <label>Texto da Pergunta</label>
                    <textarea class="question-text" required rows="2"></textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Tipo</label>
                        <select class="question-type">
                            <option value="scale">Escala (1-10)</option>
                            <option value="boolean">Sim/Não</option>
                            <option value="text">Texto Livre</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" class="question-required" checked>
                            Obrigatória
                        </label>
                    </div>
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', questionHtml);
    }

    removeQuestion(btn) {
        btn.closest('.question-item').remove();
        this.renumberQuestions();
    }

    renumberQuestions() {
        document.querySelectorAll('.question-item').forEach((item, index) => {
            item.querySelector('.question-number').textContent = index + 1;
            item.dataset.index = index;
        });
    }

    clearQuestionsList() {
        const container = document.getElementById('questions-list');
        if (container) container.innerHTML = '';
    }

    async viewQuestionnaire(id) {
        try {
            const questionnaire = await QuestionnairesAPI.getById(id);
            this.showViewModal(questionnaire);
        } catch (error) {
            console.error('Error loading questionnaire:', error);
        }
    }

    showViewModal(questionnaire) {
        const modal = document.getElementById('view-questionnaire-modal');
        if (!modal) return;

        document.getElementById('view-q-name').textContent = questionnaire.name;
        document.getElementById('view-q-description').textContent = questionnaire.description || 'Sem descrição';

        const questionsList = document.getElementById('view-questions-list');
        questionsList.innerHTML = questionnaire.questions.map((q, i) => `
            <div class="view-question-item">
                <span class="question-number">${i + 1}</span>
                <div class="question-content">
                    <p class="question-text">${q.text}</p>
                    <span class="question-type-badge">${this.getTypeLabel(q.type)}</span>
                    ${q.is_required ? '<span class="required-badge">Obrigatória</span>' : ''}
                </div>
            </div>
        `).join('');

        modal.classList.remove('hidden');
    }

    getTypeLabel(type) {
        const labels = {
            scale: 'Escala (1-10)',
            boolean: 'Sim/Não',
            text: 'Texto Livre',
            multiple: 'Múltipla Escolha'
        };
        return labels[type] || type;
    }

    async editQuestionnaire(id) {
        try {
            this.currentQuestionnaire = await QuestionnairesAPI.getById(id);
            this.showEditModal();
        } catch (error) {
            console.error('Error loading questionnaire:', error);
        }
    }

    showEditModal() {
        const modal = document.getElementById('questionnaire-modal');
        if (!modal || !this.currentQuestionnaire) return;

        document.getElementById('modal-title').textContent = 'Editar Questionário';
        document.getElementById('q-name').value = this.currentQuestionnaire.name;
        document.getElementById('q-description').value = this.currentQuestionnaire.description || '';
        document.getElementById('q-active').checked = this.currentQuestionnaire.is_active;

        // Carregar perguntas existentes
        this.clearQuestionsList();
        this.currentQuestionnaire.questions.forEach(q => {
            this.addQuestionToForm();
            const lastItem = document.querySelector('.question-item:last-child');
            lastItem.querySelector('.question-text').value = q.text;
            lastItem.querySelector('.question-type').value = q.type;
            lastItem.querySelector('.question-required').checked = q.is_required;
        });

        modal.classList.remove('hidden');
    }

    async toggleActive(id) {
        try {
            await QuestionnairesAPI.toggleActive(id);
            await this.loadQuestionnaires();
        } catch (error) {
            console.error('Error toggling questionnaire:', error);
        }
    }

    async deleteQuestionnaire(id) {
        const result = await Swal.fire({
            title: 'Confirmar exclusão?',
            text: 'Esta ação não pode ser desfeita. Todas as respostas serão mantidas.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonText: 'Cancelar',
            confirmButtonText: 'Sim, excluir'
        });

        if (result.isConfirmed) {
            try {
                await QuestionnairesAPI.delete(id);
                await this.loadQuestionnaires();
                Swal.fire('Excluído!', 'Questionário excluído com sucesso.', 'success');
            } catch (error) {
                console.error('Error deleting questionnaire:', error);
                Swal.fire('Erro', 'Erro ao excluir questionário', 'error');
            }
        }
    }
}

// Instância global
window.questionnaireManager = new QuestionnaireManager();
