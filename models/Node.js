const mongoose = require('mongoose');

const nodeSchema = new mongoose.Schema({
    id: { type: String, required: true }, // Not unique anymore, unique within project
    projectId: { type: String, required: true, default: 'diplomatura', index: true },
    label: { type: String, required: true },
    type: { type: String },
    url: { type: String },
    info: { type: String },
    infoHTML: { type: String },
    connections: {
        parent: [{ id: String, type: { type: String } }],
        children: [{ id: String, type: { type: String } }],
        secondary: [String]
    },
    parentCategory: { type: String }
}, {
    timestamps: true
});

// Compound index to ensure uniqueness within a project
nodeSchema.index({ id: 1, projectId: 1 }, { unique: true });

module.exports = mongoose.model('Node', nodeSchema);
