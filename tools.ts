import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { tool } from "@strands-agents/sdk";
import { z } from "zod";
import { TfIdfIndex } from "./tfidf.js";

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

let directores: Director[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "directores.json"), "utf-8"),
);

const index = new TfIdfIndex();

function rebuildIndex() {
  index.clear();
  for (const d of directores) {
    const texto = [
      d.nombre,
      d.pais,
      d.estilo,
      ...d.temas,
      ...d.peliculas.map(
        (p) => `${p.titulo} ${p.genero} ${p.sinopsis} ${p.dato_curioso}`,
      ),
    ].join(" ");
    index.add(texto, {
      nombre: d.nombre,
      pais: d.pais,
      estilo: d.estilo,
      temas: d.temas,
    });
  }
  index.build();
}

rebuildIndex();

export const buscarPeliculas = tool({
  name: "buscar_peliculas",
  description:
    "Busca directores y películas usando búsqueda semántica TF-IDF. " +
    "Filtra por cualquier texto: director, género, tema, estado de ánimo.",
  inputSchema: z.object({
    query: z.string().describe("Texto libre de búsqueda"),
  }),
  callback: ({ query }) => {
    const results = index.search(query, 5);
    if (!results.length) return "No encontré nada relevante con esos términos.";

    const encontrados = results
      .map((r) => {
        const d = directores.find((dir) => dir.nombre === r.metadata.nombre);
        return d
          ? {
              director: d.nombre,
              pais: d.pais,
              estilo: d.estilo,
              temas: d.temas,
              peliculas: d.peliculas,
            }
          : null;
      })
      .filter(Boolean);

    return JSON.stringify(encontrados, null, 2);
  },
});

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

    const dataset: Director[] = JSON.parse(
      fs.readFileSync(rutaDataset, "utf-8"),
    );

    const yaExiste = dataset.some(
      (d) => d.nombre.toLowerCase() === nuevoDirector.nombre.toLowerCase(),
    );
    if (yaExiste) {
      return `El director "${nuevoDirector.nombre}" ya existe en el dataset.`;
    }

    const peliculasUnicas = nuevoDirector.peliculas.filter(
      (pelicula, index, self) =>
        index ===
        self.findIndex(
          (p) => p.titulo.toLowerCase() === pelicula.titulo.toLowerCase(),
        ),
    );

    dataset.push({ ...nuevoDirector, peliculas: peliculasUnicas });
    fs.writeFileSync(rutaDataset, JSON.stringify(dataset, null, 2), "utf-8");

    directores = dataset;
    rebuildIndex();

    return `Director "${nuevoDirector.nombre}" agregado correctamente con ${peliculasUnicas.length} películas.`;
  },
});

export const buscarEnTMDB = tool({
  name: "buscar_en_tmdb",
  description:
    "Busca información de un director o película en TMDB. " +
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
        ? `https://api.themoviedb.org/3/search/person?query=${encodeURIComponent(nombre)}&language=es`
        : `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(nombre)}&language=es`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = (await res.json()) as { results: unknown[] };
    if (!data.results?.length)
      return `No encontré resultados para "${nombre}" en TMDB.`;

    return JSON.stringify(data.results.slice(0, 3), null, 2);
  },
});

export const abrirStream = tool({
  name: "abrir_stream",
  description:
    "Abre una película en streamimdb.ru para ver online. Requiere el ID de TMDB.",
  inputSchema: z.object({
    tmdbId: z.number().describe("ID numérico de la película en TMDB"),
    titulo: z.string().describe("Título de la película"),
  }),
  callback: async ({ tmdbId, titulo }) => {
    const url = `https://streamimdb.ru/movie/${tmdbId}`;
    console.log(`ABRIR: ${url}`);
    return `🔗 Abriendo stream para "${titulo}" en el navegador.\n${url}`;
  },
});

export const buscarTrailer = tool({
  name: "buscar_trailer",
  description: "Busca el trailer de una película en YouTube.",
  inputSchema: z.object({
    titulo: z.string().describe("Título de la película"),
    año: z.number().optional().describe("Año de estreno"),
  }),
  callback: ({ titulo, año: anyo }) => {
    const query = encodeURIComponent(
      `${titulo}${anyo ? ` ${anyo}` : ""} trailer`,
    );
    const url = `https://www.youtube.com/results?search_query=${query}`;
    console.log(`ABRIR: ${url}`);
    return `🔍 Buscando trailer para "${titulo}" en YouTube.\n${url}`;
  },
});

// ---------- PENDIENTES ----------

const rutaPendientes = path.join(__dirname, "data", "pendientes.json");

function leerPendientes() {
  return JSON.parse(fs.readFileSync(rutaPendientes, "utf-8"));
}

function guardarPendientes(data: unknown[]) {
  fs.writeFileSync(rutaPendientes, JSON.stringify(data, null, 2), "utf-8");
}

export const agregarPendiente = tool({
  name: "agregar_pendiente",
  description: "Agrega una película a la lista de pendientes.",
  inputSchema: z.object({
    titulo: z.string().describe("Título de la película"),
    director: z.string().optional().describe("Director (opcional)"),
  }),
  callback: ({ titulo, director }) => {
    const lista = leerPendientes();
    const yaExiste = lista.some(
      (p: any) => p.titulo.toLowerCase() === titulo.toLowerCase(),
    );
    if (yaExiste) return `"${titulo}" ya está en tu lista de pendientes.`;

    lista.push({
      titulo,
      director: director || null,
      fecha: new Date().toISOString().slice(0, 10),
    });
    guardarPendientes(lista);
    return `"${titulo}"${director ? ` de ${director}` : ""} agregada a tu lista de pendientes.`;
  },
});

export const listarPendientes = tool({
  name: "listar_pendientes",
  description: "Muestra todas las películas pendientes de la lista.",
  inputSchema: z.object({}),
  callback: () => {
    const lista = leerPendientes();
    if (!lista.length) return "No tienes películas pendientes.";
    return JSON.stringify(lista, null, 2);
  },
});

export const eliminarPendiente = tool({
  name: "eliminar_pendiente",
  description: "Elimina una película de la lista de pendientes.",
  inputSchema: z.object({
    titulo: z.string().describe("Título de la película a eliminar"),
  }),
  callback: ({ titulo }) => {
    const lista = leerPendientes();
    const nueva = lista.filter(
      (p: any) => p.titulo.toLowerCase() !== titulo.toLowerCase(),
    );
    if (nueva.length === lista.length)
      return `"${titulo}" no está en pendientes.`;
    guardarPendientes(nueva);
    return `"${titulo}" eliminada de pendientes.`;
  },
});
