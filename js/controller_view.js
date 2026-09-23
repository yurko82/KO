// Відображення матриці поточної вибраної сформованої бази
const ControllerView = {
  currentCategory: 'pumps',
  searchTerm: '',
  activeTarget: null,

  render() {
    const thead = document.getElementById('ctrl-thead');
    const tbody = document.getElementById('ctrl-tbody');
    const ops = APP_CATALOG.operations[this.currentCategory] || [];

    const camp = StorageManager.getCurrentCampaign();
    if (!camp) {
      tbody.innerHTML = `<tr><td colspan="15" style="padding:20px; color:#64748b;">Оберіть активну базу ремонту у верхньому селекторі</td></tr>`;
      return;
    }

    let repairs = camp.repairs.filter(r => r.category === this.currentCategory);
    const query = (this.searchTerm || '').trim().toLowerCase();
    if (query) {
      repairs = repairs.filter(r =>
        (r.kks && r.kks.toLowerCase().includes(query)) ||
        (r.name && r.name.toLowerCase().includes(query)) ||
        (r.dept && r.dept.toLowerCase().includes(query))
      );
    }

    thead.innerHTML = `
      <tr>
        <th style="width:30px;">№</th>
        <th class="eq-head">Обладнання / KKS</th>
        <th style="width:60px;">Ремонт</th>
        ${ops.map(o => `<th style="width:65px;">${o}</th>`).join('')}
      </tr>
    `;

    if (repairs.length === 0) {
      const msg = query ? `За запитом "${query}" нічого не знайдено` : `У цій базі немає агрегатів у напрямку "${this.currentCategory}"`;
      tbody.innerHTML = `<tr><td colspan="${3 + ops.length}" style="padding:20px; color:#64748b;">${msg}</td></tr>`;
      return;
    }

    tbody.innerHTML = repairs.map((r, i) => {
      const cells = ops.map(op => {
        if (!r.allowed || !r.allowed.includes(op)) return '<td class="cell-blocked"></td>';
        const ch = r.checks && r.checks[op];
        if (ch) {
          const empTitle = ch.empName ? `${ch.empName} (Код ${ch.empCode})` : `Код ${ch.empCode}`;
          return `
            <td class="cell-done" title="Прийняв: ${empTitle} | Дата: ${ch.date}" onclick="ControllerView.openModal('${r.id}', '${op}')">
              <div>${ch.date.split('-').slice(1).join('.')}</div>
              <div style="font-size:0.65rem;">№${ch.empCode}</div>
            </td>
          `;
        }
        return `
          <td class="cell-open" title="Натисніть для відмітки" onclick="ControllerView.openModal('${r.id}', '${op}')">
            <span style="color:#cbd5e1;">-</span>
          </td>
        `;
      }).join('');

      return `
        <tr>
          <td>${i + 1}</td>
          <td class="eq-cell"><strong>${r.name}</strong><br><small class="text-muted">${r.kks} (${r.dept})</small></td>
          <td>${r.repairType || camp.repairType}</td>
          ${cells}
        </tr>
      `;
    }).join('');
  },

  openModal(eqId, opCode) {
    const camp = StorageManager.getCurrentCampaign();
    const eq = camp.repairs.find(r => r.id === eqId);
    if (!eq) return;
    this.activeTarget = { eqId, opCode };

    document.getElementById('modal-eq-name').innerText = eq.name;
    document.getElementById('modal-op-title').innerText = `Контрольна операція: ${opCode} (${eq.kks})`;

    const ch = eq.checks && eq.checks[opCode];
    document.getElementById('entry-date').value = ch ? ch.date : new Date().toISOString().split('T')[0];

    document.querySelectorAll('.emp-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('selected-emp-code').value = ch ? ch.empCode : '';

    if (ch) {
      const btn = document.querySelector(`.emp-btn[data-code="${ch.empCode}"]`);
      if (btn) btn.classList.add('selected');
      document.getElementById('btn-del-check').classList.remove('hidden');
    } else {
      document.getElementById('btn-del-check').classList.add('hidden');
    }

    document.getElementById('btn-save-check').disabled = !ch;
    document.getElementById('modal-check').classList.remove('hidden');
  }
};