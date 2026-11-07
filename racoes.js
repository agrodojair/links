// =====================================================================
//  Agro do Jair - Níveis de garantia (racoes.html)
//  Visitantes: só LEEM uma ração por código (Firestore: coleção "racoes").
//  Escrita: só a conta administradora (regras do Firestore, ver firestore.rules).
//  Tudo é exibido com textContent (nunca innerHTML), então não há injeção de HTML.
// =====================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, deleteDoc,
  collection, getDocs, query, where, Timestamp, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

const AUTH_URL = "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";

// Projeto Firebase próprio das rações (racoes-f0291). Esses dados são públicos por natureza;
// quem protege o banco são as regras do Firestore.
const firebaseConfig = {
  apiKey: "AIzaSyCUx8Q47V0_ZIejNeRI22kKNj6tqAr9FoI",
  authDomain: "racoes-f0291.firebaseapp.com",
  projectId: "racoes-f0291",
  storageBucket: "racoes-f0291.firebasestorage.app",
  messagingSenderId: "247026655590",
  appId: "1:247026655590:web:615e6b1b6f7572735ae8a7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Ordem EXATA das colunas da planilha. Para criar uma coluna nova: acrescente uma linha aqui.
// k = nome do campo no banco | l = rótulo exibido | u = unidade ("%" ou "kcal/kg")
const CAMPOS = [
  { k: "umidade",               l: "Umidade",                u: "%" },
  { k: "proteina_bruta",        l: "Proteína Bruta",         u: "%" },
  { k: "extrato_etereo",        l: "Extrato Etéreo",         u: "%" },
  { k: "materia_mineral",       l: "Matéria Mineral",        u: "%" },
  { k: "materia_fibrosa",       l: "Matéria Fibrosa",        u: "%" },
  { k: "calcio",                l: "Cálcio",                 u: "%" },
  { k: "fosforo",               l: "Fósforo",                u: "%" },
  { k: "sodio",                 l: "Sódio",                  u: "%" },
  { k: "extrato_yucca",         l: "Extrato de Yucca",       u: "%" },
  { k: "potassio",              l: "Potássio",               u: "%" },
  { k: "omega6",                l: "Ômega 6",                u: "%" },
  { k: "omega3",                l: "Ômega 3",                u: "%" },
  { k: "bcaa",                  l: "BCAA",                   u: "%" },
  { k: "l_carnitina",           l: "L-Carnitina",            u: "%" },
  { k: "sulfato_condroitina",   l: "Sulfato de Condroitina", u: "%" },
  { k: "sulfato_glicosamina",   l: "Sulfato de Glicosamina", u: "%" },
  { k: "energia_metabolizavel", l: "Energia Metabolizável",  u: "kcal/kg" }
];

// Escala de qualidade, da mais simples à melhor (ordem em que as imagens aparecem).
// k = valor salvo no banco (não mude, senão as rações já cadastradas perdem a qualidade)
// l = nome exibido na página
const QUALIDADES = [
  { k: "standard",         l: "Standard" },
  { k: "premium",          l: "Premium" },
  { k: "premium_especial", l: "Premium Especial" },
  { k: "super_premium",    l: "Super Premium" }
];

// Espécie (campo de uso interno: não é exibido na página pública)
const ESPECIES = { caes: "Cães", gatos: "Gatos" };
const especieValida = (v) => typeof v === "string" && Object.prototype.hasOwnProperty.call(ESPECIES, v);

const $ = (id) => document.getElementById(id);
const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });

/* ---------------------------- utilidades ---------------------------- */

// "151", "0151" -> "0151". Qualquer coisa que não seja só dígitos -> null.
function normalizarCodigo(txt) {
  const t = String(txt ?? "").trim();
  if (!/^\d{1,8}$/.test(t)) return null;
  const n = parseInt(t, 10);
  if (n <= 0) return null;
  return String(n).padStart(4, "0");
}

// Só aceita imgur (https) ou um caminho relativo dentro do próprio site.
function imagemSegura(u) {
  if (typeof u !== "string") return null;
  const s = u.trim();
  if (/^https:\/\/i\.imgur\.com\/[A-Za-z0-9_\-./]+$/.test(s)) return s;
  if (/^(?!.*\.\.)[A-Za-z0-9_\-/]+\.(jpe?g|png|webp|gif|avif)$/i.test(s)) return s;
  return null;
}

function valorVisivel(v) {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

function formatar(campo, v) {
  return campo.u === "%" ? `${nf.format(v)}%` : `${nf.format(v)} ${campo.u}`;
}

function mostrar(el, texto, erro = false) {
  el.textContent = texto;
  el.classList.toggle("erro", erro);
  el.hidden = !texto;
}

/* ------------------------- página pública -------------------------- */

const estado = $("estado");
const resultado = $("resultado");
let seq = 0; // evita que uma busca antiga sobrescreva uma mais nova

// Imagens ficam no próprio site: <pasta>/<código>.png. Sem imagem -> 0000.png (padrão).
const PASTA_IMAGENS = "https://agrodojair.github.io/links/racoes/images/";

function desenharFoto(id) {
  const box = $("foto");
  box.replaceChildren();
  const img = document.createElement("img");
  img.alt = "Foto da ração";
  img.referrerPolicy = "no-referrer";
  img.decoding = "async";
  let tentouPadrao = false;
  img.addEventListener("error", () => {
    if (!tentouPadrao) {
      tentouPadrao = true;
      img.src = `${PASTA_IMAGENS}0000.png`;
    } else {
      semFoto(box);
    }
  });
  img.src = `${PASTA_IMAGENS}${id}.png`;
  box.append(img);
}

function semFoto(box) {
  box.replaceChildren();
  const s = document.createElement("span");
  s.className = "sem-foto";
  s.textContent = "Foto indisponível";
  box.append(s);
}

// Indicador de qualidade: 4 degraus, preenchidos até o nível da ração (sem imagens).
function desenharQualidade(valor) {
  const cartao = $("cartaoQualidade");
  const escala = $("qEscala");
  escala.replaceChildren();
  const nivel = QUALIDADES.findIndex((q) => q.k === valor);
  if (nivel < 0) { cartao.hidden = true; return; } // sem qualidade cadastrada: não mostra nada
  QUALIDADES.forEach((q, i) => {
    const passo = document.createElement("div");
    passo.className = "q-passo" + (i <= nivel ? " ativo" : "") + (i === nivel ? " atual" : "");
    passo.dataset.q = q.k; // cada degrau tem a cor da sua qualidade
    const barra = document.createElement("div");
    barra.className = "q-barra";
    const rot = document.createElement("div");
    rot.className = "q-rotulo";
    rot.textContent = q.l;
    passo.append(barra, rot);
    escala.append(passo);
  });
  $("qNome").textContent = QUALIDADES[nivel].l;
  cartao.dataset.q = QUALIDADES[nivel].k; // cor do cartão = cor da qualidade da ração
  escala.setAttribute("aria-label", `Nível ${nivel + 1} de ${QUALIDADES.length}: ${QUALIDADES[nivel].l}`);
  cartao.hidden = false;
}

function desenharRacao(id, d) {
  $("nomeRacao").textContent = String(d.descricao ?? "");
  $("codigoRacao").textContent = id;
  desenharFoto(id);
  desenharQualidade(d.qualidade);

  const tbody = $("tabelaNiveis");
  tbody.replaceChildren();
  const n = d.n && typeof d.n === "object" ? d.n : {};
  for (const campo of CAMPOS) {
    const v = n[campo.k];
    if (!valorVisivel(v)) continue; // vazio ou 0: não aparece nem o nome
    const tr = document.createElement("tr");
    const td1 = document.createElement("td");
    const td2 = document.createElement("td");
    td1.textContent = campo.l;
    td2.textContent = formatar(campo, v);
    tr.append(td1, td2);
    tbody.append(tr);
  }
  if (!tbody.children.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 2;
    td.textContent = "Níveis de garantia ainda não cadastrados.";
    tr.append(td);
    tbody.append(tr);
  }

  const comp = typeof d.composicao === "string" ? d.composicao.trim() : "";
  $("composicaoRacao").textContent = comp;
  $("cartaoComposicao").hidden = !comp;
  resultado.hidden = false;
}

// Cache local (neste aparelho) das rações já consultadas: repetir a consulta não gasta leitura do Firebase.
// Depois desse tempo a ração é buscada de novo, então edições feitas no painel chegam em até X minutos.
const CACHE_RACAO_MIN = 30;
const CACHE_RACAO_PREFIXO = "racao:";

function lerCacheRacao(id) {
  try {
    const bruto = localStorage.getItem(CACHE_RACAO_PREFIXO + id);
    if (!bruto) return null;
    const o = JSON.parse(bruto);
    if (!o || !o.d || Date.now() - o.t > CACHE_RACAO_MIN * 60 * 1000) {
      localStorage.removeItem(CACHE_RACAO_PREFIXO + id);
      return null;
    }
    return o.d;
  } catch (_) { return null; }
}

function gravarCacheRacao(id, dados) {
  try {
    const { atualizadoEm, ...resto } = dados; // o carimbo de data do Firestore não vai para o cache
    localStorage.setItem(CACHE_RACAO_PREFIXO + id, JSON.stringify({ t: Date.now(), d: resto }));
  } catch (_) { /* armazenamento cheio ou bloqueado: segue sem cache */ }
}

function apagarCacheRacao(id) {
  try { localStorage.removeItem(CACHE_RACAO_PREFIXO + id); } catch (_) {}
}

async function carregar(cod) {
  const minha = ++seq;
  const id = normalizarCodigo(cod);
  resultado.hidden = true;
  esconderCards();
  if (!id) {
    mostrar(estado, "Digite um código válido (somente números).", true);
    return;
  }
  const guardada = lerCacheRacao(id);
  if (guardada) { // já consultada há pouco: não vai ao Firebase (0 leituras)
    mostrar(estado, "");
    desenharRacao(id, guardada);
    return;
  }
  mostrar(estado, "Buscando…");
  try {
    const snap = await getDoc(doc(db, "racoes", id));
    if (minha !== seq) return;
    if (!snap.exists()) {
      mostrar(estado, `Nenhuma ração encontrada com o código ${id}.`, true);
      return;
    }
    mostrar(estado, "");
    gravarCacheRacao(id, snap.data());
    desenharRacao(id, snap.data());
  } catch (e) {
    if (minha !== seq) return;
    console.error(e);
    mostrar(estado, "Não foi possível consultar agora. Tente novamente em instantes.", true);
  }
}

/* @@BUSCA-INI  (motor de busca: sem acesso ao DOM, testável isoladamente) */

// Normalização: minúsculas, sem acento, números e letras separados ("omega3" -> "omega 3"),
// decimais preservados ("28,5" -> "28_5").
function semAcento(s) {
  return String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function tokenizar(s) {
  return semAcento(s)
    .replace(/(\d)[.,](\d)/g, "$1_$2")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9_]+/g, " ")
    .trim().split(" ").filter(Boolean);
}
const ehNumero = (t) => /^\d+(_\d+)?$/.test(t);
const valorNumero = (t) => parseFloat(t.replace("_", "."));

// Aproximação fonética para erros de escrita comuns em português (nos dois lados da comparação)
function fonetica(t) {
  if (/\d/.test(t)) return t;
  return t.replace(/ph/g, "f").replace(/ck/g, "c").replace(/h/g, "").replace(/y/g, "i")
          .replace(/w/g, "v").replace(/z/g, "s").replace(/(.)\1+/g, "$1");
}

// Distância de edição (inclui troca de letras vizinhas), com parada antecipada
function distancia(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length, n = b.length;
  let ant2 = null, ant = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    let minLinha = i;
    for (let j = 1; j <= n; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(ant[j] + 1, cur[j - 1] + 1, ant[j - 1] + custo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, ant2[j - 2] + 1);
      cur[j] = v;
      if (v < minLinha) minLinha = v;
    }
    if (minLinha > max) return max + 1;
    ant2 = ant; ant = cur;
  }
  return ant[n];
}

// Quão bem o termo digitado (q) combina com uma palavra do índice (0 a 1)
function pontoToken(q, fq, tk) {
  const t = tk.t;
  if (q === t) return 1;
  if (q.length < 2 || t.length < 2 || ehNumero(q)) return 0;
  if (t.startsWith(q)) return 0.9;                       // "cast" -> "castrados"
  if (q.length >= 4 && t.includes(q)) return 0.7;
  if (fq === tk.f) return 0.85;                          // "salmau", "castrados" com h/z/y trocados
  if (fq.length >= 3 && tk.f.startsWith(fq)) return 0.8;
  if (q.length >= 4) {
    const max = q.length >= 6 ? 2 : 1;                   // erro de digitação
    const d = distancia(q, t, max);
    if (d <= max) return d === 1 ? 0.75 : 0.65;
    if (q.length >= 5 && t.length > q.length && distancia(q, t.slice(0, q.length), 1) <= 1) return 0.72; // palavra incompleta com erro
  }
  return 0;
}

/* ----- significado dos campos ----- */
const ESPECIE_SIN = {
  caes:  ["cao", "caes", "cachorro", "cachorros", "dog", "canino", "caninos"],
  gatos: ["gato", "gatos", "felino", "felinos", "cat"]
};
const QUALIDADE_SIN = {
  standard:         ["standard", "padrao", "economica", "simples", "basica"],
  premium:          ["premium"],
  premium_especial: ["premium", "especial"],
  super_premium:    ["super", "premium", "melhor", "top"]
};
const NUTRIENTE_ALIAS = {
  proteina_bruta: ["proteina", "proteinas", "pb"],
  extrato_etereo: ["gordura", "gorduras", "lipidio", "lipidios", "etereo"],
  materia_mineral: ["mineral", "minerais", "cinza", "cinzas"],
  materia_fibrosa: ["fibra", "fibras", "fibrosa"],
  umidade: ["umidade"],
  calcio: ["calcio"], fosforo: ["fosforo"], sodio: ["sodio"], potassio: ["potassio"],
  extrato_yucca: ["yucca", "yuca"],
  bcaa: ["bcaa"], l_carnitina: ["carnitina"],
  sulfato_condroitina: ["condroitina"], sulfato_glicosamina: ["glicosamina"],
  energia_metabolizavel: ["energia", "caloria", "calorias", "kcal", "calorica", "calorico", "energetica", "energetico"]
};
const ALIAS = {};
for (const [k, lista] of Object.entries(NUTRIENTE_ALIAS)) for (const a of lista) ALIAS[a] = k;

// Palavras que representam uma necessidade (não um nutriente citado diretamente)
const NECESSIDADE = {
  light:        { k: "extrato_etereo", dir: "asc" },
  odor:         { k: "extrato_yucca" },
  cheiro:       { k: "extrato_yucca" },
  articulacao:  { qualquer: ["sulfato_condroitina", "sulfato_glicosamina"] },
  articulacoes: { qualquer: ["sulfato_condroitina", "sulfato_glicosamina"] },
  artrose:      { qualquer: ["sulfato_condroitina", "sulfato_glicosamina"] },
  pelagem:      { qualquer: ["omega6", "omega3"] },
  pelo:         { qualquer: ["omega6", "omega3"] },
  pele:         { qualquer: ["omega6", "omega3"] },
  omega:        { qualquer: ["omega6", "omega3"] }
};
const MAIS = new Set(["alta", "alto", "altos", "altas", "rica", "rico", "maior", "maiores", "mais", "muita", "muito", "acima", "minimo", "min", "superior"]);
const MENOS = new Set(["baixa", "baixo", "baixos", "baixas", "pouca", "pouco", "menor", "menores", "menos", "abaixo", "maximo", "max", "ate", "inferior"]);
const PALAVRAS_VAZIAS = new Set(["de", "da", "do", "das", "dos", "com", "para", "e", "a", "o", "as", "os", "que", "em", "um", "uma",
  "teor", "nivel", "niveis", "garantia", "racao", "racoes", "qual", "quais", "tem", "tenha", "extrato", "materia"]);

// Separa o que é nutriente/necessidade (filtro e ordem) do que é texto (nome, composição, espécie, qualidade)
function interpretar(tokens) {
  const nut = new Array(tokens.length).fill(false);
  const consumido = new Array(tokens.length).fill(false);
  const intencoes = []; // { pos, k?, qualquer?, dir? }
  tokens.forEach((t, i) => {
    if (t === "omega" && (tokens[i + 1] === "3" || tokens[i + 1] === "6")) {
      intencoes.push({ pos: i, k: "omega" + tokens[i + 1] });
      nut[i] = nut[i + 1] = consumido[i] = consumido[i + 1] = true;
    } else if (ALIAS[t]) {
      intencoes.push({ pos: i, k: ALIAS[t] });
      nut[i] = consumido[i] = true;
    } else if (NECESSIDADE[t] && !nut[i]) {
      intencoes.push({ pos: i, ...NECESSIDADE[t] });
      nut[i] = consumido[i] = true;
    }
  });

  const filtros = [], exige = [], qualquer = [];
  let ordem = null;
  for (const it of intencoes) {
    if (it.qualquer) { qualquer.push(it.qualquer); if (!ordem) ordem = { k: it.qualquer[0], dir: "desc", implicito: true }; continue; }
    let num = null, numIdx = -1, cmp = null, cmpIdx = -1;
    for (let d = 1; d <= 4; d++) {
      for (const i of [it.pos + d, it.pos - d]) {
        if (i < 0 || i >= tokens.length || nut[i]) continue;
        if (num === null && ehNumero(tokens[i])) { num = valorNumero(tokens[i]); numIdx = i; }
        if (cmp === null && (MAIS.has(tokens[i]) || MENOS.has(tokens[i]))) { cmp = MENOS.has(tokens[i]) ? "menos" : "mais"; cmpIdx = i; }
      }
    }
    if (num !== null) {
      // "proteina 30": número colado no nutriente. Pesos ("10 kg") não contam.
      const colado = Math.abs(numIdx - it.pos) === 1 && !["kg", "g"].includes(tokens[numIdx + 1]);
      if (cmp === null && !colado) { num = null; numIdx = -1; }
    }
    exige.push(it.k);
    if (num !== null) {
      filtros.push({ k: it.k, op: cmp === "menos" ? "<=" : ">=", val: num });
      consumido[numIdx] = true;
      if (cmpIdx >= 0) consumido[cmpIdx] = true;
    } else {
      const dir = it.dir || (cmp === "menos" ? "asc" : "desc");
      if (cmpIdx >= 0) consumido[cmpIdx] = true;
      if (!ordem || (ordem.implicito && (cmp !== null || it.dir))) ordem = { k: it.k, dir, implicito: cmp === null && !it.dir };
    }
  }
  const texto = tokens.filter((t, i) => !consumido[i] && !PALAVRAS_VAZIAS.has(t));
  const palavras = intencoes.map((x) => tokens[x.pos]);
  return { texto, filtros, exige, qualquer, ordem, palavras, ha: intencoes.length > 0 };
}

const LIMIAR = 0.45;

function passaFiltros(r, it) {
  const n = r.n || {};
  const tem = (k) => typeof n[k] === "number" && n[k] > 0;
  for (const k of it.exige) if (!tem(k)) return false;
  for (const grupo of it.qualquer) if (!grupo.some(tem)) return false;
  for (const f of it.filtros) {
    if (!tem(f.k)) return false;
    if (f.op === ">=" ? n[f.k] < f.val : n[f.k] > f.val) return false;
  }
  return true;
}

// Prepara as palavras pesquisáveis de cada ração (nome, espécie, qualidade e composição, com pesos)
function prepararIndice(lista) {
  return lista.map((r) => {
    const mapa = new Map();
    const add = (texto, peso) => {
      for (const t of tokenizar(texto)) {
        const atual = mapa.get(t);
        if (!atual || atual.w < peso) mapa.set(t, { t, f: fonetica(t), w: peso });
      }
    };
    add(r.d, 1);
    if (ESPECIE_SIN[r.e]) add(ESPECIE_SIN[r.e].join(" "), 0.9);
    if (QUALIDADE_SIN[r.q]) add(QUALIDADE_SIN[r.q].join(" "), 0.9);
    add(r.k, 0.6);
    return { ...r, campos: [...mapa.values()], nomeTokens: tokenizar(r.d) };
  });
}

// Retorna { itens, interpretacao, aproximado }
function buscarRacoes(consulta, lista) {
  const it = interpretar(tokenizar(consulta));
  const termos = it.texto.map((t) => ({ t, f: fonetica(t) }));
  const rodar = (minimo) => {
    const achados = [];
    for (const r of lista) {
      if (!passaFiltros(r, it)) continue;
      let soma = 0, casou = 0;
      for (const q of termos) {
        let melhor = 0;
        for (const c of r.campos) {
          const p = pontoToken(q.t, q.f, c) * c.w;
          if (p > melhor) melhor = p;
        }
        if (melhor >= LIMIAR) { casou++; soma += melhor; }
      }
      if (termos.length && casou < minimo(termos.length)) continue;
      let score = termos.length ? soma / termos.length : 0;
      // pequeno bônus quando o 1º termo abre o nome da ração
      if (termos.length && r.nomeTokens[0] && pontoToken(termos[0].t, termos[0].f, { t: r.nomeTokens[0], f: fonetica(r.nomeTokens[0]) }) >= 0.85) score += 0.05;
      // a palavra da necessidade (ex.: "light") aparecendo no próprio nome da ração vem primeiro
      const noNome = it.palavras.some((p) => r.nomeTokens.some((nt) => pontoToken(p, fonetica(p), { t: nt, f: fonetica(nt) }) >= 0.85));
      achados.push({ r, score, noNome });
    }
    return achados;
  };
  let achados = rodar((n) => n);
  let aproximado = false;
  if (!achados.length && termos.length >= 2) {
    achados = rodar((n) => Math.max(1, Math.ceil(n / 2)));
    aproximado = achados.length > 0;
  }
  const valor = (r) => (r.n && r.n[it.ordem.k]) || 0;
  achados.sort((a, b) => {
    if (a.noNome !== b.noNome) return a.noNome ? -1 : 1;
    if (it.ordem && !(it.ordem.implicito && termos.length)) {
      const d = it.ordem.dir === "asc" ? valor(a.r) - valor(b.r) : valor(b.r) - valor(a.r);
      if (d) return d;
    }
    return (b.score - a.score) || a.r.d.localeCompare(b.r.d, "pt-BR");
  });
  return { itens: achados.map((x) => x.r), it, aproximado };
}
/* @@BUSCA-FIM */

/* ----- busca por nome (usa um índice único guardado no Firestore: 1 leitura, ou 0 se estiver em cache local) ----- */
const INDICE_LOCAL = "racoes_indice_v1";
const INDICE_MIN = 30;      // minutos que o índice fica guardado no aparelho
const CARDS_POR_VEZ = 20;
let indicePronto = null;

async function obterIndice() {
  if (indicePronto) return indicePronto;
  let bruto = null;
  try {
    const o = JSON.parse(localStorage.getItem(INDICE_LOCAL) || "null");
    if (o && typeof o.dados === "string" && Date.now() - o.t <= INDICE_MIN * 60 * 1000) bruto = o.dados;
  } catch (_) { /* sem cache */ }
  if (!bruto) {
    const snap = await getDoc(doc(db, "busca", "indice"));
    if (!snap.exists()) throw new Error("sem-indice");
    bruto = snap.data().dados;
    try { localStorage.setItem(INDICE_LOCAL, JSON.stringify({ t: Date.now(), dados: bruto })); } catch (_) {}
  }
  const lista = JSON.parse(bruto);
  if (!Array.isArray(lista)) throw new Error("indice-invalido");
  indicePronto = prepararIndice(lista.filter((r) => r && typeof r.c === "string" && typeof r.d === "string"));
  return indicePronto;
}

function esconderCards() { $("resultadosBusca").hidden = true; }

function descreverFiltros(it) {
  const partes = [];
  const rotulo = (k) => (CAMPOS.find((c) => c.k === k) || {}).l || k;
  for (const f of it.filtros) {
    const c = CAMPOS.find((x) => x.k === f.k);
    partes.push(`${rotulo(f.k)} ${f.op === ">=" ? "a partir de" : "até"} ${c ? formatar(c, f.val) : f.val}`);
  }
  for (const k of it.exige) if (!it.filtros.some((f) => f.k === k)) partes.push(`com ${rotulo(k)}`);
  if (it.ordem && !it.filtros.some((f) => f.k === it.ordem.k)) {
    partes.push(`${it.ordem.dir === "asc" ? "menor" : "maior"} ${rotulo(it.ordem.k)} primeiro`);
  }
  return partes;
}

function criarCard(r, it) {
  const a = document.createElement("a");
  a.className = "item-busca";
  a.href = `?cod=${r.c}`;
  a.addEventListener("click", (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // deixa abrir em nova aba
    e.preventDefault();
    history.pushState(null, "", `?cod=${r.c}`);
    $("campoCodigo").value = r.c;
    carregar(r.c);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  const nome = document.createElement("div");
  nome.className = "ib-nome";
  nome.textContent = r.d;

  const meta = document.createElement("div");
  meta.className = "ib-meta";
  const cod = document.createElement("span");
  cod.textContent = `Código ${r.c}`;
  meta.append(cod);
  if (especieValida(r.e)) {
    const chipE = document.createElement("span");
    chipE.className = "chip-e";
    chipE.dataset.e = r.e;
    chipE.textContent = `${r.e === "caes" ? "🐶" : "🐱"} ${ESPECIES[r.e]}`;
    meta.append(chipE);
  }
  const qual = QUALIDADES.find((q) => q.k === r.q);
  if (qual) {
    const chip = document.createElement("span");
    chip.className = "chip-q";
    chip.dataset.q = qual.k;
    chip.textContent = qual.l;
    meta.append(chip);
  }

  // Destaca os níveis que a pessoa pediu; sem pedido, proteína e gordura
  const chaves = [...it.exige, ...it.qualquer.flat()];
  const mostrarK = [...new Set(chaves.length ? chaves : ["proteina_bruta", "extrato_etereo"])];
  const partes = [];
  for (const k of mostrarK.slice(0, 3)) {
    const c = CAMPOS.find((x) => x.k === k);
    const v = r.n && r.n[k];
    if (c && valorVisivel(v)) partes.push(`${c.l}: ${formatar(c, v)}`);
  }
  a.append(nome, meta);
  if (partes.length) {
    const res = document.createElement("div");
    res.className = "ib-niveis";
    res.textContent = partes.join(" · ");
    a.append(res);
  }
  return a;
}

function mostrarCards(achados, it, texto, aproximado) {
  const box = $("resultadosBusca");
  const lista = $("listaBusca");
  const mais = $("maisBusca");
  lista.replaceChildren();
  let exibidos = 0;
  const ver = () => {
    for (const r of achados.slice(exibidos, exibidos + CARDS_POR_VEZ)) lista.append(criarCard(r, it));
    exibidos = Math.min(achados.length, exibidos + CARDS_POR_VEZ);
    mais.hidden = exibidos >= achados.length;
    mais.textContent = `Mostrar mais (${achados.length - exibidos})`;
  };
  mais.onclick = ver;
  const n = achados.length;
  let info = aproximado
    ? `Nenhum resultado exato. ${n} aproximado${n > 1 ? "s" : ""} para “${texto}”.`
    : `${n} ${n > 1 ? "rações" : "ração"} para “${texto}”.`;
  const filtros = descreverFiltros(it);
  if (filtros.length) info += ` Considerando: ${filtros.join("; ")}.`;
  $("buscaInfo").textContent = info;
  ver();
  box.hidden = false;
}

async function buscarTexto(texto) {
  const minha = ++seq;
  resultado.hidden = true;
  esconderCards();
  const consulta = String(texto ?? "").trim().slice(0, 80);
  if (!tokenizar(consulta).length) {
    mostrar(estado, "Digite o código ou parte do nome da ração.", true);
    return;
  }
  mostrar(estado, "Buscando…");
  let lista;
  try {
    lista = await obterIndice();
  } catch (e) {
    if (minha !== seq) return;
    console.error(e);
    mostrar(estado, e.message === "sem-indice"
      ? "A busca por nome ainda não está disponível. Use o código da ração."
      : "Não foi possível carregar a busca agora. Tente novamente em instantes.", true);
    return;
  }
  if (minha !== seq) return;
  const { itens, it, aproximado } = buscarRacoes(consulta, lista);
  if (!itens.length) {
    mostrar(estado, `Nenhuma ração encontrada para “${consulta}”.`, true);
    return;
  }
  mostrar(estado, "");
  mostrarCards(itens, it, consulta, aproximado);
}

$("formBusca").addEventListener("submit", (e) => {
  e.preventDefault();
  const texto = $("campoCodigo").value.trim();
  if (/^\d+$/.test(texto)) {            // só números: código exato
    const id = normalizarCodigo(texto);
    if (id) {
      $("campoCodigo").value = id;
      history.pushState(null, "", `?cod=${id}`);
    }
    carregar($("campoCodigo").value);
    return;
  }
  if (tokenizar(texto).length) {         // texto: busca por nome
    history.pushState(null, "", `?q=${encodeURIComponent(texto.slice(0, 80))}`);
  }
  buscarTexto(texto);
});

function lerUrl() {
  const p = new URLSearchParams(location.search);
  const cod = p.get("cod");
  const q = p.get("q");
  if (cod !== null) {
    $("campoCodigo").value = cod;
    carregar(cod);
  } else if (q !== null) {
    $("campoCodigo").value = q.slice(0, 80);
    buscarTexto(q);
  } else {
    seq++;
    resultado.hidden = true;
    esconderCards();
    mostrar(estado, "");
  }
}
window.addEventListener("popstate", lerUrl);
lerUrl();

/* ------------------------- leitor de QR Code ------------------------- */

// Domínios para onde o QR Code pode levar. Lista vazia = qualquer link https.
// Ex.: ["agrodojair.github.io"] aceita só links desse site.
const DOMINIOS_PERMITIDOS = [];

// Plano B para navegadores sem leitura nativa (iPhone/Safari, Firefox):
// coloque a biblioteca jsQR (jsQR.js) na mesma pasta desta página.
const ARQUIVO_JSQR = "jsQR.js";

const leitor = $("leitor");
const leitorVideo = $("leitorVideo");
let leitorStream = null;
let leitorAtivo = false;
let leitorSessao = 0;   // identifica a leitura em andamento

function msgLeitor(texto, erro = false) { mostrar($("msgLeitor"), texto, erro); }

function carregarJsQR() {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = ARQUIVO_JSQR;
    s.onload = () => (window.jsQR ? resolve(window.jsQR) : reject(new Error("jsQR")));
    s.onerror = () => {
      console.error(`Leitor de QR: não encontrei "${ARQUIVO_JSQR}" ao lado do racoes.html (necessário no iPhone/Safari).`);
      reject(new Error("jsQR"));
    };
    document.head.append(s);
  });
}

// Devolve uma função que lê um quadro do vídeo e retorna o texto do QR (ou null)
async function criarDecodificador() {
  if ("BarcodeDetector" in window) {
    try {
      const det = new BarcodeDetector({ formats: ["qr_code"] });
      return async () => {
        const r = await det.detect(leitorVideo);
        return r.length ? r[0].rawValue : null;
      };
    } catch (_) { /* cai no plano B */ }
  }
  const jsQR = await carregarJsQR();
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  return async () => {
    const w = leitorVideo.videoWidth, h = leitorVideo.videoHeight;
    if (!w || !h) return null;
    const esc = Math.min(1, 800 / w);
    canvas.width = Math.round(w * esc);
    canvas.height = Math.round(h * esc);
    ctx.drawImage(leitorVideo, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const r = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
    return r ? r.data : null;
  };
}

// Só aceita links https (e, se configurado, dos domínios permitidos)
function destinoSeguro(texto) {
  let u;
  try { u = new URL(String(texto).trim()); } catch (_) { return null; }
  if (u.protocol !== "https:") return null;
  if (DOMINIOS_PERMITIDOS.length && !DOMINIOS_PERMITIDOS.includes(u.hostname)) return null;
  return u.href;
}

function pararLeitor() {
  leitorAtivo = false;
  leitorSessao++; // invalida qualquer laço de leitura anterior
  if (leitorStream) leitorStream.getTracks().forEach((t) => t.stop());
  leitorStream = null;
  leitorVideo.srcObject = null;
}

function fecharLeitor() {
  pararLeitor();
  leitor.hidden = true;
  document.body.classList.remove("modal-aberto");
}

// iOS (Safari/Chrome/Firefox no iPhone) exige: vídeo mudo + playsinline, e a câmera
// pedida logo no toque do usuário (por isso getUserMedia vem antes de qualquer espera).
function prepararVideoIOS() {
  leitorVideo.muted = true;
  leitorVideo.autoplay = true;
  leitorVideo.playsInline = true;
  leitorVideo.setAttribute("playsinline", "");
  leitorVideo.setAttribute("webkit-playsinline", "");
  leitorVideo.setAttribute("muted", "");
}

async function abrirLeitor() {
  const sessao = ++leitorSessao;
  leitor.hidden = false;
  document.body.classList.add("modal-aberto");
  msgLeitor("Abrindo a câmera…");
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    msgLeitor("Este navegador não permite usar a câmera. Abra o site no Safari (por https) ou use a câmera do celular para ler o QR Code.", true);
    return;
  }
  prepararVideoIOS();
  try {
    // 1) câmera primeiro (precisa acontecer no gesto do toque, principalmente no iPhone)
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    if (sessao !== leitorSessao) { stream.getTracks().forEach((t) => t.stop()); return; } // fechou enquanto pedia permissão
    leitorStream = stream;

    // 2) leitor de QR (nativo ou jsQR)
    const decodificar = await criarDecodificador();
    if (sessao !== leitorSessao) return;

    // 3) vídeo
    leitorVideo.srcObject = stream;
    if (leitorVideo.readyState < 1) {
      await new Promise((ok) => leitorVideo.addEventListener("loadedmetadata", ok, { once: true }));
    }
    await leitorVideo.play();
    if (sessao !== leitorSessao) return;
    leitorAtivo = true;
    msgLeitor("Aponte a câmera para o QR Code.");

    let ultimoErro = "";
    while (sessao === leitorSessao) {
      let texto = null;
      if (leitorVideo.readyState >= 2 && leitorVideo.videoWidth > 0) {
        try { texto = await decodificar(); } catch (_) { /* quadro ruim: tenta o próximo */ }
      }
      if (sessao !== leitorSessao) return;
      if (texto) {
        const destino = destinoSeguro(texto);
        if (destino) {
          msgLeitor("QR Code lido! Abrindo…");
          pararLeitor();
          location.assign(destino); // mesma aba
          return;
        }
        if (texto !== ultimoErro) {
          ultimoErro = texto;
          msgLeitor("Este QR Code não contém um link permitido.", true);
        }
      }
      await new Promise((r) => setTimeout(r, 120));
    }
  } catch (e) {
    console.error("Leitor de QR:", e);
    if (sessao !== leitorSessao) return;
    pararLeitor();
    if (e && e.name === "NotAllowedError") msgLeitor("Permissão da câmera negada. No iPhone: Ajustes > Safari > Câmera > Perguntar/Permitir (ou toque em aA na barra do endereço > Ajustes do site).", true);
    else if (e && (e.name === "NotFoundError" || e.name === "OverconstrainedError")) msgLeitor("Nenhuma câmera disponível neste aparelho.", true);
    else if (e && e.message === "jsQR") msgLeitor("Leitor indisponível neste navegador. Use a câmera do celular para ler o QR Code.", true);
    else msgLeitor("Não foi possível iniciar a câmera. Feche outros apps que usam a câmera e tente de novo.", true);
  }
}

$("abrirLeitor").addEventListener("click", abrirLeitor);
$("fecharLeitor").addEventListener("click", fecharLeitor);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !leitor.hidden) fecharLeitor(); });
window.addEventListener("pagehide", pararLeitor);
// iOS congela a câmera quando o app vai para segundo plano: ao voltar, reinicia
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { if (!leitor.hidden) pararLeitor(); }
  else if (!leitor.hidden) abrirLeitor();
});

/* ------------------------- painel administrativo ------------------------- */

let authMod = null;
let auth = null;
let cache = new Map();     // id -> dados (somente no painel)
let editando = null;       // id sendo editado, ou null
const campoInputs = {};

// Monta os campos numéricos do formulário a partir de CAMPOS
(function montarGrade() {
  const grade = $("gradeNutrientes");
  for (const c of CAMPOS) {
    const wrap = document.createElement("div");
    const lab = document.createElement("label");
    lab.htmlFor = `n_${c.k}`;
    lab.textContent = `${c.l} (${c.u})`;
    const inp = document.createElement("input");
    inp.type = "text";
    inp.id = `n_${c.k}`;
    inp.inputMode = "decimal";
    inp.autocomplete = "off";
    campoInputs[c.k] = inp;
    wrap.append(lab, inp);
    grade.append(wrap);
  }
})();

function abrirAdmin() {
  $("admin").hidden = false;
  document.body.classList.add("modal-aberto");
  iniciarAuth();
}
function fecharAdmin() {
  $("admin").hidden = true;
  document.body.classList.remove("modal-aberto");
  if (location.hash === "#admin") history.replaceState(null, "", location.pathname + location.search);
}
$("abrirAdmin").addEventListener("click", abrirAdmin);
document.querySelectorAll("[data-fechar-admin]").forEach((b) => b.addEventListener("click", fecharAdmin));
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("admin").hidden) fecharAdmin(); });
if (location.hash === "#admin") abrirAdmin();

async function iniciarAuth() {
  if (auth) return;
  try {
    authMod = await import(AUTH_URL); // só carrega o módulo de login quando necessário
    auth = authMod.getAuth(app);
    authMod.onAuthStateChanged(auth, aoMudarUsuario);
  } catch (e) {
    console.error(e);
    mostrar($("msgLogin"), "Não foi possível carregar o login. Verifique a conexão.", true);
  }
}

async function aoMudarUsuario(user) {
  $("viewLogin").hidden = !!user;
  $("viewPainel").hidden = !user;
  if (user) {
    $("logadoComo").textContent = `Conectado como ${user.email}`;
    $("loginSenha").value = "";
    await carregarLista();
  } else {
    cache = new Map();
    limparForm();
  }
}

$("formLogin").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!auth) { await iniciarAuth(); if (!auth) return; }
  const btn = $("btnEntrar");
  btn.disabled = true;
  mostrar($("msgLogin"), "");
  try {
    await authMod.signInWithEmailAndPassword(auth, $("loginEmail").value.trim(), $("loginSenha").value);
  } catch (err) {
    const c = err && err.code;
    let m = "E-mail ou senha incorretos.";
    if (c === "auth/too-many-requests") m = "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
    else if (c === "auth/network-request-failed") m = "Sem conexão com o servidor.";
    else if (c === "auth/operation-not-allowed") m = "O login por e-mail/senha ainda não foi ativado no Firebase.";
    mostrar($("msgLogin"), m, true);
  } finally {
    btn.disabled = false;
  }
});

$("btnSair").addEventListener("click", () => authMod && authMod.signOut(auth));

/* ----- validação (usada no formulário e na importação) ----- */
function montarRegistro(codigo, descricao, imagem, n, composicao, qualidade, especie) {
  const id = normalizarCodigo(codigo);
  if (!id) throw new Error("Código inválido (use somente números).");
  const nome = String(descricao ?? "").replace(/\s+/g, " ").trim();
  if (!nome || nome.length > 120) throw new Error(`Nome inválido no código ${id} (1 a 120 caracteres).`);
  const img = String(imagem ?? "").trim();
  if (img && !imagemSegura(img)) {
    throw new Error("Imagem inválida: use um link https://i.imgur.com/... ou um caminho como images/racoes/0151.jpg.");
  }
  const comp = String(composicao ?? "").replace(/\r\n?/g, "\n").trim();
  if (comp.length > 3000) throw new Error(`Composição longa demais no código ${id} (máximo 3000 caracteres).`);
  const qual = String(qualidade ?? "").trim();
  if (qual && !QUALIDADES.some((q) => q.k === qual)) {
    throw new Error(`Qualidade inválida no código ${id} (use: ${QUALIDADES.map((q) => q.k).join(", ")}).`);
  }
  const esp = String(especie ?? "").trim();
  if (esp && !especieValida(esp)) {
    throw new Error(`Espécie inválida no código ${id} (use: ${Object.keys(ESPECIES).join(", ")}).`);
  }
  const limpo = {};
  for (const c of CAMPOS) {
    const v = n ? n[c.k] : undefined;
    if (v === undefined || v === null || v === "" ) continue;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new Error(`Valor inválido em "${c.l}" (código ${id}).`);
    if (c.u === "%" && v > 100) throw new Error(`"${c.l}" não pode passar de 100% (código ${id}).`);
    if (v > 0) limpo[c.k] = v;
  }
  return { id, dados: { codigo: id, descricao: nome, imagem: img, composicao: comp, qualidade: qual, especie: esp, n: limpo, atualizadoEm: serverTimestamp() } };
}

function lerForm() {
  const n = {};
  for (const c of CAMPOS) {
    const bruto = campoInputs[c.k].value.trim().replace(",", ".");
    if (bruto === "") continue;
    const num = Number(bruto);
    if (!Number.isFinite(num)) throw new Error(`Valor inválido em "${c.l}".`);
    n[c.k] = num;
  }
  return montarRegistro($("fCodigo").value, $("fNome").value, "", n, $("fComposicao").value, $("fQualidade").value, $("fEspecie").value);
}

function mensagemErroFirebase(e) {
  if (e && e.code === "permission-denied") return "Sem permissão: esta conta não é a administradora das rações.";
  if (e && e.code === "unavailable") return "Sem conexão com o servidor.";
  return e && e.message ? e.message : "Erro inesperado.";
}

/* ----- formulário ----- */
function limparForm() {
  $("formRacao").reset();
  editando = null;
  $("tituloForm").textContent = "Adicionar ração";
  $("fCodigo").readOnly = false;
  mostrar($("msgForm"), "");
}
$("btnLimpar").addEventListener("click", limparForm);

function preencherForm(id) {
  const d = cache.get(id);
  if (!d) return;
  limparForm();
  editando = id;
  $("tituloForm").textContent = `Editando ração ${id}`;
  $("fCodigo").value = id;
  $("fCodigo").readOnly = true; // trocar o código = outra ração; para isso, cadastre uma nova
  $("fNome").value = d.descricao || "";
  $("fComposicao").value = d.composicao || "";
  $("fQualidade").value = QUALIDADES.some((q) => q.k === d.qualidade) ? d.qualidade : "";
  $("fEspecie").value = especieValida(d.especie) ? d.especie : "";
  const n = d.n || {};
  for (const c of CAMPOS) {
    const v = n[c.k];
    campoInputs[c.k].value = valorVisivel(v) ? String(v).replace(".", ",") : "";
  }
  $("fCodigo").scrollIntoView({ behavior: "smooth", block: "center" });
}

$("formRacao").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("btnSalvar");
  mostrar($("msgForm"), "");
  let reg;
  try { reg = lerForm(); } catch (err) { mostrar($("msgForm"), err.message, true); return; }
  if (!editando && cache.has(reg.id)) {
    if (!confirm(`Já existe a ração ${reg.id} (${cache.get(reg.id).descricao}). Substituir?`)) return;
  }
  btn.disabled = true;
  try {
    await setDoc(doc(db, "racoes", reg.id), reg.dados);
    cache.set(reg.id, { ...reg.dados, atualizadoEm: null });
    salvarListaLocal();
    apagarCacheRacao(reg.id);
    desenharLista();
    limparForm();
    mostrar($("msgForm"), `Ração ${reg.id} salva com sucesso.`);
    try {
      await atualizarIndiceBusca(); // mantém a busca por nome em dia
    } catch (e) {
      console.error(e);
      mostrar($("msgForm"), `Ração ${reg.id} salva, mas o índice de busca não foi atualizado: ${erroTexto(e)}`, true);
    }
  } catch (err) {
    console.error(err);
    mostrar($("msgForm"), mensagemErroFirebase(err), true);
  } finally {
    btn.disabled = false;
  }
});


/* ----- índice de busca (um único documento "busca/indice", lido pelos visitantes) ----- */
function montarIndiceBusca(limiteComposicao) {
  const itens = [...cache.entries()].map(([id, d]) => {
    const r = { c: id, d: String(d.descricao || "") };
    if (QUALIDADES.some((q) => q.k === d.qualidade)) r.q = d.qualidade;
    if (especieValida(d.especie)) r.e = d.especie;
    const n = {};
    for (const c of CAMPOS) if (d.n && valorVisivel(d.n[c.k])) n[c.k] = d.n[c.k];
    if (Object.keys(n).length) r.n = n;
    const k = String(d.composicao || "").replace(/\s+/g, " ").trim().slice(0, limiteComposicao);
    if (k) r.k = k;
    return r;
  }).sort((a, b) => a.c.localeCompare(b.c));
  return JSON.stringify(itens);
}

async function atualizarIndiceBusca() {
  if (!cache.size) throw new Error("A lista de rações está vazia. Use \"Recarregar tudo do servidor\" e tente de novo.");
  let dados = "";
  for (const lim of [400, 100, 0]) { // se passar de ~900 KB (limite do Firestore é 1 MB), encurta a composição
    dados = montarIndiceBusca(lim);
    if (new TextEncoder().encode(dados).length <= 900000) break;
    if (lim === 0) throw new Error("Rações demais para o índice de busca caber em um documento.");
  }
  await setDoc(doc(db, "busca", "indice"), { v: 1, total: cache.size, dados, atualizadoEm: serverTimestamp() });
  try { localStorage.removeItem(INDICE_LOCAL); } catch (_) {}
  indicePronto = null;
  return cache.size;
}

function erroTexto(e) {
  return e && e.code ? mensagemErroFirebase(e) : (e && e.message) || "Erro desconhecido.";
}

$("btnIndice").addEventListener("click", async () => {
  const btn = $("btnIndice");
  btn.disabled = true;
  mostrar($("msgIndice"), "Atualizando o índice de busca…");
  try {
    const total = await atualizarIndiceBusca();
    mostrar($("msgIndice"), `Índice de busca atualizado com ${total} rações.`);
  } catch (e) {
    console.error(e);
    mostrar($("msgIndice"), erroTexto(e), true);
  } finally {
    btn.disabled = false;
  }
});

/* ----- lista ----- */
// A lista fica guardada neste aparelho. Ao abrir o painel só se baixa o que mudou desde a última
// sincronização (rações com atualizadoEm mais novo): normalmente 0 ou 1 leitura, em vez de ler o banco todo.
// Só o botão "Recarregar tudo" lê a coleção inteira (e é o único jeito de notar exclusões feitas em outro aparelho).
const LISTA_LOCAL = "racoes_lista_v1";
let ultimoSync = null; // { s: segundos, n: nanossegundos } do documento mais novo já baixado

function carimboDe(dados) {
  const t = dados && dados.atualizadoEm;
  return t && typeof t.seconds === "number" ? { s: t.seconds, n: t.nanoseconds || 0 } : null;
}
function maisNovo(a, b) {
  if (!a) return b;
  if (!b) return a;
  return (b.s > a.s || (b.s === a.s && b.n > a.n)) ? b : a;
}

function salvarListaLocal() {
  try {
    const itens = [...cache].map(([id, d]) => [id, { ...d, atualizadoEm: null }]);
    localStorage.setItem(LISTA_LOCAL, JSON.stringify({ v: 1, sync: ultimoSync, itens }));
  } catch (_) { /* sem espaço: a próxima abertura baixa a lista de novo */ }
}

function lerListaLocal() {
  try {
    const o = JSON.parse(localStorage.getItem(LISTA_LOCAL) || "null");
    if (!o || o.v !== 1 || !Array.isArray(o.itens) || !o.sync) return false;
    if (!Number.isFinite(o.sync.s) || !Number.isFinite(o.sync.n)) return false;
    cache = new Map(o.itens);
    ultimoSync = o.sync;
    return true;
  } catch (_) { return false; }
}

function infoLista(leituras) {
  $("infoLista").textContent =
    `Lista guardada neste aparelho. Leituras do Firebase nesta atualização: ${leituras}.`;
}

async function carregarLista(completa = false) {
  try {
    let leituras;
    if (!completa && lerListaLocal()) {
      desenharLista(); // mostra na hora, sem gastar leituras
      const q = query(collection(db, "racoes"), where("atualizadoEm", ">", new Timestamp(ultimoSync.s, ultimoSync.n)));
      const snap = await getDocs(q);
      snap.forEach((d) => {
        cache.set(d.id, d.data());
        ultimoSync = maisNovo(ultimoSync, carimboDe(d.data()));
      });
      leituras = Math.max(1, snap.size); // consulta sem resultado também cobra 1 leitura
    } else {
      const snap = await getDocs(collection(db, "racoes"));
      cache = new Map();
      ultimoSync = null;
      snap.forEach((d) => {
        cache.set(d.id, d.data());
        ultimoSync = maisNovo(ultimoSync, carimboDe(d.data()));
      });
      leituras = snap.size;
    }
    salvarListaLocal();
    desenharLista();
    infoLista(leituras);
  } catch (e) {
    console.error(e);
    mostrar($("msgForm"), mensagemErroFirebase(e), true);
  }
}

$("btnRecarregarLista").addEventListener("click", async () => {
  if (!confirm(`Recarregar tudo do servidor? Isso lê todas as rações cadastradas (${cache.size || "várias"} leituras do seu limite diário).`)) return;
  const btn = $("btnRecarregarLista");
  btn.disabled = true;
  try { await carregarLista(true); } finally { btn.disabled = false; }
});

function desenharLista() {
  const ul = $("lista");
  ul.replaceChildren();
  const filtro = $("filtroLista").value.trim().toLowerCase();
  const itens = [...cache.entries()]
    .filter(([id, d]) => !filtro || id.includes(filtro) || String(d.descricao || "").toLowerCase().includes(filtro)
      || (especieValida(d.especie) ? ESPECIES[d.especie] : "").toLowerCase().includes(filtro))
    .sort((a, b) => String(a[1].descricao || "").localeCompare(String(b[1].descricao || ""), "pt-BR"));
  $("contagem").textContent = `(${cache.size})`;
  if (!itens.length) {
    const li = document.createElement("li");
    li.textContent = "Nenhuma ração encontrada.";
    ul.append(li);
    return;
  }
  for (const [id, d] of itens) {
    const li = document.createElement("li");
    const cod = document.createElement("span"); cod.className = "cod"; cod.textContent = id;
    const nom = document.createElement("span"); nom.className = "nom"; nom.textContent = d.descricao || "";
    const ver = document.createElement("a"); ver.href = `?cod=${id}`; ver.target = "_blank"; ver.rel = "noopener noreferrer"; ver.textContent = "Abrir";
    const ed = document.createElement("button"); ed.type = "button"; ed.textContent = "Editar";
    ed.addEventListener("click", () => preencherForm(id));
    const del = document.createElement("button"); del.type = "button"; del.className = "perigo"; del.textContent = "Excluir";
    del.addEventListener("click", () => excluir(id));
    li.append(cod, nom);
    if (especieValida(d.especie)) {
      const esp = document.createElement("span"); esp.className = "esp"; esp.textContent = ESPECIES[d.especie];
      li.append(esp);
    }
    li.append(ver, ed, del);
    ul.append(li);
  }
}
$("filtroLista").addEventListener("input", desenharLista);

async function excluir(id) {
  const d = cache.get(id);
  if (!confirm(`Excluir a ração ${id} (${d ? d.descricao : ""})? Isso não pode ser desfeito.`)) return;
  try {
    await deleteDoc(doc(db, "racoes", id));
    cache.delete(id);
    salvarListaLocal();
    apagarCacheRacao(id);
    if (editando === id) limparForm();
    desenharLista();
    mostrar($("msgForm"), `Ração ${id} excluída.`);
    try {
      await atualizarIndiceBusca();
    } catch (e2) {
      console.error(e2);
      mostrar($("msgForm"), `Ração ${id} excluída, mas o índice de busca não foi atualizado: ${erroTexto(e2)}`, true);
    }
  } catch (e) {
    console.error(e);
    mostrar($("msgForm"), mensagemErroFirebase(e), true);
  }
}

/* ----- importação do JSON gerado a partir da planilha ----- */
$("btnImportar").addEventListener("click", async () => {
  const msg = $("msgImport");
  mostrar(msg, "");
  const arq = $("arquivoImport").files[0];
  if (!arq) { mostrar(msg, "Escolha o arquivo racoes-dados.json primeiro.", true); return; }
  if (arq.size > 2 * 1024 * 1024) { mostrar(msg, "Arquivo grande demais.", true); return; }

  let registros;
  try {
    const lista = JSON.parse(await arq.text());
    if (!Array.isArray(lista) || !lista.length) throw new Error("O arquivo deve conter uma lista de rações.");
    if (lista.length > 2000) throw new Error("Rações demais em um único arquivo.");
    registros = lista.map((r) => {
      const atual = cache.get(normalizarCodigo(r.codigo));
      const comp = r.composicao !== undefined ? r.composicao : (atual ? atual.composicao : "");
      const qual = r.qualidade !== undefined ? r.qualidade : (atual ? atual.qualidade : "");
      const esp = r.especie !== undefined ? r.especie : (atual ? atual.especie : "");
      return montarRegistro(r.codigo, r.descricao, r.imagem, r.n, comp, qual, esp);
    });
    const ids = new Set(registros.map((r) => r.id));
    if (ids.size !== registros.length) throw new Error("Há códigos repetidos no arquivo.");
  } catch (e) {
    mostrar(msg, e instanceof SyntaxError ? "Arquivo JSON inválido." : e.message, true);
    return;
  }
  if (!confirm(`Importar ${registros.length} rações? As que já existem com o mesmo código serão substituídas.`)) return;

  const btn = $("btnImportar");
  btn.disabled = true;
  try {
    for (let i = 0; i < registros.length; i += 400) {
      const lote = writeBatch(db);
      for (const r of registros.slice(i, i + 400)) lote.set(doc(db, "racoes", r.id), r.dados);
      await lote.commit();
      mostrar(msg, `Importando… ${Math.min(i + 400, registros.length)} de ${registros.length}`);
    }
    mostrar(msg, `${registros.length} rações importadas com sucesso.`);
    $("arquivoImport").value = "";
    await carregarLista();
    try {
      await atualizarIndiceBusca();
      mostrar(msg, `${registros.length} rações importadas e índice de busca atualizado.`);
    } catch (e2) {
      console.error(e2);
      mostrar(msg, `${registros.length} rações importadas, mas o índice de busca não foi atualizado: ${erroTexto(e2)}`, true);
    }
  } catch (e) {
    console.error(e);
    mostrar(msg, mensagemErroFirebase(e), true);
  } finally {
    btn.disabled = false;
  }
});
