const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true }, // Slug for URLs (e.g. 'diplomatura')
    name: { type: String, required: true },
    description: { type: String },
    ownerUsername: { type: String, required: true, index: true, default: 'ADMIN' },
    isPublic: { type: Boolean, default: true, index: true },
    // Config related to the project
    config: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    thumbnail: { type: String } // Base64 PNG thumbnail
}, {
    timestamps: true
});

module.exports = mongoose.model('Project', projectSchema);
