// Менеджер авторизації та ролей (RBAC)
const AuthManager = {
  currentUser: {
    role: 'viewer', // 'viewer' | 'controller' | 'admin'
    code: null,
    name: 'Гість'
  },

  init() {
    const saved = sessionStorage.getItem('ko_user_session');
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
      } catch(e){}
    }
    this.updateUi();
  },

  login(role, empCode, pin) {
    if (role === 'admin') {
      if (pin === '1234') {
        this.currentUser = { role: 'admin', code: 0, name: 'Керівник / Адмін' };
        this.saveSession();
        return { success: true };
      } else {
        return { success: false, message: 'Невірний PIN-код керівника!' };
      }
    }

    if (role === 'controller') {
      const emp = APP_CATALOG.employees.find(e => e.code === parseInt(empCode, 10));
      if (!emp) return { success: false, message: 'Оберіть контролера зі списку!' };
      
      const validPin = (emp.code * 1111).toString(); // PIN: 1111, 2222, 3333... або 1234
      if (pin === validPin || pin === '1234' || pin === '0000') {
        this.currentUser = { role: 'controller', code: emp.code, name: emp.name };
        this.saveSession();
        return { success: true };
      } else {
        return { success: false, message: `Невірний PIN-код для ${emp.name}! (Спробуйте ${validPin})` };
      }
    }

    this.currentUser = { role: 'viewer', code: null, name: 'Гість' };
    this.saveSession();
    return { success: true };
  },

  logout() {
    this.currentUser = { role: 'viewer', code: null, name: 'Гість' };
    sessionStorage.removeItem('ko_user_session');
    this.updateUi();
  },

  saveSession() {
    sessionStorage.setItem('ko_user_session', JSON.stringify(this.currentUser));
    this.updateUi();
  },

  canEditAdmin() {
    return this.currentUser.role === 'admin';
  },

  canCheck() {
    return this.currentUser.role === 'admin' || this.currentUser.role === 'controller';
  },

  updateUi() {
    const label = document.getElementById('user-role-label');
    if (label) {
      let roleText = '👁️ Гість (Перегляд)';
      if (this.currentUser.role === 'admin') roleText = '⚙️ Адміністратор';
      if (this.currentUser.role === 'controller') roleText = `📋 ${this.currentUser.name}`;
      label.innerText = roleText;
    }

    // Приховати/показати вкладку керівника
    const adminNavBtn = document.querySelector('.nav-tab[data-view="admin"]');
    if (adminNavBtn) {
      if (this.canEditAdmin()) {
        adminNavBtn.classList.remove('hidden');
      } else {
        adminNavBtn.classList.add('hidden');
        // Якщо користувач був на сторінці адміна і розлогінився — перекинути на дашборд
        if (App.currentView === 'admin') {
          const dashBtn = document.querySelector('.nav-tab[data-view="dashboard"]');
          if (dashBtn) dashBtn.click();
        }
      }
    }
  }
};
