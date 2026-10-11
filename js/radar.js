// ============================================================
// FAZ DIREITO — RADAR ELEITORAL 2026
// Front-end + integração com Cloudflare Worker
// ============================================================


// ============================================================
// API — CLOUDFLARE WORKER
// ============================================================

const RADAR_API = {
  baseUrl: "https://fazdireito-radar-api.taxadd-oficial.workers.dev",

  endpoints: {
    status: "/api/status",
    news: "/api/news",
    sources: "/api/sources"
  }
};


// ============================================================
// ESTADO GLOBAL
// ============================================================

let lang = "pt";
let fontSize = 100;

let liveSources = null;
let liveNews = null;
let liveNewsMeta = null;
let liveStatus = null;

let filteredNews = [];


// ============================================================
// UTILITÁRIOS
// ============================================================

function getEl(id) {
  return document.getElementById(id);
}


function escapeHTML(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


function normalizeText(value) {

  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

}


// ============================================================
// FORMATAÇÃO LOCALIZADA
// ============================================================

function getLocale() {

  const locales = {
    pt: "pt-BR",
    en: "en-US",
    es: "es-ES"
  };

  return locales[lang] || locales.pt;

}


function getTexts() {

  return (
    translations?.[lang] ||
    translations?.pt ||
    {}
  );

}


function interpolateText(
  template,
  values = {}
) {

  return String(template || "")
    .replace(
      /\{(\w+)\}/g,
      (_, key) =>
        values[key] !== undefined
          ? String(values[key])
          : `{${key}}`
    );

}


function formatNumber(value) {

  return Number(value || 0)
    .toLocaleString(
      getLocale()
    );

}


function validDate(value) {

  if (!value) {
    return null;
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;

}


function formatDateTime(value) {

  const date =
    validDate(value);

  if (!date) {
    return "—";
  }

  return date.toLocaleString(
    getLocale(),
    {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }
  );

}


function relativeTime(value) {

  const date =
    validDate(value);

  if (!date) {
    return "";
  }

  const diff =
    Date.now() -
    date.getTime();

  const minutes =
    Math.max(
      0,
      Math.floor(
        diff / 60000
      )
    );

  const labels = {

    pt: {
      now: "agora",
      minute: "há {count} min",
      hour: "há {count} h",
      day: "há {count} d"
    },

    en: {
      now: "now",
      minute: "{count} min ago",
      hour: "{count}h ago",
      day: "{count}d ago"
    },

    es: {
      now: "ahora",
      minute: "hace {count} min",
      hour: "hace {count} h",
      day: "hace {count} d"
    }

  };

  const current =
    labels[lang] ||
    labels.pt;

  if (minutes < 1) {
    return current.now;
  }

  if (minutes < 60) {

    return interpolateText(
      current.minute,
      {
        count: minutes
      }
    );

  }

  const hours =
    Math.floor(
      minutes / 60
    );

  if (hours < 24) {

    return interpolateText(
      current.hour,
      {
        count: hours
      }
    );

  }

  const days =
    Math.floor(
      hours / 24
    );

  return interpolateText(
    current.day,
    {
      count: days
    }
  );

}


// ============================================================
// CANDIDATOS
// ============================================================

function candidateLabel(article) {

  const flavio =
    Boolean(
      article?.mentions?.flavio
    );

  const lula =
    Boolean(
      article?.mentions?.lula
    );

  if (flavio && lula) {
    return "Flávio + Lula";
  }

  if (flavio) {
    return "Flávio";
  }

  if (lula) {
    return "Lula";
  }

  return "Cobertura";

}


function candidateClass(article) {

  const flavio =
    Boolean(
      article?.mentions?.flavio
    );

  const lula =
    Boolean(
      article?.mentions?.lula
    );

  if (flavio && lula) {
    return "both";
  }

  if (flavio) {
    return "flavio";
  }

  if (lula) {
    return "lula";
  }

  return "general";

}


// ============================================================
// ACESSO À API
// ============================================================

async function radarApiFetch(endpoint) {

  const response =
    await fetch(
      `${RADAR_API.baseUrl}${endpoint}`,
      {
        method: "GET",

        headers: {
          "Accept": "application/json"
        },

        cache: "no-store"
      }
    );

  let data = null;

  try {

    data =
      await response.json();

  } catch (error) {

    data =
      null;

  }

  if (!response.ok) {

    const message =
      data?.message ||
      data?.error ||
      `RADAR_API_HTTP_${response.status}`;

    throw new Error(message);

  }

  return data;

}


// ============================================================
// STATUS DA API
// ============================================================

async function checkRadarApi() {

  try {

    const data =
      await radarApiFetch(
        RADAR_API.endpoints.status
      );

    liveStatus =
      data;

    console.info(
      "[Radar API] Conexão estabelecida:",
      data
    );

    return data;

  } catch (error) {

    liveStatus =
      null;

    console.warn(
      "[Radar API] API indisponível:",
      error.message
    );

    return null;

  }

}


// ============================================================
// FONTES
// ============================================================

function sourceStatusPresentation(status) {

  const labels = {

    pt: {
      active: "Ativo",
      planned: "Planejado",
      connected: "Conectado",
      unavailable: "Indisponível",
      paused: "Pausado",
      pending: "Aguardando"
    },

    en: {
      active: "Active",
      planned: "Planned",
      connected: "Connected",
      unavailable: "Unavailable",
      paused: "Paused",
      pending: "Pending"
    },

    es: {
      active: "Activo",
      planned: "Planeado",
      connected: "Conectado",
      unavailable: "No disponible",
      paused: "Pausado",
      pending: "Pendiente"
    }

  };

  const current =
    labels[lang] ||
    labels.pt;

  const normalized =
    String(status || "")
      .toLowerCase();

  if (
    normalized === "active" ||
    normalized === "connected"
  ) {

    return {
      label:
        normalized === "connected"
          ? current.connected
          : current.active,

      cls: "ready"
    };

  }

  if (normalized === "planned") {

    return {
      label: current.planned,
      cls: "planned"
    };

  }

  if (normalized === "paused") {

    return {
      label: current.paused,
      cls: "planned"
    };

  }

  if (normalized === "pending") {

    return {
      label: current.pending,
      cls: "planned"
    };

  }

  return {
    label: current.unavailable,
    cls: "mock"
  };

}


function renderApiSources(items) {

  const list =
    getEl("apiList");

  if (!list) {
    return;
  }

  if (
    !Array.isArray(items) ||
    !items.length
  ) {

    const messages = {

      pt: {
        title: "Fontes",
        description:
          "Nenhuma informação disponível neste momento.",
        status: "Indisponível"
      },

      en: {
        title: "Sources",
        description:
          "No information is available at this time.",
        status: "Unavailable"
      },

      es: {
        title: "Fuentes",
        description:
          "No hay información disponible en este momento.",
        status: "No disponible"
      }

    };

    const current =
      messages[lang] ||
      messages.pt;

    list.innerHTML = `
      <div class="api-row">
        <div>
          <strong>
            ${escapeHTML(current.title)}
          </strong>

          <span>
            ${escapeHTML(current.description)}
          </span>
        </div>

        <span class="api-status mock">
          ${escapeHTML(current.status)}
        </span>
      </div>
    `;

    return;

  }

  list.innerHTML =
    items
      .map(
        source => {

          const presentation =
            sourceStatusPresentation(
              source.status
            );

          const details = [];

          if (source.description) {

            details.push(
              escapeHTML(
                source.description
              )
            );

          }

          if (source.charset) {

            details.push(
              `charset: ${escapeHTML(source.charset)}`
            );

          }

          if (source.endpoint) {

            details.push(
              escapeHTML(
                source.endpoint
              )
            );

          }

          return `
            <div class="api-row">

              <div>

                <strong>
                  ${escapeHTML(source.name)}
                </strong>

                <span>
                  ${details.join(" • ")}
                </span>

              </div>

              <span class="api-status ${presentation.cls}">
                ${escapeHTML(presentation.label)}
              </span>

            </div>
          `;

        }
      )
      .join("");

}


async function loadRadarSources() {

  try {

    const data =
      await radarApiFetch(
        RADAR_API.endpoints.sources
      );

    if (
      !data ||
      data.status !== "ok" ||
      !Array.isArray(data.sources)
    ) {

      throw new Error(
        "RADAR_API_SOURCES_INVALID_RESPONSE"
      );

    }

    liveSources =
      data.sources.map(
        source => ({

          id:
            source.id || "",

          name:
            source.name || "Fonte",

          type:
            source.type || "",

          description:
            source.description || "",

          status:
            source.status || "unavailable",

          endpoint:
            source.endpoint || null,

          cache:
            source.cache || null,

          charset:
            source.charset || null

        })
      );

    if (
      data.infrastructure &&
      data.infrastructure.kv
    ) {

      liveSources.push({

        id:
          "cloudflare-kv",

        name:
          "Cloudflare Workers KV",

        type:
          "infrastructure",

        description:
          "Camada de cache e persistência da infraestrutura do Radar.",

        status:
          data.infrastructure.kv === "connected"
            ? "connected"
            : "unavailable",

        endpoint:
          null,

        cache:
          null,

        charset:
          null

      });

    }

    renderApiSources(
      liveSources
    );

    renderSourceFilter();

    renderMetrics();

    console.info(
      "[Radar API] Fontes carregadas:",
      liveSources
    );

    return liveSources;

  } catch (error) {

    liveSources =
      null;

    console.warn(
      "[Radar API] Não foi possível carregar /api/sources:",
      error.message
    );

    renderApiSources([]);

    return null;

  }

}


// ============================================================
// CARREGAMENTO DAS NOTÍCIAS REAIS
// ============================================================

async function loadRadarNews() {

  try {

    const data =
      await radarApiFetch(
        RADAR_API.endpoints.news
      );

    if (
      !data ||
      data.status !== "ok" ||
      !Array.isArray(data.articles)
    ) {

      throw new Error(
        "RADAR_API_NEWS_INVALID_RESPONSE"
      );

    }

    liveNewsMeta = {

      source:
        data.source || "RSS multifuente",

      version:
        data.version || "",

      windowHours:
        Number(
          data.query?.windowHours ||
          data.windowHours ||
          48
        ),

      count:
        Number(
          data.count ??
          data.articles.length
        ),

      collectedAt:
        data.collectedAt ||
        data.updatedAt ||
        data.timestamp ||
        null,

      stale:
        Boolean(data.stale),

      metrics:
        data.metrics || null

    };

    liveNews =
      data.articles
        .filter(
          article =>
            article &&
            article.title
        )
        .map(
          article => ({

            title:
              String(
                article.title || ""
              ),

            subtitle:
              String(
                article.subtitle || ""
              ),

            url:
              String(
                article.url || ""
              ),

            publisher:
              String(
                article.publisher ||
                article.feedSource ||
                article.domain ||
                "Fonte"
              ),

            domain:
              String(
                article.domain || ""
              ),

            feedSource:
              String(
                article.feedSource || ""
              ),

            feedSourceId:
              String(
                article.feedSourceId || ""
              ),

            category:
              String(
                article.category || "geral"
              ),

            publishedAt:
              article.publishedAt || null,

            seenDate:
              article.seenDate || null,

            socialImage:
              article.socialImage || "",

            mentions: {

              flavio:
                Boolean(
                  article.mentions?.flavio
                ),

              lula:
                Boolean(
                  article.mentions?.lula
                )

            },

            type:
              article.type || "news"

          })
        )
        .sort(
          (a, b) => {

            const da =
              validDate(a.publishedAt);

            const db =
              validDate(b.publishedAt);

            return (
              (db?.getTime() || 0) -
              (da?.getTime() || 0)
            );

          }
        );

    filteredNews =
      [...liveNews];

    console.info(
      "[Radar API] Notícias carregadas:",
      {
        version:
          liveNewsMeta.version,

        count:
          liveNews.length,

        windowHours:
          liveNewsMeta.windowHours
      }
    );

    renderRealData();

    return liveNews;

  } catch (error) {

    liveNews =
      null;

    liveNewsMeta =
      null;

    filteredNews =
      [];

    console.warn(
      "[Radar API] Não foi possível carregar /api/news:",
      error.message
    );

    renderNewsUnavailable();

    return null;

  }

}


// ============================================================
// MÉTRICAS DERIVADAS
// ============================================================

function calculateMetrics(
  articles = liveNews || []
) {

  const total =
    articles.length;

  const flavio =
    articles.filter(
      article =>
        article.mentions?.flavio
    ).length;

  const lula =
    articles.filter(
      article =>
        article.mentions?.lula
    ).length;

  const both =
    articles.filter(
      article =>
        article.mentions?.flavio &&
        article.mentions?.lula
    ).length;

  const publishers =
    new Set(
      articles
        .map(
          article =>
            article.publisher
        )
        .filter(Boolean)
    );

  const candidateMentions =
    articles.filter(
      article =>
        article.mentions?.flavio ||
        article.mentions?.lula
    ).length;

  return {

    total,
    flavio,
    lula,
    both,

    candidateMentions,

    publishers:
      publishers.size,

    flavioShare:
      total
        ? flavio / total * 100
        : 0,

    lulaShare:
      total
        ? lula / total * 100
        : 0,

    bothShare:
      total
        ? both / total * 100
        : 0

  };

}


// ============================================================
// DISTRIBUIÇÃO POR VEÍCULO
// ============================================================

function publisherRanking(
  articles = liveNews || []
) {

  const map =
    new Map();

  articles.forEach(
    article => {

      const publisher =
        article.publisher ||
        "Fonte não identificada";

      map.set(
        publisher,
        (map.get(publisher) || 0) + 1
      );

    }
  );

  return [...map.entries()]
    .map(
      ([name, count]) => ({
        name,
        count
      })
    )
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.name.localeCompare(
          b.name,
          getLocale()
        )
    );

}
// ============================================================
// PALAVRAS MAIS FREQUENTES
// ============================================================

const STOPWORDS = new Set(
  [
    "a",
    "à",
    "ao",
    "aos",
    "as",
    "às",
    "o",
    "os",
    "um",
    "uma",
    "uns",
    "umas",
    "de",
    "da",
    "das",
    "do",
    "dos",
    "e",
    "é",
    "em",
    "na",
    "nas",
    "no",
    "nos",
    "por",
    "para",
    "com",
    "sem",
    "sob",
    "sobre",
    "que",
    "se",
    "sua",
    "suas",
    "seu",
    "seus",
    "como",
    "mais",
    "menos",
    "após",
    "apos",
    "ante",
    "entre",
    "até",
    "ate",
    "já",
    "ja",
    "não",
    "nao",
    "ser",
    "tem",
    "ter",
    "foi",
    "são",
    "sao",
    "vai",
    "diz",
    "dizer",
    "contra",
    "pelo",
    "pela",
    "pelos",
    "pelas",
    "nesta",
    "neste",
    "essa",
    "esse",
    "isso",
    "ainda",
    "também",
    "tambem",
    "onde",
    "quando",
    "quem",
    "qual",
    "quais",
    "porque",
    "durante",
    "desde",
    "muito",
    "muita",
    "muitos",
    "muitas",
    "novo",
    "nova",
    "novos",
    "novas",
    "brasil",
    "flavio",
    "flávio",
    "bolsonaro",
    "lula",
    "luiz",
    "inacio",
    "inácio",
    "silva"
  ]
);


function extractKeywords(
  articles = liveNews || [],
  limit = 12
) {

  const counts =
    new Map();


  articles.forEach(
    article => {

      const text =
        `${article.title || ""} ${article.subtitle || ""}`;


      const words =
        text
          .toLowerCase()
          .normalize("NFD")
          .replace(
            /[\u0300-\u036f]/g,
            ""
          )
          .replace(
            /[^a-z0-9çáéíóúâêôãõü\s-]/gi,
            " "
          )
          .split(/\s+/)
          .map(
            word =>
              word
                .replace(/^-+|-+$/g, "")
                .trim()
          )
          .filter(
            word =>
              word.length >= 4 &&
              !STOPWORDS.has(word)
          );


      words.forEach(
        word => {

          counts.set(
            word,
            (counts.get(word) || 0) + 1
          );

        }
      );

    }
  );


  return [...counts.entries()]
    .map(
      ([word, count]) => ({
        word,
        count
      })
    )
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.word.localeCompare(b.word)
    )
    .slice(
      0,
      limit
    );

}


// ============================================================
// SÉRIE TEMPORAL
// ============================================================

function buildTimeline(
  articles = liveNews || [],
  bucketHours = 4
) {

  if (!articles.length) {
    return [];
  }


  const dates =
    articles
      .map(
        article =>
          validDate(
            article.publishedAt
          )
      )
      .filter(Boolean);


  if (!dates.length) {
    return [];
  }


  const newest =
    Math.max(
      ...dates.map(
        date =>
          date.getTime()
      )
    );


  const windowHours =
    liveNewsMeta?.windowHours ||
    48;


  const windowMs =
    windowHours *
    60 *
    60 *
    1000;


  const start =
    newest - windowMs;


  const bucketMs =
    bucketHours *
    60 *
    60 *
    1000;


  const bucketCount =
    Math.ceil(
      windowMs / bucketMs
    );


  const buckets =
    Array.from(
      {
        length:
          bucketCount
      },
      (_, index) => {

        const bucketStart =
          start +
          index *
          bucketMs;


        return {

          start:
            bucketStart,

          end:
            bucketStart +
            bucketMs,

          flavio:
            0,

          lula:
            0,

          total:
            0

        };

      }
    );


  articles.forEach(
    article => {

      const date =
        validDate(
          article.publishedAt
        );


      if (!date) {
        return;
      }


      const timestamp =
        date.getTime();


      if (
        timestamp < start ||
        timestamp >
          newest + bucketMs
      ) {
        return;
      }


      let index =
        Math.floor(
          (timestamp - start) /
          bucketMs
        );


      index =
        Math.max(
          0,
          Math.min(
            buckets.length - 1,
            index
          )
        );


      const bucket =
        buckets[index];


      bucket.total += 1;


      if (
        article.mentions?.flavio
      ) {
        bucket.flavio += 1;
      }


      if (
        article.mentions?.lula
      ) {
        bucket.lula += 1;
      }

    }
  );


  return buckets;

}


// ============================================================
// PICO REAL DE COBERTURA
// ============================================================

function calculatePeak(
  articles = liveNews || []
) {

  const timeline =
    buildTimeline(
      articles,
      1
    );


  if (!timeline.length) {

    return {
      count: 0,
      start: null
    };

  }


  const peak =
    timeline.reduce(
      (best, current) =>
        current.total > best.total
          ? current
          : best,
      timeline[0]
    );


  return {
    count:
      peak.total,

    start:
      peak.start
  };

}


// ============================================================
// PERÍODO E CONJUNTO DE DADOS ATIVO
// ============================================================

function getSelectedPeriodHours() {

  return getEl("period")?.value === "24h"
    ? 24
    : 48;

}


function getActiveNews() {

  if (!Array.isArray(liveNews)) {
    return [];
  }


  return hasActiveFilters()
    ? filteredNews
    : liveNews;

}
// ============================================================
// RENDERIZAÇÃO DOS INDICADORES
// ============================================================

function renderMetrics() {

  if (!liveNews) {
    return;
  }


  const articles =
    getActiveNews();


  const metrics =
    calculateMetrics(
      articles
    );


  const peak =
    calculatePeak(
      articles
    );


  const metricMentions =
    getEl(
      "metricMentions"
    );

  const metricTopics =
    getEl(
      "metricTopics"
    );

  const metricSources =
    getEl(
      "metricSources"
    );

  const metricPeak =
    getEl(
      "metricPeak"
    );


  if (metricMentions) {

    metricMentions.textContent =
      formatNumber(
        metrics.total
      );

  }


  if (metricTopics) {

    metricTopics.textContent =
      formatNumber(
        metrics.candidateMentions
      );

  }


  if (metricSources) {

    metricSources.textContent =
      formatNumber(
        metrics.publishers
      );

  }


  if (metricPeak) {

    metricPeak.textContent =
      peak.count
        ? formatNumber(
            peak.count
          )
        : "0";

  }


  const mentionsTrend =
    document.querySelector(
      "#metricMentions + .trend"
    );


  if (mentionsTrend) {

    const hours =
      getSelectedPeriodHours();


    const labels = {

      pt:
        `artigos nas últimas ${hours} horas`,

      en:
        `articles in the last ${hours} hours`,

      es:
        `artículos en las últimas ${hours} horas`

    };


    mentionsTrend.textContent =
      labels[lang] ||
      labels.pt;

  }


  const topicsTrend =
    document.querySelector(
      "#metricTopics + .trend"
    );


  if (topicsTrend) {

    const labels = {

      pt:
        "com referência aos candidatos monitorados",

      en:
        "referencing monitored candidates",

      es:
        "con referencia a los candidatos monitoreados"

    };


    topicsTrend.textContent =
      labels[lang] ||
      labels.pt;

  }


  const sourcesTrend =
    document.querySelector(
      "#metricSources + .trend"
    );


  if (sourcesTrend) {

    const labels = {

      pt:
        "veículos com publicações encontradas",

      en:
        "publishers with publications found",

      es:
        "medios con publicaciones encontradas"

    };


    sourcesTrend.textContent =
      labels[lang] ||
      labels.pt;

  }


  const peakTrend =
    document.querySelector(
      "#metricPeak + .trend"
    );


  if (peakTrend) {

    const labels = {

      pt:
        peak.start
          ? `publicações entre ${new Date(
              peak.start
            ).toLocaleTimeString(
              getLocale(),
              {
                hour:
                  "2-digit",

                minute:
                  "2-digit"
              }
            )} e ${new Date(
              peak.start +
              60 *
              60 *
              1000
            ).toLocaleTimeString(
              getLocale(),
              {
                hour:
                  "2-digit",

                minute:
                  "2-digit"
              }
            )}`
          : "sem publicações no período",

      en:
        peak.start
          ? `publications between ${new Date(
              peak.start
            ).toLocaleTimeString(
              getLocale(),
              {
                hour:
                  "2-digit",

                minute:
                  "2-digit"
              }
            )} and ${new Date(
              peak.start +
              60 *
              60 *
              1000
            ).toLocaleTimeString(
              getLocale(),
              {
                hour:
                  "2-digit",

                minute:
                  "2-digit"
              }
            )}`
          : "no publications in this period",

      es:
        peak.start
          ? `publicaciones entre ${new Date(
              peak.start
            ).toLocaleTimeString(
              getLocale(),
              {
                hour:
                  "2-digit",

                minute:
                  "2-digit"
              }
            )} y ${new Date(
              peak.start +
              60 *
              60 *
              1000
            ).toLocaleTimeString(
              getLocale(),
              {
                hour:
                  "2-digit",

                minute:
                  "2-digit"
              }
            )}`
          : "sin publicaciones en el período"

    };


    peakTrend.textContent =
      labels[lang] ||
      labels.pt;

  }

}


// ============================================================
// FILTRO DE VEÍCULOS
// ============================================================

function renderSourceFilter() {

  const select =
    getEl("source");


  if (!select) {
    return;
  }


  const selected =
    select.value ||
    "all";


  const articles =
    Array.isArray(liveNews)
      ? liveNews
      : [];


  const publishers =
    [...new Set(
      articles
        .map(
          article =>
            article.publisher
        )
        .filter(Boolean)
    )]
      .sort(
        (a, b) =>
          a.localeCompare(
            b,
            getLocale()
          )
      );


  const allLabels = {

    pt:
      "Todos os veículos",

    en:
      "All publishers",

    es:
      "Todos los medios"

  };


  select.innerHTML = `

    <option value="all">

      ${
        allLabels[lang] ||
        allLabels.pt
      }

    </option>

    ${publishers
      .map(
        publisher => `

          <option
            value="${escapeHTML(
              normalizeText(
                publisher
              )
            )}"
          >

            ${escapeHTML(
              publisher
            )}

          </option>

        `
      )
      .join("")}

  `;


  const optionExists =
    [...select.options]
      .some(
        option =>
          option.value ===
          selected
      );


  select.value =
    optionExists
      ? selected
      : "all";

}


// ============================================================
// RANKING DE VEÍCULOS
// ============================================================

function renderPublisherRanking() {

  const container =
    getEl(
      "sourceRanking"
    );


  if (!container) {
    return;
  }


  const articles =
    getActiveNews();


  const ranking =
    publisherRanking(
      articles
    );


  if (!ranking.length) {

    const messages = {

      pt:
        "Nenhum veículo encontrado para os filtros atuais.",

      en:
        "No publishers found for the current filters.",

      es:
        "No se encontraron medios para los filtros actuales."

    };


    container.innerHTML = `

      <div class="empty-state">

        ${
          escapeHTML(
            messages[lang] ||
            messages.pt
          )
        }

      </div>

    `;

    return;

  }


  const max =
    Math.max(
      ...ranking.map(
        item =>
          item.count
      ),
      1
    );


  const hours =
    getSelectedPeriodHours();


  const publicationText =
    count => {

      const labels = {

        pt:
          count === 1
            ? `${formatNumber(
                count
              )} publicação nas últimas ${hours}h`
            : `${formatNumber(
                count
              )} publicações nas últimas ${hours}h`,

        en:
          count === 1
            ? `${formatNumber(
                count
              )} publication in the last ${hours}h`
            : `${formatNumber(
                count
              )} publications in the last ${hours}h`,

        es:
          count === 1
            ? `${formatNumber(
                count
              )} publicación en las últimas ${hours}h`
            : `${formatNumber(
                count
              )} publicaciones en las últimas ${hours}h`

      };


      return (
        labels[lang] ||
        labels.pt
      );

    };


  container.innerHTML =
    ranking
      .slice(
        0,
        10
      )
      .map(
        (
          item,
          index
        ) => {

          const width =
            Math.max(
              4,
              item.count /
              max *
              100
            );


          return `

            <div class="source-rank">

              <div class="rank-position">

                ${index + 1}

              </div>

              <div class="rank-main">

                <div class="rank-head">

                  <strong>

                    ${escapeHTML(
                      item.name
                    )}

                  </strong>

                  <span>

                    ${formatNumber(
                      item.count
                    )}

                  </span>

                </div>

                <div class="rank-bar">

                  <span
                    style="width:${width}%"
                  ></span>

                </div>

                <small>

                  ${escapeHTML(
                    publicationText(
                      item.count
                    )
                  )}

                </small>

              </div>

            </div>

          `;

        }
      )
      .join("");

}


// ============================================================
// CARDS DE COBERTURA
// ============================================================

function renderCoverageCards() {

  const grid =
    getEl(
      "themeGrid"
    );


  if (!grid) {
    return;
  }


  const articles =
    getActiveNews();


  const metrics =
    calculateMetrics(
      articles
    );


  const texts =
    getTexts();


  const periodHours =
    getSelectedPeriodHours();


  const periodLabels = {

    pt:
      `${periodHours} horas`,

    en:
      `${periodHours} hours`,

    es:
      `${periodHours} horas`

  };


  const periodLabel =
    periodLabels[lang] ||
    periodLabels.pt;


  const descriptions = {

    pt: {

      flavio:
        `Artigos das últimas ${periodHours}h em que o monitor identificou referência a Flávio Bolsonaro.`,

      lula:
        `Artigos das últimas ${periodHours}h em que o monitor identificou referência a Lula.`,

      both:
        `Artigos das últimas ${periodHours}h em que foram identificadas referências a Flávio Bolsonaro e Lula na mesma publicação.`,

      total:
        `Total de artigos retornados pelas fontes monitoradas nas últimas ${periodHours}h.`,

      bothName:
        "Ambos",

      totalName:
        "Total monitorado"

    },

    en: {

      flavio:
        `Articles from the last ${periodHours}h in which the monitor identified a reference to Flávio Bolsonaro.`,

      lula:
        `Articles from the last ${periodHours}h in which the monitor identified a reference to Lula.`,

      both:
        `Articles from the last ${periodHours}h in which references to Flávio Bolsonaro and Lula were identified in the same publication.`,

      total:
        `Total articles returned by the monitored sources in the last ${periodHours}h.`,

      bothName:
        "Both",

      totalName:
        "Total monitored"

    },

    es: {

      flavio:
        `Artículos de las últimas ${periodHours}h en los que el monitor identificó una referencia a Flávio Bolsonaro.`,

      lula:
        `Artículos de las últimas ${periodHours}h en los que el monitor identificó una referencia a Lula.`,

      both:
        `Artículos de las últimas ${periodHours}h en los que se identificaron referencias a Flávio Bolsonaro y Lula en la misma publicación.`,

      total:
        `Total de artículos devueltos por las fuentes monitoreadas en las últimas ${periodHours}h.`,

      bothName:
        "Ambos",

      totalName:
        "Total monitoreado"

    }

  };


  const current =
    descriptions[lang] ||
    descriptions.pt;


  const cards = [

    {

      name:
        "Flávio Bolsonaro",

      value:
        metrics.flavio,

      description:
        texts.coverage_card_flavio
          ? interpolateText(
              texts.coverage_card_flavio,
              {
                hours:
                  periodHours
              }
            )
          : current.flavio

    },

    {

      name:
        "Lula",

      value:
        metrics.lula,

      description:
        texts.coverage_card_lula
          ? interpolateText(
              texts.coverage_card_lula,
              {
                hours:
                  periodHours
              }
            )
          : current.lula

    },

    {

      name:
        texts.both_candidates ||
        current.bothName,

      value:
        metrics.both,

      description:
        texts.coverage_card_both
          ? interpolateText(
              texts.coverage_card_both,
              {
                hours:
                  periodHours
              }
            )
          : current.both

    },

    {

      name:
        texts.total_monitored ||
        current.totalName,

      value:
        metrics.total,

      description:
        texts.coverage_card_total
          ? interpolateText(
              texts.coverage_card_total,
              {
                hours:
                  periodHours
              }
            )
          : current.total

    }

  ];


  grid.innerHTML =
    cards
      .map(
        item => `

          <button
            class="theme-card"
            type="button"
          >

            <div class="theme-top">

              <div>

                <h4>

                  ${escapeHTML(
                    item.name
                  )}

                </h4>

                <p>

                  ${escapeHTML(
                    item.description
                  )}

                </p>

              </div>

              <span
                class="attention stable"
              >

                ${escapeHTML(
                  periodLabel
                )}

              </span>

            </div>

            <strong>

              ${formatNumber(
                item.value
              )}

            </strong>

          </button>

        `
      )
      .join("");

}


// ============================================================
// ITEM DE NOTÍCIA
// ============================================================

function createNewsItem(
  article
) {

  const label =
    candidateLabel(
      article
    );


  const cls =
    candidateClass(
      article
    );


  const time =
    relativeTime(
      article.publishedAt
    );


  const safeUrl =
    /^https?:\/\//i.test(
      article.url || ""
    )
      ? article.url
      : "";


  const title =
    escapeHTML(
      article.title
    );


  const publisher =
    escapeHTML(
      article.publisher ||
      article.domain ||
      "Fonte"
    );


  const subtitle =
    article.subtitle
      ? escapeHTML(
          article.subtitle
        )
      : "";


  const externalLabels = {

    pt:
      "Abrir publicação original",

    en:
      "Open original publication",

    es:
      "Abrir publicación original"

  };


  const externalLabel =
    externalLabels[lang] ||
    externalLabels.pt;


  return `

    <article
      class="news-item"
      data-title="${escapeHTML(
        article.title
      )}"
    >

      <div class="source">

        <span>

          ${publisher}

        </span>

        <span
          class="tag ${cls}"
        >

          ${escapeHTML(
            label
          )}

        </span>

      </div>

      <h4>

        ${
          safeUrl
            ? `
              <a
                href="${escapeHTML(
                  safeUrl
                )}"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="${escapeHTML(
                  externalLabel
                )}: ${title}"
              >

                ${title}

              </a>
            `
            : title
        }

      </h4>

      ${
        subtitle
          ? `

            <p>

              ${subtitle}

            </p>

          `
          : ""
      }

      <div class="news-meta">

        ${
          time
            ? `

              <span>

                ${escapeHTML(
                  time
                )}

              </span>

            `
            : ""
        }

        ${
          article.category
            ? `

              <span>

                ${escapeHTML(
                  article.category
                )}

              </span>

            `
            : ""
        }

      </div>

    </article>

  `;

}


// ============================================================
// FEED DE NOTÍCIAS
// ============================================================

function renderNewsFeed() {

  if (!liveNews) {
    return;
  }


  const items =
    getActiveNews();


  const coverageFilter =
    getEl(
      "coverageFilter"
    )?.value ||
    "flavio";


  const coverageItems =
    items.filter(
      article => {

        if (
          coverageFilter ===
          "lula"
        ) {

          return Boolean(
            article.mentions?.lula
          );

        }


        if (
          coverageFilter ===
          "both"
        ) {

          return Boolean(
            article.mentions?.flavio ||
            article.mentions?.lula
          );

        }


        return Boolean(
          article.mentions?.flavio
        );

      }
    );


  const newsFeed =
    getEl(
      "newsFeed"
    );


  const mentionsList =
    getEl(
      "mentionsList"
    );


  const emptyLabels = {

    pt: {

      title:
        "Nenhuma publicação encontrada",

      description:
        "Não há resultados para os filtros selecionados. Ajuste os filtros para ampliar a consulta."

    },

    en: {

      title:
        "No publications found",

      description:
        "There are no results for the selected filters. Adjust the filters to broaden the search."

    },

    es: {

      title:
        "No se encontraron publicaciones",

      description:
        "No hay resultados para los filtros seleccionados. Ajuste los filtros para ampliar la búsqueda."

    }

  };


  const empty =
    emptyLabels[lang] ||
    emptyLabels.pt;


  const emptyState = `

    <article class="news-item">

      <div class="source">

        <span>
          Radar 2026
        </span>

      </div>

      <h4>

        ${escapeHTML(
          empty.title
        )}

      </h4>

      <p>

        ${escapeHTML(
          empty.description
        )}

      </p>

    </article>

  `;


  if (newsFeed) {

    newsFeed.innerHTML =
      coverageItems.length
        ? coverageItems
            .slice(
              0,
              6
            )
            .map(
              createNewsItem
            )
            .join("")
        : emptyState;

  }


  if (mentionsList) {

    mentionsList.innerHTML =
      items.length
        ? items
            .map(
              createNewsItem
            )
            .join("")
        : emptyState;

  }

}
// ============================================================
// PALAVRAS-CHAVE
// ============================================================

function renderKeywords() {

  const list =
    getEl("keywordList");

  const cloud =
    getEl("wordCloud");


  if (
    !list &&
    !cloud
  ) {
    return;
  }


  const articles =
    getActiveNews();


  const keywords =
    extractKeywords(
      articles,
      14
    );


  const emptyLabels = {

    pt:
      "Sem termos suficientes no período selecionado.",

    en:
      "Not enough terms in the selected period.",

    es:
      "No hay suficientes términos en el período seleccionado."

  };


  const emptyLabel =
    emptyLabels[lang] ||
    emptyLabels.pt;


  if (!keywords.length) {

    if (list) {

      list.innerHTML = `

        <div class="empty-state">

          ${escapeHTML(
            emptyLabel
          )}

        </div>

      `;

    }


    if (cloud) {

      cloud.innerHTML = `

        <span class="muted">

          ${escapeHTML(
            emptyLabel
          )}

        </span>

      `;

    }


    return;

  }


  const max =
    Math.max(
      ...keywords.map(
        item =>
          item.count
      ),
      1
    );


  if (list) {

    list.innerHTML =
      keywords
        .slice(
          0,
          8
        )
        .map(
          (
            item,
            index
          ) => {

            const percentage =
              Math.round(
                item.count /
                max *
                100
              );


            return `

              <div class="keyword-row">

                <span
                  class="keyword-position"
                >

                  ${index + 1}

                </span>

                <div
                  class="keyword-main"
                >

                  <div
                    class="keyword-head"
                  >

                    <strong>

                      ${escapeHTML(
                        item.word
                      )}

                    </strong>

                    <span>

                      ${formatNumber(
                        item.count
                      )}

                    </span>

                  </div>

                  <div
                    class="keyword-bar"
                  >

                    <span
                      style="width:${percentage}%"
                    ></span>

                  </div>

                </div>

              </div>

            `;

          }
        )
        .join("");

  }


  if (cloud) {

    const minSize =
      0.8;

    const maxSize =
      1.7;


    cloud.innerHTML =
      keywords
        .map(
          item => {

            const ratio =
              max
                ? item.count /
                  max
                : 0;


            const size =
              minSize +
              (
                maxSize -
                minSize
              ) *
              ratio;


            return `

              <span
                class="cloud-word"
                style="font-size:${size.toFixed(
                  2
                )}rem"
                title="${formatNumber(
                  item.count
                )}"
              >

                ${escapeHTML(
                  item.word
                )}

              </span>

            `;

          }
        )
        .join("");

  }

}


// ============================================================
// HORAS COM MAIOR VOLUME
// ============================================================

function renderSpikes() {

  const container =
    getEl("spikeList");


  if (!container) {
    return;
  }


  const articles =
    getActiveNews();


  const timeline =
    buildTimeline(
      articles,
      1
    );


  const spikes =
    [...timeline]
      .filter(
        item =>
          item.total > 0
      )
      .sort(
        (a, b) =>
          b.total -
          a.total
      )
      .slice(
        0,
        5
      );


  if (!spikes.length) {

    const messages = {

      pt:
        "Nenhum pico de publicação identificado no período selecionado.",

      en:
        "No publication peak was identified in the selected period.",

      es:
        "No se identificó ningún pico de publicaciones en el período seleccionado."

    };


    container.innerHTML = `

      <div class="empty-state">

        ${escapeHTML(
          messages[lang] ||
          messages.pt
        )}

      </div>

    `;

    return;

  }


  const max =
    Math.max(
      ...spikes.map(
        item =>
          item.total
      ),
      1
    );


  const publicationLabel =
    count => {

      const labels = {

        pt:
          count === 1
            ? "publicação"
            : "publicações",

        en:
          count === 1
            ? "publication"
            : "publications",

        es:
          count === 1
            ? "publicación"
            : "publicaciones"

      };


      return (
        labels[lang] ||
        labels.pt
      );

    };


  container.innerHTML =
    spikes
      .map(
        item => {

          const date =
            new Date(
              item.start
            );


          const end =
            new Date(
              item.start +
              60 *
              60 *
              1000
            );


          const startTime =
            date.toLocaleTimeString(
              getLocale(),
              {
                hour:
                  "2-digit",

                minute:
                  "2-digit"
              }
            );


          const endTime =
            end.toLocaleTimeString(
              getLocale(),
              {
                hour:
                  "2-digit",

                minute:
                  "2-digit"
              }
            );


          const width =
            Math.max(
              5,
              item.total /
              max *
              100
            );


          return `

            <div class="spike-row">

              <div class="spike-time">

                <strong>

                  ${escapeHTML(
                    startTime
                  )}

                </strong>

                <span>

                  ${escapeHTML(
                    endTime
                  )}

                </span>

              </div>

              <div class="spike-main">

                <div class="spike-head">

                  <span>

                    ${formatNumber(
                      item.total
                    )}
                    ${escapeHTML(
                      publicationLabel(
                        item.total
                      )
                    )}

                  </span>

                </div>

                <div class="spike-bar">

                  <span
                    style="width:${width}%"
                  ></span>

                </div>

              </div>

            </div>

          `;

        }
      )
      .join("");

}


// ============================================================
// PANORAMA
// ============================================================

function renderRadar() {

  const container =
    getEl(
      "radarVisual"
    );


  if (!container) {
    return;
  }


  if (!liveNews) {

    const waiting = {

      pt: {
        title:
          "Aguardando dados",
        description:
          "O panorama será atualizado quando os dados do monitoramento estiverem disponíveis."
      },

      en: {
        title:
          "Waiting for data",
        description:
          "The overview will be updated when monitoring data becomes available."
      },

      es: {
        title:
          "Esperando datos",
        description:
          "El panorama se actualizará cuando los datos del monitoreo estén disponibles."
      }

    };


    const current =
      waiting[lang] ||
      waiting.pt;


    container.innerHTML = `

      <div
        class="radar-empty"
      >

        <strong>

          ${escapeHTML(
            current.title
          )}

        </strong>

        <span>

          ${escapeHTML(
            current.description
          )}

        </span>

      </div>

    `;

    return;

  }


  const articles =
    getActiveNews();


  const metrics =
    calculateMetrics(
      articles
    );


  const total =
    Math.max(
      metrics.total,
      1
    );


  const flavio =
    metrics.flavio;


  const lula =
    metrics.lula;


  const both =
    metrics.both;


  const other =
    Math.max(
      0,
      metrics.total -
      (
        flavio +
        lula -
        both
      )
    );


  const flavioPercent =
    metrics.total
      ? flavio /
        metrics.total *
        100
      : 0;


  const lulaPercent =
    metrics.total
      ? lula /
        metrics.total *
        100
      : 0;


  const bothPercent =
    metrics.total
      ? both /
        metrics.total *
        100
      : 0;


  const otherPercent =
    metrics.total
      ? other /
        metrics.total *
        100
      : 0;


  const labels = {

    pt: {
      articles:
        "artigos",
      both:
        "Ambos na mesma publicação",
      other:
        "Outras publicações",
      note:
        "Percentuais descritivos calculados a partir das publicações encontradas no período selecionado."
    },

    en: {
      articles:
        "articles",
      both:
        "Both in the same publication",
      other:
        "Other publications",
      note:
        "Descriptive percentages calculated from publications found in the selected period."
    },

    es: {
      articles:
        "artículos",
      both:
        "Ambos en la misma publicación",
      other:
        "Otras publicaciones",
      note:
        "Porcentajes descriptivos calculados a partir de las publicaciones encontradas en el período seleccionado."
    }

  };


  const current =
    labels[lang] ||
    labels.pt;


  container.innerHTML = `

    <div
      class="radar-summary"
    >

      <div
        class="radar-summary-main"
      >

        <strong>

          ${formatNumber(
            metrics.total
          )}

        </strong>

        <span>

          ${escapeHTML(
            current.articles
          )}

        </span>

      </div>


      <div
        class="radar-breakdown"
      >

        <div
          class="radar-stat flavio"
        >

          <div
            class="radar-stat-head"
          >

            <span>
              Flávio Bolsonaro
            </span>

            <strong>

              ${formatNumber(
                flavio
              )}

            </strong>

          </div>

          <div
            class="radar-stat-bar"
          >

            <span
              style="width:${Math.min(
                100,
                flavioPercent
              )}%"
            ></span>

          </div>

          <small>

            ${flavioPercent.toLocaleString(
              getLocale(),
              {
                maximumFractionDigits:
                  1
              }
            )}%

          </small>

        </div>


        <div
          class="radar-stat lula"
        >

          <div
            class="radar-stat-head"
          >

            <span>
              Lula
            </span>

            <strong>

              ${formatNumber(
                lula
              )}

            </strong>

          </div>

          <div
            class="radar-stat-bar"
          >

            <span
              style="width:${Math.min(
                100,
                lulaPercent
              )}%"
            ></span>

          </div>

          <small>

            ${lulaPercent.toLocaleString(
              getLocale(),
              {
                maximumFractionDigits:
                  1
              }
            )}%

          </small>

        </div>


        <div
          class="radar-stat both"
        >

          <div
            class="radar-stat-head"
          >

            <span>

              ${escapeHTML(
                current.both
              )}

            </span>

            <strong>

              ${formatNumber(
                both
              )}

            </strong>

          </div>

          <div
            class="radar-stat-bar"
          >

            <span
              style="width:${Math.min(
                100,
                bothPercent
              )}%"
            ></span>

          </div>

          <small>

            ${bothPercent.toLocaleString(
              getLocale(),
              {
                maximumFractionDigits:
                  1
              }
            )}%

          </small>

        </div>


        <div
          class="radar-stat general"
        >

          <div
            class="radar-stat-head"
          >

            <span>

              ${escapeHTML(
                current.other
              )}

            </span>

            <strong>

              ${formatNumber(
                other
              )}

            </strong>

          </div>

          <div
            class="radar-stat-bar"
          >

            <span
              style="width:${Math.min(
                100,
                otherPercent
              )}%"
            ></span>

          </div>

          <small>

            ${otherPercent.toLocaleString(
              getLocale(),
              {
                maximumFractionDigits:
                  1
              }
            )}%

          </small>

        </div>

      </div>


      <p
        class="radar-note"
      >

        ${escapeHTML(
          current.note
        )}

      </p>

    </div>

  `;

}


// ============================================================
// GRÁFICO DE EVOLUÇÃO
// ============================================================

function drawChart() {

  const canvas =
    getEl(
      "trendChart"
    );


  if (!canvas) {
    return;
  }


  const ctx =
    canvas.getContext(
      "2d"
    );


  if (!ctx) {
    return;
  }


  const articles =
    getActiveNews();


  const timeline =
    buildTimeline(
      articles,
      4
    );


  const ratio =
    window.devicePixelRatio ||
    1;


  const rect =
    canvas.getBoundingClientRect();


  const width =
    Math.max(
      320,
      Math.floor(
        rect.width ||
        canvas.clientWidth ||
        760
      )
    );


  const height =
    Math.max(
      230,
      Math.floor(
        rect.height ||
        canvas.clientHeight ||
        300
      )
    );


  canvas.width =
    Math.floor(
      width *
      ratio
    );


  canvas.height =
    Math.floor(
      height *
      ratio
    );


  ctx.setTransform(
    ratio,
    0,
    0,
    ratio,
    0,
    0
  );


  ctx.clearRect(
    0,
    0,
    width,
    height
  );


  const styles =
    getComputedStyle(
      document.documentElement
    );


  const ink =
    styles
      .getPropertyValue(
        "--ink"
      )
      .trim() ||
    "#10233f";


  const muted =
    styles
      .getPropertyValue(
        "--muted"
      )
      .trim() ||
    "#65758b";


  const line =
    styles
      .getPropertyValue(
        "--line"
      )
      .trim() ||
    "#dce3ec";


  const flavioColor =
    "#0b4da2";


  const lulaColor =
    "#b43a3a";


  if (!timeline.length) {

    const emptyLabels = {

      pt:
        "Sem dados suficientes para gerar o gráfico.",

      en:
        "Not enough data to generate the chart.",

      es:
        "No hay datos suficientes para generar el gráfico."

    };


    ctx.fillStyle =
      muted;


    ctx.font =
      "600 14px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";


    ctx.textAlign =
      "center";


    ctx.fillText(
      emptyLabels[lang] ||
      emptyLabels.pt,
      width / 2,
      height / 2
    );


    return;

  }


  const padding = {
    top: 24,
    right: 20,
    bottom: 46,
    left: 42
  };


  const chartWidth =
    width -
    padding.left -
    padding.right;


  const chartHeight =
    height -
    padding.top -
    padding.bottom;


  const maxValue =
    Math.max(
      1,
      ...timeline.map(
        item =>
          Math.max(
            item.flavio,
            item.lula
          )
      )
    );


  ctx.strokeStyle =
    line;


  ctx.lineWidth =
    1;


  ctx.fillStyle =
    muted;


  ctx.font =
    "11px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";


  ctx.textAlign =
    "right";


  const gridLines =
    4;


  for (
    let i = 0;
    i <= gridLines;
    i += 1
  ) {

    const y =
      padding.top +
      chartHeight *
      (
        i /
        gridLines
      );


    const value =
      Math.round(
        maxValue *
        (
          1 -
          i /
          gridLines
        )
      );


    ctx.beginPath();


    ctx.moveTo(
      padding.left,
      y
    );


    ctx.lineTo(
      width -
      padding.right,
      y
    );


    ctx.stroke();


    ctx.fillText(
      String(value),
      padding.left - 8,
      y + 4
    );

  }


  const getX =
    index => {

      if (
        timeline.length === 1
      ) {

        return (
          padding.left +
          chartWidth / 2
        );

      }


      return (
        padding.left +
        index /
        (
          timeline.length -
          1
        ) *
        chartWidth
      );

    };


  const getY =
    value =>
      padding.top +
      chartHeight -
      (
        value /
        maxValue
      ) *
      chartHeight;


  const drawSeries =
    (
      key,
      color
    ) => {

      ctx.beginPath();


      ctx.strokeStyle =
        color;


      ctx.lineWidth =
        2.5;


      ctx.lineJoin =
        "round";


      ctx.lineCap =
        "round";


      timeline.forEach(
        (
          item,
          index
        ) => {

          const x =
            getX(
              index
            );


          const y =
            getY(
              item[key]
            );


          if (
            index === 0
          ) {

            ctx.moveTo(
              x,
              y
            );

          } else {

            ctx.lineTo(
              x,
              y
            );

          }

        }
      );


      ctx.stroke();


      timeline.forEach(
        (
          item,
          index
        ) => {

          const x =
            getX(
              index
            );


          const y =
            getY(
              item[key]
            );


          ctx.beginPath();


          ctx.fillStyle =
            color;


          ctx.arc(
            x,
            y,
            3,
            0,
            Math.PI * 2
          );


          ctx.fill();

        }
      );

    };


  drawSeries(
    "flavio",
    flavioColor
  );


  drawSeries(
    "lula",
    lulaColor
  );


  ctx.fillStyle =
    muted;


  ctx.font =
    "10px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";


  ctx.textAlign =
    "center";


  const labelEvery =
    Math.max(
      1,
      Math.ceil(
        timeline.length /
        6
      )
    );


  timeline.forEach(
    (
      item,
      index
    ) => {

      if (
        index %
        labelEvery !== 0 &&
        index !==
          timeline.length - 1
      ) {
        return;
      }


      const date =
        new Date(
          item.start
        );


      const label =
        date.toLocaleTimeString(
          getLocale(),
          {
            hour:
              "2-digit",

            minute:
              "2-digit"
          }
        );


      ctx.fillText(
        label,
        getX(
          index
        ),
        height - 17
      );

    }
  );


  canvas.setAttribute(
    "aria-label",
    (
      {
        pt:
          "Gráfico da evolução temporal das publicações que mencionam Flávio Bolsonaro e Lula.",

        en:
          "Chart showing the temporal evolution of publications mentioning Flávio Bolsonaro and Lula.",

        es:
          "Gráfico de la evolución temporal de las publicaciones que mencionan a Flávio Bolsonaro y Lula."
      }[lang] ||
      "Gráfico da evolução temporal das publicações que mencionam Flávio Bolsonaro e Lula."
    )
  );


  const caption =
    document.querySelector(
      ".chart-caption"
    );


  if (caption) {

    const captions = {

      pt:
        "Evolução calculada a partir dos horários de publicação dos artigos no período selecionado.",

      en:
        "Evolution calculated from article publication times during the selected period.",

      es:
        "Evolución calculada a partir de los horarios de publicación de los artículos durante el período seleccionado."

    };


    caption.textContent =
      captions[lang] ||
      captions.pt;

  }

}
// ============================================================
// DETECÇÃO DE FILTROS ATIVOS
// ============================================================

function hasActiveFilters() {

  const search =
    getEl("searchTerm")
      ?.value
      ?.trim() ||
    "";

  const source =
    getEl("source")
      ?.value ||
    "all";

  const scope =
    getEl("scope")
      ?.value ||
    "all";

  const period =
    getEl("period")
      ?.value ||
    "48h";


  return (
    Boolean(search) ||
    source !== "all" ||
    scope !== "all" ||
    period !== "48h"
  );

}


// ============================================================
// APLICAÇÃO DOS FILTROS
// ============================================================

function applyRadarFilters() {

  if (!liveNews) {
    return;
  }


  const query =
    normalizeText(
      getEl("searchTerm")
        ?.value ||
      ""
    );


  const source =
    normalizeText(
      getEl("source")
        ?.value ||
      "all"
    );


  const scope =
    getEl("scope")
      ?.value ||
    "all";


  const period =
    getEl("period")
      ?.value ||
    "48h";


  const periodHours =
    period === "24h"
      ? 24
      : 48;


  const periodStart =
    Date.now() -
    periodHours *
    60 *
    60 *
    1000;


  filteredNews =
    liveNews.filter(
      article => {

        const searchable =
          normalizeText(
            [
              article.title,
              article.subtitle,
              article.publisher,
              article.domain,
              article.category,
              candidateLabel(
                article
              )
            ].join(" ")
          );


        const queryMatch =
          !query ||
          searchable.includes(
            query
          );


        const sourceMatch =
          source === "all" ||
          normalizeText(
            article.publisher
          ) === source;


        let scopeMatch =
          true;


        if (
          scope === "flavio"
        ) {

          scopeMatch =
            Boolean(
              article.mentions
                ?.flavio
            );

        } else if (
          scope === "lula"
        ) {

          scopeMatch =
            Boolean(
              article.mentions
                ?.lula
            );

        } else if (
          scope === "both"
        ) {

          // Filtro principal:
          // "Ambos na mesma matéria"
          // exige Flávio E Lula.
          scopeMatch =
            Boolean(
              article.mentions
                ?.flavio &&
              article.mentions
                ?.lula
            );

        }


        const publishedDate =
          validDate(
            article.publishedAt
          );


        const periodMatch =
          publishedDate
            ? publishedDate
                .getTime() >=
              periodStart
            : false;


        return (
          queryMatch &&
          sourceMatch &&
          scopeMatch &&
          periodMatch
        );

      }
    );


  renderFilteredData();

}


// ============================================================
// RENDERIZAÇÃO APÓS FILTROS
// ============================================================

function renderFilteredData() {

  renderMetrics();

  renderNewsFeed();

  renderPublisherRanking();

  renderCoverageCards();

  renderKeywords();

  renderSpikes();

  renderRadar();

  drawChart();

}


// ============================================================
// RESET DOS FILTROS
// ============================================================

function resetRadarFilters() {

  const period =
    getEl("period");

  const scope =
    getEl("scope");

  const source =
    getEl("source");

  const region =
    getEl("region");

  const searchTerm =
    getEl("searchTerm");


  if (period) {

    // Corrigido:
    // o período padrão do Radar é 48h.
    period.value =
      "48h";

  }


  if (scope) {

    scope.value =
      "all";

  }


  if (source) {

    source.value =
      "all";

  }


  if (region) {

    region.value =
      "BR";

  }


  if (searchTerm) {

    searchTerm.value =
      "";

  }


  filteredNews =
    liveNews
      ? [...liveNews]
      : [];


  renderFilteredData();

}


// ============================================================
// FILTRO INTERNO DA ABA MENÇÕES
// ============================================================

function filterMentionsList(
  value
) {

  const query =
    normalizeText(
      value
    );


  document
    .querySelectorAll(
      "#mentionsList .news-item"
    )
    .forEach(
      item => {

        item.hidden =
          Boolean(query) &&
          !normalizeText(
            item.dataset.title ||
            ""
          ).includes(
            query
          );

      }
    );

}


// ============================================================
// DADOS REAIS — RENDERIZAÇÃO PRINCIPAL
// ============================================================

function renderRealData() {

  if (!liveNews) {
    return;
  }


  filteredNews =
    [...liveNews];


  renderSourceFilter();

  renderMetrics();

  renderNewsFeed();

  renderPublisherRanking();

  renderCoverageCards();

  renderKeywords();

  renderSpikes();

  renderRadar();

  drawChart();

  renderLastUpdate();

  renderVideosPlanned();

  updateRealDataLabels();

}


// ============================================================
// ÚLTIMA ATUALIZAÇÃO
// ============================================================

function renderLastUpdate() {

  const element =
    getEl(
      "lastUpdate"
    );


  if (!element) {
    return;
  }


  const newest =
    liveNews
      ?.map(
        article =>
          validDate(
            article.publishedAt
          )
      )
      .filter(Boolean)
      .sort(
        (a, b) =>
          b.getTime() -
          a.getTime()
      )[0];


  const collectionDate =
    validDate(
      liveNewsMeta?.collectedAt
    );


  const date =
    collectionDate ||
    newest;


  element.textContent =
    date
      ? formatDateTime(
          date
        )
      : new Date()
          .toLocaleTimeString(
            getLocale(),
            {
              hour:
                "2-digit",

              minute:
                "2-digit"
            }
          );

}


// ============================================================
// ESTADO — NOTÍCIAS INDISPONÍVEIS
// ============================================================

function renderNewsUnavailable() {

  const labels = {

    pt: {

      title:
        "Dados temporariamente indisponíveis",

      description:
        "O Radar não recebeu uma coleta válida de notícias neste momento. Nenhum número demonstrativo foi utilizado como substituição."

    },

    en: {

      title:
        "Data temporarily unavailable",

      description:
        "The Radar did not receive a valid news collection at this time. No demonstration figures were used as a replacement."

    },

    es: {

      title:
        "Datos temporalmente no disponibles",

      description:
        "El Radar no recibió una recopilación válida de noticias en este momento. No se utilizaron cifras demostrativas como sustitución."

    }

  };


  const current =
    labels[lang] ||
    labels.pt;


  const message = `

    <article
      class="news-item"
    >

      <div
        class="source"
      >

        <span>
          Radar 2026
        </span>

        <span
          class="tag"
        >
          API
        </span>

      </div>

      <h4>

        ${escapeHTML(
          current.title
        )}

      </h4>

      <p>

        ${escapeHTML(
          current.description
        )}

      </p>

    </article>

  `;


  const newsFeed =
    getEl(
      "newsFeed"
    );


  const mentionsList =
    getEl(
      "mentionsList"
    );


  if (newsFeed) {

    newsFeed.innerHTML =
      message;

  }


  if (mentionsList) {

    mentionsList.innerHTML =
      message;

  }


  const metricIds = [
    "metricMentions",
    "metricTopics",
    "metricSources",
    "metricPeak"
  ];


  metricIds.forEach(
    id => {

      const element =
        getEl(id);


      if (element) {

        element.textContent =
          "—";

      }

    }
  );


  renderRadar();

  drawChart();

}


// ============================================================
// CONTEÚDOS RELACIONADOS — YOUTUBE PLANEJADO
// ============================================================

function renderVideosPlanned() {

  const container =
    getEl(
      "videoGrid"
    );


  if (!container) {
    return;
  }


  const labels = {

    pt: {

      title:
        "Integração com YouTube prevista",

      description:
        "O Radar ainda não utiliza dados da API do YouTube. Nenhum vídeo ou métrica demonstrativa é exibido como dado real.",

      status:
        "Planejado"

    },

    en: {

      title:
        "YouTube integration planned",

      description:
        "The Radar does not yet use data from the YouTube API. No demonstration videos or metrics are displayed as real data.",

      status:
        "Planned"

    },

    es: {

      title:
        "Integración con YouTube prevista",

      description:
        "El Radar todavía no utiliza datos de la API de YouTube. No se muestran videos ni métricas demostrativas como datos reales.",

      status:
        "Planeado"

    }

  };


  const current =
    labels[lang] ||
    labels.pt;


  container.innerHTML = `

    <article
      class="video-card planned-card"
    >

      <div
        class="video-placeholder"
        aria-hidden="true"
      >

        <span>
          ▶
        </span>

      </div>

      <div
        class="video-content"
      >

        <span
          class="tag"
        >

          ${escapeHTML(
            current.status
          )}

        </span>

        <h4>

          ${escapeHTML(
            current.title
          )}

        </h4>

        <p>

          ${escapeHTML(
            current.description
          )}

        </p>

      </div>

    </article>

  `;

}


// ============================================================
// RÓTULOS DOS DADOS REAIS
// ============================================================

function updateRealDataLabels() {

  const periodHours =
    getSelectedPeriodHours();


  const labels = {

    pt: {

      now:
        `Últimas ${periodHours} horas`,

      methodology:
        `Dados obtidos das fontes monitoradas e processados pelo Radar. Período selecionado: ${periodHours} horas.`,

      stale:
        "A coleta exibida pode estar temporariamente em cache."

    },

    en: {

      now:
        `Last ${periodHours} hours`,

      methodology:
        `Data obtained from monitored sources and processed by the Radar. Selected period: ${periodHours} hours.`,

      stale:
        "The displayed collection may temporarily be cached."

    },

    es: {

      now:
        `Últimas ${periodHours} horas`,

      methodology:
        `Datos obtenidos de las fuentes monitoreadas y procesados por el Radar. Período seleccionado: ${periodHours} horas.`,

      stale:
        "La recopilación mostrada puede estar temporalmente almacenada en caché."

    }

  };


  const current =
    labels[lang] ||
    labels.pt;


  const nowLabel =
    getEl(
      "nowLabel"
    );


  if (nowLabel) {

    nowLabel.textContent =
      current.now;

  }


  const methodology =
    getEl(
      "methodologyNote"
    );


  if (methodology) {

    methodology.textContent =
      current.methodology;

  }


  const stale =
    getEl(
      "staleNotice"
    );


  if (stale) {

    stale.hidden =
      !liveNewsMeta?.stale;


    stale.textContent =
      current.stale;

  }

}


// ============================================================
// FILTRO DA COBERTURA
// ============================================================

function updateCoverageFilterLanguage() {

  const select =
    getEl(
      "coverageFilter"
    );


  if (!select) {
    return;
  }


  const labels = {

    pt: {
      flavio:
        "Flávio",
      lula:
        "Lula",
      both:
        "Ambos",
      aria:
        "Filtrar cobertura por candidato"
    },

    en: {
      flavio:
        "Flávio",
      lula:
        "Lula",
      both:
        "Both",
      aria:
        "Filter coverage by candidate"
    },

    es: {
      flavio:
        "Flávio",
      lula:
        "Lula",
      both:
        "Ambos",
      aria:
        "Filtrar cobertura por candidato"
    }

  };


  const current =
    labels[lang] ||
    labels.pt;


  const flavio =
    select.querySelector(
      'option[value="flavio"]'
    );


  const lula =
    select.querySelector(
      'option[value="lula"]'
    );


  const both =
    select.querySelector(
      'option[value="both"]'
    );


  if (flavio) {

    flavio.textContent =
      current.flavio;

  }


  if (lula) {

    lula.textContent =
      current.lula;

  }


  if (both) {

    both.textContent =
      current.both;

  }


  select.setAttribute(
    "aria-label",
    current.aria
  );


  const label =
    document.querySelector(
      'label[for="coverageFilter"] .sr-only'
    );


  if (label) {

    label.textContent =
      current.aria;

  }

}


// ============================================================
// TRADUÇÃO DOS FILTROS PRINCIPAIS
// ============================================================

function updateFilterLanguage() {

  const period =
    getEl(
      "period"
    );


  const scope =
    getEl(
      "scope"
    );


  const source =
    getEl(
      "source"
    );


  const search =
    getEl(
      "searchTerm"
    );


  const labels = {

    pt: {

      period24:
        "Últimas 24 horas",

      period48:
        "Últimas 48 horas",

      all:
        "Todos",

      flavio:
        "Flávio Bolsonaro",

      lula:
        "Lula",

      both:
        "Ambos na mesma matéria",

      allSources:
        "Todos os veículos",

      placeholder:
        "Ex.: economia, segurança..."

    },

    en: {

      period24:
        "Last 24 hours",

      period48:
        "Last 48 hours",

      all:
        "All",

      flavio:
        "Flávio Bolsonaro",

      lula:
        "Lula",

      both:
        "Both in the same article",

      allSources:
        "All publishers",

      placeholder:
        "E.g.: economy, security..."

    },

    es: {

      period24:
        "Últimas 24 horas",

      period48:
        "Últimas 48 horas",

      all:
        "Todos",

      flavio:
        "Flávio Bolsonaro",

      lula:
        "Lula",

      both:
        "Ambos en el mismo artículo",

      allSources:
        "Todos los medios",

      placeholder:
        "Ej.: economía, seguridad..."

    }

  };


  const current =
    labels[lang] ||
    labels.pt;


  if (period) {

    const option24 =
      period.querySelector(
        'option[value="24h"]'
      );


    const option48 =
      period.querySelector(
        'option[value="48h"]'
      );


    if (option24) {

      option24.textContent =
        current.period24;

    }


    if (option48) {

      option48.textContent =
        current.period48;

    }

  }


  if (scope) {

    const all =
      scope.querySelector(
        'option[value="all"]'
      );


    const flavio =
      scope.querySelector(
        'option[value="flavio"]'
      );


    const lula =
      scope.querySelector(
        'option[value="lula"]'
      );


    const both =
      scope.querySelector(
        'option[value="both"]'
      );


    if (all) {

      all.textContent =
        current.all;

    }


    if (flavio) {

      flavio.textContent =
        current.flavio;

    }


    if (lula) {

      lula.textContent =
        current.lula;

    }


    if (both) {

      both.textContent =
        current.both;

    }

  }


  if (source) {

    const allSources =
      source.querySelector(
        'option[value="all"]'
      );


    if (allSources) {

      allSources.textContent =
        current.allSources;

    }

  }


  if (search) {

    search.placeholder =
      current.placeholder;

  }

}
// ============================================================
// TRADUÇÕES
// ============================================================

const translations = {

  // ==========================================================
  // PORTUGUÊS
  // ==========================================================

  pt: {

    accessibility:
      "Acessibilidade:",

    increase_font:
      "Aumentar fonte",

    decrease_font:
      "Diminuir fonte",

    contrast:
      "Alto contraste",

    theme:
      "Alternar tema",

    header_subtitle:
      "Radar Eleitoral 2026",

    nav_home:
      "Início",

    nav_map:
      "Mapa de Votos",

    nav_gov:
      "Plano de Governo",

    nav_axes:
      "Eixos Temáticos",

    nav_candidates:
      "Candidatos",

    nav_materials:
      "Materiais",

    nav_guide:
      "Guia de Diálogo",

    monitoring:
      "MONITORAMENTO",

    filters:
      "Filtros do radar",

    reset:
      "Limpar filtros",

    period:
      "Período",

    scope:
      "Candidato",

    source:
      "Veículo",

    search:
      "Buscar termo",

    apply:
      "Aplicar filtros",

    period_24h:
      "Últimas 24 horas",

    period_48h:
      "Últimas 48 horas",

    candidate_all:
      "Todos",

    candidate_flavio:
      "Flávio Bolsonaro",

    candidate_lula:
      "Lula",

    candidate_both_same:
      "Ambos na mesma matéria",

    all_publishers:
      "Todos os veículos",

    overview:
      "Visão geral",

    mentions:
      "Menções",

    themes:
      "Temas",

    videos:
      "Vídeos",

    apis:
      "APIs e fontes",

    metric_mentions:
      "Publicações encontradas",

    metric_topics:
      "Referências aos candidatos",

    metric_sources:
      "Veículos monitorados",

    metric_peak:
      "Pico por hora",

    evolution:
      "Evolução da cobertura",

    evolution_desc:
      "Distribuição das publicações ao longo do período selecionado.",

    ranking_title:
      "Veículos com mais publicações",

    ranking_desc:
      "Quantidade de artigos encontrados por veículo no período selecionado.",

    panorama:
      "PANORAMA",

    panorama_title:
      "Distribuição da cobertura encontrada",

    panorama_desc:
      "Visão descritiva das referências identificadas nas publicações monitoradas.",

    panorama_note:
      "Indicadores calculados a partir dos artigos disponíveis durante o período monitorado.",

    panorama_waiting:
      "Aguardando dados",

    panorama_waiting_desc:
      "O panorama será atualizado quando os dados do monitoramento estiverem disponíveis.",

    news_title:
      "Últimas publicações encontradas",

    view_all:
      "Ver todas",

    themes_title:
      "Distribuição de referências",

    themes_desc:
      "Participação descritiva no período monitorado.",

    add_theme:
      "Adicionar tema",

    mentions_title:
      "Cobertura e publicações",

    keywords_title:
      "Termos com maior presença",

    cloud_title:
      "Nuvem de termos",

    cloud_note:
      "O tamanho representa a frequência no período monitorado.",

    spikes_title:
      "Horários com maior volume",

    videos_title:
      "Conteúdos relacionados",

    videos_desc:
      "Integração com YouTube prevista.",

    apis_title:
      "Fontes e serviços",

    config_title:
      "Parâmetros do radar",

    publication:
      "publicação",

    publications:
      "publicações",

    ranking_publications:
      "{count} publicações nas últimas {hours}h",

    in_last_hours:
      "nas últimas {hours}h",

    no_data:
      "Sem dados",

    no_publishers:
      "Nenhum veículo encontrado para os filtros atuais.",

    no_publication:
      "Nenhuma publicação encontrada",

    no_filter_results:
      "Não há resultados para os filtros selecionados.",

    adjust_filters:
      "Ajuste os filtros para ampliar a consulta.",

    no_keywords:
      "Sem termos suficientes no período selecionado.",

    no_spikes:
      "Nenhum pico de publicação identificado no período selecionado.",

    chart_no_data:
      "Sem dados suficientes para gerar o gráfico.",

    total_monitored:
      "Total monitorado",

    both_candidates:
      "Ambos",

    coverage_filter_label:
      "Filtrar cobertura por candidato",

    coverage_flavio:
      "Flávio",

    coverage_lula:
      "Lula",

    coverage_both:
      "Ambos",

    coverage_card_flavio:
      "Artigos das últimas {hours}h em que o monitor identificou referência a Flávio Bolsonaro.",

    coverage_card_lula:
      "Artigos das últimas {hours}h em que o monitor identificou referência a Lula.",

    coverage_card_both:
      "Artigos das últimas {hours}h em que foram identificadas referências a Flávio Bolsonaro e Lula na mesma publicação.",

    coverage_card_total:
      "Total de artigos retornados pelas fontes monitoradas nas últimas {hours}h.",

    hours_label:
      "{hours} horas",

    data_unavailable:
      "Dados temporariamente indisponíveis",

    data_unavailable_desc:
      "O Radar não recebeu uma coleta válida de notícias neste momento. Nenhum número demonstrativo foi utilizado como substituição.",

    youtube_planned:
      "Integração com YouTube prevista",

    youtube_planned_desc:
      "O Radar ainda não utiliza dados da API do YouTube. Nenhum vídeo ou métrica demonstrativa é exibido como dado real.",

    planned:
      "Planejado",

    sources_label:
      "Fontes",

    sources_none:
      "Nenhuma informação disponível neste momento.",

    unavailable:
      "Indisponível",

    active:
      "Ativo",

    connected:
      "Conectado",

    paused:
      "Pausado",

    pending:
      "Aguardando",

    original_publication:
      "Abrir publicação original",

    other_publications:
      "Outras publicações",

    both_same_publication:
      "Ambos na mesma publicação",

    articles:
      "artigos",

    footer_desc:
      "Radar Eleitoral 2026."

  },


  // ==========================================================
  // ENGLISH
  // ==========================================================

  en: {

    accessibility:
      "Accessibility:",

    increase_font:
      "Increase font size",

    decrease_font:
      "Decrease font size",

    contrast:
      "High contrast",

    theme:
      "Toggle theme",

    header_subtitle:
      "2026 Election Radar",

    nav_home:
      "Home",

    nav_map:
      "Vote Map",

    nav_gov:
      "Government Plan",

    nav_axes:
      "Policy Areas",

    nav_candidates:
      "Candidates",

    nav_materials:
      "Materials",

    nav_guide:
      "Dialogue Guide",

    monitoring:
      "MONITORING",

    filters:
      "Radar filters",

    reset:
      "Clear filters",

    period:
      "Period",

    scope:
      "Candidate",

    source:
      "Publisher",

    search:
      "Search term",

    apply:
      "Apply filters",

    period_24h:
      "Last 24 hours",

    period_48h:
      "Last 48 hours",

    candidate_all:
      "All",

    candidate_flavio:
      "Flávio Bolsonaro",

    candidate_lula:
      "Lula",

    candidate_both_same:
      "Both in the same article",

    all_publishers:
      "All publishers",

    overview:
      "Overview",

    mentions:
      "Mentions",

    themes:
      "Topics",

    videos:
      "Videos",

    apis:
      "APIs and sources",

    metric_mentions:
      "Publications found",

    metric_topics:
      "Candidate references",

    metric_sources:
      "Monitored publishers",

    metric_peak:
      "Hourly peak",

    evolution:
      "Coverage evolution",

    evolution_desc:
      "Distribution of publications throughout the selected period.",

    ranking_title:
      "Publishers with the most publications",

    ranking_desc:
      "Number of articles found per publisher during the selected period.",

    panorama:
      "OVERVIEW",

    panorama_title:
      "Distribution of coverage found",

    panorama_desc:
      "Descriptive view of references identified in monitored publications.",

    panorama_note:
      "Indicators calculated from articles available during the monitored period.",

    panorama_waiting:
      "Waiting for data",

    panorama_waiting_desc:
      "The overview will be updated when monitoring data becomes available.",

    news_title:
      "Latest publications found",

    view_all:
      "View all",

    themes_title:
      "Reference distribution",

    themes_desc:
      "Descriptive share during the monitored period.",

    add_theme:
      "Add topic",

    mentions_title:
      "Coverage and publications",

    keywords_title:
      "Most frequent terms",

    cloud_title:
      "Term cloud",

    cloud_note:
      "Size represents frequency during the monitored period.",

    spikes_title:
      "Hours with the highest volume",

    videos_title:
      "Related content",

    videos_desc:
      "YouTube integration planned.",

    apis_title:
      "Sources and services",

    config_title:
      "Radar parameters",

    publication:
      "publication",

    publications:
      "publications",

    ranking_publications:
      "{count} publications in the last {hours}h",

    in_last_hours:
      "in the last {hours}h",

    no_data:
      "No data",

    no_publishers:
      "No publishers found for the current filters.",

    no_publication:
      "No publications found",

    no_filter_results:
      "There are no results for the selected filters.",

    adjust_filters:
      "Adjust the filters to broaden the search.",

    no_keywords:
      "Not enough terms in the selected period.",

    no_spikes:
      "No publication peak was identified in the selected period.",

    chart_no_data:
      "Not enough data to generate the chart.",

    total_monitored:
      "Total monitored",

    both_candidates:
      "Both",

    coverage_filter_label:
      "Filter coverage by candidate",

    coverage_flavio:
      "Flávio",

    coverage_lula:
      "Lula",

    coverage_both:
      "Both",

    coverage_card_flavio:
      "Articles from the last {hours}h in which the monitor identified a reference to Flávio Bolsonaro.",

    coverage_card_lula:
      "Articles from the last {hours}h in which the monitor identified a reference to Lula.",

    coverage_card_both:
      "Articles from the last {hours}h in which references to Flávio Bolsonaro and Lula were identified in the same publication.",

    coverage_card_total:
      "Total articles returned by the monitored sources in the last {hours}h.",

    hours_label:
      "{hours} hours",

    data_unavailable:
      "Data temporarily unavailable",

    data_unavailable_desc:
      "The Radar did not receive a valid news collection at this time. No demonstration figures were used as a replacement.",

    youtube_planned:
      "YouTube integration planned",

    youtube_planned_desc:
      "The Radar does not yet use data from the YouTube API. No demonstration videos or metrics are displayed as real data.",

    planned:
      "Planned",

    sources_label:
      "Sources",

    sources_none:
      "No information is available at this time.",

    unavailable:
      "Unavailable",

    active:
      "Active",

    connected:
      "Connected",

    paused:
      "Paused",

    pending:
      "Pending",

    original_publication:
      "Open original publication",

    other_publications:
      "Other publications",

    both_same_publication:
      "Both in the same publication",

    articles:
      "articles",

    footer_desc:
      "2026 Election Radar."

  },


  // ==========================================================
  // ESPAÑOL
  // ==========================================================

  es: {

    accessibility:
      "Accesibilidad:",

    increase_font:
      "Aumentar fuente",

    decrease_font:
      "Disminuir fuente",

    contrast:
      "Alto contraste",

    theme:
      "Cambiar tema",

    header_subtitle:
      "Radar Electoral 2026",

    nav_home:
      "Inicio",

    nav_map:
      "Mapa de Votos",

    nav_gov:
      "Plan de Gobierno",

    nav_axes:
      "Ejes Temáticos",

    nav_candidates:
      "Candidatos",

    nav_materials:
      "Materiales",

    nav_guide:
      "Guía de Diálogo",

    monitoring:
      "MONITOREO",

    filters:
      "Filtros del radar",

    reset:
      "Limpiar filtros",

    period:
      "Período",

    scope:
      "Candidato",

    source:
      "Medio",

    search:
      "Buscar término",

    apply:
      "Aplicar filtros",

    period_24h:
      "Últimas 24 horas",

    period_48h:
      "Últimas 48 horas",

    candidate_all:
      "Todos",

    candidate_flavio:
      "Flávio Bolsonaro",

    candidate_lula:
      "Lula",

    candidate_both_same:
      "Ambos en el mismo artículo",

    all_publishers:
      "Todos los medios",

    overview:
      "Visión general",

    mentions:
      "Menciones",

    themes:
      "Temas",

    videos:
      "Videos",

    apis:
      "APIs y fuentes",

    metric_mentions:
      "Publicaciones encontradas",

    metric_topics:
      "Referencias a los candidatos",

    metric_sources:
      "Medios monitoreados",

    metric_peak:
      "Pico por hora",

    evolution:
      "Evolución de la cobertura",

    evolution_desc:
      "Distribución de las publicaciones durante el período seleccionado.",

    ranking_title:
      "Medios con más publicaciones",

    ranking_desc:
      "Cantidad de artículos encontrados por medio durante el período seleccionado.",

    panorama:
      "PANORAMA",

    panorama_title:
      "Distribución de la cobertura encontrada",

    panorama_desc:
      "Vista descriptiva de las referencias identificadas en las publicaciones monitoreadas.",

    panorama_note:
      "Indicadores calculados a partir de los artículos disponibles durante el período monitoreado.",

    panorama_waiting:
      "Esperando datos",

    panorama_waiting_desc:
      "El panorama se actualizará cuando los datos del monitoreo estén disponibles.",

    news_title:
      "Últimas publicaciones encontradas",

    view_all:
      "Ver todas",

    themes_title:
      "Distribución de referencias",

    themes_desc:
      "Participación descriptiva durante el período monitoreado.",

    add_theme:
      "Agregar tema",

    mentions_title:
      "Cobertura y publicaciones",

    keywords_title:
      "Términos con mayor presencia",

    cloud_title:
      "Nube de términos",

    cloud_note:
      "El tamaño representa la frecuencia durante el período monitoreado.",

    spikes_title:
      "Horas con mayor volumen",

    videos_title:
      "Contenidos relacionados",

    videos_desc:
      "Integración con YouTube prevista.",

    apis_title:
      "Fuentes y servicios",

    config_title:
      "Parámetros del radar",

    publication:
      "publicación",

    publications:
      "publicaciones",

    ranking_publications:
      "{count} publicaciones en las últimas {hours}h",

    in_last_hours:
      "en las últimas {hours}h",

    no_data:
      "Sin datos",

    no_publishers:
      "No se encontraron medios para los filtros actuales.",

    no_publication:
      "No se encontraron publicaciones",

    no_filter_results:
      "No hay resultados para los filtros seleccionados.",

    adjust_filters:
      "Ajuste los filtros para ampliar la búsqueda.",

    no_keywords:
      "No hay suficientes términos en el período seleccionado.",

    no_spikes:
      "No se identificó ningún pico de publicaciones en el período seleccionado.",

    chart_no_data:
      "No hay datos suficientes para generar el gráfico.",

    total_monitored:
      "Total monitoreado",

    both_candidates:
      "Ambos",

    coverage_filter_label:
      "Filtrar cobertura por candidato",

    coverage_flavio:
      "Flávio",

    coverage_lula:
      "Lula",

    coverage_both:
      "Ambos",

    coverage_card_flavio:
      "Artículos de las últimas {hours}h en los que el monitor identificó una referencia a Flávio Bolsonaro.",

    coverage_card_lula:
      "Artículos de las últimas {hours}h en los que el monitor identificó una referencia a Lula.",

    coverage_card_both:
      "Artículos de las últimas {hours}h en los que se identificaron referencias a Flávio Bolsonaro y Lula en la misma publicación.",

    coverage_card_total:
      "Total de artículos devueltos por las fuentes monitoreadas en las últimas {hours}h.",

    hours_label:
      "{hours} horas",

    data_unavailable:
      "Datos temporalmente no disponibles",

    data_unavailable_desc:
      "El Radar no recibió una recopilación válida de noticias en este momento. No se utilizaron cifras demostrativas como sustitución.",

    youtube_planned:
      "Integración con YouTube prevista",

    youtube_planned_desc:
      "El Radar todavía no utiliza datos de la API de YouTube. No se muestran videos ni métricas demostrativas como datos reales.",

    planned:
      "Planeado",

    sources_label:
      "Fuentes",

    sources_none:
      "No hay información disponible en este momento.",

    unavailable:
      "No disponible",

    active:
      "Activo",

    connected:
      "Conectado",

    paused:
      "Pausado",

    pending:
      "Pendiente",

    original_publication:
      "Abrir publicación original",

    other_publications:
      "Otras publicaciones",

    both_same_publication:
      "Ambos en la misma publicación",

    articles:
      "artículos",

    footer_desc:
      "Radar Electoral 2026."

  }

};
// ============================================================
// ABERTURA DAS ABAS
// ============================================================

function openTab(name) {

  const buttons =
    document.querySelectorAll(
      ".tab-btn"
    );

  const panels =
    document.querySelectorAll(
      ".tab-panel"
    );


  buttons.forEach(
    button => {

      const active =
        button.dataset.tab ===
        name;


      button.classList.toggle(
        "active",
        active
      );


      button.setAttribute(
        "aria-selected",
        active
          ? "true"
          : "false"
      );

    }
  );


  panels.forEach(
    panel => {

      const active =
        panel.id ===
        `tab-${name}`;


      panel.classList.toggle(
        "active",
        active
      );


      panel.hidden =
        !active;

    }
  );


  if (
    name === "overview"
  ) {

    window.requestAnimationFrame(
      () => {
        drawChart();
      }
    );

  }

}


// ============================================================
// IDIOMA
// ============================================================

function setLanguage(
  language
) {

  if (
    !translations[
      language
    ]
  ) {
    return;
  }


  lang =
    language;


  localStorage.setItem(
    "fazdireito-lang",
    lang
  );


  document.documentElement.lang =
    lang === "pt"
      ? "pt-BR"
      : lang === "en"
        ? "en"
        : "es";


  const texts =
    translations[lang];


  document
    .querySelectorAll(
      "[data-i18n]"
    )
    .forEach(
      element => {

        const key =
          element.dataset.i18n;


        if (
          Object.prototype
            .hasOwnProperty
            .call(
              texts,
              key
            )
        ) {

          element.textContent =
            texts[key];

        }

      }
    );


  document
    .querySelectorAll(
      "[data-lang]"
    )
    .forEach(
      button => {

        const active =
          button.dataset.lang ===
          lang;


        button.classList.toggle(
          "active",
          active
        );


        button.setAttribute(
          "aria-pressed",
          active
            ? "true"
            : "false"
        );

      }
    );


  updateFilterLanguage();

  updateCoverageFilterLanguage();


  if (
    Array.isArray(
      liveNews
    )
  ) {

    renderSourceFilter();

    renderFilteredData();

    renderLastUpdate();

    renderVideosPlanned();

    updateRealDataLabels();

  } else {

    renderNewsUnavailable();

    renderVideosPlanned();

  }


  if (
    Array.isArray(
      liveSources
    )
  ) {

    renderApiSources(
      liveSources
    );

  }

}


// ============================================================
// TAMANHO DA FONTE
// ============================================================

function applyFontSize() {

  document.documentElement
    .style
    .fontSize =
      `${fontSize}%`;


  localStorage.setItem(
    "fazdireito-font-size",
    String(
      fontSize
    )
  );

}


function increaseFontSize() {

  fontSize =
    Math.min(
      125,
      fontSize + 5
    );


  applyFontSize();

}


function decreaseFontSize() {

  fontSize =
    Math.max(
      85,
      fontSize - 5
    );


  applyFontSize();

}


// ============================================================
// TEMA / CONTRASTE
// ============================================================

function setTheme(
  theme
) {

  const normalized =
    theme === "dark"
      ? "dark"
      : "light";


  document.documentElement
    .dataset
    .theme =
      normalized;


  document.body
    ?.classList
    .toggle(
      "dark-theme",
      normalized === "dark"
    );


  localStorage.setItem(
    "fazdireito-theme",
    normalized
  );


  window.requestAnimationFrame(
    () => {

      if (liveNews) {

        drawChart();

      }

    }
  );

}


function toggleTheme() {

  const current =
    localStorage.getItem(
      "fazdireito-theme"
    ) ||
    document.documentElement
      .dataset
      .theme ||
    "light";


  setTheme(
    current === "dark"
      ? "light"
      : "dark"
  );

}


function toggleContrast() {

  const active =
    document.body
      ?.classList
      .toggle(
        "high-contrast"
      );


  localStorage.setItem(
    "fazdireito-contrast",
    active
      ? "1"
      : "0"
  );


  window.requestAnimationFrame(
    () => {

      if (liveNews) {

        drawChart();

      }

    }
  );

}


// ============================================================
// EVENTOS
// ============================================================

function bindEvents() {

  // ----------------------------------------------------------
  // ABAS
  // ----------------------------------------------------------

  document
    .querySelectorAll(
      ".tab-btn"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const tab =
              button.dataset.tab;


            if (tab) {

              openTab(
                tab
              );

            }

          }
        );

      }
    );


  // ----------------------------------------------------------
  // IDIOMAS
  // ----------------------------------------------------------

  document
    .querySelectorAll(
      "[data-lang]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const language =
              button.dataset.lang;


            if (language) {

              setLanguage(
                language
              );

            }

          }
        );

      }
    );


  // ----------------------------------------------------------
  // ACESSIBILIDADE
  // ----------------------------------------------------------

  const increase =
    getEl(
      "increaseFont"
    );


  const decrease =
    getEl(
      "decreaseFont"
    );


  const contrast =
    getEl(
      "contrastToggle"
    );


  const theme =
    getEl(
      "themeToggle"
    );


  if (increase) {

    increase.addEventListener(
      "click",
      increaseFontSize
    );

  }


  if (decrease) {

    decrease.addEventListener(
      "click",
      decreaseFontSize
    );

  }


  if (contrast) {

    contrast.addEventListener(
      "click",
      toggleContrast
    );

  }


  if (theme) {

    theme.addEventListener(
      "click",
      toggleTheme
    );

  }


  // ----------------------------------------------------------
  // FILTROS PRINCIPAIS
  // ----------------------------------------------------------

  const applyFilters =
    getEl(
      "applyFilters"
    );


  const resetFilters =
    getEl(
      "resetFilters"
    );


  if (applyFilters) {

    applyFilters.addEventListener(
      "click",
      applyRadarFilters
    );

  }


  if (resetFilters) {

    resetFilters.addEventListener(
      "click",
      resetRadarFilters
    );

  }


  const searchTerm =
    getEl(
      "searchTerm"
    );


  if (searchTerm) {

    searchTerm.addEventListener(
      "keydown",
      event => {

        if (
          event.key ===
          "Enter"
        ) {

          event.preventDefault();

          applyRadarFilters();

        }

      }
    );

  }


  // ----------------------------------------------------------
  // COBERTURA
  // ----------------------------------------------------------

  const coverageFilter =
    getEl(
      "coverageFilter"
    );


  if (coverageFilter) {

    coverageFilter.addEventListener(
      "change",
      () => {

        renderNewsFeed();

      }
    );

  }


  // ----------------------------------------------------------
  // BUSCA INTERNA EM MENÇÕES
  // ----------------------------------------------------------

  const mentionsSearch =
    getEl(
      "mentionsSearch"
    );


  if (mentionsSearch) {

    mentionsSearch.addEventListener(
      "input",
      event => {

        filterMentionsList(
          event.target.value
        );

      }
    );

  }


  // ----------------------------------------------------------
  // REDESENHO DO GRÁFICO
  // ----------------------------------------------------------

  let resizeTimer =
    null;


  window.addEventListener(
    "resize",
    () => {

      window.clearTimeout(
        resizeTimer
      );


      resizeTimer =
        window.setTimeout(
          () => {

            if (liveNews) {

              drawChart();

            }

          },
          120
        );

    }
  );

}


// ============================================================
// RESTAURAÇÃO DAS PREFERÊNCIAS
// ============================================================

function restorePreferences() {

  const savedLanguage =
    localStorage.getItem(
      "fazdireito-lang"
    );


  if (
    savedLanguage &&
    translations[
      savedLanguage
    ]
  ) {

    lang =
      savedLanguage;

  }


  const savedFontSize =
    Number(
      localStorage.getItem(
        "fazdireito-font-size"
      )
    );


  if (
    Number.isFinite(
      savedFontSize
    ) &&
    savedFontSize >= 85 &&
    savedFontSize <= 125
  ) {

    fontSize =
      savedFontSize;

  }


  applyFontSize();


  const savedTheme =
    localStorage.getItem(
      "fazdireito-theme"
    );


  if (
    savedTheme === "dark" ||
    savedTheme === "light"
  ) {

    setTheme(
      savedTheme
    );

  }


  const savedContrast =
    localStorage.getItem(
      "fazdireito-contrast"
    );


  if (
    savedContrast === "1"
  ) {

    document.body
      ?.classList
      .add(
        "high-contrast"
      );

  }

}


// ============================================================
// INICIALIZAÇÃO DA INTERFACE
// ============================================================

function initializeInterface() {

  restorePreferences();

  bindEvents();

  setLanguage(
    lang
  );


  const firstActiveTab =
    document.querySelector(
      ".tab-btn.active"
    );


  const initialTab =
    firstActiveTab
      ?.dataset
      ?.tab ||
    "overview";


  openTab(
    initialTab
  );

}


// ============================================================
// INICIALIZAÇÃO DOS DADOS
// ============================================================

async function initializeRadarData() {

  await checkRadarApi();


  await Promise.allSettled(
    [
      loadRadarSources(),
      loadRadarNews()
    ]
  );

}


// ============================================================
// INICIALIZAÇÃO DO RADAR
// ============================================================

async function initializeRadar() {

  initializeInterface();


  try {

    await initializeRadarData();

  } catch (error) {

    console.error(
      "[Radar] Falha durante a inicialização:",
      error
    );


    renderNewsUnavailable();

  }

}


// ============================================================
// DOM READY
// ============================================================

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initializeRadar,
    {
      once: true
    }
  );

} else {

  initializeRadar();

}
