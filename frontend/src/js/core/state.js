/**
 * Gerenciador de Estado Simples
 * Controla o estado da aplicação e notifica mudanças
 */
class StateManager {
    constructor() {
        this.state = {
            filters: {
                questionnaire_id: null,
                location_id: null,
                state: null,
                date_from: null,
                date_to: null,
                period: '30d'
            },
            currentSection: 'dashboard',
            isLoading: false
        };
        this.listeners = new Map();
    }

    getState() {
        return { ...this.state };
    }

    getFilters() {
        return { ...this.state.filters };
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.notify('state', this.state);
    }

    setFilters(filters) {
        this.state.filters = { ...this.state.filters, ...filters };
        this.notify('filters', this.state.filters);
    }

    clearFilters() {
        this.state.filters = {
            questionnaire_id: null,
            location_id: null,
            state: null,
            date_from: null,
            date_to: null,
            period: '30d'
        };
        this.notify('filters', this.state.filters);
    }

    setLoading(isLoading) {
        this.state.isLoading = isLoading;
        this.notify('loading', isLoading);
    }

    setCurrentSection(section) {
        this.state.currentSection = section;
        this.notify('section', section);
    }

    // Sistema de eventos
    subscribe(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);

        // Retorna função para cancelar inscrição
        return () => {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        };
    }

    notify(event, data) {
        const callbacks = this.listeners.get(event) || [];
        callbacks.forEach(callback => callback(data));
    }
}

// Instância global do gerenciador de estado
window.appState = new StateManager();
