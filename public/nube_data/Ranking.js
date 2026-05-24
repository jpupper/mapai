import { CONFIG } from './config.js';

// ═══════════════════════════════════════════════
//  CLASS: Ranking — Leaderboard system
// ═══════════════════════════════════════════════

export class Ranking {
    constructor(gameMode = 'ship') {
        this.gameMode = gameMode;
        this.storageKey = gameMode === 'planet_visitor' ? 'nube_universos_ranking_pv' : 'nube_universos_ranking';
        this.playerName = '';
        this.finalScore = 0;
        this.gameStats = {};
        this.dom = {};

        // Detect base URL for API
        const parts = window.location.pathname.split('/').filter(Boolean);
        const basePath = (() => {
            const reserved = new Set(['api', 'nube_data', 'js', 'css', 'img', 'favicon.ico']);
            const app = parts[0];
            if (app === 'mapai' || app === 'diploia') {
                const tenant = parts[1] && !reserved.has(parts[1]) && !parts[1].includes('.') ? parts[1] : null;
                const base = `/${app}`;
                const bp = tenant ? `${base}/${tenant}` : base;
                const host = String(window.location.hostname || '').toLowerCase();
                if (host === 'fullscreencode.com' || host.endsWith('.fullscreencode.com')) {
                    const apiOrigin = (window.__DIPLOIA_API_ORIGIN__ ? String(window.__DIPLOIA_API_ORIGIN__) : 'https://vps-4455523-x.dattaweb.com').replace(/\/+$/, '');
                    const remoteBase = app === 'mapai' ? '/diploia' : '/diploia/diploia';
                    const remotePath = tenant && app === 'mapai' ? `${remoteBase}/${tenant}` : remoteBase;
                    return apiOrigin + remotePath;
                }
                return window.location.origin + bp;
            }
            return window.location.origin;
        })();
        const endpoint = gameMode === 'planet_visitor' ? '/api/ranking_pv' : '/api/ranking';
        this.apiBase = basePath + endpoint;
        this.project = this.getCurrentProject();
    }

    getCurrentProject() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('project') || 'diplomatura';
    }

    bindUI() {
        this.dom.rankingScreen = document.getElementById('ranking-screen');
        this.dom.rankingNameInput = document.getElementById('ranking-name-input');
        this.dom.rankingSubmit = document.getElementById('ranking-submit');
        this.dom.rankingList = document.getElementById('ranking-list');
        this.dom.rankingClose = document.getElementById('ranking-close');
        this.dom.rankingInputRow = document.getElementById('ranking-input-row');

        if (this.dom.rankingSubmit) {
            this.dom.rankingSubmit.addEventListener('click', () => this.submitRanking());
        }
        if (this.dom.rankingClose) {
            this.dom.rankingClose.addEventListener('click', () => {
                if (this.onClose) this.onClose();
            });
        }
    }

    show(score, stats = {}, showInput = true) {
        console.log('🏅 Ranking: show() called', { score, stats, showInput });
        this.finalScore = score;
        this.gameStats = stats;
        this.playerName = '';

        if (this.dom.rankingInputRow) {
            this.dom.rankingInputRow.style.display = showInput ? 'flex' : 'none';
        }

        if (this.dom.rankingScreen) {
            console.log('✅ Ranking screen found, adding .visible');
            this.dom.rankingScreen.classList.add('visible');
        } else {
            console.error('❌ Ranking screen NOT found in DOM!');
        }
        if (this.dom.rankingNameInput) {
            this.dom.rankingNameInput.value = '';
            this.dom.rankingNameInput.disabled = false;
        }
        if (this.dom.rankingSubmit) this.dom.rankingSubmit.disabled = false;
        this.renderList();
    }

    hide() {
        if (this.dom.rankingScreen) this.dom.rankingScreen.classList.remove('visible');
        if (this.dom.rankingNameInput) this.dom.rankingNameInput.disabled = false;
        if (this.dom.rankingSubmit) this.dom.rankingSubmit.disabled = false;
    }

    async submitRanking() {
        const name = (this.dom.rankingNameInput?.value || '').trim();
        if (!name) return;
        this.playerName = name;

        // Disable UI during save
        if (this.dom.rankingNameInput) this.dom.rankingNameInput.disabled = true;
        if (this.dom.rankingSubmit) this.dom.rankingSubmit.disabled = true;

        await this.saveToLeaderboard(name, this.finalScore, this.gameStats);
        await this.renderList();
    }

    async saveToLeaderboard(name, score, stats = {}) {
        // 1. Save to LocalStorage (legacy/fallback)
        try {
            let localRankings = JSON.parse(localStorage.getItem(this.storageKey)) || [];
            localRankings.push({ name, score, date: new Date().toISOString() });
            localRankings.sort((a, b) => b.score - a.score);
            localStorage.setItem(this.storageKey, JSON.stringify(localRankings.slice(0, 50)));
        } catch (e) { console.warn('LocalStorage error:', e); }

        // 2. Save to Server API
        try {
            const url = `${this.apiBase}?project=${this.project}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerName: name,
                    score: score,
                    correctAnswers: stats.correctAnswers || 0,
                    wrongAnswers: stats.wrongAnswers || 0,
                    totalQuestions: stats.totalQuestions || 0,
                    gameTime: stats.gameTime || 0,
                    date: new Date().toISOString()
                })
            });
            if (!response.ok) throw new Error('API save failed');
            console.log('✅ Ranking guardado en el servidor');
        } catch (error) {
            console.error('❌ Error guardando ranking en servidor:', error);
        }
    }

    async getLeaderboard() {
        try {
            const url = `${this.apiBase}?project=${this.project}`;
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                return data.rankings || [];
            }
        } catch (error) {
            console.error('Error fetching rankings from server:', error);
        }

        // Fallback to localStorage if server fails
        try {
            const local = JSON.parse(localStorage.getItem(this.storageKey)) || [];
            // Map local format to server format for rendering
            return local.map(r => ({ playerName: r.name, score: r.score, date: r.date }));
        } catch (e) { return []; }
    }

    async renderList() {
        const listEl = this.dom.rankingList || document.getElementById('ranking-list');
        if (!listEl) return;

        // Show loading state if currently empty
        if (listEl.innerHTML === '') {
            listEl.innerHTML = '<div class="ranking-loading">Cargando rankings...</div>';
        }

        const rankings = await this.getLeaderboard();

        if (rankings.length === 0) {
            listEl.innerHTML = '<div class="ranking-empty">No hay puntajes todavía</div>';
            return;
        }

        let html = '';
        rankings.slice(0, 10).forEach((entry, i) => {
            const isMe = entry.playerName === this.playerName && entry.score === this.finalScore;
            const posClass = i === 0 ? 'pos-gold' : i === 1 ? 'pos-silver' : i === 2 ? 'pos-bronze' : '';
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            html += `<div class="ranking-row${isMe ? ' ranking-highlight' : ''} ${posClass}">`;
            html += `<span class="ranking-pos">${medal}</span>`;
            html += `<span class="ranking-name">${entry.playerName}</span>`;
            html += `<span class="ranking-score">${entry.score}</span>`;
            html += `</div>`;
        });
        listEl.innerHTML = html;
    }
}
