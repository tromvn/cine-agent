# 🎬 cine-agent

Agente de IA conversacional especializado en cine de autor, construido con [Strands Agents SDK](https://strandsagents.com/) (TypeScript), Groq y la API de TMDB.

## ¿Qué hace?

- Recomienda películas según director, género o tema
- Busca información real de directores y películas en TMDB
- Agrega nuevos directores al dataset local
- Recuerda el contexto de la conversación entre sesiones

## Stack

| Pieza | Tecnología |
|---|---|
| Framework de agente | Strands Agents SDK (TypeScript) |
| Modelo | Llama 3.1 8b via Groq |
| Validación de tools | Zod |
| Datos externos | TMDB API |
| Persistencia | JSON local + FileStorage (session snapshots) |
| Runtime | Node.js 20+ con tsx |

## Estructura

```
cine-agent/
├── data/
│   └── directores.json     # Dataset local de directores y películas
├── sessions/               # Snapshots de sesión (generado automáticamente)
├── agent.ts                # Agente principal
├── tools.ts                # Tools custom del agente
├── .env                    # Variables de entorno (no se sube a git)
├── .env.example            # Plantilla de variables de entorno
└── package.json
```

## Instalación

```bash
git clone https://github.com/tromvn/cine-agent
cd cine-agent
npm install
```

Copiá el archivo de ejemplo y completá tus claves:

```bash
cp .env.example .env
```

```env
GROQ_API_KEY=tu_clave_groq        # console.groq.com
TMDB_TOKEN=tu_token_tmdb          # themoviedb.org → Settings → API
```

## Uso

```bash
npx tsx agent.ts
```

## Tools disponibles

El agente decide solo cuándo usar cada herramienta según el contexto de la conversación.

**`buscar_peliculas`** — consulta el dataset local filtrando por director, género o tema.

**`buscar_en_tmdb`** — busca información real en The Movie Database antes de agregar datos nuevos.

**`agregar_director`** — agrega un director con sus películas al dataset local. Valida duplicados y deduplica películas automáticamente.

## Ejemplos de uso

```
"Recomiéndame una película de Tarkovsky sobre memoria"
"Agrega a Abbas Kiarostami con sus películas más importantes"
"¿Qué película de las que mencionaste es más accesible para alguien nuevo en el cine iraní?"
```

## Aprendizajes del proyecto

Este proyecto fue construido como ejercicio de aprendizaje de desarrollo full stack, explorando:

- Arquitectura de agentes con loop model-driven
- Tool calling con validación de tipos via Zod
- Diferencia entre `ollama.chat()` manual vs framework de agente
- ESModules en Node.js (`import.meta.url` vs `__dirname`)
- Variables de entorno y buenas prácticas de seguridad
- Session management para contexto persistente entre conversaciones
- Integración con APIs externas (TMDB, Groq)
