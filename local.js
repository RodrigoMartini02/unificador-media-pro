class LocationManager {
    constructor() {
        this.municipalities = this.loadMunicipalities();
        this.isInitialized = false;
        this.initialize();
    }

    initialize() {
        window.MUNICIPALITIES = this.municipalities;
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
        } else {
            this.setupEventListeners();
        }
        
        this.isInitialized = true;
    }

    loadMunicipalities() {
        try {
            const stored = localStorage.getItem('MUNICIPALITIES');
            const data = stored ? JSON.parse(stored) : {};
            
            if (typeof data !== 'object' || data === null) {
                console.warn('Dados de municípios inválidos, iniciando com objeto vazio');
                return {};
            }
            
            return data;
        } catch (error) {
            console.error('Erro ao carregar municípios:', error);
            return {};
        }
    }

    saveMunicipalities() {
        try {
            localStorage.setItem('MUNICIPALITIES', JSON.stringify(this.municipalities));
            window.MUNICIPALITIES = this.municipalities;
            
            window.dispatchEvent(new CustomEvent('municipalitiesUpdated', {
                detail: { municipalities: this.municipalities }
            }));
            
            return true;
        } catch (error) {
            console.error('Erro ao salvar municípios:', error);
            this.showAlert('Erro ao salvar dados. Verifique o espaço de armazenamento.', 'error');
            return false;
        }
    }

    addState(stateName) {
        const state = stateName.trim().toUpperCase();
        
        if (!state) {
            throw new Error('Por favor, insira o nome do estado.');
        }

        if (state.length < 2) {
            throw new Error('Nome do estado muito curto.');
        }

        if (this.municipalities[state]) {
            throw new Error('Este estado já existe.');
        }

        this.municipalities[state] = [];
        return this.saveMunicipalities();
    }

    addCity(stateName, cityName) {
        const state = stateName.trim();
        const city = cityName.trim();

        if (!state || !city) {
            throw new Error('Por favor, selecione um estado e insira o nome do município.');
        }

        if (!this.municipalities[state]) {
            throw new Error('Estado não encontrado.');
        }

        if (this.municipalities[state].includes(city)) {
            throw new Error('Este município já existe neste estado.');
        }

        this.municipalities[state].push(city);
        this.municipalities[state].sort((a, b) => a.localeCompare(b, 'pt-BR'));
        
        return this.saveMunicipalities();
    }

    deleteState(stateName) {
        if (!this.municipalities[stateName]) {
            return false;
        }
        
        delete this.municipalities[stateName];
        return this.saveMunicipalities();
    }

    deleteCity(stateName, cityName) {
        if (!this.municipalities[stateName]) {
            return false;
        }
        
        this.municipalities[stateName] = this.municipalities[stateName]
            .filter(city => city !== cityName);
        
        return this.saveMunicipalities();
    }

    setupEventListeners() {
        const openModalBtn = document.getElementById('openLocationManager');
        const modal = document.getElementById('locationManagerModal');
        const closeBtn = modal?.querySelector('.close-modal');
        const addStateBtn = document.getElementById('addStateBtn');
        const addCityBtn = document.getElementById('addCityBtn');
        const stateCitySelect = document.getElementById('stateCitySelect');

        if (openModalBtn) {
            openModalBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.openModal();
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.closeModal();
            });
        }

        if (addStateBtn) {
            addStateBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.addStateHandler();
            });
        }

        if (addCityBtn) {
            addCityBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.addCityHandler();
            });
        }

        if (stateCitySelect) {
            stateCitySelect.addEventListener('change', () => {
                this.handleStateChange();
            });
        }

        if (modal) {
            window.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                }
            });
        }

        this.updateStateSelects();
        this.updateLocationsList();
    }

    openModal() {
        const modal = document.getElementById('locationManagerModal');
        
        if (!modal) {
            console.error('Modal de gerenciamento de locais não encontrado');
            return;
        }
        
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        this.updateLocationsList();
        
        const firstInput = modal.querySelector('input');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }

    closeModal() {
        const modal = document.getElementById('locationManagerModal');
        
        if (!modal) return;
        
        modal.classList.add('hidden');
        modal.style.display = 'none';
        
        const inputs = modal.querySelectorAll('input');
        inputs.forEach(input => input.value = '');
    }

    handleStateChange() {
        const stateSelect = document.getElementById('stateCitySelect');
        const newCityInput = document.getElementById('newCityInput');
        const addCityBtn = document.getElementById('addCityBtn');

        if (stateSelect && stateSelect.value) {
            if (newCityInput) newCityInput.disabled = false;
            if (addCityBtn) addCityBtn.disabled = false;
        } else {
            if (newCityInput) newCityInput.disabled = true;
            if (addCityBtn) addCityBtn.disabled = true;
        }
    }

    addStateHandler() {
        const stateInput = document.getElementById('newStateInput');
        if (!stateInput) return;
        
        const state = stateInput.value.trim().toUpperCase();
        
        try {
            this.addState(state);
            this.updateStateSelects();
            this.updateLocationsList();
            stateInput.value = '';
            this.showAlert('Estado adicionado com sucesso!', 'success');
        } catch (error) {
            this.showAlert(error.message, 'error');
        }
    }

    addCityHandler() {
        const stateSelect = document.getElementById('stateCitySelect');
        const cityInput = document.getElementById('newCityInput');
        
        if (!stateSelect || !cityInput) return;
        
        const state = stateSelect.value;
        const city = cityInput.value.trim();

        try {
            this.addCity(state, city);
            this.updateLocationsList();
            cityInput.value = '';
            this.showAlert('Município adicionado com sucesso!', 'success');
        } catch (error) {
            this.showAlert(error.message, 'error');
        }
    }

    deleteStateHandler(state) {
        if (confirm(`Tem certeza que deseja excluir o estado ${state} e todos seus municípios?`)) {
            this.deleteState(state);
            this.updateStateSelects();
            this.updateLocationsList();
            this.showAlert('Estado excluído com sucesso!', 'success');
        }
    }

    deleteCityHandler(state, city) {
        if (confirm(`Tem certeza que deseja excluir o município ${city}?`)) {
            this.deleteCity(state, city);
            this.updateLocationsList();
            this.showAlert('Município excluído com sucesso!', 'success');
        }
    }

    updateStateSelects() {
        const selects = document.querySelectorAll('#stateCitySelect, #stateSelect, #filterTextState');
        const states = Object.keys(this.municipalities).sort();

        selects.forEach(select => {
            if (!select) return;
            
            const currentValue = select.value;
            const firstOption = select.querySelector('option:first-child');
            
            select.innerHTML = '';
            
            if (firstOption) {
                select.appendChild(firstOption.cloneNode(true));
            }
            
            states.forEach(state => {
                const option = document.createElement('option');
                option.value = state;
                option.textContent = state;
                select.appendChild(option);
            });
            
            if (states.includes(currentValue)) {
                select.value = currentValue;
            }
        });
    }

    updateLocationsList() {
        const container = document.getElementById('locationsList');
        if (!container) return;

        container.innerHTML = '';

        const states = Object.keys(this.municipalities).sort();

        if (states.length === 0) {
            container.innerHTML = '<div class="empty-message">Nenhum estado cadastrado.</div>';
            return;
        }

        states.forEach(state => {
            const stateCard = document.createElement('div');
            stateCard.className = 'location-card';

            const stateHeader = document.createElement('div');
            stateHeader.className = 'location-header';

            const stateTitle = document.createElement('h4');
            stateTitle.textContent = state;

            const deleteStateBtn = document.createElement('button');
            deleteStateBtn.className = 'delete-btn';
            deleteStateBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteStateBtn.onclick = () => this.deleteStateHandler(state);

            stateHeader.appendChild(stateTitle);
            stateHeader.appendChild(deleteStateBtn);

            const citiesList = document.createElement('div');
            citiesList.className = 'cities-list';

            const cities = this.municipalities[state];
            
            if (cities.length === 0) {
                citiesList.innerHTML = '<div class="no-cities">Nenhum município cadastrado</div>';
            } else {
                cities.forEach(city => {
                    const cityItem = document.createElement('div');
                    cityItem.className = 'city-item';

                    const cityName = document.createElement('span');
                    cityName.textContent = city;

                    const deleteCityBtn = document.createElement('button');
                    deleteCityBtn.className = 'delete-city-btn';
                    deleteCityBtn.innerHTML = '<i class="fas fa-times"></i>';
                    deleteCityBtn.onclick = () => this.deleteCityHandler(state, city);

                    cityItem.appendChild(cityName);
                    cityItem.appendChild(deleteCityBtn);
                    citiesList.appendChild(cityItem);
                });
            }

            stateCard.appendChild(stateHeader);
            stateCard.appendChild(citiesList);
            container.appendChild(stateCard);
        });
    }

    showAlert(message, type = 'info') {
        if (window.Swal) {
            Swal.fire({
                title: type === 'success' ? 'Sucesso!' : type === 'error' ? 'Erro!' : 'Atenção!',
                text: message,
                icon: type,
                confirmButtonText: 'OK'
            });
        } else {
            alert(message);
        }
    }
}

class QuestionnaireLocationManager {
    constructor() {
        this.modal = null;
        this.stateSelect = null;
        this.municipalitySelect = null;
        this.questionarioSelect = null;
        this.confirmButton = null;
        this.currentSelectionDisplay = null;
        this.isInitialized = false;
        this.initialize();
    }

    initialize() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupElements());
        } else {
            this.setupElements();
        }
    }

    setupElements() {
        this.modal = document.getElementById('questionnaireLocationModal');
        this.stateSelect = document.getElementById('stateSelect');
        this.municipalitySelect = document.getElementById('municipalitySelect');
        this.questionarioSelect = document.getElementById('questionnaireSelect');
        this.confirmButton = document.getElementById('confirmLocationBtn');
        this.currentSelectionDisplay = document.getElementById('currentSelectionDisplay');

        if (!this.modal) {
            console.error('Modal de seleção de localização não encontrado');
            return;
        }

        this.setupEventListeners();
        this.loadCurrentSelection();
        this.isInitialized = true;
    }

    setupEventListeners() {
        const setLocationBtn = document.getElementById('setQuestionnaireLocation');
        const closeBtn = this.modal?.querySelector('.close-modal');
        const cancelBtn = document.getElementById('cancelLocationBtn');

        if (setLocationBtn) {
            setLocationBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.openModal();
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.closeModal();
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.closeModal();
            });
        }

        if (this.confirmButton) {
            this.confirmButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.saveSelection();
            });
        }

        if (this.stateSelect) {
            this.stateSelect.addEventListener('change', () => {
                this.handleStateChange();
            });
        }

        if (this.municipalitySelect) {
            this.municipalitySelect.addEventListener('change', () => {
                this.handleMunicipalityChange();
            });
        }

        if (this.questionarioSelect) {
            this.questionarioSelect.addEventListener('change', () => {
                this.handleQuestionnaireChange();
            });
        }

        if (this.modal) {
            window.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.closeModal();
                }
            });
        }

        window.addEventListener('municipalitiesUpdated', () => {
            this.populateStateSelect();
        });
    }

    openModal() {
        if (!this.modal) return;
        
        this.modal.classList.remove('hidden');
        this.modal.style.display = 'flex';
        
        this.populateStateSelect();
        this.populateQuestionnaireSelect();
        this.loadSavedSelectionIntoForm();
    }

    closeModal() {
        if (!this.modal) return;
        
        this.modal.classList.add('hidden');
        this.modal.style.display = 'none';
        
        if (this.stateSelect) this.stateSelect.value = '';
        if (this.municipalitySelect) {
            this.municipalitySelect.value = '';
            this.municipalitySelect.disabled = true;
        }
        if (this.confirmButton) this.confirmButton.disabled = true;
    }

    populateStateSelect() {
        if (!this.stateSelect) return;

        const municipalities = window.MUNICIPALITIES || {};
        const states = Object.keys(municipalities).sort();
        const currentValue = this.stateSelect.value;

        this.stateSelect.innerHTML = '<option value="">Selecione um estado</option>';

        states.forEach(state => {
            const option = document.createElement('option');
            option.value = state;
            option.textContent = state;
            this.stateSelect.appendChild(option);
        });

        if (states.includes(currentValue)) {
            this.stateSelect.value = currentValue;
        }
    }

    populateQuestionnaireSelect() {
        if (!this.questionarioSelect) return;

        try {
            const templates = JSON.parse(localStorage.getItem('questionnaireTemplates') || '[]');
            const activeTemplates = templates.filter(t => t.ativo !== false);

            this.questionarioSelect.innerHTML = '<option value="">Selecione um questionário</option>';

            activeTemplates.forEach(template => {
                const option = document.createElement('option');
                option.value = template.id;
                option.textContent = template.nome || 'Questionário sem nome';
                this.questionarioSelect.appendChild(option);
            });

            const savedTemplate = localStorage.getItem('selectedQuestionnaireTemplate');
            if (savedTemplate && activeTemplates.some(t => t.id === savedTemplate)) {
                this.questionarioSelect.value = savedTemplate;
            }
        } catch (error) {
            console.error('Erro ao carregar questionários:', error);
        }
    }

    handleStateChange() {
        const selectedState = this.stateSelect?.value;

        if (!selectedState) {
            if (this.municipalitySelect) {
                this.municipalitySelect.disabled = true;
                this.municipalitySelect.value = '';
            }
            if (this.confirmButton) this.confirmButton.disabled = true;
            return;
        }

        this.loadMunicipalitiesForState(selectedState);
        if (this.municipalitySelect) this.municipalitySelect.disabled = false;
    }

    loadMunicipalitiesForState(state) {
        if (!this.municipalitySelect) return;

        const municipalities = window.MUNICIPALITIES || {};
        const cities = municipalities[state] || [];

        this.municipalitySelect.innerHTML = '<option value="">Selecione um município</option>';

        cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            this.municipalitySelect.appendChild(option);
        });
    }

    handleMunicipalityChange() {
        const hasState = this.stateSelect?.value;
        const hasMunicipality = this.municipalitySelect?.value;
        const hasQuestionnaire = this.questionarioSelect?.value;

        if (this.confirmButton) {
            this.confirmButton.disabled = !(hasState && hasMunicipality && hasQuestionnaire);
        }
    }

    handleQuestionnaireChange() {
        this.handleMunicipalityChange();
    }

    saveSelection() {
        if (!this.stateSelect?.value || !this.municipalitySelect?.value) {
            this.showAlert('Por favor, selecione um estado e município.', 'warning');
            return;
        }

        if (!this.questionarioSelect?.value) {
            this.showAlert('Por favor, selecione um questionário.', 'warning');
            return;
        }

        const selection = {
            state: this.stateSelect.value,
            stateText: this.stateSelect.options[this.stateSelect.selectedIndex].text,
            municipality: this.municipalitySelect.value,
            municipalityText: this.municipalitySelect.options[this.municipalitySelect.selectedIndex].text,
            questionnaireName: this.questionarioSelect.options[this.questionarioSelect.selectedIndex].text || 'Questionário'
        };
        
        localStorage.setItem('questionnaireLocation', JSON.stringify(selection));
        
        if (this.questionarioSelect.value) {
            localStorage.setItem('selectedQuestionnaireTemplate', this.questionarioSelect.value);
            
            const templateLocationMap = JSON.parse(localStorage.getItem('templateLocationMap') || '{}');
            
            if (!templateLocationMap[this.questionarioSelect.value]) {
                templateLocationMap[this.questionarioSelect.value] = [];
            }
            
            const locationKey = `${selection.state}:${selection.municipality}`;
            if (!templateLocationMap[this.questionarioSelect.value].includes(locationKey)) {
                templateLocationMap[this.questionarioSelect.value].push(locationKey);
                localStorage.setItem('templateLocationMap', JSON.stringify(templateLocationMap));
            }
        }
        
        window.dispatchEvent(new CustomEvent('questionnaireLocationChanged', {
            detail: selection
        }));
        
        this.updateLocationDisplay(selection);
        this.updateAccessButton();
        this.closeModal();
        this.showSuccessNotification(selection);
    }
    
    loadCurrentSelection() {
        try {
            const savedSelection = JSON.parse(localStorage.getItem('questionnaireLocation'));
            if (savedSelection) {
                this.updateLocationDisplay(savedSelection);
                this.updateAccessButton();
            }
        } catch (error) {
            console.error('Erro ao carregar seleção atual:', error);
        }
    }
    
    loadSavedSelectionIntoForm() {
        if (!this.stateSelect || !this.municipalitySelect) return;
        
        try {
            const savedSelection = JSON.parse(localStorage.getItem('questionnaireLocation'));
            if (savedSelection && savedSelection.state) {
                this.populateStateSelect();
                
                this.stateSelect.value = savedSelection.state;
                
                this.loadMunicipalitiesForState(savedSelection.state);
                this.municipalitySelect.disabled = false;
                
                setTimeout(() => {
                    this.municipalitySelect.value = savedSelection.municipality;
                    if (this.confirmButton) this.confirmButton.disabled = false;
                    this.handleMunicipalityChange();
                }, 100);
            }
        } catch (error) {
            console.error('Erro ao carregar seleção salva no formulário:', error);
        }
    }
    
    updateLocationDisplay(selection) {
        if (this.currentSelectionDisplay) {
            this.currentSelectionDisplay.textContent = `${selection.stateText} - ${selection.municipalityText}`;
        }
        
        const currentMunicipalityDisplay = document.getElementById('currentMunicipality');
        if (currentMunicipalityDisplay) {
            const municipalityName = currentMunicipalityDisplay.querySelector('.municipality-name');
            const stateName = currentMunicipalityDisplay.querySelector('.state-name');
            
            if (municipalityName) municipalityName.textContent = selection.municipalityText;
            if (stateName) stateName.textContent = selection.stateText;
            
            currentMunicipalityDisplay.classList.add('municipality-selected');
        }
        
        const currentQuestionnaireName = document.getElementById('currentQuestionnaireName');
        if (currentQuestionnaireName) {
            currentQuestionnaireName.textContent = selection.questionnaireName;
        }
    }
    
    updateAccessButton() {
        let accessButtonContainer = document.querySelector('.access-button-container');
        
        if (!accessButtonContainer) {
            accessButtonContainer = document.createElement('div');
            accessButtonContainer.className = 'access-button-container';
            
            const selectionControls = document.querySelector('.selection-controls');
            if (selectionControls) {
                selectionControls.parentNode.insertBefore(accessButtonContainer, selectionControls.nextSibling);
            } else {
                document.body.appendChild(accessButtonContainer);
            }
        }
    }
    
    showSuccessNotification(selection) {
        if (window.Swal) {
            Swal.fire({
                title: 'Local Definido!',
                text: `O questionário agora será direcionado para ${selection.municipalityText}, ${selection.stateText}`,
                icon: 'success',
                confirmButtonText: 'OK'
            });
        } else {
            alert(`Local definido com sucesso: ${selection.municipalityText}, ${selection.stateText}.`);
        }
    }

    showAlert(message, type = 'info') {
        if (window.Swal) {
            Swal.fire({
                title: type === 'success' ? 'Sucesso!' : type === 'error' ? 'Erro!' : 'Atenção!',
                text: message,
                icon: type,
                confirmButtonText: 'OK'
            });
        } else {
            alert(message);
        }
    }
}

function displayQuestionnaireLocation() {
    try {
        const currentMunicipalityElement = document.getElementById('currentMunicipality');
        if (!currentMunicipalityElement) return;

        const savedSelection = JSON.parse(localStorage.getItem('questionnaireLocation'));
        
        if (savedSelection) {
            const municipalityName = currentMunicipalityElement.querySelector('.municipality-name');
            const stateName = currentMunicipalityElement.querySelector('.state-name');
            
            if (municipalityName) {
                municipalityName.textContent = savedSelection.municipalityText;
            }
            if (stateName) {
                stateName.textContent = savedSelection.stateText;
            }
            
            currentMunicipalityElement.classList.add('municipality-selected');
            updateHiddenFields(savedSelection);
            
        } else {
            const municipalityName = currentMunicipalityElement.querySelector('.municipality-name');
            const stateName = currentMunicipalityElement.querySelector('.state-name');
            
            if (municipalityName) {
                municipalityName.textContent = 'Nenhum município selecionado';
            }
            if (stateName) {
                stateName.textContent = '';
            }
            
            currentMunicipalityElement.classList.remove('municipality-selected');
        }
    } catch (error) {
        console.error('Erro ao exibir informações do município:', error);
    }
}

function updateHiddenFields(selection) {
    const form = document.getElementById('satisfactionForm');
    if (!form) return;
    
    const hiddenFields = [
        { name: 'state', value: selection.state },
        { name: 'stateText', value: selection.stateText },
        { name: 'municipality', value: selection.municipality },
        { name: 'municipalityText', value: selection.municipalityText }
    ];
    
    hiddenFields.forEach(field => {
        let inputField = form.querySelector(`input[name="${field.name}"]`);
        if (!inputField) {
            inputField = document.createElement('input');
            inputField.type = 'hidden';
            inputField.name = field.name;
            form.appendChild(inputField);
        }
        inputField.value = field.value;
    });
}

window.addEventListener('load', () => {
    if (!window.locationManager) {
        window.locationManager = new LocationManager();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    if (!window.locationManager) {
        window.locationManager = new LocationManager();
    }
    
    if (document.getElementById('questionnaireLocationModal') || document.getElementById('setQuestionnaireLocation')) {
        window.questionnaireLocationManager = new QuestionnaireLocationManager();
    }
    
    if (document.getElementById('satisfactionForm')) {
        displayQuestionnaireLocation();
        
        window.addEventListener('storage', (event) => {
            if (event.key === 'questionnaireLocation') {
                displayQuestionnaireLocation();
            }
        });
    }
});

window.QuestionnaireLocationManager = QuestionnaireLocationManager;
window.displayQuestionnaireLocation = displayQuestionnaireLocation;
window.updateHiddenFields = updateHiddenFields;