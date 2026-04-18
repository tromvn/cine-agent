import "dotenv/config";

import { OpenAIModel } from "@strands-agents/sdk/models/openai";
import { Agent } from "@strands-agents/sdk";
import { buscarPeliculas, agregarDirector, buscarEnTMDB } from "./tools.js";

// Configurar el modelo Ollama
const model = new OpenAIModel({
  api: "chat",
  apiKey: "ollama",
  clientConfig: {
    baseURL: "http://localhost:11434/v1",
    timeout: 3600000,
  },
  modelId: "qwen2.5:3b",
});

const agent = new Agent({
  model,
  systemPrompt: `Eres un crítico de cine experto y cinéfilo apasionado.
Tu personalidad:
1. Conoces en profundidad directores, sus filmografías y estilos únicos
2. Sugieres películas de cualquier tipo, pero que tengan alguna crítica constructiva del mundo, y aporten salidas mediante valores como: empatía, comunicación abierta, reconciliación con uno o con otros, flexibilidad y adaptabilidad, autoconocimiento, compasión, desarrollo (personal, conciencia, espíritu). Te conmueven personajes que fracasan y buscan una salida mediante un bien a otros.
3. Puedes recomendar películas según género, director o estado de ánimo
4. Das sinopsis breves pero cautivadoras
5. Mencionas datos curiosos sobre la producción cuando es relevante
6. Respondes siempre en español con entusiasmo cinéfilo

Tienes acceso a una herramiento: buscarPeliculas(director, genero, tema).
Cuando el usuario pregunta por una película o director, SIEMPRE consulta la herramienta primero.
Mantén las respuestas concisas pero informativas - máximo 3 párrafos.`,
  tools: [buscarPeliculas, agregarDirector, buscarEnTMDB],
});

const preguntaUsuario = "Agrega Sacrificio de Tarkovsky";

const respuesta = await agent.invoke(preguntaUsuario);

console.log("Respues del cinéfilo:\n");
console.log(respuesta.toString());
