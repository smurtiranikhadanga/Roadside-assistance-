/* charts.js — Chart.js setup for analytics */

const CHART_DEFAULTS = {
  color: '#8892b0',
  grid: 'rgba(255,255,255,0.05)',
  font: { family: 'Inter', size: 11 }
};

function makeLineChart(id, labels, data, label, color = '#1a73e8') {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{ label, data, borderColor: color, backgroundColor: color + '22',
                   tension: 0.4, fill: true, pointRadius: 3 }]
    },
    options: {
      responsive: true, plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: CHART_DEFAULTS.color, font: CHART_DEFAULTS.font },
             grid: { color: CHART_DEFAULTS.grid } },
        y: { ticks: { color: CHART_DEFAULTS.color, font: CHART_DEFAULTS.font },
             grid: { color: CHART_DEFAULTS.grid } }
      }
    }
  });
}

function makeDoughnutChart(id, labels, data, colors) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  return new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: CHART_DEFAULTS.color, font: CHART_DEFAULTS.font } }
      }
    }
  });
}

function makeBarChart(id, labels, data, label, color = '#1a73e8') {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label, data, backgroundColor: color + 'cc', borderRadius: 6 }]
    },
    options: {
      responsive: true, plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: CHART_DEFAULTS.color, font: CHART_DEFAULTS.font },
             grid: { color: CHART_DEFAULTS.grid } },
        y: { ticks: { color: CHART_DEFAULTS.color, font: CHART_DEFAULTS.font },
             grid: { color: CHART_DEFAULTS.grid } }
      }
    }
  });
}

// ── Admin analytics charts ────────────────────────────────────
async function loadAdminCharts() {
  // Revenue chart
  const revenueRes = await api('/api/v1/admin/revenue-chart');
  if (revenueRes.success && revenueRes.data.length) {
    makeLineChart('admin-revenue-chart',
      revenueRes.data.map(r => r.date),
      revenueRes.data.map(r => r.revenue),
      'Revenue (₹)', '#00c853'
    );
  }

  // Service type pie
  makeDoughnutChart('admin-service-chart',
    ['Flat Tyre', 'Battery', 'Fuel', 'Engine', 'Towing', 'Other'],
    [30, 22, 18, 15, 10, 5],
    ['#e53935','#1a73e8','#ffd600','#ff6d00','#7c4dff','#00c853']
  );

  // Peak hours bar
  makeBarChart('peak-hours-chart',
    ['6am','8am','10am','12pm','2pm','4pm','6pm','8pm','10pm'],
    [5, 20, 15, 12, 10, 18, 25, 14, 8],
    'Requests', '#1a73e8'
  );

  // Revenue growth
  const months = ['Jan','Feb','Mar','Apr','May','Jun'];
  makeLineChart('revenue-growth-chart', months,
    [12000, 18000, 15000, 22000, 28000, 35000],
    'Revenue', '#7c4dff'
  );

  // Issues chart
  makeDoughnutChart('issues-chart',
    ['Flat Tyre','Battery','Fuel','Engine','Towing'],
    [35, 25, 20, 12, 8],
    ['#e53935','#1a73e8','#ffd600','#ff6d00','#7c4dff']
  );

  // Mechanic performance
  makeBarChart('mechanic-perf-chart',
    ['Rajan K.','Suresh B.','Anand S.'],
    [120, 87, 200],
    'Jobs Completed', '#00c853'
  );
}

// ── Mechanic earnings chart ───────────────────────────────────
function loadMechanicEarningsChart(labels, data) {
  makeLineChart('earnings-chart', labels, data, 'Earnings (₹)', '#00c853');
}
