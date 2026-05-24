import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Ranking } from './Ranking.js';

export class PlanetVisitorManager {
    constructor(universe) {
        this.universe = universe;
        this.state = 'idle';
        this.visitedPlanets = [];
        this.visitedIds = new Set();
        this.currentPlanet = null;
        const G = CONFIG.game || {};
        this.totalPlanetsToVisit = G.pvTotalPlanets || 10;
        this.score = 0;

        this.evalQuestions = [];
        this.evalCurrentIndex = 0;
        this.correctCount = 0;
        this.wrongCount = 0;
        this.evalTimerInterval = null;
        this.evalTimeLeft = 0;

        this.ranking = new Ranking('planet_visitor');
        this.playerName = '';
        this.finalScore = 0;

        this._visitedRings = [];

        this._autoAdvanceTimer = null;
        this._countdownInterval = null;

        this.dom = {};
    }

    bindUI() {
        this.dom.pvScreen = document.getElementById('pv-screen');
        this.dom.pvTitle = document.getElementById('pv-title');
        this.dom.pvCurrentPlanet = document.getElementById('pv-current-planet');
        this.dom.pvProgress = document.getElementById('pv-progress');
        this.dom.pvScore = document.getElementById('pv-score');
        this.dom.pvOptions = document.getElementById('pv-options');
        this.dom.pvPlanetInfo = document.getElementById('pv-planet-info');
        this.dom.pvPlanetInfoContent = document.getElementById('pv-planet-info-content');

        this.dom.pvEvalScreen = document.getElementById('pv-eval-screen');
        this.dom.pvEvalDescription = document.getElementById('pv-eval-description');
        this.dom.pvEvalOptions = document.getElementById('pv-eval-options');
        this.dom.pvEvalProgress = document.getElementById('pv-eval-progress');
        this.dom.pvEvalFeedback = document.getElementById('pv-eval-feedback');
        this.dom.pvEvalTimer = document.getElementById('pv-eval-timer');
        this.dom.pvEvalRunningScore = document.getElementById('pv-eval-running-score');

        this.dom.pvResultsScreen = document.getElementById('pv-results-screen');
        this.dom.pvResultsVisited = document.getElementById('pv-results-visited');
        this.dom.pvResultsCorrect = document.getElementById('pv-results-correct');
        this.dom.pvResultsWrong = document.getElementById('pv-results-wrong');
        this.dom.pvResultsScore = document.getElementById('pv-results-score');
        this.dom.pvResultsRankingName = document.getElementById('pv-results-ranking-name');
        this.dom.pvResultsRankingSubmit = document.getElementById('pv-results-ranking-submit');
        this.dom.pvResultsRankingList = document.getElementById('pv-results-ranking-list');
        this.dom.pvResultsReplay = document.getElementById('pv-results-replay');
        this.dom.pvAutoCountdown = document.getElementById('pv-auto-countdown');
        this.dom.pvAutoAdvanceFill = document.getElementById('pv-auto-advance-fill');
        this.dom.pvResultsExplore = document.getElementById('pv-results-explore');

        this.dom.pvBriefing = document.getElementById('pv-briefing');
        this.dom.pvBriefingCountdown = document.getElementById('pv-briefing-countdown');

        if (this.dom.pvResultsRankingSubmit) {
            this.dom.pvResultsRankingSubmit.addEventListener('click', () => this.submitInlineRanking());
        }
        if (this.dom.pvResultsReplay) {
            this.dom.pvResultsReplay.addEventListener('click', () => this.startGame());
        }
        if (this.dom.pvResultsExplore) {
            this.dom.pvResultsExplore.addEventListener('click', () => this.exitToExploration());
        }

        // PV ranking doesn't need to bind to the shared ranking screen UI
        // It only uses getLeaderboard() and saveToLeaderboard() for inline results
    }

    getAllToolNodes() {
        const nodes = this.universe.DATA.nodes;
        return Object.values(nodes).filter(n => n.type === 'tool');
    }

    startGame() {
        this.showBriefing(() => this._doStartGame());
    }

    showBriefing(callback) {
        if (!this.dom.pvBriefing) {
            callback();
            return;
        }

        this._hideAllScreens();

        this.dom.pvBriefing.classList.add('visible');
        let count = 3;
        if (this.dom.pvBriefingCountdown) this.dom.pvBriefingCountdown.textContent = count;

        const countInterval = setInterval(() => {
            count--;
            if (count > 0) {
                if (this.dom.pvBriefingCountdown) this.dom.pvBriefingCountdown.textContent = count;
            } else {
                clearInterval(countInterval);
                this.dom.pvBriefing.classList.remove('visible');
                callback();
            }
        }, 1000);
    }

    _doStartGame() {
        this.state = 'visiting';
        this.visitedPlanets = [];
        this.visitedIds = new Set();
        this.currentPlanet = null;
        this.score = 0;
        this.correctCount = 0;
        this.wrongCount = 0;
        this.evalQuestions = [];
        this.evalCurrentIndex = 0;
        this.finalScore = 0;

        this._visitedRings.forEach(r => {
            if (r.parent) r.parent.remove(r);
            r.geometry.dispose();
            r.material.dispose();
        });
        this._visitedRings = [];

        this._hideAllScreens();

        document.getElementById('view-mode-toggle').style.display = 'none';
        document.getElementById('connections-toggle').style.display = 'none';
        document.getElementById('info-panel').classList.remove('visible');
        const navArrows = document.getElementById('nav-arrows');
        if (navArrows) navArrows.style.display = 'none';
        
        // Hide category interface in PLANET VISITOR mode
        const universeIndicator = document.getElementById('universe-indicator');
        const catDots = document.getElementById('cat-dots');
        if (universeIndicator) universeIndicator.style.display = 'none';
        if (catDots) catDots.style.display = 'none';

        this._pickRandomStartAndWarp();
    }

    _pickRandomStartAndWarp() {
        const allTools = this.getAllToolNodes();
        const startNode = allTools[Math.floor(Math.random() * allTools.length)];
        const planet = this.universe.getPlanetById(startNode.id);
        if (planet) {
            this.universe.setActivePlanet(planet);
            this.universe.setViewMode('camera');
            const targetPos = planet.getWorldPosition();
            const G = CONFIG.game || {};
            const stopDist = G.pvStopDistance || 120;
            const arrivalDelay = (G.pvArrivalDelay !== undefined ? G.pvArrivalDelay : 1000);
            this.universe.cam.startWarp(targetPos, stopDist, () => {
                this.universe.cam.initFollowFrom(planet.getWorldPosition());
                this._registerVisit(planet);
                setTimeout(() => {
                    this._startPlanetObservation(planet.node);
                }, arrivalDelay);
            }, planet);
        }
    }

    _registerVisit(planet) {
        if (!planet || !planet.node) return;
        if (this.visitedIds.has(planet.node.id)) return;
        this.visitedIds.add(planet.node.id);
        this.visitedPlanets.push(planet.node);
        this.currentPlanet = planet;

        const G = CONFIG.game || {};
        const pts = G.pvPointsPerVisit || 100;
        this.score += pts;

        this._addVisitedRing(planet);
    }

    _addVisitedRing(planet) {
        const pRadius = planet.mesh.geometry?.parameters?.radius || 30;
        const ringGeo = new THREE.RingGeometry(pRadius * 1.4, pRadius * 1.55, 32);
        const catColors = CONFIG.categoryColors || {};
        const catId = planet.category || planet.id;
        const color = new THREE.Color(catColors[catId] || 0xb44dff);
        const ringMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        planet.mesh.add(ring);
        this._visitedRings.push(ring);
    }

    _startAutoAdvanceTimer(durationSecs, onComplete, countdownEl, fillEl) {
        this._clearAutoAdvanceTimer();
        const totalSecs = durationSecs;
        let remaining = totalSecs;
        const subSecs = 0.1; // For smoother bar

        const updateUI = () => {
            if (countdownEl) countdownEl.textContent = Math.ceil(remaining);
            if (fillEl) {
                fillEl.style.width = `${(remaining / totalSecs) * 100}%`;
            }
        };
        updateUI();

        this._countdownInterval = setInterval(() => {
            remaining -= subSecs;
            if (remaining <= 0) {
                remaining = 0;
                updateUI();
                this._clearAutoAdvanceTimer();
                onComplete();
            } else {
                updateUI();
            }
        }, subSecs * 1000);
    }

    _clearAutoAdvanceTimer() {
        if (this._autoAdvanceTimer) {
            clearTimeout(this._autoAdvanceTimer);
            this._autoAdvanceTimer = null;
        }
        if (this._countdownInterval) {
            clearInterval(this._countdownInterval);
            this._countdownInterval = null;
        }
    }

    _startPlanetObservation(node) {
        this._hideAllScreens();
        this._showPlanetInfo(node);

        const G = CONFIG.game || {};
        const duration = G.pvInfoDisplayTime || 5;

        // Add a "Siguiente" button to the info content
        const btn = document.createElement('button');
        btn.className = 'neon-btn pv-continue-btn';
        btn.style.marginTop = '20px';
        btn.style.width = '100%';
        btn.innerHTML = `CONTINUAR <span id="pv-info-countdown">${duration}</span>s`;
        btn.onclick = () => {
            this._clearAutoAdvanceTimer();
            this._showPlanetSelectionScreen();
        };
        this.dom.pvPlanetInfoContent.appendChild(btn);

        const countdownEl = document.getElementById('pv-info-countdown');
        this._startAutoAdvanceTimer(duration, () => {
            this._showPlanetSelectionScreen();
        }, countdownEl, null);
    }

    _showPlanetSelectionScreen() {
        this._hideAllScreens();
        
        if (this.visitedPlanets.length >= this.totalPlanetsToVisit) {
            this._endVisiting();
            return;
        }

        const candidates = this._getCandidates(5);
        if (candidates.length === 0) {
            this._endVisiting();
            return;
        }

        const G = CONFIG.game || {};
        this._startAutoAdvanceTimer(G.pvAutoAdvanceTime || 5, () => {
            const cands = this._getCandidates(1);
            if (cands.length > 0) this._selectPlanet(cands[0]);
            else this._endVisiting();
        }, this.dom.pvAutoCountdown, this.dom.pvAutoAdvanceFill);

        if (this.dom.pvScreen) {
            void this.dom.pvScreen.offsetWidth; // Force reflow
            this.dom.pvScreen.classList.add('visible');
            this.dom.pvScreen.style.setProperty('display', 'flex', 'important');
            this.dom.pvScreen.style.setProperty('visibility', 'visible', 'important');
            this.dom.pvScreen.style.setProperty('opacity', '1', 'important');
            this.dom.pvScreen.style.setProperty('pointer-events', 'auto', 'important');
            this.dom.pvScreen.style.setProperty('z-index', '3000', 'important');
        }
        if (this.dom.pvCurrentPlanet) {
            this.dom.pvCurrentPlanet.textContent = this.currentPlanet.node.label || this.currentPlanet.node.id;
        }
        if (this.dom.pvProgress) {
            this.dom.pvProgress.textContent = `Planeta ${this.visitedPlanets.length} de ${this.totalPlanetsToVisit}`;
        }
        if (this.dom.pvScore) {
            this.dom.pvScore.textContent = `${this.score} PTS`;
        }
        if (this.dom.pvOptions) {
            this.dom.pvOptions.innerHTML = '';
            candidates.forEach((node) => {
                const btn = document.createElement('button');
                btn.className = 'pv-option-btn';

                const planet = this.universe.getPlanetById(node.id);
                const catName = planet ? (planet.category || '') : '';
                const catColors = CONFIG.categoryColors || {};
                const catId = planet ? (planet.category || planet.id) : '';
                const colorHex = catColors[catId];
                let colorStr = 'rgba(180, 77, 255, 0.8)';
                if (colorHex !== undefined) {
                    const c = new THREE.Color(colorHex);
                    colorStr = `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
                }

                btn.innerHTML = `
                    <span class="pv-option-dot" style="background:${colorStr};box-shadow:0 0 8px ${colorStr}"></span>
                    <span class="pv-option-info">
                        <span class="pv-option-name">${node.label || node.id}</span>
                        <span class="pv-option-cat">${catName}</span>
                    </span>
                `;
                btn.addEventListener('click', () => this._selectPlanet(node));
                this.dom.pvOptions.appendChild(btn);
            });
        }
    }

    _showPlanetInfo(node) {
        if (!this.dom.pvPlanetInfo || !this.dom.pvPlanetInfoContent) return;
        let html = '';
        if (node.infoHTML) {
            html += node.infoHTML.replace(/\\n/g, '\n');
        } else {
            html += `<h3>${node.label || node.id}</h3>`;
            if (node.info) html += `<p>${node.info}</p>`;
        }
        if (node.url) {
            html += `<p style="margin-top:12px"><a href="${node.url}" target="_blank">${node.url}</a></p>`;
        }
        this.dom.pvPlanetInfoContent.innerHTML = html;
        
        // Don't apply inline styles - let CSS handle everything through applyPlanetVisitorFontSizes()
        if (this.dom.pvPlanetInfo) {
            void this.dom.pvPlanetInfo.offsetWidth; // Force reflow
            this.dom.pvPlanetInfo.classList.add('visible');
            this.dom.pvPlanetInfo.style.setProperty('display', 'block', 'important');
            this.dom.pvPlanetInfo.style.setProperty('visibility', 'visible', 'important');
            this.dom.pvPlanetInfo.style.setProperty('opacity', '1', 'important');
            this.dom.pvPlanetInfo.style.setProperty('pointer-events', 'auto', 'important');
            this.dom.pvPlanetInfo.style.setProperty('z-index', '3001', 'important');
        }
    }

    _getCandidates(count) {
        const allTools = this.getAllToolNodes();
        const unvisited = allTools.filter(n => !this.visitedIds.has(n.id));
        this._shuffleArray(unvisited);
        return unvisited.slice(0, count);
    }

    _selectPlanet(node) {
        this._clearAutoAdvanceTimer();
        if (this.dom.pvScreen) this.dom.pvScreen.classList.remove('visible');
        if (this.dom.pvPlanetInfo) this.dom.pvPlanetInfo.classList.remove('visible');

        const planet = this.universe.getPlanetById(node.id);
        if (!planet) return;

        this.universe.setActivePlanet(planet);
        const targetPos = planet.getWorldPosition();
        const G = CONFIG.game || {};
        const stopDist = G.pvStopDistance || 120;
        const arrivalDelay = (G.pvArrivalDelay !== undefined ? G.pvArrivalDelay : 1000);
        this.universe.cam.startWarp(targetPos, stopDist, () => {
            this.universe.cam.initFollowFrom(planet.getWorldPosition());
            this._registerVisit(planet);
            setTimeout(() => {
                this._startPlanetObservation(planet.node);
            }, arrivalDelay);
        }, planet);
    }

    _endVisiting() {
        this._hideAllScreens();
        this._clearAutoAdvanceTimer();
        this.state = 'evaluation';

        if (document.pointerLockElement) document.exitPointerLock();

        this.evalQuestions = [...this.visitedPlanets];
        this._shuffleArray(this.evalQuestions);
        this.evalCurrentIndex = 0;
        this.correctCount = 0;
        this.wrongCount = 0;

        if (this.evalQuestions.length === 0) {
            this._showResults();
            return;
        }

        this._showEvalScreen();
    }

    _showEvalScreen() {
        this._hideAllScreens();
        if (this.dom.pvEvalScreen) {
            void this.dom.pvEvalScreen.offsetWidth;
            this.dom.pvEvalScreen.classList.add('visible');
        }
        if (this.dom.pvEvalFeedback) {
            this.dom.pvEvalFeedback.textContent = '';
            this.dom.pvEvalFeedback.className = 'eval-feedback';
        }
        if (this.dom.pvEvalRunningScore) {
            this.dom.pvEvalRunningScore.textContent = `${Math.max(0, this.score)} PTS`;
        }
        this._showNextQuestion();
    }

    _showNextQuestion() {
        if (this._evalAdvanceTimer) { clearTimeout(this._evalAdvanceTimer); this._evalAdvanceTimer = null; }
        this._waitingForAdvance = false;
        if (this.evalCurrentIndex >= this.evalQuestions.length) {
            this.stopEvalTimer();
            if (this.dom.pvEvalScreen) this.dom.pvEvalScreen.classList.remove('visible');
            this._showResults();
            return;
        }

        const node = this.evalQuestions[this.evalCurrentIndex];
        if (this.dom.pvEvalProgress) {
            this.dom.pvEvalProgress.textContent = `Pregunta ${this.evalCurrentIndex + 1} de ${this.evalQuestions.length}`;
        }

        const description = this._extractDescription(node);
        if (this.dom.pvEvalDescription) {
            this.dom.pvEvalDescription.textContent = description || node.info || '(Sin descripci├│n)';
        }

        const correctLabel = node.label || node.id;
        const allTools = this.getAllToolNodes();
        const wrongOptions = allTools
            .filter(n => n.id !== node.id)
            .map(n => n.label || n.id);
        this._shuffleArray(wrongOptions);
        const options = [correctLabel, ...wrongOptions.slice(0, 4)];
        this._shuffleArray(options);

        if (this.dom.pvEvalOptions) {
            this.dom.pvEvalOptions.innerHTML = '';
            options.forEach((opt, idx) => {
                const btn = document.createElement('button');
                btn.className = 'eval-option-btn';
                btn.innerHTML = `<span class="eval-option-letter">${String.fromCharCode(65 + idx)}</span><span class="eval-option-text">${opt}</span>`;
                btn.addEventListener('click', () => this._handleAnswer(opt, correctLabel, btn));
                this.dom.pvEvalOptions.appendChild(btn);
            });
        }

        if (this.dom.pvEvalFeedback) {
            this.dom.pvEvalFeedback.textContent = '';
            this.dom.pvEvalFeedback.className = 'eval-feedback';
        }

        this.startEvalTimer();
    }

    _extractDescription(node) {
        let text = node.info || '';
        const label = node.label || '';
        if (text.startsWith(label)) {
            text = text.substring(label.length).trim();
        }
        return text;
    }

    _advanceEval() {
        if (this._evalAdvanceTimer) { clearTimeout(this._evalAdvanceTimer); this._evalAdvanceTimer = null; }
        this._waitingForAdvance = false;
        this.evalCurrentIndex++;
        this._showNextQuestion();
    }

    _handleAnswer(selected, correct, btnEl) {
        this.stopEvalTimer();
        const allBtns = this.dom.pvEvalOptions.querySelectorAll('.eval-option-btn');

        const G = CONFIG.game || {};
        const pointsCorrect = G.pvPointsCorrect || 200;
        const pointsWrong = G.pvPointsWrong || -50;

        if (selected === correct) {
            this.correctCount++;
            this.score += pointsCorrect;
            btnEl.classList.add('correct');
            if (this.dom.pvEvalFeedback) {
                this.dom.pvEvalFeedback.innerHTML = `<span class="feedback-icon">&#x2713;</span> CORRECTO! <span class="feedback-points">+${pointsCorrect} PTS</span>`;
                this.dom.pvEvalFeedback.className = 'eval-feedback correct';
            }
        } else {
            this.wrongCount++;
            this.score += pointsWrong;
            btnEl.classList.add('wrong');
            allBtns.forEach(b => {
                const textEl = b.querySelector('.eval-option-text');
                if (textEl && textEl.textContent === correct) b.classList.add('correct');
            });
            if (this.dom.pvEvalFeedback) {
                this.dom.pvEvalFeedback.innerHTML = `<span class="feedback-icon">&#x2717;</span> INCORRECTO <span class="feedback-points">${pointsWrong} PTS</span>`;
                this.dom.pvEvalFeedback.className = 'eval-feedback wrong';
            }
        }

        if (this.dom.pvEvalRunningScore) {
            this.dom.pvEvalRunningScore.textContent = `${Math.max(0, this.score)} PTS`;
            this.dom.pvEvalRunningScore.classList.add('score-updated');
            setTimeout(() => this.dom.pvEvalRunningScore.classList.remove('score-updated'), 600);
        }

        // Re-enable buttons so the user can click to advance immediately.
        // Any click on an option after answering advances to the next question.
        this._waitingForAdvance = true;
        allBtns.forEach(b => {
            b.disabled = false;
            b.addEventListener('click', () => { if (this._waitingForAdvance) this._advanceEval(); }, { once: true });
        });

        // Auto-advance after 2s if user doesn't click
        this._evalAdvanceTimer = setTimeout(() => this._advanceEval(), 2000);
    }

    handleEvalTimeout() {
        const G = CONFIG.game || {};
        const pointsWrong = G.pvPointsWrong || -50;
        this.wrongCount++;
        this.score += pointsWrong;

        if (this.dom.pvEvalFeedback) {
            this.dom.pvEvalFeedback.innerHTML = `<span class="feedback-icon">&#x23F0;</span> TIEMPO! <span class="feedback-points">${pointsWrong} PTS</span>`;
            this.dom.pvEvalFeedback.className = 'eval-feedback wrong';
        }

        const allBtns = this.dom.pvEvalOptions?.querySelectorAll('.eval-option-btn');
        if (allBtns) allBtns.forEach(b => { b.disabled = true; });

        if (this.dom.pvEvalRunningScore) {
            this.dom.pvEvalRunningScore.textContent = `${Math.max(0, this.score)} PTS`;
        }

        this._evalAdvanceTimer = setTimeout(() => this._advanceEval(), 2000);
    }

    startEvalTimer() {
        this.stopEvalTimer();
        const G = CONFIG.game || {};
        this.evalTimeLeft = G.evalTimePerQuestion || 30;
        this._updateEvalTimerDisplay();
        this.evalTimerInterval = setInterval(() => {
            this.evalTimeLeft -= 1;
            this._updateEvalTimerDisplay();
            if (this.evalTimeLeft <= 0) {
                this.stopEvalTimer();
                this.handleEvalTimeout();
            }
        }, 1000);
    }

    stopEvalTimer() {
        if (this.evalTimerInterval) {
            clearInterval(this.evalTimerInterval);
            this.evalTimerInterval = null;
        }
    }

    _updateEvalTimerDisplay() {
        if (this.dom.pvEvalTimer) {
            this.dom.pvEvalTimer.textContent = this.evalTimeLeft;
            if (this.evalTimeLeft <= 10) {
                this.dom.pvEvalTimer.classList.add('warning');
            } else {
                this.dom.pvEvalTimer.classList.remove('warning');
            }
        }
    }

    _showResults() {
        this.state = 'results';
        this.finalScore = Math.max(0, this.score);

        if (this.dom.pvResultsVisited) this.dom.pvResultsVisited.textContent = this.visitedPlanets.length;
        if (this.dom.pvResultsCorrect) this.dom.pvResultsCorrect.textContent = this.correctCount;
        if (this.dom.pvResultsWrong) this.dom.pvResultsWrong.textContent = this.wrongCount;
        if (this.dom.pvResultsScore) this.dom.pvResultsScore.textContent = this.finalScore;
        if (this.dom.pvResultsScreen) {
            void this.dom.pvResultsScreen.offsetWidth;
            this.dom.pvResultsScreen.classList.add('visible');
        }

        if (this.dom.pvResultsRankingName) {
            this.dom.pvResultsRankingName.value = '';
            this.dom.pvResultsRankingName.disabled = false;
        }
        if (this.dom.pvResultsRankingSubmit) this.dom.pvResultsRankingSubmit.disabled = false;

        this._inlineRankingPlayerName = '';
        this._renderInlineRankingList();
    }

    async submitInlineRanking() {
        const name = (this.dom.pvResultsRankingName?.value || '').trim();
        if (!name) return;
        this._inlineRankingPlayerName = name;

        await this.ranking.saveToLeaderboard(name, this.finalScore, {
            correctAnswers: this.correctCount,
            wrongAnswers: this.wrongCount,
            totalQuestions: this.evalQuestions.length,
            planetsVisited: this.visitedPlanets.length
        });

        await this._renderInlineRankingList();
        if (this.dom.pvResultsRankingName) this.dom.pvResultsRankingName.disabled = true;
        if (this.dom.pvResultsRankingSubmit) this.dom.pvResultsRankingSubmit.disabled = true;
    }

    async _renderInlineRankingList() {
        const listEl = this.dom.pvResultsRankingList;
        if (!listEl) return;

        listEl.innerHTML = '<div class="ranking-loading">Cargando...</div>';

        const rankings = await this.ranking.getLeaderboard();

        if (rankings.length === 0) {
            listEl.innerHTML = '<div class="ranking-empty">No hay puntajes todav&iacute;a</div>';
            return;
        }
        let html = '';
        rankings.slice(0, 10).forEach((entry, i) => {
            const isMe = entry.playerName === this._inlineRankingPlayerName && entry.score === this.finalScore;
            const posClass = i === 0 ? 'pos-gold' : i === 1 ? 'pos-silver' : i === 2 ? 'pos-bronze' : '';
            const medal = i === 0 ? '&#x1F947;' : i === 1 ? '&#x1F948;' : i === 2 ? '&#x1F949;' : `${i + 1}.`;
            html += `<div class="ranking-row${isMe ? ' ranking-highlight' : ''} ${posClass}">`;
            html += `<span class="ranking-pos">${medal}</span>`;
            html += `<span class="ranking-name">${entry.playerName}</span>`;
            html += `<span class="ranking-score">${entry.score}</span>`;
            html += `</div>`;
        });
        listEl.innerHTML = html;
    }

    showRankingScreen() {
        this.state = 'ranking';
        this._hideAllScreens();
        this.universe._showDualRanking();
    }

    exitToExploration() {
        this.state = 'idle';
        this._hideAllScreens();

        this._visitedRings.forEach(r => {
            if (r.parent) r.parent.remove(r);
            r.geometry.dispose();
            r.material.dispose();
        });
        this._visitedRings = [];

        document.getElementById('view-mode-toggle').style.display = '';
        document.getElementById('connections-toggle').style.display = '';
        const navArrows = document.getElementById('nav-arrows');
        if (navArrows) navArrows.style.display = '';
        
        // Restore category interface when exiting PLANET VISITOR mode
        const universeIndicator = document.getElementById('universe-indicator');
        const catDots = document.getElementById('cat-dots');
        if (universeIndicator) universeIndicator.style.display = '';
        if (catDots) catDots.style.display = '';

        this.universe.setViewMode('global');
    }

    _hideAllScreens() {
        const screens = [
            this.dom.pvScreen,
            this.dom.pvPlanetInfo,
            this.dom.pvEvalScreen,
            this.dom.pvResultsScreen,
            this.dom.pvBriefing,
            document.getElementById('ranking-screen')
        ];

        screens.forEach(s => {
            if (s) {
                s.classList.remove('visible');
                s.style.opacity = '';
                s.style.visibility = '';
                s.style.display = '';
                s.style.pointerEvents = '';
                s.style.zIndex = '';
            }
        });
    }

    _shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }
}
