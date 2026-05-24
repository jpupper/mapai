const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
}, {
    timestamps: true
});

userSchema.pre('save', function (next) {
    if (this.username) this.username = String(this.username).trim().toUpperCase();
    next();
});

module.exports = mongoose.model('User', userSchema);

