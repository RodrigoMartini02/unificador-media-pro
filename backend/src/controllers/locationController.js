const { LocationModel } = require('../models');

const locationController = {
    async findAll(req, res, next) {
        try {
            const locations = await LocationModel.findAll();
            res.json(locations);
        } catch (error) {
            next(error);
        }
    },

    async getStates(req, res, next) {
        try {
            const states = await LocationModel.getStates();
            res.json(states);
        } catch (error) {
            next(error);
        }
    },

    async getMunicipalities(req, res, next) {
        try {
            const { state } = req.params;
            const municipalities = await LocationModel.getMunicipalitiesByState(state);
            res.json(municipalities);
        } catch (error) {
            next(error);
        }
    },

    async create(req, res, next) {
        try {
            const { state, municipality } = req.body;
            const location = await LocationModel.create({
                state,
                municipality,
                created_by: req.userId
            });
            res.status(201).json(location);
        } catch (error) {
            next(error);
        }
    },

    async delete(req, res, next) {
        try {
            const { id } = req.params;
            await LocationModel.delete(id);
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
};

module.exports = locationController;
