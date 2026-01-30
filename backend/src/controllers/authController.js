const authService = require('../services/authService');

const authController = {
    async login(req, res, next) {
        try {
            const { cpf, documento, email, password } = req.body;
            // Aceita cpf, documento (CPF/CNPJ) ou email como identificador
            const identifier = cpf || documento || email;
            const result = await authService.login(identifier, password);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async me(req, res, next) {
        try {
            const user = await authService.getProfile(req.userId);
            res.json(user);
        } catch (error) {
            next(error);
        }
    },

    async changePassword(req, res, next) {
        try {
            const { currentPassword, newPassword } = req.body;
            const result = await authService.changePassword(req.userId, currentPassword, newPassword);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
};

module.exports = authController;
