// Відображення Журналу аудиту (Повна історія дій та змін)
const AuditView = {
  searchTerm: '',
  actionFilter: 'all',

  render() {
    const tbody = document.getElementById('audit-tbody');
    if (!tbody) return;

    const camp = StorageManager.getCurrentCampaign();
    if (!camp || !camp.audit_feed || camp.audit_feed.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding:20px; color:#64748b; text-align:center;">Історія дій відсутня у вибраній базі</td></tr>`;
      return;
    }

    let feed = [...camp.audit_feed];
    const query = (this.searchTerm || '').trim().toLowerCase();

    if (query) {
      feed = feed.filter(f =>
        (f.kks && f.kks.toLowerCase().includes(query)) ||
        (f.name && f.name.toLowerCase().includes(query)) ||
        (f.empName && f.empName.toLowerCase().includes(query)) ||
        (f.op && f.op.toLowerCase().includes(query)) ||
        (f.reason && f.reason.toLowerCase().includes(query))
      );
    }

    if (this.actionFilter !== 'all') {
      feed = feed.filter(f => (f.action || 'ACCEPT') === this.actionFilter);
    }

    if (feed.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding:20px; color:#64748b; text-align:center;">За вашим фільтром записів не знайдено</td></tr>`;
      return;
    }

    tbody.innerHTML = feed.map(f => {
      const isDelete = f.action === 'DELETE';
      const actionBadge = isDelete
        ? '<span class="badge" style="background:#fee2e2; color:#991b1b;">❌ Видалено</span>'
        : '<span class="badge" style="background:#dcfce7; color:#166534;">✅ Зафіксовано</span>';

      const formattedTime = f.timestamp ? new Date(f.timestamp).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
      const dateDisplay = f.date ? `${f.date} ${formattedTime}` : formattedTime;

      return `
        <tr>
          <td style="white-space:nowrap;">${dateDisplay}</td>
          <td><b>${f.kks}</b> - ${f.name}</td>
          <td><span style="color:#2563eb; font-weight:bold;">${f.op}</span></td>
          <td>${f.empName} <small class="text-muted">(№${f.empCode})</small></td>
          <td>${actionBadge}</td>
          <td style="font-size:0.8rem; color:${isDelete ? '#b91c1c' : '#475569'};">${f.reason || '-'}</td>
        </tr>
      `;
    }).join('');
  }
};
