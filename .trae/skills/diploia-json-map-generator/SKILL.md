---
name: "diploia-json-map-generator"
description: "Define el esquema JSON de DiploIA para mapas y un prompt listo para copiar. Invocar cuando quieras generar un mapa con IA para luego pegar el JSON en Import/Export."
---

# DiploIA JSON Map Generator

## Objetivo

Generar un JSON válido para crear un “Mapa de Herramientas” en DiploIA a partir de un modelo de lenguaje, y luego importarlo como un proyecto.

## Cómo usar (flujo)

1. Copiá el prompt de la sección “Prompt para IA”.
2. Pegalo en tu modelo de lenguaje.
3. Pedile: “En base a este prompt, generame un mapa de herramientas sobre <tema>”.
4. Asegurate de que el modelo responda SOLO con JSON válido.
5. En DiploIA → Admin → Importar/Exportar → “Crear proyecto desde JSON (pegado)”, pegá el JSON y creá el proyecto.

## Reglas (muy importante)

- La respuesta final debe ser SOLO JSON válido (sin markdown, sin explicación).
- IDs en kebab-case: `solo a-z`, `0-9`, `-` (sin espacios).
- URLs sin backticks, sin comillas extra y sin espacios al principio/fin (ej: "https://ejemplo.com").
- Todo id mencionado en `categories`, `categoryChildren` o `connections` debe existir en `nodes`.
- Debe existir `nodes.root` con `type: "root"`.

## Esquema JSON

Top-level:

- `project` (opcional): metadatos del proyecto
  - `id` (opcional): id sugerido (puede ser ajustado automáticamente)
  - `name` (obligatorio): nombre visible del proyecto
  - `description` (opcional)
  - `isPublic` (opcional): `true` (default) o `false`
- `nodes` (obligatorio): objeto con nodos por id `{ [nodeId]: Node }`
- `categories` (opcional, recomendado): array de ids de categorías (nodos con `type: "category"`)
- `categoryChildren` (opcional): `{ [categoryId]: [nodeId, ...] }`
- `config` (opcional): objeto libre (puede ser `{}`)

Node:

- `label` (obligatorio): nombre del nodo
- `type` (recomendado): `"root" | "category" | "tool" | "concept"`
- `url` (opcional)
- `info` (opcional): texto corto
- `infoHTML` (opcional): HTML simple
- `connections` (opcional):
  - `parent`: array de `{ id, type }`
  - `children`: array de `{ id, type }`
  - `secondary`: array de ids (strings)

## Prompt para IA (copiar y pegar)

Objetivo: generar un JSON válido para crear un "Mapa de Herramientas" en DiploIA.

Instrucciones IMPORTANTES:
1) Respondé SOLO con JSON válido (sin markdown, sin explicación).
2) El JSON tiene que respetar este esquema y referencias (ids, categorías, nodos y conexiones).
3) Usá IDs en kebab-case (solo a-z, 0-9 y guiones). Sin espacios.
4) URLs sin backticks, sin comillas extra y sin espacios al principio/fin (ej: "https://ejemplo.com").
5) Todo id mencionado en categorías, categoryChildren o connections DEBE existir en "nodes".

Estructura requerida (top-level):
- project (opcional): { id?, name, description?, isPublic? }
- nodes (obligatorio): objeto { [nodeId]: Node }
- categories (opcional pero recomendado): array de ids de categorías (nodes con type="category")
- categoryChildren (opcional): objeto { [categoryId]: [nodeId, ...] }
- config (opcional): objeto libre de configuración (puede ser {})

Node (cada entrada dentro de nodes):
- label (obligatorio)
- type (recomendado): "root" | "category" | "tool" | "concept"
- url (opcional)
- info (opcional): texto corto
- infoHTML (opcional): HTML simple
- connections (opcional):
  - parent: [{ id: string, type: string }]
  - children: [{ id: string, type: string }]
  - secondary: [string]

Reglas mínimas:
- Debe existir nodes.root con type="root".
- Si agregás categorías: el node de esa categoría debe tener type="category" y su id debe estar en "categories".
- Si usás categoryChildren: para cada categoryId, listá los ids de nodos que pertenecen a esa categoría.

Salida final:
- Generá un mapa coherente con 2-6 categorías y 10-40 nodos, con labels claros y URLs reales cuando aplique.
- Incluí un nombre de proyecto en project.name.

## JSON base (ejemplo)

```json
{
  "project": {
    "name": "Mapa de herramientas (ejemplo IA)",
    "description": "Ejemplo mínimo con categorías y nodos",
    "isPublic": true
  },
  "nodes": {
    "root": {
      "label": "Mapa de herramientas (ejemplo IA)",
      "type": "root",
      "connections": { "parent": [], "children": [], "secondary": [] }
    },
    "programacion": {
      "label": "Programación",
      "type": "category",
      "connections": { "parent": [], "children": [], "secondary": [] }
    },
    "ia": {
      "label": "IA",
      "type": "category",
      "connections": { "parent": [], "children": [], "secondary": [] }
    },
    "javascript": {
      "label": "JavaScript",
      "type": "tool",
      "url": "https://developer.mozilla.org/es/docs/Web/JavaScript",
      "info": "Lenguaje para web y apps.",
      "connections": { "parent": [{ "id": "programacion", "type": "category" }], "children": [], "secondary": ["nodejs"] }
    },
    "nodejs": {
      "label": "Node.js",
      "type": "tool",
      "url": "https://nodejs.org/",
      "info": "Runtime de JavaScript en servidor.",
      "connections": { "parent": [{ "id": "programacion", "type": "category" }], "children": [], "secondary": ["javascript"] }
    },
    "chatgpt": {
      "label": "ChatGPT",
      "type": "tool",
      "url": "https://chat.openai.com/",
      "info": "Asistente para ideación y trabajo con texto/código.",
      "connections": { "parent": [{ "id": "ia", "type": "category" }], "children": [], "secondary": [] }
    }
  },
  "categories": ["programacion", "ia"],
  "categoryChildren": {
    "programacion": ["javascript", "nodejs"],
    "ia": ["chatgpt"]
  },
  "config": {}
}
```

## Copiar todo (SKILL + JSON base)

Pegá este bloque completo en el modelo de lenguaje:

```text
Objetivo: generar un JSON válido para crear un "Mapa de Herramientas" en DiploIA.

Instrucciones IMPORTANTES:
1) Respondé SOLO con JSON válido (sin markdown, sin explicación).
2) El JSON tiene que respetar este esquema y referencias (ids, categorías, nodos y conexiones).
3) Usá IDs en kebab-case (solo a-z, 0-9 y guiones). Sin espacios.
4) URLs sin backticks, sin comillas extra y sin espacios al principio/fin (ej: "https://ejemplo.com").
5) Todo id mencionado en categorías, categoryChildren o connections DEBE existir en "nodes".

Estructura requerida (top-level):
- project (opcional): { id?, name, description?, isPublic? }
- nodes (obligatorio): objeto { [nodeId]: Node }
- categories (opcional pero recomendado): array de ids de categorías (nodes con type="category")
- categoryChildren (opcional): objeto { [categoryId]: [nodeId, ...] }
- config (opcional): objeto libre de configuración (puede ser {})

Node (cada entrada dentro de nodes):
- label (obligatorio)
- type (recomendado): "root" | "category" | "tool" | "concept"
- url (opcional)
- info (opcional): texto corto
- infoHTML (opcional): HTML simple
- connections (opcional):
  - parent: [{ id: string, type: string }]
  - children: [{ id: string, type: string }]
  - secondary: [string]

Reglas mínimas:
- Debe existir nodes.root con type="root".
- Si agregás categorías: el node de esa categoría debe tener type="category" y su id debe estar en "categories".
- Si usás categoryChildren: para cada categoryId, listá los ids de nodos que pertenecen a esa categoría.

Salida final:
- Generá un mapa coherente con 2-6 categorías y 10-40 nodos, con labels claros y URLs reales cuando aplique.
- Incluí un nombre de proyecto en project.name.

--- JSON BASE (ejemplo) ---
{
  "project": {
    "name": "Mapa de herramientas (ejemplo IA)",
    "description": "Ejemplo mínimo con categorías y nodos",
    "isPublic": true
  },
  "nodes": {
    "root": {
      "label": "Mapa de herramientas (ejemplo IA)",
      "type": "root",
      "connections": { "parent": [], "children": [], "secondary": [] }
    },
    "programacion": {
      "label": "Programación",
      "type": "category",
      "connections": { "parent": [], "children": [], "secondary": [] }
    },
    "ia": {
      "label": "IA",
      "type": "category",
      "connections": { "parent": [], "children": [], "secondary": [] }
    },
    "javascript": {
      "label": "JavaScript",
      "type": "tool",
      "url": "https://developer.mozilla.org/es/docs/Web/JavaScript",
      "info": "Lenguaje para web y apps.",
      "connections": { "parent": [{ "id": "programacion", "type": "category" }], "children": [], "secondary": ["nodejs"] }
    },
    "nodejs": {
      "label": "Node.js",
      "type": "tool",
      "url": "https://nodejs.org/",
      "info": "Runtime de JavaScript en servidor.",
      "connections": { "parent": [{ "id": "programacion", "type": "category" }], "children": [], "secondary": ["javascript"] }
    },
    "chatgpt": {
      "label": "ChatGPT",
      "type": "tool",
      "url": "https://chat.openai.com/",
      "info": "Asistente para ideación y trabajo con texto/código.",
      "connections": { "parent": [{ "id": "ia", "type": "category" }], "children": [], "secondary": [] }
    }
  },
  "categories": ["programacion", "ia"],
  "categoryChildren": {
    "programacion": ["javascript", "nodejs"],
    "ia": ["chatgpt"]
  },
  "config": {}
}
```
