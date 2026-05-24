const mongoose = require('mongoose');

const spaceConfigSchema = new mongoose.Schema({
    projectId: { type: String, required: true, unique: true, default: 'diplomatura' },
    game: mongoose.Schema.Types.Mixed,
    ship: mongoose.Schema.Types.Mixed,
    scene: mongoose.Schema.Types.Mixed,
    stars: mongoose.Schema.Types.Mixed,
    connections: mongoose.Schema.Types.Mixed,
    planetTexture: mongoose.Schema.Types.Mixed,
    categoryColors: mongoose.Schema.Types.Mixed,
    categoryDistancesMain: mongoose.Schema.Types.Mixed,
    categoryDistances: mongoose.Schema.Types.Mixed
}, {
    timestamps: true,
    strict: false // Allow dynamic structure if it changes
});

module.exports = mongoose.model('SpaceConfig', spaceConfigSchema);
