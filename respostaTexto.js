// ========== CONFIGURAÇÕES ==========

const TEXT_RESPONSES_CONFIG = {
    STORAGE_KEY: 'questionnaireSubmissions'
};

// ========== GERENCIADOR DE DADOS ==========

class TextResponsesDataManager {
    constructor() {
        this.submissions = [];
        this.loadSubmissions();
    }
    
    loadSubmissions() {
        try {
            const submissionsData = localStorage.getItem(TEXT_RESPONSES_CONFIG.STORAGE_KEY);
            this.submissions = submissionsData ? JSON.parse(submissionsData) : [];
        } catch (error) {
            console.error('Erro ao carregar submissões:', error);
            this.submissions = [];
        }
    }
    
    getTextResponses() {
        return this.submissions.filter(submission => {
            return this.hasTextResponses(submission);
        });
    }
    
    hasTextResponses(submission) {
        if (!submission.responses) return false;
        
        return Object.values(submission.responses).some(response => 
            response && 
            typeof response === 'object' && 
            response.questionType === 'text' &&
            response.value && 
            response.value.trim() !== ''
        );
    }
    
    extractTextResponsesFromSubmission(submission) {
        if (!submission.responses) return [];
        
        return Object.values(submission.responses)
            .filter(response => 
                response && 
                typeof response === 'object' && 
                response.questionType === 'text' &&
                response.value && 
                response.value.trim() !== ''
            );
    }
    
    sortSubmissions(submissions, sortOrder) {
        return [...submissions].sort((a, b) => {
            const dateA = new Date(a.submissionDate);
            const dateB = new Date(b.submissionDate);
            return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
        });
    }
}

// ========== RENDERIZADOR DE INTERFACE ==========

class TextResponsesRenderer {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.responsesList = document.getElementById('responsesList');
    }
    
    renderResponses(sortOrder = 'newest') {
        if (!this.responsesList) return;
        
        this.showLoading();
        
        const textResponses = this.dataManager.getTextResponses();
        
        if (textResponses.length === 0) {
            this.showNoData();
            return;
        }
        
        const sortedSubmissions = this.dataManager.sortSubmissions(textResponses, sortOrder);
        
        this.clearContainer();
        
        sortedSubmissions.forEach((submission, index) => {
            const card = this.createSubmissionCard(submission, index);
            if (card) {
                this.responsesList.appendChild(card);
            }
        });
    }
    
    showLoading() {
        if (!this.responsesList) return;
        
        const template = document.querySelector('.loading-state-text.template-item');
        if (template) {
            const loadingElement = template.cloneNode(true);
            loadingElement.classList.remove('template-item');
            loadingElement.style.display = 'block';
            this.responsesList.innerHTML = '';
            this.responsesList.appendChild(loadingElement);
        } else {
            // Fallback se template não existir
            this.responsesList.innerHTML = '<p class="loading">Carregando respostas...</p>';
        }
    }
    
    showNoData() {
        if (!this.responsesList) return;
        
        const template = document.querySelector('.no-data-text.template-item');
        if (template) {
            const noDataElement = template.cloneNode(true);
            noDataElement.classList.remove('template-item');
            noDataElement.style.display = 'block';
            this.responsesList.innerHTML = '';
            this.responsesList.appendChild(noDataElement);
        } else {
            // Fallback se template não existir
            this.responsesList.innerHTML = '<p class="no-data">Nenhuma resposta de texto encontrada.</p>';
        }
    }
    
    clearContainer() {
        if (this.responsesList) {
            this.responsesList.innerHTML = '';
        }
    }
    
    createSubmissionCard(submission, index) {
        const textResponses = this.dataManager.extractTextResponsesFromSubmission(submission);
        
        if (textResponses.length === 0) {
            return null;
        }
        
        const cardTemplate = document.querySelector('.response-card.template-item');
        if (!cardTemplate) return null;
        
        const card = cardTemplate.cloneNode(true);
        card.classList.remove('template-item');
        card.style.display = 'block';
        card.dataset.submissionId = submission.id;
        
        this.populateCardHeader(card, submission, index);
        this.populateCardContent(card, textResponses);
        this.setupCardEvents(card);
        
        return card;
    }
    
    populateCardHeader(card, submission, index) {
        const submissionDate = new Date(submission.submissionDate);
        const formattedDate = submissionDate.toLocaleDateString('pt-BR') + 
                             ' às ' + submissionDate.toLocaleTimeString('pt-BR');
        
        const identification = submission.responses?.identification || {};
        const location = submission.responses?.location || submission.location || {};
        
        const respondentName = identification.name || 'Anônimo';
        const respondentPosition = identification.position || 'Não identificado';
        
        const submissionLocation = location.municipalityText && location.stateText 
            ? `${location.municipalityText}, ${location.stateText}` 
            : 'Local não identificado';
        
        // Preencher dados usando os elementos do template
        const nameElement = card.querySelector('.name-text');
        if (nameElement) nameElement.textContent = respondentName;
        
        const indexElement = card.querySelector('.response-index');
        if (indexElement) indexElement.textContent = `#${index + 1}`;
        
        const positionElement = card.querySelector('.position-text');
        if (positionElement) positionElement.textContent = respondentPosition;
        
        const locationElement = card.querySelector('.location-text');
        if (locationElement) locationElement.textContent = submissionLocation;
        
        const dateElement = card.querySelector('.date-text');
        if (dateElement) dateElement.textContent = formattedDate;
    }
    
    populateCardContent(card, textResponses) {
        const responsesList = card.querySelector('.text-responses-list');
        if (!responsesList) return;
        
        responsesList.innerHTML = '';
        
        textResponses.forEach(response => {
            const listItem = this.createResponseItem(response);
            if (listItem) {
                responsesList.appendChild(listItem);
            }
        });
    }
    
    createResponseItem(response) {
        const itemTemplate = document.querySelector('.text-response-item.template-item');
        if (!itemTemplate) return null;
        
        const listItem = itemTemplate.cloneNode(true);
        listItem.classList.remove('template-item');
        listItem.style.display = 'block';
        
        const questionText = listItem.querySelector('.question-text');
        if (questionText) questionText.textContent = response.questionText;
        
        const answerText = listItem.querySelector('.answer-text');
        if (answerText) answerText.textContent = response.value;
        
        return listItem;
    }
    
    setupCardEvents(card) {
        const header = card.querySelector('.response-header');
        const toggleBtn = card.querySelector('.toggle-responses');
        
        if (header && toggleBtn) {
            const toggleContent = () => {
                this.toggleCardContent(card, toggleBtn);
            };
            
            header.addEventListener('click', (e) => {
                if (e.target.closest('.toggle-responses')) return;
                toggleContent();
            });
            
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleContent();
            });
        }
    }
    
    toggleCardContent(card, toggleBtn) {
        const content = card.querySelector('.response-content');
        const icon = toggleBtn.querySelector('.toggle-icon');
        
        if (!content || !icon) return;
        
        if (content.classList.contains('expanded')) {
            content.classList.remove('expanded');
            icon.textContent = '▼';
        } else {
            content.classList.add('expanded');
            icon.textContent = '▲';
        }
    }
}

// ========== EXPORTADOR DE DADOS ==========

class TextResponsesExporter {
    constructor(dataManager) {
        this.dataManager = dataManager;
    }
    
    exportTextResponses() {
        const submissions = this.dataManager.submissions;
        
        if (submissions.length === 0) {
            alert('Não há respostas para exportar.');
            return;
        }
        
        const textResponses = submissions.map(submission => {
            const filteredSubmission = {
                id: submission.id,
                submissionDate: submission.submissionDate,
                identification: {},
                location: {},
                responses: []
            };
            
            if (submission.responses?.identification) {
                filteredSubmission.identification = {
                    name: submission.responses.identification.name || 'Anônimo',
                    position: submission.responses.identification.position || 'Não identificado'
                };
            }
            
            const location = submission.responses?.location || submission.location || {};
            filteredSubmission.location = {
                municipality: location.municipalityText || 'Não informado',
                state: location.stateText || 'Não informado'
            };
            
            Object.entries(submission.responses || {}).forEach(([key, response]) => {
                if (response && 
                    typeof response === 'object' && 
                    response.questionType === 'text' &&
                    response.value && 
                    response.value.trim() !== '') {
                    
                    filteredSubmission.responses.push({
                        questionId: response.id,
                        questionText: response.questionText,
                        answer: response.value,
                        timestamp: response.timestamp
                    });
                }
            });
            
            return filteredSubmission.responses.length > 0 ? filteredSubmission : null;
        }).filter(submission => submission !== null);
        
        if (textResponses.length === 0) {
            alert('Não há respostas de texto para exportar.');
            return;
        }
        
        this.downloadJSON(textResponses);
    }
    
    downloadJSON(data) {
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `respostas_texto_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }
}

// ========== GERENCIADOR PRINCIPAL ==========

class TextResponsesManager {
    constructor() {
        this.dataManager = new TextResponsesDataManager();
        this.renderer = new TextResponsesRenderer(this.dataManager);
        this.exporter = new TextResponsesExporter(this.dataManager);
        
        this.floatWindow = document.getElementById('floatWindow');
        this.sortOrderSelect = document.getElementById('sortOrder');
        this.exportBtn = document.getElementById('exportTextResponses');
        this.showResponsesBtn = document.getElementById('showResponsesBtn');
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        if (this.floatWindow) {
            const closeModalBtn = this.floatWindow.querySelector('.close-modal');
            if (closeModalBtn) {
                closeModalBtn.addEventListener('click', () => {
                    this.closeModal();
                });
            }
            
            window.addEventListener('click', (event) => {
                if (event.target === this.floatWindow) {
                    this.closeModal();
                }
            });
        }
        
        if (this.sortOrderSelect) {
            this.sortOrderSelect.addEventListener('change', () => {
                this.loadResponses();
            });
        }
        
        if (this.showResponsesBtn) {
            this.showResponsesBtn.addEventListener('click', () => {
                this.openModal();
            });
        }
        
        if (this.exportBtn) {
            this.exportBtn.addEventListener('click', () => {
                this.exporter.exportTextResponses();
            });
        }
    }
    
    openModal() {
        if (this.floatWindow) {
            this.floatWindow.classList.remove('hidden');
            this.loadResponses();
        }
    }
    
    closeModal() {
        if (this.floatWindow) {
            this.floatWindow.classList.add('hidden');
        }
    }
    
    loadResponses() {
        this.dataManager.loadSubmissions();
        const sortOrder = this.sortOrderSelect ? this.sortOrderSelect.value : 'newest';
        this.renderer.renderResponses(sortOrder);
    }
    
    refresh() {
        this.loadResponses();
    }
    
    export() {
        this.exporter.exportTextResponses();
    }
}

// ========== INICIALIZAÇÃO ==========

document.addEventListener('DOMContentLoaded', () => {
    window.textResponsesManager = new TextResponsesManager();
    
    window.textResponsesViewer = {
        open: () => {
            window.textResponsesManager.openModal();
        },
        close: () => {
            window.textResponsesManager.closeModal();
        },
        refresh: () => {
            window.textResponsesManager.refresh();
        },
        export: () => {
            window.textResponsesManager.export();
        }
    };
});