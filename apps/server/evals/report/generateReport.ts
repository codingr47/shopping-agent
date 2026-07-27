import { RunResult } from "../lib/types.js";
import { svgHorizontalBarChart, svgGroupedBarChart } from "./svg.js";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncatePrompt(prompt: string, maxLen: number = 50): string {
  return prompt.length > maxLen ? prompt.substring(0, maxLen) + "..." : prompt;
}

function computePerPromptMetrics(
  results: RunResult[],
): Map<string, { name: string; prompt: string; runs: RunResult[]; passCount: number; latencies: number[] }> {
  const grouped = new Map<string, { name: string; prompt: string; runs: RunResult[]; passCount: number; latencies: number[] }>();

  for (const result of results) {
    if (!grouped.has(result.name)) {
      grouped.set(result.name, { name: result.name, prompt: result.prompt, runs: [], passCount: 0, latencies: [] });
    }
    const entry = grouped.get(result.name)!;
    entry.runs.push(result);
    entry.latencies.push(result.latencyMs);
    if (result.passed) entry.passCount++;
  }

  return grouped;
}

function computePerEvaluatorMetrics(results: RunResult[]): Map<string, { key: string; runs: number; passed: number; failedPrompts: Set<string> }> {
  const grouped = new Map<string, { key: string; runs: number; passed: number; failedPrompts: Set<string> }>();

  for (const result of results) {
    for (const evalResult of result.evaluatorResults) {
      if (!grouped.has(evalResult.evaluatorKey)) {
        grouped.set(evalResult.evaluatorKey, { key: evalResult.evaluatorKey, runs: 0, passed: 0, failedPrompts: new Set() });
      }
      const entry = grouped.get(evalResult.evaluatorKey)!;
      entry.runs++;
      if (evalResult.score === 1) entry.passed++;
      else entry.failedPrompts.add(result.name);
    }
  }

  return grouped;
}

function statusColor(passRate: number, threshold: number = 0.8): string {
  if (passRate >= threshold) return "#0ca30c";
  if (passRate > 0) return "#fab219";
  return "#d03b3b";
}

export function generateHtmlReport(
  results: RunResult[],
  reliability: { perPrompt: any[]; meanModalConsistency: number; minModalConsistency: number; unstablePrompts: string[]; p95Latency: number },
): string {
  const timestamp = new Date().toISOString();
  const perPrompt = computePerPromptMetrics(results);
  const perEvaluator = computePerEvaluatorMetrics(results);

  const totalRuns = results.length;
  const distinctPrompts = perPrompt.size;
  const firstPromptRuns = Array.from(perPrompt.values())[0]?.runs.length || 1;
  const totalPassed = results.filter(r => r.passed).length;
  const overallPassRate = totalRuns > 0 ? totalPassed / totalRuns : 0;

  const styleBlock = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f5f5f5;
      color: #333;
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    header {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    h1 { font-size: 28px; margin-bottom: 5px; }
    .timestamp { font-size: 12px; color: #666; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-top: 20px;
    }
    .stat-tile {
      background: white;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid #0ca30c;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .stat-tile.warning { border-left-color: #fab219; }
    .stat-tile.critical { border-left-color: #d03b3b; }
    .stat-value { font-size: 24px; font-weight: bold; color: #0ca30c; }
    .stat-tile.warning .stat-value { color: #fab219; }
    .stat-tile.critical .stat-value { color: #d03b3b; }
    .stat-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
    section {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    h2 { font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 10px; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th {
      background: #f9f9f9;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #eee;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #f0f0f0;
    }
    tr:hover { background: #fafafa; }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-pass { background: #e8f5e9; color: #0ca30c; }
    .badge-fail { background: #ffebee; color: #d03b3b; }
    .badge-warn { background: #fff3e0; color: #f57f17; }
    .chart-container {
      margin: 20px 0;
      padding: 15px;
      background: #fafafa;
      border-radius: 8px;
      overflow-x: auto;
    }
    .chart-legend {
      display: flex;
      gap: 20px;
      margin-bottom: 15px;
      font-size: 12px;
    }
    .legend-item { display: flex; align-items: center; gap: 5px; }
    .legend-color { width: 20px; height: 20px; border-radius: 2px; }
    details {
      margin: 10px 0;
      padding: 12px;
      background: #fafafa;
      border-radius: 6px;
      border: 1px solid #e0e0e0;
    }
    summary {
      cursor: pointer;
      font-weight: 600;
      user-select: none;
    }
    summary:hover { color: #0066cc; }
    .detail-content {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #e0e0e0;
      font-size: 12px;
    }
    .journey-array {
      background: white;
      padding: 10px;
      border-radius: 4px;
      margin: 10px 0;
      font-family: monospace;
      font-size: 11px;
      overflow-x: auto;
      max-height: 150px;
      overflow-y: auto;
    }
    .evaluator-table {
      width: 100%;
      font-size: 11px;
      margin: 10px 0;
    }
    .evaluator-table td { padding: 6px; border: none; }
    .evaluator-table tr:nth-child(odd) { background: white; }
    .evaluator-table tr:nth-child(even) { background: #f9f9f9; }
  `;

  let html = "<!DOCTYPE html>\n";
  html += '<html lang="en">\n';
  html += "<head>\n";
  html += '  <meta charset="UTF-8">\n';
  html += '  <meta name="viewport" content="width=device-width, initial-scale=1">\n';
  html += "  <title>Shopping Agent Eval Report</title>\n";
  html += "  <style>\n" + styleBlock + "  </style>\n";
  html += "</head>\n";
  html += "<body>\n";
  html += '  <div class="container">\n';
  html += "    <header>\n";
  html += "      <h1>🤖 Shopping Agent Evaluation Report</h1>\n";
  html += `      <div class="timestamp">Generated ${timestamp}</div>\n`;
  html += '      <div class="summary-grid">\n';

  html += '        <div class="stat-tile">\n';
  html += '          <div class="stat-label">Distinct Prompts</div>\n';
  html += `          <div class="stat-value">${distinctPrompts}</div>\n`;
  html += "        </div>\n";

  html += '        <div class="stat-tile">\n';
  html += '          <div class="stat-label">Repetitions</div>\n';
  html += `          <div class="stat-value">${firstPromptRuns}</div>\n`;
  html += "        </div>\n";

  html += '        <div class="stat-tile">\n';
  html += '          <div class="stat-label">Total Runs</div>\n';
  html += `          <div class="stat-value">${totalRuns}</div>\n`;
  html += "        </div>\n";

  const passRateClass = overallPassRate === 1 ? "" : overallPassRate > 0.5 ? "warning" : "critical";
  html += `        <div class="stat-tile ${passRateClass}">\n`;
  html += '          <div class="stat-label">Overall Pass Rate</div>\n';
  html += `          <div class="stat-value">${(overallPassRate * 100).toFixed(0)}%</div>\n`;
  html += "        </div>\n";

  const consistencyClass = reliability.meanModalConsistency >= 0.8 ? "" : "warning";
  html += `        <div class="stat-tile ${consistencyClass}">\n`;
  html += '          <div class="stat-label">Mean Consistency</div>\n';
  html += `          <div class="stat-value">${(reliability.meanModalConsistency * 100).toFixed(0)}%</div>\n`;
  html += "        </div>\n";

  const minConsistencyClass = reliability.minModalConsistency >= 0.8 ? "" : "critical";
  html += `        <div class="stat-tile ${minConsistencyClass}">\n`;
  html += '          <div class="stat-label">Min Consistency</div>\n';
  html += `          <div class="stat-value">${(reliability.minModalConsistency * 100).toFixed(0)}%</div>\n`;
  html += "        </div>\n";

  html += '        <div class="stat-tile">\n';
  html += '          <div class="stat-label">P95 Latency</div>\n';
  html += `          <div class="stat-value">${reliability.p95Latency}ms</div>\n`;
  html += "        </div>\n";

  html += "      </div>\n";
  html += "    </header>\n";

  // Pass rate section
  html += "    <section>\n";
  html += "      <h2>📊 Pass Rate by Prompt</h2>\n";
  html += '      <div class="chart-container">\n';
  const passRateRows = Array.from(perPrompt.entries()).map(([name, data]) => ({
    label: name,
    value: (data.passCount / data.runs.length) * 100,
    fill: statusColor(data.passCount / data.runs.length),
    title: `${data.name}: ${data.passCount}/${data.runs.length} passed`,
  }));
  html += svgHorizontalBarChart(passRateRows, { width: 700 });
  html += "      </div>\n";

  html += "      <table>\n";
  html += "        <thead>\n";
  html += "          <tr>\n";
  html += "            <th>Prompt Name</th>\n";
  html += "            <th>Full Prompt</th>\n";
  html += "            <th>Runs</th>\n";
  html += "            <th>Pass Rate</th>\n";
  html += "            <th>Consistency</th>\n";
  html += "            <th>Latency (mean/p95)</th>\n";
  html += "          </tr>\n";
  html += "        </thead>\n";
  html += "        <tbody>\n";

  for (const [name, data] of perPrompt.entries()) {
    const consistency = reliability.perPrompt.find((p: any) => p.prompt === data.prompt)?.modalJourneyConsistency ?? 0;
    const passRate = data.passCount / data.runs.length;
    const latencies = [...data.latencies].sort((a, b) => a - b);
    const meanLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p95Latency = latencies[Math.ceil(latencies.length * 0.95) - 1] || 0;

    const badgeClass = passRate === 1 ? "badge-pass" : passRate > 0 ? "badge-warn" : "badge-fail";
    html += "          <tr>\n";
    html += `            <td><strong>${escapeHtml(name)}</strong></td>\n`;
    html += `            <td title="${escapeHtml(data.prompt)}">${escapeHtml(truncatePrompt(data.prompt))}</td>\n`;
    html += `            <td>${data.runs.length}</td>\n`;
    html += `            <td><span class="badge ${badgeClass}">${(passRate * 100).toFixed(0)}%</span></td>\n`;
    html += `            <td>${(consistency * 100).toFixed(0)}%</td>\n`;
    html += `            <td>${meanLatency.toFixed(0)}ms / ${p95Latency}ms</td>\n`;
    html += "          </tr>\n";
  }

  html += "        </tbody>\n";
  html += "      </table>\n";
  html += "    </section>\n";

  // Modal consistency section
  html += "    <section>\n";
  html += "      <h2>🎯 Modal Consistency by Prompt</h2>\n";
  html += '      <div class="chart-container">\n';
  const consistencyRows = Array.from(perPrompt.entries()).map(([name, data]) => {
    const consistency = reliability.perPrompt.find((p: any) => p.prompt === data.prompt)?.modalJourneyConsistency ?? 0;
    return {
      label: name,
      value: consistency * 100,
      fill: statusColor(consistency, 0.8),
      title: `${name}: ${(consistency * 100).toFixed(0)}% consistent`,
    };
  });
  html += svgHorizontalBarChart(consistencyRows, { width: 700 });
  html += "      </div>\n";
  html += "    </section>\n";

  // Latency section
  html += "    <section>\n";
  html += "      <h2>⚡ Latency Distribution</h2>\n";
  html += '      <div class="chart-container">\n';
  html += '        <div class="chart-legend">\n';
  html += '          <div class="legend-item"><div class="legend-color" style="background: #86b6ef;"></div> Min</div>\n';
  html += '          <div class="legend-item"><div class="legend-color" style="background: #3987e5;"></div> Mean</div>\n';
  html += '          <div class="legend-item"><div class="legend-color" style="background: #1c5cab;"></div> P95</div>\n';
  html += '          <div class="legend-item"><div class="legend-color" style="background: #0d366b;"></div> Max</div>\n';
  html += "        </div>\n";
  const latencyRows = Array.from(perPrompt.entries()).map(([name, data]) => {
    const latencies = [...data.latencies].sort((a, b) => a - b);
    const min = latencies[0];
    const max = latencies[latencies.length - 1];
    const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p95 = latencies[Math.ceil(latencies.length * 0.95) - 1] || 0;
    return {
      label: name,
      series: [
        { value: min, max, title: `Min: ${min}ms` },
        { value: mean, max, title: `Mean: ${mean.toFixed(0)}ms` },
        { value: p95, max, title: `P95: ${p95}ms` },
        { value: max, max, title: `Max: ${max}ms` },
      ],
    };
  });
  html += svgGroupedBarChart(
    latencyRows,
    [
      { label: "Min", color: "#86b6ef" },
      { label: "Mean", color: "#3987e5" },
      { label: "P95", color: "#1c5cab" },
      { label: "Max", color: "#0d366b" },
    ],
    { width: 700 },
  );
  html += "      </div>\n";
  html += "    </section>\n";

  // Evaluator summary
  html += "    <section>\n";
  html += "      <h2>🔍 Evaluator Summary</h2>\n";
  html += "      <table>\n";
  html += "        <thead>\n";
  html += "          <tr>\n";
  html += "            <th>Evaluator</th>\n";
  html += "            <th>Pass Rate</th>\n";
  html += "            <th>Failed Prompts</th>\n";
  html += "          </tr>\n";
  html += "        </thead>\n";
  html += "        <tbody>\n";

  const evaluatorEntries = Array.from(perEvaluator.entries()).sort((a, b) => b[1].passed / b[1].runs - a[1].passed / a[1].runs);
  for (const [key, data] of evaluatorEntries) {
    const passRate = data.passed / data.runs;
    const failedList = Array.from(data.failedPrompts).join(", ");
    const badgeClass = passRate === 1 ? "badge-pass" : passRate > 0 ? "badge-warn" : "badge-fail";
    html += "          <tr>\n";
    html += `            <td><strong>${escapeHtml(key)}</strong></td>\n`;
    html += `            <td><span class="badge ${badgeClass}">${(passRate * 100).toFixed(0)}%</span></td>\n`;
    html += `            <td>${failedList || "—"}</td>\n`;
    html += "          </tr>\n";
  }

  html += "        </tbody>\n";
  html += "      </table>\n";
  html += "    </section>\n";

  // Detailed results
  html += "    <section>\n";
  html += "      <h2>📝 Detailed Run Results</h2>\n";

  for (const [name, data] of perPrompt.entries()) {
    html += `      <details>\n`;
    html += `        <summary>${escapeHtml(name)} (${data.passCount}/${data.runs.length} passed)</summary>\n`;
    html += `        <div class="detail-content">\n`;

    for (const run of data.runs) {
      const passEmoji = run.passed ? "✅ PASSED" : "❌ FAILED";
      html += `          <details>\n`;
      html += `            <summary>Repetition ${run.repetition + 1}: ${passEmoji}</summary>\n`;
      html += `            <div class="detail-content">\n`;

      html += `              <div>\n`;
      html += `                <strong>Journey:</strong>\n`;
      html += `                <div class="journey-array">["${run.journey.map((j) => escapeHtml(j)).join('", "')}"]</div>\n`;
      html += `              </div>\n`;

      html += `              <div>\n`;
      html += `                <strong>Selected Intent:</strong> ${run.selectedIntent || "—"}\n`;
      html += `              </div>\n`;

      html += `              <div>\n`;
      html += `                <strong>Tool Calls:</strong>\n`;
      html += `                <div class="journey-array">${escapeHtml(JSON.stringify(run.toolCalls, null, 2))}</div>\n`;
      html += `              </div>\n`;

      html += `              <div>\n`;
      html += `                <strong>Latency:</strong> ${run.latencyMs}ms\n`;
      html += `              </div>\n`;

      html += `              <div>\n`;
      html += `                <strong>Evaluator Results:</strong>\n`;
      html += `                <table class="evaluator-table">\n`;

      for (const er of run.evaluatorResults) {
        const badgeText = er.score === 1 ? "PASS" : "FAIL";
        const badgeClass = er.score === 1 ? "badge-pass" : "badge-fail";
        html += `                  <tr>\n`;
        html += `                    <td>${escapeHtml(er.evaluatorKey)}</td>\n`;
        html += `                    <td><span class="badge ${badgeClass}">${badgeText}</span></td>\n`;
        html += `                    <td>${escapeHtml(er.comment)}</td>\n`;
        html += `                  </tr>\n`;
      }

      html += `                </table>\n`;
      html += `              </div>\n`;
      html += `            </div>\n`;
      html += `          </details>\n`;
    }

    html += `        </div>\n`;
    html += `      </details>\n`;
  }

  html += "    </section>\n";
  html += "  </div>\n";
  html += "</body>\n";
  html += "</html>";

  return html;
}
