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
    coverageMovement: "/api/coverage-movement"

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



    metricPeak.textContent =

      formatNumber(

        peak.count

      );



  }



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



function renderKeywords() {



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

    "48h";





  const periodHours =

    selectedPeriod === "24h"

      ? 24

      : 48;





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

    container.innerHTML = `

      <div class="emerging-empty">

        <strong>${escapeHTML(texts.emerging_insufficient_title)}</strong>

        <span>${escapeHTML(texts.emerging_insufficient_desc)}</span>

      </div>

    `;

    return;

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

function renderDisinfo(){

 const stats=getEl('disinfoStats'), list=getEl('disinfoList'); if(!stats||!list)return;

 const texts={

  pt:['Publicações relacionadas','Notícias sobre checagens','Alegações e alertas','Fontes distintas','Nenhuma publicação sobre checagens ou alegações encontrada neste recorte. Isso não significa ausência de desinformação.','Ler publicação ↗','Aguardando notícias da API.','Nenhuma notícia disponível no corpus atual.','O filtro selecionado não encontrou registros. Experimente “Todas as pessoas” ou ampliar o período.','Registros encontrados no corpus de notícias; correspondência por termos, sem verificação automática.'],

  en:['Related publications','Fact-check coverage','Claims and alerts','Distinct sources','No related coverage found for this selection. This does not imply an absence of misinformation.','Read publication ↗','Waiting for news API.','No news available in the current dataset.','No matching records. Try “All people” or a longer period.','Keyword-based coverage, not automated fact verification.'],

  es:['Publicaciones relacionadas','Noticias sobre verificaciones','Alegaciones y alertas','Fuentes distintas','No se encontró cobertura relacionada en esta selección. Esto no implica ausencia de desinformación.','Leer publicación ↗','Esperando noticias de la API.','No hay noticias en el conjunto actual.','No hay registros para estos filtros. Pruebe “Todas las personas” o amplíe el período.','Cobertura basada en palabras clave, sin verificación automática.']

 }[lang]||[];

 const ui={pt:{scope:["Pessoa mencionada","Todas as pessoas","Flávio Bolsonaro","Lula","Ambos na mesma matéria"],period:["Período","48 horas","7 dias"],type:["Todos os registros","Notícias sobre checagens","Alegações e alertas"],sort:["Mais recentes","Por fonte"],search:"Pesquisar título, fonte ou assunto"},en:{scope:["Person mentioned","All people","Flávio Bolsonaro","Lula","Both in the same article"],period:["Period","48 hours","7 days"],type:["All records","Fact-check coverage","Claims and alerts"],sort:["Most recent","By source"],search:"Search title, source or topic"},es:{scope:["Persona mencionada","Todas las personas","Flávio Bolsonaro","Lula","Ambos en la misma noticia"],period:["Período","48 horas","7 días"],type:["Todos los registros","Noticias sobre verificaciones","Alegaciones y alertas"],sort:["Más recientes","Por fuente"],search:"Buscar título, fuente o tema"}}[lang]||{};

 const scopeEl=getEl('disinfoScope'), periodEl=getEl('disinfoPeriod'), typeEl=getEl('disinfoType'), sortEl=getEl('disinfoSort'), searchEl=getEl('disinfoSearch');

 if(scopeEl){scopeEl.previousElementSibling.textContent=ui.scope[0]; [...scopeEl.options].forEach((o,i)=>o.textContent=ui.scope[i+1]);}

 if(periodEl){periodEl.previousElementSibling.textContent=ui.period[0]; [...periodEl.options].forEach((o,i)=>o.textContent=ui.period[i+1]);}

 if(typeEl)[...typeEl.options].forEach((o,i)=>o.textContent=ui.type[i]);

 if(sortEl)[...sortEl.options].forEach((o,i)=>o.textContent=ui.sort[i]);

 if(searchEl){searchEl.placeholder=ui.search;searchEl.setAttribute('aria-label',ui.search);}

 const all=Array.isArray(liveNews)?liveNews:[];

 const scope=getEl('disinfoScope')?.value||'all';

 const hours=Number(getEl('disinfoPeriod')?.value||48);

 const since=Date.now()-hours*3600000;

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

 stats.innerHTML=[[texts[0],relevant.length,'all'],[texts[1],checks,'checks'],[texts[2],relevant.length-checks,'claims'],[texts[3],distinct,null]].map(([name,num,type])=>`<div class="disinfo-stat" ${type?`role="button" tabindex="0" data-disinfo-type="${type}" aria-label="${escapeHTML(name)}: ${num}"`:''}><span>${escapeHTML(name)}</span><strong>${formatNumber(num)}</strong></div>`).join('');

 const q=normalizeText(getEl('disinfoSearch')?.value||'');const type=getEl('disinfoType')?.value||'all';const sort=getEl('disinfoSort')?.value||'recent';

 const selected=relevant.filter(a=>(type==='all'||a._disinfoType===type)&&(!q||normalizeText([a.title,disinfoPublisher(a),a.publisher,a.source,a.sourceName,a.subtitle,a.description].join(' ')).includes(q)));

 selected.sort((a,b)=>sort==='source'?disinfoPublisher(a).localeCompare(disinfoPublisher(b),'pt-BR'):(new Date(b.publishedAt||0)-new Date(a.publishedAt||0)));

 const hint=getEl('disinfoDiagnostics');if(hint)hint.textContent=liveNews===null?texts[6]:!all.length?texts[7]:`${all.length} notícias recebidas · ${base.length} no recorte · ${relevant.length} relacionadas. ${texts[9]}`;

 const empty=liveNews===null?texts[6]:!all.length?texts[7]:!base.length?texts[8]:texts[4];

 list.innerHTML=selected.length?selected.slice(0,40).map(a=>{

  const label=a._disinfoType==='checks'?texts[1]:texts[2];const name=disinfoPublisher(a);const url=String(a.url||a.link||'');const safe=/^https?:\/\//i.test(url)?escapeHTML(url):'';

  const excerpt=String(a.subtitle||a.description||'').trim();

  return `<article class="disinfo-item"><div class="disinfo-meta"><span>${escapeHTML(name)} · ${escapeHTML(formatDateTime(a.publishedAt))}</span><span class="disinfo-badge">${escapeHTML(label)}</span></div><h4>${escapeHTML(a.title||'Sem título')}</h4>${excerpt?`<p>${escapeHTML(excerpt.slice(0,230))}</p>`:''}${safe?`<a href="${safe}" target="_blank" rel="noopener noreferrer">${escapeHTML(texts[5])}</a>`:''}</article>`;

 }).join(''):`<p class="disinfo-empty">${escapeHTML(empty)}</p>`;

}

['disinfoSearch','disinfoType','disinfoSort','disinfoScope','disinfoPeriod'].forEach(id=>document.addEventListener('input',e=>{if(e.target?.id===id)renderDisinfo()}));

document.addEventListener('click',e=>{const item=e.target.closest('[data-disinfo-type]');if(!item)return;const select=getEl('disinfoType');if(select){select.value=item.dataset.disinfoType;renderDisinfo()}});

document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-disinfo-type]')){e.preventDefault();e.target.click()}});



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

    period.value = "48h";

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

    const response = await fetch(`${RADAR_API.baseUrl}${RADAR_API.endpoints.youtube}?scope=${encodeURIComponent(scope)}`, { cache: "no-store" });

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

    summary.textContent = `${items.length} de ${totalMatches} vídeo${totalMatches===1?"":"s"} compatíveis • ${channels} canal${channels===1?"":"is"} • últimos 7 dias`;

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

 pt:{tab_polls:'Pesquisas',tab_vote:'Voto agora',polls_label:'LEVANTAMENTOS PUBLICADOS',polls_title:'Pesquisas eleitorais',polls_intro:'Resultados publicados e documentados, sem estimativas.',polls_institute:'Instituto',all_institutes:'Todos os institutos',polls_from:'De',polls_to:'Até',polls_leadership:'Liderança',polls_leadership_all:'Todas',polls_leadership_flavio:'Flávio lidera',polls_leadership_lula:'Lula lidera',polls_leadership_other:'Outro lidera',polls_leadership_tie:'Empate',refresh:'Atualizar',poll_accuracy_low:'Institutos mais próximos do resultado',poll_accuracy_high:'Institutos mais distantes do resultado',poll_method:'Ranking por instituto baseado no erro absoluto médio (MAE), em pontos percentuais, de sua pesquisa nacional de 1º turno mais recente. Cobertura de candidatos e datas podem variar.',vote_official:'RESULTADOS OFICIAIS',vote_title:'Voto agora',vote_intro:'Apuração presidencial publicada pelo TSE, sem projeções.',first_round:'Primeiro turno',second_round:'Segundo turno · 25/10/2026',vote_refresh:'Atualização automática durante a apuração, conforme disponibilidade de dados oficiais.',vote_method:'Números apenas após ingestão e validação de arquivos oficiais. Ausência de dados não significa zero votos.',empty_poll:'Ainda não há percentuais de pesquisas documentados na base histórica. Não serão exibidos valores estimados.',empty_vote:'Aguardando resultados oficiais validados.',vote_not_started:'Votação não iniciada. A divulgação da apuração está prevista a partir das 17h (Brasília) de 25/10.',poll_accuracy_pending:'Aguardando dados comparáveis e resultados oficiais para calcular diferenças.',loading_data:'Consultando dados...',error_data:'Não foi possível consultar os dados agora.'},

 en:{tab_polls:'Polls',tab_vote:'Vote now',polls_label:'PUBLISHED SURVEYS',polls_title:'Election polls',polls_intro:'Documented published results; no estimates.',polls_institute:'Polling organization',all_institutes:'All organizations',polls_from:'From',polls_to:'To',polls_leadership:'Leader',polls_leadership_all:'All',polls_leadership_flavio:'Flávio leads',polls_leadership_lula:'Lula leads',polls_leadership_other:'Another candidate leads',polls_leadership_tie:'Tie',refresh:'Refresh',poll_accuracy_low:'Smallest observed differences',poll_accuracy_high:'Largest observed differences',poll_method:'Differences require comparable polls and validated official results. Sampling margin of error is not the difference from the election result.',vote_official:'OFFICIAL RESULTS',vote_title:'Vote now',vote_intro:'Official presidential vote count; no projections.',first_round:'First round',second_round:'Second round · Oct 25, 2026',vote_refresh:'Automatic refresh during vote counting, subject to official availability.',vote_method:'Figures are displayed only after official source validation. Missing data does not mean zero votes.',empty_poll:'No documented polling percentages are available yet. No estimated figures will be shown.',empty_vote:'Awaiting validated official results.',vote_not_started:'Voting not started. Official results may be published from 5 pm Brasília time on Oct 25.',poll_accuracy_pending:'Comparable polls and official results are required to calculate differences.',loading_data:'Loading data...',error_data:'Data could not be loaded.'},

 es:{tab_polls:'Encuestas',tab_vote:'Voto ahora',polls_label:'ENCUESTAS PUBLICADAS',polls_title:'Encuestas electorales',polls_intro:'Resultados publicados y documentados, sin estimaciones.',polls_institute:'Instituto',all_institutes:'Todos los institutos',polls_from:'Desde',polls_to:'Hasta',polls_leadership:'Liderazgo',polls_leadership_all:'Todas',polls_leadership_flavio:'Flávio lidera',polls_leadership_lula:'Lula lidera',polls_leadership_other:'Otro candidato lidera',polls_leadership_tie:'Empate',refresh:'Actualizar',poll_accuracy_low:'Menores diferencias observadas',poll_accuracy_high:'Mayores diferencias observadas',poll_method:'Las diferencias requieren encuestas comparables y resultados oficiales validados. El margen de error no equivale a la diferencia electoral.',vote_official:'RESULTADOS OFICIALES',vote_title:'Voto ahora',vote_intro:'Escrutinio presidencial oficial, sin proyecciones.',first_round:'Primera vuelta',second_round:'Segunda vuelta · 25/10/2026',vote_refresh:'Actualización automática durante el escrutinio, según disponibilidad oficial.',vote_method:'Cifras solo después de validar archivos oficiales. La ausencia de datos no significa cero votos.',empty_poll:'Aún no hay porcentajes documentados en la base histórica. No se mostrarán estimaciones.',empty_vote:'Esperando resultados oficiales validados.',vote_not_started:'Votación no iniciada. Publicación prevista desde las 17 h de Brasilia del 25/10.',poll_accuracy_pending:'Se requieren encuestas comparables y resultados oficiales para calcular diferencias.',loading_data:'Consultando datos...',error_data:'No fue posible consultar los datos.'}

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

async function loadPolls(options={}){loadPolymarket();loadPollAccuracy();const status=getEl('pollStatus');if(!status)return;electionText('pollStatus',electT('loading_data'));const q=new URLSearchParams();const [min,max]=stageRange();q.set('from',getEl('pollFrom')?.value||min);q.set('to',getEl('pollTo')?.value||max);const institute=(getEl('pollInstitute')?.value||'').trim();if(institute)q.set('institute',institute);const hasResults=getEl('pollHasResults')?.value||'all';if(hasResults!=='all')q.set('has_results',hasResults);const leadership=getEl('pollLeadership')?.value||'all';if(leadership!=='all')q.set('leadership',leadership);q.set('page',String(pollPage));q.set('per_page',String(POLL_PAGE_SIZE));try{const r=await fetch(`${RADAR_API.baseUrl}/api/polls?${q}`,{cache:'no-store'});if(!r.ok)throw Error(r.status);const data=await r.json();if(data.status!=='ok')throw Error(data.status);pollData=data.polls||[];pollTotal=Number(data.total||0);const groups=pollGroups(pollData);const valid=pollData.filter(x=>x.candidato&&x.percentual!==null&&Number.isFinite(Number(x.percentual)));electionText('pollStatus',`${pollTotal.toLocaleString('pt-BR')} pesquisas encontradas · ${valid.length} percentuais documentados nesta página. Registro no TSE não comprova publicação dos resultados.`);const list=getEl('pollList');list.replaceChildren();for(const group of groups){const card=document.createElement('button');card.type='button';card.className='poll-card';card.dataset.pollUid=group.pesquisa_uid;const reg=String(group.registro_tse||'—');card.innerHTML=`<strong>${escapeHTML(group.instituto||'Instituto não informado')}</strong><small>Registro ${escapeHTML(reg)} · Divulgação: ${escapeHTML(group.data_divulgacao||'—')} · Amostra: ${Number(group.tamanho_amostra||0).toLocaleString('pt-BR')}</small><div class="poll-card-badges"><span>${group.margem_erro==null?'Margem não extraída':`±${pctBR(group.margem_erro)} pp`}</span><span>${group.results.length?`${group.results.length} resultado(s) documentado(s)`:'Somente registro TSE'}</span></div>`;card.addEventListener('click',()=>{pollSelectedUid=group.pesquisa_uid;list.querySelectorAll('.poll-card').forEach(x=>x.classList.toggle('is-selected',x===card));renderSelectedPoll(group);});list.appendChild(card);}renderPollPagination();let selected=groups.find(x=>x.pesquisa_uid===pollSelectedUid);if(!selected&&!options.keepSelection&&groups.length){selected=groups[0];pollSelectedUid=selected.pesquisa_uid;}if(selected){const el=list.querySelector(`[data-poll-uid="${CSS.escape(selected.pesquisa_uid)}"]`);el?.classList.add('is-selected');renderSelectedPoll(selected);}else renderSelectedPoll(null);}catch(e){electionText('pollStatus',electT('error_data'));}}

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
// APOIO V1.4 — snapshot normalizado do Flaviômetro, sem D1
const APOIO_NETWORKS={instagram:'Instagram',facebook:'Facebook',x:'X / Twitter',tiktok:'TikTok',youtube:'YouTube',threads:'Threads',kwai:'Kwai',telegram:'Telegram'};
const APOIO_STATUS={vote:'Pediu voto',mention:'Falou',silent:'Não falou',off:'Sem postar',nored:'Sem coleta'};
let apoioData={people:[],posts:[],metrics:{}},apoioKind='all',apoioPostTab='recent',apoioLoaded=false,apoioLoading=null,apoioPage=1,apoioPostsPage=1,apoioUfMode='top5';const APOIO_PAGE_SIZE=24,APOIO_POST_PAGE_SIZE=12;
function apoioEsc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function apoioNum(v){return Number.isFinite(Number(v))?Number(v).toLocaleString('pt-BR'):'—';}
function apoioSet(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}
function apoioAgo(t){if(!t)return'';const m=Math.max(0,Math.floor((Date.now()-Number(t))/60000));if(m<60)return`há ${m} min`;if(m<1440)return`há ${Math.floor(m/60)} h`;return`há ${Math.floor(m/1440)} d`;}
function apoioFilters(){return {party:document.getElementById('apoioParty')?.value||'all',role:document.getElementById('apoioRole')?.value||'all',uf:document.getElementById('apoioState')?.value||'all',network:document.getElementById('apoioNetwork')?.value||'all',name:(document.getElementById('apoioName')?.value||'').trim().toLocaleLowerCase('pt-BR'),sort:document.getElementById('apoioSort')?.value||'active'};}
function apoioPersonStatus(p,network='all'){if(network==='all')return p.status||'nored';if(!Array.isArray(p.networks)||!p.networks.includes(network))return'nored';const x=p.stats?.[network];return x?.vote?'vote':x?.rel?'mention':x?.n?'silent':'off';}
function apoioBasePeople(){const f=apoioFilters();return apoioData.people.filter(p=>(f.party==='all'||p.party===f.party)&&(f.role==='all'||p.role===f.role)&&(f.uf==='all'||p.uf===f.uf)&&(f.network==='all'||p.networks?.includes(f.network))&&String(p.name||'').toLocaleLowerCase('pt-BR').includes(f.name));}
function apoioFilteredPeople(){const f=apoioFilters();return apoioBasePeople().filter(p=>apoioKind==='all'||apoioPersonStatus(p,f.network)===apoioKind);}
function apoioFilteredPosts(){const f=apoioFilters();return apoioData.posts.filter(p=>(apoioKind==='all'||p.kind===apoioKind)&&(f.party==='all'||p.party===f.party)&&(f.role==='all'||p.role===f.role)&&(f.uf==='all'||p.uf===f.uf)&&(f.network==='all'||p.network===f.network)&&String(p.name||'').toLocaleLowerCase('pt-BR').includes(f.name));}
function apoioPopulate(id,values,allLabel){const el=document.getElementById(id);if(!el)return;const old=el.value;el.replaceChildren(new Option(allLabel,'all'));[...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')).forEach(x=>el.add(new Option(x,x)));el.value=[...el.options].some(x=>x.value===old)?old:'all';}
function apoioRenderSummaries(){const f=apoioFilters(),base=apoioBasePeople(),counts={vote:0,mention:0,silent:0,off:0,nored:0};base.forEach(p=>counts[apoioPersonStatus(p,f.network)]++);apoioSet('apoioKpiTotal',apoioNum(base.length));apoioSet('apoioKpiSpoke',apoioNum(counts.vote+counts.mention));apoioSet('apoioKpiVote',apoioNum(counts.vote));apoioSet('apoioKpi72',apoioNum(base.reduce((n,p)=>n+(Number(p.mentions5d??p.mentions72h)||0),0)));const ps=apoioFilteredPosts().filter(p=>Number(p.date)>=Number(apoioData.window?.from24||0));apoioSet('apoioKpiViews',apoioNum(ps.reduce((n,p)=>n+(Number(p.views)||0),0)));apoioRenderUfChart();}
function apoioRenderUfChart(){const el=document.getElementById('apoioUfChart');if(!el)return;const posts=apoioFilteredPosts().filter(p=>p.uf&&p.date);const to=Number(apoioData.window?.to)||Date.now(),day=86400000,days=Array.from({length:5},(_,i)=>{const d=new Date(to-(4-i)*day);return {key:new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime(),label:d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})};});const by={};for(const p of posts){const d=new Date(Number(p.date)),k=new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();by[p.uf] ||= Object.fromEntries(days.map(x=>[x.key,0]));if(k in by[p.uf])by[p.uf][k]++;}let ufs=Object.keys(by).sort((a,b)=>Object.values(by[b]).reduce((x,y)=>x+y,0)-Object.values(by[a]).reduce((x,y)=>x+y,0));if(apoioUfMode==='top5')ufs=ufs.slice(0,5);if(!ufs.length){el.innerHTML='<div class="apoio-empty">Sem ações por UF neste recorte.</div>';return;}const W=920,H=260,padL=42,padR=18,padT=18,padB=42,max=Math.max(1,...ufs.flatMap(uf=>days.map(d=>by[uf][d.key]||0))),colors=['#0f5b9d','#dc2626','#12816d','#8b5cf6','#d97706','#0891b2','#be185d','#4f46e5','#65a30d','#9333ea','#ea580c','#0284c7','#16a34a','#7c3aed','#c2410c','#0369a1','#15803d','#6d28d9','#b91c1c','#0f766e','#a16207','#1d4ed8','#047857','#9f1239','#4338ca','#854d0e','#334155'];const x=i=>padL+i*((W-padL-padR)/4),y=v=>padT+(H-padT-padB)*(1-v/max);let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Ações por UF nos últimos cinco dias">`;for(let g=0;g<=4;g++){const yy=padT+g*(H-padT-padB)/4;svg+=`<line x1="${padL}" y1="${yy}" x2="${W-padR}" y2="${yy}" class="uf-grid"/><text x="${padL-8}" y="${yy+4}" text-anchor="end" class="uf-axis">${Math.round(max*(4-g)/4)}</text>`;}days.forEach((d,i)=>svg+=`<text x="${x(i)}" y="${H-14}" text-anchor="middle" class="uf-axis">${d.label}</text>`);ufs.forEach((uf,j)=>{const pts=days.map((d,i)=>`${x(i)},${y(by[uf][d.key]||0)}`).join(' ');svg+=`<polyline points="${pts}" fill="none" stroke="${colors[j%colors.length]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;days.forEach((d,i)=>svg+=`<circle cx="${x(i)}" cy="${y(by[uf][d.key]||0)}" r="3.5" fill="${colors[j%colors.length]}"><title>${uf} · ${d.label}: ${by[uf][d.key]||0}</title></circle>`);});svg+='</svg>';const legend=ufs.map((uf,j)=>`<span><i style="background:${colors[j%colors.length]}"></i>${apoioEsc(uf)} <b>${apoioNum(Object.values(by[uf]).reduce((a,b)=>a+b,0))}</b></span>`).join('');el.innerHTML=`${svg}<div class="apoio-uf-legend">${legend}</div>`;}
function apoioRenderCriteria(){const el=document.getElementById('apoioCriteriaPosts');if(!el)return;const rows=[...apoioFilteredPosts()].sort((a,b)=>Number(b.date)-Number(a.date)).slice(0,4);el.innerHTML=rows.length?rows.map(p=>`<article class="apoio-mini-post"><div><span class="apoio-pill ${p.kind}">${apoioEsc(APOIO_STATUS[p.kind])}</span><strong>${apoioEsc(p.name)}</strong><small>${apoioEsc(APOIO_NETWORKS[p.network]||p.network)} · ${apoioAgo(p.date)}</small></div><p>${apoioEsc(p.text||'Publicação documentada pela fonte.')}</p>${p.url?`<a href="${apoioEsc(p.url)}" target="_blank" rel="noopener noreferrer">Ver publicação original ↗</a>`:''}</article>`).join(''):'<div class="apoio-empty">Sem evidências neste recorte.</div>';}
function apoioSortPeople(rows){const f=apoioFilters();return [...rows].sort((a,b)=>{if(f.sort==='name')return String(a.name).localeCompare(String(b.name),'pt-BR');if(f.sort==='recent')return (Number(b.lastRelevant)||0)-(Number(a.lastRelevant)||0);if(f.sort==='absent'){const aa=Number(a.mentions5d??a.mentions72h)||0,bb=Number(b.mentions5d??b.mentions72h)||0;return aa-bb||(Number(a.lastRelevant)||0)-(Number(b.lastRelevant)||0)||String(a.name).localeCompare(String(b.name),'pt-BR');}return (Number(b.mentions5d??b.mentions72h)||0)-(Number(a.mentions5d??a.mentions72h)||0)||(Number(b.vote5d??b.vote72h)||0)-(Number(a.vote5d??a.vote72h)||0)||(Number(b.lastRelevant)||0)-(Number(a.lastRelevant)||0);});}
function apoioFiveDayStatus(p){const a=p.activity5d||p.activity72||[];if(!a.length)return'norecord';if((Number(p.vote5d??p.vote72h)||0)>0)return'vote';if((Number(p.talk5d??p.talk72h)||0)>0)return'mention';return'silent';}
function apoioTimeline(p){const acts=(p.activity5d||p.activity72||[]).slice().sort((a,b)=>a.date-b.date).slice(-40);if(!acts.length)return'<span class="apoio-no-activity">Sem registro no período</span>';return acts.map(x=>`<i class="apoio-square ${x.kind}" title="${apoioEsc(APOIO_STATUS[x.kind]||'Não falou')} · ${new Date(x.date).toLocaleString('pt-BR')}"></i>`).join('');}
function apoioSocialLinks(p){const seen=new Set();return (p.socials||[]).filter(s=>{const k=`${s.network}|${s.url}`;if(seen.has(k))return false;seen.add(k);return true;}).map(s=>`<a class="apoio-social" href="${apoioEsc(s.url)}" target="_blank" rel="noopener noreferrer" title="${apoioEsc(s.handle||'')}">${apoioEsc(APOIO_NETWORKS[s.network]||s.network)}</a>`).join('');}
function apoioPersonCard(p,f){const st=apoioPersonStatus(p,f.network),five=apoioFiveDayStatus(p),lp=(p.latestPosts||[])[0],photo=p.photo||`/images/candidatos/${encodeURIComponent(p.sq||'')}.webp`;const label=five==='vote'?'Pediu voto':five==='mention'?'Falou':five==='silent'?'Não falou':'Sem registro';return `<article class="apoio-person-card state-${five}"><header><div class="apoio-avatar apoio-photo"><img src="${apoioEsc(photo)}" alt="" loading="lazy" onerror="this.remove();this.parentElement.textContent='${apoioEsc(p.name?.slice(0,1)||'?')}'"></div><div class="apoio-person-id"><strong>${apoioEsc(p.name)}</strong><small>${apoioEsc([p.party,p.role,p.uf].filter(Boolean).join(' · '))}</small></div><span class="apoio-pill ${five}">${label}</span></header><div class="apoio-person-metrics"><div><strong>${apoioNum(p.mentions5d??p.mentions72h??0)}</strong><span>menções · 5 dias</span></div><div><strong>${apoioNum(p.mentions24h||0)}</strong><span>últimas 24 h</span></div><div><strong>${apoioNum(p.vote5d??p.vote72h??0)}</strong><span>pediu voto</span></div></div><div class="apoio-timeline" aria-label="Atividade dos últimos 5 dias">${apoioTimeline(p)}</div><div class="apoio-legend-mini"><span><i class="apoio-square vote"></i> pediu voto</span><span><i class="apoio-square mention"></i> falou</span><span><i class="apoio-square silent"></i> não falou</span><span><i class="apoio-square norecord"></i> sem registro</span></div><div class="apoio-socials">${apoioSocialLinks(p)||'<span>Sem perfis documentados</span>'}</div>${lp?`<div class="apoio-last-post"><small>Última evidência · ${apoioEsc(APOIO_NETWORKS[lp.network]||lp.network)} · ${apoioAgo(lp.date)}</small><p>${apoioEsc(lp.text||'Publicação documentada.')}</p>${lp.url?`<a href="${apoioEsc(lp.url)}" target="_blank" rel="noopener noreferrer">Ver publicação ↗</a>`:''}</div>`:''}</article>`;}
function apoioPaginationHtml(id,total,page,size,onPage){const el=document.getElementById(id);if(!el)return page;const pages=Math.max(1,Math.ceil(total/size));page=Math.min(page,pages);let nums=[];for(let i=Math.max(1,page-2);i<=Math.min(pages,page+2);i++)nums.push(i);el.innerHTML=`<button ${page===1?'disabled':''} data-page="${page-1}">← Anterior</button>${page>3?'<span>…</span>':''}${nums.map(i=>`<button class="${i===page?'active':''}" data-page="${i}">${i}</button>`).join('')}${page<pages-2?'<span>…</span>':''}<button ${page===pages?'disabled':''} data-page="${page+1}">Próxima →</button>`;el.querySelectorAll('button[data-page]').forEach(b=>b.addEventListener('click',()=>onPage(Number(b.dataset.page)||1)));return page;}
function renderApoio(){const people=document.getElementById('apoioPeople'),posts=document.getElementById('apoioPosts');if(!people||!posts)return;const f=apoioFilters(),rows=apoioSortPeople(apoioFilteredPeople()),filteredPosts=apoioFilteredPosts();apoioRenderSummaries();apoioRenderCriteria();const from=(apoioPage-1)*APOIO_PAGE_SIZE,pageRows=rows.slice(from,from+APOIO_PAGE_SIZE);apoioSet('apoioCount',rows.length?`${apoioNum(from+1)}–${apoioNum(Math.min(from+APOIO_PAGE_SIZE,rows.length))} de ${apoioNum(rows.length)} pessoas`:'0 pessoas');people.innerHTML=pageRows.length?pageRows.map(p=>apoioPersonCard(p,f)).join(''):'<div class="apoio-empty">Sem registros para os filtros selecionados.</div>';apoioPage=apoioPaginationHtml('apoioPagination',rows.length,apoioPage,APOIO_PAGE_SIZE,n=>{apoioPage=n;renderApoio();document.getElementById('apoioPeople')?.scrollIntoView({behavior:'smooth',block:'start'});});const sorted=[...filteredPosts].sort((a,b)=>apoioPostTab==='engaged'?(Number(b.engagement||0)-Number(a.engagement||0)):(Number(b.date||0)-Number(a.date||0)));const pf=(apoioPostsPage-1)*APOIO_POST_PAGE_SIZE,pr=sorted.slice(pf,pf+APOIO_POST_PAGE_SIZE);posts.innerHTML=pr.length?pr.map(p=>`<article class="apoio-post"><div class="apoio-post-title"><strong>${apoioEsc(p.name)}</strong><small>${apoioEsc(APOIO_NETWORKS[p.network]||p.network||'Rede não identificada')}</small></div><p>${apoioEsc(p.text||'Publicação documentada na fonte.')}</p><footer><span class="apoio-pill ${p.kind}">${apoioEsc(APOIO_STATUS[p.kind]||p.kind)}</span><span>${p.date?new Date(p.date).toLocaleString('pt-BR'):''}</span>${p.views!=null?`<span>${apoioNum(p.views)} visualizações</span>`:''}${p.engagement?`<span>${apoioNum(p.engagement)} interações</span>`:''}${p.url?`<a href="${apoioEsc(p.url)}" target="_blank" rel="noopener noreferrer">Ver publicação original ↗</a>`:''}</footer></article>`).join(''):'<div class="apoio-empty">Nenhuma publicação classificada pela fonte para este recorte.</div>';apoioPostsPage=apoioPaginationHtml('apoioPostsPagination',sorted.length,apoioPostsPage,APOIO_POST_PAGE_SIZE,n=>{apoioPostsPage=n;renderApoio();document.getElementById('apoioPosts')?.scrollIntoView({behavior:'smooth',block:'start'});});}
async function loadApoio(force=false){if(apoioLoaded&&!force){renderApoio();return apoioData;}if(apoioLoading&&!force)return apoioLoading;apoioSet('apoioStatus','CONSULTANDO FONTE');apoioSet('apoioNotice','Consultando o snapshot validado da fonte externa…');apoioLoading=(async()=>{try{const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),20000);let res;try{res=await fetch(`${RADAR_API.baseUrl}/api/apoio`,{signal:ctl.signal,cache:'no-store',headers:{accept:'application/json'}});}finally{clearTimeout(timer);}const d=await res.json();if(!res.ok||!Array.isArray(d.people))throw Error(d?.message||`HTTP ${res.status}`);apoioData=d;apoioLoaded=true;apoioSet('apoioStatus',d.status==='ok'?'DADOS SINCRONIZADOS':'ÚLTIMA CÓPIA VÁLIDA');apoioSet('apoioNotice',d.message||'Classificações reproduzidas da fonte; silêncio não é interpretado como oposição.');apoioPopulate('apoioParty',d.people.map(p=>p.party),'Todos');apoioPopulate('apoioRole',d.people.map(p=>p.role),'Todos');apoioPopulate('apoioState',d.people.map(p=>p.uf),'Todas');renderApoio();return d;}catch(e){console.error('[Radar Apoio] Falha ao carregar',e);apoioSet('apoioStatus','FONTE INDISPONÍVEL');apoioSet('apoioNotice',`Não foi possível consultar a fonte agora (${e?.message||'erro desconhecido'}).`);renderApoio();return null;}finally{apoioLoading=null;}})();return apoioLoading;}
function initApoio(){const root=document.getElementById('panel-apoio');if(!root)return;if(!root.dataset.apoioBound){root.dataset.apoioBound='1';root.querySelectorAll('#apoioKind button').forEach(b=>b.addEventListener('click',()=>{root.querySelectorAll('#apoioKind button').forEach(x=>x.classList.remove('active'));b.classList.add('active');apoioKind=b.dataset.v;apoioPage=1;apoioPostsPage=1;renderApoio();}));root.querySelectorAll('#apoioPostTabs button').forEach(b=>b.addEventListener('click',()=>{root.querySelectorAll('#apoioPostTabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');apoioPostTab=b.dataset.v;apoioPostsPage=1;renderApoio();}));root.querySelectorAll('#apoioUfMode button').forEach(b=>b.addEventListener('click',()=>{root.querySelectorAll('#apoioUfMode button').forEach(x=>x.classList.remove('active'));b.classList.add('active');apoioUfMode=b.dataset.v;apoioRenderUfChart();}));['apoioParty','apoioRole','apoioState','apoioNetwork','apoioSort'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>{apoioPage=1;apoioPostsPage=1;renderApoio();}));document.getElementById('apoioName')?.addEventListener('input',()=>{apoioPage=1;apoioPostsPage=1;renderApoio();});}loadApoio();}
function bootstrapApoioIfActive(){const root=document.getElementById('panel-apoio');if(root?.classList.contains('active')||root?.classList.contains('is-active'))initApoio();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootstrapApoioIfActive,{once:true});else bootstrapApoioIfActive();

      
