/**
 * ResponseManager - Gerenciador de Respostas (Admin)
 * Visualização e gerenciamento de respostas submetidas
 */
class ResponseManager {
    constructor() {
        this.responses = [];
        this.pagination = { page: 1, limit: 20, total: 0 };
        this.filters = {};
    }

    async init() {
        if (!AuthManager.checkAuth()) return;

        await this.loadResponses();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Filtros
        const filterForm = document.getElementById('responses-filter-form');
        if (filterForm) {
            filterForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.applyFilters();
            });
        }

        // Paginação
        document.addEventListener('click', (e) => {
            if (e.target.matches('.pagination-btn')) {
                const page = parseInt(e.target.dataset.page);
                if (page) this.goToPage(page);
            }
        });
    }

    async loadResponses() {
        try {
            this.showLoading();

            const params = {
                ...this.filters,
                page: this.pagination.page,
                limit: this.pagination.limit
            };

            const result = await ResponsesAPI.getAll(params);
            this.responses = result.data;
            this.pagination = result.pagination;

            this.renderResponsesList();
            this.renderPagination();
        } catch (error) {
            console.error('Error loading responses:', error);
        } finally {
            this.hideLoading();
        }
    }

    renderResponsesList() {
        const container = document.getElementById('responses-list');
        if (!container) return;

        if (this.responses.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>Nenhuma resposta encontrada.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="responses-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Questionário</th>
                        <th>Local</th>
                        <th>Respondente</th>
                        <th>Data</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.responses.map(r => `
                        <tr data-id="${r.id}">
                            <td>#${r.id}</td>
                            <td>${r.questionnaire_name || '-'}</td>
                            <td>${r.municipality ? `${r.municipality}, ${r.state}` : '-'}</td>
                            <td>${r.is_anonymous ? '<em>Anônimo</em>' : (r.respondent_name || '-')}</td>
                            <td>${new Date(r.submitted_at).toLocaleString('pt-BR')}</td>
                            <td>
                                <button class="btn btn-sm btn-outline" onclick="responseManager.viewResponse(${r.id})">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="btn btn-sm btn-outline" onclick="responseManager.exportPDF(${r.id})">
                                    <i class="fas fa-file-pdf"></i>
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="responseManager.deleteResponse(${r.id})">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    renderPagination() {
        const container = document.getElementById('responses-pagination');
        if (!container) return;

        const { page, pages, total } = this.pagination;

        if (pages <= 1) {
            container.innerHTML = '';
            return;
        }

        let paginationHtml = `
            <div class="pagination-info">
                Mostrando ${((page - 1) * this.pagination.limit) + 1} - ${Math.min(page * this.pagination.limit, total)} de ${total}
            </div>
            <div class="pagination-buttons">
        `;

        // Botão anterior
        if (page > 1) {
            paginationHtml += `<button class="pagination-btn" data-page="${page - 1}"><i class="fas fa-chevron-left"></i></button>`;
        }

        // Páginas
        for (let i = 1; i <= pages; i++) {
            if (i === 1 || i === pages || (i >= page - 2 && i <= page + 2)) {
                paginationHtml += `<button class="pagination-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
            } else if (i === page - 3 || i === page + 3) {
                paginationHtml += '<span class="pagination-ellipsis">...</span>';
            }
        }

        // Botão próximo
        if (page < pages) {
            paginationHtml += `<button class="pagination-btn" data-page="${page + 1}"><i class="fas fa-chevron-right"></i></button>`;
        }

        paginationHtml += '</div>';
        container.innerHTML = paginationHtml;
    }

    applyFilters() {
        this.filters = {
            questionnaire_id: document.getElementById('filter-questionnaire')?.value || null,
            state: document.getElementById('filter-state')?.value || null,
            date_from: document.getElementById('filter-date-from')?.value || null,
            date_to: document.getElementById('filter-date-to')?.value || null
        };

        // Limpar valores vazios
        Object.keys(this.filters).forEach(key => {
            if (!this.filters[key]) delete this.filters[key];
        });

        this.pagination.page = 1;
        this.loadResponses();
    }

    clearFilters() {
        this.filters = {};
        document.getElementById('responses-filter-form')?.reset();
        this.pagination.page = 1;
        this.loadResponses();
    }

    goToPage(page) {
        this.pagination.page = page;
        this.loadResponses();
    }

    async viewResponse(id) {
        try {
            const response = await ResponsesAPI.getById(id);
            this.showResponseModal(response);
        } catch (error) {
            console.error('Error loading response:', error);
        }
    }

    showResponseModal(response) {
        const modal = document.getElementById('response-modal');
        if (!modal) return;

        const content = document.getElementById('response-modal-content');
        content.innerHTML = `
            <div class="response-detail">
                <div class="response-header">
                    <h3>Resposta #${response.id}</h3>
                    <span class="response-date">${new Date(response.submitted_at).toLocaleString('pt-BR')}</span>
                </div>

                <div class="response-info">
                    <div class="info-item">
                        <label>Questionário:</label>
                        <span>${response.questionnaire_name}</span>
                    </div>
                    <div class="info-item">
                        <label>Local:</label>
                        <span>${response.municipality ? `${response.municipality}, ${response.state}` : 'Não informado'}</span>
                    </div>
                    <div class="info-item">
                        <label>Respondente:</label>
                        <span>${response.is_anonymous ? 'Anônimo' : (response.respondent_name || 'Não informado')}</span>
                    </div>
                    ${response.respondent_position ? `
                    <div class="info-item">
                        <label>Cargo:</label>
                        <span>${response.respondent_position}</span>
                    </div>
                    ` : ''}
                </div>

                <div class="response-answers">
                    <h4>Respostas</h4>
                    ${response.answers.map(a => `
                        <div class="answer-item">
                            <p class="question-text">${a.question_text}</p>
                            <div class="answer-value ${a.question_type}">
                                ${this.formatAnswerValue(a)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
    }

    formatAnswerValue(answer) {
        if (answer.question_type === 'scale') {
            const value = parseFloat(answer.numeric_value);
            const color = value >= 7 ? 'green' : value >= 5 ? 'yellow' : 'red';
            return `<span class="scale-value ${color}">${value}/10</span>`;
        } else if (answer.question_type === 'boolean') {
            const isYes = answer.value === 'true' || answer.value === '1' || answer.value === 'sim';
            return `<span class="boolean-value ${isYes ? 'yes' : 'no'}">${isYes ? 'Sim' : 'Não'}</span>`;
        } else {
            return `<p class="text-value">"${answer.value || '-'}"</p>`;
        }
    }

    hideModal() {
        document.getElementById('response-modal')?.classList.add('hidden');
    }

    exportPDF(id) {
        const url = ExportAPI.getPDFUrl(id);
        window.open(url, '_blank');
    }

    async deleteResponse(id) {
        const result = await Swal.fire({
            title: 'Excluir resposta?',
            text: 'Esta ação não pode ser desfeita.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonText: 'Cancelar',
            confirmButtonText: 'Excluir'
        });

        if (result.isConfirmed) {
            try {
                await ResponsesAPI.delete(id);
                await this.loadResponses();
                Swal.fire('Excluída!', 'Resposta excluída com sucesso.', 'success');
            } catch (error) {
                Swal.fire('Erro', 'Erro ao excluir resposta', 'error');
            }
        }
    }

    showLoading() {
        const loader = document.getElementById('responses-loader');
        if (loader) loader.classList.remove('hidden');
    }

    hideLoading() {
        const loader = document.getElementById('responses-loader');
        if (loader) loader.classList.add('hidden');
    }
}

// Instância global
window.responseManager = new ResponseManager();
