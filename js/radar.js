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
// FUNÇÃO GENÉRICA DE ACESSO À API
// ============================================================

async function radarApiFetch(endpoint) {

  const response = await fetch(
    `${RADAR_API.baseUrl}${endpoint}`,
    {
      method: "GET",

      headers: {
        "Accept": "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new Error(`RADAR_API_HTTP_${response.status}`);
  }

  return response.json();
}


// ============================================================
// VERIFICAÇÃO DE STATUS DA API
// ============================================================

async function checkRadarApi() {

  try {

    const data = await radarApiFetch(
      RADAR_API.endpoints.status
    );

    console.info(
      "[Radar API] Conexão estabelecida:",
      data
    );

    return data;

  } catch (error) {

    console.warn(
      "[Radar API] API indisponível:",
      error.message
    );

    return null;
  }
}


// ============================================================
// DADOS DEMONSTRATIVOS
// Permanecem como fallback enquanto as APIs reais
// são conectadas progressivamente.
// ============================================================

const mock = {

  themes: [

    {
      name: "Economia",
      score: 92,
      delta: "+42%",
      level: "high"
    },

    {
      name: "Segurança pública",
      score: 84,
      delta: "+21%",
      level: "high"
    },

    {
      name: "Liberdade de expressão",
      score: 76,
      delta: "+18%",
      level: "medium"
    },

    {
      name: "Impostos",
      score: 69,
      delta: "+12%",
      level: "medium"
    },

    {
      name: "Agronegócio",
      score: 58,
      delta: "+7%",
      level: "stable"
    },

    {
      name: "Educação",
      score: 52,
      delta: "+4%",
      level: "stable"
    },

    {
      name: "Saúde",
      score: 47,
      delta: "-2%",
      level: "stable"
    },

    {
      name: "Relações institucionais",
      score: 44,
      delta: "+9%",
      level: "medium"
    },

    {
      name: "Emprego",
      score: 41,
      delta: "+5%",
      level: "stable"
    }

  ],


  keywords: [

    ["economia", 100],
    ["segurança", 87],
    ["impostos", 78],
    ["liberdade", 72],
    ["emprego", 64],
    ["agronegócio", 58],
    ["educação", 51],
    ["saúde", 47],
    ["congresso", 39],
    ["inflação", 36]

  ],


  news: [

    {
      source: "Portal Nacional",
      time: "há 18 min",
      title:
        "Debate econômico ganha espaço na cobertura política desta manhã",
      desc:
        "Exemplo de slot para título, domínio, horário, tema e link da publicação original.",
      tag: "Economia",
      impact: 92
    },

    {
      source: "Jornal Regional",
      time: "há 42 min",
      title:
        "Segurança pública aparece entre os temas mais citados em evento",
      desc:
        "Conteúdo fictício usado apenas para validar hierarquia e leitura do radar.",
      tag: "Segurança",
      impact: 84
    },

    {
      source: "Agência Pública",
      time: "há 1 h",
      title:
        "Propostas tributárias voltam ao centro das discussões eleitorais",
      desc:
        "Quando conectado, este card receberá dados de APIs e fontes verificáveis.",
      tag: "Impostos",
      impact: 78
    },

    {
      source: "Canal de Notícias",
      time: "há 2 h",
      title:
        "Candidatos ampliam agenda de entrevistas e encontros regionais",
      desc:
        "O front já está preparado para receber URL, data, fonte e relevância.",
      tag: "Campanha",
      impact: 66
    },

    {
      source: "Notícias Brasil",
      time: "há 3 h",
      title:
        "Agronegócio e emprego entram na pauta de debates desta semana",
      desc:
        "Dados simulados — não representam cobertura real ou intenção de voto.",
      tag: "Agronegócio",
      impact: 58
    }

  ],


  videos: [

    {
      title:
        "Entrevista e agenda pública — slot de vídeo",
      meta:
        "YouTube • integração planejada"
    },

    {
      title:
        "Corte sobre economia — slot de vídeo",
      meta:
        "YouTube • integração planejada"
    },

    {
      title:
        "Debate sobre segurança — slot de vídeo",
      meta:
        "YouTube • integração planejada"
    },

    {
      title:
        "Agenda regional — slot de vídeo",
      meta:
        "YouTube • integração planejada"
    },

    {
      title:
        "Propostas e temas — slot de vídeo",
      meta:
        "YouTube • integração planejada"
    },

    {
      title:
        "Resumo semanal — slot de vídeo",
      meta:
        "YouTube • integração planejada"
    }

  ],


  apis: [

    {
      name: "GDELT DOC 2.0",
      desc:
        "Notícias, cobertura e linha do tempo",
      status:
        "Pronto para integrar",
      cls:
        "ready"
    },

    {
      name:
        "YouTube Data API",
      desc:
        "Vídeos, canais e metadados públicos",
      status:
        "Planejado",
      cls:
        "planned"
    },

    {
      name:
        "Google Trends",
      desc:
        "Interesse de pesquisa quando houver acesso adequado",
      status:
        "Planejado",
      cls:
        "planned"
    },

    {
      name:
        "TSE / dados oficiais",
      desc:
        "Dados eleitorais oficiais aplicáveis",
      status:
        "Planejado",
      cls:
        "planned"
    },

    {
      name:
        "Camada de cache",
      desc:
        "Cloudflare Worker / KV para proteger quotas",
      status:
        "Arquitetura",
      cls:
        "mock"
    }

  ]

};


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
      "PROTÓTIPO • DADOS DEMONSTRATIVOS",

    hero_title:
      "Radar Eleitoral 2026",

    hero_desc:
      "Uma central para acompanhar cobertura pública, temas, palavras-chave, fontes e sinais de atenção. Nesta versão, os números são simulados para validar a experiência antes das integrações.",

    last_update:
      "Última atualização",

    mock_notice:
      "Modo demonstração",

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
      "Menções monitoradas",

    metric_topics:
      "Temas ativos",

    metric_sources:
      "Fontes acompanhadas",

    metric_peak:
      "Maior pico",

    vs_period:
      "vs. período anterior",

    high_attention:
      "em alta atenção",

    source_types:
      "tipos de fonte",

    peak_desc:
      "Economia • últimas 6h",

    volume_title:
      "Evolução das menções",

    demo_chart:
      "Dados ilustrativos para validar o layout. Serão substituídos por dados das APIs.",

    hot_title:
      "Assuntos em destaque",

    radar_title:
      "Relevância por tema",

    news_title:
      "Últimas menções encontradas",

    view_all:
      "Ver todas",

    themes_title:
      "Mapa de temas monitorados",

    themes_desc:
      "Cards demonstrativos com volume, variação e nível de atenção. Clique para filtrar o restante do painel.",

    add_theme:
      "Adicionar tema",

    mentions_title:
      "Cobertura e publicações",

    keywords_title:
      "Termos com maior presença",

    cloud_title:
      "Nuvem de termos",

    cloud_note:
      "O tamanho representa apenas o peso demonstrativo neste protótipo.",

    spikes_title:
      "Detecção de picos",

    videos_title:
      "Conteúdos relacionados",

    videos_desc:
      "Slots preparados para YouTube Data API e outras fontes permitidas.",

    apis_title:
      "Fontes e serviços planejados",

    config_title:
      "Parâmetros do radar",

    footer_desc:
      "Protótipo do Radar Eleitoral 2026. Dados demonstrativos nesta versão."

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
      "PROTOTYPE • DEMO DATA",

    hero_title:
      "2026 Election Radar",

    hero_desc:
      "A hub to follow public coverage, topics, keywords, sources and attention signals. Numbers are simulated in this version to validate the experience before integrations.",

    last_update:
      "Last update",

    mock_notice:
      "Demo mode",

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
      "Monitored mentions",

    metric_topics:
      "Active topics",

    metric_sources:
      "Monitored sources",

    metric_peak:
      "Largest spike",

    vs_period:
      "vs. previous period",

    high_attention:
      "high attention",

    source_types:
      "source types",

    peak_desc:
      "Economy • last 6h",

    volume_title:
      "Mentions over time",

    demo_chart:
      "Illustrative data to validate the layout. It will be replaced by API data.",

    hot_title:
      "Topics in focus",

    radar_title:
      "Topic relevance",

    news_title:
      "Latest mentions",

    view_all:
      "View all",

    themes_title:
      "Monitored topic map",

    themes_desc:
      "Demo cards with volume, change and attention level.",

    add_theme:
      "Add topic",

    mentions_title:
      "Coverage and publications",

    keywords_title:
      "Most frequent terms",

    cloud_title:
      "Word cloud",

    cloud_note:
      "Size represents demo weight only.",

    spikes_title:
      "Spike detection",

    videos_title:
      "Related content",

    videos_desc:
      "Slots prepared for YouTube Data API and other permitted sources.",

    apis_title:
      "Planned sources and services",

    config_title:
      "Radar parameters",

    footer_desc:
      "2026 Election Radar prototype. Demo data in this version."

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
      "PROTOTIPO • DATOS DEMOSTRATIVOS",

    hero_title:
      "Radar Electoral 2026",

    hero_desc:
      "Una central para seguir cobertura pública, temas, palabras clave, fuentes y señales de atención. Los números son simulados para validar la experiencia antes de las integraciones.",

    last_update:
      "Última actualización",

    mock_notice:
      "Modo demostración",

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
      "Menciones monitoreadas",

    metric_topics:
      "Temas activos",

    metric_sources:
      "Fuentes monitoreadas",

    metric_peak:
      "Mayor pico",

    vs_period:
      "vs. período anterior",

    high_attention:
      "en alta atención",

    source_types:
      "tipos de fuente",

    peak_desc:
      "Economía • últimas 6h",

    volume_title:
      "Evolución de las menciones",

    demo_chart:
      "Datos ilustrativos para validar el diseño. Serán reemplazados por datos de APIs.",

    hot_title:
      "Temas destacados",

    radar_title:
      "Relevancia por tema",

    news_title:
      "Últimas menciones",

    view_all:
      "Ver todas",

    themes_title:
      "Mapa de temas monitoreados",

    themes_desc:
      "Tarjetas demostrativas con volumen, variación y nivel de atención.",

    add_theme:
      "Agregar tema",

    mentions_title:
      "Cobertura y publicaciones",

    keywords_title:
      "Términos con mayor presencia",

    cloud_title:
      "Nube de términos",

    cloud_note:
      "El tamaño representa solo el peso demostrativo.",

    spikes_title:
      "Detección de picos",

    videos_title:
      "Contenidos relacionados",

    videos_desc:
      "Espacios preparados para YouTube Data API y otras fuentes permitidas.",

    apis_title:
      "Fuentes y servicios previstos",

    config_title:
      "Parámetros del radar",

    footer_desc:
      "Prototipo del Radar Electoral 2026. Datos demostrativos en esta versión."

  }

};


// ============================================================
// ESTADO DA INTERFACE
// ============================================================

let lang = "pt";
let fontSize = 100;


// ============================================================
// RENDERIZAÇÃO PRINCIPAL
// ============================================================

function render() {

  document.getElementById("lastUpdate").textContent =
    new Date().toLocaleTimeString(
      "pt-BR",
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    );


  document.getElementById("hotTopics").innerHTML =
    mock.themes
      .slice(0, 5)
      .map(
        (t, i) => `
          <div class="rank-row">

            <span class="rank-no">
              ${i + 1}
            </span>

            <div>

              <div class="rank-name">
                ${t.name}
              </div>

              <div class="rank-meta">
                Índice demonstrativo ${t.score}/100
              </div>

            </div>

            <span class="rank-score">
              ${t.delta}
            </span>

          </div>
        `
      )
      .join("");


  document.getElementById("newsFeed").innerHTML =
    mock.news
      .slice(0, 4)
      .map(newsHTML)
      .join("");


  document.getElementById("mentionsList").innerHTML =
    mock.news
      .map(newsHTML)
      .join("");


  document.getElementById("themeCards").innerHTML =
    mock.themes
      .map(
        t => `
          <button
            class="theme-card"
            data-theme="${t.name}"
          >

            <div class="theme-top">

              <div>

                <h4>
                  ${t.name}
                </h4>

                <small>
                  Relevância demonstrativa
                </small>

              </div>

              <span class="attention ${t.level}">
                ${
                  t.level === "high"
                    ? "Alta"
                    : t.level === "medium"
                      ? "Atenção"
                      : "Estável"
                }
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
                ${t.score}
              </strong>

              <span
                class="${
                  t.delta.startsWith("-")
                    ? ""
                    : "up"
                }"
              >
                ${t.delta}
              </span>

            </div>

            <div class="mini-track">
              <i style="width:${t.score}%"></i>
            </div>

          </button>
        `
      )
      .join("");


  document.getElementById("keywordBars").innerHTML =
    mock.keywords
      .map(
        ([k, v]) => `
          <div class="keyword-row">

            <strong>
              ${k}
            </strong>

            <div class="keyword-track">
              <i style="width:${v}%"></i>
            </div>

            <span>
              ${v}
            </span>

          </div>
        `
      )
      .join("");


  document.getElementById("wordCloud").innerHTML =
    mock.keywords
      .map(
        ([k, v]) => `
          <button
            class="word"
            style="font-size:${0.72 + v / 120}rem"
          >
            ${k}
          </button>
        `
      )
      .join("");


  document.getElementById("spikeTimeline").innerHTML = [

    ["08:00", "Economia", "+42%"],
    ["10:30", "Segurança", "+31%"],
    ["13:15", "Impostos", "+24%"],
    ["16:40", "Liberdade", "+19%"]

  ]
    .map(
      x => `
        <div class="spike">

          <time>
            ${x[0]}
          </time>

          <strong>
            ${x[1]}
          </strong>

          <span>
            ▲ ${x[2]}
          </span>

        </div>
      `
    )
    .join("");


  document.getElementById("videoGrid").innerHTML =
    mock.videos
      .map(
        (v, i) => `
          <article class="video-card">

            <div class="video-thumb">

              ▶

              <span style="margin-left:.4rem">
                SLOT ${String(i + 1).padStart(2, "0")}
              </span>

            </div>

            <div class="video-info">

              <h4>
                ${v.title}
              </h4>

              <p>
                ${v.meta}
              </p>

            </div>

          </article>
        `
      )
      .join("");


  document.getElementById("apiList").innerHTML =
    mock.apis
      .map(
        a => `
          <div class="api-row">

            <div>

              <strong>
                ${a.name}
              </strong>

              <span>
                ${a.desc}
              </span>

            </div>

            <span class="api-status ${a.cls}">
              ${a.status}
            </span>

          </div>
        `
      )
      .join("");


  renderRadar();
  drawChart();

}


// ============================================================
// CARD DE NOTÍCIA
// ============================================================

function newsHTML(n) {

  return `
    <article
      class="news-item"
      data-title="${(
        n.title +
        " " +
        n.source
      ).toLowerCase()}"
    >

      <div class="source">

        <span>
          ${n.source} • ${n.time}
        </span>

        <span class="tag">
          ${n.tag}
        </span>

      </div>

      <h4>
        ${n.title}
      </h4>

      <p>
        ${n.desc}
      </p>

    </article>
  `;

}


// ============================================================
// RADAR VISUAL
// ============================================================

function renderRadar() {

  const labels = [
    "Economia",
    "Segurança",
    "Liberdade",
    "Impostos",
    "Agro",
    "Educação"
  ];

  const box =
    document.getElementById("radarVisual");


  box.innerHTML =
    '<div class="radar-poly"></div>' +

    labels
      .map(
        (l, i) => `
          <i
            class="radar-axis"
            style="transform:rotate(${i * 60}deg)"
          ></i>
        `
      )
      .join("") +

    labels
      .map(
        (l, i) => {

          const a =
            i * 60 * Math.PI / 180;

          const x =
            50 + 47 * Math.cos(a);

          const y =
            50 + 47 * Math.sin(a);

          return `
            <span
              class="radar-label"
              style="
                left:${x}%;
                top:${y}%;
                transform:translate(-50%,-50%)
              "
            >
              ${l}
            </span>
          `;

        }
      )
      .join("");

}


// ============================================================
// GRÁFICO
// ============================================================

function drawChart() {

  const c =
    document.getElementById("volumeChart");

  const dpr =
    devicePixelRatio || 1;

  const rect =
    c.getBoundingClientRect();


  c.width =
    rect.width * dpr;

  c.height =
    rect.height * dpr;


  const x =
    c.getContext("2d");

  x.scale(dpr, dpr);


  const w =
    rect.width;

  const h =
    rect.height;

  const p =
    28;


  const a = [
    28,
    34,
    31,
    46,
    42,
    55,
    63,
    58,
    71,
    68,
    83,
    76
  ];


  const b = [
    44,
    48,
    52,
    58,
    54,
    64,
    69,
    72,
    78,
    81,
    88,
    92
  ];


  x.clearRect(
    0,
    0,
    w,
    h
  );


  x.strokeStyle =
    "#e2e8f0";

  x.lineWidth =
    1;


  for (
    let i = 0;
    i < 5;
    i++
  ) {

    const y =
      p +
      (h - p * 2) *
      i /
      4;


    x.beginPath();

    x.moveTo(
      p,
      y
    );

    x.lineTo(
      w - p,
      y
    );

    x.stroke();

  }


  [
    [a, "#154b8b"],
    [b, "#fdb813"]
  ]
    .forEach(
      ([arr, color]) => {

        x.strokeStyle =
          color;

        x.lineWidth =
          3;

        x.beginPath();


        arr.forEach(
          (v, i) => {

            const px =
              p +
              (w - p * 2) *
              i /
              (arr.length - 1);


            const py =
              h -
              p -
              (h - p * 2) *
              v /
              100;


            if (i) {

              x.lineTo(
                px,
                py
              );

            } else {

              x.moveTo(
                px,
                py
              );

            }

          }
        );


        x.stroke();

      }
    );

}


// ============================================================
// ABERTURA DAS ABAS
// ============================================================

function openTab(name) {

  document
    .querySelectorAll(".tab")
    .forEach(
      b => {

        const on =
          b.dataset.tab === name;

        b.classList.toggle(
          "active",
          on
        );

        b.setAttribute(
          "aria-selected",
          on
        );

      }
    );


  document
    .querySelectorAll(".tab-panel")
    .forEach(
      p =>
        p.classList.toggle(
          "active",
          p.id === "panel-" + name
        )
    );

}


// ============================================================
// EVENTOS DAS ABAS
// ============================================================

document
  .querySelectorAll(".tab")
  .forEach(
    b =>
      b.addEventListener(
        "click",
        () =>
          openTab(
            b.dataset.tab
          )
      )
  );


document
  .querySelectorAll("[data-open-tab]")
  .forEach(
    b => {

      b.onclick =
        () =>
          openTab(
            b.dataset.openTab
          );

    }
  );


// ============================================================
// FILTROS
// ============================================================

document.getElementById("applyFilters").onclick =
  () => {

    const q =
      document
        .getElementById("searchTerm")
        .value
        .trim()
        .toLowerCase();


    document
      .querySelectorAll(".news-item")
      .forEach(
        n => {

          n.hidden =
            q &&
            !n.dataset.title.includes(q);

        }
      );


    document
      .getElementById("metricMentions")
      .textContent =
        q
          ? "3.214"
          : "12.842";

  };


// ============================================================
// LIMPAR FILTROS
// ============================================================

document.getElementById("resetFilters").onclick =
  () => {

    document.getElementById("period").value =
      "7d";

    document.getElementById("scope").value =
      "all";

    document.getElementById("source").value =
      "all";

    document.getElementById("region").value =
      "BR";

    document.getElementById("searchTerm").value =
      "";

    document
      .getElementById("applyFilters")
      .click();

  };


// ============================================================
// FILTRO DAS MENÇÕES
// ============================================================

document.getElementById("mentionFilter").oninput =
  e => {

    const q =
      e.target.value.toLowerCase();


    document
      .querySelectorAll(
        "#mentionsList .news-item"
      )
      .forEach(
        n => {

          n.hidden =
            q &&
            !n.dataset.title.includes(q);

        }
      );

  };


// ============================================================
// ADICIONAR TEMA
// ============================================================

document.getElementById("addTheme").onclick =
  () =>
    alert(
      "Rascunho: aqui abriremos o gerenciador de temas/palavras-chave quando conectarmos persistência."
    );


// ============================================================
// CLIQUE NOS TEMAS / NUVEM
// ============================================================

document.addEventListener(
  "click",
  e => {

    const t =
      e.target.closest(
        ".theme-card,.word"
      );


    if (t) {

      document
        .getElementById("searchTerm")
        .value =
          t.dataset.theme ||
          t.textContent.trim();


      openTab("overview");


      document
        .getElementById("applyFilters")
        .click();

    }

  }
);


// ============================================================
// IDIOMAS
// ============================================================

function setLanguage(
  l,
  persist = true
) {

  lang =
    translations[l]
      ? l
      : "pt";


  document.documentElement.lang =
    lang === "pt"
      ? "pt-BR"
      : lang;


  document
    .querySelectorAll("[data-i18n]")
    .forEach(
      el => {

        const k =
          el.dataset.i18n;


        if (
          translations[lang][k]
        ) {

          el.textContent =
            translations[lang][k];

        }

      }
    );


  document
    .querySelectorAll(".lang-btn")
    .forEach(
      b => {

        const active =
          b.id ===
          "lang-" + lang;


        b.classList.toggle(
          "active",
          active
        );


        b.setAttribute(
          "aria-pressed",
          active
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

}


// ============================================================
// TAMANHO DA FONTE
// ============================================================

function changeFontSize(d) {

  fontSize =
    Math.min(
      130,
      Math.max(
        85,
        fontSize + d * 10
      )
    );


  document.documentElement.style.setProperty(
    "--base-font-size",
    fontSize + "%"
  );


  localStorage.setItem(
    "fazdireito-font-size",
    fontSize
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

  const dark =
    document.documentElement
      .classList
      .contains("dark");


  document
    .getElementById("themeText")
    .textContent =
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
  document.getElementById(
    "mobileMenuBtn"
  );


const menu =
  document.getElementById(
    "mobileMenu"
  );


const menuIcon =
  document.getElementById(
    "mobileMenuIcon"
  );


function toggleMenu(force) {

  const open =
    force ??
    menu.hidden;


  menu.hidden =
    !open;


  menuBtn.setAttribute(
    "aria-expanded",
    String(open)
  );


  menuIcon.setAttribute(
    "href",
    open
      ? "#i-x"
      : "#i-bars"
  );

}


menuBtn.onclick =
  () =>
    toggleMenu();


document.addEventListener(
  "keydown",
  e => {

    if (
      e.key === "Escape"
    ) {

      toggleMenu(false);

    }

  }
);


document.addEventListener(
  "click",
  e => {

    if (
      !menu.hidden &&
      !menu.contains(e.target) &&
      !menuBtn.contains(e.target)
    ) {

      toggleMenu(false);

    }

  }
);


// ============================================================
// RESIZE
// ============================================================

window.addEventListener(
  "resize",
  () => {

    if (
      innerWidth >= 768
    ) {

      toggleMenu(false);

    }


    drawChart();

  }
);


// ============================================================
// INICIALIZAÇÃO
// ============================================================

(() => {

  const l =
    localStorage.getItem(
      "fazdireito-lang"
    ) || "pt";


  const f =
    Number(
      localStorage.getItem(
        "fazdireito-font-size"
      ) || 100
    );


  const t =
    localStorage.getItem(
      "fazdireito-theme"
    );


  fontSize =
    f;


  document.documentElement.style.setProperty(
    "--base-font-size",
    f + "%"
  );


  if (
    t === "dark"
  ) {

    document.documentElement
      .classList
      .add("dark");

  }


  setLanguage(
    l,
    false
  );


  render();


  // Testa silenciosamente a comunicação
  // entre o front-end e o Cloudflare Worker.
  // Neste estágio ainda não substitui os mocks.

  checkRadarApi();

})();
