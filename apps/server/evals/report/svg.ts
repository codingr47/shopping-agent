export interface BarChartRow {
  label: string;
  value: number;
  max?: number;
  fill: string;
  title: string;
}

export interface GroupedBarChartSeries {
  label: string;
  color: string;
}

export interface GroupedBarChartRow {
  label: string;
  series: Array<{ value: number; max?: number; title: string }>;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function svgHorizontalBarChart(rows: BarChartRow[], options: { height?: number; width?: number; showValues?: boolean } = {}): string {
  const { height = 30, width = 600, showValues = true } = options;
  const rowHeight = height + 10;
  const totalHeight = rows.length * rowHeight + 40;
  const chartWidth = width - 200;
  const labelWidth = 150;

  let svg = `<svg width="${width + 50}" height="${totalHeight}" viewBox="0 0 ${width + 50} ${totalHeight}" xmlns="http://www.w3.org/2000/svg">`;

  let y = 30;
  for (const row of rows) {
    const maxVal = row.max ?? Math.max(...rows.map(r => r.value));
    const barWidth = (row.value / maxVal) * chartWidth;
    const percentage = ((row.value / maxVal) * 100).toFixed(0);

    svg += `<g>`;
    svg += `<text x="10" y="${y + height / 2}" font-size="12" text-anchor="start" dominant-baseline="middle">${escapeHtml(row.label.substring(0, 20))}</text>`;
    svg += `<rect x="${labelWidth}" y="${y}" width="${barWidth}" height="${height}" fill="${row.fill}" rx="4" ry="4">`;
    svg += `<title>${escapeHtml(row.title)}</title>`;
    svg += `</rect>`;

    if (showValues && row.value > 0) {
      const textX = labelWidth + barWidth + 5;
      svg += `<text x="${textX}" y="${y + height / 2}" font-size="11" font-weight="500" text-anchor="start" dominant-baseline="middle">${percentage}%</text>`;
    }

    svg += `</g>`;
    y += rowHeight;
  }

  svg += `</svg>`;
  return svg;
}

export function svgGroupedBarChart(
  rows: GroupedBarChartRow[],
  series: GroupedBarChartSeries[],
  options: { height?: number; width?: number; groupGap?: number } = {},
): string {
  const { height = 20, width = 600, groupGap = 4 } = options;
  const rowHeight = height * series.length + groupGap + 15;
  const totalHeight = rows.length * rowHeight + 60;
  const chartWidth = width - 200;
  const labelWidth = 150;

  let svg = `<svg width="${width + 50}" height="${totalHeight}" viewBox="0 0 ${width + 50} ${totalHeight}" xmlns="http://www.w3.org/2000/svg">`;

  let y = 40;
  for (const row of rows) {
    const maxVal = Math.max(...row.series.map(s => s.value));

    // Row label
    svg += `<text x="10" y="${y + (height * series.length) / 2}" font-size="12" text-anchor="start" dominant-baseline="middle">${escapeHtml(row.label.substring(0, 20))}</text>`;

    let seriesY = y;
    for (let i = 0; i < series.length; i++) {
      const s = row.series[i];
      const ser = series[i];
      const barWidth = (s.value / maxVal) * chartWidth;
      const value = s.value.toFixed(0);

      svg += `<rect x="${labelWidth}" y="${seriesY}" width="${barWidth}" height="${height}" fill="${ser.color}" rx="2" ry="2">`;
      svg += `<title>${escapeHtml(s.title)}</title>`;
      svg += `</rect>`;

      if (barWidth > 20) {
        svg += `<text x="${labelWidth + barWidth + 3}" y="${seriesY + height / 2}" font-size="10" text-anchor="start" dominant-baseline="middle">${value}ms</text>`;
      }

      seriesY += height + 2;
    }

    y += rowHeight;
  }

  svg += `</svg>`;
  return svg;
}
