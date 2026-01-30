const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const { UserModel } = require('../models');

class AuthService {
    async login(identifier, password) {
        // Agora buscamos pelo CPF ou E-mail (flexibilidade)
        let user = await UserModel.findByCpf(identifier);
        
        if (!user) {
            user = await UserModel.findByEmail(identifier);
        }

        if (!user) {
            throw { statusCode: 401, message: 'Usuário não encontrado' };
        }

        // Compara a senha digitada (ex: 0000) com o hash no banco
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            throw { statusCode: 401, message: 'Senha incorreta' };
        }

        const token = jwt.sign(
            { id: user.id, cpf: user.cpf, role: user.role },
            jwtConfig.secret,
            { expiresIn: jwtConfig.expiresIn }
        );

        return {
            token,
            user: {
                id: user.id,
                name: user.name,
                cpf: user.cpf,
                role: user.role
            }
        };
    }

    async getProfile(userId) {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw { statusCode: 404, message: 'User not found' };
        }
        return user;
    }

    async changePassword(userId, currentPassword, newPassword) {
        const user = await UserModel.findByEmail(
            (await UserModel.findById(userId)).email
        );

        const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isValidPassword) {
            throw { statusCode: 400, message: 'Current password is incorrect' };
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await UserModel.updatePassword(userId, hashedPassword);

        return { message: 'Password changed successfully' };
    }

    generateToken(user) {
        return jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            jwtConfig.secret,
            { expiresIn: jwtConfig.expiresIn }
        );
    }
}

module.exports = new AuthService();
