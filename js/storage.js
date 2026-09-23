// Керування базою даних active_repairs.json з підтримкою IndexedDB та редагування баз
const StorageManager = {
  fileHandle: null,
  selectedCampaignId: null,
  state: {
    campaigns: [], // Сформовані активні бази (не заархівовані)
    archive: []    // Заархівовані бази
  },

  // 1. Автоматичне підключення збереженого мережевого файлу через IndexedDB
  async initAutoConnect() {
    try {
      const handle = await this.getStoredHandle();
      if (handle) {
        const permission = await handle.queryPermission({ mode: 'readwrite' });
        if (permission === 'granted') {
          this.fileHandle = handle;
          await this.readDb();
          this.updateUiIndicator(true);
          return true;
        } else {
          // Якщо браузер вимагає повторного підтвердження дозволу
          const request = await handle.requestPermission({ mode: 'readwrite' });
          if (request === 'granted') {
            this.fileHandle = handle;
            await this.readDb();
            this.updateUiIndicator(true);
            return true;
          }
        }
      }
    } catch (e) {
      console.warn("Автопідключення не вдалося:", e);
    }
    this.updateUiIndicator(false);
    return false;
  },

  // Ручне підключення файлу (викликається кнопкою у шапці 1 раз)
  async connectDbManual() {
    try {
      [this.fileHandle] = await window.showOpenFilePicker({
        types: [{
          description: 'JSON База даних',
          accept: { 'application/json': ['.json'] }
        }],
        multiple: false
      });

      await this.storeHandle(this.fileHandle);
      await this.readDb();
      this.updateUiIndicator(true);
      return true;
    } catch (e) {
      console.warn("Файл не вибрано або скасовано:", e);
      return false;
    }
  },

  // Допоміжні методи IndexedDB для збереження дескриптора файлу
  async storeHandle(handle) {
    const db = await this.openIdb();
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').put(handle, 'db_handle');
  },

  async getStoredHandle() {
    const db = await this.openIdb();
    return new Promise(res => {
      const tx = db.transaction('handles', 'readonly');
      const req = tx.objectStore('handles').get('db_handle');
      req.onsuccess = () => res(req.result);
      req.onerror = () => res(null);
    });
  },

  openIdb() {
    return new Promise((res, rej) => {
      const req = indexedDB.open('KoJournalDb', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('handles');
      req.onsuccess = () => res(req.result);
      req.onerror = rej;
    });
  },

  // 2. Читання та запис у спільний JSON-файл
  async readDb() {
    if (!this.fileHandle) return;
    try {
      const file = await this.fileHandle.getFile();
      const text = await file.text();
      if (text.trim()) {
        const parsed = JSON.parse(text);
        this.state = parsed.campaigns ? parsed : { campaigns: [], archive: [] };
      } else {
        this.state = { campaigns: [], archive: [] };
      }

      // Якщо активну кампанію не обрано, встановлюємо першу наявну
      if (!this.selectedCampaignId && this.state.campaigns.length > 0) {
        this.selectedCampaignId = this.state.campaigns[0].id;
      } else if (this.selectedCampaignId) {
        // Перевіряємо чи вибрана база досі існує
        const exists = this.state.campaigns.some(c => c.id === this.selectedCampaignId);
        if (!exists && this.state.campaigns.length > 0) {
          this.selectedCampaignId = this.state.campaigns[0].id;
        }
      }
    } catch (err) {
      console.error("Помилка читання файлу бази:", err);
    }
  },

  async writeDb() {
    if (!this.fileHandle) return;
    try {
      // Smart Merge: зчитуємо актуальну версію з диска перед виконанням запису
      try {
        const file = await this.fileHandle.getFile();
        const diskText = await file.text();
        if (diskText.trim()) {
          const diskState = JSON.parse(diskText);
          if (diskState.campaigns) {
            this.mergeStates(diskState);
          }
        }
      } catch(e) {
        console.warn("Смарт-злиття не вдалося, проводиться стандартний запис:", e);
      }

      const writable = await this.fileHandle.createWritable();
      await writable.write(JSON.stringify(this.state, null, 2));
      await writable.close();
    } catch (err) {
      console.error("Помилка запису у файл бази:", err);
      alert("Не вдалося зберегти зміни у файл бази. Перевірте доступ до мережевої папки.");
    }
  },

  // Допоміжний алгоритм злиття двох станів без втрати неконфліктуючих записів
  mergeStates(diskState) {
    (diskState.campaigns || []).forEach(diskCamp => {
      let localCamp = this.state.campaigns.find(c => c.id === diskCamp.id);
      if (!localCamp) {
        this.state.campaigns.push(diskCamp);
      } else {
        // Злиття checks та audit_feed для кожного агрегату
        (diskCamp.repairs || []).forEach(diskEq => {
          let localEq = localCamp.repairs.find(r => r.kks === diskEq.kks && r.category === diskEq.category);
          if (localEq) {
            if (!localEq.checks) localEq.checks = {};
            for (const op in (diskEq.checks || {})) {
              if (!localEq.checks[op] || (diskEq.checks[op].timestamp > (localEq.checks[op].timestamp || 0))) {
                localEq.checks[op] = diskEq.checks[op];
              }
            }
          }
        });

        // Злиття аудит-стрічки без дублікатів
        const existingTimestamps = new Set((localCamp.audit_feed || []).map(a => a.timestamp));
        (diskCamp.audit_feed || []).forEach(item => {
          if (!existingTimestamps.has(item.timestamp)) {
            if (!localCamp.audit_feed) localCamp.audit_feed = [];
            localCamp.audit_feed.push(item);
          }
        });
        if (localCamp.audit_feed) {
          localCamp.audit_feed.sort((a, b) => b.timestamp - a.timestamp);
          if (localCamp.audit_feed.length > 200) localCamp.audit_feed = localCamp.audit_feed.slice(0, 200);
        }
      }
    });
  },

  // Отримати об'єкт поточної вибраної активної бази
  getCurrentCampaign() {
    return this.state.campaigns.find(c => c.id === this.selectedCampaignId) || null;
  },

  // 3. Створення нової бази ремонту (Кампанія: ПР або КР; Позиції: індивідуальні типи)
  async createCampaign(title, unit, baseCampaignType, equipmentList) {
    await this.readDb();
    const newId = 'camp_' + Date.now();
    const newCampaign = {
      id: newId,
      title: title || `Блок №${unit} — ${baseCampaignType}`,
      unit: unit,
      repairType: baseCampaignType, // Загальний тип кампанії (ПР або КР)
      created_date: new Date().toISOString().split('T')[0],
      repairs: equipmentList.map(item => ({
        id: 'eq_' + Math.random().toString(36).substr(2, 9),
        category: item.category,
        dept: item.dept,
        kks: item.kks,
        name: item.name,
        allowed: item.allowed || [],
        repairType: item.repairType || baseCampaignType, // Індивідуальний ПР / СР / КР / ТО
        checks: {}
      })),
      audit_feed: []
    };

    this.state.campaigns.push(newCampaign);
    this.selectedCampaignId = newId;
    await this.writeDb();
  },

  // 4. Оновлення поточної бази (редагування складу без втрати внесених к.о.)
  async updateCurrentCampaign(newTitle, baseCampaignType, category, selectedItemsWithTypes, catalogItems) {
    await this.readDb();
    const camp = this.getCurrentCampaign();
    if (!camp) return;

    camp.title = newTitle;
    camp.repairType = baseCampaignType;

    // Зберігаємо обладнання інших категорій (Наприклад, якщо редагуємо Насоси — Арматура і Дизелі не чіпаються)
    const otherCategoryRepairs = camp.repairs.filter(r => r.category !== category);
    const updatedCategoryRepairs = [];

    selectedItemsWithTypes.forEach(sel => {
      // Шукаємо, чи агрегат уже був у базі
      const existing = camp.repairs.find(r => r.category === category && r.kks === sel.kks);
      if (existing) {
        // Оновлюємо тип ремонту, а всі checks (дати, коди контролерів) залишаються недоторканими
        existing.repairType = sel.repairType;
        updatedCategoryRepairs.push(existing);
      } else {
        // Новий агрегат, доданий керівником під час редагування
        const item = catalogItems.find(i => i.kks === sel.kks);
        if (item) {
          updatedCategoryRepairs.push({
            id: 'eq_' + Math.random().toString(36).substr(2, 9),
            category: category,
            dept: item.dept,
            kks: item.kks,
            name: item.name,
            allowed: item.allowed || [],
            repairType: sel.repairType,
            checks: {}
          });
        }
      }
    });

    camp.repairs = [...otherCategoryRepairs, ...updatedCategoryRepairs];
    await this.writeDb();
  },

  // Вилучення окремого агрегату з бази
  async removeEquipmentFromCurrentCampaign(eqId) {
    await this.readDb();
    const camp = this.getCurrentCampaign();
    if (!camp) return;

    camp.repairs = camp.repairs.filter(r => r.id !== eqId);
    await this.writeDb();
  },

  // 5. Заархівувати базу
  async archiveCampaign(campaignId) {
    await this.readDb();
    const index = this.state.campaigns.findIndex(c => c.id === campaignId);
    if (index !== -1) {
      const [archived] = this.state.campaigns.splice(index, 1);
      archived.archived_date = new Date().toISOString().split('T')[0];
      this.state.archive.push(archived);

      this.selectedCampaignId = this.state.campaigns.length > 0 ? this.state.campaigns[0].id : null;
      await this.writeDb();
    }
  },

  // 6. Фіксація відмітки контрольної операції працівником
  async saveCheck(eqId, opCode, date, empCode, empName) {
    await this.readDb();
    const camp = this.getCurrentCampaign();
    if (!camp) return;

    const eq = camp.repairs.find(r => r.id === eqId);
    if (!eq) return;

    // Перевірка дати: дата не повинна бути з майбутнього
    const nowStr = new Date().toISOString().split('T')[0];
    if (date > nowStr) {
      alert("Помилка: не можна встановлювати дату з майбутнього!");
      return false;
    }

    if (!eq.checks) eq.checks = {};
    eq.checks[opCode] = { date, empCode, empName, timestamp: Date.now() };

    // Запис у live-стрічку аудиту
    if (!camp.audit_feed) camp.audit_feed = [];
    camp.audit_feed.unshift({
      timestamp: Date.now(),
      date,
      empCode,
      empName,
      kks: eq.kks,
      name: eq.name,
      op: opCode,
      action: 'ACCEPT'
    });
    if (camp.audit_feed.length > 200) camp.audit_feed.pop();

    await this.writeDb();
    return true;
  },

  // Видалення помилково внесеної відмітки з обов'язковою причиною
  async deleteCheck(eqId, opCode, reason) {
    await this.readDb();
    const camp = this.getCurrentCampaign();
    if (!camp) return;

    const eq = camp.repairs.find(r => r.id === eqId);
    if (eq && eq.checks && eq.checks[opCode]) {
      const deletedCheck = eq.checks[opCode];
      delete eq.checks[opCode];

      if (!camp.audit_feed) camp.audit_feed = [];
      camp.audit_feed.unshift({
        timestamp: Date.now(),
        date: new Date().toISOString().split('T')[0],
        empCode: AuthManager.currentUser.code || deletedCheck.empCode,
        empName: AuthManager.currentUser.name || deletedCheck.empName,
        kks: eq.kks,
        name: eq.name,
        op: opCode,
        action: 'DELETE',
        reason: reason || 'Скасовано операцію'
      });
      if (camp.audit_feed.length > 200) camp.audit_feed.pop();

      await this.writeDb();
    }
  },

  // Оновлення статусу індикатора в шапці
  updateUiIndicator(isOnline) {
    const el = document.getElementById('db-indicator');
    if (!el) return;
    if (isOnline) {
      el.className = 'badge online';
      el.innerText = 'База підключена';
    } else {
      el.className = 'badge offline';
      el.innerText = 'База не підключена';
    }
  }
};