// Головний контролер додатку АС Контрольних Операцій
const App = {
  currentView: 'dashboard',

  async init() {
    // 0. Завантаження зовнішнього каталогу JSON (якщо доступно)
    if (typeof APP_CATALOG !== 'undefined' && APP_CATALOG.loadExternalCatalog) {
      await APP_CATALOG.loadExternalCatalog();
    }

    // 1. Автоматична спроба підключити збережений мережевий файл active_repairs.json
    await StorageManager.initAutoConnect();

    // 2. Ініціалізація авторизації
    AuthManager.init();

    // 3. Реєстрація Service Worker (PWA)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').then(() => {
        console.log('Service Worker PWA успішно зареєстровано');
      }).catch(err => console.warn('Помилка реєстрації Service Worker:', err));
    }

    // 4. Ініціалізація списку активних сформованих баз у шапці
    this.updateCampaignSelector();

    // 5. Обробник вибору активної бази в шапці сайту
    const campaignSelect = document.getElementById('campaign-select');
    if (campaignSelect) {
      campaignSelect.addEventListener('change', (e) => {
        StorageManager.selectedCampaignId = e.target.value;
        this.refreshCurrentView();
        if (this.currentView === 'admin') {
          AdminView.render();
        }
      });
    }

    // 6. Перемикання вкладок
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetBtn = e.target.closest('.nav-tab');
        if (targetBtn.dataset.view === 'admin' && !AuthManager.canEditAdmin()) {
          alert('Доступ до меню керівника дозволено тільки ролі Администратор!');
          return;
        }

        document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));

        targetBtn.classList.add('active');
        this.currentView = targetBtn.dataset.view;

        const targetView = document.getElementById('view-' + this.currentView);
        if (targetView) {
          targetView.classList.remove('hidden');
        }

        this.refreshCurrentView();
      });
    });

    // 7. Кнопки швидких дій у шапці
    const btnLoginModal = document.getElementById('btn-login-modal');
    if (btnLoginModal) {
      btnLoginModal.addEventListener('click', () => {
        const roleSel = document.getElementById('auth-role-select');
        if (roleSel) roleSel.value = AuthManager.currentUser.role;
        this.toggleAuthRoleFields();
        document.getElementById('modal-auth').classList.remove('hidden');
      });
    }

    const btnPrintReport = document.getElementById('btn-print-report');
    if (btnPrintReport) {
      btnPrintReport.addEventListener('click', () => {
        ExportManager.printReport();
      });
    }

    const btnOpenDb = document.getElementById('btn-open-db');
    if (btnOpenDb) {
      btnOpenDb.addEventListener('click', async () => {
        if (await StorageManager.connectDbManual()) {
          this.updateCampaignSelector();
          this.refreshCurrentView();
        }
      });
    }

    const btnSync = document.getElementById('btn-sync');
    if (btnSync) {
      btnSync.addEventListener('click', async () => {
        await StorageManager.readDb();
        this.updateCampaignSelector();
        this.refreshCurrentView();
      });
    }

    const btnExport = document.getElementById('btn-export-excel');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        ExportManager.exportActiveRepairs();
      });
    }

    // 8. Події модального вікна авторизації
    const roleSelect = document.getElementById('auth-role-select');
    if (roleSelect) {
      roleSelect.addEventListener('change', () => this.toggleAuthRoleFields());
    }

    const btnSubmitAuth = document.getElementById('btn-submit-auth');
    if (btnSubmitAuth) {
      btnSubmitAuth.addEventListener('click', () => {
        const role = document.getElementById('auth-role-select').value;
        const empCode = document.getElementById('auth-emp-select').value;
        const pin = document.getElementById('auth-pin-input').value.trim();

        const res = AuthManager.login(role, empCode, pin);
        if (res.success) {
          document.getElementById('modal-auth').classList.add('hidden');
          document.getElementById('auth-pin-input').value = '';
          this.refreshCurrentView();
        } else {
          alert(res.message);
        }
      });
    }

    const btnCloseAuth = document.getElementById('btn-close-auth');
    if (btnCloseAuth) {
      btnCloseAuth.addEventListener('click', () => {
        document.getElementById('modal-auth').classList.add('hidden');
      });
    }

    // 9. Генерація кнопок вибору працівників (1–7) у модальному вікні
    const empBox = document.getElementById('modal-emp-grid');
    if (empBox) {
      empBox.innerHTML = APP_CATALOG.employees.map(e => `
        <button type="button" class="emp-btn" data-code="${e.code}">
          <b>${e.code}.</b> ${e.name.split(' ')[0]}
        </button>
      `).join('');

      empBox.addEventListener('click', (e) => {
        const btn = e.target.closest('.emp-btn');
        if (!btn) return;
        document.querySelectorAll('.emp-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        document.getElementById('selected-emp-code').value = btn.dataset.code;
        
        const saveBtn = document.getElementById('btn-save-check');
        if (saveBtn) saveBtn.disabled = false;
      });
    }

    // 10. Події модального вікна фіксації контрольної операції
    const btnSaveCheck = document.getElementById('btn-save-check');
    if (btnSaveCheck) {
      btnSaveCheck.addEventListener('click', async () => {
        if (!ControllerView.activeTarget) return;
        const { eqId, opCode } = ControllerView.activeTarget;
        const date = document.getElementById('entry-date').value;
        const code = parseInt(document.getElementById('selected-emp-code').value, 10);
        const emp = APP_CATALOG.employees.find(e => e.code === code);

        const ok = await StorageManager.saveCheck(eqId, opCode, date, code, emp ? emp.name : "");
        if (ok !== false) {
          document.getElementById('modal-check').classList.add('hidden');
          this.refreshCurrentView();
        }
      });
    }

    const btnDelCheck = document.getElementById('btn-del-check');
    if (btnDelCheck) {
      btnDelCheck.addEventListener('click', async () => {
        if (!ControllerView.activeTarget) return;
        const { eqId, opCode } = ControllerView.activeTarget;
        const reasonBox = document.getElementById('del-reason-box');
        
        if (reasonBox.classList.contains('hidden')) {
          reasonBox.classList.remove('hidden');
          alert('Вкажіть причину видалення відмітки у полі нижче та натисніть "Видалити" повторно.');
          return;
        }

        const reason = document.getElementById('del-reason-input').value.trim();
        if (!reason) {
          alert('Будь ласка, введіть короткий коментар/причину видалення!');
          return;
        }

        await StorageManager.deleteCheck(eqId, opCode, reason);
        document.getElementById('modal-check').classList.add('hidden');
        document.getElementById('del-reason-input').value = '';
        reasonBox.classList.add('hidden');
        this.refreshCurrentView();
      });
    }

    const btnCloseModal = document.getElementById('btn-close-modal');
    if (btnCloseModal) {
      btnCloseModal.addEventListener('click', () => {
        document.getElementById('modal-check').classList.add('hidden');
        document.getElementById('del-reason-box').classList.add('hidden');
      });
    }

    // 11. Закриття модальних вікон клавішею Escape та оверлеєм
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('hidden');
          const reasonBox = document.getElementById('del-reason-box');
          if (reasonBox) reasonBox.classList.add('hidden');
        }
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
        const reasonBox = document.getElementById('del-reason-box');
        if (reasonBox) reasonBox.classList.add('hidden');
      }
    });

    // 12. Фільтри журналів та панелі керівника
    const ctrlCat = document.getElementById('ctrl-filter-cat');
    if (ctrlCat) {
      ctrlCat.addEventListener('change', (e) => {
        ControllerView.currentCategory = e.target.value;
        ControllerView.render();
      });
    }

    const ctrlSearch = document.getElementById('ctrl-search-input');
    if (ctrlSearch) {
      ctrlSearch.addEventListener('input', (e) => {
        ControllerView.searchTerm = e.target.value;
        ControllerView.render();
      });
    }

    const auditSearch = document.getElementById('audit-search-input');
    if (auditSearch) {
      auditSearch.addEventListener('input', (e) => {
        AuditView.searchTerm = e.target.value;
        AuditView.render();
      });
    }

    const auditFilter = document.getElementById('audit-action-filter');
    if (auditFilter) {
      auditFilter.addEventListener('change', (e) => {
        AuditView.actionFilter = e.target.value;
        AuditView.render();
      });
    }

    const admUnit = document.getElementById('adm-unit-select');
    if (admUnit) {
      admUnit.addEventListener('change', (e) => {
        AdminView.selectedUnit = e.target.value;
        AdminView.renderCatalog();
      });
    }

    const admCat = document.getElementById('adm-cat-select');
    if (admCat) {
      admCat.addEventListener('change', (e) => {
        AdminView.selectedCategory = e.target.value;
        AdminView.renderCatalog();
      });
    }

    const admSearch = document.getElementById('adm-search-input');
    if (admSearch) {
      admSearch.addEventListener('input', (e) => {
        AdminView.searchTerm = e.target.value;
        AdminView.renderCatalog();
      });
    }

    const btnSelectAll = document.getElementById('btn-select-all');
    if (btnSelectAll) {
      btnSelectAll.addEventListener('click', () => {
        document.querySelectorAll('.adm-eq-check').forEach(c => c.checked = true);
      });
    }

    const btnDeselectAll = document.getElementById('btn-deselect-all');
    if (btnDeselectAll) {
      btnDeselectAll.addEventListener('click', () => {
        document.querySelectorAll('.adm-eq-check').forEach(c => c.checked = false);
      });
    }

    const btnSaveChanges = document.getElementById('btn-save-campaign-changes');
    if (btnSaveChanges) {
      btnSaveChanges.addEventListener('click', () => {
        AdminView.saveCampaignChanges();
      });
    }

    const btnCreateNew = document.getElementById('btn-create-new-campaign');
    if (btnCreateNew) {
      btnCreateNew.addEventListener('click', () => {
        AdminView.createNewCampaign();
      });
    }

    // 13. Первинне відмальовування інтерфейсу
    this.refreshCurrentView();
  },

  toggleAuthRoleFields() {
    const role = document.getElementById('auth-role-select').value;
    const empRow = document.getElementById('auth-emp-select-row');
    const pinRow = document.getElementById('auth-pin-row');

    if (role === 'viewer') {
      if (empRow) empRow.classList.add('hidden');
      if (pinRow) pinRow.classList.add('hidden');
    } else if (role === 'controller') {
      if (empRow) empRow.classList.remove('hidden');
      if (pinRow) pinRow.classList.remove('hidden');
    } else if (role === 'admin') {
      if (empRow) empRow.classList.add('hidden');
      if (pinRow) pinRow.classList.remove('hidden');
    }
  },

  // Оновлення списку баз у випадаючому меню шапки
  updateCampaignSelector() {
    const sel = document.getElementById('campaign-select');
    if (!sel) return;

    const campaigns = StorageManager.state.campaigns || [];
    if (campaigns.length === 0) {
      sel.innerHTML = '<option value="">-- Немає сформованих баз --</option>';
      return;
    }

    sel.innerHTML = campaigns.map(c => `
      <option value="${c.id}" ${c.id === StorageManager.selectedCampaignId ? 'selected' : ''}>
        ${c.title} (${c.repairType})
      </option>
    `).join('');
  },

  // Оновлення поточної відкритої сторінки
  refreshCurrentView() {
    if (this.currentView === 'dashboard' && typeof DashboardView !== 'undefined') {
      DashboardView.render();
    } else if (this.currentView === 'controller' && typeof ControllerView !== 'undefined') {
      ControllerView.render();
    } else if (this.currentView === 'audit' && typeof AuditView !== 'undefined') {
      AuditView.render();
    } else if (this.currentView === 'admin' && typeof AdminView !== 'undefined') {
      AdminView.render();
    }
  }
};

// Запуск після повного завантаження DOM
document.addEventListener('DOMContentLoaded', () => App.init());