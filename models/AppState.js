const mongoose = require('mongoose');

const appStateSchema = new mongoose.Schema({
    projectId: { type: String, required: true, unique: true, default: 'diplomatura' },
    exportDate: { type: Date, default: Date.now },
    totalNodes: { type: Number, default: 0 },
    categories: { type: [String], default: [] },
    categoryChildren: { type: Map, of: [String], default: {} },
    config: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} }
}, {
    timestamps: true
});

module.exports = mongoose.model('AppState', appStateSchema);
