// Меню керівника: вибір обладнання з індивідуальним типом ремонту (ПР, СР, КР, ТО)
const AdminView = {
  selectedUnit: '3',
  selectedCategory: 'pumps',
  searchTerm: '',

  render() {
    const camp = StorageManager.getCurrentCampaign();

    if (camp) {
      document.getElementById('adm-campaign-name').value = camp.title;
      document.getElementById('adm-unit-select').value = camp.unit;
      document.getElementById('adm-repair-type').value = camp.repairType === 'КР' ? 'КР' : 'ПР';
      this.selectedUnit = camp.unit;
      document.getElementById('adm-edit-badge').innerText = `Редагування: ${camp.title}`;
      document.getElementById('adm-edit-badge').className = "badge online";
    } else {
      document.getElementById('adm-campaign-name').value = '';
      document.getElementById('adm-edit-badge').innerText = "Нова база";
      document.getElementById('adm-edit-badge').className = "badge offline";
    }

    this.renderCatalog();
    this.renderCurrentCampaignEquipment();
    this.renderAllCampaigns();
  },

  // Каталог: біля кожної позиції є випадаючий список [ПР, СР, КР, ТО]
  renderCatalog() {
    const container = document.getElementById('adm-catalog-list');
    let items = (APP_CATALOG.units[this.selectedUnit] && APP_CATALOG.units[this.selectedUnit][this.selectedCategory]) || [];
    const query = (this.searchTerm || '').trim().toLowerCase();
    if (query) {
      items = items.filter(item =>
        (item.kks && item.kks.toLowerCase().includes(query)) ||
        (item.name && item.name.toLowerCase().includes(query)) ||
        (item.dept && item.dept.toLowerCase().includes(query))
      );
    }
    const camp = StorageManager.getCurrentCampaign();
    const existingRepairs = camp ? camp.repairs : [];
    const baseDefaultType = document.getElementById('adm-repair-type').value || 'ПР';

    if (items.length === 0) {
      const msg = query ? `За запитом "${query}" нічого не знайдено` : 'Немає обладнання для обраного напрямку';
      container.innerHTML = `<div class="empty-text">${msg}</div>`;
      return;
    }

    container.innerHTML = items.map((item, idx) => {
      const existing = existingRepairs.find(r => r.kks === item.kks && r.category === this.selectedCategory);
      const isChecked = !!existing;
      // Встановлюємо вже збережений тип або базовий за замовчуванням
      const currentItemType = existing ? existing.repairType : baseDefaultType;

      return `
        <div class="catalog-item" style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:6px; border-bottom:1px solid #f1f5f9; ${isChecked ? 'background:#ecfdf5;' : ''}">
          <div style="display:flex; align-items:center; gap:8px; flex:1;">
            <input type="checkbox" class="adm-eq-check" id="adm_chk_${idx}" value="${item.kks}" ${isChecked ? 'checked' : ''}>
            <label for="adm_chk_${idx}" style="cursor:pointer;">
              <b>${item.kks}</b> - ${item.name} <small class="text-muted">(${item.dept})</small>
              ${isChecked ? '<span style="color:#059669; font-weight:bold; margin-left:6px;">[В ремонті]</span>' : ''}
            </label>
          </div>

          <!-- Індивідуальний вибір типу ремонту для цієї одиниці обладнання -->
          <div style="display:flex; align-items:center; gap:4px;">
            <label style="font-size:0.75rem; color:#475569;">Ремонт:</label>
            <select class="adm-item-repair-type" data-kks="${item.kks}" style="padding:2px 4px; font-size:0.75rem; border:1px solid #cbd5e1; border-radius:3px;">
              <option value="ПР" ${currentItemType === 'ПР' ? 'selected' : ''}>ПР</option>
              <option value="СР" ${currentItemType === 'СР' ? 'selected' : ''}>СР</option>
              <option value="КР" ${currentItemType === 'КР' ? 'selected' : ''}>КР</option>
              <option value="ТО" ${currentItemType === 'ТО' ? 'selected' : ''}>ТО</option>
            </select>
          </div>
        </div>
      `;
    }).join('');
  },

  renderCurrentCampaignEquipment() {
    const box = document.getElementById('adm-active-repairs-list');
    const countEl = document.getElementById('adm-current-count');
    const camp = StorageManager.getCurrentCampaign();

    if (!camp || !camp.repairs || camp.repairs.length === 0) {
      box.innerHTML = '<div class="empty-text">У поточній базі немає обладнання</div>';
      countEl.innerText = '0';
      return;
    }

    countEl.innerText = camp.repairs.length;
    box.innerHTML = camp.repairs.map(r => {
      const checkCount = Object.keys(r.checks || {}).length;
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:5px 8px; border-bottom:1px solid #f1f5f9; font-size:0.8rem;">
          <div>
            <b>${r.kks}</b> - ${r.name} <span class="badge" style="background:#e0f2fe; color:#0369a1; padding:1px 4px;">${r.repairType}</span>
            <span class="text-muted">(${r.dept})</span>
            ${checkCount > 0 ? `<span style="color:#2563eb; font-weight:bold; margin-left:6px;">[Виконано: ${checkCount}]</span>` : ''}
          </div>
          <button class="btn btn-sm btn-danger" onclick="AdminView.removeSingleEquipment('${r.id}')" title="Вилучити агрегат">✕</button>
        </div>
      `;
    }).join('');
  },

  renderAllCampaigns() {
    const container = document.getElementById('adm-active-campaigns-list');
    const campaigns = StorageManager.state.campaigns || [];

    if (campaigns.length === 0) {
      container.innerHTML = '<div class="empty-text">Немає сформованих баз</div>';
      return;
    }

    container.innerHTML = campaigns.map(c => {
      const isSelected = c.id === StorageManager.selectedCampaignId;
      return `
        <div class="campaign-card-item" style="${isSelected ? 'border-color:#2563eb; background:#eff6ff;' : ''}">
          <div>
            <strong>${c.title}</strong> [${c.repairType}]<br>
            <small class="text-muted">Блок №${c.unit} | Агрегатів: ${c.repairs.length} | Створено: ${c.created_date}</small>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}" onclick="AdminView.switchCampaign('${c.id}')">
              ${isSelected ? '✓ Активна' : 'Редагувати'}
            </button>
            <button class="btn btn-sm btn-danger" onclick="AdminView.archive('${c.id}')">В архів</button>
          </div>
        </div>
      `;
    }).join('');
  },

  // Збереження змін у поточній базі
  async saveCampaignChanges() {
    const camp = StorageManager.getCurrentCampaign();
    if (!camp) {
      alert("Немає вибраної бази для редагування. Створіть нову через кнопку 'Створити нову базу'.");
      return;
    }

    const title = document.getElementById('adm-campaign-name').value.trim() || camp.title;
    const baseCampaignType = document.getElementById('adm-repair-type').value; // ПР або КР
    const unit = this.selectedUnit;
    const cat = this.selectedCategory;
    const allItems = APP_CATALOG.units[unit][cat] || [];

    // Збираємо обрані позиції разом із їхнім індивідуальним типом ремонту
    const selectedItemsWithTypes = [];
    document.querySelectorAll('.adm-eq-check:checked').forEach(cb => {
      const kks = cb.value;
      const typeSelect = document.querySelector(`.adm-item-repair-type[data-kks="${kks}"]`);
      const itemType = typeSelect ? typeSelect.value : baseCampaignType;

      selectedItemsWithTypes.push({
        kks: kks,
        repairType: itemType
      });
    });

    await StorageManager.updateCurrentCampaign(title, baseCampaignType, cat, selectedItemsWithTypes, allItems);
    alert(`Зміни в базі "${title}" збережено!`);

    App.updateCampaignSelector();
    this.render();
  },

  // Створення нової бази
  async createNewCampaign() {
    const unit = this.selectedUnit;
    const baseCampaignType = document.getElementById('adm-repair-type').value; // ПР або КР
    let title = document.getElementById('adm-campaign-name').value.trim();
    if (!title) title = `Блок №${unit} — ${baseCampaignType} (${new Date().toLocaleDateString('uk-UA')})`;

    const cat = this.selectedCategory;
    const allItems = APP_CATALOG.units[unit][cat] || [];

    const selectedEquipment = [];
    document.querySelectorAll('.adm-eq-check:checked').forEach(cb => {
      const kks = cb.value;
      const item = allItems.find(i => i.kks === kks);
      const typeSelect = document.querySelector(`.adm-item-repair-type[data-kks="${kks}"]`);
      const itemType = typeSelect ? typeSelect.value : baseCampaignType;

      if (item) {
        selectedEquipment.push({
          ...item,
          category: cat,
          repairType: itemType // Індивідуальний ПР / СР / КР / ТО
        });
      }
    });

    if (selectedEquipment.length === 0) {
      alert("Оберіть хоча б одну позицію обладнання.");
      return;
    }

    await StorageManager.createCampaign(title, unit, baseCampaignType, selectedEquipment);
    alert(`Нову базу "${title}" сформовано!`);

    App.updateCampaignSelector();
    this.render();
  },

  async removeSingleEquipment(eqId) {
    if (confirm("Вилучити цей агрегат із поточної ремонтної бази?")) {
      await StorageManager.removeEquipmentFromCurrentCampaign(eqId);
      this.render();
    }
  },

  async switchCampaign(campaignId) {
    StorageManager.selectedCampaignId = campaignId;
    App.updateCampaignSelector();
    this.render();
  },

  async archive(campaignId) {
    if (confirm("Завершити та заархівувати цю базу?")) {
      await StorageManager.archiveCampaign(campaignId);
      App.updateCampaignSelector();
      this.render();
    }
  }
};