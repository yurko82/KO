// Експорт в Excel через XML Spreadsheet
const ExportManager = {
  escapeXml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  },

  exportActiveRepairs() {
    const camp = StorageManager.getCurrentCampaign();
    if (!camp || !camp.repairs || camp.repairs.length === 0) {
      alert('Немає активних даних для експорту в обраній базі');
      return;
    }

    const repairs = camp.repairs;
    const campaignTitle = this.escapeXml(camp.title || 'Поточний_ремонт');

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
    <?mso-application progid="Excel.Sheet"?>
    <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
      xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
      <Styles>
        <Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#CBD5E1" ss:Pattern="Solid"/></Style>
        <Style ss:ID="Done"><Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/></Style>
      </Styles>
      <Worksheet ss:Name="${campaignTitle.replace(/[\\/?*:[\]]/g, '_').substring(0, 31)}">
        <Table>
          <Row ss:StyleID="Header">
            <Cell><Data ss:Type="String">Блок</Data></Cell>
            <Cell><Data ss:Type="String">Підрозділ</Data></Cell>
            <Cell><Data ss:Type="String">KKS</Data></Cell>
            <Cell><Data ss:Type="String">Найменування</Data></Cell>
            <Cell><Data ss:Type="String">Вид ремонту</Data></Cell>
            <Cell><Data ss:Type="String">Операція</Data></Cell>
            <Cell><Data ss:Type="String">Дата</Data></Cell>
            <Cell><Data ss:Type="String">Працівник</Data></Cell>
          </Row>`;

    let checkCount = 0;
    repairs.forEach(r => {
      const checks = r.checks || {};
      const unitVal = r.unit || camp.unit || '';
      const deptVal = this.escapeXml(r.dept);
      const kksVal = this.escapeXml(r.kks);
      const nameVal = this.escapeXml(r.name);
      const repairTypeVal = this.escapeXml(r.repairType || camp.repairType);

      for (const op in checks) {
        checkCount++;
        const c = checks[op];
        xml += `
          <Row>
            <Cell><Data ss:Type="String">Блок №${unitVal}</Data></Cell>
            <Cell><Data ss:Type="String">${deptVal}</Data></Cell>
            <Cell><Data ss:Type="String">${kksVal}</Data></Cell>
            <Cell><Data ss:Type="String">${nameVal}</Data></Cell>
            <Cell><Data ss:Type="String">${repairTypeVal}</Data></Cell>
            <Cell><Data ss:Type="String">${this.escapeXml(op)}</Data></Cell>
            <Cell ss:StyleID="Done"><Data ss:Type="String">${this.escapeXml(c.date)}</Data></Cell>
            <Cell ss:StyleID="Done"><Data ss:Type="String">${this.escapeXml(c.empName)} (№${c.empCode})</Data></Cell>
          </Row>
        `;
      }
    });

    if (checkCount === 0) {
      alert('У поточній базі ще немає зафіксованих контрольних операцій.');
      return;
    }

    xml += `</Table></Worksheet></Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Журнал_КО_${camp.unit ? 'Блок' + camp.unit + '_' : ''}${new Date().toISOString().split('T')[0]}.xls`;
    a.click();
  },

  printReport() {
    const camp = StorageManager.getCurrentCampaign();
    if (!camp || !camp.repairs || camp.repairs.length === 0) {
      alert('Немає активних даних для формування друкованого звіту.');
      return;
    }

    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Будь ласка, дозвольте відкриття вспливаючих вікон (popups) у вашому браузері.');
      return;
    }

    const todayStr = new Date().toLocaleDateString('uk-UA');

    let rowsHtml = '';
    camp.repairs.forEach((r, idx) => {
      const doneOps = [];
      const checks = r.checks || {};
      for (const op in checks) {
        doneOps.push(`${op} (${checks[op].date}, №${checks[op].empCode})`);
      }
      const total = r.allowed ? r.allowed.length : 0;
      const doneCount = doneOps.length;
      const statusText = doneCount === total ? 'ГОТОВО' : `${doneCount}/${total}`;

      rowsHtml += `
        <tr>
          <td>${idx + 1}</td>
          <td>${r.dept}</td>
          <td><b>${r.kks}</b></td>
          <td>${r.name}</td>
          <td>${r.repairType || camp.repairType}</td>
          <td>${statusText}</td>
          <td style="font-size:11px;">${doneOps.join(', ') || '-'}</td>
        </tr>
      `;
    });

    const html = `
      <!DOCTYPE html>
      <html lang="uk">
      <head>
        <meta charset="UTF-8">
        <title>Відомість контролю обладнання — ${camp.title}</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #000; }
          h2, h3 { margin: 4px 0; }
          .header { margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #000; padding: 6px; text-align: left; }
          th { background: #f0f0f0; }
          .sign { margin-top: 40px; display: flex; justify-content: space-between; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>ВІДОМІСТЬ КОНТРОЛЬНИХ ОПЕРАЦІЙ ОБЛАДНАННЯ</h2>
          <h3>База: ${camp.title} [Блок №${camp.unit}]</h3>
          <p>Дата формування звіту: ${todayStr}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:30px;">№</th>
              <th style="width:70px;">Підрозділ</th>
              <th style="width:100px;">KKS</th>
              <th>Найменування обладнання</th>
              <th style="width:60px;">Вид</th>
              <th style="width:60px;">Прогрес</th>
              <th>Виконані операції (Дата, Код)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <div class="sign">
          <div>Відповідальний за контроль: ___________________</div>
          <div>Керівник робіт: ___________________</div>
        </div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;

    printWin.document.write(html);
    printWin.document.close();
  }
};