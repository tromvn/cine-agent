import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { tool } from "@strands-agents/sdk";
import { z } from "zod";

// Tipos para el dataset
interface Pelicula {
  titulo: string;
  año: number;
  genero: string;
  sinopsis: string;
  dato_curioso: string;
}

interface Director {
  nombre: string;
  pais: string;
  estilo: string;
  temas: string[];
  peliculas: Pelicula[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar el dataset una sola vez al importar el módulo
const directores: Director[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "directores.json"), "utf-8"),
);

/* 
- tool() le dice al agente que esta herramienta existe
- z.object() define y valida los parámetros que el modelo puede pasar
- callback() es la lógica que se ejecuta cuando el modelo la llama
*/

// Tool 1: Buscar películas dentro del dataset
export const buscarPeliculas = tool({
  name: "buscar_peliculas",
  description:
    "Busca directores y películas en la base de datos del cinéfilo" +
    "Filtra por nombre de director, género o tema." +
    "Úsala SIEMPRE que el usuario pregunte por un director o película específica.",
  inputSchema: z.object({
    director: z
      .string()
      .optional()
      .describe("Nombre del director, ej: Tarkovsky"),
    genero: z
      .string()
      .optional()
      .describe("Género, ej: Drama, Ciencia Ficción"),
    tema: z.string().optional().describe("Tema, ej: fe, memoria, compasión"),
  }),
  callback: ({ director = "", genero = "", tema = "" }) => {
    const resultados = directores.filter((d) => {
      const coincideDirector =
        !director || d.nombre.toLowerCase().includes(director.toLowerCase());
      const coincideTema =
        !tema ||
        d.temas.some((t) => t.toLowerCase().includes(tema.toLowerCase()));
      return coincideDirector && coincideTema;
    });

    if (!resultados.length) return "No encontré directores con esos criterios.";

    return JSON.stringify(
      resultados.map((d) => ({
        director: d.nombre,
        pais: d.pais,
        estilo: d.estilo,
        temas: d.temas,
        peliculas: genero
          ? d.peliculas.filter((p) =>
              p.genero.toLowerCase().includes(genero.toLowerCase()),
            )
          : d.peliculas,
      })),
      null,
      2,
    );
  },
});

import { httpRequest } from "@strands-agents/sdk/vended-tools/http-request"; // ← tool de Strands

// Tool 2: agregar director/película al dataset local
export const agregarDirector = tool({
  name: "agregar_director",
  description:
    "Agrega un nuevo director con sus películas al dataset local. " +
    "Úsala cuando el usuario pida agregar un director o película nueva.",
  inputSchema: z.object({
    nombre: z.string().describe("Nombre completo del director"),
    pais: z.string().describe("País de origen"),
    estilo: z.string().describe("Descripción del estilo cinematográfico"),
    temas: z.array(z.string()).describe("Lista de temas recurrentes"),
    peliculas: z
      .array(
        z.object({
          titulo: z.string(),
          año: z.number(),
          genero: z.string(),
          sinopsis: z.string(),
          dato_curioso: z.string(),
        }),
      )
      .describe("Películas del director"),
  }),
  callback: (nuevoDirector) => {
    console.log("agregarDirector ejecutada con:", nuevoDirector.nombre);
    const rutaDataset = path.join(__dirname, "data", "directores.json");

    // Leemos el estado actual del archivo
    const dataset: Director[] = JSON.parse(
      fs.readFileSync(rutaDataset, "utf-8"),
    );

    // Verificamos si ya existe para no duplicar
    const yaExiste = dataset.some(
      (d) => d.nombre.toLowerCase() === nuevoDirector.nombre.toLowerCase(),
    );
    if (yaExiste) {
      return `El director "${nuevoDirector.nombre}" ya existe en el dataset.`;
    }

    // Agregamos y guardamos
    dataset.push(nuevoDirector);
    fs.writeFileSync(rutaDataset, JSON.stringify(dataset, null, 2), "utf-8");

    return `Director "${nuevoDirector.nombre}" agregado correctamente con ${nuevoDirector.peliculas.length} películas.`;
  },
});

// Tool 3: buscar info en TMDB (Se necesita registro para obtener API Key y Token)
export const buscarEnTMDB = tool({
  name: "buscar_en_tmdb",
  description:
    "Busca información de un director o película en la base de datos de TMDB (The Movie Database). " +
    "Úsala cuando necesites datos externos antes de agregar al dataset local.",
  inputSchema: z.object({
    nombre: z.string().describe("Nombre del director o película a buscar"),
    tipo: z
      .enum(["director", "pelicula"])
      .describe("Qué tipo de búsqueda hacer"),
  }),
  callback: async ({ nombre, tipo }) => {
    const token = process.env.TMDB_TOKEN;
    if (!token)
      return "Error: TMDB_TOKEN no configurada en variables de entorno.";

    const url =
      tipo === "director"
        ? `https://api.themoviedb.org/3/search/person?query=${encodeURIComponent(nombre)}&&language=es`
        : `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(nombre)}&&language=es`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = (await res.json()) as { results: unknown[] };

    if (!data.results?.length)
      return `No encontré resultados para "${nombre}" en TMDB.`;

    // Devolvemos los primeros 3 resultados para no saturar el contexto
    return JSON.stringify(data.results.slice(0, 3), null, 2);
  },
});
