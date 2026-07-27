import "dotenv/config";

import { OpenAIModel } from "@strands-agents/sdk/models/openai";
import { Agent } from "@strands-agents/sdk";
import {
  buscarPeliculas,
  agregarDirector,
  buscarEnTMDB,
  abrirStream,
  buscarTrailer,
  agregarPendiente,
  listarPendientes,
  eliminarPendiente,
} from "./tools.js";

import { SessionManager, FileStorage } from "@strands-agents/sdk";

import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as readline from "readline";
import * as http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------- MODELO ----------

const model = new OpenAIModel({
  api: "chat",
  apiKey: process.env.GROQ_API_KEY,
  clientConfig: { baseURL: "https://api.groq.com/openai/v1" },
  modelId: "llama-3.1-8b-instant",
});

// ---------- AGENTE ----------

const tools = [
  buscarPeliculas,
  agregarDirector,
  buscarEnTMDB,
  abrirStream,
  buscarTrailer,
  agregarPendiente,
  listarPendientes,
  eliminarPendiente,
];

const agent = new Agent({
  model,
  systemPrompt: [
    "Eres un crítico de cine experto y cinéfilo apasionado.",
    "Tu personalidad:",
    "1. Conoces en profundidad directores, sus filmografías y estilos únicos",
    "2. Sugieres películas de cualquier tipo, pero que tengan alguna crítica constructiva del mundo, y aporten salidas mediante valores como: empatía, comunicación abierta, reconciliación con uno o con otros, flexibilidad y adaptabilidad, autoconocimiento, compasión, desarrollo (personal, conciencia, espíritu). Te conmueven personajes que fracasan y buscan una salida mediante un bien a otros.",
    "3. Puedes recomendar películas según género, director o estado de ánimo",
    "4. Das sinopsis breves pero cautivadoras",
    "5. Mencionas datos curiosos sobre la producción cuando es relevante",
    "6. Respondes siempre en español con entusiasmo cinéfilo",
    "",
    "Tienes acceso a estas herramientas:",
    "- buscar_peliculas(query): busca con TF-IDF. Si el usuario da nombre+apellido, prioriza coincidencia exacta.",
    "  Si devuelve { ambiguo: true, opciones: [...] }, lista las opciones y pide al usuario elegir.",
    "- buscar_en_tmdb(nombre, tipo): busca en TMDB. Siempre pregúntale al usuario ANTES de buscar.",
    "- agregar_director: guarda un director y sus películas al dataset.",
    "- abrir_stream(tmdbId, titulo): abre streaming de la película.",
    "- buscar_trailer(titulo, año): busca el trailer en YouTube.",
    "- agregar_pendiente(titulo, director): agrega una película a tu lista de pendientes.",
    "- listar_pendientes: muestra tu lista de películas pendientes.",
    "- eliminar_pendiente(titulo): elimina una película de pendientes.",
    "",
    "FLUJO para RECOMENDAR:",
    "1. Usa buscar_peliculas primero.",
    "2. Si no encuentra nada en el dataset, di: 'No encontré a X en mi colección. ¿Quieres que busque en TMDB y lo agregue?'",
    "3. Si el usuario dice que sí, usa buscar_en_tmdb, muestra los resultados, y pregunta si quiere agregarlo.",
    "4. Si el usuario dice que no, responde solo con la info de TMDB sin guardar.",
    "",
    "FLUJO para DESAMBIGUACIÓN:",
    "- Si buscar_peliculas devuelve ambiguo:true, lista los nombres y pregunta '¿A cuál te refieres?'",
    "- Ej: 'Varios directores coinciden con Trier: Joachim Trier, Lars von Trier. ¿Cuál te interesa?'",
    "",
    "FLUJO para PENDIENTES:",
    "- Después de recomendar una película, ofrece: '¿Quieres agregarla a pendientes, abrir el stream o buscar el trailer?'",
    "- Si el usuario pide ver pendientes en cualquier momento, usa listar_pendientes.",
    "",
    "NUNCA inventes datos.",
    "Mantén respuestas de máximo 3 párrafos. Siempre recomienda con entusiasmo.",
  ].join("\n"),
  tools,
  sessionManager: new SessionManager({
    storage: {
      snapshot: new FileStorage(join(__dirname, "sessions")),
    },
    sessionId: "cinefilo",
  }),
});

// ---------- MODO CLI INTERACTIVO ----------

function startCLI() {
  console.log(
    "\n🎬 Cine-Agente — Escribe 'salir' para terminar, 'server' para modo HTTP\n",
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = () => {
    rl.question("🎬 Tú: ", async (input) => {
      const trimmed = input.trim();
      if (trimmed.toLowerCase() === "salir") {
        console.log("¡Hasta luego, cinéfilo! 🎥");
        rl.close();
        return;
      }
      if (trimmed.toLowerCase() === "server") {
        rl.close();
        startServer();
        return;
      }
      console.log("\n🤖 Cinefilo:");
      const respuesta = await agent.invoke(trimmed);
      console.log(respuesta.toString());
      console.log();
      ask();
    });
  };

  ask();
}

// ---------- MODO SERVIDOR HTTP ----------

function startServer() {
  const PORT = parseInt(process.env.PORT || "3000", 10);
  console.log(`\n🌐 Servidor iniciado en http://localhost:${PORT}`);
  console.log("   La extensión de Firefox se conectará aquí.\n");

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${PORT}`);
    const query = url.searchParams.get("q");

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (!query) {
      res.statusCode = 400;
      res.end("Usa ?q=tu+pregunta");
      return;
    }

    try {
      const respuesta = await agent.invoke(query);
      res.end(respuesta.toString());
    } catch (err) {
      res.statusCode = 500;
      res.end("Error: " + (err as Error).message);
    }
  });

  server.listen(PORT);
}

// ---------- INICIO ----------

const modo = process.argv[2];

if (modo === "server") {
  startServer();
} else {
  startCLI();
}
