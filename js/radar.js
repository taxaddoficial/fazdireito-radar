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

    sources: "/api/sources",

    youtube: "/api/youtube",
    coverageMovement: "/api/coverage-movement",
    trendsHistory: "/api/trends/history"

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
let liveCoverageMovement = null;



let filteredNews = [];

let liveVideos = [];

let videoScopeLoaded = null;

let videoLoading = false;





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





function formatNumber(value) {



  return Number(value || 0)

    .toLocaleString("pt-BR");



}





function validDate(value) {



  if (!value) {

    return null;

  }



  const date = new Date(value);



  if (Number.isNaN(date.getTime())) {

    return null;

  }



  return date;



}





function formatDateTime(value) {



  const date = validDate(value);



  if (!date) {

    return "—";

  }



  return date.toLocaleString(

    "pt-BR",

    {

      day: "2-digit",

      month: "2-digit",

      hour: "2-digit",

      minute: "2-digit"

    }

  );



}





function relativeTime(value) {



  const date = validDate(value);



  if (!date) {

    return "";

  }



  const diff =

    Date.now() - date.getTime();



  const minutes =

    Math.max(

      0,

      Math.floor(diff / 60000)

    );





  if (minutes < 1) {

    return "agora";

  }





  if (minutes < 60) {

    return `há ${minutes} min`;

  }





  const hours =

    Math.floor(minutes / 60);





  if (hours < 24) {

    return `há ${hours} h`;

  }





  const days =

    Math.floor(hours / 24);



  return `há ${days} d`;



}





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



    list.innerHTML = `

      <div class="api-row">

        <div>

          <strong>Fontes</strong>

          <span>Nenhuma informação disponível neste momento.</span>

        </div>

        <span class="api-status mock">

          Indisponível

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

                ${presentation.label}

              </span>



            </div>

          `;



        }

      )

      .join("");



}





let lastTSEData = null;

function renderTSEPanel(data) {

  lastTSEData = data;

  const box = getEl("tseOfficialPanel");

  if (!box) return;

  const copy = {

    pt: ["TSE • 2026", "Resultados eleitorais oficiais", "Arquivo oficial de resultados disponível", "Configuração oficial conectada; resultado indisponível nesta consulta", "Consulta oficial temporariamente indisponível", "1º turno • Presidente da República • Fonte: TSE. Resultados eleitorais não representam menções na imprensa.", "Consultar dados oficiais ↗"],

    en: ["TSE • 2026", "Official election results", "Official results file available", "Official source connected; results unavailable for this query", "Official source temporarily unavailable", "First round • President of Brazil • Source: TSE. Election results are not media mentions.", "View official data ↗"],

    es: ["TSE • 2026", "Resultados electorales oficiales", "Archivo oficial de resultados disponible", "Fuente oficial conectada; resultados no disponibles en esta consulta", "Fuente oficial temporalmente no disponible", "Primera vuelta • Presidencia de Brasil • Fuente: TSE. Los resultados no representan menciones en prensa.", "Consultar datos oficiales ↗"]

  }[lang] || [];

  const ok = data && data.status === "ok";

  const available = ok && data.resultStatus === "available";

  const message = copy[available ? 2 : ok ? 3 : 4];

  const official = "https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados";

  const candidate = available ? String(data.resultURL || "") : "";

  const href = /^https:\/\//i.test(candidate) ? candidate : official;

  box.innerHTML = `<div class="panel-head"><div><span class="eyebrow">${escapeHTML(copy[0])}</span><h3>${escapeHTML(copy[1])}</h3></div></div><p class="tse-state">${escapeHTML(message)}</p><p class="tse-caption">${escapeHTML(copy[5])}</p><a class="tse-link" href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer">${escapeHTML(copy[6])}</a>`;

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

            source.id === "rssapp-wh1otab"

              ? "SBT News"

              : source.id === "rssapp-jih9ngi"

                ? "Pleno.News (RSS alternativo)"

                : source.id === "rssapp-cnbc-brasil"

                  ? "CNBC Brasil"

                  : source.name || "Fonte",



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





    // Verificação real das integrações complementares.

    try {

      const tseResponse = await fetch(`${RADAR_API.baseUrl}/api/tse`, { cache:"no-store" });

      const tse = await tseResponse.json();

      window.radarTSE = tse;

      const row = liveSources.find(x => x.id === "electoral-data");

      if (row) { row.status = tse.status === "ok" ? "active" : "unavailable"; row.description = "TSE 2026 • " + (tse.resultStatus === "available" ? "arquivo oficial disponível" : "verificação oficial de configuração"); }

      renderTSEPanel(tse);

    } catch (_) { renderTSEPanel(null); }

    const yt = liveSources.find(x => x.id === "youtube");

    if (yt && yt.status === "configured") yt.status = "active";

    const trends = liveSources.find(x => x.id === "google-trends");

    if (trends) { trends.status = "pending"; trends.description = "Inscrição no programa Alfa enviada; aguardando aprovação do Google."; }



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

    applyRadarFilters();





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

        a.name.localeCompare(b.name)

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

// RENDERIZAÇÃO DOS INDICADORES

// ============================================================



function renderMetrics() {



  if (!liveNews) {

    return;

  }





  const metrics =

    calculateMetrics(

      filteredNews.length

        ? filteredNews

        : liveNews

    );





  const peak =

    calculatePeak(

      filteredNews.length

        ? filteredNews

        : liveNews

    );





  const metricMentions =

    getEl("metricMentions");



  const metricTopics =

    getEl("metricTopics");



  const metricSources =

    getEl("metricSources");



  const metricPeak =

    getEl("metricPeak");





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

    metricPeak.textContent = formatNumber(peak.count);

  }

  const overviewPeriodNow=getEl("overviewPeriod")?.value||"7d";
  if(overviewHistoryCache?.has?.(overviewPeriodNow)) renderOverviewHistory(overviewHistoryCache.get(overviewPeriodNow));

}





// ============================================================

// CARDS DE NOTÍCIA

// ============================================================



function newsHTML(article) {



  const title =

    escapeHTML(

      article.title

    );





  const publisher =

    escapeHTML(

      article.publisher ||

      "Fonte"

    );





  const url =

    escapeHTML(

      article.url || ""

    );





  const time =

    relativeTime(

      article.publishedAt

    );





  const date =

    formatDateTime(

      article.publishedAt

    );





  const label =

    candidateLabel(

      article

    );





  const candidate =

    candidateClass(

      article

    );





  const searchable =

    normalizeText(

      [

        article.title,

        article.subtitle,

        article.publisher,

        article.domain,

        article.category,

        label

      ].join(" ")

    );





  const subtitle =

    article.subtitle

      ? `

        <p>

          ${escapeHTML(article.subtitle)}

        </p>

      `

      : "";





  const titleMarkup =

    article.url

      ? `

        <a

          href="${url}"

          target="_blank"

          rel="noopener noreferrer"

          style="color:inherit;text-decoration:none"

        >

          ${title}

        </a>

      `

      : title;





  return `

    <article

      class="news-item"

      data-title="${escapeHTML(searchable)}"

      data-candidate="${candidate}"

      data-source="${escapeHTML(normalizeText(article.publisher))}"

    >



      <div class="source">



        <span>

          ${publisher}

          •

          ${escapeHTML(time || date)}

        </span>



        <span class="tag">

          ${escapeHTML(label)}

        </span>



      </div>



      <h4>

        ${titleMarkup}

      </h4>



      ${subtitle}



    </article>

  `;



}





// ============================================================

// ÚLTIMAS NOTÍCIAS

// ============================================================



function renderNewsFeed() {



  const newsFeed =

    getEl("newsFeed");



  const mentionsList =

    getEl("mentionsList");





  if (!liveNews) {

    return;

  }





  const items =

    filteredNews.length ||

    hasActiveFilters()

      ? filteredNews

      : liveNews;





  const coverageFilter =

    getEl("coverageFilter")

      ?.value ||

    "flavio";





  const coverageItems =

    items.filter(

      article => {



        if (

          coverageFilter ===

          "lula"

        ) {



          return Boolean(

            article.mentions?.lula &&

            !article.mentions?.flavio

          );



        }





        if (

          coverageFilter ===

          "both"

        ) {



          return Boolean(

            article.mentions

              ?.flavio ||

            article.mentions

              ?.lula

          );



        }





        return Boolean(

          article.mentions?.flavio &&

          !article.mentions?.lula

        );



      }

    );





  if (newsFeed) {



    if (

      !coverageItems.length

    ) {



      newsFeed.innerHTML = `

        <article class="news-item">

          <h4>

            Nenhuma publicação encontrada

          </h4>

          <p>

            Não há resultados para os filtros selecionados.

          </p>

        </article>

      `;



    } else {



      newsFeed.innerHTML =

        coverageItems

          .slice(0, 6)

          .map(newsHTML)

          .join("");



    }



  }





  if (mentionsList) {



    const scopeValue = getEl("scope")?.value || "flavio";

    const mentionScopeItems = items.filter(article =>

      scopeValue === "flavio" ? Boolean(article.mentions?.flavio) :

      scopeValue === "lula" ? Boolean(article.mentions?.lula) :

      scopeValue === "both" ? Boolean(article.mentions?.flavio && article.mentions?.lula) : true

    );

    const mentionItems =

      getMentionItems(mentionScopeItems);





    if (!mentionItems.length) {



      mentionsList.innerHTML = `

        <article class="news-item">

          <h4>

            Nenhuma publicação encontrada

          </h4>

          <p>

            Ajuste os filtros para ampliar a consulta.

          </p>

        </article>

      `;



    } else {



      mentionsList.innerHTML =

        mentionItems

          .map(newsHTML)

          .join("");



    }



  }



}

// ============================================================

// RANKING DESCRITIVO DE VEÍCULOS

// ============================================================



function renderPublisherRanking() {



  const container =

    getEl("hotTopics");





  if (

    !container ||

    !liveNews

  ) {

    return;

  }





  const articles =

    filteredNews.length ||

    hasActiveFilters()

      ? filteredNews

      : liveNews;





  const ranking =

    publisherRanking(

      articles

    )

      .slice(

        0,

        5

      );





  if (!ranking.length) {



    container.innerHTML = `

      <div class="rank-row">

        <div>

          <div class="rank-name">

            Sem dados

          </div>

          <div class="rank-meta">

            Nenhum veículo encontrado para os filtros atuais.

          </div>

        </div>

      </div>

    `;



    return;



  }





  container.innerHTML =

    ranking

      .map(

        (item, index) => {



          const share =

            articles.length

              ? item.count /

                articles.length *

                100

              : 0;





          return `

            <div class="rank-row">



              <span class="rank-no">

                ${index + 1}

              </span>



              <div>



                <div class="rank-name">

                  ${escapeHTML(item.name)}

                </div>



                <div class="rank-meta">

                  ${formatNumber(item.count)}

                  ${

                    item.count === 1

                      ? "publicação"

                      : "publicações"

                  }

                  no corpus

                </div>



              </div>



              <span class="rank-score">

                ${share.toFixed(1)}%

              </span>



            </div>

          `;



        }

      )

      .join("");



}





// ============================================================

// PALAVRAS FREQUENTES

// ============================================================



function renderTrendsHistoryContext(){
  const label=getEl("trendsPeriodLabel");
  const status=getEl("trendsHistoryStatus");
  if(!label)return;
  const p=getEl("period")?.value||"24h";
  const labels={"24h":"Últimas 24 horas","48h":"Últimas 48 horas","7d":"7 dias","15d":"15 dias","30d":"30 dias","election":"Início das eleições"};
  label.textContent=labels[p]||labels["24h"];
  if(status)status.textContent="Histórico preparado · ativação no snapshot inicial";
}

function renderKeywords() {

  renderTrendsHistoryContext();



  const keywordBars =

    getEl("keywordBars");



  const wordCloud =

    getEl("wordCloud");





  if (

    !liveNews ||

    (

      !keywordBars &&

      !wordCloud

    )

  ) {

    return;

  }





  const articles =

    filteredNews.length ||

    hasActiveFilters()

      ? filteredNews

      : liveNews;





  const keywords =

    extractKeywords(

      articles,

      12

    );





  const cloudKeywords =

    extractKeywords(

      articles,

      20

    );





  const max =

    keywords[0]?.count ||

    1;





  const cloudMax =

    cloudKeywords[0]?.count ||

    1;





  if (keywordBars) {



    keywordBars.innerHTML =

      keywords.length

        ? keywords

          .map(

            item => {



              const width =

                item.count /

                max *

                100;





              return `

                <div class="keyword-row">



                  <strong>

                    ${escapeHTML(item.word)}

                  </strong>



                  <div class="keyword-track">

                    <i style="width:${width}%"></i>

                  </div>



                  <span>

                    ${formatNumber(item.count)}

                  </span>



                </div>

              `;



            }

          )

          .join("")

        : `

          <p>

            ${escapeHTML((translations[lang] || translations.pt).keywords_empty)}

          </p>

        `;



  }





  if (wordCloud) {



    wordCloud.innerHTML =

      cloudKeywords.length

        ? cloudKeywords

          .map(

            item => {



              const weight =

                item.count /

                cloudMax;





              const size =

                0.8 +

                weight *

                0.9;





              return `

                <button

                  class="word"

                  data-theme="${escapeHTML(item.word)}"

                  style="font-size:${size}rem"

                  type="button"

                >

                  ${escapeHTML(item.word)}

                </button>

              `;



            }

          )

          .join("")

        : `

          <span>

            ${escapeHTML((translations[lang] || translations.pt).cloud_empty)}

          </span>

        `;



  }



}





// ============================================================

// CARDS DE DISTRIBUIÇÃO DA COBERTURA

// ============================================================



function renderCoverageCards() {



  const container =

    getEl("themeCards");





  if (

    !container ||

    !liveNews

  ) {

    return;

  }





  const articles =

    filteredNews.length ||

    hasActiveFilters()

      ? filteredNews

      : liveNews;





  const metrics =

    calculateMetrics(

      articles

    );





  const selectedPeriod =

    getEl("period")

      ?.value ||

    "24h";





  const periodHours = radarPeriodHours(selectedPeriod);





  const texts = translations[lang] || translations.pt;





  const periodLabel =

    `${periodHours} ${texts.hours_label}`;





  const cards = [



    {

      name:

        "Flávio Bolsonaro",



      count:

        metrics.flavio,



      share:

        metrics.flavioShare,



      description:

        texts.theme_flavio_desc.replace("{hours}", periodHours)

    },



    {

      name:

        "Lula",



      count:

        metrics.lula,



      share:

        metrics.lulaShare,



      description:

        texts.theme_lula_desc.replace("{hours}", periodHours)

    },



    {

      name:

        texts.theme_both_name,



      count:

        metrics.both,



      share:

        metrics.bothShare,



      description:

        texts.theme_both_desc.replace("{hours}", periodHours)

    },



  ];;





  container.innerHTML =

    cards

      .map(

        card => `

          <button

            class="theme-card"

            data-theme="${escapeHTML(card.name)}"

            type="button"

          >



            <div class="theme-top">



              <div>



                <h4>

                  ${escapeHTML(card.name)}

                </h4>



                <small>

                  ${escapeHTML(card.description)}

                </small>



              </div>



              <span class="attention stable">

                ${escapeHTML(periodLabel)}

              </span>



            </div>



            <div

              style="

                display:flex;

                justify-content:space-between;

                align-items:end;

                margin-top:.8rem

              "

            >



              <strong>

                ${formatNumber(card.count)}

              </strong>



              <span>

                ${card.share.toFixed(1)}%

              </span>



            </div>



            <div class="mini-track">

              <i

                style="

                  width:${Math.min(

                    100,

                    Math.max(

                      0,

                      card.share

                    )

                  )}%

                "

              ></i>

            </div>



          </button>

        `

      )

      .join("");



}







// ============================================================
// MOVIMENTO DA COBERTURA — cálculo consolidado no Worker/D1
// ============================================================
async function loadCoverageMovement(){
  try{
    const data=await radarApiFetch(RADAR_API.endpoints.coverageMovement);
    liveCoverageMovement=(data&&data.status==="ok"&&Array.isArray(data.items))?data:null;
  }catch(error){
    console.warn("[Radar] Movimento da cobertura indisponível; usando fallback local.",error?.message||error);
    liveCoverageMovement=null;
  }
}

// ============================================================

// ASSUNTOS EMERGENTES — 24H ATUAIS × 24H ANTERIORES

// ============================================================



function renderEmergingTopics() {



  const container =

    getEl("emergingTopics");



  if (!container || !liveNews) {

    return;

  }



  const articles =

    filteredNews.length || hasActiveFilters()

      ? filteredNews

      : liveNews;



  const texts = translations[lang] || translations.pt;

  if (liveCoverageMovement && Array.isArray(liveCoverageMovement.items) && liveCoverageMovement.items.length) {
    const items=liveCoverageMovement.items.slice(0,8);
    const maxScore=Math.max(...items.map(item=>Number(item.score||item.delta||item.current||1)),1);
    container.innerHTML=items.map((item,index)=>{
      const score=Number(item.score||item.delta||item.current||1);
      const width=Math.max(12,(score/maxScore)*100);
      const variation=item.previous===0?texts.emerging_new:(Number.isFinite(Number(item.growth_pct))?`${Number(item.growth_pct)>=0?"+":""}${Number(item.growth_pct).toFixed(0)}%`:"—");
      return `<article class="emerging-item"><span class="emerging-rank">${index+1}</span><div class="emerging-content"><div class="emerging-heading"><strong>${escapeHTML(item.term)}</strong><span class="emerging-growth">${escapeHTML(variation)}</span></div><div class="emerging-track"><i style="width:${width}%"></i></div><small>${escapeHTML(texts.emerging_counts.replace("{current}",formatNumber(item.current)).replace("{previous}",formatNumber(item.previous)))}</small></div></article>`;
    }).join("");
    return;
  }



  const now = Date.now();

  const hour = 60 * 60 * 1000;

  const currentStart = now - (24 * hour);

  const previousStart = now - (48 * hour);



  const current = [];

  const previous = [];



  articles.forEach(article => {

    const date = validDate(article.publishedAt);

    if (!date) return;

    const time = date.getTime();

    if (time >= currentStart && time <= now) current.push(article);

    else if (time >= previousStart && time < currentStart) previous.push(article);

  });



  if (!current.length || !previous.length) {
    const fallbackPool=current.length?current:articles;
    const fallback=extractKeywords(fallbackPool,8).filter(x=>x.count>0);
    if(fallback.length){const max=Math.max(...fallback.map(x=>x.count),1);container.innerHTML=fallback.map((item,index)=>`<article class="emerging-item"><span class="emerging-rank">${index+1}</span><div class="emerging-content"><div class="emerging-heading"><strong>${escapeHTML(item.word)}</strong><span class="emerging-growth">${formatNumber(item.count)}</span></div><div class="emerging-track"><i style="width:${Math.max(12,item.count/max*100)}%"></i></div><small>Presença no histórico disponível · comparação temporal indisponível neste momento</small></div></article>`).join('');return;}
    container.innerHTML=`<div class="emerging-empty"><strong>${escapeHTML(texts.emerging_insufficient_title)}</strong><span>${escapeHTML(texts.emerging_insufficient_desc)}</span></div>`;return;
  }



  const currentTerms = extractKeywords(current, 40);

  const previousTerms = new Map(

    extractKeywords(previous, 80).map(item => [item.word, item.count])

  );



  const emerging = currentTerms

    .map(item => {

      const before = previousTerms.get(item.word) || 0;

      const delta = item.count - before;

      const growth = before > 0 ? (delta / before) * 100 : null;

      return { ...item, before, delta, growth };

    })

    .filter(item => item.count >= 2 && item.delta > 0)

    .sort((a, b) => b.delta - a.delta || b.count - a.count)

    .slice(0, 8);



  if (!emerging.length) {

    container.innerHTML = `

      <div class="emerging-empty">

        <strong>${escapeHTML(texts.emerging_none_title)}</strong>

        <span>${escapeHTML(texts.emerging_none_desc)}</span>

      </div>

    `;

    return;

  }



  const maxDelta = Math.max(...emerging.map(item => item.delta), 1);



  container.innerHTML = emerging.map((item, index) => {

    const width = Math.max(12, (item.delta / maxDelta) * 100);

    const variation = item.before === 0

      ? texts.emerging_new

      : `+${item.growth.toFixed(0)}%`;



    return `

      <article class="emerging-item">

        <span class="emerging-rank">${index + 1}</span>

        <div class="emerging-content">

          <div class="emerging-heading">

            <strong>${escapeHTML(item.word)}</strong>

            <span class="emerging-growth">${escapeHTML(variation)}</span>

          </div>

          <div class="emerging-track"><i style="width:${width}%"></i></div>

          <small>${escapeHTML(texts.emerging_counts.replace("{current}", formatNumber(item.count)).replace("{previous}", formatNumber(item.before)))}</small>

        </div>

      </article>

    `;

  }).join("");

}



// ============================================================

// PICO DE PUBLICAÇÕES

// ============================================================



function renderSpikes() {



  const container =

    getEl("spikeTimeline");





  if (

    !container ||

    !liveNews

  ) {

    return;

  }





  const articles =

    filteredNews.length ||

    hasActiveFilters()

      ? filteredNews

      : liveNews;





  const timeline =

    buildTimeline(

      articles,

      1

    )

      .filter(

        bucket =>

          bucket.total > 0

      )

      .sort(

        (a, b) =>

          b.total - a.total

      )

      .slice(

        0,

        4

      );





  if (!timeline.length) {



    container.innerHTML = `

      <div class="spike">

        <strong>

          Sem picos identificáveis

        </strong>

      </div>

    `;



    return;



  }





  container.innerHTML =

    timeline

      .map(

        bucket => {



          const date =

            new Date(

              bucket.start

            );





          const time =

            date.toLocaleString(

              "pt-BR",

              {

                day: "2-digit",

                month: "2-digit",

                hour: "2-digit",

                minute: "2-digit"

              }

            );





          return `

            <div class="spike">



              <time>

                ${escapeHTML(time)}

              </time>



              <strong>

                ${formatNumber(bucket.total)}

                ${

                  bucket.total === 1

                    ? "publicação"

                    : "publicações"

                }

              </strong>



              <span>

                Flávio ${bucket.flavio}

                •

                Lula ${bucket.lula}

              </span>



            </div>

          `;



        }

      )

      .join("");



}





// ============================================================

// RADAR VISUAL

// ============================================================



function renderRadar() {



  const box =

    getEl("radarVisual");





  if (!box) {

    return;

  }





  const texts =

    translations[lang] ||

    translations.pt;





  if (!liveNews) {



    box.innerHTML = `

      <div class="monitoring-loading">



        <strong>

          ${escapeHTML(texts.panorama_waiting)}

        </strong>



        <span>

          ${escapeHTML(texts.panorama_waiting_desc)}

        </span>



      </div>

    `;



    return;



  }





  const data =

    filteredNews.length ||

    hasActiveFilters()

      ? filteredNews

      : liveNews;





  const metrics =

    calculateMetrics(data);





  const windowHours =

    liveNewsMeta?.windowHours || 48;





  const items = [



    {

      label:

        texts.panorama_flavio,



      value:

        metrics.flavio,



      description:

        texts.panorama_reference

    },



    {

      label:

        texts.panorama_lula,



      value:

        metrics.lula,



      description:

        texts.panorama_reference

    },



    {

      label:

        texts.panorama_both,



      value:

        metrics.both,



      description:

        texts.panorama_both_desc

    },



    {

      label:

        texts.panorama_publishers,



      value:

        metrics.publishers,



      description:

        texts.panorama_publishers_desc

    },



    {

      label:

        texts.panorama_articles,



      value:

        metrics.total,



      description:

        texts.panorama_articles_desc

    },



    {

      label:

        texts.panorama_period,



      value:

        `${windowHours}h`,



      description:

        texts.panorama_period_desc

    }



  ];





  box.innerHTML = `

    <div class="monitoring-panorama">



      ${items

        .map(

          (item) => `

            <div class="monitoring-item">



              <span class="monitoring-label">

                ${escapeHTML(item.label)}

              </span>



              <strong class="monitoring-value">

                ${escapeHTML(String(item.value))}

              </strong>



              <small class="monitoring-description">

                ${escapeHTML(item.description)}

              </small>



            </div>

          `

        )

        .join("")}



    </div>



    <p class="monitoring-note">

      ${escapeHTML(texts.panorama_note)}

    </p>

  `;



}

// ============================================================

// GRÁFICO REAL DE EVOLUÇÃO

// ============================================================



function drawChart() {



  const canvas =

    getEl("volumeChart");





  if (!canvas) {

    return;

  }





  const rect =

    canvas.getBoundingClientRect();





  if (

    !rect.width ||

    !rect.height

  ) {

    return;

  }





  const dpr =

    window.devicePixelRatio ||

    1;





  canvas.width =

    Math.round(

      rect.width *

      dpr

    );





  canvas.height =

    Math.round(

      rect.height *

      dpr

    );





  const ctx =

    canvas.getContext("2d");





  ctx.setTransform(

    dpr,

    0,

    0,

    dpr,

    0,

    0

  );





  const width =

    rect.width;



  const height =

    rect.height;



  const padding =

    28;





  ctx.clearRect(

    0,

    0,

    width,

    height

  );





  ctx.strokeStyle =

    "#e2e8f0";



  ctx.lineWidth =

    1;





  for (

    let index = 0;

    index < 5;

    index++

  ) {



    const y =

      padding +

      (

        height -

        padding * 2

      ) *

      index /

      4;





    ctx.beginPath();



    ctx.moveTo(

      padding,

      y

    );



    ctx.lineTo(

      width - padding,

      y

    );



    ctx.stroke();



  }





  if (!liveNews) {



    ctx.fillStyle =

      "#64748b";



    ctx.font =

      "13px sans-serif";



    ctx.textAlign =

      "center";





    ctx.fillText(

      "Aguardando dados reais da API",

      width / 2,

      height / 2

    );





    return;



  }





  const articles =

    filteredNews.length ||

    hasActiveFilters()

      ? filteredNews

      : liveNews;





  const timeline =

    buildTimeline(

      articles,

      4

    );





  if (!timeline.length) {



    ctx.fillStyle =

      "#64748b";



    ctx.font =

      "13px sans-serif";



    ctx.textAlign =

      "center";





    ctx.fillText(

      "Sem dados temporais suficientes",

      width / 2,

      height / 2

    );





    return;



  }





  const flavio =

    timeline.map(

      bucket =>

        bucket.flavio

    );





  const lula =

    timeline.map(

      bucket =>

        bucket.lula

    );





  const maxValue =

    Math.max(

      1,

      ...flavio,

      ...lula

    );





  const series = [



    {

      values:

        flavio,



      color:

        "#154b8b"

    },



    {

      values:

        lula,



      color:

        "#fdb813"

    }



  ];





  series.forEach(

    seriesItem => {



      ctx.strokeStyle =

        seriesItem.color;



      ctx.lineWidth =

        3;



      ctx.beginPath();





      seriesItem.values.forEach(

        (value, index) => {



          const denominator =

            Math.max(

              1,

              seriesItem.values.length - 1

            );





          const px =

            padding +

            (

              width -

              padding * 2

            ) *

            index /

            denominator;





          const py =

            height -

            padding -

            (

              height -

              padding * 2

            ) *

            value /

            maxValue;





          if (index === 0) {



            ctx.moveTo(

              px,

              py

            );



          } else {



            ctx.lineTo(

              px,

              py

            );



          }



        }

      );





      ctx.stroke();



    }

  );



}





// ============================================================

// FILTRO DE FONTES

// ============================================================



function renderSourceFilter() {



  const select =

    getEl("source");





  if (

    !select ||

    !liveNews

  ) {

    return;

  }





  const current =

    select.value;





  const publishers =

    [...new Set(

      liveNews

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

            "pt-BR"

          )

      );





  select.innerHTML =

    `

      <option value="all">

        Todas

      </option>

    ` +



    publishers

      .map(

        publisher => `

          <option value="${escapeHTML(normalizeText(publisher))}">

            ${escapeHTML(publisher)}

          </option>

        `

      )

      .join("");





  const stillExists =

    [...select.options]

      .some(

        option =>

          option.value === current

      );





  select.value =

    stillExists

      ? current

      : "all";



}





// ============================================================

// FILTROS

// ============================================================



// V1.6.1 — período temporal global do Radar.
const RADAR_ELECTION_START = new Date("2026-08-16T00:00:00-03:00").getTime();
function radarPeriodHours(period) { return ({"24h":24,"48h":48,"7d":168,"15d":360,"30d":720})[period] || 24; }
function radarPeriodStart(period) { return period === "election" ? RADAR_ELECTION_START : Date.now() - radarPeriodHours(period) * 3600000; }
function syncOverviewPeriodFromGlobal(force=false) {
  const globalPeriod=getEl("period")?.value||"24h", overviewPeriod=getEl("overviewPeriod"), label=getEl("overviewPeriodLabel");
  if(overviewPeriod) overviewPeriod.value=globalPeriod;
  if(label){const lang=document.documentElement.lang||"pt", texts=translations[lang]||translations.pt, key=globalPeriod==="election"?"period_election":`period_${globalPeriod}`; label.textContent=texts?.[key]||globalPeriod;}
  if(typeof loadOverviewHistory==="function") loadOverviewHistory(force);
}

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

    "24h";





  return (

    Boolean(search) ||

    source !== "all" ||

    scope !== "all" ||

    period !== "24h"

  );



}





function applyRadarFilters() {



  if (!liveNews) {

    return;

  }





  const query =

    normalizeText(

      getEl("searchTerm")

        ?.value

        ?.trim() ||

      ""

    );





  const source =

    normalizeText(

      getEl("source")

        ?.value ||

      "all"

    );





  const scope =

    normalizeText(

      getEl("scope")

        ?.value ||

      "all"

    );





  const period =

    getEl("period")

      ?.value ||

    "24h";





  const periodHours = radarPeriodHours(period);

  const periodStart = radarPeriodStart(period);





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

              candidateLabel(article)

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





function renderFilteredData() {



  renderMetrics();



  renderDisinfo();



  renderNewsFeed();



  renderPublisherRanking();



  renderCoverageCards();



  renderEmergingTopics();



  renderKeywords();



  renderSpikes();



  renderRadar();



  drawChart();



  loadYouTubeVideos();



}





// DESINFORMAÇÃO — detecção exploratória, sem veredito automático.

// Trabalha com o corpus integral recebido da API; os controles desta aba são independentes.

const DISINFO_TERMS = /(?:\b(?:checag(?:em|ens)|checar|verific(?:acao|acoes|ar|ado|ada)|desmentid[oa]s?|fake[ -]?news|noticias? falsas?|boatos?|desinformacao|fora de contexto|enganos[oa]s?|deepfake|fact[ -]?check(?:ing)?|manipulad[oa]s?|informacao falsa|conteudo falso|mentira eleitoral|mentiras eleitorais|fraude eleitoral|rumor(?:es)?|alegacao falsa)\b)/i;

const DISINFO_CHECK = /\b(?:checag(?:em|ens)|checar|verific(?:acao|acoes|ar|ado|ada)|desmentid[oa]s?|fact[ -]?check(?:ing)?|fato ou boato|aos fatos|agencia lupa|fato ou fake|estadao verifica|uol confere)\b/i;

function disinfoPublisher(article) {

  const id = String(article.feedSourceId || "").toLowerCase();

  const names = {"rssapp-wh1otab":"SBT News", "rssapp-jih9ngi":"Pleno.News", "rssapp-cnbc-brasil":"CNBC Brasil", "infomoney":"InfoMoney"};

  if (names[id]) return names[id];

  const publisher = String(article.publisher || article.source || article.sourceName || "").trim();

  if (/^rss\.app(?:\s*\(.*\))?$/i.test(publisher)) {

    const feed = String(article.feedSource || "").toLowerCase();

    if (feed.includes("wh1otab")) return "SBT News";

    if (feed.includes("jih9ngi")) return "Pleno.News";

    if (feed.includes("h5s7xd")) return "CNBC Brasil";

    return "Fonte agregada (origem não identificada)";

  }

  return publisher || "Fonte não informada";

}

let disinfoPage=1; const DISINFO_PAGE_SIZE=12;
function renderDisinfo(){

 const stats=getEl('disinfoStats'), list=getEl('disinfoList'); if(!stats||!list)return;

 const texts={

  pt:['Publicações relacionadas','Notícias sobre checagens','Alegações e alertas','Fontes distintas','Nenhuma publicação sobre checagens ou alegações encontrada neste recorte. Isso não significa ausência de desinformação.','Ler publicação ↗','Aguardando notícias da API.','Nenhuma notícia disponível no corpus atual.','O filtro selecionado não encontrou registros. Experimente “Todas as pessoas” ou ampliar o período.','Registros encontrados no corpus de notícias; correspondência por termos, sem verificação automática.'],

  en:['Related publications','Fact-check coverage','Claims and alerts','Distinct sources','No related coverage found for this selection. This does not imply an absence of misinformation.','Read publication ↗','Waiting for news API.','No news available in the current dataset.','No matching records. Try “All people” or a longer period.','Keyword-based coverage, not automated fact verification.'],

  es:['Publicaciones relacionadas','Noticias sobre verificaciones','Alegaciones y alertas','Fuentes distintas','No se encontró cobertura relacionada en esta selección. Esto no implica ausencia de desinformación.','Leer publicación ↗','Esperando noticias de la API.','No hay noticias en el conjunto actual.','No hay registros para estos filtros. Pruebe “Todas las personas” o amplíe el período.','Cobertura basada en palabras clave, sin verificación automática.']

 }[lang]||[];

 const ui={pt:{scope:["Pessoa mencionada","Todas as pessoas","Flávio Bolsonaro","Lula","Ambos na mesma matéria"],type:["Todos os registros","Notícias sobre checagens","Alegações e alertas"],sort:["Mais recentes","Por fonte"],search:"Pesquisar título, fonte ou assunto"},en:{scope:["Person mentioned","All people","Flávio Bolsonaro","Lula","Both in the same article"],type:["All records","Fact-check coverage","Claims and alerts"],sort:["Most recent","By source"],search:"Search title, source or topic"},es:{scope:["Persona mencionada","Todas las personas","Flávio Bolsonaro","Lula","Ambos en la misma noticia"],type:["Todos los registros","Noticias sobre verificaciones","Alegaciones y alertas"],sort:["Más recientes","Por fuente"],search:"Buscar título, fuente o tema"}}[lang]||{};

 const scopeEl=getEl('disinfoScope'), typeEl=getEl('disinfoType'), sortEl=getEl('disinfoSort'), searchEl=getEl('disinfoSearch');

 if(scopeEl){scopeEl.previousElementSibling.textContent=ui.scope[0]; [...scopeEl.options].forEach((o,i)=>o.textContent=ui.scope[i+1]);}


 if(typeEl)[...typeEl.options].forEach((o,i)=>o.textContent=ui.type[i]);

 if(sortEl)[...sortEl.options].forEach((o,i)=>o.textContent=ui.sort[i]);

 if(searchEl){searchEl.placeholder=ui.search;searchEl.setAttribute('aria-label',ui.search);}

 const all=Array.isArray(liveNews)?liveNews:[];

 const scope=getEl('disinfoScope')?.value||'all';

 const globalPeriod=getEl('period')?.value||'24h';
 const electionStart=Date.parse('2026-08-16T03:00:00.000Z');
 const hours=radarPeriodHours(globalPeriod);
 const since=globalPeriod==='election'?electionStart:Date.now()-hours*3600000;

 const base=all.filter(a=>{

  const m=a.mentions||{};

  const matches=scope==='all'||(scope==='flavio'&&m.flavio)||(scope==='lula'&&m.lula)||(scope==='both'&&m.flavio&&m.lula);

  const date=validDate(a.publishedAt);

  return matches&&date&&date.getTime()>=since;

 });

 const relevant=base.map(a=>{

  const body=normalizeText([a.title,a.subtitle,a.description].filter(Boolean).join(' '));

  return {...a,_disinfoType:DISINFO_CHECK.test(body)?'checks':'claims',_disinfoBody:body};

 }).filter(a=>DISINFO_TERMS.test(a._disinfoBody));

 const checks=relevant.filter(a=>a._disinfoType==='checks').length;
 const distinct=new Set(relevant.map(disinfoPublisher).filter(Boolean)).size;
 stats.innerHTML=[[texts[0],relevant.length,'all'],[texts[1],checks,'checks'],[texts[2],relevant.length-checks,'claims'],[texts[3],distinct,null]].map(([name,num,type])=>`<div class="disinfo-stat" ${type?`role="button" tabindex="0" data-disinfo-type="${type}" aria-label="${escapeHTML(name)}: ${num}"`:''}><span>${escapeHTML(name)}</span><strong>${formatNumber(num)}</strong><small>período global</small></div>`).join('');

 const q=normalizeText(getEl('disinfoSearch')?.value||'');const type=getEl('disinfoType')?.value||'all';const sort=getEl('disinfoSort')?.value||'recent';

 const selected=relevant.filter(a=>(type==='all'||a._disinfoType===type)&&(!q||normalizeText([a.title,disinfoPublisher(a),a.publisher,a.source,a.sourceName,a.subtitle,a.description].join(' ')).includes(q)));

 selected.sort((a,b)=>sort==='source'?disinfoPublisher(a).localeCompare(disinfoPublisher(b),'pt-BR'):(new Date(b.publishedAt||0)-new Date(a.publishedAt||0)));

 const hint=getEl('disinfoDiagnostics');if(hint)hint.textContent=liveNews===null?texts[6]:!all.length?texts[7]:`${all.length} notícias recebidas · ${base.length} no recorte · ${relevant.length} relacionadas. ${texts[9]}`;

 const empty=liveNews===null?texts[6]:!all.length?texts[7]:!base.length?texts[8]:texts[4];

 const totalPages=Math.max(1,Math.ceil(selected.length/DISINFO_PAGE_SIZE));disinfoPage=Math.min(disinfoPage,totalPages);const pageStart=(disinfoPage-1)*DISINFO_PAGE_SIZE;const selectedPage=selected.slice(pageStart,pageStart+DISINFO_PAGE_SIZE);
 list.innerHTML=selectedPage.length?selectedPage.map(a=>{

  const label=a._disinfoType==='checks'?texts[1]:texts[2];const name=disinfoPublisher(a);const url=String(a.url||a.link||'');const safe=/^https?:\/\//i.test(url)?escapeHTML(url):'';

  const excerpt=String(a.subtitle||a.description||'').trim();

  return `<article class="disinfo-item"><div class="disinfo-meta"><span>${escapeHTML(name)} · ${escapeHTML(formatDateTime(a.publishedAt))}</span><span class="disinfo-badge">${escapeHTML(label)}</span></div><h4>${escapeHTML(a.title||'Sem título')}</h4>${excerpt?`<p>${escapeHTML(excerpt.slice(0,230))}</p>`:''}${safe?`<a href="${safe}" target="_blank" rel="noopener noreferrer">${escapeHTML(texts[5])}</a>`:''}</article>`;

 }).join(''):`<p class="disinfo-empty">${escapeHTML(empty)}</p>`;
 const pag=getEl('disinfoPagination');if(pag){const pages=Math.max(1,Math.ceil(selected.length/DISINFO_PAGE_SIZE));let nums=[];for(let i=Math.max(1,disinfoPage-2);i<=Math.min(pages,disinfoPage+2);i++)nums.push(i);pag.innerHTML=selected.length>DISINFO_PAGE_SIZE?`<button ${disinfoPage===1?'disabled':''} data-dispage="${disinfoPage-1}">${apoioT('previous')}</button>${nums.map(i=>`<button class="${i===disinfoPage?'active':''}" data-dispage="${i}">${i}</button>`).join('')}<button ${disinfoPage===pages?'disabled':''} data-dispage="${disinfoPage+1}">${apoioT('next')}</button>`:'';pag.querySelectorAll('button[data-dispage]').forEach(b=>b.addEventListener('click',()=>{disinfoPage=Number(b.dataset.dispage)||1;renderDisinfo();document.getElementById('disinfoList')?.scrollIntoView({behavior:'smooth',block:'start'});}));}
}

['disinfoSearch','disinfoType','disinfoSort','disinfoScope','period'].forEach(id=>document.addEventListener('input',e=>{if(e.target?.id===id)renderDisinfo()}));

document.addEventListener('click',e=>{const item=e.target.closest('[data-disinfo-type]');if(!item)return;const select=getEl('disinfoType');if(select){select.value=item.dataset.disinfoType;renderDisinfo()}});

document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-disinfo-type]')){e.preventDefault();e.target.click()}});



// V1.6.6 — Desinformação segue o período global; sem segundo seletor temporal.
const DISINFO_PERIOD_LABELS={
 pt:{'24h':'Últimas 24 horas','48h':'Últimas 48 horas','7d':'7 dias','15d':'15 dias','30d':'30 dias','election':'Início das eleições'},
 en:{'24h':'Last 24 hours','48h':'Last 48 hours','7d':'7 days','15d':'15 days','30d':'30 days','election':'Start of the election period'},
 es:{'24h':'Últimas 24 horas','48h':'Últimas 48 horas','7d':'7 días','15d':'15 días','30d':'30 días','election':'Inicio de las elecciones'}
};
function syncDisinfoPeriodUI(){
 const p=getEl('period')?.value||'24h'; const lg=(document.documentElement.lang||'pt').slice(0,2);
 const label=getEl('disinfoPeriodLabel'); if(label)label.textContent=(DISINFO_PERIOD_LABELS[lg]||DISINFO_PERIOD_LABELS.pt)[p]||p;
 const status=getEl('disinfoHistoryStatus'); if(status)status.textContent=lg==='en'?'History prepared · activation at the initial snapshot':lg==='es'?'Histórico preparado · activación en el snapshot inicial':'Histórico preparado · ativação no snapshot inicial';
}
document.addEventListener('change',e=>{if(e.target?.id==='period'){syncDisinfoPeriodUI();renderDisinfo();}});
document.addEventListener('click',e=>{if(e.target?.closest?.('[data-lang]'))setTimeout(syncDisinfoPeriodUI,0);});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',syncDisinfoPeriodUI,{once:true});else syncDisinfoPeriodUI();

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

    period.value = "24h";

  }





  if (scope) {

    scope.value = "flavio";

  }





  if (source) {

    source.value = "all";

  }





  if (region) {

    region.value = "BR";

  }





  if (searchTerm) {

    searchTerm.value = "";

  }





  filteredNews =

    liveNews

      ? [...liveNews]

      : [];





  applyRadarFilters();



}





// ============================================================

// FILTRO INTERNO DA ABA MENÇÕES

// ============================================================



function getMentionItems(items) {



  const query =

    normalizeText(

      getEl("mentionFilter")?.value ||

      ""

    );





  const sort =

    getEl("mentionSort")?.value ||

    "recent";





  const result =

    [...items]

      .filter(

        article => {



          if (!query) {

            return true;

          }





          const searchable =

            normalizeText(

              [

                article.title,

                article.subtitle,

                article.publisher,

                article.domain,

                article.category,

                candidateLabel(article)

              ].join(" ")

            );





          return searchable.includes(query);



        }

      );





  const timeValue =

    article =>

      validDate(article.publishedAt)

        ?.getTime() || 0;





  if (sort === "source") {



    result.sort(

      (a, b) => {



        const bySource =

          String(a.publisher || "")

            .localeCompare(

              String(b.publisher || ""),

              "pt-BR",

              { sensitivity: "base" }

            );





        return bySource ||

          timeValue(b) -

          timeValue(a);



      }

    );



  } else if (sort === "impact") {



    // Relevância descritiva: publicações que mencionam os dois

    // candidatos aparecem primeiro; dentro de cada grupo,

    // prevalece a publicação mais recente. Não é sentimento

    // nem avaliação favorável/desfavorável.

    result.sort(

      (a, b) => {



        const mentionsA =

          Number(Boolean(a.mentions?.flavio)) +

          Number(Boolean(a.mentions?.lula));



        const mentionsB =

          Number(Boolean(b.mentions?.flavio)) +

          Number(Boolean(b.mentions?.lula));





        return (

          mentionsB - mentionsA ||

          timeValue(b) -

          timeValue(a)

        );



      }

    );



  } else {



    result.sort(

      (a, b) =>

        timeValue(b) -

        timeValue(a)

    );



  }





  return result;



}





function filterMentionsList() {



  renderNewsFeed();



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



  renderDisinfo();



  renderNewsFeed();



  renderPublisherRanking();



  renderCoverageCards();



  renderEmergingTopics();



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

    getEl("lastUpdate");





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

      ? formatDateTime(date)

      : new Date()

        .toLocaleTimeString(

          "pt-BR",

          {

            hour: "2-digit",

            minute: "2-digit"

          }

        );



}





// ============================================================

// ESTADOS SEM DADOS

// ============================================================



function renderNewsUnavailable() {



  const message = `

    <article class="news-item">



      <div class="source">

        <span>

          Radar 2026

        </span>



        <span class="tag">

          API

        </span>

      </div>



      <h4>

        Dados temporariamente indisponíveis

      </h4>



      <p>

        O Radar não recebeu uma coleta válida de notícias neste momento.

        Nenhum número demonstrativo foi utilizado como substituição.

      </p>



    </article>

  `;





  const newsFeed =

    getEl("newsFeed");



  const mentionsList =

    getEl("mentionsList");





  if (newsFeed) {

    newsFeed.innerHTML = message;

  }





  if (mentionsList) {

    mentionsList.innerHTML = message;

  }





  [

    "metricMentions",

    "metricTopics",

    "metricSources",

    "metricPeak"

  ]

    .forEach(

      id => {



        const element =

          getEl(id);





        if (element) {

          element.textContent = "—";

        }



      }

    );





  const hotTopics =

    getEl("hotTopics");





  if (hotTopics) {



    hotTopics.innerHTML = `

      <div class="rank-row">

        <div>

          <div class="rank-name">

            Aguardando coleta

          </div>

          <div class="rank-meta">

            Os veículos aparecerão aqui quando /api/news estiver disponível.

          </div>

        </div>

      </div>

    `;



  }





  drawChart();



}





// ============================================================

// VÍDEOS — YOUTUBE DATA API V3

// ============================================================



function decodeVideoText(value = "") {

  const el = document.createElement("textarea");

  el.innerHTML = String(value);

  return el.value;

}



function formatVideoViews(value) {

  const number = Number(value || 0);

  return new Intl.NumberFormat(lang === "pt" ? "pt-BR" : lang === "es" ? "es" : "en", { notation: "compact", maximumFractionDigits: 1 }).format(number);

}



function currentVideoScope() {

  const value = getEl("scope")?.value || "flavio";

  return value === "lula" ? "lula" : value === "flavio" ? "flavio" : "both";

}



function classifyVideoFrame(video) {

  const text = normalizeText(`${decodeVideoText(video.title || "")} ${decodeVideoText(video.description || "")}`);

  const has = words => words.some(word => text.includes(normalizeText(word)));

  const favorable = ["apoia flavio", "apoio a flavio", "defende flavio", "favor de flavio", "vantagem", "cresce", "avanca", "vitoria", "lidera", "otimas para flavio", "vai vencer", "melhorar ainda mais", "fecha com flavio", "declara apoio", "endossa flavio"];

  const critical = ["contra flavio", "critica flavio", "ataca flavio", "derrota de flavio", "perde", "mentiroso", "escandalo", "investig", "denuncia", "rejeicao", "fascis", "mussolini", "destrói flavio", "destrói flávio", "acusa flavio"];

  const right = ["direita", "bolsonaro", "pl ", "jair bolsonaro", "eduardo bolsonaro", "tarcisio", "tarcísio", "nikolas", "cleitinho", "conservador", "campo aliado", "aliado", "apoio no segundo turno"];

  const favScore = favorable.reduce((n,w)=>n+(text.includes(normalizeText(w))?1:0),0);

  const critScore = critical.reduce((n,w)=>n+(text.includes(normalizeText(w))?1:0),0);

  const rightScore = right.reduce((n,w)=>n+(text.includes(normalizeText(w))?1:0),0);

  let frame = "neutral";

  if (favScore > critScore && favScore > 0) frame = "favorable";

  else if (critScore > favScore && critScore > 0) frame = "critical";

  else if (rightScore > 1 || (rightScore > 0 && !text.includes("lula"))) frame = "right";

  return { frame, favScore, critScore, rightScore };

}



function videoFrameLabel(frame) {

  const labels = {

    favorable: "Favorável a Flávio",

    critical: "Crítico a Flávio",

    right: "Direita / campo aliado",

    neutral: "Comparativo / neutro"

  };

  return labels[frame] || labels.neutral;

}



async function loadYouTubeVideos(force = false) {

  const grid = getEl("videoGrid");

  if (!grid || videoLoading) return;

  const scope = currentVideoScope();

  if (!force && videoScopeLoaded === scope && liveVideos.length) { renderYouTubeVideos(); return; }

  videoLoading = true;

  grid.innerHTML = `<article class="video-state">Carregando vídeos do YouTube…</article>`;

  try {

    const globalPeriod = getEl("period")?.value || getEl("periodFilter")?.value || "24h";
    const response = await fetch(`${RADAR_API.baseUrl}${RADAR_API.endpoints.youtube}?scope=${encodeURIComponent(scope)}&period=${encodeURIComponent(globalPeriod)}`, { cache: "no-store" });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    if (data.status !== "ok") throw new Error(data.message || "YouTube indisponível");

    liveVideos = (Array.isArray(data.videos) ? data.videos : []).map(video => ({ ...video, _frame: classifyVideoFrame(video) }));

    videoScopeLoaded = scope;

    renderYouTubeVideos(data);

  } catch (error) {

    console.warn("[Radar API] Não foi possível carregar /api/youtube:", error);

    liveVideos = [];

    grid.innerHTML = `<article class="video-state">Não foi possível carregar os vídeos agora.</article>`;

    const summary = getEl("videoSummary");

    if (summary) summary.textContent = "YouTube Data API v3 temporariamente indisponível.";

  } finally { videoLoading = false; }

}



function renderVideoIndicators(items) {

  const box = getEl("videoIndicators");

  if (!box) return;

  const counts = { favorable:0, critical:0, right:0, neutral:0 };

  items.forEach(v => counts[(v._frame || classifyVideoFrame(v)).frame]++);

  const total = items.length || 1;

  const card = (key,label) => `<button type="button" class="video-indicator" data-video-frame="${key}" aria-label="Filtrar: ${label}"><strong>${counts[key]}</strong><span>${label}</span><small>${Math.round(counts[key]*100/total)}%</small></button>`;

  box.innerHTML = card("favorable","Favorável") + card("critical","Crítico") + card("right","Direita / aliado") + card("neutral","Neutro / comparativo");

  box.querySelectorAll("[data-video-frame]").forEach(btn => btn.onclick = () => { const select=getEl("videoFrame"); if(select){ select.value=btn.dataset.videoFrame; renderYouTubeVideos(); }});

}



function renderYouTubeVideos() {

  const grid = getEl("videoGrid");

  if (!grid) return;

  const query = normalizeText(getEl("videoFilter")?.value?.trim() || "");

  const sort = getEl("videoSort")?.value || "recent";

  const frame = getEl("videoFrame")?.value || "all";

  renderVideoIndicators(liveVideos);

  let items = liveVideos.filter(video => !query || normalizeText(`${decodeVideoText(video.title)} ${decodeVideoText(video.channel || "")}`).includes(query));

  if (frame !== "all") items = items.filter(video => (video._frame || classifyVideoFrame(video)).frame === frame);

  items.sort((a,b) => sort === "views" ? Number(b.views||0)-Number(a.views||0) : new Date(b.publishedAt||0)-new Date(a.publishedAt||0));

  const totalMatches = items.length;

  items = items.slice(0,15);

  const summary = getEl("videoSummary");

  if (summary) {

    const channels = new Set(items.map(item=>item.channel).filter(Boolean)).size;

    const periodValue = getEl("period")?.value || getEl("periodFilter")?.value || "24h";
    const periodLabels = {"24h":"Últimas 24 horas","48h":"Últimas 48 horas","7d":"7 dias","15d":"15 dias","30d":"30 dias","election":"Início das eleições"};
    summary.textContent = `${items.length} de ${totalMatches} vídeo${totalMatches===1?"":"s"} compatíveis • ${channels} canal${channels===1?"":"is"} • período global: ${periodLabels[periodValue] || periodLabels["24h"]}`;

  }

  if (!items.length) { grid.innerHTML=`<article class="video-state">Nenhum vídeo encontrado para os filtros atuais.</article>`; return; }

  grid.innerHTML = items.map(video => {

    const title=decodeVideoText(video.title||"Vídeo no YouTube");

    const channel=decodeVideoText(video.channel||"YouTube");

    const date=validDate(video.publishedAt);

    const dateText=date?date.toLocaleString(lang==="pt"?"pt-BR":lang==="es"?"es":"en",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"";

    const vf=(video._frame||classifyVideoFrame(video)).frame;

    return `<article class="video-card"><a class="video-thumb-link" href="${escapeHTML(video.url||"#")}" target="_blank" rel="noopener noreferrer" aria-label="Assistir: ${escapeHTML(title)}"><img class="video-thumb-img" src="${escapeHTML(video.thumbnail||"")}" alt="" loading="lazy"><span class="video-play" aria-hidden="true">▶</span></a><div class="video-info"><div class="video-meta"><span>${escapeHTML(channel)}</span><span>${escapeHTML(dateText)}</span></div><span class="video-frame-badge video-frame-${vf}">${escapeHTML(videoFrameLabel(vf))}</span><h4><a href="${escapeHTML(video.url||"#")}" target="_blank" rel="noopener noreferrer">${escapeHTML(title)}</a></h4><div class="video-footer"><span>${formatVideoViews(video.views)} visualizações</span><a href="${escapeHTML(video.url||"#")}" target="_blank" rel="noopener noreferrer">Assistir no YouTube ↗</a></div></div></article>`;

  }).join("");

}



function renderVideosPlanned() { loadYouTubeVideos(); }



// ============================================================

// TEXTOS DO ESTADO REAL

// ============================================================



function updateRealDataLabels() {



  if (!liveNews) {

    return;

  }





  const prototype =

    document.querySelector(

      '[data-i18n="prototype"]'

    );





  const notice =

    document.querySelector(

      '[data-i18n="mock_notice"]'

    );





  const heroDesc =

    document.querySelector(

      '[data-i18n="hero_desc"]'

    );





  const chartNote =

    document.querySelector(

      '[data-i18n="demo_chart"]'

    );





  const themesDesc =

    document.querySelector(

      '[data-i18n="themes_desc"]'

    );





  const cloudNote =

    document.querySelector(

      '[data-i18n="cloud_note"]'

    );





  const footer =

    document.querySelector(

      '[data-i18n="footer_desc"]'

    );





  if (prototype) {



    prototype.textContent =

      "RADAR 2026 • DADOS REAIS";



  }





  if (notice) {



    notice.textContent =

      `RSS • ${liveNewsMeta?.windowHours || 48}h`;



  }





  if (heroDesc) {



    heroDesc.textContent =

      "Central de acompanhamento da cobertura pública coletada em fontes RSS monitoradas. Os indicadores desta área são calculados a partir do corpus retornado pela API do Radar.";



  }





  if (chartNote) {



    chartNote.textContent =

      "Evolução calculada a partir dos horários de publicação dos artigos do corpus. As séries representam artigos identificados para cada candidato e podem se sobrepor.";



  }





  if (themesDesc) {



    themesDesc.textContent =

      "Distribuição descritiva das referências identificadas no corpus monitorado. Percentuais representam participação nos artigos coletados, não intenção de voto.";



  }





  if (cloudNote) {



    cloudNote.textContent =

      "O tamanho representa frequência relativa dos termos nos títulos e subtítulos coletados.";



  }





  if (footer) {



    footer.textContent =

      "Radar Eleitoral 2026. Dados de cobertura pública obtidos das fontes indicadas na seção Fontes & APIs.";



  }



}





// ============================================================

// RENDER INICIAL

// ============================================================



function renderInitialState() {



  const lastUpdate =

    getEl("lastUpdate");





  if (lastUpdate) {



    lastUpdate.textContent =

      "Aguardando API";



  }





  const newsFeed =

    getEl("newsFeed");





  if (newsFeed) {



    newsFeed.innerHTML = `

      <article class="news-item">

        <h4>

          Carregando cobertura...

        </h4>

        <p>

          Consultando o cache do Radar.

        </p>

      </article>

    `;



  }





  const mentionsList =

    getEl("mentionsList");





  if (mentionsList) {



    mentionsList.innerHTML = `

      <article class="news-item">

        <h4>

          Carregando publicações...

        </h4>

      </article>

    `;



  }





  const hotTopics =

    getEl("hotTopics");





  if (hotTopics) {



    hotTopics.innerHTML = `

      <div class="rank-row">

        <div>

          <div class="rank-name">

            Carregando fontes...

          </div>

        </div>

      </div>

    `;



  }





  const themeCards =

    getEl("themeCards");





  if (themeCards) {



    themeCards.innerHTML = `

      <div class="theme-card">

        <h4>

          Aguardando dados reais

        </h4>

      </div>

    `;



  }





  const keywordBars =

    getEl("keywordBars");





  if (keywordBars) {



    keywordBars.innerHTML = `

      <p>

        Aguardando corpus...

      </p>

    `;



  }





  const wordCloud =

    getEl("wordCloud");





  if (wordCloud) {



    wordCloud.innerHTML = `

      <span>

        Aguardando corpus...

      </span>

    `;



  }





  const spikeTimeline =

    getEl("spikeTimeline");





  if (spikeTimeline) {



    spikeTimeline.innerHTML = `

      <div class="spike">

        <strong>

          Aguardando dados temporais...

        </strong>

      </div>

    `;



  }





  renderVideosPlanned();





  [

    "metricMentions",

    "metricTopics",

    "metricSources",

    "metricPeak"

  ]

    .forEach(

      id => {



        const element =

          getEl(id);





        if (element) {

          element.textContent = "—";

        }



      }

    );





  renderRadar();



  drawChart();



}





// ============================================================

// TRADUÇÕES

// ============================================================



const translations = {



  pt: {

    tab_disinfo: "Desinformação",



    accessibility:

      "Acessibilidade:",



    high_contrast:

      "Alto Contraste",



    light_mode:

      "Modo Claro",



    header_subtitle:

      "Radar Eleitoral 2026",



    nav_map:

      "Mapa de Votos",



    nav_plan:

      "Plano de Governo",



    nav_axes:

      "Eixos Temáticos",



    nav_kit:

      "Kit Mídia & Rede",



    nav_guide:

      "Guia de Diálogo",



    nav_radar:

      "Radar 2026",



    campaign_2026:

      "Campanha 2026",



    prototype:

      "RADAR 2026 • CONECTANDO DADOS",



    hero_title:

      "Radar Eleitoral 2026",



    hero_desc:

      "Central para acompanhar cobertura pública, fontes e sinais descritivos do período monitorado.",



    last_update:

      "Última atualização",



    mock_notice:

      "Dados monitorados",



    monitoring:

      "MONITORAMENTO",



    filters:

      "Filtros do radar",



    reset:

      "Limpar filtros",



    period:

      "Período",



    scope:

      "Escopo",



    source:

      "Fonte",



    region:

      "Região",



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

      "Ambos en la misma publicación",

    all_publishers:

      "Todos los medios",

    coverage_filter_label:

      "Filtrar cobertura por candidato",

    coverage_flavio:

      "Flávio",

    coverage_lula:

      "Lula",

    coverage_both:

      "Ambos",



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

    coverage_filter_label:

      "Filtrar cobertura por candidato",

    coverage_flavio:

      "Flávio",

    coverage_lula:

      "Lula",

    coverage_both:

      "Ambos",



    tab_overview:

      "Visão geral",



    tab_themes:

      "Temas",



    tab_mentions:

      "Menções",



    tab_trends:

      "Tendências",



    tab_videos:

      "Vídeos",



    tab_sources:

      "Fontes & APIs",



    metric_mentions:

      "Matérias coletadas",



    metric_topics:

      "Matérias com candidatos",



    metric_sources:

      "Veículos monitorados",



    metric_peak:

      "Maior volume/hora",



    vs_period:

      "no período monitorado",



    high_attention:

      "referências identificadas",



    source_types:

      "veículos distintos",



    peak_desc:

      "publicações na hora de maior volume",



    volume_title:

      "Evolução da cobertura",



    demo_chart:

      "Série temporal calculada a partir dos artigos coletados.",



    hot_title:

      "Veículos com mais publicações",



    radar_title:

      "Panorama de Monitoramento",



    panorama_flavio:

      "Flávio Bolsonaro",



    panorama_lula:

      "Lula",



    panorama_both:

      "Ambos",



    panorama_publishers:

      "Veículos",



    panorama_articles:

      "Matérias",



    panorama_period:

      "Período",



    panorama_reference:

      "matérias com referência identificada",



    panorama_both_desc:

      "matérias que mencionam os dois",



    panorama_publishers_desc:

      "veículos distintos no conjunto",



    panorama_articles_desc:

      "itens no monitoramento atual",



    panorama_period_desc:

      "janela de coleta considerada",



    panorama_note:

      "Indicadores calculados a partir das matérias disponíveis no período monitorado.",



    panorama_waiting:

      "Aguardando dados",



    panorama_waiting_desc:

      "O panorama será atualizado quando os dados do monitoramento estiverem disponíveis.",



    news_title:

      "Últimas publicações encontradas",



    view_all:

      "Ver todas",



    themes_title:

      "Distribuição das referências",



    themes_desc:

      "Participação descritiva no corpus monitorado.",



    hours_label: "horas",

    theme_flavio_desc: "Artigos das últimas {hours}h em que o monitor identificou referência a Flávio Bolsonaro.",

    theme_lula_desc: "Artigos das últimas {hours}h em que o monitor identificou referência a Lula.",

    theme_both_name: "Ambos",

    theme_both_desc: "Artigos das últimas {hours}h em que foram identificadas referências a Flávio Bolsonaro e Lula na mesma publicação.",

    emerging_eyebrow: "MOVIMENTO DA COBERTURA",

    emerging_title: "Assuntos emergentes",

    emerging_desc: "Termos que ganharam presença nas últimas 24 horas em comparação com as 24 horas anteriores.",

    emerging_window: "24h × 24h anteriores",

    emerging_methodology: "A variação representa frequência na cobertura jornalística monitorada. Não mede popularidade, sentimento, aprovação ou intenção de voto.",

    emerging_insufficient_title: "Dados insuficientes para comparação",

    emerging_insufficient_desc: "São necessárias publicações nas duas janelas de 24 horas para calcular assuntos emergentes.",

    emerging_none_title: "Nenhum assunto em aceleração neste recorte",

    emerging_none_desc: "Não foram encontrados termos com crescimento suficiente entre as duas janelas analisadas.",

    emerging_new: "novo no período",

    emerging_counts: "{current} ocorrências nas últimas 24h · {previous} nas 24h anteriores",

    keywords_empty: "Não há termos suficientes para esta seleção.",

    cloud_empty: "Sem dados suficientes.",



    add_theme:

      "Adicionar tema",



    mentions_title:

      "Cobertura e publicações",



    mentions_filter_placeholder:

      "Filtrar título ou fonte",



    mentions_sort_recent:

      "Mais recentes",



    mentions_sort_relevance:

      "Maior relevância",



    mentions_sort_source:

      "Por fonte",



    keywords_title:

      "Termos com maior presença",



    cloud_title:

      "Nuvem de termos",



    cloud_note:

      "O tamanho representa frequência no corpus.",



    spikes_title:

      "Horas com maior volume",



    videos_title:

      "Conteúdos relacionados",



    videos_desc:

      "Vídeos públicos relacionados ao candidato selecionado, coletados pela YouTube Data API v3.",



    apis_title:

      "Fontes e serviços",



    config_title:

      "Parâmetros do radar",



    footer_desc:

      "Radar Eleitoral 2026."



  },



  en: {

    tab_disinfo: "Misinformation",



    accessibility:

      "Accessibility:",



    high_contrast:

      "High Contrast",



    light_mode:

      "Light Mode",



    header_subtitle:

      "2026 Election Radar",



    nav_map:

      "Vote Map",



    nav_plan:

      "Government Plan",



    nav_axes:

      "Topics",



    nav_kit:

      "Media Kit",



    nav_guide:

      "Dialogue Guide",



    nav_radar:

      "Radar 2026",



    campaign_2026:

      "Campaign 2026",



    prototype:

      "RADAR 2026 • CONNECTING DATA",



    hero_title:

      "2026 Election Radar",



    hero_desc:

      "A hub for monitoring public coverage, sources and descriptive signals from the monitored corpus.",



    last_update:

      "Last update",



    mock_notice:

      "Monitored data",



    monitoring:

      "MONITORING",



    filters:

      "Radar filters",



    reset:

      "Reset filters",



    period:

      "Period",



    scope:

      "Scope",



    source:

      "Source",



    region:

      "Region",



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

    coverage_filter_label:

      "Filter coverage by candidate",

    coverage_flavio:

      "Flávio",

    coverage_lula:

      "Lula",

    coverage_both:

      "Both",



    tab_overview:

      "Overview",



    tab_themes:

      "Topics",



    tab_mentions:

      "Mentions",



    tab_trends:

      "Trends",



    tab_videos:

      "Videos",



    tab_sources:

      "Sources & APIs",



    metric_mentions:

      "Collected articles",



    metric_topics:

      "Articles with candidates",



    metric_sources:

      "Publishers in corpus",



    metric_peak:

      "Highest hourly volume",



    vs_period:

      "in the monitored period",



    high_attention:

      "identified references",



    source_types:

      "distinct publishers",



    peak_desc:

      "publications in highest-volume hour",



    volume_title:

      "Coverage over time",



    demo_chart:

      "Timeline calculated from collected articles.",



    hot_title:

      "Publishers with most articles",



    radar_title:

      "Monitoring Overview",



    panorama_flavio:

      "Flávio Bolsonaro",



    panorama_lula:

      "Lula",



    panorama_both:

      "Both",



    panorama_publishers:

      "Publishers",



    panorama_articles:

      "Articles",



    panorama_period:

      "Period",



    panorama_reference:

      "articles with an identified reference",



    panorama_both_desc:

      "articles mentioning both candidates",



    panorama_publishers_desc:

      "distinct publishers in the dataset",



    panorama_articles_desc:

      "items in the current monitoring dataset",



    panorama_period_desc:

      "collection window considered",



    panorama_note:

      "Indicators calculated from the articles available during the monitored period.",



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

      "Descriptive share in the monitored corpus.",



    hours_label: "hours",

    theme_flavio_desc: "Articles from the last {hours}h in which the monitor identified a reference to Flávio Bolsonaro.",

    theme_lula_desc: "Articles from the last {hours}h in which the monitor identified a reference to Lula.",

    theme_both_name: "Both",

    theme_both_desc: "Articles from the last {hours}h in which references to Flávio Bolsonaro and Lula were identified in the same publication.",

    emerging_eyebrow: "COVERAGE MOVEMENT",

    emerging_title: "Emerging topics",

    emerging_desc: "Terms that gained presence in the last 24 hours compared with the previous 24 hours.",

    emerging_window: "24h × previous 24h",

    emerging_methodology: "Variation represents frequency in the monitored news coverage. It does not measure popularity, sentiment, approval or voting intention.",

    emerging_insufficient_title: "Insufficient data for comparison",

    emerging_insufficient_desc: "Publications are required in both 24-hour windows to calculate emerging topics.",

    emerging_none_title: "No accelerating topics in this selection",

    emerging_none_desc: "No terms with sufficient growth were found between the two analyzed windows.",

    emerging_new: "new in the period",

    emerging_counts: "{current} occurrences in the last 24h · {previous} in the previous 24h",

    keywords_empty: "There are not enough terms for this selection.",

    cloud_empty: "Insufficient data.",



    add_theme:

      "Add topic",



    mentions_title:

      "Coverage and publications",



    mentions_filter_placeholder:

      "Filter title or source",



    mentions_sort_recent:

      "Most recent",



    mentions_sort_relevance:

      "Highest relevance",



    mentions_sort_source:

      "By source",



    keywords_title:

      "Most frequent terms",



    cloud_title:

      "Word cloud",



    cloud_note:

      "Size represents frequency in the corpus.",



    spikes_title:

      "Highest-volume hours",



    videos_title:

      "Related content",



    videos_desc:

      "Public videos related to the selected candidate, collected through YouTube Data API v3.",



    apis_title:

      "Sources and services",



    config_title:

      "Radar parameters",



    footer_desc:

      "2026 Election Radar."



  },



  es: {

    tab_disinfo: "Desinformación",



    accessibility:

      "Accesibilidad:",



    high_contrast:

      "Alto Contraste",



    light_mode:

      "Modo Claro",



    header_subtitle:

      "Radar Electoral 2026",



    nav_map:

      "Mapa de Votos",



    nav_plan:

      "Plan de Gobierno",



    nav_axes:

      "Ejes Temáticos",



    nav_kit:

      "Kit de Medios",



    nav_guide:

      "Guía de Diálogo",



    nav_radar:

      "Radar 2026",



    campaign_2026:

      "Campaña 2026",



    prototype:

      "RADAR 2026 • CONECTANDO DATOS",



    hero_title:

      "Radar Electoral 2026",



    hero_desc:

      "Una central para seguir cobertura pública, fuentes y señales descriptivas del corpus monitoreado.",



    last_update:

      "Última actualización",



    mock_notice:

      "Datos monitoreados",



    monitoring:

      "MONITOREO",



    filters:

      "Filtros del radar",



    reset:

      "Limpiar filtros",



    period:

      "Período",



    scope:

      "Alcance",



    source:

      "Fuente",



    region:

      "Región",



    search:

      "Buscar término",



    apply:

      "Aplicar filtros",



    tab_overview:

      "Visión general",



    tab_themes:

      "Temas",



    tab_mentions:

      "Menciones",



    tab_trends:

      "Tendencias",



    tab_videos:

      "Videos",



    tab_sources:

      "Fuentes y APIs",



    metric_mentions:

      "Artículos recopilados",



    metric_topics:

      "Artículos con candidatos",



    metric_sources:

      "Medios en el corpus",



    metric_peak:

      "Mayor volumen/hora",



    vs_period:

      "en el período monitoreado",



    high_attention:

      "referencias identificadas",



    source_types:

      "medios distintos",



    peak_desc:

      "publicaciones en la hora de mayor volumen",



    volume_title:

      "Evolución de la cobertura",



    demo_chart:

      "Serie temporal calculada a partir de los artículos recopilados.",



    hot_title:

      "Medios con más publicaciones",



    radar_title:

      "Panorama de Monitoreo",



    panorama_flavio:

      "Flávio Bolsonaro",



    panorama_lula:

      "Lula",



    panorama_both:

      "Ambos",



    panorama_publishers:

      "Medios",



    panorama_articles:

      "Artículos",



    panorama_period:

      "Período",



    panorama_reference:

      "artículos con una referencia identificada",



    panorama_both_desc:

      "artículos que mencionan a ambos candidatos",



    panorama_publishers_desc:

      "medios distintos en el conjunto",



    panorama_articles_desc:

      "elementos en el monitoreo actual",



    panorama_period_desc:

      "ventana de recopilación considerada",



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

      "Participación descriptiva en el corpus monitoreado.",



    hours_label: "horas",

    theme_flavio_desc: "Artículos de las últimas {hours}h en los que el monitor identificó una referencia a Flávio Bolsonaro.",

    theme_lula_desc: "Artículos de las últimas {hours}h en los que el monitor identificó una referencia a Lula.",

    theme_both_name: "Ambos",

    theme_both_desc: "Artículos de las últimas {hours}h en los que se identificaron referencias a Flávio Bolsonaro y Lula en la misma publicación.",

    emerging_eyebrow: "MOVIMIENTO DE LA COBERTURA",

    emerging_title: "Temas emergentes",

    emerging_desc: "Términos que ganaron presencia en las últimas 24 horas en comparación con las 24 horas anteriores.",

    emerging_window: "24h × 24h anteriores",

    emerging_methodology: "La variación representa frecuencia en la cobertura periodística monitoreada. No mide popularidad, sentimiento, aprobación ni intención de voto.",

    emerging_insufficient_title: "Datos insuficientes para comparar",

    emerging_insufficient_desc: "Se necesitan publicaciones en ambas ventanas de 24 horas para calcular temas emergentes.",

    emerging_none_title: "Ningún tema en aceleración en este recorte",

    emerging_none_desc: "No se encontraron términos con crecimiento suficiente entre las dos ventanas analizadas.",

    emerging_new: "nuevo en el período",

    emerging_counts: "{current} ocurrencias en las últimas 24h · {previous} en las 24h anteriores",

    keywords_empty: "No hay términos suficientes para esta selección.",

    cloud_empty: "Datos insuficientes.",



    add_theme:

      "Agregar tema",



    mentions_title:

      "Cobertura y publicaciones",



    mentions_filter_placeholder:

      "Filtrar título o fuente",



    mentions_sort_recent:

      "Más recientes",



    mentions_sort_relevance:

      "Mayor relevancia",



    mentions_sort_source:

      "Por fuente",



    keywords_title:

      "Términos con mayor presencia",



    cloud_title:

      "Nube de términos",



    cloud_note:

      "El tamaño representa frecuencia en el corpus.",



    spikes_title:

      "Horas con mayor volumen",



    videos_title:

      "Contenidos relacionados",



    videos_desc:

      "Videos públicos relacionados con el candidato seleccionado, recopilados mediante YouTube Data API v3.",



    apis_title:

      "Fuentes y servicios",



    config_title:

      "Parámetros del radar",



    footer_desc:

      "Radar Electoral 2026."



  }

};





// ============================================================

// ABERTURA DAS ABAS

// ============================================================



function openTab(name) {



  document

    .querySelectorAll(".tab")

    .forEach(

      button => {



        const active =

          button.dataset.tab === name;





        button.classList.toggle(

          "active",

          active

        );





        button.setAttribute(

          "aria-selected",

          String(active)

        );



      }

    );





  document

    .querySelectorAll(".tab-panel")

    .forEach(

      panel => {



        panel.classList.toggle(

          "active",

          panel.id ===

            "panel-" + name

        );



      }

    );





  if (name === "disinfo") renderDisinfo();

  if (name === "apoio") initApoio();

  if (name === "polls") loadPolls();

  if (name === "vote") loadVotes();



  if (

    name === "overview"

  ) {



    requestAnimationFrame(

      drawChart

    );



  }



}





// ============================================================

// IDIOMAS

// ============================================================



function setLanguage(

  language,

  persist = true

) {



  lang =

    translations[language]

      ? language

      : "pt";





  document.documentElement.lang =

    lang === "pt"

      ? "pt-BR"

      : lang;





  document

    .querySelectorAll(

      "[data-i18n]"

    )

    .forEach(

      element => {



        const key =

          element.dataset.i18n;





        if (

          translations[lang][key]

        ) {



          element.textContent =

            translations[lang][key];



        }



      }

    );





  document

    .querySelectorAll(

      "[data-i18n-placeholder]"

    )

    .forEach(

      element => {



        const key =

          element.dataset.i18nPlaceholder;





        if (

          translations[lang][key]

        ) {



          element.placeholder =

            translations[lang][key];



          element.setAttribute(

            "aria-label",

            translations[lang][key]

          );



        }



      }

    );





  document

    .querySelectorAll(

      ".lang-btn"

    )

    .forEach(

      button => {



        const active =

          button.id ===

          "lang-" + lang;





        button.classList.toggle(

          "active",

          active

        );





        button.setAttribute(

          "aria-pressed",

          String(active)

        );



      }

    );





  if (persist) {



    localStorage.setItem(

      "fazdireito-lang",

      lang

    );



  }





  syncThemeLabel();

  if (lastTSEData) renderTSEPanel(lastTSEData);

  renderDisinfo();





  if (liveSources) {



    renderApiSources(

      liveSources

    );



  }





  if (liveNews) {



    updateRealDataLabels();



    renderRadar();



  }



}



// ============================================================

// TAMANHO DA FONTE

// ============================================================



function changeFontSize(delta) {



  fontSize =

    Math.min(

      130,

      Math.max(

        85,

        fontSize +

        delta *

        10

      )

    );





  document.documentElement.style.setProperty(

    "--base-font-size",

    fontSize + "%"

  );





  localStorage.setItem(

    "fazdireito-font-size",

    String(fontSize)

  );



}





function resetFontSize() {



  fontSize =

    100;





  document.documentElement.style.setProperty(

    "--base-font-size",

    "100%"

  );





  localStorage.setItem(

    "fazdireito-font-size",

    "100"

  );



}





// ============================================================

// CONTRASTE

// ============================================================



function syncThemeLabel() {



  const themeText =

    getEl("themeText");





  if (!themeText) {

    return;

  }





  const dark =

    document.documentElement

      .classList

      .contains("dark");





  themeText.textContent =

    translations[lang][

      dark

        ? "light_mode"

        : "high_contrast"

    ];



}





function toggleTheme() {



  const dark =

    !document.documentElement

      .classList

      .contains("dark");





  document.documentElement

    .classList

    .toggle(

      "dark",

      dark

    );





  localStorage.setItem(

    "fazdireito-theme",

    dark

      ? "dark"

      : "light"

  );





  syncThemeLabel();



}





// ============================================================

// MENU MOBILE

// ============================================================



const menuBtn =

  getEl("mobileMenuBtn");





const menu =

  getEl("mobileMenu");





const menuIcon =

  getEl("mobileMenuIcon");





function toggleMenu(force) {



  if (

    !menu ||

    !menuBtn

  ) {

    return;

  }





  const open =

    force ??

    menu.hidden;





  menu.hidden =

    !open;





  menuBtn.setAttribute(

    "aria-expanded",

    String(open)

  );





  if (menuIcon) {



    menuIcon.setAttribute(

      "href",

      open

        ? "#i-x"

        : "#i-bars"

    );



  }



}





// ============================================================

// EVENTOS

// ============================================================



function bindEvents() {



  document

    .querySelectorAll(".tab")

    .forEach(

      button => {



        button.addEventListener(

          "click",

          () =>

            openTab(

              button.dataset.tab

            )

        );



      }

    );





  document

    .querySelectorAll(

      "[data-open-tab]"

    )

    .forEach(

      button => {



        button.onclick =

          () =>

            openTab(

              button.dataset.openTab

            );



      }

    );





  const applyFilters =

    getEl("applyFilters");





  if (applyFilters) {



    applyFilters.onclick =

      applyRadarFilters;



  }





  const resetFilters =

    getEl("resetFilters");





  if (resetFilters) {



    resetFilters.onclick =

      resetRadarFilters;



  }





  const coverageFilter =

    getEl("coverageFilter");





  if (coverageFilter) {



    coverageFilter.onchange =

      () => {



        renderNewsFeed();



      };



  }





  const mentionFilter =

    getEl("mentionFilter");





  if (mentionFilter) {



    mentionFilter.oninput =

      filterMentionsList;



  }





  const videoFilter = getEl("videoFilter");

  if (videoFilter) videoFilter.oninput = () => renderYouTubeVideos();



  const videoSort = getEl("videoSort");

  if (videoSort) videoSort.onchange = () => renderYouTubeVideos();



  const videoFrame = getEl("videoFrame");

  if (videoFrame) videoFrame.onchange = () => renderYouTubeVideos();



  const mentionSort =

    getEl("mentionSort");





  if (mentionSort) {



    mentionSort.onchange =

      filterMentionsList;



  }





  document.addEventListener(

    "click",

    event => {



      const word =

        event.target.closest(

          ".word"

        );





      if (word) {



        const searchTerm =

          getEl("searchTerm");





        if (searchTerm) {



          searchTerm.value =

            word.dataset.theme ||

            word.textContent.trim();



        }





        openTab(

          "overview"

        );





        applyRadarFilters();



      }



    }

  );





  if (menuBtn) {



    menuBtn.onclick =

      () =>

        toggleMenu();



  }





  document.addEventListener(

    "keydown",

    event => {



      if (

        event.key === "Escape"

      ) {



        toggleMenu(false);



      }



    }

  );





  document.addEventListener(

    "click",

    event => {



      if (

        menu &&

        menuBtn &&

        !menu.hidden &&

        !menu.contains(

          event.target

        ) &&

        !menuBtn.contains(

          event.target

        )

      ) {



        toggleMenu(false);



      }



    }

  );





  window.addEventListener(

    "resize",

    () => {



      if (

        window.innerWidth >=

        768

      ) {



        toggleMenu(false);



      }





      drawChart();



    }

  );



}

// ============================================================

// INICIALIZAÇÃO

// ============================================================



async function initializeRadar() {



  const storedLanguage =

    localStorage.getItem(

      "fazdireito-lang"

    ) ||

    "pt";





  const storedFontSize =

    Number(

      localStorage.getItem(

        "fazdireito-font-size"

      ) ||

      100

    );





  const storedTheme =

    localStorage.getItem(

      "fazdireito-theme"

    );





  fontSize =

    Number.isFinite(

      storedFontSize

    )

      ? storedFontSize

      : 100;





  document.documentElement.style.setProperty(

    "--base-font-size",

    fontSize + "%"

  );





  if (

    storedTheme === "dark"

  ) {



    document.documentElement

      .classList

      .add("dark");



  }





  setLanguage(

    storedLanguage,

    false

  );





  bindEvents();





  renderInitialState();





  const [

    statusResult,

    sourcesResult,

    newsResult,

    coverageResult

  ] =

    await Promise.allSettled(

      [

        checkRadarApi(),

        loadRadarSources(),

        loadRadarNews(),

        loadCoverageMovement()

      ]

    );





  console.info(

    "[Radar] Inicialização concluída:",

    {

      status:

        statusResult.status,



      sources:

        sourcesResult.status,



      news:

        newsResult.status,



      apiVersion:

        liveNewsMeta?.version ||

        liveStatus?.version ||

        "desconhecida"

    }

  );



}







// Election modules — the data comes exclusively from the Worker / D1.

const ELECTION_I18N={

 pt:{support_all:'Todos',support_vote:'Pediu voto',support_mention:'Falou',support_silent:'Não falou',support_off:'Sem postar',support_nored:'Sem coleta',support_top5:'Top 5',support_recent:'Recentes',support_engaged:'Mais engajadas',support_active:'Mais atuantes',support_most_recent:'Mais recentes',support_absent:'Ausentes',tab_support:'Apoio',support_title:'Apoio a Flávio Bolsonaro',support_intro:'Quem falou do candidato e quem fez pedido explícito de voto em publicações públicas.',support_classification:'Classificação',support_party:'Partido',support_role:'Cargo',support_state:'UF',support_network:'Rede',support_name:'Nome',support_search_placeholder:'Buscar político',support_territorial:'Distribuição temporal por UF',support_latest_posts:'Últimos posts',support_people:'Pessoas monitoradas',support_sort:'Ordenar por',support_related_posts:'Publicações relacionadas · últimos 5 dias',support_methodology:'Metodologia e fonte',tab_polls:'Pesquisas',tab_vote:'Voto agora',polls_label:'LEVANTAMENTOS PUBLICADOS',polls_title:'Pesquisas eleitorais',polls_intro:'Resultados publicados e documentados, sem estimativas.',polls_institute:'Instituto',all_institutes:'Todos os institutos',polls_from:'De',polls_to:'Até',polls_leadership:'Liderança',polls_leadership_all:'Todas',polls_leadership_flavio:'Flávio lidera',polls_leadership_lula:'Lula lidera',polls_leadership_other:'Outro lidera',polls_leadership_tie:'Empate',refresh:'Atualizar',poll_accuracy_low:'Institutos mais próximos do resultado',poll_accuracy_high:'Institutos mais distantes do resultado',poll_method:'Ranking por instituto baseado no erro absoluto médio (MAE), em pontos percentuais, de sua pesquisa nacional de 1º turno mais recente. Cobertura de candidatos e datas podem variar.',vote_official:'RESULTADOS OFICIAIS',vote_title:'Voto agora',vote_intro:'Apuração presidencial publicada pelo TSE, sem projeções.',first_round:'Primeiro turno',second_round:'Segundo turno · 25/10/2026',vote_refresh:'Atualização automática durante a apuração, conforme disponibilidade de dados oficiais.',vote_method:'Números apenas após ingestão e validação de arquivos oficiais. Ausência de dados não significa zero votos.',empty_poll:'Ainda não há percentuais de pesquisas documentados na base histórica. Não serão exibidos valores estimados.',empty_vote:'Aguardando resultados oficiais validados.',vote_not_started:'Votação não iniciada. A divulgação da apuração está prevista a partir das 17h (Brasília) de 25/10.',poll_accuracy_pending:'Aguardando dados comparáveis e resultados oficiais para calcular diferenças.',loading_data:'Consultando dados...',error_data:'Não foi possível consultar os dados agora.'},

 en:{support_all:'All',support_vote:'Asked for votes',support_mention:'Mentioned',support_silent:'Did not mention',support_off:'No posts',support_nored:'Not collected',support_top5:'Top 5',support_recent:'Recent',support_engaged:'Most engaged',support_active:'Most active',support_most_recent:'Most recent',support_absent:'Absent',tab_support:'Support',support_title:'Support for Flávio Bolsonaro',support_intro:'Who mentioned the candidate and who explicitly asked for votes in public posts.',support_classification:'Classification',support_party:'Party',support_role:'Office',support_state:'State',support_network:'Network',support_name:'Name',support_search_placeholder:'Search politician',support_territorial:'Activity over time by state',support_latest_posts:'Latest posts',support_people:'Monitored people',support_sort:'Sort by',support_related_posts:'Related posts · last 5 days',support_methodology:'Methodology and source',tab_polls:'Polls',tab_vote:'Vote now',polls_label:'PUBLISHED SURVEYS',polls_title:'Election polls',polls_intro:'Documented published results; no estimates.',polls_institute:'Polling organization',all_institutes:'All organizations',polls_from:'From',polls_to:'To',polls_leadership:'Leader',polls_leadership_all:'All',polls_leadership_flavio:'Flávio leads',polls_leadership_lula:'Lula leads',polls_leadership_other:'Another candidate leads',polls_leadership_tie:'Tie',refresh:'Refresh',poll_accuracy_low:'Smallest observed differences',poll_accuracy_high:'Largest observed differences',poll_method:'Differences require comparable polls and validated official results. Sampling margin of error is not the difference from the election result.',vote_official:'OFFICIAL RESULTS',vote_title:'Vote now',vote_intro:'Official presidential vote count; no projections.',first_round:'First round',second_round:'Second round · Oct 25, 2026',vote_refresh:'Automatic refresh during vote counting, subject to official availability.',vote_method:'Figures are displayed only after official source validation. Missing data does not mean zero votes.',empty_poll:'No documented polling percentages are available yet. No estimated figures will be shown.',empty_vote:'Awaiting validated official results.',vote_not_started:'Voting not started. Official results may be published from 5 pm Brasília time on Oct 25.',poll_accuracy_pending:'Comparable polls and official results are required to calculate differences.',loading_data:'Loading data...',error_data:'Data could not be loaded.'},

 es:{support_all:'Todos',support_vote:'Pidió el voto',support_mention:'Mencionó',support_silent:'No mencionó',support_off:'Sin publicaciones',support_nored:'Sin recolección',support_top5:'Top 5',support_recent:'Recientes',support_engaged:'Más interacciones',support_active:'Más activos',support_most_recent:'Más recientes',support_absent:'Ausentes',tab_support:'Apoyo',support_title:'Apoyo a Flávio Bolsonaro',support_intro:'Quién mencionó al candidato y quién pidió explícitamente el voto en publicaciones públicas.',support_classification:'Clasificación',support_party:'Partido',support_role:'Cargo',support_state:'Estado',support_network:'Red',support_name:'Nombre',support_search_placeholder:'Buscar político',support_territorial:'Actividad temporal por estado',support_latest_posts:'Últimas publicaciones',support_people:'Personas monitoreadas',support_sort:'Ordenar por',support_related_posts:'Publicaciones relacionadas · últimos 5 días',support_methodology:'Metodología y fuente',tab_polls:'Encuestas',tab_vote:'Voto ahora',polls_label:'ENCUESTAS PUBLICADAS',polls_title:'Encuestas electorales',polls_intro:'Resultados publicados y documentados, sin estimaciones.',polls_institute:'Instituto',all_institutes:'Todos los institutos',polls_from:'Desde',polls_to:'Hasta',polls_leadership:'Liderazgo',polls_leadership_all:'Todas',polls_leadership_flavio:'Flávio lidera',polls_leadership_lula:'Lula lidera',polls_leadership_other:'Otro candidato lidera',polls_leadership_tie:'Empate',refresh:'Actualizar',poll_accuracy_low:'Menores diferencias observadas',poll_accuracy_high:'Mayores diferencias observadas',poll_method:'Las diferencias requieren encuestas comparables y resultados oficiales validados. El margen de error no equivale a la diferencia electoral.',vote_official:'RESULTADOS OFICIALES',vote_title:'Voto ahora',vote_intro:'Escrutinio presidencial oficial, sin proyecciones.',first_round:'Primera vuelta',second_round:'Segunda vuelta · 25/10/2026',vote_refresh:'Actualización automática durante el escrutinio, según disponibilidad oficial.',vote_method:'Cifras solo después de validar archivos oficiales. La ausencia de datos no significa cero votos.',empty_poll:'Aún no hay porcentajes documentados en la base histórica. No se mostrarán estimaciones.',empty_vote:'Esperando resultados oficiales validados.',vote_not_started:'Votación no iniciada. Publicación prevista desde las 17 h de Brasilia del 25/10.',poll_accuracy_pending:'Se requieren encuestas comparables y resultados oficiales para calcular diferencias.',loading_data:'Consultando datos...',error_data:'No fue posible consultar los datos.'}

};

for(const code of ['pt','en','es'])Object.assign(translations[code]||{},ELECTION_I18N[code]);

const electT=k=>(ELECTION_I18N[lang]||ELECTION_I18N.pt)[k]||k;





let polyLastRequest=0;

async function loadIndicatorArchive(){

 const el=document.getElementById('indicatorArchiveStatus');if(!el)return;

 try{const r=await fetch(`${RADAR_API.baseUrl}/api/indicators?source=Polymarket&days=365`);const d=await r.json();if(d.status==='ok'){const rows=d.items||[];el.textContent=`Histórico D1: ${rows.length} observações de preços de contratos no último ano (limite de consulta: 3.000). Fonte: Polymarket.`;}else el.textContent=d.message||'Histórico aguardando migração D1.';}

 catch(e){el.textContent='Histórico temporariamente indisponível.';}

}

async function loadPolymarket(){loadIndicatorArchive();

 const status=getEl('polyStatus'),values=getEl('polyValues'),chart=getEl('polyHistory');if(!status||!values||!chart||Date.now()-polyLastRequest<120000)return;

 polyLastRequest=Date.now();status.textContent='Consultando preços de mercado...';

 try{

  const r=await fetch(`${RADAR_API.baseUrl}/api/polymarket`);if(!r.ok)throw Error('unavailable');const data=await r.json();if(data.status!=='ok'||!data.markets?.length)throw Error('empty');

  status.textContent=`Fonte: Polymarket · consulta: ${new Date(data.asOf).toLocaleString('pt-BR')} · preços negociados, não pesquisas.`;

  values.replaceChildren();chart.replaceChildren();

  const labels={flavio:'Flávio Bolsonaro',lula:'Lula'};

  for(const m of data.markets){const card=document.createElement('article');card.className='poly-price';const label=document.createElement('span');label.textContent=labels[m.candidate]||m.candidate;const pct=document.createElement('strong');pct.textContent=`${pctBR(m.percent)}%`;const caption=document.createElement('small');caption.textContent='Preço implícito do contrato (não intenção de voto)';card.append(label,pct,caption);values.appendChild(card);}

  const series=data.markets.filter(m=>m.history?.length>1);if(!series.length){chart.textContent='Histórico temporal indisponível na API neste momento.';return;}

  const W=780,H=235,pad={l:42,r:18,t:20,b:40};const all=series.flatMap(m=>m.history);const min=Math.min(...all.map(x=>x.timestamp)),max=Math.max(...all.map(x=>x.timestamp));const ns='http://www.w3.org/2000/svg';const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('aria-label','Série histórica dos preços de contratos de previsão de Flávio Bolsonaro e Lula, em porcentagem');

  const x=t=>pad.l+(t-min)/Math.max(1,max-min)*(W-pad.l-pad.r),y=v=>H-pad.b-v/100*(H-pad.t-pad.b);

  for(const n of [0,25,50,75,100]){const line=document.createElementNS(ns,'line');line.setAttribute('x1',pad.l);line.setAttribute('x2',W-pad.r);line.setAttribute('y1',y(n));line.setAttribute('y2',y(n));line.setAttribute('class','poly-grid');svg.appendChild(line);const txt=document.createElementNS(ns,'text');txt.setAttribute('x',pad.l-8);txt.setAttribute('y',y(n)+4);txt.setAttribute('text-anchor','end');txt.textContent=n+'%';svg.appendChild(txt);}

  for(const m of series){const path=document.createElementNS(ns,'path');path.setAttribute('d',m.history.map((v,i)=>`${i?'L':'M'}${x(v.timestamp).toFixed(1)} ${y(v.percent).toFixed(1)}`).join(' '));path.setAttribute('class','poly-line poly-'+m.candidate);svg.appendChild(path);}

  for(const t of [min,max]){const txt=document.createElementNS(ns,'text');txt.setAttribute('x',x(t));txt.setAttribute('y',H-13);txt.setAttribute('text-anchor',t===min?'start':'end');txt.textContent=new Date(t*1000).toLocaleDateString('pt-BR');svg.appendChild(txt);}

  chart.appendChild(svg);const legend=document.createElement('div');legend.className='poly-legend';legend.textContent=series.map(m=>`${labels[m.candidate]||m.candidate}: ${m.history.length} observações`).join(' · ');chart.appendChild(legend);

 }catch(e){status.textContent='Polymarket indisponível nesta consulta. Nenhum percentual será estimado.';values.replaceChildren();chart.replaceChildren();}

}



let pollData=[],voteTimer=null,pollStage='pre',pollInstituteOptions=[],pollPage=1,pollTotal=0,pollSelectedUid='',pollInputTimer=null;

const POLL_PAGE_SIZE=12;

const UF_NAMES={AC:'Acre',AL:'Alagoas',AM:'Amazonas',AP:'Amapá',BA:'Bahia',CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',MG:'Minas Gerais',MS:'Mato Grosso do Sul',MT:'Mato Grosso',PA:'Pará',PB:'Paraíba',PE:'Pernambuco',PI:'Piauí',PR:'Paraná',RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RO:'Rondônia',RR:'Roraima',RS:'Rio Grande do Sul',SC:'Santa Catarina',SE:'Sergipe',SP:'São Paulo',TO:'Tocantins'};

const pctBR=x=>Number(x).toLocaleString('pt-BR',{maximumFractionDigits:2});

function electionText(id,text){const el=getEl(id);if(el)el.textContent=text;}

function stageRange(){return pollStage==='pre'?['2026-01-01','2026-10-03']:pollStage==='first'?['2026-09-01','2026-10-04']:['2026-10-05','2026-10-25'];}

function pollGroups(rows){const groups=new Map();for(const row of rows){const key=row.pesquisa_uid;if(!groups.has(key))groups.set(key,{...row,results:[]});if(row.candidato&&row.percentual!==null&&Number.isFinite(Number(row.percentual)))groups.get(key).results.push({candidato:row.candidato,partido:row.partido||'',cenario:row.cenario||'',percentual:Number(row.percentual)});}return [...groups.values()];}

async function loadPollInstitutes(){try{const r=await fetch(`${RADAR_API.baseUrl}/api/polls?institutes=1`,{cache:'no-store'});if(!r.ok)return;const d=await r.json();pollInstituteOptions=Array.isArray(d.institutes)?d.institutes:[];const list=getEl('pollInstituteList');if(list)list.innerHTML=pollInstituteOptions.map(x=>`<option value="${escapeHTML(x)}"></option>`).join('');}catch(e){}}

function renderSelectedPoll(group){const title=getEl('pollDetailTitle'),chart=getEl('pollChart'),meta=getEl('pollDetailMeta');if(!title||!chart||!meta)return;chart.replaceChildren();meta.replaceChildren();if(!group){title.textContent='Selecione uma pesquisa';chart.innerHTML='<div class="poll-chart-empty">Selecione um card para consultar os detalhes e os percentuais documentados.</div>';return;}title.textContent=group.instituto||'Instituto não informado';const results=group.results||[];if(results.length){const scenarios=new Map();for(const row of results){const scenario=String(row.cenario||'Cenário não identificado').trim()||'Cenário não identificado';if(!scenarios.has(scenario))scenarios.set(scenario,[]);scenarios.get(scenario).push(row);}const multiple=scenarios.size>1;let scenarioIndex=0;for(const [scenario,rows] of scenarios){scenarioIndex++;const section=document.createElement('section');section.className='poll-scenario';section.setAttribute('aria-label',`${multiple?`Cenário ${scenarioIndex}`:'Cenário'}: ${scenario}`);const heading=document.createElement('div');heading.className='poll-scenario-head';heading.innerHTML=`<span class="poll-scenario-kicker">${multiple?`CENÁRIO ${scenarioIndex}`:'CENÁRIO'}</span><p>${escapeHTML(scenario)}</p>`;section.appendChild(heading);const ordered=[...rows].sort((a,b)=>Number(b.percentual)-Number(a.percentual)||String(a.candidato).localeCompare(String(b.candidato),'pt-BR'));for(const row of ordered){const pct=Math.min(100,Math.max(0,Number(row.percentual)));const bar=document.createElement('div');bar.className='election-bar-row';bar.innerHTML=`<div class="election-bar-head"><span class="poll-candidate-name">${escapeHTML(row.candidato)}${row.partido?` <small>${escapeHTML(row.partido)}</small>`:''}</span><strong>${pctBR(pct)}%</strong></div><div class="election-bar-track" aria-hidden="true"><div class="election-bar-fill" style="width:${pct}%"></div></div>`;section.appendChild(bar);}chart.appendChild(section);}}else chart.innerHTML='<div class="poll-chart-empty">Esta pesquisa possui registro oficial no TSE, mas os percentuais publicados ainda não estão documentados em <strong>pesquisa_resultados</strong>. Nenhum valor estimado será exibido.</div>';

 if(results.length){fetch(`${RADAR_API.baseUrl}/api/poll-sources?uid=${encodeURIComponent(group.pesquisa_uid)}`,{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{if(!data||data.status!=='ok'||getEl('pollDetailTitle')?.textContent!==(group.instituto||'Instituto não informado'))return;const sources=(data.sources||[]).filter(x=>x.fonte_url&&/^https:\/\//i.test(x.fonte_url));if(sources.length){const block=document.createElement('div');block.className='poll-provenance';const title=document.createElement('strong');title.textContent='Fontes dos percentuais';block.appendChild(title);for(const row of sources){const link=document.createElement('a');link.href=row.fonte_url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=`${row.fonte_nome||'Fonte'} — ${row.candidato} (${row.cenario||'cenário não identificado'}) ↗`;block.appendChild(link);}meta.appendChild(block);}}).catch(()=>{});}const lines=[['Registro TSE',group.registro_tse||'—'],['Divulgação',group.data_divulgacao||'—'],['Campo',`${group.data_inicio||'—'} a ${group.data_fim||'—'}`],['Amostra',Number(group.tamanho_amostra||0).toLocaleString('pt-BR')],['Margem declarada',group.margem_erro==null?'Não extraída':`±${pctBR(group.margem_erro)} pp`],['Nível de confiança',group.nivel_confianca==null?'Não extraído':`${pctBR(group.nivel_confianca)}%`],['Abrangência',group.abrangencia||'—']];meta.innerHTML=lines.map(([k,v])=>`<div><strong>${escapeHTML(k)}:</strong> ${escapeHTML(String(v))}</div>`).join('');}

function renderPollPagination(){const nav=getEl('pollPagination');if(!nav)return;nav.replaceChildren();const pages=Math.max(1,Math.ceil(pollTotal/POLL_PAGE_SIZE));if(pages<=1)return;const add=(label,page,disabled,current=false)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled;if(current)b.setAttribute('aria-current','page');b.addEventListener('click',()=>{pollPage=page;loadPolls({keepSelection:false});});nav.appendChild(b);};add('‹',Math.max(1,pollPage-1),pollPage===1);const from=Math.max(1,pollPage-2),to=Math.min(pages,pollPage+2);if(from>1){add('1',1,false,pollPage===1);if(from>2){const i=document.createElement('span');i.className='poll-page-info';i.textContent='…';nav.appendChild(i);}}for(let p=from;p<=to;p++)add(String(p),p,false,p===pollPage);if(to<pages){if(to<pages-1){const i=document.createElement('span');i.className='poll-page-info';i.textContent='…';nav.appendChild(i);}add(String(pages),pages,false,pollPage===pages);}add('›',Math.min(pages,pollPage+1),pollPage===pages);const info=document.createElement('span');info.className='poll-page-info';info.textContent=`Página ${pollPage} de ${pages}`;nav.appendChild(info);}

async function loadPolls(options={}){loadPolymarket();loadEurasia();loadPollAccuracy();const status=getEl('pollStatus');if(!status)return;electionText('pollStatus',electT('loading_data'));const q=new URLSearchParams();const [min,max]=stageRange();q.set('from',getEl('pollFrom')?.value||min);q.set('to',getEl('pollTo')?.value||max);const institute=(getEl('pollInstitute')?.value||'').trim();if(institute)q.set('institute',institute);const hasResults=getEl('pollHasResults')?.value||'all';if(hasResults!=='all')q.set('has_results',hasResults);const leadership=getEl('pollLeadership')?.value||'all';if(leadership!=='all')q.set('leadership',leadership);q.set('page',String(pollPage));q.set('per_page',String(POLL_PAGE_SIZE));try{const r=await fetch(`${RADAR_API.baseUrl}/api/polls?${q}`,{cache:'no-store'});if(!r.ok)throw Error(r.status);const data=await r.json();if(data.status!=='ok')throw Error(data.status);pollData=data.polls||[];pollTotal=Number(data.total||0);const groups=pollGroups(pollData);const valid=pollData.filter(x=>x.candidato&&x.percentual!==null&&Number.isFinite(Number(x.percentual)));electionText('pollStatus',`${pollTotal.toLocaleString('pt-BR')} pesquisas encontradas · ${valid.length} percentuais documentados nesta página. Registro no TSE não comprova publicação dos resultados.`);const list=getEl('pollList');list.replaceChildren();for(const group of groups){const card=document.createElement('button');card.type='button';card.className='poll-card';card.dataset.pollUid=group.pesquisa_uid;const reg=String(group.registro_tse||'—');card.innerHTML=`<strong>${escapeHTML(group.instituto||'Instituto não informado')}</strong><small>Registro ${escapeHTML(reg)} · Divulgação: ${escapeHTML(group.data_divulgacao||'—')} · Amostra: ${Number(group.tamanho_amostra||0).toLocaleString('pt-BR')}</small><div class="poll-card-badges"><span>${group.margem_erro==null?'Margem não extraída':`±${pctBR(group.margem_erro)} pp`}</span><span>${group.results.length?`${group.results.length} resultado(s) documentado(s)`:'Somente registro TSE'}</span></div>`;card.addEventListener('click',()=>{pollSelectedUid=group.pesquisa_uid;list.querySelectorAll('.poll-card').forEach(x=>x.classList.toggle('is-selected',x===card));renderSelectedPoll(group);});list.appendChild(card);}renderPollPagination();let selected=groups.find(x=>x.pesquisa_uid===pollSelectedUid);if(!selected&&!options.keepSelection&&groups.length){selected=groups[0];pollSelectedUid=selected.pesquisa_uid;}if(selected){const el=list.querySelector(`[data-poll-uid="${CSS.escape(selected.pesquisa_uid)}"]`);el?.classList.add('is-selected');renderSelectedPoll(selected);}else renderSelectedPoll(null);}catch(e){electionText('pollStatus',electT('error_data'));}}

function voteRow(row){const item=document.createElement('div');item.className='election-result';const pct=Number(row.percentual),valid=Number.isFinite(pct)&&pct>=0&&pct<=100;item.innerHTML=`<div class="election-candidate"><div><strong>${escapeHTML(row.candidato||'')}</strong><small>${escapeHTML(row.partido||'')} · ${Number(row.votos||0).toLocaleString('pt-BR')} votos ${valid?'· '+pctBR(pct)+'%':''}</small></div></div>${valid?`<div class="election-bar-track"><div class="election-bar-fill" style="width:${pct}%"></div></div>`:''}`;return item;}



async function loadPollAccuracy(){

 const low=getEl('pollAccuracyLow'),high=getEl('pollAccuracyHigh');if(!low||!high)return;

 const pending=electT('poll_accuracy_pending');low.textContent=pending;high.textContent=pending;

 try{

  const r=await fetch(`${RADAR_API.baseUrl}/api/poll-comparisons?round=1`,{cache:'no-store'});if(!r.ok)throw Error(r.status);

  const d=await r.json();if(d.status!=='ok'||Number(d.count)<2){const msg=d.message||'Não há institutos comparáveis suficientes para estabelecer os extremos.';low.textContent=msg;high.textContent=msg;return;}

  const render=(el,items)=>{el.replaceChildren();for(const x of items||[]){const row=document.createElement('div');row.className='poll-accuracy-row';const name=document.createElement('strong');name.textContent=`${x.instituto} · erro médio normalizado ${pctBR(x.erro_medio_pp)} p.p.`;const detail=document.createElement('small');detail.textContent=`Pesquisa ${x.registro_tse} · ${x.data_divulgacao||'data não informada'} · ${x.candidatos_comparados}/${x.candidatos_no_cenario||'?'} candidatos comparados · base comum normalizada`;row.append(name,detail);el.append(row);}};

  render(low,d.smallest);render(high,d.largest);

 }catch(e){console.warn('[poll accuracy]',String(e));}

}



async function loadVotes(){if(!getEl('voteFirst'))return;for(const round of [1,2]){const id=round===1?'voteFirst':'voteSecond';electionText(id,electT('loading_data'));try{const r=await fetch(`${RADAR_API.baseUrl}/api/official-vote?round=${round}&uf=br`,{cache:'no-store'});const data=await r.json();const el=getEl(id);el.replaceChildren();if(round===2)updateVoteLiveStatus(data);if(data.status==='not_started'){el.textContent=electT('vote_not_started');continue;}if(data.status!=='ok'||!data.items?.length){el.textContent=electT('empty_vote');continue;}[...data.items].sort((a,b)=>Number(b.votos||0)-Number(a.votos||0)||Number(b.percentual||0)-Number(a.percentual||0)).forEach(x=>el.appendChild(voteRow(x)));}catch(e){electionText(id,electT('error_data'));}}loadVoteMap();if(voteTimer)clearTimeout(voteTimer);const now=new Date(),start=new Date('2026-10-25T17:00:00-03:00'),end=new Date('2026-10-26T03:00:00-03:00');if(now>=start&&now<=end&&document.visibilityState==='visible')voteTimer=setTimeout(loadVotes,60000);}

function updateVoteLiveStatus(data){

 const badge=getEl('voteLiveBadge'),status=getEl('voteLiveStatus'),sync=getEl('voteLastSync');

 if(!badge||!status)return;

 const live=data.status==='ok'&&Array.isArray(data.items)&&data.items.length>0;

 badge.classList.toggle('is-live',live);badge.textContent=live?'Dados oficiais':'Aguardando';

 const when=data.updatedAt?`Atualização TSE: ${data.updatedAt}`:'';

 status.textContent=live?`Apuração oficial disponível. ${when}. Fonte: TSE. Sem projeções.`:data.status==='not_started'?'A divulgação oficial do 2º turno está prevista a partir das 17h (Brasília), em 25/10/2026.':data.status==='unavailable'?'Fonte oficial temporariamente indisponível. Os votos não foram estimados.':'Aguardando dados oficiais confirmados do TSE.';

 if(sync)sync.textContent=`Última consulta: ${new Date().toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo'})} (Brasília)`;

}

getEl('voteRefreshNow')?.addEventListener('click',()=>{if(voteTimer)clearTimeout(voteTimer);loadVotes();});

document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&getEl('panel-vote')?.classList.contains('active') || getEl('panel-vote')?.classList.contains('is-active'))loadVotes();});

let mapGeo=null,mapResults=null;

function positionMapTooltip(event,box,tip){const rect=box.getBoundingClientRect();let x=event.clientX-rect.left+14,y=event.clientY-rect.top+14;tip.classList.add('is-visible');tip.setAttribute('aria-hidden','false');const tw=tip.offsetWidth||260,th=tip.offsetHeight||80;if(x+tw>rect.width-6)x=Math.max(6,event.clientX-rect.left-tw-14);if(y+th>rect.height-6)y=Math.max(6,event.clientY-rect.top-th-14);tip.style.left=`${x}px`;tip.style.top=`${y}px`;}

async function loadVoteMap(){const box=getEl('voteMap');if(!box)return;try{if(!mapGeo){const r=await fetch('https://cdn.jsdelivr.net/gh/henriquemalvar/br-geojson@main/dist/estados.geojson');if(!r.ok)throw Error('map');mapGeo=await r.json();}if(!mapResults){const results=await Promise.all(Object.keys(UF_NAMES).map(async uf=>{try{const r=await fetch(`${RADAR_API.baseUrl}/api/official-vote?round=1&uf=${uf.toLowerCase()}`);if(!r.ok)return [uf,null];const d=await r.json();return [uf,d.status==='ok'?d.items:null];}catch(e){return [uf,null];}}));mapResults=Object.fromEntries(results);}const width=580,height=570,x0=-74.1,x1=-34.7,y0=-34,y1=5.5;const xy=p=>[(p[0]-x0)/(x1-x0)*width,(y1-p[1])/(y1-y0)*height];function ringPath(ring){return ring.map((p,i)=>{const [x,y]=xy(p);return `${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`;}).join('')+'Z';}function pathFor(g){const polygons=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];return polygons.map(poly=>poly.map(ringPath).join(' ')).join(' ');}const tip=document.createElement('div');tip.id='voteMapTooltip';tip.className='vote-map-tooltip';tip.setAttribute('aria-hidden','true');const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('role','img');svg.setAttribute('aria-label','Mapa do Brasil por estado, com resultados oficiais do primeiro turno');for(const f of mapGeo.features||[]){const uf=String(f.properties?.sigla||f.properties?.uf||'').toUpperCase();if(!UF_NAMES[uf])continue;const rows=mapResults[uf]||[];const flavio=rows.find(x=>/fl[aá]vio.*bolsonaro/i.test(x.candidato||''));const lula=rows.find(x=>/\blula\b|luiz in[aá]cio lula/i.test(x.candidato||''));const color=flavio&&lula?(Number(flavio.votos)>Number(lula.votos)?'#2476b9':Number(lula.votos)>Number(flavio.votos)?'#e6b92b':'#9ba9b8'):'#9ba9b8';const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',pathFor(f.geometry));p.setAttribute('fill',color);p.setAttribute('stroke','#fff');p.setAttribute('stroke-width','1.4');p.setAttribute('tabindex','0');p.setAttribute('role','button');const ftxt=flavio?`${Number(flavio.votos).toLocaleString('pt-BR')} votos (${pctBR(flavio.percentual)}%)`:'sem dados',ltxt=lula?`${Number(lula.votos).toLocaleString('pt-BR')} votos (${pctBR(lula.percentual)}%)`:'sem dados';const info=`${UF_NAMES[uf]} (${uf}) — Flávio Bolsonaro: ${ftxt}; Lula: ${ltxt}.`;const html=`<strong>${escapeHTML(UF_NAMES[uf])} (${uf})</strong><span>Flávio Bolsonaro: ${escapeHTML(ftxt)}</span><br><span>Lula: ${escapeHTML(ltxt)}</span>`;p.setAttribute('aria-label',info);p.addEventListener('pointerenter',e=>{tip.innerHTML=html;positionMapTooltip(e,box,tip);});p.addEventListener('pointermove',e=>positionMapTooltip(e,box,tip));p.addEventListener('pointerleave',()=>{tip.classList.remove('is-visible');tip.setAttribute('aria-hidden','true');});const select=()=>{electionText('voteMapStatic',info);};p.addEventListener('focus',select);p.addEventListener('click',select);svg.appendChild(p);}box.replaceChildren(svg,tip);}catch(e){box.textContent='Mapa temporariamente indisponível. Consulte a fonte oficial do TSE.';}}

function bindElectionControls(){loadPollInstitutes();const inst=getEl('pollInstitute');inst?.addEventListener('input',()=>{clearTimeout(pollInputTimer);pollInputTimer=setTimeout(()=>{pollPage=1;pollSelectedUid='';loadPolls();},280);});getEl('pollHasResults')?.addEventListener('change',()=>{pollPage=1;pollSelectedUid='';loadPolls();});getEl('pollLeadership')?.addEventListener('change',()=>{pollPage=1;pollSelectedUid='';loadPolls();});for(const id of ['pollFrom','pollTo'])getEl(id)?.addEventListener('change',()=>{pollPage=1;pollSelectedUid='';loadPolls();});getEl('pollRefresh')?.addEventListener('click',()=>{pollPage=1;pollSelectedUid='';loadPolls();});document.querySelectorAll('[data-poll-stage]').forEach(b=>b.addEventListener('click',()=>{pollStage=b.dataset.pollStage;pollPage=1;pollSelectedUid='';document.querySelectorAll('[data-poll-stage]').forEach(x=>x.classList.toggle('selected',x===b));if(getEl('pollFrom'))getEl('pollFrom').value='';if(getEl('pollTo'))getEl('pollTo').value='';if(getEl('pollInstitute'))getEl('pollInstitute').value='';loadPolls();}));}

bindElectionControls();



initializeRadar();

// ============================================================

// APOIO V1.5.6 — photo sprite index + localized UI
const APOIO_PHOTO_IDS=["100001924397","100001925244","100001937596","100001960485","100001967626","100001970547","100001983274","100001994407","100002022751","100002023057","100002024666","100002038095","100002038598","100002042851","100002043400","100002045570","100002047325","100002049290","100002064766","100002088370","100002088795","100002099415","100002106782","100002116016","100002131996","100002144725","100002172120","100002183692","100002207926","100002212772","100002220189","100002234832","100002259349","100002260477","100002291921","100002321643","100002346571","100002347235","100002358149","100002535230","100002535476","100002535478","100002535480","100002535490","100002536093","100002536094","100002536097","100002536098","100002536101","100002537259","100002537267","100002537271","100002537272","100002537278","100002537280","100002537283","100002537286","100002537287","100002537291","100002537299","100002540256","100002540258","100002540259","100002540260","100002540261","100002540263","100002540265","100002540267","100002540268","100002540269","100002540272","100002540273","100002540274","100002540280","100002540281","100002540282","100002540283","100002542855","100002542860","100002542867","100002542869","100002542878","100002542884","100002548011","10002532422","10002532442","10002532447","10002532489","10002532492","10002533895","10002533980","10002536323","10002536331","10002536340","10002544107","10002544296","10002544519","10002544522","10002544524","10002544526","10002544532","10002544534","10002544540","10002544541","10002544542","10002545228","10002545229","10002545231","10002545233","10002545646","10002545649","10002545655","10002545660","10002548050","110001676176","110001940908","110001996654","110002006115","110002016362","110002039629","110002039836","110002040857","110002105396","110002118922","110002125932","110002178805","110002198020","110002198023","110002204657","110002241875","110002250381","110002251070","110002261086","110002263995","110002270125","110002329491","110002392467","110002538410","110002538411","110002538413","110002539005","110002539234","110002539237","110002539240","110002540128","110002542636","110002542638","110002542640","110002542642","110002542646","110002542649","110002547793","110002547799","110002547808","110002547809","110002549187","110002550704","110002550706","110002550849","110002550850","110002550859","110002550863","110002550866","110002551480","110002551966","110002552693","120002059321","120002077189","120002151580","120002213712","120002327592","120002535764","120002535769","120002536054","120002536055","120002536056","120002536060","120002536066","120002536067","120002536068","120002536069","120002536072","120002536281","120002536282","120002536286","120002536582","120002537355","120002537356","120002537505","120002537512","120002538788","120002538791","120002539694","120002539703","120002539708","120002539710","120002544705","130001883244","130001892609","130001894958","130001898057","130001898940","130001900400","130001920174","130001930577","130001930916","130001931354","130001941342","130001946672","130001957786","130001971712","130001974320","130001974414","130001988956","130001994885","130002002205","130002002751","130002004532","130002022576","130002024505","130002054339","130002054530","130002063078","130002065170","130002065567","130002066025","130002069393","130002097639","130002098777","130002113648","130002116600","130002141449","130002147893","130002160131","130002174185","130002182495","130002185862","130002202387","130002208239","130002223585","130002231338","130002243662","130002255768","130002285269","130002285625","130002289425","130002302990","130002339256","130002340167","130002371855","130002384408","130002515256","130002534510","130002534569","130002537199","130002537202","130002537223","130002539884","130002539885","130002539905","130002539910","130002541998","130002542000","130002542003","130002542004","130002542007","130002542008","130002542011","130002542015","130002542016","130002542017","130002542019","130002542021","130002542022","130002542026","130002542027","130002542031","130002542034","130002542036","130002542039","130002542043","130002542044","130002542047","130002542048","130002542054","130002542058","130002542060","130002542062","130002542066","130002542068","130002542071","130002542072","130002542079","130002542080","130002542081","130002542082","130002542093","130002542094","130002542096","130002542107","130002542109","130002542110","130002542113","130002542695","130002542701","130002542715","130002542730","130002542738","130002542743","130002542747","130002542748","130002542753","130002542754","130002542764","130002542782","130002542804","130002542812","130002547896","130002548716","130002548769","130002548795","130002551786","130002552296","140002182323","140002536775","140002536805","140002540452","140002540454","140002540455","140002540456","140002540461","140002540462","140002540476","140002541710","140002541711","140002541713","140002541714","140002541717","140002541723","140002541727","140002541728","140002541729","140002541730","140002541732","140002541733","140002541738","140002544232","140002544257","140002544268","140002546709","140002546710","140002546711","140002547295","140002547302","140002549255","140002549262","140002549265","140002549266","140002549269","140002549285","140002549286","140002549930","140002550779","140002550780","140002551125","140002551126","140002551127","140002551139","140002551143","150001621390","150001883121","150001897265","150001909233","150001962077","150001984843","150002046768","150002114122","150002115370","150002122505","150002198736","150002213041","150002533578","150002538453","150002538457","150002540234","150002540238","150002540243","150002540246","150002541172","150002541190","150002541191","150002541192","150002541194","150002541204","150002544180","150002544184","150002544185","150002544186","150002544187","150002544190","150002544194","150002544197","150002544203","150002544205","150002544208","150002544905","150002548932","150002548935","150002548940","150002548943","150002548944","150002548945","150002548947","150002548950","150002548955","150002548956","150002549636","150002549638","150002549646","150002551789","160001914026","160001917672","160001929972","160001945741","160001955041","160001956981","160001990719","160001991340","160002000279","160002012743","160002015278","160002020182","160002020672","160002026883","160002028090","160002042104","160002056579","160002058274","160002059181","160002066703","160002071218","160002073905","160002074350","160002082707","160002112336","160002119584","160002123262","160002128544","160002137656","160002144728","160002147993","160002162099","160002187376","160002210282","160002212728","160002216706","160002216841","160002217650","160002220867","160002228773","160002242393","160002255783","160002266919","160002274259","160002274840","160002281849","160002284692","160002291926","160002295631","160002305875","160002358294","160002368625","160002527792","160002532851","160002532856","160002532857","160002532858","160002532859","160002532878","160002533442","160002533447","160002533451","160002533460","160002533479","160002533488","160002540768","160002540769","160002540782","160002540833","160002542287","160002542291","160002542296","160002542297","160002542371","160002542377","160002542382","160002546900","160002547466","160002547500","160002547530","160002547537","160002547550","160002547552","160002547562","160002547565","160002547568","160002547569","160002547585","160002547593","160002547597","160002547605","160002547608","160002547611","160002547614","160002547616","160002547624","160002547629","160002547632","160002547636","160002547640","160002547646","160002547648","160002547650","160002547660","160002547661","160002547679","160002547690","170001935254","170001993467","170002200184","170002530336","170002532296","170002532386","170002532733","170002532954","170002534906","170002534909","170002534911","170002535172","170002535174","170002535176","170002535184","170002535197","170002535207","170002535809","170002535821","170002537254","170002539162","170002539181","170002539230","170002539474","170002539476","170002543723","170002543726","170002543728","170002543737","170002543747","170002543751","170002543757","170002543759","170002544057","170002544062","170002544063","170002544066","180002533967","180002536214","180002536216","180002536217","180002536218","180002536221","180002536231","180002536234","180002536235","180002536461","180002536465","180002539019","180002539021","180002539038","180002539127","180002544106","190001883923","190001898195","190001904710","190001925900","190001929459","190001933507","190001940780","190001944674","190001954887","190001993802","190001995937","190002012987","190002021916","190002038277","190002045117","190002123025","190002124033","190002129333","190002158256","190002161358","190002192768","190002532795","190002532804","190002532805","190002532807","190002532809","190002532810","190002532816","190002532817","190002532819","190002532820","190002532823","190002532827","190002532834","190002532835","190002533418","190002533420","190002533421","190002533422","190002533424","190002533425","190002533429","190002533433","190002533674","190002533686","190002533687","190002533688","190002533695","190002533699","190002533703","190002533704","190002533706","190002533707","190002533709","190002533710","190002533711","190002534633","190002534708","190002535140","190002535142","190002538819","190002538863","190002539336","190002541060","190002541063","190002541068","190002541078","190002541086","190002541091","190002541635","190002541637","190002541640","190002541653","190002541658","190002541672","190002541675","190002541679","190002541682","190002542887","190002542888","190002542973","190002543037","190002543040","190002543363","200001603037","200001885514","200001889077","200001912434","200001913455","200001940756","200001954830","200001976846","200002020548","200002038419","200002038551","200002109364","200002116321","200002121743","200002122093","200002131539","200002194074","200002313204","200002533875","200002533877","200002533880","200002533885","200002533888","200002534370","200002534419","200002534421","200002534423","200002534425","200002534427","200002534448","200002535255","200002535715","200002535722","200002535725","200002535726","200002535728","200002535730","200002535734","200002535736","20002546939","20002546941","20002547841","20002547843","20002547844","20002547849","20002548089","20002548090","20002548091","20002548092","20002548094","20002548095","20002548097","20002548099","20002548100","20002548101","20002548102","20002548105","20002548106","20002548107","20002548110","20002548324","20002548325","20002548326","20002548335","20002548338","20002550917","20002550946","20002553272","210001941369","210001973174","210001985198","210001987448","210001996295","210002017038","210002027228","210002039807","210002054814","210002057825","210002060967","210002065816","210002077247","210002108112","210002130590","210002134976","210002137765","210002158365","210002162924","210002165331","210002191353","210002216835","210002218586","210002222568","210002225770","210002261601","210002266220","210002266867","210002287050","210002292179","210002293944","210002295373","210002295883","210002310164","210002310504","210002315174","210002533002","210002533056","210002534270","210002534277","210002534313","210002534334","210002534654","210002534656","210002534664","210002534668","210002534671","210002534897","210002534898","210002534899","210002535664","210002535669","210002535670","210002535671","210002535683","210002535685","210002535691","210002535698","210002535703","210002535704","210002535706","210002535710","210002536917","210002536933","210002537644","210002537645","210002537649","210002537653","210002537712","210002537714","210002537717","210002537718","210002537726","210002537883","210002537885","210002537886","210002537896","210002539056","210002539057","210002539072","210002539092","210002541510","210002541512","210002541514","210002547816","210002547819","210002547857","210002548192","210002548193","210002548202","210002548207","210002548220","220001713729","220001928126","220001970198","220002011706","220002015095","220002043578","220002050662","220002125805","220002141646","220002219710","220002248720","220002249941","220002285985","220002536028","220002536029","220002536038","220002536041","220002536880","220002536882","220002536886","220002537549","220002537554","220002537555","220002537557","220002537559","220002537560","220002537562","220002539995","220002539996","220002541939","220002542189","220002542943","220002542944","220002547327","220002547330","220002547362","220002547372","230002024202","230002533356","230002533367","230002533376","230002533378","230002533380","230002534800","230002534804","230002538160","230002538165","230002538166","230002538184","230002538187","230002549223","230002549243","230002549248","230002549251","230002549297","230002549300","230002549303","230002549333","230002549339","230002549341","230002549344","230002549347","230002549349","230002549352","230002549355","230002549356","230002549628","230002549630","230002552760","230002553006","240001611131","240001899757","240001904159","240001907797","240001908008","240001920683","240001922044","240001932411","240001932909","240001933761","240001934280","240001942595","240001949601","240001949979","240001950315","240001972301","240001977491","240001982125","240001988534","240001990737","240001991059","240001991148","240001992440","240001992643","240001994497","240001999059","240002003720","240002008845","240002017486","240002019680","240002026332","240002027599","240002027615","240002028976","240002032497","240002033559","240002034313","240002045112","240002046981","240002050986","240002051998","240002054534","240002057769","240002058683","240002061457","240002062051","240002069763","240002071175","240002073903","240002106310","240002109579","240002130888","240002141451","240002142357","240002142774","240002143376","240002150565","240002155845","240002167635","240002170508","240002184717","240002198468","240002213541","240002215945","240002217064","240002222147","240002227842","240002229657","240002231457","240002233860","240002249600","240002264178","240002264260","240002266099","240002275708","240002277976","240002283076","240002289268","240002291983","240002295529","240002301940","240002322012","240002341866","240002342453","240002344809","240002350058","240002371592","240002380149","240002385314","240002398027","240002535434","240002535452","240002537073","240002537081","240002537915","240002537919","240002537938","240002538368","240002539368","240002539371","240002539376","240002539377","240002539378","240002539382","240002539384","240002539561","240002539565","240002539960","240002539963","240002539964","240002539969","240002539970","240002539971","240002539972","240002539973","240002539976","240002539977","240002539981","240002539983","240002539987","240002539988","240002539990","240002539991","240002541377","240002541379","240002541382","240002541393","240002541406","240002541919","240002541931","240002541935","240002543392","240002543409","240002543410","240002543418","250001612472","250001885007","250001885033","250001885611","250001897832","250001898942","250001904418","250001904845","250001906755","250001911277","250001913103","250001918328","250001918851","250001921615","250001926389","250001929746","250001931351","250001932783","250001936698","250001937546","250001945043","250001951559","250001952165","250001953544","250001955156","250001958672","250001965084","250001969387","250001969696","250001970985","250001971403","250001973646","250001976535","250001976704","250001977820","250001979473","250001984259","250001985234","250001986400","250001987193","250001993855","250001996769","250002009041","250002012223","250002013710","250002017119","250002020657","250002021751","250002025288","250002026045","250002026232","250002028092","250002028132","250002032879","250002034654","250002044014","250002045727","250002046904","250002048256","250002056958","250002059288","250002059304","250002060043","250002077523","250002121829","250002125269","250002125954","250002140911","250002148502","250002148597","250002152811","250002157283","250002157734","250002158410","250002161809","250002162805","250002164176","250002171657","250002179574","250002182998","250002198741","250002200929","250002206899","250002207435","250002216170","250002216480","250002216948","250002220886","250002227624","250002232418","250002234384","250002236920","250002238481","250002246484","250002247651","250002273411","250002291178","250002295695","250002297457","250002317462","250002329382","250002340031","250002348445","250002349275","250002480946","250002530115","250002530167","250002530239","250002532342","250002532353","250002532355","250002532378","250002532379","250002533624","250002533647","250002533664","250002533666","250002533740","250002533748","250002533757","250002533758","250002533768","250002533776","250002533778","250002533798","250002533809","250002534220","250002534232","250002534242","250002534251","250002534269","250002535936","250002535940","250002535947","250002535948","250002535951","250002535954","250002535955","250002535958","250002535959","250002535965","250002535968","250002535972","250002535975","250002535980","250002535982","250002535986","250002535991","250002535994","250002535995","250002536344","250002536352","250002536353","250002536356","250002536358","250002536361","250002536366","250002536367","250002536375","250002536377","250002536380","250002536384","250002536387","250002536388","250002536389","250002536393","250002536395","250002536404","250002536405","250002536406","250002536407","250002536410","250002536413","250002536415","250002536419","250002536423","250002536429","250002537942","250002537943","250002537953","250002537969","250002537973","250002537979","250002541303","250002541308","250002541312","250002541857","250002541861","250002541864","250002541870","250002541873","250002541902","250002544326","250002544330","250002544340","250002544341","250002544355","250002544357","250002545142","250002545145","250002545147","250002545156","250002545172","250002545207","260001935427","260001938946","260001960396","260002048718","260002105677","260002533079","260002533084","260002535596","260002535597","260002535601","260002535754","260002535762","260002547408","260002547411","260002547412","260002548691","260002548692","260002548698","260002549381","260002549384","260002549385","260002550754","260002550765","270002127217","270002235464","270002258466","270002544470","270002544478","270002544480","270002544481","270002544482","270002544484","270002544599","270002544633","270002544649","270002544650","270002546333","270002548344","270002548402","270002548403","270002548421","270002548429","270002548433","270002548450","270002548456","270002548458","270002548521","270002548522","270002548525","270002550085","270002550089","270002550095","270002550096","270002550098","30002004927","30002530071","30002530514","30002532034","30002532038","30002536304","30002536305","30002536306","30002538084","30002538135","30002539109","30002539110","30002539119","30002539120","30002539122","30002539124","30002549864","30002549865","30002549877","30002549880","30002549884","30002549894","30002549896","40001924422","40002081867","40002531441","40002531445","40002531447","40002532734","40002532736","40002532751","40002533207","40002534377","40002540480","40002540481","40002541593","40002541594","40002541626","40002541745","40002541747","40002541749","40002542661","40002542667","40002542670","40002542676","40002542965","40002542968","40002542971","50002086886","50002531452","50002532502","50002532504","50002532530","50002532550","50002532561","50002532564","50002532883","50002532899","50002532900","50002532910","50002534977","50002534983","50002534990","50002534999","50002535000","50002535004","50002535007","50002535008","50002535029","50002535030","50002535032","50002535049","50002535050","50002535060","50002535065","50002535068","50002535081","50002535085","50002535102","50002535103","50002535104","50002535119","50002535120","50002536627","50002538714","50002538724","60002534881","60002534888","60002534893","60002536195","60002536196","60002536203","60002536967","60002536977","60002536979","60002536984","60002542442","60002542447","60002542459","60002542827","60002542831","60002542832","60002542833","60002542842","60002542851","60002544112","60002545115","60002545132","70002538486","70002538488","70002538493","70002538503","70002538527","70002538796","70002538797","70002538800","70002538935","70002540817","70002540824","70002540832","70002541286","70002550000","70002550001","70002550004","70002550009","70002550019","70002550316","70002550319","70002550322","70002552934","70002552936","70002553055","80001720164","80001980699","80001992093","80002011631","80002297304","80002339202","80002536278","80002537475","80002537484","80002537485","80002537487","80002542390","80002542404","80002542409","80002542410","80002549097","80002549101","80002549103","80002549110","80002549410","80002549411","80002549412","80002549424","80002549425","80002549430","80002549439","80002549442","80002549443","80002549445","80002549451","80002549698","80002549986","80002549987","80002552172","80002552682","80002553265","80002554483","90001652051","90001894711","90001930723","90001955975","90001956804","90001958456","90001966507","90001975144","90001975664","90001988130","90001990789","90001996901","90002001744","90002005961","90002008530","90002012954","90002015718","90002017450","90002024518","90002071135","90002077356","90002078050","90002169751","90002186710","90002213855","90002251667","90002266222","90002275430","90002537390","90002537428","90002537441","90002540967","90002540987","90002540993","90002540997","90002542616","90002542618","90002542624","90002542626","90002543218","90002543226","90002543237","90002543239","90002543243","90002543246","90002543556","90002543783","90002543795","90002543799","90002543800","90002543807","90002546219","90002546220","90002546221","90002546224","90002546225","90002546244","90002547010","90002547018","90002547030","90002547032","90002547039","90002548074","90002548376","90002554683"];
const APOIO_PHOTO_INDEX=new Map(APOIO_PHOTO_IDS.map((id,i)=>[String(id),i]));
const APOIO_UI={
 pt:{all:'Todos',vote:'Pediu voto',mention:'Falou',silent:'Não falou',off:'Sem postar',nored:'Sem coleta',norecord:'Sem registro',today:'Hoje',yesterday:'Ontem',dayBefore:'Anteontem',mentions5d:'menções · 5 dias',last24:'últimas 24 h',askedVote:'pediu voto',noProfiles:'Sem perfis documentados',lastEvidence:'Última evidência',viewPost:'Ver publicação ↗',noEvidence:'Sem evidências neste recorte.',noResults:'Sem registros para os filtros selecionados.',people:'pessoas',previous:'← Anterior',next:'Próxima →',views:'visualizações',interactions:'interações'},
 en:{all:'All',vote:'Asked for votes',mention:'Mentioned',silent:'Did not mention',off:'No posts',nored:'Not collected',norecord:'No record',today:'Today',yesterday:'Yesterday',dayBefore:'Two days ago',mentions5d:'mentions · 5 days',last24:'last 24 h',askedVote:'asked for votes',noProfiles:'No documented profiles',lastEvidence:'Latest evidence',viewPost:'View post ↗',noEvidence:'No evidence in this view.',noResults:'No records match the selected filters.',people:'people',previous:'← Previous',next:'Next →',views:'views',interactions:'interactions'},
 es:{all:'Todos',vote:'Pidió el voto',mention:'Mencionó',silent:'No mencionó',off:'Sin publicaciones',nored:'Sin recolección',norecord:'Sin registro',today:'Hoy',yesterday:'Ayer',dayBefore:'Anteayer',mentions5d:'menciones · 5 días',last24:'últimas 24 h',askedVote:'pidió el voto',noProfiles:'Sin perfiles documentados',lastEvidence:'Última evidencia',viewPost:'Ver publicación ↗',noEvidence:'Sin evidencias en este recorte.',noResults:'No hay registros para los filtros seleccionados.',people:'personas',previous:'← Anterior',next:'Siguiente →',views:'visualizaciones',interactions:'interacciones'}
};
const apoioT=k=>(APOIO_UI[lang]||APOIO_UI.pt)[k]||k;
function apoioPhotoStyle(sq){const i=APOIO_PHOTO_INDEX.get(String(sq||'').trim());if(i==null)return null;const sheet=Math.floor(i/400)+1,j=i%400,cell=42,scale=cell/64,x=(j%20)*64*scale,y=Math.floor(j/20)*64*scale;return `background-image:url('/images/candidatos/sprite-${sheet}.webp?v=1.5.7');background-position:-${x}px -${y}px;background-size:${1280*scale}px auto;background-repeat:no-repeat`;}

// APOIO V1.4 — snapshot normalizado do Flaviômetro, sem D1
const APOIO_NETWORKS={instagram:'Instagram',facebook:'Facebook',x:'X / Twitter',tiktok:'TikTok',youtube:'YouTube',threads:'Threads',kwai:'Kwai',telegram:'Telegram'};
const APOIO_STATUS={vote:'Pediu voto',mention:'Falou',silent:'Não falou',off:'Sem postar',nored:'Sem coleta',unclassified:'Post recente'};
let apoioData={people:[],posts:[],metrics:{}},apoioKind='all',apoioPostTab='recent',apoioLoaded=false,apoioLoading=null,apoioPage=1,apoioPostsPage=1,apoioUfMode='top5',apoioTerritoryUf='all';const APOIO_PAGE_SIZE=24,APOIO_POST_PAGE_SIZE=12;
function apoioEsc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function apoioNum(v){return Number.isFinite(Number(v))?Number(v).toLocaleString(lang==='en'?'en-US':lang==='es'?'es-ES':'pt-BR'):'—';}
function apoioSet(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}
function apoioAgo(t){if(!t)return'';const m=Math.max(0,Math.floor((Date.now()-Number(t))/60000));if(m<60)return`há ${m} min`;if(m<1440)return`há ${Math.floor(m/60)} h`;return`há ${Math.floor(m/1440)} d`;}
function apoioFilters(){return {party:document.getElementById('apoioParty')?.value||'all',role:document.getElementById('apoioRole')?.value||'all',uf:document.getElementById('apoioState')?.value||'all',network:document.getElementById('apoioNetwork')?.value||'all',name:(document.getElementById('apoioName')?.value||'').trim().toLocaleLowerCase(lang==='en'?'en-US':lang==='es'?'es-ES':'pt-BR'),sort:document.getElementById('apoioSort')?.value||'active'};}
function apoioPersonStatus(p,network='all'){if(network==='all')return p.status||'nored';if(!Array.isArray(p.networks)||!p.networks.includes(network))return'nored';const x=p.stats?.[network];return x?.vote?'vote':x?.rel?'mention':x?.n?'silent':'off';}
function apoioBasePeople(){const f=apoioFilters();return apoioData.people.filter(p=>(f.party==='all'||p.party===f.party)&&(f.role==='all'||p.role===f.role)&&(f.uf==='all'||p.uf===f.uf)&&(f.network==='all'||p.networks?.includes(f.network))&&String(p.name||'').toLocaleLowerCase(lang==='en'?'en-US':lang==='es'?'es-ES':'pt-BR').includes(f.name));}
function apoioFilteredPeople(){const f=apoioFilters();return apoioBasePeople().filter(p=>apoioKind==='all'||apoioPersonStatus(p,f.network)===apoioKind);}
function apoioFilteredPosts(){const f=apoioFilters();return apoioData.posts.filter(p=>(apoioKind==='all'||p.kind===apoioKind)&&(f.party==='all'||p.party===f.party)&&(f.role==='all'||p.role===f.role)&&(f.uf==='all'||p.uf===f.uf)&&(f.network==='all'||p.network===f.network)&&String(p.name||'').toLocaleLowerCase(lang==='en'?'en-US':lang==='es'?'es-ES':'pt-BR').includes(f.name));}
function apoioPopulate(id,values,allLabel){const el=document.getElementById(id);if(!el)return;const old=el.value;el.replaceChildren(new Option(allLabel,'all'));[...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')).forEach(x=>el.add(new Option(x,x)));el.value=[...el.options].some(x=>x.value===old)?old:'all';}
function apoioRenderSummaries(){const f=apoioFilters(),base=apoioBasePeople(),counts={vote:0,mention:0,silent:0,off:0,nored:0};base.forEach(p=>counts[apoioPersonStatus(p,f.network)]++);const manual=apoioData?.manualImport===true&&f.party==='all'&&f.role==='all'&&f.uf==='all'&&f.network==='all'&&!f.name;apoioSet('apoioKpiTotal',apoioNum(manual?apoioData.metrics?.total:base.length));apoioSet('apoioKpiSpoke',apoioNum(manual?apoioData.metrics?.spoke:counts.vote+counts.mention));apoioSet('apoioKpiVote',apoioNum(manual?apoioData.metrics?.vote:counts.vote));apoioSet('apoioKpi72',apoioNum(manual?(apoioData.metrics?.mentions5d??apoioData.metrics?.spoke):base.reduce((n,p)=>n+(Number(p.mentions5d??p.mentions72h)||0),0)));const ps=apoioFilteredPosts().filter(p=>Number(p.date)>=Number(apoioData.window?.from24||0));apoioSet('apoioKpiViews',apoioNum(manual?apoioData.metrics?.views24h:ps.reduce((n,p)=>n+(Number(p.views)||0),0)));apoioRenderUfChart();}
function apoioRenderUfChart(){const el=document.getElementById('apoioUfChart');if(!el)return;const posts=apoioFilteredPosts().filter(p=>p.uf&&p.date);const to=Number(apoioData.window?.to)||Date.now(),day=86400000,days=Array.from({length:5},(_,i)=>{const d=new Date(to-(4-i)*day);return {key:new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime(),label:d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})};});const by={};for(const p of posts){const d=new Date(Number(p.date)),k=new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();by[p.uf] ||= Object.fromEntries(days.map(x=>[x.key,0]));if(k in by[p.uf])by[p.uf][k]++;}let ufs=Object.keys(by).sort((a,b)=>Object.values(by[b]).reduce((x,y)=>x+y,0)-Object.values(by[a]).reduce((x,y)=>x+y,0));if(apoioTerritoryUf!=='all')ufs=ufs.filter(uf=>uf===apoioTerritoryUf);else if(apoioUfMode==='top5')ufs=ufs.slice(0,5);if(!ufs.length){el.innerHTML='<div class="apoio-empty">Sem ações por UF neste recorte.</div>';return;}const W=920,H=260,padL=42,padR=18,padT=18,padB=42,max=Math.max(1,...ufs.flatMap(uf=>days.map(d=>by[uf][d.key]||0))),colors=['#0f5b9d','#dc2626','#12816d','#8b5cf6','#d97706','#0891b2','#be185d','#4f46e5','#65a30d','#9333ea','#ea580c','#0284c7','#16a34a','#7c3aed','#c2410c','#0369a1','#15803d','#6d28d9','#b91c1c','#0f766e','#a16207','#1d4ed8','#047857','#9f1239','#4338ca','#854d0e','#334155'];const x=i=>padL+i*((W-padL-padR)/4),y=v=>padT+(H-padT-padB)*(1-v/max);let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Ações por UF nos últimos cinco dias">`;for(let g=0;g<=4;g++){const yy=padT+g*(H-padT-padB)/4;svg+=`<line x1="${padL}" y1="${yy}" x2="${W-padR}" y2="${yy}" class="uf-grid"/><text x="${padL-8}" y="${yy+4}" text-anchor="end" class="uf-axis">${Math.round(max*(4-g)/4)}</text>`;}days.forEach((d,i)=>svg+=`<text x="${x(i)}" y="${H-14}" text-anchor="middle" class="uf-axis">${d.label}</text>`);ufs.forEach((uf,j)=>{const pts=days.map((d,i)=>`${x(i)},${y(by[uf][d.key]||0)}`).join(' ');svg+=`<polyline points="${pts}" fill="none" stroke="${colors[j%colors.length]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;days.forEach((d,i)=>svg+=`<circle cx="${x(i)}" cy="${y(by[uf][d.key]||0)}" r="3.5" fill="${colors[j%colors.length]}"><title>${uf} · ${d.label}: ${by[uf][d.key]||0}</title></circle>`);});svg+='</svg>';const legend=ufs.map((uf,j)=>`<span><i style="background:${colors[j%colors.length]}"></i>${apoioEsc(uf)} <b>${apoioNum(Object.values(by[uf]).reduce((a,b)=>a+b,0))}</b></span>`).join('');el.innerHTML=`${svg}<div class="apoio-uf-legend">${legend}</div>`;}
function apoioRenderCriteria(){const el=document.getElementById('apoioCriteriaPosts');if(!el)return;const rows=[...apoioFilteredPosts()].sort((a,b)=>Number(b.date)-Number(a.date)).slice(0,4);el.innerHTML=rows.length?rows.map(p=>`<article class="apoio-mini-post"><div><span class="apoio-pill ${p.kind}">${apoioEsc(APOIO_STATUS[p.kind])}</span><strong>${apoioEsc(p.name)}</strong><small>${apoioEsc(APOIO_NETWORKS[p.network]||p.network)} · ${apoioAgo(p.date)}</small></div><p>${apoioEsc(p.text||'Publicação documentada pela fonte.')}</p>${p.url?`<a href="${apoioEsc(p.url)}" target="_blank" rel="noopener noreferrer">Ver publicação original ↗</a>`:''}</article>`).join(''):'<div class="apoio-empty">Sem evidências neste recorte.</div>';}
function apoioSortPeople(rows){const f=apoioFilters();return [...rows].sort((a,b)=>{if(f.sort==='name')return String(a.name).localeCompare(String(b.name),'pt-BR');if(f.sort==='recent')return (Number(b.lastRelevant)||0)-(Number(a.lastRelevant)||0);if(f.sort==='absent'){const aa=Number(a.mentions5d??a.mentions72h)||0,bb=Number(b.mentions5d??b.mentions72h)||0;return aa-bb||(Number(a.lastRelevant)||0)-(Number(b.lastRelevant)||0)||String(a.name).localeCompare(String(b.name),'pt-BR');}return (Number(b.mentions5d??b.mentions72h)||0)-(Number(a.mentions5d??a.mentions72h)||0)||(Number(b.vote5d??b.vote72h)||0)-(Number(a.vote5d??a.vote72h)||0)||(Number(b.lastRelevant)||0)-(Number(a.lastRelevant)||0);});}
function apoioFiveDayStatus(p){const a=p.activity5d||p.activity72||[];if(!a.length)return'norecord';if((Number(p.vote5d??p.vote72h)||0)>0)return'vote';if((Number(p.talk5d??p.talk72h)||0)>0)return'mention';return'silent';}
function apoioTimeline(p){let days=Array.isArray(p.dailyActivity5d)?p.dailyActivity5d:[];if(!days.length){const now=Number(apoioData.window?.to)||Date.now(),src=p.activity5d||p.activity72||[];days=Array.from({length:5},(_,i)=>{const d=new Date(now-i*86400000),key=`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,rows=src.filter(a=>{const x=new Date(Number(a.date));return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`===key;});let kind='norecord';if(rows.some(x=>x.kind==='vote'))kind='vote';else if(rows.some(x=>x.kind==='mention'))kind='mention';else if(rows.some(x=>x.kind==='silent'))kind='silent';return {date:new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime(),kind,posts:rows.length};});}const labels=['Hoje','Ontem','Anteontem'];return days.slice(0,5).map((x,i)=>`<i class="apoio-square ${x.kind||'norecord'}" title="${labels[i]||new Date(x.date).toLocaleDateString('pt-BR')} · ${apoioEsc(APOIO_STATUS[x.kind]||'Sem registro')}${x.posts?` · ${x.posts} publicação(ões)`:''}"></i>`).join('');}
function apoioSocialLinks(p){const seen=new Set();return (p.socials||[]).filter(s=>{const k=`${s.network}|${s.url}`;if(seen.has(k))return false;seen.add(k);return true;}).map(s=>`<a class="apoio-social" href="${apoioEsc(s.url)}" target="_blank" rel="noopener noreferrer" title="${apoioEsc(s.handle||'')}">${apoioEsc(APOIO_NETWORKS[s.network]||s.network)}</a>`).join('');}
function apoioPersonCard(p,f){const five=apoioFiveDayStatus(p),lp=(p.latestPosts||[])[0],style=apoioPhotoStyle(p.sq),label=apoioT(five);const avatar=style?`<div class="apoio-avatar apoio-photo is-sprite" style="${style}" role="img" aria-label="${apoioEsc(p.name)}"></div>`:`<div class="apoio-avatar apoio-photo is-fallback" role="img" aria-label="${apoioEsc(p.name)}"></div>`;return `<article class="apoio-person-card state-${five}"><header>${avatar}<div class="apoio-person-id"><strong>${apoioEsc(p.name)}</strong><small>${apoioEsc([p.party,p.role,p.uf].filter(Boolean).join(' · '))}</small></div><span class="apoio-pill ${five}">${apoioEsc(label)}</span></header><div class="apoio-person-metrics"><div><strong>${apoioNum(p.mentions5d??p.mentions72h??0)}</strong><span>${apoioT('mentions5d')}</span></div><div><strong>${apoioNum(p.mentions24h||0)}</strong><span>${apoioT('last24')}</span></div><div><strong>${apoioNum(p.vote5d??p.vote72h??0)}</strong><span>${apoioT('askedVote')}</span></div></div><div class="apoio-timeline" aria-label="${apoioEsc(apoioT('mentions5d'))}">${apoioTimeline(p)}</div><div class="apoio-legend-mini"><span><i class="apoio-square vote"></i> ${apoioT('vote')}</span><span><i class="apoio-square mention"></i> ${apoioT('mention')}</span><span><i class="apoio-square silent"></i> ${apoioT('silent')}</span><span><i class="apoio-square norecord"></i> ${apoioT('norecord')}</span></div><div class="apoio-socials">${apoioSocialLinks(p)||`<span>${apoioT('noProfiles')}</span>`}</div>${lp?`<div class="apoio-last-post"><small>${apoioT('lastEvidence')} · ${apoioEsc(APOIO_NETWORKS[lp.network]||lp.network)} · ${apoioAgo(lp.date)}</small><p>${apoioEsc(lp.text||'')}</p>${lp.url?`<a href="${apoioEsc(lp.url)}" target="_blank" rel="noopener noreferrer">${apoioT('viewPost')}</a>`:''}</div>`:''}</article>`;}
function apoioPaginationHtml(id,total,page,size,onPage){const el=document.getElementById(id);if(!el)return page;const pages=Math.max(1,Math.ceil(total/size));page=Math.min(page,pages);let nums=[];for(let i=Math.max(1,page-2);i<=Math.min(pages,page+2);i++)nums.push(i);el.innerHTML=`<button ${page===1?'disabled':''} data-page="${page-1}">${apoioT('previous')}</button>${page>3?'<span>…</span>':''}${nums.map(i=>`<button class="${i===page?'active':''}" data-page="${i}">${i}</button>`).join('')}${page<pages-2?'<span>…</span>':''}<button ${page===pages?'disabled':''} data-page="${page+1}">${apoioT('next')}</button>`;el.querySelectorAll('button[data-page]').forEach(b=>b.addEventListener('click',()=>onPage(Number(b.dataset.page)||1)));return page;}
function renderApoio(){const people=document.getElementById('apoioPeople'),posts=document.getElementById('apoioPosts');if(!people||!posts)return;const f=apoioFilters(),rows=apoioSortPeople(apoioFilteredPeople()),filteredPosts=apoioFilteredPosts();apoioRenderSummaries();apoioRenderCriteria();const from=(apoioPage-1)*APOIO_PAGE_SIZE,pageRows=rows.slice(from,from+APOIO_PAGE_SIZE);apoioSet('apoioCount',rows.length?`${apoioNum(from+1)}–${apoioNum(Math.min(from+APOIO_PAGE_SIZE,rows.length))} de ${apoioNum(rows.length)} pessoas`:'0 pessoas');people.innerHTML=pageRows.length?pageRows.map(p=>apoioPersonCard(p,f)).join(''):'<div class="apoio-empty">Sem registros para os filtros selecionados.</div>';apoioPage=apoioPaginationHtml('apoioPagination',rows.length,apoioPage,APOIO_PAGE_SIZE,n=>{apoioPage=n;renderApoio();document.getElementById('apoioPeople')?.scrollIntoView({behavior:'smooth',block:'start'});});const sorted=[...filteredPosts].sort((a,b)=>apoioPostTab==='engaged'?(Number(b.engagement||0)-Number(a.engagement||0)):(Number(b.date||0)-Number(a.date||0)));const pf=(apoioPostsPage-1)*APOIO_POST_PAGE_SIZE,pr=sorted.slice(pf,pf+APOIO_POST_PAGE_SIZE);posts.innerHTML=pr.length?pr.map(p=>`<article class="apoio-post"><div class="apoio-post-title"><strong>${apoioEsc(p.name)}</strong><small>${apoioEsc(APOIO_NETWORKS[p.network]||p.network||'Rede não identificada')}</small></div><p>${apoioEsc(p.text||'Publicação documentada na fonte.')}</p><footer><span class="apoio-pill ${p.kind}">${apoioEsc(APOIO_STATUS[p.kind]||p.kind)}</span><span>${p.date?new Date(p.date).toLocaleString('pt-BR'):''}</span>${p.views!=null?`<span>${apoioNum(p.views)} visualizações</span>`:''}${p.engagement?`<span>${apoioNum(p.engagement)} interações</span>`:''}${p.url?`<a href="${apoioEsc(p.url)}" target="_blank" rel="noopener noreferrer">Ver publicação original ↗</a>`:''}</footer></article>`).join(''):'<div class="apoio-empty">Nenhuma publicação classificada pela fonte para este recorte.</div>';apoioPostsPage=apoioPaginationHtml('apoioPostsPagination',sorted.length,apoioPostsPage,APOIO_POST_PAGE_SIZE,n=>{apoioPostsPage=n;renderApoio();document.getElementById('apoioPosts')?.scrollIntoView({behavior:'smooth',block:'start'});});}
async function loadApoio(force=false){if(apoioLoaded&&!force){renderApoio();return apoioData;}if(apoioLoading&&!force)return apoioLoading;apoioSet('apoioStatus','CONSULTANDO FONTE');apoioSet('apoioNotice','Consultando o snapshot validado da fonte externa…');apoioLoading=(async()=>{try{const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),20000);let res;try{res=await fetch(`${RADAR_API.baseUrl}/api/apoio`,{signal:ctl.signal,cache:'no-store',headers:{accept:'application/json'}});}finally{clearTimeout(timer);}const d=await res.json();if(!res.ok||!Array.isArray(d.people))throw Error(d?.message||`HTTP ${res.status}`);apoioData=d;apoioLoaded=true;apoioSet('apoioStatus',d.manualImport?'SNAPSHOT MANUAL VALIDADO':(d.status==='ok'?'DADOS SINCRONIZADOS':'ÚLTIMA CÓPIA VÁLIDA'));apoioSet('apoioNotice',d.message||'Classificações reproduzidas da fonte; silêncio não é interpretado como oposição.');apoioPopulate('apoioParty',d.people.map(p=>p.party),'Todos');apoioPopulate('apoioRole',d.people.map(p=>p.role),'Todos');apoioPopulate('apoioState',d.people.map(p=>p.uf),'Todas');apoioPopulate('apoioTerritoryUf',d.people.map(p=>p.uf),'Todas');renderApoio();return d;}catch(e){console.error('[Radar Apoio] Falha ao carregar',e);apoioSet('apoioStatus','FONTE INDISPONÍVEL');apoioSet('apoioNotice',`Não foi possível consultar a fonte agora (${e?.message||'erro desconhecido'}).`);renderApoio();return null;}finally{apoioLoading=null;}})();return apoioLoading;}
function initApoio(){const root=document.getElementById('panel-apoio');if(!root)return;if(!root.dataset.apoioBound){root.dataset.apoioBound='1';root.querySelectorAll('#apoioKind button').forEach(b=>b.addEventListener('click',()=>{root.querySelectorAll('#apoioKind button').forEach(x=>x.classList.remove('active'));b.classList.add('active');apoioKind=b.dataset.v;apoioPage=1;apoioPostsPage=1;renderApoio();}));root.querySelectorAll('#apoioPostTabs button').forEach(b=>b.addEventListener('click',()=>{root.querySelectorAll('#apoioPostTabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');apoioPostTab=b.dataset.v;apoioPostsPage=1;renderApoio();}));root.querySelectorAll('#apoioUfMode button').forEach(b=>b.addEventListener('click',()=>{root.querySelectorAll('#apoioUfMode button').forEach(x=>x.classList.remove('active'));b.classList.add('active');apoioUfMode=b.dataset.v;apoioRenderUfChart();}));document.getElementById('apoioTerritoryUf')?.addEventListener('change',e=>{apoioTerritoryUf=e.target.value||'all';apoioRenderUfChart();});['apoioParty','apoioRole','apoioState','apoioNetwork','apoioSort'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>{apoioPage=1;apoioPostsPage=1;renderApoio();}));document.getElementById('apoioName')?.addEventListener('input',()=>{apoioPage=1;apoioPostsPage=1;renderApoio();});}loadApoio();}
function bootstrapApoioIfActive(){const root=document.getElementById('panel-apoio');if(root?.classList.contains('active')||root?.classList.contains('is-active'))initApoio();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootstrapApoioIfActive,{once:true});else bootstrapApoioIfActive();


// V1.5.6: re-render dynamic Apoio strings after language switches.
document.querySelectorAll('[id^="lang-"]').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>{if(apoioLoaded)renderApoio();},0)));

// Eurasia Group: last validated assessment + incremental, date-filtered revision history.
const EURASIA_I18N={
 pt:{eurasia_eyebrow:'ANÁLISE DE RISCO POLÍTICO · FONTE EXTERNA',eurasia_title:'probabilidade estimada de vitória',eurasia_intro:'Avaliação de consultoria especializada; não é pesquisa eleitoral nem preço de contrato.',eurasia_source:'Consultar Eurasia ↗',eurasia_loading:'Consultando histórico validado...',eurasia_period:'Histórico',eurasia_24h:'Últimas 24 horas',eurasia_48h:'Últimas 48 horas',eurasia_7d:'7 dias',eurasia_15d:'15 dias',eurasia_30d:'30 dias',eurasia_all:'Início das eleições',eurasia_disclaimer:'A última estimativa validada permanece visível independentemente do filtro. O histórico inclui somente revisões publicadas no período; não há interpolação.',eurasia_empty:'Nenhuma revisão publicada no período selecionado.',eurasia_last:'Última avaliação',eurasia_checked:'Última verificação',eurasia_unavailable:'Histórico indisponível nesta consulta.',eurasia_review:'Em verificação'},
 en:{eurasia_eyebrow:'POLITICAL RISK ANALYSIS · EXTERNAL SOURCE',eurasia_title:'estimated chance of winning',eurasia_intro:'Specialist consultancy assessment; not an opinion poll or a traded contract price.',eurasia_source:'Visit Eurasia ↗',eurasia_loading:'Loading verified history...',eurasia_period:'History',eurasia_24h:'Last 24 hours',eurasia_48h:'Last 48 hours',eurasia_7d:'7 days',eurasia_15d:'15 days',eurasia_30d:'30 days',eurasia_all:'Since election monitoring began',eurasia_disclaimer:'The last verified estimate remains visible regardless of filter. History contains only published revisions, without interpolation.',eurasia_empty:'No revisions published in this period.',eurasia_last:'Last assessment',eurasia_checked:'Last check',eurasia_unavailable:'History unavailable.',eurasia_review:'Pending verification'},
 es:{eurasia_eyebrow:'ANÁLISIS DE RIESGO POLÍTICO · FUENTE EXTERNA',eurasia_title:'probabilidad estimada de victoria',eurasia_intro:'Evaluación de consultora especializada; no es una encuesta ni un precio de contrato.',eurasia_source:'Consultar Eurasia ↗',eurasia_loading:'Consultando historial verificado...',eurasia_period:'Historial',eurasia_24h:'Últimas 24 horas',eurasia_48h:'Últimas 48 horas',eurasia_7d:'7 días',eurasia_15d:'15 días',eurasia_30d:'30 días',eurasia_all:'Desde el inicio del seguimiento',eurasia_disclaimer:'La última estimación verificada permanece visible independientemente del filtro. Solo se muestran revisiones publicadas, sin interpolación.',eurasia_empty:'No hay revisiones publicadas en este período.',eurasia_last:'Última evaluación',eurasia_checked:'Última revisión',eurasia_unavailable:'Historial no disponible.',eurasia_review:'Pendiente de verificación'}
};
for(const code of ['pt','en','es'])Object.assign(translations[code]||{},EURASIA_I18N[code]);
const eurasiaT=k=>(EURASIA_I18N[lang]||EURASIA_I18N.pt)[k]||k;
let eurasiaCache=null,eurasiaLastFetch=0,eurasiaLoading=false;
function renderEurasia(){
 const data=eurasiaCache;if(!data)return;
 const status=getEl('eurasiaStatus'),values=getEl('eurasiaValues'),history=getEl('eurasiaHistory');if(!status||!values||!history)return;
 const loc=lang==='en'?'en-US':lang==='es'?'es-ES':'pt-BR';
 const fmt=d=>{if(!d)return '—';const dt=new Date(d.length===10?d+'T12:00:00Z':d);return Number.isNaN(dt.getTime())?'—':dt.toLocaleDateString(loc,{day:'2-digit',month:'short',year:'numeric'});};
 const latest=data.latest;values.replaceChildren();history.replaceChildren();
 if(latest){
  const wrap=document.createElement('div');wrap.className='eurasia-probabilities';
  for(const [name,val,cls] of [['Flávio Bolsonaro',latest.flavio,'flavio'],['Lula',latest.lula,'lula']]){
   const el=document.createElement('div');el.className='eurasia-probability '+cls;
   const label=document.createElement('span');label.textContent=name;
   const strong=document.createElement('strong');strong.textContent=Number(val).toLocaleString(loc,{maximumFractionDigits:1})+'%';
   const track=document.createElement('div');track.className='eurasia-track';const fill=document.createElement('i');fill.style.width=Math.min(100,Math.max(0,val))+'%';track.appendChild(fill);
   el.append(label,strong,track);wrap.appendChild(el);
  }
  values.appendChild(wrap);
 }
 const checked=data.monitor?.checkedAt?` · ${eurasiaT('eurasia_checked')}: ${fmt(data.monitor.checkedAt)}`:'';
 status.textContent=latest?`${eurasiaT('eurasia_last')}: ${fmt(latest.assessmentDate)} · ${latest.sourceName}${checked} · ${data.pendingCount||0} ${eurasiaT('eurasia_review')}`:eurasiaT('eurasia_empty');
 const period=getEl('eurasiaPeriod')?.value||'all';const cutoff=period==='all'?0:Date.now()-Number(period)*86400000;
 const rows=(data.history||[]).filter(x=>Date.parse(x.assessmentDate+'T12:00:00Z')>=cutoff).slice().reverse();
 if(!rows.length){const p=document.createElement('p');p.className='eurasia-empty';p.textContent=eurasiaT('eurasia_empty');history.appendChild(p);return;}
 for(const row of rows){const item=document.createElement('article');item.className='eurasia-revision';item.setAttribute('role','listitem');const date=document.createElement('time');date.dateTime=row.assessmentDate;date.textContent=fmt(row.assessmentDate);const score=document.createElement('strong');score.textContent=`Flávio ${row.flavio}% · Lula ${row.lula}%`;const link=document.createElement('a');link.href=row.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';link.textContent=row.sourceName+' ↗';item.append(date,score,link);history.appendChild(item);}
}
async function loadEurasia(){
 if(!getEl('eurasiaStatus')||eurasiaLoading)return;
 if(eurasiaCache&&Date.now()-eurasiaLastFetch<300000){renderEurasia();return;}
 eurasiaLoading=true;
 try{const r=await fetch(`${RADAR_API.baseUrl}/api/eurasia`);if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json();if(data.status!=='ok')throw Error(data.status);eurasiaCache=data;eurasiaLastFetch=Date.now();renderEurasia();}
 catch(e){getEl('eurasiaStatus').textContent=eurasiaT('eurasia_unavailable');}
 finally{eurasiaLoading=false;}
}
document.addEventListener('change',event=>{if(event.target?.id==='eurasiaPeriod')renderEurasia();});
document.addEventListener('click',event=>{if(event.target?.closest?.('[data-lang]'))setTimeout(()=>{if(eurasiaCache)renderEurasia();},0);});


// ============================================================
// V1.6.0 — HISTÓRICO INCREMENTAL DA VISÃO GERAL
// O estado atual continua vindo das fontes atuais. D1 guarda somente
// snapshots relevantes e o frontend consulta uma série já agregada.
// ============================================================
const OVERVIEW_HISTORY_I18N={
 pt:{overview_history_eyebrow:'HISTÓRICO',overview_history_title:'Comparar Visão Geral',overview_history_forming:'O histórico começa a ser preservado após a ativação desta versão.',overview_history_period:'Período',overview_24h:'Últimas 24 horas',overview_48h:'Últimas 48 horas',overview_7d:'7 dias',overview_15d:'15 dias',overview_30d:'30 dias',overview_election:'Início das eleições'},
 en:{overview_history_eyebrow:'HISTORY',overview_history_title:'Compare Overview',overview_history_forming:'History starts being preserved after this version is activated.',overview_history_period:'Period',overview_24h:'Last 24 hours',overview_48h:'Last 48 hours',overview_7d:'7 days',overview_15d:'15 days',overview_30d:'30 days',overview_election:'Start of the election period'},
 es:{overview_history_eyebrow:'HISTÓRICO',overview_history_title:'Comparar Visión General',overview_history_forming:'El histórico comienza a conservarse después de activar esta versión.',overview_history_period:'Período',overview_24h:'Últimas 24 horas',overview_48h:'Últimas 48 horas',overview_7d:'7 días',overview_15d:'15 días',overview_30d:'30 días',overview_election:'Inicio de las elecciones'}
};
for(const code of ['pt','en','es'])Object.assign(translations[code]||{},OVERVIEW_HISTORY_I18N[code]);
let overviewHistoryCache=new Map();
function overviewPeriodLabel(v){return ({'24h':'24 h','48h':'48 h','7d':'7 dias','15d':'15 dias','30d':'30 dias','election':'início das eleições'})[v]||v;}
function overviewDeltaText(current,baseline,period,kind='count'){
 const c=Number(current),b=Number(baseline);if(!Number.isFinite(c)||!Number.isFinite(b))return {text:'Histórico em formação',cls:''};
 const d=c-b;if(d===0)return {text:`Sem variação em ${overviewPeriodLabel(period)}`,cls:'is-flat'};
 const sign=d>0?'+':'';const arrow=d>0?'▲':'▼';
 if(kind==='count')return {text:`${sign}${d.toLocaleString('pt-BR')} ${arrow} em ${overviewPeriodLabel(period)}`,cls:d>0?'is-up':'is-down'};
 return {text:`${sign}${d.toLocaleString('pt-BR')} ${arrow} em ${overviewPeriodLabel(period)}`,cls:d>0?'is-up':'is-down'};
}
function renderOverviewHistory(data){
 const period=getEl('overviewPeriod')?.value||'7d';const status=getEl('overviewHistoryStatus');
 const current=calculateMetrics(filteredNews.length?filteredNews:(liveNews||[]));const peak=calculatePeak(filteredNews.length?filteredNews:(liveNews||[]));
 const base=data?.baseline;
 const values={metricMentions:[current.total,base?.total_articles],metricTopics:[current.candidateMentions,base?.candidate_mentions],metricSources:[current.publishers,base?.unique_publishers],metricPeak:[peak.count,base?.peak_count]};
 for(const [id,pair] of Object.entries(values)){const el=getEl(id+'Delta');if(!el)continue;const d=overviewDeltaText(pair[0],pair[1],period);el.textContent=d.text;el.className='overview-delta '+d.cls;}
 if(status){if(!data||data.status!=='ok')status.textContent='Histórico temporariamente indisponível; os dados atuais continuam funcionando.';else if(!base)status.textContent='Histórico em formação. A primeira referência será criada pela próxima coleta agendada.';else status.textContent=`Comparação com ${data.baseline.reference_at_display||'o início do período'} · ${data.points?.length||0} snapshot(s) no intervalo.`;}
}
async function loadOverviewHistory(force=false){
 const select=getEl('overviewPeriod');if(!select)return;const period=select.value||'7d';
 if(!force&&overviewHistoryCache.has(period)){renderOverviewHistory(overviewHistoryCache.get(period));return;}
 try{const r=await fetch(`${RADAR_API.baseUrl}/api/overview/history?period=${encodeURIComponent(period)}`,{cache:'no-store'});const d=await r.json();if(!r.ok||d.status!=='ok')throw Error(d.message||r.status);overviewHistoryCache.set(period,d);renderOverviewHistory(d);}catch(e){renderOverviewHistory(null);}
}
document.addEventListener('change',e=>{if(e.target?.id==='overviewPeriod')loadOverviewHistory(true);});
// V1.6.3: consultas históricas permanecem pausadas até o T0 global.
// A Visão Geral continua funcional com dados atuais e o período global.


// V1.6.1 — rótulos e sincronização do período global
Object.assign(translations.pt||{}, {period_7d:'7 dias',period_15d:'15 dias',period_30d:'30 dias',period_election:'Início das eleições'});
Object.assign(translations.en||{}, {period_7d:'7 days',period_15d:'15 days',period_30d:'30 days',period_election:'Start of the election period'});
Object.assign(translations.es||{}, {period_7d:'7 días',period_15d:'15 días',period_30d:'30 días',period_election:'Inicio de las elecciones'});
document.addEventListener('change',e=>{if(e.target?.id==='period')syncOverviewPeriodFromGlobal(true);});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>syncOverviewPeriodFromGlobal(false),{once:true});else syncOverviewPeriodFromGlobal(false);


// ============================================================
// V1.6.3 — MENÇÕES: preparação histórica (T0 ainda desativado)
// O período global controla a aba. Até a ativação do T0, nenhuma consulta
// histórica adicional é disparada automaticamente contra o D1.
// ============================================================
const MENTIONS_PERIOD_LABELS={
 pt:{'24h':'Últimas 24 horas','48h':'Últimas 48 horas','7d':'7 dias','15d':'15 dias','30d':'30 dias','election':'Início das eleições'},
 en:{'24h':'Last 24 hours','48h':'Last 48 hours','7d':'7 days','15d':'15 days','30d':'30 days','election':'Start of the election period'},
 es:{'24h':'Últimas 24 horas','48h':'Últimas 48 horas','7d':'7 días','15d':'15 días','30d':'30 días','election':'Inicio de las elecciones'}
};
function syncMentionsPeriodUI(){
 const p=getEl('period')?.value||'24h'; const lang=(document.documentElement.lang||'pt').slice(0,2);
 const label=getEl('mentionsPeriodLabel'); if(label) label.textContent=(MENTIONS_PERIOD_LABELS[lang]||MENTIONS_PERIOD_LABELS.pt)[p]||p;
 const status=getEl('mentionsHistoryStatus');
 if(status) status.textContent=lang==='en'?'History prepared · activation at the initial snapshot':lang==='es'?'Histórico preparado · activación en el snapshot inicial':'Histórico preparado · ativação no snapshot inicial';
}
document.addEventListener('change',e=>{if(e.target?.id==='period')syncMentionsPeriodUI();});
document.addEventListener('click',e=>{if(e.target?.closest?.('[data-lang]'))setTimeout(syncMentionsPeriodUI,0);});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',syncMentionsPeriodUI,{once:true});else syncMentionsPeriodUI();

// V1.6.7 — Apoio acompanha o período global sem consultar D1.
(function(){
 const labels={"24h":"Últimas 24 horas","48h":"Últimas 48 horas","7d":"7 dias","15d":"15 dias","30d":"30 dias","election":"Início das eleições"};
 function apoioGlobalPeriodV167(){
  const sel=document.querySelector('#periodFilter, #period, select[name="period"]');
  const raw=String(sel?.value||'24h');
  const normalized=raw==='24'?'24h':raw==='48'?'48h':raw==='7'?'7d':raw==='15'?'15d':raw==='30'?'30d':raw==='all'?'election':raw;
  const out=document.getElementById('apoioHistoryPeriod'); if(out)out.textContent=labels[normalized]||labels['24h'];
 }
 document.addEventListener('DOMContentLoaded',()=>{apoioGlobalPeriodV167();document.querySelectorAll('select').forEach(x=>x.addEventListener('change',apoioGlobalPeriodV167));document.getElementById('applyFilters')?.addEventListener('click',apoioGlobalPeriodV167);});
 window.apoioGlobalPeriodV167=apoioGlobalPeriodV167;
})();


// V1.6.8 — Pesquisas: o período global prepara o recorte histórico.
// A listagem atual preserva os filtros próprios (etapa, instituto e datas)
// até a camada pública KV ser materializada no T0.
(function(){
 const labels={"24h":"Últimas 24 horas","48h":"Últimas 48 horas","7d":"7 dias","15d":"15 dias","30d":"30 dias","election":"Início das eleições"};
 function pollsGlobalPeriodV168(){
  const sel=document.querySelector('#periodFilter, #period, select[name="period"]');
  const raw=String(sel?.value||'24h');
  const normalized=raw==='24'?'24h':raw==='48'?'48h':raw==='7'?'7d':raw==='15'?'15d':raw==='30'?'30d':raw==='all'?'election':raw;
  const out=document.getElementById('pollsHistoryPeriod'); if(out)out.textContent=labels[normalized]||labels['24h'];
 }
 document.addEventListener('DOMContentLoaded',()=>{pollsGlobalPeriodV168();document.querySelectorAll('select').forEach(x=>x.addEventListener('change',pollsGlobalPeriodV168));document.getElementById('applyFilters')?.addEventListener('click',pollsGlobalPeriodV168);});
 window.pollsGlobalPeriodV168=pollsGlobalPeriodV168;
})();


// V1.6.9 — Voto agora: período global prepara a consulta histórica.
// A visualização ao vivo continua mostrando o estado oficial mais recente do TSE.
(function(){
 const labels={"24h":"Últimas 24 horas","48h":"Últimas 48 horas","7d":"7 dias","15d":"15 dias","30d":"30 dias","election":"Início das eleições"};
 function voteGlobalPeriodV169(){
  const sel=document.querySelector('#periodFilter, #period, select[name="period"]');
  const raw=String(sel?.value||'24h');
  const normalized=raw==='24'?'24h':raw==='48'?'48h':raw==='7'?'7d':raw==='15'?'15d':raw==='30'?'30d':raw==='all'?'election':raw;
  const out=document.getElementById('voteHistoryPeriod'); if(out)out.textContent=labels[normalized]||labels['24h'];
 }
 document.addEventListener('DOMContentLoaded',()=>{voteGlobalPeriodV169();document.querySelectorAll('select').forEach(x=>x.addEventListener('change',voteGlobalPeriodV169));document.getElementById('applyFilters')?.addEventListener('click',voteGlobalPeriodV169);});
 window.voteGlobalPeriodV169=voteGlobalPeriodV169;
})();
