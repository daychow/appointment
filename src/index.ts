import { Hono } from 'hono';
import { publicRoutes } from './routes/public';
import { adminRoutes } from './routes/admin';

export interface Env {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Env }>();

// Serve static pages
app.get('/', (c) => {
  return c.redirect('/index.html');
});

app.get('/index.html', (c) => {
  return c.html(getHomePage());
});

app.get('/admin', (c) => {
  return c.html(getAdminPage());
});

// API routes
app.route('/api', publicRoutes);
app.route('/api/admin', adminRoutes);

function getHomePage(): string {
  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>預約系統</title>
  <link href="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.10/index.global.min.css" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.10/index.global.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; min-height: 100vh; }
    .header { background: #2c3e50; color: white; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; }
    .header h1 { font-size: 1.5rem; }
    .admin-link { color: white; text-decoration: none; opacity: 0.8; }
    .admin-link:hover { opacity: 1; }
    .container { display: flex; max-width: 1400px; margin: 2rem auto; gap: 1.5rem; padding: 0 1rem; }
    .calendar-section { flex: 1; background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .detail-panel { width: 350px; background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .detail-panel h2 { font-size: 1.25rem; margin-bottom: 1rem; color: #2c3e50; }
    .selected-date { font-size: 1.1rem; color: #666; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid #eee; }
    .slots-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .slot-item { padding: 1rem; border: 2px solid #e0e0e0; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
    .slot-item:hover { border-color: #3498db; background: #f8f9fa; }
    .slot-item.selected { border-color: #3498db; background: #e3f2fd; }
    .slot-time { font-weight: 600; color: #2c3e50; }
    .no-slots { color: #999; text-align: center; padding: 2rem; }
    .booking-form { margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid #eee; }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; color: #333; }
    .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px; font-size: 1rem; }
    .btn { padding: 0.75rem 1.5rem; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; transition: all 0.2s; }
    .btn-primary { background: #3498db; color: white; }
    .btn-primary:hover { background: #2980b9; }
    .btn-success { background: #27ae60; color: white; }
    .btn-success:hover { background: #219a52; }
    .btn-danger { background: #e74c3c; color: white; }
    .btn-danger:hover { background: #c0392b; }
    .btn-sm { padding: 0.5rem 1rem; font-size: 0.875rem; }
    .btn-submit { width: 100%; padding: 0.875rem; background: #27ae60; color: white; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; }
    .btn-submit:hover { background: #219a52; }
    .btn-submit:disabled { background: #ccc; cursor: not-allowed; }
    .success-message { text-align: center; padding: 2rem; }
    .success-message h3 { color: #27ae60; margin-bottom: 1rem; }
    .booking-details { background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-top: 1rem; text-align: left; }
    .booking-details p { margin: 0.5rem 0; }
    .hidden { display: none !important; }
    .empty-state { text-align: center; padding: 3rem; color: #999; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #eee; }
    th { font-weight: 600; color: #666; background: #f8f9fa; }
    .status-active { color: #27ae60; }
    .status-cancelled { color: #e74c3c; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    @media (max-width: 900px) { .container { flex-direction: column; } .detail-panel { width: 100%; } }
  </style>
</head>
<body>
  <header class="header">
    <h1>預約系統</h1>
    <a href="/admin" class="admin-link">後台管理</a>
  </header>

  <div class="container">
    <div class="calendar-section">
      <div id="calendar"></div>
    </div>
    
    <div class="detail-panel">
      <div id="panel-content">
        <h2>選擇日期</h2>
        <p class="no-slots">請點擊左側日曆選擇日期</p>
      </div>
    </div>
  </div>

  <script>
    let calendar, selectedSlot = null, slotsData = {};

    document.addEventListener('DOMContentLoaded', function() {
      const calendarEl = document.getElementById('calendar');
      calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' },
        locale: 'zh-tw',
        selectable: true,
        dateClick: function(info) { loadAvailableSlots(info.dateStr); }
      });
      calendar.render();
    });

    async function loadAvailableSlots(date) {
      const panel = document.getElementById('panel-content');
      panel.innerHTML = '<h2>可預約時段</h2><div class="selected-date">' + formatDate(date) + '</div><div class="slots-list"><p class="no-slots">載入中...</p></div>';

      try {
        const response = await fetch('/api/availability?date=' + date);
        const slots = await response.json();
        
        if (slots.length === 0) {
          panel.innerHTML = '<h2>可預約時段</h2><div class="selected-date">' + formatDate(date) + '</div><p class="no-slots">此日期暫無可預約時段</p>';
          return;
        }

        let slotsHtml = '';
        for (let i = 0; i < slots.length; i++) {
          const slot = slots[i];
          slotsHtml += '<div class="slot-item" data-id="' + slot.id + '" onclick="selectSlot(' + slot.id + ', this)">' +
            '<div class="slot-time">' + slot.start_time + ' - ' + slot.end_time + '</div>' +
          '</div>';
          slotsData[slot.id] = slot;
        }

        const formHtml = '<div id="booking-form" class="booking-form hidden"><h3>填寫預約資料</h3>' +
          '<div class="form-group"><label>姓名</label><input type="text" id="customerName" placeholder="請輸入姓名"></div>' +
          '<div class="form-group"><label>電話</label><input type="tel" id="customerPhone" placeholder="請輸入電話"></div>' +
          '<button class="btn-submit" onclick="submitBooking()">確認預約</button></div>';

        panel.innerHTML = '<h2>可預約時段</h2><div class="selected-date">' + formatDate(date) + '</div><div class="slots-list">' + slotsHtml + '</div>' + formHtml;
      } catch (error) {
        panel.innerHTML = '<h2>可預約時段</h2><div class="selected-date">' + formatDate(date) + '</div><p class="no-slots">載入失敗</p>';
      }
    }

    function selectSlot(id, element) {
      const slot = slotsData[id];
      if (!slot) return;
      selectedSlot = { id: id, startTime: slot.start_time, endTime: slot.end_time };
      document.querySelectorAll('.slot-item').forEach(function(el) { el.classList.remove('selected'); });
      element.classList.add('selected');
      document.getElementById('booking-form').classList.remove('hidden');
    }

    async function submitBooking() {
      const name = document.getElementById('customerName').value.trim();
      const phone = document.getElementById('customerPhone').value.trim();
      if (!name || !phone) { alert('請填寫姓名和電話'); return; }

      const btn = document.querySelector('.btn-submit');
      btn.disabled = true;
      btn.textContent = '提交中...';

      try {
        const response = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ availability_id: selectedSlot.id, customer_name: name, customer_phone: phone })
        });
        const result = await response.json();
        if (result.success) { showSuccess(result.booking); } 
        else { alert(result.error || '預約失敗'); btn.disabled = false; btn.textContent = '確認預約'; }
      } catch (error) { alert('預約失敗'); btn.disabled = false; btn.textContent = '確認預約'; }
    }

    function showSuccess(booking) {
      const panel = document.getElementById('panel-content');
      panel.innerHTML = '<div class="success-message"><h3>預約成功！</h3><p>感謝您的預約</p><div class="booking-details">' +
        '<p><strong>日期：</strong>' + formatDate(booking.date) + '</p>' +
        '<p><strong>時間：</strong>' + booking.start_time + ' - ' + booking.end_time + '</p>' +
        '<p><strong>姓名：</strong>' + booking.customer_name + '</p>' +
        '<p><strong>電話：</strong>' + booking.customer_phone + '</p></div>' +
        '<button class="btn-submit" style="margin-top: 1.5rem;" onclick="location.reload()">再預約</button></div>';
    }

    function formatDate(dateStr) {
      const date = new Date(dateStr);
      return date.toLocaleDateString('zh-HK', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    }
  </script>
</body>
</html>`;
}

function getAdminPage(): string {
  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>後台管理 - 預約系統</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; min-height: 100vh; }
    .header { background: #2c3e50; color: white; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; }
    .header h1 { font-size: 1.5rem; }
    .nav-links a { color: white; text-decoration: none; margin-left: 1.5rem; opacity: 0.8; }
    .nav-links a:hover { opacity: 1; }
    .container { max-width: 1200px; margin: 2rem auto; padding: 0 1rem; }
    .card { background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 1.5rem; }
    .card h2 { font-size: 1.25rem; margin-bottom: 1rem; color: #2c3e50; }
    .card h3 { font-size: 1.1rem; margin: 1.5rem 0 1rem; color: #2c3e50; }
    .login-form { max-width: 400px; margin: 5rem auto; }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
    .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px; font-size: 1rem; }
    .btn { padding: 0.75rem 1.5rem; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; transition: all 0.2s; }
    .btn-primary { background: #3498db; color: white; }
    .btn-primary:hover { background: #2980b9; }
    .btn-success { background: #27ae60; color: white; }
    .btn-success:hover { background: #219a52; }
    .btn-danger { background: #e74c3c; color: white; }
    .btn-danger:hover { background: #c0392b; }
    .btn-sm { padding: 0.5rem 1rem; font-size: 0.875rem; }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #eee; }
    th { font-weight: 600; color: #666; background: #f8f9fa; }
    .status-active { color: #27ae60; }
    .status-cancelled { color: #e74c3c; }
    .tabs { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 2px solid #eee; }
    .tab { padding: 0.75rem 1.5rem; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; }
    .tab.active { border-bottom-color: #3498db; color: #3498db; font-weight: 500; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .hidden { display: none !important; }
    .empty-state { text-align: center; padding: 3rem; color: #999; }
    .checkbox-group { display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 0.5rem; }
    .checkbox-group label { display: flex; align-items: center; gap: 0.25rem; font-weight: normal; }
    .checkbox-group input { width: auto; }
    .exclude-range { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; }
    .exclude-range input { width: 120px; }
  </style>
</head>
<body>
  <div id="app">
    <div id="login-screen">
      <div class="card login-form">
        <h2 style="text-align: center; margin-bottom: 1.5rem;">後台登入</h2>
        <div class="form-group">
          <label>密碼</label>
          <input type="password" id="password" placeholder="請輸入密碼">
        </div>
        <button class="btn btn-primary" style="width: 100%;" id="login-btn">登入</button>
        <p id="login-error" style="color: #e74c3c; text-align: center; margin-top: 1rem; display: none;">密碼錯誤</p>
      </div>
    </div>

    <div id="dashboard" class="hidden">
      <header class="header">
        <h1>後台管理</h1>
        <div class="nav-links">
          <a href="/">返回前台</a>
          <a href="#" id="logout-link">登出</a>
        </div>
      </header>

      <div class="container">
        <div class="tabs">
          <div class="tab active" data-tab="bookings">預約管理</div>
          <div class="tab" data-tab="availability">時段設定</div>
          <div class="tab" data-tab="settings">設定</div>
        </div>

        <div id="tab-bookings" class="tab-content active">
          <div class="card">
            <h2>所有預約</h2>
            <div id="bookings-list"><p class="empty-state">載入中...</p></div>
          </div>
        </div>

        <div id="tab-availability" class="tab-content">
          <div class="card">
            <h2>批量生成時段</h2>
            <p style="color: #666; margin-bottom: 1rem;">設定日期範圍，系統會自動生成所有符合條件的時段</p>
            
            <h3>日期範圍</h3>
            <div class="grid-2">
              <div class="form-group">
                <label>開始日期</label>
                <input type="date" id="batch-start-date">
              </div>
              <div class="form-group">
                <label>結束日期</label>
                <input type="date" id="batch-end-date">
              </div>
            </div>
            
            <h3>每日時間</h3>
            <div class="grid-2">
              <div class="form-group">
                <label>開始時間</label>
                <input type="time" id="batch-start-time" value="09:00">
              </div>
              <div class="form-group">
                <label>結束時間</label>
                <input type="time" id="batch-end-time" value="18:00">
              </div>
            </div>
            
            <div class="form-group">
              <label>每個時段長度</label>
              <select id="batch-duration">
                <option value="15">15 分鐘</option>
                <option value="30" selected>30 分鐘</option>
                <option value="45">45 分鐘</option>
                <option value="60">60 分鐘</option>
                <option value="90">90 分鐘</option>
              </select>
            </div>
            
            <h3>排除設定</h3>
            
            <div class="form-group">
              <label>排除星期幾（可多選）</label>
              <div class="checkbox-group">
                <label><input type="checkbox" class="exclude-weekday" value="0"> 日</label>
                <label><input type="checkbox" class="exclude-weekday" value="1"> 一</label>
                <label><input type="checkbox" class="exclude-weekday" value="2"> 二</label>
                <label><input type="checkbox" class="exclude-weekday" value="3"> 三</label>
                <label><input type="checkbox" class="exclude-weekday" value="4"> 四</label>
                <label><input type="checkbox" class="exclude-weekday" value="5"> 五</label>
                <label><input type="checkbox" class="exclude-weekday" value="6"> 六</label>
              </div>
            </div>
            
            <div class="form-group">
              <label>排除特定日期（用逗號分隔，例如：2025-04-15, 2025-04-16）</label>
              <input type="text" id="exclude-dates" placeholder="2025-04-15, 2025-04-16">
            </div>
            
            <div class="form-group">
              <label>排除時段（例如午休時間）</label>
              <div id="exclude-time-ranges">
                <div class="exclude-range">
                  <input type="time" class="exclude-start" value="12:00">
                  <span>至</span>
                  <input type="time" class="exclude-end" value="14:00">
                  <button type="button" class="btn btn-danger btn-sm remove-range">刪除</button>
                </div>
              </div>
              <button type="button" class="btn btn-primary" id="add-exclude-range" style="margin-top: 0.5rem;">+ 新增排除時段</button>
            </div>
            
            <button class="btn btn-success" id="batch-generate-btn" style="margin-top: 1.5rem; width: 100%;">批量生成時段</button>
          </div>

          <div class="card">
            <h2>已設定時段</h2>
            <div id="availability-list"><p class="empty-state">載入中...</p></div>
          </div>
        </div>

        <div id="tab-settings" class="tab-content">
          <div class="card">
            <h2>更改密碼</h2>
            <div class="form-group">
              <label>新密碼</label>
              <input type="password" id="new-password" placeholder="請輸入新密碼（至少4個字符）">
            </div>
            <button class="btn btn-primary" id="change-password-btn">更改密碼</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    // Admin page JavaScript
    var authToken = localStorage.getItem('admin_token');
    
    function init() {
      if (authToken) showDashboard();
      
      // Login
      var loginBtn = document.getElementById('login-btn');
      if (loginBtn) {
        loginBtn.addEventListener('click', doLogin);
      }
      
      // Logout
      var logoutLink = document.getElementById('logout-link');
      if (logoutLink) {
        logoutLink.addEventListener('click', function(e) {
          e.preventDefault();
          doLogout();
        });
      }
      
      // Tabs
      var tabs = document.querySelectorAll('.tab');
      for (var i = 0; i < tabs.length; i++) {
        tabs[i].addEventListener('click', function() {
          var tabName = this.getAttribute('data-tab');
          switchTab(tabName);
        });
      }
      
      // Batch generate
      var batchBtn = document.getElementById('batch-generate-btn');
      if (batchBtn) {
        batchBtn.addEventListener('click', batchGenerate);
      }
      
      // Add exclude range
      var addExcludeBtn = document.getElementById('add-exclude-range');
      if (addExcludeBtn) {
        addExcludeBtn.addEventListener('click', addExcludeRange);
      }
      
      // Change password
      var changePwdBtn = document.getElementById('change-password-btn');
      if (changePwdBtn) {
        changePwdBtn.addEventListener('click', changePassword);
      }
      
      // Delegate remove range
      document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('remove-range')) {
          e.target.parentElement.remove();
        }
      });
    }
    
    async function doLogin() {
      var password = document.getElementById('password').value;
      try {
        var response = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: password })
        });
        if (response.ok) {
          authToken = password;
          localStorage.setItem('admin_token', password);
          showDashboard();
        } else {
          document.getElementById('login-error').style.display = 'block';
        }
      } catch (error) {
        alert('登入失敗');
      }
    }
    
    function showDashboard() {
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('dashboard').classList.remove('hidden');
      loadBookings();
      loadAvailability();
    }
    
    function doLogout() {
      authToken = null;
      localStorage.removeItem('admin_token');
      location.reload();
    }
    
    function switchTab(tab) {
      var tabs = document.querySelectorAll('.tab');
      var contents = document.querySelectorAll('.tab-content');
      for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
      for (var i = 0; i < contents.length; i++) contents[i].classList.remove('active');
      
      var activeTab = document.querySelector('.tab[data-tab="' + tab + '"]');
      if (activeTab) activeTab.classList.add('active');
      document.getElementById('tab-' + tab).classList.add('active');
      
      if (tab === 'bookings') loadBookings();
      if (tab === 'availability') loadAvailability();
    }
    
    async function loadBookings() {
      try {
        var response = await fetch('/api/admin/bookings', {
          headers: { 'Authorization': 'Bearer ' + authToken }
        });
        if (!response.ok) { doLogout(); return; }
        var bookings = await response.json();
        var container = document.getElementById('bookings-list');
        if (bookings.length === 0) {
          container.innerHTML = '<p class="empty-state">暫無預約</p>';
          return;
        }
        var html = '<table><thead><tr><th>日期</th><th>時間</th><th>姓名</th><th>電話</th><th>狀態</th><th>操作</th></tr></thead><tbody>';
        for (var i = 0; i < bookings.length; i++) {
          var b = bookings[i];
          html += '<tr><td>' + formatDate(b.booking_date || b.slot_date) + '</td><td>' + b.start_time + ' - ' + b.end_time + '</td><td>' + b.customer_name + '</td><td>' + b.customer_phone + '</td><td class="status-' + b.status + '">' + (b.status === 'active' ? '生效中' : '已取消') + '</td><td>' + (b.status === 'active' ? '<button class="btn btn-danger btn-sm cancel-booking" data-id="' + b.id + '">取消</button>' : '-') + '</td></tr>';
        }
        html += '</tbody></table>';
        container.innerHTML = html;
        
        // Attach cancel handlers
        var cancelBtns = container.querySelectorAll('.cancel-booking');
        for (var j = 0; j < cancelBtns.length; j++) {
          cancelBtns[j].addEventListener('click', function() {
            cancelBooking(parseInt(this.getAttribute('data-id')));
          });
        }
      } catch (error) {
        document.getElementById('bookings-list').innerHTML = '<p class="empty-state">載入失敗</p>';
      }
    }
    
    async function cancelBooking(id) {
      if (!confirm('確定要取消此預約嗎？')) return;
      try {
        var response = await fetch('/api/admin/bookings/' + id, {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + authToken }
        });
        if (response.ok) loadBookings(); else alert('取消失敗');
      } catch (error) { alert('取消失敗'); }
    }
    
    async function loadAvailability() {
      try {
        var response = await fetch('/api/admin/availability', {
          headers: { 'Authorization': 'Bearer ' + authToken }
        });
        if (!response.ok) { doLogout(); return; }
        var slots = await response.json();
        var container = document.getElementById('availability-list');
        if (slots.length === 0) {
          container.innerHTML = '<p class="empty-state">暫無設定時段</p>';
          return;
        }
        var html = '<table><thead><tr><th>日期</th><th>時間</th><th>狀態</th><th>操作</th></tr></thead><tbody>';
        for (var i = 0; i < slots.length; i++) {
          var s = slots[i];
          html += '<tr><td>' + formatDate(s.date) + '</td><td>' + s.start_time + ' - ' + s.end_time + '</td><td>' + (s.is_available ? '開放' : '關閉') + '</td><td><button class="btn btn-danger btn-sm delete-avail" data-id="' + s.id + '">刪除</button></td></tr>';
        }
        html += '</tbody></table>';
        container.innerHTML = html;
        
        // Attach delete handlers
        var deleteBtns = container.querySelectorAll('.delete-avail');
        for (var j = 0; j < deleteBtns.length; j++) {
          deleteBtns[j].addEventListener('click', function() {
            deleteAvailability(parseInt(this.getAttribute('data-id')));
          });
        }
      } catch (error) {
        document.getElementById('availability-list').innerHTML = '<p class="empty-state">載入失敗</p>';
      }
    }
    
    async function deleteAvailability(id) {
      if (!confirm('確定要刪除此時段嗎？')) return;
      try {
        var response = await fetch('/api/admin/availability/' + id, {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + authToken }
        });
        if (response.ok) loadAvailability(); else alert('刪除失敗');
      } catch (error) { alert('刪除失敗'); }
    }
    
    function addExcludeRange() {
      var container = document.getElementById('exclude-time-ranges');
      var div = document.createElement('div');
      div.className = 'exclude-range';
      div.innerHTML = '<input type="time" class="exclude-start" value="12:00"><span>至</span><input type="time" class="exclude-end" value="14:00"><button type="button" class="btn btn-danger btn-sm remove-range">刪除</button>';
      container.appendChild(div);
    }
    
    async function batchGenerate() {
      var startDate = document.getElementById('batch-start-date').value;
      var endDate = document.getElementById('batch-end-date').value;
      var startTime = document.getElementById('batch-start-time').value;
      var endTime = document.getElementById('batch-end-time').value;
      var duration = parseInt(document.getElementById('batch-duration').value);
      
      if (!startDate || !endDate || !startTime || !endTime) {
        alert('請填寫日期範圍和時間');
        return;
      }
      
      // Get excluded weekdays
      var excludeWeekdays = [];
      var weekdayChecks = document.querySelectorAll('.exclude-weekday:checked');
      for (var i = 0; i < weekdayChecks.length; i++) {
        excludeWeekdays.push(parseInt(weekdayChecks[i].value));
      }
      
      // Get excluded dates
      var excludeDatesText = document.getElementById('exclude-dates').value.trim();
      var excludeDates = [];
      if (excludeDatesText) {
        var parts = excludeDatesText.split(',');
        for (var j = 0; j < parts.length; j++) {
          var trimmed = parts[j].trim();
          if (trimmed) excludeDates.push(trimmed);
        }
      }
      
      // Get excluded time ranges
      var excludeRanges = [];
      var ranges = document.querySelectorAll('.exclude-range');
      for (var k = 0; k < ranges.length; k++) {
        var r = ranges[k];
        var s = r.querySelector('.exclude-start').value;
        var e = r.querySelector('.exclude-end').value;
        if (s && e) excludeRanges.push({ start: s, end: e });
      }
      
      var btn = document.getElementById('batch-generate-btn');
      btn.disabled = true;
      btn.textContent = '生成中...';
      
      try {
        var response = await fetch('/api/admin/availability/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
          body: JSON.stringify({
            start_date: startDate,
            end_date: endDate,
            start_time: startTime,
            end_time: endTime,
            duration_minutes: duration,
            exclude_weekdays: excludeWeekdays,
            exclude_dates: excludeDates,
            exclude_time_ranges: excludeRanges
          })
        });
        
        var result = await response.json();
        
        if (response.ok) {
          alert('成功生成 ' + result.generated_count + ' 個時段！');
          loadAvailability();
        } else {
          alert('生成失敗：' + (result.error || '未知錯誤'));
        }
      } catch (error) {
        alert('生成失敗，請重試');
      } finally {
        btn.disabled = false;
        btn.textContent = '批量生成時段';
      }
    }
    
    async function changePassword() {
      var newPassword = document.getElementById('new-password').value;
      if (!newPassword || newPassword.length < 4) { alert('密碼至少需要4個字符'); return; }
      try {
        var response = await fetch('/api/admin/password', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
          body: JSON.stringify({ new_password: newPassword })
        });
        if (response.ok) {
          alert('密碼已更改，請重新登入');
          authToken = newPassword;
          localStorage.setItem('admin_token', newPassword);
          document.getElementById('new-password').value = '';
        } else { alert('更改失敗'); }
      } catch (error) { alert('更改失敗'); }
    }
    
    function formatDate(dateStr) {
      if (!dateStr) return '-';
      var date = new Date(dateStr);
      return date.toLocaleDateString('zh-HK');
    }
    
    // Initialize
    document.addEventListener('DOMContentLoaded', init);
  </script>
</body>
</html>`;
}

export default app;
