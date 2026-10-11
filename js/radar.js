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

    // Contratos reservados para evoluções do Worker.
    // O front-end atual NÃO depende destes endpoints.
    topics: "/api/topics",
    topicTrends: "/api/topics/trends",
    entities: "/api/entities"
  }
};

const RADAR_SERVICE_CAPABILITIES = {
  topics: "client-derived",
  topicTrends: "client-derived",
  entities: "planned"
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
// MOTOR DE TEMAS — DERIVADO DO CORPUS REAL
// ============================================================

const RADAR_TOPICS = [
  { id:"economia", pt:"Economia", en:"Economy", es:"Economía", terms:["economia","economico","econômico","mercado","pib","crescimento"] },
  { id:"impostos", pt:"Impostos", en:"Taxes", es:"Impuestos", terms:["imposto","impostos","tributo","tributos","tributaria","tributária","taxacao","taxação"] },
  { id:"seguranca", pt:"Segurança pública", en:"Public safety", es:"Seguridad pública", terms:["seguranca publica","segurança pública","crime","criminalidade","policia","polícia","violencia","violência"] },
  { id:"stf", pt:"STF e Judiciário", en:"Supreme Court & Judiciary", es:"STF y Poder Judicial", terms:["stf","supremo","judiciario","judiciário","alexandre de moraes","moraes"] },
  { id:"congresso", pt:"Congresso e política", en:"Congress & politics", es:"Congreso y política", terms:["congresso","senado","camara","câmara","deputado","senador","politica","política"] },
  { id:"eleicoes", pt:"Eleições 2026", en:"2026 election", es:"Elecciones 2026", terms:["eleicao","eleição","eleicoes","eleições","candidato","candidatura","campanha","urna","voto"] },
  { id:"apoios", pt:"Apoios e alianças", en:"Endorsements & alliances", es:"Apoyos y alianzas", terms:["apoio","apoia","alianca","aliança","aliado","aliados","coligacao","coligação","endosso"] },
  { id:"agenda", pt:"Agenda e campanha", en:"Campaign agenda", es:"Agenda y campaña", terms:["agenda","evento","comicio","comício","visita","encontro","campanha","entrevista"] },
  { id:"propostas", pt:"Propostas", en:"Proposals", es:"Propuestas", terms:["proposta","propostas","plano de governo","programa de governo","promete","defende"] },
  { id:"internacional", pt:"Relações internacionais", en:"International relations", es:"Relaciones internacionales", terms:["eua","estados unidos","china","argentina","tarifa","tarifas","internacional","trump"] },
  { id:"saude", pt:"Saúde", en:"Health", es:"Salud", terms:["saude","saúde","sus","hospital","medico","médico","vacina"] },
  { id:"educacao", pt:"Educação", en:"Education", es:"Educación", terms:["educacao","educação","escola","ensino","universidade","professor"] },
  { id:"emprego", pt:"Emprego e renda", en:"Jobs & income", es:"Empleo e ingresos", terms:["emprego","desemprego","renda","salario","salário","trabalho","trabalhador"] },
  { id:"corrupcao", pt:"Investigações e integridade", en:"Investigations & integrity", es:"Investigaciones e integridad", terms:["investigacao","investigação","inquerito","inquérito","corrupcao","corrupção","fraude","escandalo","escândalo"] },
  { id:"redes", pt:"Redes e comunicação", en:"Media & communication", es:"Redes y comunicación", terms:["rede social","redes sociais","instagram","youtube","tiktok","video","vídeo","comunicacao","comunicação"] }
];

let selectedThemeId = null;

function topicLabel(topic){ return topic?.[lang] || topic?.pt || topic?.id || "Tema"; }
function topicText(article){ return normalizeText(`${article?.title||""} ${article?.subtitle||""} ${article?.category||""}`); }
function topicMatches(article, topic){
  const text=topicText(article);
  return topic.terms.some(term=>text.includes(normalizeText(term)));
}
function themeCandidateMatches(article, filter){
  if(filter==="flavio") return Boolean(article.mentions?.flavio);
  if(filter==="lula") return Boolean(article.mentions?.lula);
  if(filter==="both") return Boolean(article.mentions?.flavio && article.mentions?.lula);
  return true;
}
function getThemeBaseArticles(){
  const base=(filteredNews.length || hasActiveFilters()) ? filteredNews : (liveNews||[]);
  const candidate=getEl("themeCandidateFilter")?.value || "all";
  return base.filter(a=>themeCandidateMatches(a,candidate));
}
function calculateTopicStats(articles=getThemeBaseArticles()){
  return RADAR_TOPICS.map(topic=>{
    const matched=articles.filter(a=>topicMatches(a,topic));
    const flavio=matched.filter(a=>a.mentions?.flavio).length;
    const lula=matched.filter(a=>a.mentions?.lula).length;
    const both=matched.filter(a=>a.mentions?.flavio&&a.mentions?.lula).length;
    return {...topic,count:matched.length,flavio,lula,both,articles:matched};
  }).filter(x=>x.count>0).sort((a,b)=>b.count-a.count || topicLabel(a).localeCompare(topicLabel(b),lang));
}
function themeUiText(key){
  const t={
    pt:{articles:"matérias",noData:"Sem dados suficientes para este recorte.",topics:"assuntos identificados",publishers:"veículos",top:"assunto líder",emerging:"em crescimento",stable:"estável",comparison:"24h atuais × 24h anteriores",related:"matérias relacionadas"},
    en:{articles:"articles",noData:"Not enough data for this selection.",topics:"topics identified",publishers:"publishers",top:"leading topic",emerging:"rising",stable:"stable",comparison:"current 24h × previous 24h",related:"related articles"},
    es:{articles:"artículos",noData:"No hay datos suficientes para este recorte.",topics:"temas identificados",publishers:"medios",top:"tema principal",emerging:"en crecimiento",stable:"estable",comparison:"24h actuales × 24h anteriores",related:"artículos relacionados"}
  }; return (t[lang]||t.pt)[key]||key;
}
function selectTheme(id){ selectedThemeId=id; renderThemesDashboard(); }
function renderThemesDashboard(){
  if(!liveNews) return;
  const articles=getThemeBaseArticles();
  let stats=calculateTopicStats(articles);
  const q=normalizeText(getEl("themeSearch")?.value||"");
  if(q) stats=stats.filter(s=>normalizeText(topicLabel(s)+" "+s.terms.join(" ")).includes(q));
  if(!selectedThemeId || !stats.some(s=>s.id===selectedThemeId)) selectedThemeId=stats[0]?.id || null;
  const selected=stats.find(s=>s.id===selectedThemeId) || null;
  renderThemeSummary(articles,stats); renderThemeRanking(stats); renderThemeCloud(stats); renderEmergingTopics(articles,stats); renderThemeDetail(selected);
}
function renderThemeSummary(articles,stats){
  const box=getEl("themeSummary"); if(!box)return;
  const pubs=new Set(articles.map(a=>a.publisher).filter(Boolean)).size;
  const top=stats[0];
  const cards=[
    [formatNumber(articles.length),themeUiText("articles"),"Corpus após filtros"],
    [formatNumber(stats.length),themeUiText("topics"),"Taxonomia editorial"],
    [formatNumber(pubs),themeUiText("publishers"),"Fontes no recorte"],
    [top?escapeHTML(topicLabel(top)):"—",themeUiText("top"),top?`${top.count} ${themeUiText("articles")}`:"—"]
  ];
  box.innerHTML=cards.map(c=>`<div class="theme-summary-card"><span>${c[1]}</span><strong>${c[0]}</strong><small>${c[2]}</small></div>`).join("");
}
function renderThemeRanking(stats){
  const box=getEl("themeRanking"); if(!box)return;
  if(!stats.length){box.innerHTML=`<div class="empty-topic">${themeUiText("noData")}</div>`;return;}
  const max=stats[0].count||1;
  box.innerHTML=stats.slice(0,10).map(s=>`<button type="button" class="topic-row ${s.id===selectedThemeId?"active":""}" data-topic-id="${s.id}"><span><span class="topic-name">${escapeHTML(topicLabel(s))}</span><span class="topic-meta">Flávio ${s.flavio} • Lula ${s.lula} • Ambos ${s.both}</span></span><span class="topic-bar"><i style="width:${s.count/max*100}%"></i></span><span class="topic-count">${s.count}</span></button>`).join("");
}
function renderThemeCloud(stats){
  const box=getEl("themeCloud"); if(!box)return;
  if(!stats.length){box.innerHTML=`<span>${themeUiText("noData")}</span>`;return;}
  const max=stats[0].count||1;
  box.innerHTML=stats.slice(0,12).map(s=>`<button type="button" class="word ${s.id===selectedThemeId?"active":""}" data-topic-id="${s.id}" style="font-size:${.8+(s.count/max)*.9}rem">${escapeHTML(topicLabel(s))}</button>`).join("");
}
function topicPeriodCounts(topic,articles){
  const now=Date.now(), day=86400000;
  let current=0,previous=0;
  articles.forEach(a=>{if(!topicMatches(a,topic))return;const d=validDate(a.publishedAt);if(!d)return;const age=now-d.getTime();if(age>=0&&age<day)current++;else if(age>=day&&age<2*day)previous++;});
  return {current,previous};
}
function renderEmergingTopics(articles,stats){
  const box=getEl("emergingTopics");if(!box)return;
  const enriched=stats.map(s=>({...s,...topicPeriodCounts(s,articles)})).filter(s=>s.current||s.previous).map(s=>({...s,delta:s.previous?((s.current-s.previous)/s.previous)*100:(s.current?100:null)})).sort((a,b)=>(b.delta??-999)-(a.delta??-999)).slice(0,4);
  if(!enriched.length){box.innerHTML=`<div class="empty-topic">${themeUiText("noData")}</div>`;return;}
  box.innerHTML=enriched.map(s=>{const cls=s.delta>0?"up":s.delta<0?"down":"stable";const sign=s.delta>0?"+":"";const movement=s.delta===null?"—":`${sign}${Math.round(s.delta)}%`;return `<button type="button" class="emerging-card" data-topic-id="${s.id}"><strong>${escapeHTML(topicLabel(s))}</strong><span class="movement ${cls}">${movement}</span><small>${s.current} × ${s.previous} ${themeUiText("articles")}<br>${themeUiText("comparison")}</small></button>`;}).join("");
}
function buildTopicTimeline(topic,articles,bucketHours=4){
  const relevant=articles.filter(a=>topicMatches(a,topic));
  const buckets=buildTimeline(relevant,bucketHours);
  return buckets.map(b=>({...b,count:b.total}));
}
function drawThemeChart(topic,articles){
  const canvas=getEl("themeTrendChart");if(!canvas)return;const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
  const dpr=window.devicePixelRatio||1;canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);const ctx=canvas.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);const w=rect.width,h=rect.height,pad=28;ctx.clearRect(0,0,w,h);ctx.strokeStyle="#e2e8f0";ctx.lineWidth=1;for(let i=0;i<5;i++){const y=pad+(h-pad*2)*i/4;ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(w-pad,y);ctx.stroke();}
  if(!topic){ctx.fillStyle="#64748b";ctx.font="13px sans-serif";ctx.textAlign="center";ctx.fillText(themeUiText("noData"),w/2,h/2);return;}
  const timeline=buildTopicTimeline(topic,articles,4), values=timeline.map(x=>x.count), max=Math.max(1,...values);ctx.strokeStyle="#154b8b";ctx.lineWidth=3;ctx.beginPath();values.forEach((v,i)=>{const x=pad+(w-pad*2)*i/Math.max(1,values.length-1),y=h-pad-(h-pad*2)*v/max;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();ctx.fillStyle="#fdb813";values.forEach((v,i)=>{const x=pad+(w-pad*2)*i/Math.max(1,values.length-1),y=h-pad-(h-pad*2)*v/max;ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();});
}
function renderThemeDetail(topic){
  const badge=getEl("selectedThemeBadge"), sources=getEl("themeSources"), news=getEl("themeNews"), count=getEl("themeNewsCount");
  if(badge)badge.textContent=topic?topicLabel(topic):"—";
  if(!topic){if(sources)sources.innerHTML=`<div class="empty-topic">${themeUiText("noData")}</div>`;if(news)news.innerHTML=`<div class="empty-topic">${themeUiText("noData")}</div>`;if(count)count.textContent="0";drawThemeChart(null,[]);return;}
  const articles=topic.articles||[];drawThemeChart(topic,articles);
  const ranking=publisherRanking(articles).slice(0,5);if(sources)sources.innerHTML=ranking.map((r,i)=>`<div class="rank-row"><span class="rank-no">${i+1}</span><div><div class="rank-name">${escapeHTML(r.name)}</div><div class="rank-meta">${r.count} ${themeUiText("articles")}</div></div><span class="rank-score">${articles.length?(r.count/articles.length*100).toFixed(0):0}%</span></div>`).join("")||`<div class="empty-topic">${themeUiText("noData")}</div>`;
  if(count)count.textContent=`${articles.length} ${themeUiText("related")}`;
  if(news)news.innerHTML=articles.slice(0,12).map(newsHTML).join("")||`<div class="empty-topic">${themeUiText("noData")}</div>`;
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

    if (!items.length) {

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
        items
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


  const max =
    keywords[0]?.count ||
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
            Não há termos suficientes para esta seleção.
          </p>
        `;

  }


  if (wordCloud) {

    wordCloud.innerHTML =
      keywords.length
        ? keywords
          .map(
            item => {

              const weight =
                item.count /
                max;


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
            Sem dados suficientes.
          </span>
        `;

  }

}


// ============================================================
// CARDS DE DISTRIBUIÇÃO DA COBERTURA
// ============================================================

function renderCoverageCards() {

  renderThemesDashboard();

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


  const periodLabel =
    `${periodHours} horas`;


  const cards = [

    {
      name:
        "Flávio Bolsonaro",

      count:
        metrics.flavio,

      share:
        metrics.flavioShare,

      description:
        `Artigos das últimas ${periodHours}h em que o monitor identificou referência a Flávio Bolsonaro.`
    },

    {
      name:
        "Lula",

      count:
        metrics.lula,

      share:
        metrics.lulaShare,

      description:
        `Artigos das últimas ${periodHours}h em que o monitor identificou referência a Lula.`
    },

    {
      name:
        "Ambos",

      count:
        metrics.both,

      share:
        metrics.bothShare,

      description:
        `Artigos das últimas ${periodHours}h em que foram identificadas referências a Flávio Bolsonaro e Lula na mesma publicação.`
    },

    {
      name:
        "Total monitorado",

      count:
        metrics.total,

      share:
        metrics.total
          ? 100
          : 0,

      description:
        `Total de artigos retornados pelas fontes monitoradas nas últimas ${periodHours}h.`
    }

  ];


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

  renderNewsFeed();

  renderPublisherRanking();

  renderCoverageCards();

  renderThemesDashboard();

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
    period.value = "48h";
  }


  if (scope) {
    scope.value = "all";
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


  renderFilteredData();

}


// ============================================================
// FILTRO INTERNO DA ABA MENÇÕES
// ============================================================

function filterMentionsList(value) {

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
          ).includes(query);

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

  renderThemesDashboard();

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
// VÍDEOS — SEM MOCK
// ============================================================

function renderVideosPlanned() {

  const grid =
    getEl("videoGrid");


  if (!grid) {
    return;
  }


  grid.innerHTML = `
    <article class="video-card">

      <div class="video-thumb">
        ▶
      </div>

      <div class="video-info">

        <h4>
          YouTube Data API
        </h4>

        <p>
          Integração planejada. Nenhum vídeo fictício é exibido.
        </p>

      </div>

    </article>
  `;

}


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

    themes_eyebrow:"TEMAS",
    themes_title:"Assuntos da cobertura monitorada",
    themes_desc:"Explore os assuntos identificados nas matérias, sua frequência, evolução, veículos e relação com os candidatos monitorados.",
    themes_candidate_filter:"Candidato", themes_search_label:"Buscar assunto", themes_search_placeholder:"Ex.: economia, STF, impostos",
    themes_ranking_eyebrow:"ASSUNTOS", themes_ranking_title:"Assuntos mais presentes", themes_ranking_desc:"Ranking por quantidade de matérias em que o assunto foi identificado.",
    themes_cloud_eyebrow:"EXPLORAR", themes_cloud_title:"Nuvem de assuntos", themes_cloud_note:"O tamanho representa a quantidade de matérias relacionadas ao assunto no recorte atual.",
    themes_emerging_eyebrow:"MOVIMENTO", themes_emerging_title:"Assuntos emergentes", themes_emerging_desc:"Compara as últimas 24 horas com as 24 horas anteriores dentro da janela disponível.",
    themes_detail_eyebrow:"DETALHE", themes_detail_title:"Evolução do assunto", themes_chart_note:"Cada ponto representa a quantidade de matérias relacionadas ao assunto em blocos de 4 horas.",
    themes_sources_eyebrow:"FONTES", themes_sources_title:"Veículos que abordaram o assunto", themes_news_eyebrow:"AUDITABILIDADE", themes_news_title:"Matérias relacionadas", themes_news_desc:"Consulte as publicações que sustentam os números apresentados para o assunto selecionado.",
    themes_methodology_title:"Como ler estes dados:", themes_methodology:"frequência de cobertura não representa popularidade, aprovação, intenção de voto ou avaliação positiva/negativa de candidatos.",

    mentions_title:
      "Cobertura e publicações",

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
      "Integração com YouTube planejada.",

    apis_title:
      "Fontes e serviços",

    config_title:
      "Parâmetros do radar",

    footer_desc:
      "Radar Eleitoral 2026."

  },

  en: {

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

    themes_eyebrow:"TOPICS", themes_title:"Topics in monitored coverage", themes_desc:"Explore topics identified in articles, their frequency, evolution, publishers and relationship with monitored candidates.",
    themes_candidate_filter:"Candidate", themes_search_label:"Search topic", themes_search_placeholder:"E.g. economy, Supreme Court, taxes", themes_ranking_eyebrow:"TOPICS", themes_ranking_title:"Most frequent topics", themes_ranking_desc:"Ranking by number of articles in which each topic was identified.", themes_cloud_eyebrow:"EXPLORE", themes_cloud_title:"Topic cloud", themes_cloud_note:"Size represents the number of related articles in the current selection.", themes_emerging_eyebrow:"MOVEMENT", themes_emerging_title:"Emerging topics", themes_emerging_desc:"Compares the latest 24 hours with the previous 24 hours within the available window.", themes_detail_eyebrow:"DETAIL", themes_detail_title:"Topic evolution", themes_chart_note:"Each point represents related articles in 4-hour blocks.", themes_sources_eyebrow:"SOURCES", themes_sources_title:"Publishers covering the topic", themes_news_eyebrow:"AUDITABILITY", themes_news_title:"Related articles", themes_news_desc:"Review the publications supporting the figures shown for the selected topic.", themes_methodology_title:"How to read this data:", themes_methodology:"coverage frequency does not represent popularity, approval, voting intention or positive/negative assessment of candidates.",

    mentions_title:
      "Coverage and publications",

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
      "YouTube integration planned.",

    apis_title:
      "Sources and services",

    config_title:
      "Radar parameters",

    footer_desc:
      "2026 Election Radar."

  },

  es: {

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

    themes_eyebrow:"TEMAS", themes_title:"Temas de la cobertura monitoreada", themes_desc:"Explore los temas identificados en los artículos, su frecuencia, evolución, medios y relación con los candidatos monitoreados.", themes_candidate_filter:"Candidato", themes_search_label:"Buscar tema", themes_search_placeholder:"Ej.: economía, STF, impuestos", themes_ranking_eyebrow:"TEMAS", themes_ranking_title:"Temas más presentes", themes_ranking_desc:"Ranking por cantidad de artículos en los que se identificó el tema.", themes_cloud_eyebrow:"EXPLORAR", themes_cloud_title:"Nube de temas", themes_cloud_note:"El tamaño representa la cantidad de artículos relacionados con el tema en el recorte actual.", themes_emerging_eyebrow:"MOVIMIENTO", themes_emerging_title:"Temas emergentes", themes_emerging_desc:"Compara las últimas 24 horas con las 24 horas anteriores dentro de la ventana disponible.", themes_detail_eyebrow:"DETALLE", themes_detail_title:"Evolución del tema", themes_chart_note:"Cada punto representa la cantidad de artículos relacionados en bloques de 4 horas.", themes_sources_eyebrow:"FUENTES", themes_sources_title:"Medios que abordaron el tema", themes_news_eyebrow:"AUDITABILIDAD", themes_news_title:"Artículos relacionados", themes_news_desc:"Consulte las publicaciones que respaldan los números del tema seleccionado.", themes_methodology_title:"Cómo leer estos datos:", themes_methodology:"la frecuencia de cobertura no representa popularidad, aprobación, intención de voto ni evaluación positiva/negativa de candidatos.",

    mentions_title:
      "Cobertura y publicaciones",

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
      "Integración con YouTube prevista.",

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
      event =>
        filterMentionsList(
          event.target.value
        );

  }


  const themeCandidateFilter = getEl("themeCandidateFilter");
  if (themeCandidateFilter) themeCandidateFilter.onchange = () => renderThemesDashboard();

  const themeSearch = getEl("themeSearch");
  if (themeSearch) themeSearch.oninput = () => renderThemesDashboard();

  document.addEventListener(
    "click",
    event => {

      const topicButton = event.target.closest("[data-topic-id]");
      if (topicButton) {
        selectTheme(topicButton.dataset.topicId);
        return;
      }

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
      const selectedTopic = calculateTopicStats(getThemeBaseArticles()).find(item => item.id === selectedThemeId);
      drawThemeChart(selectedTopic || null, selectedTopic?.articles || []);

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
    newsResult
  ] =
    await Promise.allSettled(
      [
        checkRadarApi(),
        loadRadarSources(),
        loadRadarNews()
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


initializeRadar();
