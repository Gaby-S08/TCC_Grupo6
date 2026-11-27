import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  BarChart3,
  Box,
  Building2,
  CheckCircle2,
  ClipboardList,
  MessageSquareText,
  QrCode,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import helpLogo from "@/assets/help-logo.png";
import heroTablet from "@/assets/hero-tablet.webp";
import labInformatica from "@/assets/lab-informatica.webp";
import oficinaMecanica from "@/assets/oficina-mecanica.webp";
import labAutomacao from "@/assets/lab-automacao.webp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Help! — Gestão de Ativos, Laboratórios e Manutenção" },
      {
        name: "description",
        content:
          "Sistema online para organizar equipamentos, laboratórios e chamados de manutenção em um só lugar.",
      },
      { property: "og:title", content: "Help! — Gestão de Ativos e Laboratórios" },
      {
        property: "og:description",
        content:
          "Organize equipamentos, laboratórios e chamados de manutenção com visão clara do ativo ao atendimento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

const MODULE_GROUPS = [
  {
    index: "01",
    groupTitle: "Inventário e espaços",
    groupSummary: "Organização centralizada do parque tecnológico e dos ambientes.",
    items: [
      {
        icon: Box,
        title: "Catálogo de ativos",
        description:
          "Consulte equipamentos por laboratório, pesquise o catálogo e mantenha quantidades e especificações registradas.",
      },
      {
        icon: Building2,
        title: "Gestão de laboratórios",
        description:
          "Associe salas e oficinas aos departamentos, mantendo cada equipamento vinculado ao seu ambiente de uso.",
      },
    ],
  },
  {
    index: "02",
    groupTitle: "Ocorrências e atendimento",
    groupSummary: "Comunicação estruturada do registro do defeito até a conclusão.",
    items: [
      {
        icon: Wrench,
        title: "Chamados técnicos",
        description:
          "Abra solicitações vinculadas ao equipamento e ao número de série, com tipo de serviço e foto de evidência.",
      },
      {
        icon: MessageSquareText,
        title: "Histórico e conversa",
        description:
          "Acompanhe o andamento de cada ocorrência e consulte as mensagens trocadas entre solicitante e equipe técnica.",
      },
    ],
  },
  {
    index: "03",
    groupTitle: "Controle e identificação",
    groupSummary: "Indicadores visuais e rastreabilidade rápida no dia a dia.",
    items: [
      {
        icon: BarChart3,
        title: "Painel administrativo",
        description:
          "Visualize chamados por status e laboratório, acompanhe indicadores em tempo real e gere relatórios em PNG.",
      },
      {
        icon: QrCode,
        title: "Identificação por QR",
        description:
          "Gere etiquetas QR imediatamente para identificar cada ativo cadastrado no catálogo institucional.",
      },
    ],
  },
] as const;

const ENVIRONMENTS = [
  {
    department: "Informática e Redes",
    summary: "Estações de trabalho, infraestrutura de rede e bancadas de ensino.",
    image: labInformatica,
    alt: "Laboratório de informática com estações de trabalho e rack de rede",
    examples: ["Switch Cisco 24 Portas", "Workstation Dell Precision", "Salas de Informática"],
  },
  {
    department: "Engenharia Mecânica",
    summary: "Máquinas operatrizes, ferramentas de precisão e oficinas técnicas.",
    image: oficinaMecanica,
    alt: "Oficina de engenharia mecânica com torno CNC e bancadas",
    examples: ["Torno Mecânico Romi", "Oficina 02 · Usinagem CNC"],
  },
  {
    department: "Automação Industrial",
    summary: "Bancadas de controle, módulos didáticos e células robotizadas.",
    image: labAutomacao,
    alt: "Laboratório de automação industrial com braço robótico",
    examples: ["Lab 05 · Robótica Industrial", "Módulos de Treinamento CLP"],
  },
] as const;

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Localize pelo ambiente",
    detail: "Filtre o catálogo por laboratório ou sala e encontre o equipamento rapidamente.",
  },
  {
    step: "02",
    title: "Registre com identificação",
    detail: "Vincule o chamado ao ativo, número de série, tipo de reparo e foto opcional.",
  },
  {
    step: "03",
    title: "Acompanhe até a conclusão",
    detail: "Receba atualizações de status, converse no chamado e consulte todo o histórico.",
  },
] as const;

function HomePage() {
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setIsSignedIn(Boolean(data.session));
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setIsSignedIn(Boolean(session));
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <a href="#topo" className="inline-flex items-center gap-3">
            <img src={helpLogo} alt="Help!" className="h-9 w-auto object-contain dark:brightness-125" />
            <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] font-bold tracking-[0.14em] text-muted-foreground">
              ENTERPRISE
            </span>
          </a>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <nav
              aria-label="Seções da página inicial"
              className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold text-muted-foreground"
            >
              <a href="#modulos" className="transition-colors hover:text-primary">
                Módulos
              </a>
              <a href="#ambientes" className="transition-colors hover:text-primary">
                Ambientes
              </a>
              <a href="#fluxo" className="transition-colors hover:text-primary">
                Fluxo
              </a>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="topo">
        {/* Hero section with the single login button */}
        <section className="px-4 pt-5 sm:px-8 sm:pt-7">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-hero-surface px-6 py-12 sm:px-12 sm:py-16 lg:px-16">
            <div className="grid items-center gap-10 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-6">
                <p className="inline-flex items-center gap-2 text-xs font-extrabold tracking-[0.14em] text-brand-teal uppercase">
                  <span className="h-2 w-2 rounded-full bg-brand-teal" aria-hidden="true" />
                  Gestão de ativos e manutenção
                </p>

                <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-[3.35rem]">
                  Ativos em ordem. Laboratórios prontos.{" "}
                  <span className="text-brand-teal">Manutenção acompanhada.</span>
                </h1>

                <p className="max-w-xl text-base leading-relaxed text-foreground/80 sm:text-lg">
                  Uma visão estruturada dos equipamentos, salas e chamados técnicos da sua
                  instituição — do catálogo ao atendimento em um só ambiente.
                </p>

                <div className="pt-2">
                  <Button asChild variant="hero" size="xl">
                    <Link to={isSignedIn ? "/portal" : "/login"}>
                      {isSignedIn ? "Acessar meu portal" : "Entrar no sistema"}
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>

                <ul className="flex flex-wrap gap-x-6 gap-y-2 pt-3 text-xs font-semibold text-muted-foreground">
                  <li className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-brand-teal" aria-hidden="true" />
                    Inventário por sala
                  </li>
                  <li className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-brand-teal" aria-hidden="true" />
                    Chamados com histórico
                  </li>
                  <li className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-brand-teal" aria-hidden="true" />
                    Relatórios e etiquetas QR
                  </li>
                </ul>
              </div>

              <div className="lg:col-span-6">
                <div className="relative mx-auto max-w-xl">
                  <img
                    src={heroTablet}
                    alt="Painel ilustrativo do sistema Help! exibido em um tablet"
                    className="help-float help-elevated-shadow w-full rounded-2xl object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Structured Grouping 1: Functional Pillars */}
        <section id="modulos" className="mt-16 bg-canvas-surface py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="max-w-2xl space-y-3">
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                Estrutura organizada por frente de trabalho
              </h2>
              <p className="text-base leading-relaxed text-muted-foreground">
                Os recursos do Help! são agrupados em três pilares complementares para manter o
                controle de equipamentos e atendimentos sempre claro.
              </p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {MODULE_GROUPS.map((group) => (
                <section
                  key={group.index}
                  className="help-card-shadow flex flex-col rounded-2xl border border-border bg-card p-6 sm:p-7"
                >
                  <div className="border-b border-border pb-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-extrabold tracking-[0.14em] text-brand-teal">
                        AGRUPAMENTO {group.index}
                      </span>
                      <ClipboardList className="h-4 w-4 text-muted-foreground/70" aria-hidden="true" />
                    </div>
                    <h3 className="mt-2 text-xl font-extrabold tracking-tight text-foreground">
                      {group.groupTitle}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {group.groupSummary}
                    </p>
                  </div>

                  <div className="mt-5 flex flex-1 flex-col gap-5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.title}
                          className="rounded-xl border border-border/70 bg-canvas-surface/70 p-4"
                        >
                          <div className="flex items-start gap-3.5">
                            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-teal-soft text-brand-teal">
                              <Icon className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <div>
                              <h4 className="text-sm font-bold text-foreground">{item.title}</h4>
                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                {item.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </section>

        {/* Structured Grouping 2: Institutional Environments */}
        <section id="ambientes" className="py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div className="max-w-2xl space-y-3">
                <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                  Ambientes agrupados por departamento
                </h2>
                <p className="text-base leading-relaxed text-muted-foreground">
                  Cada espaço mantém seus equipamentos, responsáveis e histórico de manutenção
                  organizados de forma independente.
                </p>
              </div>
              <p className="text-xs font-semibold text-muted-foreground">
                Estrutura alinhada aos departamentos cadastrados no sistema
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {ENVIRONMENTS.map((env) => (
                <article
                  key={env.department}
                  className="help-card-shadow flex flex-col overflow-hidden rounded-2xl border border-border bg-card"
                >
                  <div className="aspect-[16/10] w-full overflow-hidden bg-muted">
                    <img
                      src={env.image}
                      alt={env.alt}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <span className="text-[11px] font-extrabold tracking-[0.12em] text-brand-teal uppercase">
                      Departamento
                    </span>
                    <h3 className="mt-1.5 text-lg font-extrabold text-foreground">
                      {env.department}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {env.summary}
                    </p>
                    <ul className="mt-5 space-y-2 border-t border-border pt-4 text-xs font-medium text-foreground/85">
                      {env.examples.map((example) => (
                        <li key={example} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-brand-teal" aria-hidden="true" />
                          {example}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Structured Grouping 3: Operational Flow */}
        <section id="fluxo" className="bg-navy py-20 text-navy-foreground sm:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="max-w-2xl space-y-3">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Fluxo operacional em três etapas
              </h2>
              <p className="text-base leading-relaxed text-navy-foreground/75">
                Da localização do equipamento ao fechamento do chamado, toda a equipe segue um
                processo previsível e rastreável.
              </p>
            </div>

            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {WORKFLOW_STEPS.map((item) => (
                <li
                  key={item.step}
                  className="rounded-2xl border border-navy-foreground/15 bg-navy-foreground/5 p-6"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-status-lime text-sm font-extrabold text-status-lime-foreground">
                    {item.step}
                  </span>
                  <h3 className="mt-5 text-lg font-bold text-navy-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-navy-foreground/75">
                    {item.detail}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-background py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 sm:flex-row sm:items-center sm:px-8">
          <div className="flex items-center gap-4">
            <img src={helpLogo} alt="Help!" className="h-8 w-auto object-contain dark:brightness-125" />
            <p className="text-xs text-muted-foreground">
              Gestão de ativos, laboratórios e manutenção acadêmica e corporativa.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs font-semibold text-muted-foreground">
            <a href="#modulos" className="hover:text-primary">
              Módulos
            </a>
            <a href="#ambientes" className="hover:text-primary">
              Ambientes
            </a>
            <a href="#fluxo" className="hover:text-primary">
              Fluxo
            </a>
            <span>© {new Date().getFullYear()} Help!</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
