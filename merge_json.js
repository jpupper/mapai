
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'public', 'nube_data', 'mapa_herramientas_data.json');
const rawData = fs.readFileSync(dataPath, 'utf-8');
const data = JSON.parse(rawData);

// New Data
const newNodes = {
    "protocolo-revision": {
        "id": "protocolo-revision",
        "label": "Protocolo de Revisión",
        "type": "category",
        "url": null,
        "info": "Protocolo de entrega y criterios de evaluación para el Trabajo Práctico Final.",
        "connections": {
            "parent": [{ "id": "root", "type": "primary" }],
            "children": [
                { "id": "ent-github", "type": "primary" },
                { "id": "ent-pres", "type": "primary" },
                { "id": "ent-deploy", "type": "primary" },
                { "id": "ent-1", "type": "primary" },
                { "id": "ent-2", "type": "primary" },
                { "id": "ent-3", "type": "primary" },
                { "id": "crit-tec", "type": "primary" },
                { "id": "crit-cre", "type": "primary" },
                { "id": "crit-doc", "type": "primary" }
            ],
            "secondary": []
        },
        "infoHTML": "<h3>Protocolo de Revisión</h3><p>Guía completa para la entrega y evaluación del Trabajo Práctico Final.</p>"
    },
    "ent-github": {
        "id": "ent-github",
        "category": "protocolo-revision",
        "label": "Repositorio GitHub",
        "type": "tool",
        "info": "Código fuente completo, README.md detallado, requisitos, instrucciones y créditos.",
        "description": "Entrega obligatoria del repositorio con todo el código fuente. El README.md es fundamental.",
        "connections": { "parent": [{ "id": "protocolo-revision", "type": "primary" }], "children": [], "secondary": [] }
    },
    "ent-pres": {
        "id": "ent-pres",
        "category": "protocolo-revision",
        "label": "Documento Presentación",
        "type": "tool",
        "info": "PDF o PowerPoint con memoria conceptual, objetivos, proceso y decisiones técnicas.",
        "description": "Documento formal explicando el 'qué', 'por qué' y 'cómo' del proyecto.",
        "connections": { "parent": [{ "id": "protocolo-revision", "type": "primary" }], "children": [], "secondary": [] }
    },
    "ent-deploy": {
        "id": "ent-deploy",
        "category": "protocolo-revision",
        "label": "Versión Deployada",
        "type": "tool",
        "info": "Link al proyecto online (Vercel, GitHub Pages) o ejecutable funcional.",
        "description": "El proyecto debe poder ser probado inmediatamente sin configuración compleja.",
        "connections": { "parent": [{ "id": "protocolo-revision", "type": "primary" }], "children": [], "secondary": [] }
    },
    "ent-1": {
        "id": "ent-1",
        "category": "protocolo-revision",
        "label": "Entrega 1: Generativo",
        "type": "tool",
        "info": "Arte generativo básico con p5.js/three.js. Mínimo 2 técnicas y parámetros.",
        "description": "Foco en la generación visual algorítmica y parametrización.",
        "connections": { "parent": [{ "id": "protocolo-revision", "type": "primary" }], "children": [], "secondary": [] }
    },
    "ent-2": {
        "id": "ent-2",
        "category": "protocolo-revision",
        "label": "Entrega 2: Interfaz",
        "type": "tool",
        "info": "Interactividad y UI. Sliders, mouse/teclado y diseño responsive.",
        "description": "El usuario debe poder controlar la obra. UX/UI básico.",
        "connections": { "parent": [{ "id": "protocolo-revision", "type": "primary" }], "children": [], "secondary": [] }
    },
    "ent-3": {
        "id": "ent-3",
        "category": "protocolo-revision",
        "label": "Entrega 3: Avanzada",
        "type": "tool",
        "info": "Integración compleja: BD, WebSockets, ComfyUI, N8N o LLMs.",
        "description": "Implementación de una tecnología avanzada del módulo 3.",
        "connections": { "parent": [{ "id": "protocolo-revision", "type": "primary" }], "children": [], "secondary": [] }
    },
    "crit-tec": {
        "id": "crit-tec",
        "category": "protocolo-revision",
        "label": "Criterio Técnico (40%)",
        "type": "tool",
        "info": "Calidad de código, optimización, estructura y funcionalidad correcta.",
        "description": "Evaluación de la solidez técnica y buenas prácticas.",
        "connections": { "parent": [{ "id": "protocolo-revision", "type": "primary" }], "children": [], "secondary": [] }
    },
    "crit-cre": {
        "id": "crit-cre",
        "category": "protocolo-revision",
        "label": "Criterio Creativo (30%)",
        "type": "tool",
        "info": "Originalidad, estética, experiencia de usuario y propuesta artística.",
        "description": "Evaluación del impacto visual y conceptual de la obra.",
        "connections": { "parent": [{ "id": "protocolo-revision", "type": "primary" }], "children": [], "secondary": [] }
    },
    "crit-doc": {
        "id": "crit-doc",
        "category": "protocolo-revision",
        "label": "Documentación (30%)",
        "type": "tool",
        "info": "Claridad, referencias a IA, completitud y presentación.",
        "description": "La capacidad de comunicar el proceso es tan importante como el resultado.",
        "connections": { "parent": [{ "id": "protocolo-revision", "type": "primary" }], "children": [], "secondary": [] }
    }
};

// 1. Add Category
if (!data.categories.includes('protocolo-revision')) {
    data.categories.push('protocolo-revision');
}

// 2. Add Children List
data.categoryChildren['protocolo-revision'] = [
    "ent-github", "ent-pres", "ent-deploy",
    "ent-1", "ent-2", "ent-3",
    "crit-tec", "crit-cre", "crit-doc"
];

// 3. Add Config Distances
if (data.config && data.config.categoryDistances) {
    data.config.categoryDistances['protocolo-revision'] = 220;
}
if (data.config && data.config.categoryDistancesMain) {
    data.config.categoryDistancesMain['protocolo-revision'] = 1400;
}

// 4. Merge Nodes
Object.assign(data.nodes, newNodes);

// 5. Write Back
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');
console.log('Successfully merged JSON data.');
