// Дашборд обраної бази
const DashboardView = {
  render() {
    const camp = StorageManager.getCurrentCampaign();
    const titleEl = document.getElementById('dash-campaign-title');
    const badgeEl = document.getElementById('dash-campaign-badge');

    if (!camp) {
      titleEl.innerText = "Немає активної сформованої бази";
      badgeEl.innerText = "";
      document.getElementById('kpi-today').innerText = "0";
      document.getElementById('kpi-active-repairs').innerText = "0";
      document.getElementById('kpi-total-progress').innerText = "0%";
      document.getElementById('feed-container').innerHTML = '<div class="empty-text">Оберіть або сформуйте базу в меню керівника</div>';
      document.querySelector('#table-dashboard-status tbody').innerHTML = '<tr><td colspan="6" style="text-align:center;">Немає даних</td></tr>';
      return;
    }

    titleEl.innerText = camp.title;
    badgeEl.innerText = camp.repairType;

    const repairs = camp.repairs || [];
    const feed = camp.audit_feed || [];
    const today = new Date().toISOString().split('T')[0];

    let todayCount = 0, totalPlanned = 0, totalDone = 0;
    const empCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };

    repairs.forEach(r => {
      totalPlanned += (r.allowed ? r.allowed.length : 0);
      const checks = r.checks || {};
      for (const op in checks) {
        totalDone++;
        if (checks[op].date === today) todayCount++;
        if (empCounts[checks[op].empCode] !== undefined) empCounts[checks[op].empCode]++;
      }
    });

    document.getElementById('kpi-today').innerText = `${todayCount} к.о.`;
    document.getElementById('kpi-active-repairs').innerText = repairs.length;
    document.getElementById('kpi-total-progress').innerText = totalPlanned > 0 ? Math.round((totalDone / totalPlanned) * 100) + '%' : '0%';

    // Стрічка останніх операцій
    const feedEl = document.getElementById('feed-container');
    feedEl.innerHTML = feed.length === 0 ? '<div class="empty-text">Немає зафіксованих операцій</div>' :
      feed.slice(0, 15).map(f => `
        <div class="feed-item">
          <strong>${f.date}</strong> | <b>${f.name}</b> (${f.kks}) - Операція: <span style="color:#2563eb;font-weight:bold;">${f.op}</span>
          <div style="font-size:0.75rem; color:#475569;">Прийняв: ${f.empName} (Код ${f.empCode})</div>
        </div>
      `).join('');

    // Працівники
    document.getElementById('emp-stats-container').innerHTML = APP_CATALOG.employees.map(e => `
      <div class="emp-stat-box">
        <span><b>${e.code}.</b> ${e.name.split(' ')[0]}</span>
        <span><b>${empCounts[e.code]}</b> к.о.</span>
      </div>
    `).join('');

    // Таблиця статусу
    document.querySelector('#table-dashboard-status tbody').innerHTML = repairs.map(r => {
      const done = Object.keys(r.checks || {}).length;
      const total = r.allowed ? r.allowed.length : 0;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      return `
        <tr>
          <td>${r.dept}</td>
          <td><b>${r.kks}</b></td>
          <td>${r.name}</td>
          <td>${camp.repairType}</td>
          <td>${done} / ${total}</td>
          <td>
            <div style="background:#e2e8f0; border-radius:3px; height:8px; width:90px; display:inline-block; overflow:hidden;">
              <div style="background:#10b981; height:100%; width:${pct}%;"></div>
            </div> ${pct}%
          </td>
        </tr>
      `;
    }).join('');
  }
};