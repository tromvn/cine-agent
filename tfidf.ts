interface TfIdfDocument {
  id: string;
  text: string;
  tokens: string[];
  tf: Record<string, number>;
  metadata: Record<string, unknown>;
}

function normalize(text: string): string {
  const map: Record<string, string> = {
    á: "a", é: "e", í: "i", ó: "o", ú: "u",
    ā: "a", ē: "e", ī: "i", ō: "o", ū: "u",
    ü: "u", ñ: "n",
  };
  return text
    .toLowerCase()
    .replace(/[áéíóúāēīōūüñ]/g, (c) => map[c] || c);
}

function tokenize(text: string): string[] {
  return normalize(text)
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

export class TfIdfIndex {
  private docs: TfIdfDocument[] = [];
  private idf: Record<string, number> = {};

  clear() {
    this.docs = [];
    this.idf = {};
  }

  add(text: string, metadata: Record<string, unknown>) {
    const tokens = tokenize(text);
    const tf: Record<string, number> = {};
    for (const t of tokens) {
      tf[t] = (tf[t] || 0) + 1 / tokens.length;
    }
    this.docs.push({ id: crypto.randomUUID(), text, tokens, tf, metadata });
  }

  build() {
    const total = this.docs.length;
    const df: Record<string, number> = {};
    for (const doc of this.docs) {
      const unique = new Set(doc.tokens);
      for (const t of unique) {
        df[t] = (df[t] || 0) + 1;
      }
    }
    for (const [t, count] of Object.entries(df)) {
      this.idf[t] = Math.log(total / count) + 1;
    }
  }

  search(query: string, topK = 3): Array<{ text: string; score: number; metadata: Record<string, unknown> }> {
    const qTokens = tokenize(query);
    const qTf: Record<string, number> = {};
    for (const t of qTokens) {
      qTf[t] = (qTf[t] || 0) + 1 / qTokens.length;
    }

    const scores = this.docs.map((doc) => {
      let dot = 0;
      let qMag = 0;
      let dMag = 0;
      for (const t of qTokens) {
        const w = qTf[t] * (this.idf[t] || 0);
        qMag += w * w;
      }
      for (const [t, w] of Object.entries(doc.tf)) {
        const idfW = this.idf[t] || 0;
        const dW = w * idfW;
        dMag += dW * dW;
        if (qTf[t]) {
          dot += dW * (qTf[t] * idfW);
        }
      }
      qMag = Math.sqrt(qMag);
      dMag = Math.sqrt(dMag);
      const score = qMag === 0 || dMag === 0 ? 0 : dot / (qMag * dMag);
      return { text: doc.text, score, metadata: doc.metadata };
    });

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK).filter((s) => s.score > 0.05);
  }
}