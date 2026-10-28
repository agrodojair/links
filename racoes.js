// =====================================================================
//  Agro do Jair - Níveis de garantia (racoes.html)
//  Visitantes: só LEEM uma ração por código (Firestore: coleção "racoes").
//  Escrita: só a conta administradora (regras do Firestore, ver firestore.rules).
//  Tudo é exibido com textContent (nunca innerHTML), então não há injeção de HTML.
// =====================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, deleteDoc,
  collection, getDocs, writeBatch, serverTimestamp
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

function desenharRacao(id, d) {
  $("nomeRacao").textContent = String(d.descricao ?? "");
  $("codigoRacao").textContent = id;
  desenharFoto(id);

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
  resultado.hidden = false;
}

async function carregar(cod) {
  const minha = ++seq;
  const id = normalizarCodigo(cod);
  resultado.hidden = true;
  if (!id) {
    mostrar(estado, "Digite um código válido (somente números).", true);
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
    desenharRacao(id, snap.data());
  } catch (e) {
    if (minha !== seq) return;
    console.error(e);
    mostrar(estado, "Não foi possível consultar agora. Tente novamente em instantes.", true);
  }
}

$("formBusca").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = normalizarCodigo($("campoCodigo").value);
  if (id) {
    $("campoCodigo").value = id;
    history.pushState(null, "", `?cod=${id}`);
  }
  carregar($("campoCodigo").value);
});

function lerUrl() {
  const cod = new URLSearchParams(location.search).get("cod");
  if (cod === null) {
    seq++;
    resultado.hidden = true;
    mostrar(estado, "");
    return;
  }
  $("campoCodigo").value = cod;
  carregar(cod);
}
window.addEventListener("popstate", lerUrl);
lerUrl();

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
function montarRegistro(codigo, descricao, imagem, n) {
  const id = normalizarCodigo(codigo);
  if (!id) throw new Error("Código inválido (use somente números).");
  const nome = String(descricao ?? "").replace(/\s+/g, " ").trim();
  if (!nome || nome.length > 120) throw new Error(`Nome inválido no código ${id} (1 a 120 caracteres).`);
  const img = String(imagem ?? "").trim();
  if (img && !imagemSegura(img)) {
    throw new Error("Imagem inválida: use um link https://i.imgur.com/... ou um caminho como images/racoes/0151.jpg.");
  }
  const limpo = {};
  for (const c of CAMPOS) {
    const v = n ? n[c.k] : undefined;
    if (v === undefined || v === null || v === "" ) continue;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new Error(`Valor inválido em "${c.l}" (código ${id}).`);
    if (c.u === "%" && v > 100) throw new Error(`"${c.l}" não pode passar de 100% (código ${id}).`);
    if (v > 0) limpo[c.k] = v;
  }
  return { id, dados: { codigo: id, descricao: nome, imagem: img, n: limpo, atualizadoEm: serverTimestamp() } };
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
  return montarRegistro($("fCodigo").value, $("fNome").value, "", n);
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
    desenharLista();
    limparForm();
    mostrar($("msgForm"), `Ração ${reg.id} salva com sucesso.`);
  } catch (err) {
    console.error(err);
    mostrar($("msgForm"), mensagemErroFirebase(err), true);
  } finally {
    btn.disabled = false;
  }
});

/* ----- lista ----- */
async function carregarLista() {
  try {
    const snap = await getDocs(collection(db, "racoes"));
    cache = new Map();
    snap.forEach((d) => cache.set(d.id, d.data()));
    desenharLista();
  } catch (e) {
    console.error(e);
    mostrar($("msgForm"), mensagemErroFirebase(e), true);
  }
}

function desenharLista() {
  const ul = $("lista");
  ul.replaceChildren();
  const filtro = $("filtroLista").value.trim().toLowerCase();
  const itens = [...cache.entries()]
    .filter(([id, d]) => !filtro || id.includes(filtro) || String(d.descricao || "").toLowerCase().includes(filtro))
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
    li.append(cod, nom, ver, ed, del);
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
    if (editando === id) limparForm();
    desenharLista();
    mostrar($("msgForm"), `Ração ${id} excluída.`);
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
    registros = lista.map((r) => montarRegistro(r.codigo, r.descricao, r.imagem, r.n));
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
  } catch (e) {
    console.error(e);
    mostrar(msg, mensagemErroFirebase(e), true);
  } finally {
    btn.disabled = false;
  }
});
