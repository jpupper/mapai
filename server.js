require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Models
const Node = require('./models/Node');
const Ranking = require('./models/Ranking');
const RankingPV = require('./models/RankingPV');
const AppState = require('./models/AppState');
const SpaceConfig = require('./models/SpaceConfig');
const Project = require('./models/Project');
const User = require('./models/User');

const app = express();
const port = process.env.PORT || 4560;
const APP_PATH = process.env.BASE_PATH ? process.env.BASE_PATH.replace(/\//g, '') : 'mapai';
const DIPLOIA_PUBLIC_DIR = path.join(__dirname, 'public');
const FRONT_PUBLIC_DIR = path.join(__dirname, 'public_front');

function isDiploiaHost(hostname) {
    const host = String(hostname || '').toLowerCase();
    const configured = String(process.env.DIPLOIA_HOSTNAMES || '')
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
    if (configured.length > 0) return configured.includes(host);
    return host === 'diploia' || host.startsWith('diploia.');
}

// ===============================================================
//  CORS configuration
// ===============================================================
app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Middleware
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

app.get('/favicon.ico', (req, res) => res.status(204).end());
for (const basePath of Array.from(new Set([APP_PATH, 'mapai']))) {
    app.get(`/${basePath}/favicon.ico`, (req, res) => res.status(204).end());
}
app.get('/@vite/client', (req, res) => res.status(204).end());

app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (!req.originalUrl.includes('.html/')) return next();
    const url = req.originalUrl.replace(/\.html\/(\?|$)/, '.html$1');
    if (url === req.originalUrl) return next();
    return res.redirect(302, url);
});

// ===============================================================
//  AUTH
// ===============================================================
const ADMIN_USERNAME = 'ADMIN';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.ADMIN_PASS || 'rty456fgh';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const FSCAUTH_VERIFY_URL = process.env.FSCAUTH_VERIFY_URL || process.env.FSCAUTH_VERIFY || 'http://localhost:3027/fscauth/api/auth/verify';

function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

function getBearerToken(req) {
    const header = req.get('Authorization') || '';
    const [type, token] = header.split(' ');
    if (type !== 'Bearer' || !token) return null;
    return token;
}

function getCookieToken(req, cookieName) {
    const cookieHeader = req.get('cookie') || '';
    const parts = cookieHeader.split(';');
    for (const part of parts) {
        const [rawName, ...rest] = part.trim().split('=');
        if (!rawName) continue;
        if (rawName === cookieName) return decodeURIComponent(rest.join('=') || '');
    }
    return null;
}

function normalizeAppRole(role) {
    const r = String(role || '').trim().toUpperCase();
    if (r === 'ADMIN' || r === 'SYSTEM') return 'admin';
    if (r === 'USER') return 'user';
    return String(role || '').trim().toLowerCase() || 'user';
}

function httpGetJson(url, headers = {}) {
    return new Promise((resolve, reject) => {
        try {
            const target = new URL(url);
            const lib = target.protocol === 'https:' ? require('https') : require('http');
            const req = lib.request({
                protocol: target.protocol,
                hostname: target.hostname,
                port: target.port,
                path: `${target.pathname}${target.search}`,
                method: 'GET',
                headers
            }, (res) => {
                let body = '';
                res.on('data', (chunk) => (body += chunk));
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(body || 'null'));
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            req.on('error', reject);
            req.end();
        } catch (e) {
            reject(e);
        }
    });
}

async function resolveAuthUser(req) {
    if (req._authUserResolved) return req._authUser || null;
    req._authUserResolved = true;

    const bearer = getBearerToken(req);
    const cookieToken = getCookieToken(req, 'fsc_token');
    const token = bearer || cookieToken;
    if (!token) return null;

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded?.username && decoded?.role) {
            const role = String(decoded.role || '').trim().toLowerCase();
            req._authUser = { username: String(decoded.username).trim().toUpperCase(), role: role === 'admin' ? 'admin' : 'user' };
            return req._authUser;
        }
    } catch (e) { }

    try {
        const data = await httpGetJson(FSCAUTH_VERIFY_URL, { Authorization: `Bearer ${token}` });
        if (!data?.loggedIn || !data?.user) return null;
        req._authUser = {
            id: data.user.id,
            email: data.user.email,
            username: String(data.user.username || data.user.email || '').trim().toUpperCase(),
            role: normalizeAppRole(data.user.role)
        };
        return req._authUser;
    } catch (e) {
        return null;
    }
}

async function requireAuth(req, res, next) {
    const user = await resolveAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;
    next();
}

async function requireAdmin(req, res, next) {
    const user = await resolveAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    req.user = user;
    next();
}

function getProjectIdFromReq(req) {
    return req.query.project || 'diplomatura';
}

function slugify(input) {
    return String(input || '')
        .trim()
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
}

function shortId() {
    return Math.random().toString(36).slice(2, 6);
}

function normalizeUrl(input) {
    if (input === undefined || input === null) return undefined;
    let s = String(input).trim();
    s = s.replace(/^`+/, '').replace(/`+$/, '').trim();
    s = s.replace(/^"+/, '').replace(/"+$/, '').trim();
    return s;
}

async function generateUniqueProjectId(base) {
    const safeBase = slugify(base) || 'mapa';
    if (safeBase !== 'diplomatura') {
        const existsBase = await Project.findOne({ id: safeBase }).lean();
        if (!existsBase) return safeBase;
    }
    let candidate = `${safeBase}-${shortId()}`;
    for (let i = 0; i < 8; i++) {
        const exists = await Project.findOne({ id: candidate }).lean();
        if (!exists) return candidate;
        candidate = `${safeBase}-${shortId()}`;
    }
    return `${safeBase}-${Date.now().toString(36).slice(-6)}`;
}

async function requireProjectWriteAccess(req, res, next) {
    const user = await resolveAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;

    const projectId = getProjectIdFromReq(req);
    const project = await Project.findOne({ id: projectId });
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });

    if (!project.ownerUsername) {
        project.ownerUsername = 'ADMIN';
        await project.save();
    }

    const owner = String(project.ownerUsername).trim().toUpperCase();
    if (user.role === 'admin' || owner === user.username) {
        req.project = project;
        return next();
    }

    return res.status(403).json({ error: 'Forbidden' });
}

async function requireProjectReadAccess(req, res, next) {
    const user = await resolveAuthUser(req);
    if (user) req.user = user;

    const projectId = getProjectIdFromReq(req);
    const project = await Project.findOne({ id: projectId });
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });

    if (!project.ownerUsername) {
        project.ownerUsername = 'ADMIN';
        await project.save();
    }

    const isPublic = project.isPublic !== false;
    if (isPublic) {
        req.project = project;
        return next();
    }

    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const owner = String(project.ownerUsername).trim().toUpperCase();
    if (user.role === 'admin' || owner === user.username) {
        req.project = project;
        return next();
    }

    return res.status(403).json({ error: 'Forbidden' });
}

// ===============================================================
//  DATABASE CONNECTION
// ===============================================================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/diploia';

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log(`[OK] Connected to MongoDB at ${MONGODB_URI}`);
        await cleanupUserIndexes();
        await ensureDefaultProject();
    })
    .catch(err => {
        console.error('[ERR] MongoDB connection error:', err);
        process.exit(1);
    });

async function cleanupUserIndexes() {
    try {
        const indexes = await mongoose.connection.db.collection('users').indexes();
        const hasEmailIndex = indexes?.some(i => i.name === 'email_1');
        if (hasEmailIndex) {
            await mongoose.connection.db.collection('users').dropIndex('email_1');
            console.log('[INIT] Dropped legacy users.email_1 index');
        }
    } catch (e) { }
}

async function ensureDefaultProject() {
    const Project = require('./models/Project');
    const Node = require('./models/Node');
    const AppState = require('./models/AppState');
    const SpaceConfig = require('./models/SpaceConfig');

    const defaultId = 'diplomatura';
    let project = await Project.findOne({ id: defaultId });
    if (!project) {
        project = await Project.create({
            id: defaultId,
            name: 'Diplomatura IA',
            description: 'Proyecto original',
            ownerUsername: 'ADMIN'
        });
        console.log(`[INIT] Created default project: ${defaultId}`);

        // Ensure Root node
        const root = await Node.findOne({ id: 'root', projectId: defaultId });
        if (!root) {
            await Node.create({
                id: 'root',
                projectId: defaultId,
                label: 'Diplomatura IA',
                type: 'root',
                connections: { parent: [], children: [], secondary: [] }
            });
            console.log('[INIT] Created root node for default project');
        }

        // Ensure App State
        const state = await AppState.findOne({ projectId: defaultId });
        if (!state) {
            await AppState.create({
                projectId: defaultId,
                categories: [],
                categoryChildren: {},
                config: {}
            });
        }
    }
}

// ===============================================================
//  HELPER FUNCTIONS - Data Reconstruction
// ===============================================================

async function getFullNodesData(projectId = 'diplomatura') {
    try {
        const query = (projectId === 'diplomatura') 
            ? { $or: [{ projectId: 'diplomatura' }, { projectId: { $exists: false } }] } 
            : { projectId };

        const [state, allNodes] = await Promise.all([
            AppState.findOne(query).lean() || { categories: [], categoryChildren: {}, config: {}, totalNodes: 0 },
            Node.find(query).lean()
        ]);

        const nodesMap = {};
        allNodes.forEach(n => {
            nodesMap[n.id] = n;
        });

        return {
            exportDate: state?.exportDate || new Date().toISOString(),
            totalNodes: allNodes.length,
            categories: state?.categories || [],
            categoryChildren: state?.categoryChildren || {},
            config: state?.config || {},
            nodes: nodesMap,
            projectId: projectId
        };
    } catch (error) {
        console.error(`Error fetching full nodes data for ${projectId}:`, error);
        return { nodes: {}, categories: [], totalNodes: 0, projectId };
    }
}

// ===============================================================
//  STATIC FILES
// ===============================================================

const diploiaStatic = express.static(DIPLOIA_PUBLIC_DIR);
const frontStatic = fs.existsSync(FRONT_PUBLIC_DIR) ? express.static(FRONT_PUBLIC_DIR) : (req, res, next) => next();

const mapaiMounts = Array.from(new Set([APP_PATH, 'mapai']));

app.use('/shared/js', express.static(path.join(DIPLOIA_PUBLIC_DIR, 'js')));
app.use('/shared/css', express.static(path.join(DIPLOIA_PUBLIC_DIR, 'css')));
app.use('/shared/img', express.static(path.join(DIPLOIA_PUBLIC_DIR, 'img')));
app.use('/shared/nube_data', express.static(path.join(DIPLOIA_PUBLIC_DIR, 'nube_data')));
for (const basePath of mapaiMounts) {
    app.use(`/${basePath}/shared/js`, express.static(path.join(DIPLOIA_PUBLIC_DIR, 'js')));
    app.use(`/${basePath}/shared/css`, express.static(path.join(DIPLOIA_PUBLIC_DIR, 'css')));
    app.use(`/${basePath}/shared/img`, express.static(path.join(DIPLOIA_PUBLIC_DIR, 'img')));
    app.use(`/${basePath}/shared/nube_data`, express.static(path.join(DIPLOIA_PUBLIC_DIR, 'nube_data')));
}

const tenantRouter = express.Router({ mergeParams: true });
tenantRouter.get('/admin', (req, res) => {
    res.sendFile(path.join(DIPLOIA_PUBLIC_DIR, 'admin.html'));
});
tenantRouter.use(diploiaStatic);
tenantRouter.get('/', (req, res) => {
    res.sendFile(path.join(DIPLOIA_PUBLIC_DIR, 'index.html'));
});

for (const basePath of mapaiMounts) {
    app.get(`/${basePath}/:tenant/favicon.ico`, (req, res) => res.status(204).end());
    app.use(`/${basePath}/:tenant`, (req, res, next) => {
        const tenant = String(req.params.tenant || '');
        const reserved = new Set(['api', 'nube_data', 'js', 'css', 'img', 'favicon.ico']);
        if (!tenant || tenant.includes('.') || reserved.has(tenant)) return next();
        return tenantRouter(req, res, next);
    });
    app.use(`/${basePath}/nube_data`, express.static(path.join(DIPLOIA_PUBLIC_DIR, 'nube_data')));
    app.use(`/${basePath}`, frontStatic);
    app.get(`/${basePath}`, (req, res) => res.redirect(302, `/${basePath}/`));
}

app.get('/admin', (req, res) => {
    if (!isDiploiaHost(req.hostname)) return res.status(404).end();
    res.sendFile(path.join(DIPLOIA_PUBLIC_DIR, 'admin.html'));
});

app.get('/health', (req, res) => {
    res.status(200).type('text/plain').send('DiploIA Server is ALIVE. Port: ' + port + '. Database: ' + (mongoose.connection.readyState === 1 ? 'CONNECTED' : 'DISCONNECTED'));
});

app.use((req, res, next) => {
    if (isDiploiaHost(req.hostname)) return diploiaStatic(req, res, next);
    return frontStatic(req, res, next);
});

// ═══════════════════════════════════════════════════════════════
//  API ROUTER
// ═══════════════════════════════════════════════════════════════
const apiRouter = express.Router();

// ═══════════════════════════════════════════════════════════════
//  API ROUTES - AUTH
// ═══════════════════════════════════════════════════════════════
apiRouter.post('/auth/register', async (req, res) => {
    try {
        const username = String(req.body.username || '').trim().toUpperCase();
        const password = String(req.body.password || '');

        if (!username) return res.status(400).json({ error: 'Usuario inválido' });
        if (username === ADMIN_USERNAME) return res.status(400).json({ error: 'Usuario reservado' });

        const existing = await User.findOne({ username });
        if (existing) return res.status(400).json({ error: 'El usuario ya existe' });

        const passwordHash = await bcrypt.hash(password, 10);
        await User.create({ username, passwordHash });

        const user = { username, role: 'user' };
        const token = signToken(user);
        return res.json({ token, user });
    } catch (e) {
        console.error('Auth register error:', e);
        return res.status(500).json({ error: 'Error al registrar usuario' });
    }
});

apiRouter.post('/auth/login', async (req, res) => {
    try {
        const username = String(req.body.username || '').trim().toUpperCase();
        const password = String(req.body.password || '');

        if (!username) return res.status(400).json({ error: 'Credenciales inválidas' });

        if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
            const user = { username: ADMIN_USERNAME, role: 'admin' };
            const token = signToken(user);
            return res.json({ token, user });
        }

        const dbUser = await User.findOne({ username });
        if (!dbUser) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

        const ok = await bcrypt.compare(password, dbUser.passwordHash);
        if (!ok) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

        const user = { username: dbUser.username, role: 'user' };
        const token = signToken(user);
        return res.json({ token, user });
    } catch (e) {
        console.error('Auth login error:', e);
        return res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});

apiRouter.get('/auth/me', requireAuth, async (req, res) => {
    res.json({ user: req.user });
});

apiRouter.get('/health', (req, res) => {
    res.json({
        ok: true,
        app: 'diploia',
        basePath: `/${APP_PATH}`,
        time: new Date().toISOString()
    });
});

// ═══════════════════════════════════════════════════════════════
//  API ROUTES - NODES
// ═══════════════════════════════════════════════════════════════

// GET all nodes data
apiRouter.get('/nodes', requireProjectReadAccess, async (req, res) => {
    const projectId = getProjectIdFromReq(req);
    const data = await getFullNodesData(projectId);
    res.json(data);
});

// GET single node
apiRouter.get('/nodes/:id', requireProjectReadAccess, async (req, res) => {
    try {
        const projectId = getProjectIdFromReq(req);
        const query = (projectId === 'diplomatura')
            ? { id: req.params.id, $or: [{ projectId: 'diplomatura' }, { projectId: { $exists: false } }] }
            : { id: req.params.id, projectId };

        const node = await Node.findOne(query);
        if (!node) {
            return res.status(404).json({ error: 'Nodo no encontrado' });
        }
        res.json({ node });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener el nodo' });
    }
});

// POST create node
apiRouter.post('/nodes', requireProjectWriteAccess, async (req, res) => {
    try {
        const projectId = req.query.project || 'diplomatura';
        const nodeData = { ...req.body, projectId };
        
        if (!nodeData.id) {
            return res.status(400).json({ error: 'El nodo requiere un ID' });
        }

        const query = (projectId === 'diplomatura') 
            ? { id: nodeData.id, $or: [{ projectId: 'diplomatura' }, { projectId: { $exists: false } }] } 
            : { id: nodeData.id, projectId };

        const existing = await Node.findOne(query);
        if (existing) {
            return res.status(400).json({ error: 'Ya existe un nodo con ese ID en este proyecto' });
        }

        const node = await Node.create(nodeData);
        
        // Update AppState
        let state = await AppState.findOne({ projectId });
        if (!state) {
            state = await AppState.create({ projectId });
        }
        
        // If it's a category, add to categories list
        if (node.type === 'category' && !state.categories.includes(node.id) && node.id !== 'root') {
            state.categories.push(node.id);
            if (state.categoryChildren instanceof Map) {
                if (!state.categoryChildren.has(node.id)) {
                    state.categoryChildren.set(node.id, []);
                }
            } else if (!state.categoryChildren[node.id]) {
                state.categoryChildren[node.id] = [];
            }
        }

        // If node has a parent category, add to categoryChildren
        if (node.parentCategory) {
            if (state.categoryChildren instanceof Map) {
                const currentChildren = state.categoryChildren.get(node.parentCategory) || [];
                if (!currentChildren.includes(node.id)) {
                    currentChildren.push(node.id);
                    state.categoryChildren.set(node.parentCategory, currentChildren);
                }
            } else {
                if (!state.categoryChildren[node.parentCategory]) {
                    state.categoryChildren[node.parentCategory] = [];
                }
                if (!state.categoryChildren[node.parentCategory].includes(node.id)) {
                    state.categoryChildren[node.parentCategory].push(node.id);
                }
            }
        }

        state.totalNodes = await Node.countDocuments({ projectId });
        await state.save();

        res.json({ success: true, node });
    } catch (error) {
        console.error('Error creating node:', error);
        res.status(500).json({ error: 'Error al crear el nodo' });
    }
});

// PUT update node
apiRouter.put('/nodes/:id', requireProjectWriteAccess, async (req, res) => {
    try {
        const projectId = req.query.project || 'diplomatura';
        const nodeId = req.params.id;
        const updates = req.body;

        const oldNode = await Node.findOne({ id: nodeId, projectId });
        if (!oldNode) return res.status(404).json({ error: 'Nodo no encontrado' });

        const oldParent = oldNode.parentCategory;
        const newParent = updates.parentCategory;

        const query = (projectId === 'diplomatura') 
            ? { $or: [{ projectId: 'diplomatura' }, { projectId: { $exists: false } }] } 
            : { projectId };

        // Update state logic
        let state = await AppState.findOne(query);
        if (!state) state = await AppState.create({ projectId });

        // Handle category list
        if (updates.type === 'category' && !state.categories.includes(nodeId) && nodeId !== 'root') {
            state.categories.push(nodeId);
            if (state.categoryChildren instanceof Map) {
                if (!state.categoryChildren.has(nodeId)) {
                    state.categoryChildren.set(nodeId, []);
                }
            } else {
                if (!state.categoryChildren[nodeId]) {
                    state.categoryChildren[nodeId] = [];
                }
            }
        }

        // Handle parent relationship sync
        if (oldParent !== newParent) {
            // 1. Remove from old parent
            if (oldParent) {
                if (state.categoryChildren instanceof Map) {
                    const oldChildren = state.categoryChildren.get(oldParent) || [];
                    state.categoryChildren.set(oldParent, oldChildren.filter(id => id !== nodeId));
                } else if (state.categoryChildren[oldParent]) {
                    state.categoryChildren[oldParent] = state.categoryChildren[oldParent].filter(id => id !== nodeId);
                }
                
                // Also update old parent node's connections.children
                const oldParentNode = await Node.findOne({ id: oldParent, projectId });
                if (oldParentNode && oldParentNode.connections) {
                    oldParentNode.connections.children = (oldParentNode.connections.children || []).filter(c => c.id !== nodeId);
                    await oldParentNode.save();
                }
            }

            // 2. Add to new parent
            if (newParent) {
                if (state.categoryChildren instanceof Map) {
                    const newChildren = state.categoryChildren.get(newParent) || [];
                    if (!newChildren.includes(nodeId)) {
                        newChildren.push(nodeId);
                        state.categoryChildren.set(newParent, newChildren);
                    }
                } else {
                    if (!state.categoryChildren[newParent]) state.categoryChildren[newParent] = [];
                    if (!state.categoryChildren[newParent].includes(nodeId)) {
                        state.categoryChildren[newParent].push(nodeId);
                    }
                }

                // Update new parent node's connections.children
                const newParentNode = await Node.findOne({ id: newParent, projectId });
                if (newParentNode) {
                    if (!newParentNode.connections) newParentNode.connections = { parent: [], children: [], secondary: [] };
                    if (!newParentNode.connections.children.some(c => c.id === nodeId)) {
                        newParentNode.connections.children.push({ id: nodeId, type: 'primary' });
                        await newParentNode.save();
                    }
                }
            }
        }

        await state.save();

        const updatedNode = await Node.findOneAndUpdate(
            { id: nodeId, projectId },
            { $set: updates },
            { new: true }
        );

        res.json({ success: true, node: updatedNode });
    } catch (error) {
        console.error('Error updating node:', error);
        res.status(500).json({ error: 'Error al actualizar el nodo' });
    }
});

// DELETE node
apiRouter.delete('/nodes/:id', requireProjectWriteAccess, async (req, res) => {
    try {
        const projectId = req.query.project || 'diplomatura';
        const nodeId = req.params.id;
        const node = await Node.findOne({ id: nodeId, projectId });
        if (!node) return res.status(404).json({ error: 'Nodo no encontrado' });

        await Node.deleteOne({ id: nodeId, projectId });

        const state = await AppState.findOne({ projectId });
        if (state) {
            // Remove from categories
            state.categories = state.categories.filter(c => c !== nodeId);
            
            // Remove from categoryChildren
            if (state.categoryChildren instanceof Map) {
                state.categoryChildren.delete(nodeId);
                // Remove from all other categoryChildren
                for (const [cat, children] of state.categoryChildren.entries()) {
                    if (children.includes(nodeId)) {
                        state.categoryChildren.set(cat, children.filter(id => id !== nodeId));
                    }
                }
            } else {
                delete state.categoryChildren[nodeId];
                for (const cat in state.categoryChildren) {
                    state.categoryChildren[cat] = state.categoryChildren[cat].filter(id => id !== nodeId);
                }
            }
            
            state.totalNodes = await Node.countDocuments({ projectId });
            await state.save();
        }

        // Clean up connections in other nodes of the same project
        await Node.updateMany(
            { projectId },
            {
                $pull: {
                    "connections.children": { id: nodeId },
                    "connections.parent": { id: nodeId },
                    "connections.secondary": nodeId
                }
            }
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting node:', error);
        res.status(500).json({ error: 'Error al eliminar el nodo' });
    }
});

// ═══════════════════════════════════════════════════════════════
//  API ROUTES - CATEGORIES
// ═══════════════════════════════════════════════════════════════

apiRouter.get('/categories', requireProjectReadAccess, async (req, res) => {
    try {
        const projectId = getProjectIdFromReq(req);
        const query = (projectId === 'diplomatura') 
            ? { $or: [{ projectId: 'diplomatura' }, { projectId: { $exists: false } }] } 
            : { projectId };
        const state = await AppState.findOne(query);
        if (!state) return res.json({ categories: [] });

        const categories = await Promise.all((state.categories || []).map(async catId => {
            const nodeQuery = (projectId === 'diplomatura')
                ? { id: catId, $or: [{ projectId: 'diplomatura' }, { projectId: { $exists: false } }] }
                : { id: catId, projectId };
            const node = await Node.findOne(nodeQuery);
            const children = state.categoryChildren instanceof Map ? state.categoryChildren.get(catId) : state.categoryChildren[catId];
            return {
                id: catId,
                label: node?.label || catId,
                childCount: (children || []).length
            };
        }));
        res.json({ categories });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener categorías' });
    }
});

apiRouter.post('/categories', requireProjectWriteAccess, async (req, res) => {
    try {
        const projectId = req.query.project || 'diplomatura';
        const { id, label, info, infoHTML } = req.body;
        if (!id || !label) return res.status(400).json({ error: 'Se requiere ID y label' });

        const existing = await Node.findOne({ id, projectId });
        if (existing) return res.status(400).json({ error: 'La categoría ya existe en este proyecto' });

        const node = await Node.create({
            id, label, type: 'category', projectId, info: info || label, infoHTML: infoHTML || `<h3>${label}</h3>`,
            connections: { parent: [{ id: 'root', type: 'primary' }], children: [], secondary: [] }
        });

        const stateQuery = (projectId === 'diplomatura') 
            ? { $or: [{ projectId: 'diplomatura' }, { projectId: { $exists: false } }] } 
            : { projectId };

        let state = await AppState.findOne(stateQuery);
        if (!state) state = await AppState.create({ projectId });
        
        if (!state.categories.includes(id)) state.categories.push(id);
        if (state.categoryChildren instanceof Map) {
            if (!state.categoryChildren.has(id)) state.categoryChildren.set(id, []);
        } else {
            if (!state.categoryChildren[id]) state.categoryChildren[id] = [];
        }
        
        state.totalNodes = await Node.countDocuments({ projectId });
        await state.save();

        // Update root node
        const root = await Node.findOne({ id: 'root', projectId });
        if (root) {
            if (!root.connections.children.some(c => c.id === id)) {
                root.connections.children.push({ id, type: 'primary' });
                await root.save();
            }
        }

        res.json({ success: true, category: node });
    } catch (error) {
        res.status(500).json({ error: 'Error al crear categoría' });
    }
});

apiRouter.delete('/categories/:id', requireProjectWriteAccess, async (req, res) => {
    try {
        const projectId = req.query.project || 'diplomatura';
        const catId = req.params.id;
        const state = await AppState.findOne({ projectId });
        
        // Remove children nodes
        if (state) {
            const children = state.categoryChildren instanceof Map ? state.categoryChildren.get(catId) : state.categoryChildren[catId];
            if (children) {
                await Node.deleteMany({ id: { $in: children }, projectId });
                if (state.categoryChildren instanceof Map) {
                    state.categoryChildren.delete(catId);
                } else {
                    delete state.categoryChildren[catId];
                }
            }
        }

        if (state) {
            state.categories = state.categories.filter(c => c !== catId);
            state.totalNodes = await Node.countDocuments({ projectId });
            await state.save();
        }

        await Node.deleteOne({ id: catId, projectId });
        
        // Remove from root
        await Node.updateOne({ id: 'root', projectId }, { $pull: { "connections.children": { id: catId } } });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar categoría' });
    }
});

// ═══════════════════════════════════════════════════════════════
//  API ROUTES - CONNECTIONS
// ═══════════════════════════════════════════════════════════════

apiRouter.post('/connections', requireProjectWriteAccess, async (req, res) => {
    try {
        const projectId = req.query.project || 'diplomatura';
        const { source, target, type } = req.body;
        const connType = type || 'secondary';

        const sourceNode = await Node.findOne({ id: source, projectId });
        if (!sourceNode) return res.status(404).json({ error: 'Source node not found' });

        if (connType === 'secondary') {
            if (!sourceNode.connections.secondary.includes(target)) {
                sourceNode.connections.secondary.push(target);
            }
        } else {
            if (!sourceNode.connections.children.some(c => c.id === target)) {
                sourceNode.connections.children.push({ id: target, type: connType });
            }
        }

        await sourceNode.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error agregando conexión' });
    }
});

apiRouter.delete('/connections', requireProjectWriteAccess, async (req, res) => {
    try {
        const projectId = req.query.project || 'diplomatura';
        const { source, target, type } = req.body;
        const connType = type || 'secondary';

        const sourceNode = await Node.findOne({ id: source, projectId });
        if (!sourceNode) return res.status(404).json({ error: 'Source node not found' });

        if (connType === 'secondary') {
            sourceNode.connections.secondary = sourceNode.connections.secondary.filter(id => id !== target);
        } else {
            sourceNode.connections.children = sourceNode.connections.children.filter(c => c.id !== target);
        }

        await sourceNode.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error eliminando conexión' });
    }
});

// ═══════════════════════════════════════════════════════════════
//  API ROUTES - RANKING
// ═══════════════════════════════════════════════════════════════

apiRouter.get('/ranking', requireProjectReadAccess, async (req, res) => {
    try {
        const projectId = getProjectIdFromReq(req);
        const rankings = await Ranking.find({ projectId }).sort({ score: -1 }).limit(100);
        res.json({ rankings });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener ranking' });
    }
});

apiRouter.post('/ranking', requireProjectWriteAccess, async (req, res) => {
    try {
        const projectId = req.query.project || 'diplomatura';
        const entry = await Ranking.create({ ...req.body, projectId });
        res.json({ success: true, entry });
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar ranking' });
    }
});

apiRouter.delete('/ranking/:id', requireProjectWriteAccess, async (req, res) => {
    try {
        const projectId = req.query.project || 'diplomatura';
        await Ranking.findOneAndDelete({ _id: req.params.id, projectId });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar ranking' });
    }
});

// RANKING PV
apiRouter.get('/ranking_pv', requireProjectReadAccess, async (req, res) => {
    try {
        const projectId = getProjectIdFromReq(req);
        const rankings = await RankingPV.find({ projectId }).sort({ score: -1 }).limit(100);
        res.json({ rankings });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener ranking PV' });
    }
});

apiRouter.post('/ranking_pv', requireProjectWriteAccess, async (req, res) => {
    try {
        const projectId = req.query.project || 'diplomatura';
        const entry = await RankingPV.create({ ...req.body, projectId });
        res.json({ success: true, entry });
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar ranking PV' });
    }
});

apiRouter.delete('/ranking_pv/:id', requireProjectWriteAccess, async (req, res) => {
    try {
        const projectId = req.query.project || 'diplomatura';
        await RankingPV.findOneAndDelete({ _id: req.params.id, projectId });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar ranking PV' });
    }
});

// ═══════════════════════════════════════════════════════════════
//  API ROUTES - PROJECTS
// ═══════════════════════════════════════════════════════════════

apiRouter.get('/projects/public', async (req, res) => {
    try {
        const projects = await Project.find({ id: { $ne: 'diplomatura' }, isPublic: { $ne: false } })
            .sort({ updatedAt: -1, name: 1 })
            .limit(500);

        res.json({
            projects: projects.map(p => ({
                id: p.id,
                name: p.name,
                description: p.description,
                ownerUsername: p.ownerUsername,
                createdAt: p.createdAt,
                updatedAt: p.updatedAt
            }))
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener proyectos públicos' });
    }
});

apiRouter.get('/projects', requireAuth, async (req, res) => {
    try {
        const query = (req.user.role === 'admin') ? {} : { ownerUsername: req.user.username };
        const projects = await Project.find(query).sort({ name: 1 });
        res.json({ projects });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener proyectos' });
    }
});

apiRouter.post('/projects', requireAuth, async (req, res) => {
    try {
        const { id, name, description, isPublic } = req.body;
        if (!id || !name) return res.status(400).json({ error: 'Se requiere ID y Nombre' });

        const existing = await Project.findOne({ id });
        if (existing) return res.status(400).json({ error: 'Ya existe un proyecto con ese ID' });

        const project = await Project.create({
            id,
            name,
            description,
            ownerUsername: req.user.username,
            isPublic: isPublic === false ? false : true
        });

        // Initialize state for the new project
        await AppState.create({ 
            projectId: id,
            categories: [],
            categoryChildren: {},
            config: {}
        });

        // Initialize space config with defaults or empty
        await SpaceConfig.create({
            projectId: id
        });

        // Create a root node for the project
        await Node.create({
            id: 'root',
            projectId: id,
            label: name,
            type: 'root',
            connections: { parent: [], children: [], secondary: [] }
        });

        res.json({ success: true, project });
    } catch (error) {
        res.status(500).json({ error: 'Error al crear proyecto' });
    }
});

apiRouter.post('/projects/import', requireAuth, async (req, res) => {
    try {
        const importData = req.body;
        if (!importData || typeof importData !== 'object') {
            return res.status(400).json({ error: 'Body inválido' });
        }
        if (!importData.nodes || typeof importData.nodes !== 'object' || Array.isArray(importData.nodes)) {
            return res.status(400).json({ error: 'Invalid data format' });
        }

        const meta = (importData.project && typeof importData.project === 'object') ? importData.project : {};
        const name = String(meta.name || importData.name || importData.projectName || importData.nodes?.root?.label || 'Mapa IA').trim() || 'Mapa IA';
        const description = String(meta.description || importData.description || '').trim();
        const isPublic = (meta.isPublic === false || importData.isPublic === false) ? false : true;

        const requestedIdRaw = String(meta.id || importData.projectId || importData.id || '').trim();
        const requestedId = requestedIdRaw ? slugify(requestedIdRaw) : '';
        const projectId = requestedId ? (await generateUniqueProjectId(requestedId)) : (await generateUniqueProjectId(name));

        const existing = await Project.findOne({ id: projectId }).lean();
        if (existing) return res.status(400).json({ error: 'Ya existe un proyecto con ese ID' });

        const project = await Project.create({
            id: projectId,
            name,
            description,
            ownerUsername: req.user.username,
            isPublic
        });

        const nodes = Object.entries(importData.nodes)
            .map(([id, data]) => ({ ...(data || {}), id, projectId }));

        const hasRoot = nodes.some(n => n.id === 'root');
        if (!hasRoot) {
            nodes.push({
                id: 'root',
                projectId,
                label: name,
                type: 'root',
                connections: { parent: [], children: [], secondary: [] }
            });
        } else {
            nodes.forEach(n => {
                if (n.id === 'root') {
                    if (!n.label) n.label = name;
                    if (!n.type) n.type = 'root';
                    if (!n.connections) n.connections = { parent: [], children: [], secondary: [] };
                }
            });
        }

        nodes.forEach(n => {
            if (typeof n.url === 'string') n.url = normalizeUrl(n.url);
        });

        await Node.insertMany(nodes);

        const categories = Array.isArray(importData.categories)
            ? importData.categories
            : nodes.filter(n => n.type === 'category').map(n => n.id);

        await AppState.create({
            projectId,
            exportDate: new Date(),
            totalNodes: nodes.length,
            categories,
            categoryChildren: (importData.categoryChildren && typeof importData.categoryChildren === 'object') ? importData.categoryChildren : {},
            config: (importData.config && typeof importData.config === 'object') ? importData.config : {}
        });

        await SpaceConfig.create({
            projectId,
            ...(importData.spaceConfig && typeof importData.spaceConfig === 'object' ? importData.spaceConfig : {})
        });

        res.json({ success: true, project, totalNodes: nodes.length });
    } catch (error) {
        console.error('Project import error:', error);
        res.status(500).json({ error: 'Error al importar proyecto' });
    }
});

apiRouter.delete('/projects/:id', requireAuth, async (req, res) => {
    try {
        const projectId = req.params.id;
        if (projectId === 'diplomatura') {
            return res.status(400).json({ error: 'No se puede eliminar el proyecto principal' });
        }

        const project = await Project.findOne({ id: projectId });
        if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });
        const owner = String(project.ownerUsername || 'ADMIN').trim().toUpperCase();
        if (req.user.role !== 'admin' && owner !== req.user.username) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        await Project.deleteOne({ id: projectId });
        await Node.deleteMany({ projectId });
        await AppState.deleteMany({ projectId });
        await SpaceConfig.deleteMany({ projectId });
        await Ranking.deleteMany({ projectId });
        await RankingPV.deleteMany({ projectId });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar proyecto' });
    }
});

apiRouter.post('/import', requireProjectWriteAccess, async (req, res) => {
    try {
        const projectId = req.query.project || 'diplomatura';
        const importData = req.body;
        if (!importData.nodes) return res.status(400).json({ error: 'Invalid data format' });

        // CLEAR EVERYTHING for this project
        await Node.deleteMany({ projectId });
        await AppState.deleteMany({ projectId });

        // INSERT NODES
        const nodes = Object.entries(importData.nodes).map(([id, data]) => ({ ...data, id, projectId }));
        const hasRoot = nodes.some(n => n.id === 'root');
        if (!hasRoot) {
            nodes.push({
                id: 'root',
                projectId,
                label: req.project?.name || 'Proyecto',
                type: 'root',
                connections: { parent: [], children: [], secondary: [] }
            });
        }
        nodes.forEach(n => {
            if (typeof n.url === 'string') n.url = normalizeUrl(n.url);
        });
        await Node.insertMany(nodes);

        // CREATE APP STATE
        await AppState.create({
            projectId,
            exportDate: new Date(),
            totalNodes: nodes.length,
            categories: importData.categories || [],
            categoryChildren: importData.categoryChildren || {},
            config: importData.config || {}
        });

        res.json({ success: true, totalNodes: nodes.length, projectId });
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ error: 'Error al importar datos' });
    }
});

apiRouter.get('/export', requireProjectWriteAccess, async (req, res) => {
    const projectId = req.query.project || 'diplomatura';
    const data = await getFullNodesData(projectId);
    res.json(data);
});

// ═══════════════════════════════════════════════════════════════
//  API ROUTES - CONFIG / SPACE CONFIG
// ═══════════════════════════════════════════════════════════════

apiRouter.get('/config', requireProjectReadAccess, async (req, res) => {
    const projectId = getProjectIdFromReq(req);
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.json({ config: {} });
        }
        const query = (projectId === 'diplomatura')
            ? { $or: [{ projectId: 'diplomatura' }, { projectId: { $exists: false } }] }
            : { projectId };
        const state = await AppState.findOne(query).lean();
        res.json({ config: state?.config || {} });
    } catch (error) {
        console.error('Error al obtener config:', error);
        res.json({ config: {} });
    }
});

apiRouter.put('/config', requireProjectWriteAccess, async (req, res) => {
    try {
        const projectId = req.query.project || 'diplomatura';
        let state = await AppState.findOne({ projectId });
        if (!state) state = await AppState.create({ projectId });
        if (!state.config) state.config = new Map();
        if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
            return res.status(400).json({ error: 'Body inválido' });
        }
        Object.entries(req.body).forEach(([k, v]) => {
            state.config.set(k, v);
        });
        await state.save();
        res.json({ success: true, config: Object.fromEntries(state.config) });
    } catch (error) {
        console.error('Error al actualizar config:', error);
        res.status(500).json({ error: 'Error al actualizar config' });
    }
});

apiRouter.get('/space-config', requireProjectReadAccess, async (req, res) => {
    const projectId = getProjectIdFromReq(req);
    let config = await SpaceConfig.findOne({ projectId });
    if (!config) {
        // Fallback to file for initial load ONLY if it's the default project
        if (projectId === 'diplomatura') {
            const filePath = path.join(__dirname, 'data', 'space_config.json');
            if (fs.existsSync(filePath)) {
                config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                config.projectId = 'diplomatura';
                await SpaceConfig.create(config);
            }
        } else {
            // New project gets empty config
            config = await SpaceConfig.create({ projectId });
        }
    }
    res.json(config);
});

apiRouter.put('/space-config', requireProjectWriteAccess, async (req, res) => {
    try {
        const projectId = req.query.project || 'diplomatura';
        await SpaceConfig.findOneAndUpdate({ projectId }, req.body, { upsert: true });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar space config' });
    }
});

apiRouter.get('/users', requireAdmin, async (req, res) => {
    try {
        const users = await User.find().sort({ username: 1 }).lean();
        const projects = await Project.find().sort({ name: 1 }).lean();

        const byUser = {};
        users.forEach(u => { byUser[u.username] = []; });
        projects.forEach(p => {
            const owner = String(p.ownerUsername || 'ADMIN').trim().toUpperCase();
            if (!byUser[owner]) byUser[owner] = [];
            byUser[owner].push({ id: p.id, name: p.name, description: p.description });
        });

        const result = users.map(u => ({
            username: u.username,
            createdAt: u.createdAt,
            projects: byUser[u.username] || []
        }));

        result.unshift({
            username: 'ADMIN',
            createdAt: null,
            projects: byUser['ADMIN'] || []
        });

        res.json({ users: result });
    } catch (e) {
        res.status(500).json({ error: 'Error al listar usuarios' });
    }
});

// Mount the API Router on both routes
for (const basePath of mapaiMounts) {
    app.use(`/${basePath}/:tenant/api`, apiRouter);
    app.use(`/${basePath}/api`, apiRouter);
}
app.use('/api', apiRouter);

// ===============================================================
//  START SERVER
// ===============================================================
const server = http.createServer(app);

server.listen(port, () => {
    const baseUrl = `http://localhost:${port}/${APP_PATH}`;
    console.log('===================================================');
    console.log(`  MapAI MongoDB Server is UP on port ${port}`);
    console.log(`  MAPAI: ${baseUrl}/`);
    console.log(`  Database: ${MONGODB_URI}`);
    console.log('===================================================');
});

