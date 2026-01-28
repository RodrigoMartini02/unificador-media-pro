// ========== CONFIGURAÇÕES ==========
const QUESTIONARIO_CONFIG = {
    STORAGE_KEY: 'questionarioTemplates',
    MIN_QUESTIONS: 1,
    QUESTION_TYPES: [
        { id: 'scale', label: 'Escala Numérica', icon: 'fas fa-sliders-h' },
        { id: 'multiple', label: 'Múltipla Escolha', icon: 'fas fa-list-ul' },
        { id: 'boolean', label: 'Sim/Não', icon: 'fas fa-toggle-on' },
        { id: 'text', label: 'Texto Livre', icon: 'fas fa-font' }
    ]
};

// ========== FUNÇÕES DE STORAGE ==========
function loadTemplates() {
    try {
        const templates = JSON.parse(localStorage.getItem(QUESTIONARIO_CONFIG.STORAGE_KEY) || '[]');
        return templates;
    } catch (error) {
        console.error('Erro ao carregar templates:', error);
        return [];
    }
}

function saveTemplates(templates) {
    try {
        localStorage.setItem(QUESTIONARIO_CONFIG.STORAGE_KEY, JSON.stringify(templates));
        return true;
    } catch (error) {
        console.error('Erro ao salvar templates:', error);
        return false;
    }
}

function getTemplateById(templates, id) {
    return templates.find(template => template.id === id);
}

function generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ========== FUNÇÕES DE TEMPLATE ==========
function addTemplate(templates, template) {
    template.id = generateId('template');
    template.createdAt = new Date().toISOString();
    template.updatedAt = template.createdAt;
    
    template.questions = template.questions.map(question => {
        if (!question.id) {
            question.id = generateId('question');
        }
        return question;
    });
    
    templates.push(template);
    return template;
}

function updateTemplate(templates, templateId, updatedData) {
    const index = templates.findIndex(t => t.id === templateId);
    if (index === -1) return false;

    templates[index] = {
        ...templates[index],
        ...updatedData,
        updatedAt: new Date().toISOString()
    };

    templates[index].questions = templates[index].questions.map(question => {
        if (!question.id) {
            question.id = generateId('question');
        }
        return question;
    });

    return templates[index];
}

function deleteTemplate(templates, templateId) {
    const initialLength = templates.length;
    const newTemplates = templates.filter(t => t.id !== templateId);
    return newTemplates.length < initialLength ? newTemplates : false;
}

// ========== FUNÇÕES DE PERGUNTA ==========
function createQuestion(text, type, options) {
    return {
        id: generateId('question'),
        text: text,
        type: type,
        options: options,
        required: true
    };
}

function getQuestionTypeConfig(typeId) {
    return QUESTIONARIO_CONFIG.QUESTION_TYPES.find(t => t.id === typeId);
}

function validateQuestion(question) {
    if (!question.text || !question.text.trim()) {
        return { valid: false, message: 'O texto da pergunta é obrigatório.' };
    }
    
    if (question.type === 'multiple' && (!question.options.choices || question.options.choices.length === 0)) {
        return { valid: false, message: 'Opções são obrigatórias para perguntas de múltipla escolha.' };
    }
    
    return { valid: true };
}

// ========== FUNÇÕES DE OPÇÕES DE PERGUNTA ==========
function getQuestionOptionsFromForm() {
    const typeSelect = document.getElementById('questionType');
    if (!typeSelect) return {};
    
    const type = typeSelect.value;
    let options = {};

    switch (type) {
        case 'scale':
            const scaleMin = document.getElementById('scaleMin');
            const scaleMax = document.getElementById('scaleMax');
            options = {
                min: parseInt(scaleMin?.value) || 0,
                max: parseInt(scaleMax?.value) || 10
            };
            break;
        
        case 'multiple':
            const multipleOptions = document.getElementById('multipleOptions');
            const allowMultiple = document.getElementById('multipleAllowMultiple');
            const optionsText = multipleOptions?.value || '';
            options = {
                choices: optionsText.split('\n').filter(line => line.trim() !== ''),
                allowMultiple: allowMultiple?.checked || false
            };
            break;
        
        case 'boolean':
            const labelTrue = document.getElementById('booleanLabelTrue');
            const labelFalse = document.getElementById('booleanLabelFalse');
            options = {
                labelTrue: labelTrue?.value || 'Sim',
                labelFalse: labelFalse?.value || 'Não'
            };
            break;
        
        case 'text':
            const placeholder = document.getElementById('textPlaceholder');
            const maxLength = document.getElementById('textMaxLength');
            options = {
                placeholder: placeholder?.value || '',
                maxLength: parseInt(maxLength?.value) || 500
            };
            break;
    }

    return options;
}

function fillQuestionOptionsInForm(question) {
    if (!question || !question.type) return;
    
    switch (question.type) {
        case 'scale':
            const scaleMin = document.getElementById('scaleMin');
            const scaleMax = document.getElementById('scaleMax');
            if (scaleMin) scaleMin.value = question.options?.min || 0;
            if (scaleMax) scaleMax.value = question.options?.max || 10;
            break;
        
        case 'multiple':
            const multipleOptions = document.getElementById('multipleOptions');
            const allowMultiple = document.getElementById('multipleAllowMultiple');
            if (multipleOptions && question.options?.choices) {
                multipleOptions.value = question.options.choices.join('\n');
            }
            if (allowMultiple) {
                allowMultiple.checked = question.options?.allowMultiple || false;
            }
            break;
        
        case 'boolean':
            const labelTrue = document.getElementById('booleanLabelTrue');
            const labelFalse = document.getElementById('booleanLabelFalse');
            if (labelTrue) labelTrue.value = question.options?.labelTrue || 'Sim';
            if (labelFalse) labelFalse.value = question.options?.labelFalse || 'Não';
            break;
        
        case 'text':
            const placeholder = document.getElementById('textPlaceholder');
            const maxLength = document.getElementById('textMaxLength');
            if (placeholder) placeholder.value = question.options?.placeholder || '';
            if (maxLength) maxLength.value = question.options?.maxLength || 500;
            break;
    }
}

// ========== FUNÇÕES DE RENDERIZAÇÃO ==========
function getTemplateElement(className) {
    const template = document.querySelector(`#templates .${className}.template-item`);
    return template ? template.cloneNode(true) : null;
}

function removeTemplateClass(element) {
    if (element) {
        element.classList.remove('template-item');
    }
    return element;
}

function showElement(element) {
    if (element) {
        element.classList.remove('hidden');
    }
}

function hideElement(element) {
    if (element) {
        element.classList.add('hidden');
    }
}

function clearContainer(container) {
    if (container) {
        const items = container.querySelectorAll(':not(.template-item)');
        items.forEach(item => {
            if (!item.classList.contains('template-item')) {
                item.remove();
            }
        });
    }
}

function showEmptyState(container, emptyStateClass) {
    if (!container) return;
    
    const emptyState = getTemplateElement(emptyStateClass);
    if (emptyState) {
        removeTemplateClass(emptyState);
        container.appendChild(emptyState);
    }
}

function hideQuestionOptions() {
    const optionsContainer = document.getElementById('questionOptions');
    if (!optionsContainer) return;
    
    const allOptions = optionsContainer.querySelectorAll('.template-options');
    allOptions.forEach(option => {
        hideElement(option);
    });
}

function showQuestionOptions(type) {
    hideQuestionOptions();
    
    const optionsContainer = document.getElementById('questionOptions');
    if (!optionsContainer) return;
    
    const optionsTemplate = optionsContainer.querySelector(`.${type}-options`);
    if (optionsTemplate) {
        showElement(optionsTemplate);
    }
}

// ========== FUNÇÕES DE MANIPULAÇÃO DE ARRAY ==========
function moveArrayItem(array, fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= array.length || toIndex < 0 || toIndex >= array.length) {
        return array;
    }
    
    const newArray = [...array];
    const item = newArray.splice(fromIndex, 1)[0];
    newArray.splice(toIndex, 0, item);
    return newArray;
}

function removeArrayItem(array, index) {
    if (index < 0 || index >= array.length) {
        return array;
    }
    
    const newArray = [...array];
    newArray.splice(index, 1);
    return newArray;
}

// ========== FUNÇÕES DE VALIDAÇÃO ==========
function validateTemplate(template) {
    if (!template.name || !template.name.trim()) {
        return { valid: false, message: 'O nome do questionário é obrigatório.' };
    }

    if (!template.questions || template.questions.length < QUESTIONARIO_CONFIG.MIN_QUESTIONS) {
        return { valid: false, message: `O questionário deve ter no mínimo ${QUESTIONARIO_CONFIG.MIN_QUESTIONS} perguntas.` };
    }

    for (let i = 0; i < template.questions.length; i++) {
        const questionValidation = validateQuestion(template.questions[i]);
        if (!questionValidation.valid) {
            return { valid: false, message: `Pergunta ${i + 1}: ${questionValidation.message}` };
        }
    }

    return { valid: true };
}

// ========== FUNÇÕES DE NOTIFICAÇÃO ==========
function showNotification(message, type = 'success') {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: type === 'success' ? 'success' : 'error',
            title: type === 'success' ? 'Sucesso!' : 'Erro!',
            text: message,
            confirmButtonText: 'OK'
        });
    } else {
        alert(message);
    }
}

function showConfirmation(message) {
    if (typeof Swal !== 'undefined') {
        return Swal.fire({
            title: 'Confirmação',
            text: message,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sim',
            cancelButtonText: 'Cancelar'
        });
    } else {
        return Promise.resolve({ isConfirmed: confirm(message) });
    }
}

// ========== ESTADO GLOBAL ==========
let currentTemplate = null;
let isEditing = false;
let editingQuestionIndex = -1;
let templates = [];

// ========== FUNÇÕES DE INICIALIZAÇÃO ==========
function resetCurrentTemplate() {
    currentTemplate = {
        id: null,
        name: '',
        description: '',
        questions: [],
        createdAt: null,
        updatedAt: null,
        isActive: true
    };
    isEditing = false;
}

function initializeQuestionarioBuilder() {
    templates = loadTemplates();
    resetCurrentTemplate();
    setupEventListeners();
    renderTemplatesList();
    renderCurrentTemplate();
}

// ========== EVENT LISTENERS ==========
function setupEventListeners() {
    // Modal
    const openModalBtn = document.getElementById('btnAbrirQuestionarioModal');
    if (openModalBtn) {
        openModalBtn.addEventListener('click', () => openModal());
    }

    const modal = document.getElementById('questionarioBuilderModal');
    if (modal) {
        const closeModalBtn = modal.querySelector('.close-modal');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => closeModal());
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    // Formulário de template
    const templateForm = document.getElementById('templateForm');
    if (templateForm) {
        templateForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveTemplate();
        });
    }

    // Botão salvar template
    const saveTemplateBtn = document.getElementById('saveTemplateBtn');
    if (saveTemplateBtn) {
        saveTemplateBtn.addEventListener('click', () => saveTemplate());
    }

    // Botão adicionar pergunta
    const addQuestionBtn = document.getElementById('addQuestionBtn');
    if (addQuestionBtn) {
        addQuestionBtn.addEventListener('click', () => showQuestionForm());
    }

    // Formulário de pergunta
    const questionForm = document.getElementById('questionForm');
    if (questionForm) {
        questionForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveQuestion();
        });

        const cancelQuestionBtn = document.getElementById('cancelQuestionBtn');
        if (cancelQuestionBtn) {
            cancelQuestionBtn.addEventListener('click', () => hideQuestionForm());
        }
    }

    // Tipo de pergunta
    const questionTypeSelect = document.getElementById('questionType');
    if (questionTypeSelect) {
        questionTypeSelect.addEventListener('change', () => updateQuestionOptions());
    }

    // Delegação de eventos para elementos dinâmicos
    const templatesContainer = document.getElementById('templatesContainer');
    if (templatesContainer) {
        templatesContainer.addEventListener('click', handleTemplateActions);
    }

    const questionsList = document.getElementById('questionsList');
    if (questionsList) {
        questionsList.addEventListener('click', handleQuestionActions);
    }
}

function handleTemplateActions(e) {
    const target = e.target.closest('button');
    if (!target) return;

    const templateId = target.dataset.id;
    
    if (target.classList.contains('edit-template')) {
        openModal(templateId);
    } else if (target.classList.contains('toggle-template')) {
        toggleTemplateActive(templateId);
    } else if (target.classList.contains('delete-template')) {
        deleteTemplateWithConfirmation(templateId);
    }
}

function handleQuestionActions(e) {
    const target = e.target.closest('button');
    if (!target) return;

    const index = parseInt(target.dataset.index);
    
    if (target.classList.contains('edit-question')) {
        editQuestion(index);
    } else if (target.classList.contains('delete-question')) {
        deleteQuestionWithConfirmation(index);
    } else if (target.classList.contains('move-up-question')) {
        moveQuestion(index, -1);
    } else if (target.classList.contains('move-down-question')) {
        moveQuestion(index, 1);
    }
}

// ========== FUNÇÕES DE MODAL ==========
function openModal(templateId = null) {
    if (templateId) {
        const template = getTemplateById(templates, templateId);
        if (template) {
            currentTemplate = JSON.parse(JSON.stringify(template));
            isEditing = true;
        } else {
            resetCurrentTemplate();
        }
    } else {
        resetCurrentTemplate();
    }
    
    renderCurrentTemplate();
    const modal = document.getElementById('questionarioBuilderModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeModal() {
    const modal = document.getElementById('questionarioBuilderModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    hideQuestionForm();
}

// ========== FUNÇÕES DE RENDERIZAÇÃO PRINCIPAL ==========
function renderTemplatesList() {
    const templatesContainer = document.getElementById('templatesContainer');
    if (!templatesContainer) return;

    clearContainer(templatesContainer);

    if (templates.length === 0) {
        showEmptyState(templatesContainer, 'templates-empty');
        return;
    }

    templates.forEach(template => {
        const templateCard = createTemplateCard(template);
        if (templateCard) {
            templatesContainer.appendChild(templateCard);
        }
    });
}

function renderCurrentTemplate() {
    const templateNameInput = document.getElementById('templateName');
    const templateDescriptionInput = document.getElementById('templateDescription');
    
    if (templateNameInput) {
        templateNameInput.value = currentTemplate.name;
    }
    
    if (templateDescriptionInput) {
        templateDescriptionInput.value = currentTemplate.description;
    }

    const modalTitle = document.querySelector('#questionarioBuilderModal .modal-title');
    if (modalTitle) {
        modalTitle.textContent = isEditing ? 'Editar Questionário' : 'Criar Novo Questionário';
    }

    renderQuestionsList();
}

function renderQuestionsList() {
    const questionsList = document.getElementById('questionsList');
    if (!questionsList) return;

    clearContainer(questionsList);

    if (currentTemplate.questions.length === 0) {
        showEmptyState(questionsList, 'questions-empty');
        return;
    }

    currentTemplate.questions.forEach((question, index) => {
        const questionItem = createQuestionItem(question, index);
        if (questionItem) {
            questionsList.appendChild(questionItem);
        }
    });
}

// ========== FUNÇÕES DE CRIAÇÃO DE ELEMENTOS ==========
function createTemplateCard(template) {
    const templateCard = getTemplateElement('template-card');
    if (!templateCard) return null;

    removeTemplateClass(templateCard);
    
    if (template.isActive) {
        templateCard.classList.add('active');
    } else {
        templateCard.classList.add('inactive');
    }

    const titleElement = templateCard.querySelector('.template-title');
    if (titleElement) titleElement.textContent = template.name;

    const descriptionElement = templateCard.querySelector('.template-description');
    if (descriptionElement) descriptionElement.textContent = template.description || '';

    const questionsCount = templateCard.querySelector('.questions-count');
    if (questionsCount) questionsCount.textContent = `${template.questions.length} perguntas`;

    const createdDate = templateCard.querySelector('.created-date');
    if (createdDate) {
        createdDate.textContent = `Criado em: ${new Date(template.createdAt).toLocaleDateString('pt-BR')}`;
    }

    const editBtn = templateCard.querySelector('.edit-template');
    if (editBtn) {
        editBtn.dataset.id = template.id;
    }

    const toggleBtn = templateCard.querySelector('.toggle-template');
    if (toggleBtn) {
        toggleBtn.dataset.id = template.id;
        const icon = toggleBtn.querySelector('i');
        if (icon) {
            icon.className = template.isActive ? 'fas fa-toggle-on' : 'fas fa-toggle-off';
        }
    }

    const deleteBtn = templateCard.querySelector('.delete-template');
    if (deleteBtn) {
        deleteBtn.dataset.id = template.id;
    }

    return templateCard;
}

function createQuestionItem(question, index) {
    const questionItem = getTemplateElement('question-item');
    if (!questionItem) return null;

    removeTemplateClass(questionItem);
    questionItem.dataset.index = index;

    let typeIcon = 'fa-question';
    let typeLabel = 'Desconhecido';
    
    const questionType = getQuestionTypeConfig(question.type);
    if (questionType) {
        typeIcon = questionType.icon;
        typeLabel = questionType.label;
    }

    const iconElement = questionItem.querySelector('.question-type i');
    if (iconElement) iconElement.className = `fas ${typeIcon}`;

    const labelElement = questionItem.querySelector('.question-type-label');
    if (labelElement) labelElement.textContent = typeLabel;

    const textElement = questionItem.querySelector('.question-text');
    if (textElement) textElement.textContent = question.text;

    // Configurar data-index para todos os botões
    const buttons = questionItem.querySelectorAll('button[data-index]');
    buttons.forEach(button => {
        button.dataset.index = index;
    });

    const moveUpBtn = questionItem.querySelector('.move-up-question');
    if (moveUpBtn && index === 0) {
        moveUpBtn.disabled = true;
    }

    const moveDownBtn = questionItem.querySelector('.move-down-question');
    if (moveDownBtn && index === currentTemplate.questions.length - 1) {
        moveDownBtn.disabled = true;
    }

    return questionItem;
}

// ========== FUNÇÕES DE PERGUNTA ==========
function showQuestionForm() {
    const questionForm = document.getElementById('questionForm');
    if (!questionForm) return;

    showElement(questionForm);
    
    const formTitle = document.getElementById('questionFormTitle');
    if (formTitle) {
        formTitle.textContent = editingQuestionIndex >= 0 ? 'Editar Pergunta' : 'Adicionar Pergunta';
    }
    
    if (editingQuestionIndex < 0) {
        clearQuestionForm();
    }
    
    const questionTextInput = document.getElementById('questionText');
    if (questionTextInput) {
        questionTextInput.focus();
    }
}

function hideQuestionForm() {
    const questionForm = document.getElementById('questionForm');
    if (questionForm) {
        hideElement(questionForm);
    }
    editingQuestionIndex = -1;
}

function clearQuestionForm() {
    const questionTextInput = document.getElementById('questionText');
    const questionTypeSelect = document.getElementById('questionType');
    
    if (questionTextInput) questionTextInput.value = '';
    if (questionTypeSelect) questionTypeSelect.value = 'scale';
    
    updateQuestionOptions();
}

function updateQuestionOptions() {
    const questionTypeSelect = document.getElementById('questionType');
    if (!questionTypeSelect) return;

    const selectedType = questionTypeSelect.value;
    showQuestionOptions(selectedType);

    if (editingQuestionIndex >= 0) {
        const question = currentTemplate.questions[editingQuestionIndex];
        if (question && question.type === selectedType) {
            fillQuestionOptionsInForm(question);
        }
    }
}

function saveQuestion() {
    const questionTextInput = document.getElementById('questionText');
    const questionTypeSelect = document.getElementById('questionType');
    
    if (!questionTextInput || !questionTypeSelect) return;

    const questionText = questionTextInput.value.trim();
    if (!questionText) {
        showNotification('O texto da pergunta é obrigatório.', 'error');
        return;
    }

    const questionType = questionTypeSelect.value;
    const options = getQuestionOptionsFromForm();

    const question = createQuestion(questionText, questionType, options);
    
    if (editingQuestionIndex >= 0) {
        question.id = currentTemplate.questions[editingQuestionIndex].id;
        currentTemplate.questions[editingQuestionIndex] = question;
    } else {
        currentTemplate.questions.push(question);
    }

    renderQuestionsList();
    hideQuestionForm();
}

function editQuestion(index) {
    if (index < 0 || index >= currentTemplate.questions.length) return;
    
    editingQuestionIndex = index;
    const question = currentTemplate.questions[index];
    
    const questionTextInput = document.getElementById('questionText');
    const questionTypeSelect = document.getElementById('questionType');
    
    if (questionTextInput) questionTextInput.value = question.text;
    if (questionTypeSelect) questionTypeSelect.value = question.type;
    
    updateQuestionOptions();
    showQuestionForm();
}

function deleteQuestionWithConfirmation(index) {
    if (index < 0 || index >= currentTemplate.questions.length) return;
    
    showConfirmation('Tem certeza que deseja excluir esta pergunta?').then((result) => {
        if (result.isConfirmed) {
            currentTemplate.questions = removeArrayItem(currentTemplate.questions, index);
            renderQuestionsList();
        }
    });
}

function moveQuestion(index, direction) {
    if (index < 0 || index >= currentTemplate.questions.length) return;
    
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= currentTemplate.questions.length) return;
    
    currentTemplate.questions = moveArrayItem(currentTemplate.questions, index, newIndex);
    renderQuestionsList();
}

// ========== FUNÇÕES DE TEMPLATE ==========
function saveTemplate() {
    const templateNameInput = document.getElementById('templateName');
    const templateDescriptionInput = document.getElementById('templateDescription');
    
    if (!templateNameInput) return;

    currentTemplate.name = templateNameInput.value.trim();
    currentTemplate.description = templateDescriptionInput ? templateDescriptionInput.value.trim() : '';

    const validation = validateTemplate(currentTemplate);
    if (!validation.valid) {
        showNotification(validation.message, 'error');
        return;
    }

    if (isEditing) {
        const updatedTemplate = updateTemplate(templates, currentTemplate.id, currentTemplate);
        if (!updatedTemplate) {
            showNotification('Erro ao atualizar questionário.', 'error');
            return;
        }
    } else {
        addTemplate(templates, currentTemplate);
        resetCurrentTemplate();
    }

    if (saveTemplates(templates)) {
        renderTemplatesList();
        showNotification(`Questionário ${isEditing ? 'atualizado' : 'criado'} com sucesso.`);
        
        if (!isEditing) {
            renderCurrentTemplate();
        }
    } else {
        showNotification('Erro ao salvar questionário.', 'error');
    }
}

function toggleTemplateActive(templateId) {
    const template = getTemplateById(templates, templateId);
    if (!template) return;
    
    const updatedTemplate = updateTemplate(templates, templateId, {
        isActive: !template.isActive
    });
    
    if (updatedTemplate && saveTemplates(templates)) {
        renderTemplatesList();
    }
}

function deleteTemplateWithConfirmation(templateId) {
    showConfirmation('Tem certeza que deseja excluir este modelo de questionário? Esta ação não pode ser desfeita.').then((result) => {
        if (result.isConfirmed) {
            const newTemplates = deleteTemplate(templates, templateId);
            if (newTemplates) {
                templates = newTemplates;
                if (saveTemplates(templates)) {
                    renderTemplatesList();
                    showNotification('Template excluído com sucesso.');
                }
            }
        }
    });
}

// ========== INICIALIZAÇÃO ==========
document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.QUESTIONARIO_CONFIG === 'undefined') {
        window.QUESTIONARIO_CONFIG = QUESTIONARIO_CONFIG;
    }
    
    initializeQuestionarioBuilder();
});