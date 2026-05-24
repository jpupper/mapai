const mongoose = require('mongoose');

const rankingPVSchema = new mongoose.Schema({
    projectId: { type: String, required: true, default: 'diplomatura', index: true },
    playerName: { type: String, required: true },
    score: { type: Number, required: true },
    correctAnswers: { type: Number, default: 0 },
    wrongAnswers: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    gameTime: { type: Number, default: 0 },
    date: { type: Date, default: Date.now },
    planetsVisited: { type: Number, default: 10 }
}, {
    timestamps: true
});

module.exports = mongoose.model('RankingPV', rankingPVSchema);
