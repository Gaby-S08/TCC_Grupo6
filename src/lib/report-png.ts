import type { HelpAsset, HelpLaboratory, HelpTicket } from "./help.types";

export function exportLabReportPng(
  lab: HelpLaboratory,
  assets: HelpAsset[],
  tickets: HelpTicket[],
): void {
  const labAssets = assets.filter((a) => a.laboratory_id === lab.id);
  const labTickets = tickets.filter((t) => t.laboratory_id === lab.id || t.lab_name === lab.name);
  const openTickets = labTickets.filter((t) => t.status !== "Concluído");
  const closedTickets = labTickets.filter((t) => t.status === "Concluído");
  const totalQty = labAssets.reduce((sum, a) => sum + a.quantity, 0);

  const rowHeight = 36;
  const visibleRows = Math.max(labAssets.length, 1);
  const tableHeight = 128 + visibleRows * rowHeight;
  const width = 1200;
  const height = Math.max(660, 396 + tableHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#f4f9f9";
  ctx.fillRect(0, 0, width, height);

  // Header banner
  ctx.fillStyle = "#0d3038";
  ctx.fillRect(0, 0, width, 168);

  ctx.fillStyle = "#8ce9e7";
  ctx.font = "700 13px 'DM Sans', sans-serif";
  ctx.fillText("HELP! · RELATÓRIO VISUAL DE LABORATÓRIO", 56, 54);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 32px 'Manrope', sans-serif";
  ctx.fillText(lab.name, 56, 102);

  ctx.fillStyle = "#c8e6e8";
  ctx.font = "500 15px 'DM Sans', sans-serif";
  const generatedAt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
  ctx.fillText(
    `Departamento: ${lab.department} · Sala: ${lab.room || "—"} · Gerado em ${generatedAt}`,
    56,
    136,
  );

  // Metric cards
  const metrics = [
    { label: "ITENS CATALOGADOS", value: String(labAssets.length), accent: "#137d85" },
    { label: "UNIDADES TOTAIS", value: String(totalQty), accent: "#0d3038" },
    { label: "CHAMADOS EM ANDAMENTO", value: String(openTickets.length), accent: "#d97706" },
    { label: "CHAMADOS CONCLUÍDOS", value: String(closedTickets.length), accent: "#16a34a" },
  ];

  metrics.forEach((metric, index) => {
    const x = 56 + index * 276;
    const y = 204;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(x, y, 256, 118, 16);
    ctx.fill();
    ctx.strokeStyle = "#dce8e8";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = metric.accent;
    ctx.fillRect(x, y, 256, 5);

    ctx.fillStyle = "#5f7278";
    ctx.font = "700 11px 'DM Sans', sans-serif";
    ctx.fillText(metric.label, x + 22, y + 40);

    ctx.fillStyle = "#102c35";
    ctx.font = "800 38px 'Manrope', sans-serif";
    ctx.fillText(metric.value, x + 22, y + 92);
  });

  // Equipment table block
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(56, 356, 1088, tableHeight, 18);
  ctx.fill();
  ctx.strokeStyle = "#dce8e8";
  ctx.stroke();

  ctx.fillStyle = "#102c35";
  ctx.font = "800 18px 'Manrope', sans-serif";
  ctx.fillText("Equipamentos registrados no ambiente", 84, 398);

  ctx.fillStyle = "#5f7278";
  ctx.font = "700 12px 'DM Sans', sans-serif";
  ctx.fillText("CÓDIGO", 84, 434);
  ctx.fillText("EQUIPAMENTO", 260, 434);
  ctx.fillText("ESPECIFICAÇÃO", 560, 434);
  ctx.fillText("QTD.", 1040, 434);

  ctx.strokeStyle = "#e6efef";
  ctx.beginPath();
  ctx.moveTo(84, 446);
  ctx.lineTo(1116, 446);
  ctx.stroke();

  if (labAssets.length === 0) {
    ctx.fillStyle = "#5f7278";
    ctx.font = "500 14px 'DM Sans', sans-serif";
    ctx.fillText("Nenhum equipamento cadastrado neste laboratório até o momento.", 84, 488);
  } else {
    labAssets.forEach((asset, idx) => {
      const rowY = 482 + idx * rowHeight;
      ctx.fillStyle = "#117e87";
      ctx.font = "700 13px 'DM Sans', sans-serif";
      ctx.fillText(asset.code, 84, rowY);

      ctx.fillStyle = "#102c35";
      ctx.font = "600 13px 'DM Sans', sans-serif";
      ctx.fillText(asset.name.slice(0, 32), 260, rowY);

      ctx.fillStyle = "#50676e";
      ctx.font = "400 13px 'DM Sans', sans-serif";
      ctx.fillText(asset.description.slice(0, 56), 560, rowY);

      ctx.fillStyle = "#102c35";
      ctx.font = "700 13px 'DM Sans', sans-serif";
      ctx.fillText(String(asset.quantity), 1046, rowY);
    });
  }

  const link = document.createElement("a");
  link.download = `relatorio-${lab.id}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function escapeCsv(value: string | number | null | undefined): string {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const lines = [headers.map(escapeCsv).join(";"), ...rows.map((r) => r.map(escapeCsv).join(";"))];
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportLabAssetsCsv(lab: HelpLaboratory, assets: HelpAsset[]): void {
  const labAssets = assets.filter((a) => a.laboratory_id === lab.id);
  downloadCsv(
    `equipamentos-${lab.id}.csv`,
    ["Código", "Equipamento", "Especificações", "Quantidade", "Laboratório", "Departamento", "Sala"],
    labAssets.map((a) => [a.code, a.name, a.description, a.quantity, lab.name, lab.department, lab.room]),
  );
}

export function exportLabTicketsCsv(lab: HelpLaboratory, tickets: HelpTicket[]): void {
  const labTickets = tickets.filter((t) => t.laboratory_id === lab.id || t.lab_name === lab.name);
  downloadCsv(
    `chamados-${lab.id}.csv`,
    ["ID", "Data", "Equipamento", "Série", "Solicitante", "Tipo", "Prioridade", "Status", "Descrição"],
    labTickets.map((t) => [
      t.id,
      new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(t.created_at)),
      t.asset_name,
      t.serial,
      t.requester_name,
      t.request_type,
      t.priority,
      t.status,
      t.description,
    ]),
  );
}