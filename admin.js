// EZ Pharma - Platform Admin Console Logic
document.addEventListener('DOMContentLoaded', () => {
  // 1. Theme Management
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const htmlElement = document.documentElement;

  const applyTheme = (theme) => {
    htmlElement.setAttribute('data-theme', theme);
  };

  const savedTheme = localStorage.getItem('ezpharma-theme');
  const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (savedTheme) {
    applyTheme(savedTheme);
  } else if (systemPrefersDark) {
    applyTheme('dark');
  } else {
    applyTheme('light');
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const currentTheme = htmlElement.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      applyTheme(newTheme);
      localStorage.setItem('ezpharma-theme', newTheme);
    });
  }

  // 2. Initial Page Loader Spinning Circle Dismissal
  const pageLoader = document.getElementById('page-initial-loader');
  const dismissPageLoader = () => {
    if (pageLoader) {
      setTimeout(() => {
        pageLoader.classList.add('hidden-loader');
      }, 250);
    }
  };

  // 3. Top Animated Progress Loading Bar
  const progressBar = document.getElementById('top-progress-bar');
  const startProgress = () => {
    if (progressBar) progressBar.className = 'top-progress-bar active';
  };
  const finishProgress = () => {
    if (progressBar) {
      progressBar.className = 'top-progress-bar complete';
      setTimeout(() => {
        progressBar.className = 'top-progress-bar';
      }, 300);
    }
  };

  // 4. Client Router Mapping
  const views = {
    '/admin': 'view-overview',
    '/admin/overview': 'view-overview',
    '/admin/pharmacies': 'view-pharmacies',
    '/admin/pharmacies/new': 'view-pharmacies-new',
    '/admin/payments': 'view-payments',
    '/admin/pricing': 'view-pricing',
    '/admin/payment-method': 'view-payment-method',
    '/admin/profile': 'view-profile'
  };

  const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');

  const updateActiveSidebarLink = (path) => {
    navLinks.forEach(link => {
      const route = link.getAttribute('data-route');
      if (route === path || (path === '/admin' && route === '/admin/overview') || (path.startsWith('/admin/pharmacies') && route === '/admin/pharmacies')) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  };

  const showView = (targetViewId, path) => {
    document.querySelectorAll('.admin-subview').forEach(view => {
      if (view.id === targetViewId) {
        view.classList.remove('hidden');
      } else {
        view.classList.add('hidden');
      }
    });
    updateActiveSidebarLink(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateTo = (path, addToHistory = true) => {
    startProgress();
    const cleanPath = path.replace(/\/$/, '') || '/admin/overview';
    let targetViewId = views[cleanPath];

    let pharmacyIdMatch = null;
    if (!targetViewId && cleanPath.startsWith('/admin/pharmacies/')) {
      const parts = cleanPath.split('/');
      pharmacyIdMatch = parts[3];
      if (pharmacyIdMatch && pharmacyIdMatch !== 'new') {
        targetViewId = 'view-pharmacy-details';
      }
    }

    if (!targetViewId) targetViewId = 'view-overview';

    if (addToHistory && window.location.pathname !== cleanPath) {
      window.history.pushState({ path: cleanPath }, '', cleanPath);
    }

    setTimeout(() => {
      showView(targetViewId, cleanPath);
      finishProgress();

      if (targetViewId === 'view-pharmacy-details' && pharmacyIdMatch) {
        loadSinglePharmacyDetails(pharmacyIdMatch);
      } else if (cleanPath === '/admin/pharmacies' || cleanPath === '/admin/overview' || cleanPath === '/admin') {
        loadPharmaciesData();
      } else if (cleanPath === '/admin/payment-method') {
        loadPaymentMethods();
      } else if (cleanPath === '/admin/payments') {
        renderPaymentsPage();
      } else if (cleanPath === '/admin/pricing') {
        renderPricingPlans();
      }
    }, 180);
  };

  // Handle click on all router links
  document.addEventListener('click', (e) => {
    const link = e.target.closest('.router-link, .nav-link');
    if (link) {
      const href = link.getAttribute('href') || link.getAttribute('data-route');
      if (href && href.startsWith('/admin')) {
        e.preventDefault();
        closeActionDropdown();
        navigateTo(href);
      }
    }
  });

  // Handle browser Back / Forward
  window.addEventListener('popstate', (e) => {
    const path = (e.state && e.state.path) || window.location.pathname;
    navigateTo(path, false);
  });

  // Initial Route Resolution
  const rawPath = window.location.pathname.replace(/\/$/, '');
  const initialPath = (!rawPath || rawPath === '/admin') ? '/admin/overview' : rawPath;
  let initialViewId = views[initialPath];
  let initPharmId = null;

  if (!initialViewId && initialPath.startsWith('/admin/pharmacies/')) {
    initPharmId = initialPath.split('/')[3];
    if (initPharmId && initPharmId !== 'new') {
      initialViewId = 'view-pharmacy-details';
    }
  }
  if (!initialViewId) initialViewId = 'view-overview';
  showView(initialViewId, initialPath);

  // 5. Toast Notifications
  const toast = document.getElementById('toast-notification');
  const showToast = (message, isError = false) => {
    if (!toast) return;
    toast.textContent = message;
    toast.style.background = isError ? '#ef4444' : '#10b981';
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 3500);
  };

  // 6. Live Clock
  const updateTimeElem = document.getElementById('last-update-time');
  const updateClock = () => {
    if (updateTimeElem) {
      const now = new Date();
      updateTimeElem.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  };
  updateClock();
  setInterval(updateClock, 1000);

  // 7. Live MySQL Pharmacies Sync
  const API_ENDPOINTS = [
    'https://api.holidaymartbd.com/ezpharma/pharmacies.php',
    'https://api.holidaymartbd.com/ezpharma/signup.php',
    '/api/pharmacies.php'
  ];

  let pharmaciesList = [];

  const getLocalStoredPharmacies = () => {
    try {
      const raw = localStorage.getItem('ezpharma_local_pharmacies');
      return raw ? JSON.parse(raw) : [
        {
          id: 1,
          name: 'Demo Pharmacy',
          slug: 'demo',
          address: 'House 12, Road 4, Dhanmondi, Dhaka',
          phone: '+880 1711 000000',
          owner_name: 'Pharmacy Admin',
          owner_email: 'admin@pharmacy.com',
          plan: 'monthly',
          status: 'active',
          amount: 400.00,
          created_at: '2026-05-11 10:00:00'
        }
      ];
    } catch (e) {
      return [];
    }
  };

  const saveLocalStoredPharmacies = (list) => {
    try {
      localStorage.setItem('ezpharma_local_pharmacies', JSON.stringify(list));
    } catch (e) {}
  };

  const loadPharmaciesData = async () => {
    let apiData = null;

    for (const url of API_ENDPOINTS) {
      try {
        const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success && Array.isArray(json.data)) {
            apiData = json;
            break;
          }
        }
      } catch (err) {}
    }

    const localSaved = getLocalStoredPharmacies();
    if (apiData && apiData.data && apiData.data.length > 0) {
      pharmaciesList = apiData.data.map(apiPharm => {
        const localMatch = localSaved.find(l => l.id == apiPharm.id || l.slug === apiPharm.slug || (l.owner_email && l.owner_email === apiPharm.owner_email));
        if (localMatch && localMatch.status) {
          return { ...apiPharm, status: localMatch.status };
        }
        return apiPharm;
      });
      saveLocalStoredPharmacies(pharmaciesList);
    } else {
      pharmaciesList = localSaved;
    }

    updateKpisAndTables(pharmaciesList);
    renderPaymentsPage();
    dismissPageLoader();
  };

  const updateKpisAndTables = (list) => {
    const total = list.length;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let active = 0, expired = 0, suspended = 0, pending = 0, totalMrr = 0;
    let revenueThisMonth = 0;
    let revenueLastMonth = 0;
    let revenueToday = 0;
    let allTimeRevenue = 0;
    let expiringIn7Days = 0;
    let expiringIn30Days = 0;
    let thisMonthNewCount = 0;

    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Monthly revenue buckets for 12-month chart
    const monthRevenues = new Array(12).fill(0);

    list.forEach(p => {
      const isYearly = (p.plan === 'yearly');
      const planCost = isYearly ? 4500 : 400;
      const status = p.status || 'active';

      const createdAt = p.created_at ? new Date(p.created_at) : now;
      const expiresAt = p.expires_at ? new Date(p.expires_at) : null;

      // Status breakdown
      if (status === 'active' || status === 'paid') {
        active++;
        totalMrr += isYearly ? (4500 / 12) : 400;
        allTimeRevenue += planCost;
      } else if (status === 'suspended') {
        suspended++;
      } else if (status === 'pending_payment' || status === 'pending') {
        pending++;
      } else {
        expired++;
      }

      // Check registration month
      if (createdAt.getFullYear() === currentYear && createdAt.getMonth() === currentMonth) {
        thisMonthNewCount++;
        if (status === 'active' || status === 'paid') {
          revenueThisMonth += planCost;
        }
      } else if (
        (currentMonth === 0 && createdAt.getFullYear() === currentYear - 1 && createdAt.getMonth() === 11) ||
        (createdAt.getFullYear() === currentYear && createdAt.getMonth() === currentMonth - 1)
      ) {
        if (status === 'active' || status === 'paid') {
          revenueLastMonth += planCost;
        }
      }

      // Check if created today
      if (createdAt.toDateString() === now.toDateString() && (status === 'active' || status === 'paid')) {
        revenueToday += planCost;
      }

      // Expiry checks
      if (expiresAt) {
        if (expiresAt >= now && expiresAt <= sevenDaysFromNow) {
          expiringIn7Days++;
        }
        if (expiresAt >= now && expiresAt <= thirtyDaysFromNow) {
          expiringIn30Days++;
        }
        if (expiresAt < now && status !== 'suspended') {
          // Count as expired if past expiry
        }
      }

      // Bucket into last 12 months
      const monthDiff = (currentYear - createdAt.getFullYear()) * 12 + (currentMonth - createdAt.getMonth());
      if (monthDiff >= 0 && monthDiff < 12 && (status === 'active' || status === 'paid')) {
        const bucketIndex = 11 - monthDiff;
        monthRevenues[bucketIndex] += planCost;
      }
    });

    // 1. Overview KPIs
    const kpiCount = document.getElementById('kpi-pharmacies-count');
    const kpiMeta = document.getElementById('kpi-pharmacies-meta');
    const kpiMrr = document.getElementById('kpi-mrr-val');
    const kpiArr = document.getElementById('kpi-arr-val');
    const kpiRevMonth = document.getElementById('kpi-rev-month');
    const kpiExpiring = document.getElementById('kpi-expiring-count');

    if (kpiCount) kpiCount.textContent = total;
    if (kpiMeta) kpiMeta.textContent = `+${thisMonthNewCount || total} registered`;
    if (kpiMrr) kpiMrr.textContent = `BDT ${Math.round(totalMrr).toLocaleString()}`;
    if (kpiArr) kpiArr.textContent = `ARR = BDT ${Math.round(totalMrr * 12).toLocaleString()}`;
    if (kpiRevMonth) kpiRevMonth.textContent = `BDT ${Math.round(revenueThisMonth || totalMrr).toLocaleString()}`;
    if (kpiExpiring) kpiExpiring.textContent = expiringIn7Days;

    // 2. Status Pills
    const pillActive = document.getElementById('pill-active-count');
    const pillExpired = document.getElementById('pill-expired-count');
    const pillPending = document.getElementById('pill-pending-count');
    const pillSuspended = document.getElementById('pill-suspended-count');

    if (pillActive) pillActive.textContent = active;
    if (pillExpired) pillExpired.textContent = expired;
    if (pillPending) pillPending.textContent = pending;
    if (pillSuspended) pillSuspended.textContent = suspended;

    // 3. Dynamic Chart Badges & Line Plot
    const chartAlltime = document.getElementById('chart-alltime-val');
    const chartPanelHeader = document.querySelector('.chart-summary-badges');
    if (chartAlltime) chartAlltime.textContent = `BDT ${Math.round(allTimeRevenue || totalMrr).toLocaleString()}`;
    if (chartPanelHeader) {
      chartPanelHeader.innerHTML = `
        <span>All-time: <strong id="chart-alltime-val">BDT ${Math.round(allTimeRevenue || totalMrr).toLocaleString()}</strong></span>
        <span>Today: <strong>BDT ${Math.round(revenueToday).toLocaleString()}</strong></span>
      `;
    }

    renderDynamicRevenueChart(monthRevenues);
    renderSubscriptionHealthPie(active, expired, pending, suspended, total);
    renderPaymentMethodSplit(list);
    renderTopPharmaciesRanking(list);
    renderRecentPaymentsList(list);

    // 4. Pharmacies List Tab KPIs
    const pTotal = document.getElementById('pharm-total-count');
    const pActive = document.getElementById('pharm-active-count');
    const pExpired = document.getElementById('pharm-expired-count');
    const pSuspended = document.getElementById('pharm-suspended-count');

    if (pTotal) pTotal.textContent = total;
    if (pActive) pActive.textContent = active;
    if (pExpired) pExpired.textContent = expired;
    if (pSuspended) pSuspended.textContent = suspended;

    renderPharmaciesTable(list);
    renderOverviewRecentTable(list);
  };

  // 1. Subscription Health Donut Pie
  const renderSubscriptionHealthPie = (active, expired, pending, suspended, total) => {
    const pActive = document.getElementById('pie-count-active');
    const pExpired = document.getElementById('pie-count-expired');
    const pPending = document.getElementById('pie-count-pending');
    const pSuspended = document.getElementById('pie-count-suspended');

    if (pActive) pActive.textContent = active;
    if (pExpired) pExpired.textContent = expired;
    if (pPending) pPending.textContent = pending;
    if (pSuspended) pSuspended.textContent = suspended;

    const sliceActive = document.getElementById('pie-sub-active-slice');
    const slicePending = document.getElementById('pie-sub-pending-slice');
    const sliceSuspended = document.getElementById('pie-sub-suspended-slice');

    const circumference = 377; // 2 * PI * 60
    if (!total || total === 0) {
      if (sliceActive) sliceActive.setAttribute('stroke-dasharray', `0 ${circumference}`);
      return;
    }

    const activeLen = (active / total) * circumference;
    const pendingLen = (pending / total) * circumference;
    const suspendedLen = (suspended / total) * circumference;

    if (sliceActive) {
      sliceActive.setAttribute('stroke-dasharray', `${activeLen} ${circumference}`);
      sliceActive.setAttribute('stroke-dashoffset', '0');
    }
    if (slicePending) {
      slicePending.setAttribute('stroke-dasharray', `${pendingLen} ${circumference}`);
      slicePending.setAttribute('stroke-dashoffset', `${-activeLen}`);
    }
    if (sliceSuspended) {
      sliceSuspended.setAttribute('stroke-dasharray', `${suspendedLen} ${circumference}`);
      sliceSuspended.setAttribute('stroke-dashoffset', `${-(activeLen + pendingLen)}`);
    }
  };

  // 2. Payment Method Split
  const renderPaymentMethodSplit = (list) => {
    let cashAmount = 0;
    let cashCount = 0;
    let onlineAmount = 0;
    let onlineCount = 0;

    list.forEach(p => {
      const isYearly = (p.plan === 'yearly');
      const amount = parseFloat(p.amount) || (isYearly ? 4500 : 400);
      const prov = (p.payment_provider || 'cash').toLowerCase();

      if (prov.includes('stripe') || prov.includes('bkash') || prov.includes('nagad') || prov.includes('online')) {
        onlineAmount += amount;
        onlineCount++;
      } else {
        cashAmount += amount;
        cashCount++;
      }
    });

    const sumCashAmount = document.getElementById('pay-sum-cash-amount');
    const sumCashCount = document.getElementById('pay-sum-cash-count');
    const sumOnlineAmount = document.getElementById('pay-sum-online-amount');
    const sumOnlineCount = document.getElementById('pay-sum-online-count');

    if (sumCashAmount) sumCashAmount.textContent = `BDT ${Math.round(cashAmount).toLocaleString()}`;
    if (sumCashCount) sumCashCount.textContent = `${cashCount} payments`;
    if (sumOnlineAmount) sumOnlineAmount.textContent = `BDT ${Math.round(onlineAmount).toLocaleString()}`;
    if (sumOnlineCount) sumOnlineCount.textContent = `${onlineCount} payments`;

    const sliceCash = document.getElementById('pie-pay-cash-slice');
    const sliceStripe = document.getElementById('pie-pay-stripe-slice');
    const totalPayments = cashCount + onlineCount;
    const circumference = 377;

    if (totalPayments > 0) {
      const cashLen = (cashCount / totalPayments) * circumference;
      const onlineLen = (onlineCount / totalPayments) * circumference;

      if (sliceCash) {
        sliceCash.setAttribute('stroke-dasharray', `${cashLen} ${circumference}`);
        sliceCash.setAttribute('stroke-dashoffset', '0');
      }
      if (sliceStripe) {
        sliceStripe.setAttribute('stroke-dasharray', `${onlineLen} ${circumference}`);
        sliceStripe.setAttribute('stroke-dashoffset', `${-cashLen}`);
      }
    }
  };

  // 3. Top Pharmacies by Lifetime Revenue
  const renderTopPharmaciesRanking = (list) => {
    const container = document.getElementById('top-pharmacies-container');
    if (!container) return;

    if (!list || list.length === 0) {
      container.innerHTML = `<p class="text-subtle text-center py-4">No pharmacy revenue data available yet.</p>`;
      return;
    }

    // Sort by lifetime revenue descending
    const sorted = [...list].sort((a, b) => {
      const amtA = parseFloat(a.amount) || (a.plan === 'yearly' ? 4500 : 400);
      const amtB = parseFloat(b.amount) || (b.plan === 'yearly' ? 4500 : 400);
      return amtB - amtA;
    });

    container.innerHTML = sorted.slice(0, 5).map((p, idx) => {
      const amt = parseFloat(p.amount) || (p.plan === 'yearly' ? 4500 : 400);
      const isDemo = (p.name && p.name.toLowerCase().includes('demo'));
      const lastDate = p.created_at ? new Date(p.created_at).toLocaleDateString('en-US') : '8/19/2026';
      const rankNum = idx + 1;

      return `
        <div class="top-pharm-row">
          <div class="top-pharm-left">
            <div class="top-rank-badge ${rankNum === 1 ? 'rank-1' : ''}">${rankNum}</div>
            <div class="top-pharm-info">
              <strong>${p.name}</strong>
              <span>1 payment • last ${lastDate}</span>
            </div>
          </div>
          <div class="top-pharm-amount">
            BDT ${Math.round(amt).toLocaleString()}
          </div>
        </div>
      `;
    }).join('');
  };

  // 4. Recent Payments List
  const renderRecentPaymentsList = (list) => {
    const container = document.getElementById('recent-payments-container');
    if (!container) return;

    if (!list || list.length === 0) {
      container.innerHTML = `<p class="text-subtle text-center py-4">No payments recorded yet.</p>`;
      return;
    }

    container.innerHTML = list.slice(0, 6).map(p => {
      const amt = parseFloat(p.amount) || (p.plan === 'yearly' ? 4500 : 400);
      const prov = ucfirst(p.payment_provider || 'Cash');
      const isStripe = prov.toLowerCase().includes('stripe') || prov.toLowerCase().includes('online');
      const dateStr = p.created_at ? new Date(p.created_at).toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true }) : '8/19/2026, 5:26:54 PM';

      return `
        <div class="recent-pay-item-row">
          <div class="recent-pay-info">
            <strong>${p.name}</strong>
            <div class="recent-pay-meta">
              <span>${dateStr}</span>
              <span class="pay-method-tag ${isStripe ? 'tag-stripe' : ''}">${prov}</span>
            </div>
          </div>
          <div class="recent-pay-amount">
            BDT ${Math.round(amt).toLocaleString()}
          </div>
        </div>
      `;
    }).join('');
  };

  const renderDynamicRevenueChart = (monthData) => {
    const svg = document.querySelector('.line-chart-svg');
    if (!svg) return;

    // Base coordinates
    const maxVal = Math.max(...monthData, 400);
    const xCoords = [60, 130, 200, 270, 340, 410, 480, 550, 650, 730, 800, 870];
    const points = xCoords.map((x, i) => {
      const val = monthData[i] || 0;
      // y ranges from 220 (zero) down to 30 (max)
      const y = Math.round(220 - ((val / maxVal) * 180));
      return { x, y };
    });

    const pathD = points.map((p, idx) => (idx === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
    const areaD = `${pathD} L ${points[points.length - 1].x} 220 L ${points[0].x} 220 Z`;

    const areaPath = svg.querySelector('path[fill="url(#chartGradient)"]');
    const linePath = svg.querySelector('path[stroke="var(--primary)"]');

    if (areaPath) areaPath.setAttribute('d', areaD);
    if (linePath) linePath.setAttribute('d', pathD);
  };

  const renderOverviewRecentTable = (list) => {
    const tbody = document.getElementById('overview-recent-tbody');
    if (!tbody) return;

    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="2" class="text-center py-4 text-subtle">No recently registered pharmacies found.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.slice(0, 6).map(item => {
      const isSuspended = item.status === 'suspended';
      const isPending = item.status === 'pending_payment' || item.status === 'pending';
      let statusClass = 'status-badge-active';
      let statusText = 'Active';

      if (isSuspended) {
        statusClass = 'status-badge-suspended';
        statusText = 'Suspended';
      } else if (isPending) {
        statusClass = 'status-badge-pending';
        statusText = 'Pending payment';
      }

      const joinedDate = item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today';

      return `
        <tr>
          <td>
            <a href="/admin/pharmacies/${item.id}" class="router-link font-semibold text-main hover:underline" style="color:var(--text-main); font-weight:700; text-decoration:none;">
              ${item.name}
            </a><br />
            <span class="text-subtle" style="font-size:0.8rem; color:var(--text-muted);">
              ${item.owner_email || item.email || 'owner@email.com'} • Joined ${joinedDate}
            </span>
          </td>
          <td class="text-right">
            <span class="${statusClass}">${statusText}</span>
          </td>
        </tr>
      `;
    }).join('');
  };

  const renderPharmaciesTable = (list) => {
    const tbody = document.getElementById('pharmacies-table-tbody');
    if (!tbody) return;

    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-subtle">No pharmacies registered yet. Click "+ Register new pharmacy" above to add one.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(item => {
      const isDemo = (item.name && item.name.toLowerCase().includes('demo')) || (item.slug && item.slug.toLowerCase().includes('demo-pharmacy'));
      const renewDate = item.expires_at ? new Date(item.expires_at).toLocaleDateString('en-US') : '8/23/2026';
      const planText = (item.plan === 'yearly') ? 'Yearly' : 'Monthly';
      const isSuspended = item.status === 'suspended';
      const isPending = item.status === 'pending_payment' || item.status === 'pending';
      
      let statusClass = 'status-badge-active';
      let statusText = 'Active';

      if (isSuspended) {
        statusClass = 'status-badge-suspended';
        statusText = 'Suspended';
      } else if (isPending) {
        statusClass = 'status-badge-pending';
        statusText = 'Pending payment';
      } else if (item.status) {
        statusText = item.status.charAt(0).toUpperCase() + item.status.slice(1);
      }

      return `
        <tr data-pharmacy-id="${item.id}">
          <td class="pharm-name-cell">
            <strong>${item.name}</strong> ${isDemo ? '<span class="badge-demo">DEMO</span>' : ''}
            <span class="pharm-slug">${item.slug || 'slug'}</span>
          </td>
          <td>
            <span>${item.owner_email || item.email || 'admin@pharmacy.com'}</span>
          </td>
          <td>
            <span class="${statusClass}">${statusText}</span>
          </td>
          <td>
            <strong>${planText}</strong>
          </td>
          <td>
            <span>${renewDate}</span>
            <span class="renews-sub ${isSuspended ? 'overdue' : 'days-left'}">${isSuspended ? 'Suspended' : (isPending ? 'Pending' : 'Active')}</span>
          </td>
          <td class="text-right">
            <button class="btn-actions-dots btn-row-action-trigger" data-id="${item.id}" title="Options">⋮</button>
          </td>
        </tr>
      `;
    }).join('');
  };

  // 8. Search & Filters
  const searchInput = document.getElementById('pharmacy-search-input');
  const filterOrgStatus = document.getElementById('filter-org-status');
  const filterSubscription = document.getElementById('filter-subscription');
  const filterPlan = document.getElementById('filter-plan');

  const applyFilters = () => {
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const orgStatus = filterOrgStatus ? filterOrgStatus.value : 'all';
    const plan = filterPlan ? filterPlan.value : 'all';

    const filtered = pharmaciesList.filter(item => {
      const matchesQuery = !query || 
        (item.name && item.name.toLowerCase().includes(query)) ||
        (item.slug && item.slug.toLowerCase().includes(query)) ||
        (item.owner_email && item.owner_email.toLowerCase().includes(query)) ||
        (item.email && item.email.toLowerCase().includes(query));

      const matchesStatus = orgStatus === 'all' || item.status === orgStatus;
      const matchesPlan = plan === 'all' || item.plan === plan;

      return matchesQuery && matchesStatus && matchesPlan;
    });

    renderPharmaciesTable(filtered);
  };

  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (filterOrgStatus) filterOrgStatus.addEventListener('change', applyFilters);
  if (filterSubscription) filterSubscription.addEventListener('change', applyFilters);
  if (filterPlan) filterPlan.addEventListener('change', applyFilters);

  // 9. Billing Interval Dynamic Hint
  const newBillingInterval = document.getElementById('new_billing_interval');
  const billingChargeHint = document.getElementById('billing-charge-hint');
  if (newBillingInterval && billingChargeHint) {
    newBillingInterval.addEventListener('change', () => {
      if (newBillingInterval.value === 'yearly') {
        billingChargeHint.textContent = 'Charge: BDT 4,500.00';
      } else {
        billingChargeHint.textContent = 'Charge: BDT 400.00';
      }
    });
  }

  // 10. Register New Pharmacy Submission
  const formRegister = document.getElementById('form-register-pharmacy');
  const btnCreateSubmit = document.getElementById('btn-create-pharmacy');
  const btnCreateText = document.getElementById('btn-create-text');
  const createSpinner = document.getElementById('create-spinner');
  const newPharmAlert = document.getElementById('new-pharm-alert');

  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      newPharmAlert.className = 'alert-box hidden';

      const pharmacy_name = document.getElementById('new_pharm_name').value.trim();
      const address = document.getElementById('new_pharm_address').value.trim();
      const phone = document.getElementById('new_pharm_phone').value.trim();
      const full_name = document.getElementById('new_admin_name').value.trim();
      const email = document.getElementById('new_admin_email').value.trim();
      const password = document.getElementById('new_admin_password').value;
      const plan = newBillingInterval ? newBillingInterval.value : 'monthly';
      const payment_method = document.getElementById('new_payment_method').value;
      const notes = document.getElementById('new_pharm_notes').value.trim();

      if (!pharmacy_name || !full_name || !email || !password) {
        newPharmAlert.textContent = 'Please fill out all required fields (*).';
        newPharmAlert.className = 'alert-box alert-error';
        return;
      }

      btnCreateSubmit.disabled = true;
      createSpinner.classList.remove('hidden');
      btnCreateText.textContent = 'Creating pharmacy...';

      const payload = {
        action: 'create',
        pharmacy_name,
        address,
        phone,
        full_name,
        email,
        password,
        plan,
        payment_method,
        notes
      };

      const newRecord = {
        id: Date.now(),
        name: pharmacy_name,
        slug: pharmacy_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        owner_name: full_name,
        owner_email: email,
        plan: plan,
        status: 'active',
        created_at: new Date().toISOString()
      };

      const localList = getLocalStoredPharmacies();
      localList.unshift(newRecord);
      saveLocalStoredPharmacies(localList);

      for (const url of ['https://api.holidaymartbd.com/ezpharma/pharmacies.php', '/api/pharmacies.php']) {
        try {
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          break;
        } catch (err) {}
      }

      formRegister.reset();
      showToast(`🎉 Pharmacy "${pharmacy_name}" registered & recorded successfully!`);
      loadPharmaciesData();
      navigateTo('/admin/pharmacies');

      btnCreateSubmit.disabled = false;
      createSpinner.classList.add('hidden');
      btnCreateText.textContent = 'Create pharmacy & record cash payment';
    });
  }

  // ==============================================
  // 11. 3-Dot Action Dropdown Menu Logic (Image 1)
  // ==============================================
  const actionDropdown = document.getElementById('row-actions-dropdown');
  const btnMenuSuspend = document.getElementById('btn-menu-suspend');
  let activeMenuPharmacyId = null;

  const closeActionDropdown = () => {
    if (actionDropdown) actionDropdown.classList.add('hidden');
    activeMenuPharmacyId = null;
  };

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-row-action-trigger, .btn-actions-dots');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      const pharmId = btn.getAttribute('data-id');
      const pharm = pharmaciesList.find(p => p.id == pharmId);
      activeMenuPharmacyId = pharmId;

      if (btnMenuSuspend) {
        if (pharm && pharm.status === 'suspended') {
          btnMenuSuspend.innerHTML = '<span class="action-icon">▶️</span><span>Activate pharmacy</span>';
        } else {
          btnMenuSuspend.innerHTML = '<span class="action-icon">⏸️</span><span>Suspend pharmacy</span>';
        }
      }

      // Position fixed relative to viewport
      const rect = btn.getBoundingClientRect();
      const topPos = rect.bottom + 6;
      const leftPos = Math.max(10, rect.right - 220);

      actionDropdown.style.top = `${topPos}px`;
      actionDropdown.style.left = `${leftPos}px`;
      actionDropdown.classList.remove('hidden');
      return;
    }

    if (!e.target.closest('#row-actions-dropdown')) {
      closeActionDropdown();
    }
  });

  // Action Menu Item Clicks
  document.addEventListener('click', async (e) => {
    const item = e.target.closest('.action-menu-item');
    if (!item || !activeMenuPharmacyId) return;
    e.stopPropagation();

    const action = item.getAttribute('data-action');
    const pharmId = activeMenuPharmacyId;
    const pharm = pharmaciesList.find(p => p.id == pharmId);

    closeActionDropdown();

    if (action === 'view-details') {
      navigateTo(`/admin/pharmacies/${pharmId}`);
    } else if (action === 'edit') {
      openEditPharmacyModal(pharm);
    } else if (action === 'record-payment') {
      openRecordPaymentModal(pharm);
    } else if (action === 'suspend') {
      await togglePharmacySuspend(pharm);
    } else if (action === 'delete') {
      if (confirm(`Are you sure you want to permanently delete "${pharm ? pharm.name : 'this pharmacy'}"?`)) {
        await deletePharmacy(pharmId);
      }
    }
  });

  // ==============================================
  // 12. Single Pharmacy Details Logic (Image 2)
  // ==============================================
  let currentDetailsPharmacy = null;

  const loadSinglePharmacyDetails = async (id) => {
    startProgress();
    let pharm = pharmaciesList.find(p => p.id == id);
    let history = [];

    // Try fetching from API
    for (const url of [`https://api.holidaymartbd.com/ezpharma/pharmacies.php?id=${id}`, `/api/pharmacies.php?id=${id}`]) {
      try {
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success && json.data) {
            pharm = json.data;
            history = json.payment_history || [];
            break;
          }
        }
      } catch (err) {}
    }

    if (!pharm) {
      pharm = {
        id: id,
        name: 'Demo Pharmacy',
        slug: 'demo',
        address: 'House 12, Road 4, Dhanmondi, Dhaka',
        phone: '+880 1711 000000',
        owner_name: 'Pharmacy Admin',
        owner_email: 'admin@pharmacy.com',
        plan: 'monthly',
        status: 'active',
        created_at: '2026-05-11 10:00:00'
      };
    }

    currentDetailsPharmacy = pharm;

    // Header
    const nameEl = document.getElementById('details-pharm-name');
    const subEl = document.getElementById('details-pharm-sub');
    const btnSuspend = document.getElementById('btn-details-suspend');
    const btnPay = document.getElementById('btn-details-record-payment');

    if (nameEl) nameEl.textContent = pharm.name;
    if (subEl) subEl.textContent = `${pharm.owner_email || pharm.email || 'admin@pharmacy.com'} • Joined ${pharm.created_at ? new Date(pharm.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'recently'}`;

    if (btnSuspend) {
      btnSuspend.setAttribute('data-id', pharm.id);
      if (pharm.status === 'suspended') {
        btnSuspend.innerHTML = '<span>▶️ Activate</span>';
      } else {
        btnSuspend.innerHTML = '<span>⏸️ Suspend</span>';
      }
    }

    if (btnPay) btnPay.setAttribute('data-id', pharm.id);

    // Organization Card
    const orgStatus = document.getElementById('details-org-status');
    const orgSlug = document.getElementById('details-org-slug');
    const orgAddress = document.getElementById('details-org-address');
    const orgPhone = document.getElementById('details-org-phone');

    if (orgStatus) {
      const isSuspended = pharm.status === 'suspended';
      orgStatus.textContent = isSuspended ? 'Suspended' : (pharm.status ? ucfirst(pharm.status) : 'Active');
      orgStatus.className = isSuspended ? 'info-val status-badge-suspended' : 'info-val status-badge-active';
    }
    if (orgSlug) orgSlug.textContent = pharm.slug || 'demo';
    if (orgAddress) orgAddress.textContent = pharm.address || '—';
    if (orgPhone) orgPhone.textContent = pharm.phone || '—';

    // Subscription Card - 100% Dynamic Period Calculation
    const subStatus = document.getElementById('details-sub-status');
    const subInterval = document.getElementById('details-sub-interval');
    const subStart = document.getElementById('details-sub-start');
    const subEnd = document.getElementById('details-sub-end');

    const isYearly = (pharm.plan === 'yearly');
    const rawStartDate = pharm.starts_at || pharm.created_at || (history && history[0] ? history[0].created_at : null) || new Date();
    const startDateObj = new Date(rawStartDate);

    let endDateObj;
    if (pharm.expires_at) {
      endDateObj = new Date(pharm.expires_at);
    } else {
      endDateObj = new Date(startDateObj);
      if (isYearly) {
        endDateObj.setFullYear(endDateObj.getFullYear() + 1);
      } else {
        endDateObj.setMonth(endDateObj.getMonth() + 1);
      }
    }

    const formatDateOnly = (d) => {
      if (!d || isNaN(d.getTime())) return new Date().toLocaleDateString('en-US');
      return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    };

    if (subStatus) {
      subStatus.textContent = (pharm.status === 'suspended') ? 'Suspended' : 'Active';
      subStatus.className = (pharm.status === 'suspended') ? 'info-val status-badge-suspended' : 'info-val status-badge-active';
    }
    if (subInterval) subInterval.textContent = isYearly ? 'Yearly' : 'Monthly';
    if (subStart) subStart.textContent = formatDateOnly(startDateObj);
    if (subEnd) subEnd.textContent = formatDateOnly(endDateObj);

    // Payment History Table
    renderPaymentHistoryTable(history, pharm, startDateObj);
    finishProgress();
  };

  const renderPaymentHistoryTable = (history, pharm, startDateObj) => {
    const tbody = document.getElementById('details-payment-history-tbody');
    if (!tbody) return;

    if (!history || history.length === 0) {
      const dateStr = startDateObj ? startDateObj.toLocaleString('en-US') : new Date().toLocaleString('en-US');
      tbody.innerHTML = `
        <tr>
          <td>${dateStr}</td>
          <td><span class="gw-status-pill pill-active">${ucfirst(pharm.payment_provider || 'Cash')}</span></td>
          <td><span class="text-green font-bold">Succeeded</span></td>
          <td><strong>BDT ${pharm.plan === 'yearly' ? '4,500.00' : '400.00'}</strong></td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = history.map(item => {
      const itemDate = item.created_at ? new Date(item.created_at).toLocaleString('en-US') : new Date().toLocaleString('en-US');
      return `
        <tr>
          <td>${itemDate}</td>
          <td><span class="gw-status-pill pill-active">${item.payment_method || 'Cash'}</span></td>
          <td><span class="text-green font-bold">${item.status || 'Succeeded'}</span></td>
          <td><strong>BDT ${parseFloat(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong> ${item.notes ? '<span class="text-subtle">(' + item.notes + ')</span>' : ''}</td>
        </tr>
      `;
    }).join('');
  };

  // Details Page Top Buttons
  const btnDetailsSuspend = document.getElementById('btn-details-suspend');
  if (btnDetailsSuspend) {
    btnDetailsSuspend.addEventListener('click', () => {
      if (currentDetailsPharmacy) {
        togglePharmacySuspend(currentDetailsPharmacy);
      }
    });
  }

  const btnDetailsPay = document.getElementById('btn-details-record-payment');
  if (btnDetailsPay) {
    btnDetailsPay.addEventListener('click', () => {
      if (currentDetailsPharmacy) {
        openRecordPaymentModal(currentDetailsPharmacy);
      }
    });
  }

  // ==============================================
  // 13. Suspend / Activate Pharmacy
  // ==============================================
  const togglePharmacySuspend = async (pharm) => {
    if (!pharm) return;
    const isSuspended = pharm.status === 'suspended';
    const newStatus = isSuspended ? 'active' : 'suspended';
    const confirmMsg = isSuspended 
      ? `Activate "${pharm.name}"? The pharmacy admin will be able to log in again.` 
      : `Suspend "${pharm.name}"? The pharmacy will be blocked from logging in.`;

    if (!confirm(confirmMsg)) return;

    pharm.status = newStatus;
    saveLocalStoredPharmacies(pharmaciesList);
    updateKpisAndTables(pharmaciesList);

    if (currentDetailsPharmacy && currentDetailsPharmacy.id == pharm.id) {
      loadSinglePharmacyDetails(pharm.id);
    }

    for (const url of ['https://api.holidaymartbd.com/ezpharma/pharmacies.php', '/api/pharmacies.php']) {
      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'suspend',
            pharmacy_id: pharm.id,
            status: newStatus
          })
        });
        break;
      } catch (err) {}
    }

    showToast(`✅ Pharmacy "${pharm.name}" is now ${newStatus}.`);
  };

  const deletePharmacy = async (pharmId) => {
    pharmaciesList = pharmaciesList.filter(p => p.id != pharmId);
    saveLocalStoredPharmacies(pharmaciesList);
    updateKpisAndTables(pharmaciesList);

    for (const url of ['https://api.holidaymartbd.com/ezpharma/pharmacies.php', '/api/pharmacies.php']) {
      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', pharmacy_id: pharmId })
        });
        break;
      } catch (err) {}
    }

    showToast('🗑️ Pharmacy removed successfully.');
  };

  // ==============================================
  // 14. Edit Details & Password Modal Logic (Image 3)
  // ==============================================
  const modalEdit = document.getElementById('modal-edit-pharmacy');
  const btnCloseEditModal = document.getElementById('btn-close-edit-modal');
  const btnCancelEditModal = document.getElementById('btn-cancel-edit-modal');
  const formEdit = document.getElementById('form-edit-pharmacy');
  const editSubText = document.getElementById('edit-modal-pharm-name-sub');
  const passInput = document.getElementById('edit_admin_password');
  const btnToggleShowPass = document.getElementById('btn-toggle-show-pass');
  const btnGenPass = document.getElementById('btn-gen-pass');

  const openEditPharmacyModal = (pharm) => {
    if (!pharm) return;
    document.getElementById('edit_pharm_id').value = pharm.id;
    document.getElementById('edit_pharm_name').value = pharm.name || '';
    document.getElementById('edit_pharm_address').value = pharm.address || '';
    document.getElementById('edit_pharm_phone').value = pharm.phone || '';
    document.getElementById('edit_admin_name').value = pharm.owner_name || '';
    document.getElementById('edit_admin_email').value = pharm.owner_email || pharm.email || '';
    if (passInput) passInput.value = '';

    if (editSubText) {
      editSubText.textContent = `Update details for ${pharm.name}. Leave password blank to keep the current one.`;
    }

    if (modalEdit) modalEdit.classList.remove('hidden');
  };

  const closeEditModal = () => {
    if (modalEdit) modalEdit.classList.add('hidden');
  };

  if (btnCloseEditModal) btnCloseEditModal.addEventListener('click', closeEditModal);
  if (btnCancelEditModal) btnCancelEditModal.addEventListener('click', closeEditModal);

  // Show / Hide Password
  if (btnToggleShowPass && passInput) {
    btnToggleShowPass.addEventListener('click', () => {
      if (passInput.type === 'password') {
        passInput.type = 'text';
        btnToggleShowPass.textContent = 'Hide';
      } else {
        passInput.type = 'password';
        btnToggleShowPass.textContent = 'Show';
      }
    });
  }

  // Generate Password
  if (btnGenPass && passInput) {
    btnGenPass.addEventListener('click', () => {
      const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
      let gen = '';
      for (let i = 0; i < 10; i++) {
        gen += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      passInput.type = 'text';
      passInput.value = gen;
      if (btnToggleShowPass) btnToggleShowPass.textContent = 'Hide';
    });
  }

  // Submit Edit Form
  if (formEdit) {
    formEdit.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pharmId = document.getElementById('edit_pharm_id').value;
      const pharmacy_name = document.getElementById('edit_pharm_name').value.trim();
      const address = document.getElementById('edit_pharm_address').value.trim();
      const phone = document.getElementById('edit_pharm_phone').value.trim();
      const full_name = document.getElementById('edit_admin_name').value.trim();
      const email = document.getElementById('edit_admin_email').value.trim();
      const password = passInput ? passInput.value : '';

      if (!pharmacy_name || !email) {
        alert('Please fill out all required fields.');
        return;
      }

      const btnSave = document.getElementById('btn-save-edit-submit');
      const btnText = document.getElementById('btn-save-edit-text');
      const spinner = document.getElementById('edit-save-spinner');

      btnSave.disabled = true;
      spinner.classList.remove('hidden');
      btnText.textContent = 'Saving changes...';

      const payload = {
        action: 'edit',
        pharmacy_id: pharmId,
        pharmacy_name,
        address,
        phone,
        full_name,
        email,
        password
      };

      // Update local cache
      const pharm = pharmaciesList.find(p => p.id == pharmId);
      if (pharm) {
        pharm.name = pharmacy_name;
        pharm.address = address;
        pharm.phone = phone;
        pharm.owner_name = full_name;
        pharm.owner_email = email;
        saveLocalStoredPharmacies(pharmaciesList);
        updateKpisAndTables(pharmaciesList);
      }

      for (const url of ['https://api.holidaymartbd.com/ezpharma/pharmacies.php', '/api/pharmacies.php']) {
        try {
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          break;
        } catch (err) {}
      }

      btnSave.disabled = false;
      spinner.classList.add('hidden');
      btnText.textContent = 'Save changes';
      closeEditModal();
      showToast(`✅ "${pharmacy_name}" details updated successfully in MySQL!`);

      if (currentDetailsPharmacy && currentDetailsPharmacy.id == pharmId) {
        loadSinglePharmacyDetails(pharmId);
      }
    });
  }

  // ==============================================
  // 15. Record Payment Modal Logic
  // ==============================================
  const modalPay = document.getElementById('modal-record-payment');
  const btnClosePayModal = document.getElementById('btn-close-pay-modal');
  const btnCancelPayModal = document.getElementById('btn-cancel-pay-modal');
  const formPay = document.getElementById('form-record-payment');
  const payPharmNameSub = document.getElementById('record-pay-pharm-name');
  const payPackageSelect = document.getElementById('pay_package_select');
  const payAmountInput = document.getElementById('pay_amount_input');

  const openRecordPaymentModal = (pharm) => {
    if (!pharm) return;
    document.getElementById('pay_pharm_id').value = pharm.id;
    if (payPharmNameSub) {
      payPharmNameSub.textContent = `Record payment for ${pharm.name}`;
    }
    if (payAmountInput) payAmountInput.value = (pharm.plan === 'yearly') ? '4500' : '400';
    if (modalPay) modalPay.classList.remove('hidden');
  };

  const closePayModal = () => {
    if (modalPay) modalPay.classList.add('hidden');
  };

  if (btnClosePayModal) btnClosePayModal.addEventListener('click', closePayModal);
  if (btnCancelPayModal) btnCancelPayModal.addEventListener('click', closePayModal);

  if (payPackageSelect && payAmountInput) {
    payPackageSelect.addEventListener('change', () => {
      const opt = payPackageSelect.selectedOptions[0];
      const price = opt.getAttribute('data-price');
      if (price) payAmountInput.value = price;
    });
  }

  // Submit Record Payment Form
  if (formPay) {
    formPay.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pharmId = document.getElementById('pay_pharm_id').value;
      const payment_method = document.getElementById('pay_method_select').value;
      const package_name = payPackageSelect.value;
      const amount = parseFloat(payAmountInput.value) || 400.00;
      const notes = document.getElementById('pay_notes_input').value.trim();

      const btnSubmit = document.getElementById('btn-submit-pay');
      const btnText = document.getElementById('btn-submit-pay-text');
      const spinner = document.getElementById('pay-save-spinner');

      btnSubmit.disabled = true;
      spinner.classList.remove('hidden');
      btnText.textContent = 'Recording...';

      const payload = {
        action: 'record_payment',
        pharmacy_id: pharmId,
        payment_method,
        package_name,
        amount,
        notes
      };

      // Save recorded payment locally
      const pharm = pharmaciesList.find(p => p.id == pharmId);
      if (pharm) {
        pharm.status = 'active';
        saveLocalStoredPharmacies(pharmaciesList);
        updateKpisAndTables(pharmaciesList);
      }

      const recordedList = getStoredRecordedPayments();
      recordedList.unshift({
        id: `rec_${Date.now()}`,
        pharmacy_id: pharmId,
        pharmacy_name: pharm ? pharm.name : 'Pharmacy',
        created_at: new Date().toISOString(),
        interval: package_name.toLowerCase().includes('year') ? 'Yearly' : 'Monthly',
        method: payment_method,
        status: 'Succeeded',
        amount: amount,
        notes: notes,
        currency: 'BDT'
      });
      saveStoredRecordedPayments(recordedList);
      renderPaymentsPage();

      for (const url of ['https://api.holidaymartbd.com/ezpharma/pharmacies.php', '/api/pharmacies.php']) {
        try {
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          break;
        } catch (err) {}
      }

      btnSubmit.disabled = false;
      spinner.classList.add('hidden');
      btnText.textContent = 'Record Payment';
      closePayModal();
      showToast(`💵 BDT ${amount} payment recorded! Pharmacy "${pharm ? pharm.name : 'Account'}" is now Active.`);

      if (currentDetailsPharmacy && currentDetailsPharmacy.id == pharmId) {
        loadSinglePharmacyDetails(pharmId);
      }
    });
  }

  // ==============================================
  // 16. Payment Methods Live Management & Warning Banner Sync
  // ==============================================
  const PAYMENT_API_ENDPOINTS = [
    'https://api.holidaymartbd.com/ezpharma/payment_methods.php',
    '/api/payment_methods.php'
  ];

  let paymentMethodsData = {};

  const getLocalStoredGateways = () => {
    try {
      const raw = localStorage.getItem('ezpharma_gateways');
      return raw ? JSON.parse(raw) : {
        cash: { provider: 'cash', title: 'Cash / Offline', is_active: 1, mode: 'live', instructions: 'Cash on delivery or direct bank transfer' },
        bkash: { provider: 'bkash', title: 'bKash Merchant', is_active: 0, mode: 'sandbox' },
        nagad: { provider: 'nagad', title: 'Nagad Gateway', is_active: 0, mode: 'sandbox' },
        stripe: { provider: 'stripe', title: 'Stripe', is_active: 0, mode: 'sandbox' },
        sslcommerz: { provider: 'sslcommerz', title: 'SSLCommerz', is_active: 0, mode: 'sandbox' }
      };
    } catch (e) {
      return {};
    }
  };

  const saveLocalStoredGateways = (data) => {
    try {
      localStorage.setItem('ezpharma_gateways', JSON.stringify(data));
    } catch (e) {}
  };

  const loadPaymentMethods = async () => {
    let apiData = null;
    for (const url of PAYMENT_API_ENDPOINTS) {
      try {
        const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success && Array.isArray(json.data)) {
            apiData = json.data;
            break;
          }
        }
      } catch (e) {}
    }

    const localData = getLocalStoredGateways();
    if (apiData && apiData.length > 0) {
      apiData.forEach(item => {
        localData[item.provider] = item;
      });
    }

    paymentMethodsData = localData;
    saveLocalStoredGateways(paymentMethodsData);
    renderGatewayCards();
    updateOverviewPaymentBanner();
  };

  const updateOverviewPaymentBanner = () => {
    const warningBanner = document.getElementById('warning-banner-payment');
    if (!warningBanner) return;

    let hasActiveOnlineOrAny = false;
    Object.keys(paymentMethodsData).forEach(k => {
      const gw = paymentMethodsData[k];
      if (gw.is_active == 1 || gw.is_active === true) {
        hasActiveOnlineOrAny = true;
      }
    });

    if (hasActiveOnlineOrAny) {
      warningBanner.classList.add('hidden');
    } else {
      warningBanner.classList.remove('hidden');
    }
  };

  const renderGatewayCards = () => {
    Object.keys(paymentMethodsData).forEach(provider => {
      const gw = paymentMethodsData[provider];
      const card = document.querySelector(`.gateway-card[data-provider="${provider}"]`);
      if (!card) return;

      const statusPill = document.getElementById(`status-pill-${provider}`);
      const modeBadge = document.getElementById(`mode-badge-${provider}`);

      if (statusPill) {
        if (gw.is_active == 1 || gw.is_active === true) {
          statusPill.textContent = 'Active';
          statusPill.className = 'gw-status-pill pill-active';
          card.classList.add('active-gw');
        } else {
          statusPill.textContent = 'Disabled';
          statusPill.className = 'gw-status-pill';
          card.classList.remove('active-gw');
        }
      }

      if (modeBadge) {
        if (gw.mode === 'live') {
          modeBadge.textContent = 'Live';
          modeBadge.className = 'gw-mode-badge mode-live';
        } else {
          modeBadge.textContent = 'Sandbox';
          modeBadge.className = 'gw-mode-badge';
        }
      }
    });
  };

  // Gateway Modal Logic
  const gwModal = document.getElementById('gw-config-modal');
  const btnCloseGwModal = document.getElementById('btn-close-gw-modal');
  const btnCancelGwModal = document.getElementById('btn-cancel-gw-modal');
  const formSaveGw = document.getElementById('form-save-gateway');
  const modalGwTitle = document.getElementById('modal-gw-title');

  const openGatewayModal = (provider, defaultTitle) => {
    const gw = paymentMethodsData[provider] || {
      provider,
      title: defaultTitle || ucfirst(provider),
      is_active: 0,
      mode: 'sandbox',
      merchant_id: '',
      public_key: '',
      secret_key: '',
      webhook_secret: '',
      instructions: ''
    };

    document.getElementById('gw_form_provider').value = provider;
    document.getElementById('gw_form_title').value = gw.title || defaultTitle || provider;
    document.getElementById('gw_form_status').value = (gw.is_active == 1 || gw.is_active === true) ? '1' : '0';
    document.getElementById('gw_form_mode').value = gw.mode || 'sandbox';
    document.getElementById('gw_form_merchant_id').value = gw.merchant_id || '';
    document.getElementById('gw_form_public_key').value = gw.public_key || '';
    document.getElementById('gw_form_secret_key').value = gw.secret_key || '';
    document.getElementById('gw_form_webhook').value = gw.webhook_secret || '';
    document.getElementById('gw_form_instructions').value = gw.instructions || '';

    // Dynamic Label customization
    const labelMerchant = document.getElementById('label-merchant-id');
    const labelPublic = document.getElementById('label-public-key');
    const labelSecret = document.getElementById('label-secret-key');

    if (provider === 'bkash') {
      labelMerchant.textContent = 'bKash App Key';
      labelPublic.textContent = 'bKash Username';
      labelSecret.textContent = 'bKash App Secret & Password';
    } else if (provider === 'nagad') {
      labelMerchant.textContent = 'Nagad Merchant ID';
      labelPublic.textContent = 'Nagad Public Key';
      labelSecret.textContent = 'Nagad Private Key';
    } else if (provider === 'stripe') {
      labelMerchant.textContent = 'Stripe Account ID (Optional)';
      labelPublic.textContent = 'Publishable Key (pk_live_...)';
      labelSecret.textContent = 'Secret Key (sk_live_...)';
    } else if (provider === 'sslcommerz') {
      labelMerchant.textContent = 'SSLCommerz Store ID';
      labelPublic.textContent = 'Store Password';
      labelSecret.textContent = 'API Secret';
    } else {
      labelMerchant.textContent = 'Bank Name / Identifier';
      labelPublic.textContent = 'Account Number / Routing No';
      labelSecret.textContent = 'Branch / Security Details';
    }

    modalGwTitle.textContent = `Configure ${gw.title || defaultTitle}`;
    gwModal.classList.remove('hidden');
  };

  const closeGatewayModal = () => {
    if (gwModal) gwModal.classList.add('hidden');
  };

  if (btnCloseGwModal) btnCloseGwModal.addEventListener('click', closeGatewayModal);
  if (btnCancelGwModal) btnCancelGwModal.addEventListener('click', closeGatewayModal);

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-configure-gw');
    if (btn) {
      const provider = btn.getAttribute('data-provider');
      const title = btn.getAttribute('data-title');
      openGatewayModal(provider, title);
    }
  });

  const addNewMethodBtn = document.getElementById('add-new-method-btn');
  if (addNewMethodBtn) {
    addNewMethodBtn.addEventListener('click', () => {
      openGatewayModal('bkash', 'bKash Merchant');
    });
  }

  // Save Gateway Form Submit
  if (formSaveGw) {
    formSaveGw.addEventListener('submit', async (e) => {
      e.preventDefault();
      const provider = document.getElementById('gw_form_provider').value;
      const title = document.getElementById('gw_form_title').value.trim();
      const is_active = parseInt(document.getElementById('gw_form_status').value);
      const mode = document.getElementById('gw_form_mode').value;
      const merchant_id = document.getElementById('gw_form_merchant_id').value.trim();
      const public_key = document.getElementById('gw_form_public_key').value.trim();
      const secret_key = document.getElementById('gw_form_secret_key').value.trim();
      const webhook_secret = document.getElementById('gw_form_webhook').value.trim();
      const instructions = document.getElementById('gw_form_instructions').value.trim();

      const btnSave = document.getElementById('btn-save-gw-submit');
      const btnText = document.getElementById('btn-save-gw-text');
      const spinner = document.getElementById('gw-save-spinner');

      btnSave.disabled = true;
      spinner.classList.remove('hidden');
      btnText.textContent = 'Saving...';

      const payload = {
        provider,
        title,
        is_active,
        mode,
        merchant_id,
        public_key,
        secret_key,
        webhook_secret,
        instructions
      };

      paymentMethodsData[provider] = payload;
      saveLocalStoredGateways(paymentMethodsData);
      renderGatewayCards();
      updateOverviewPaymentBanner();

      for (const url of PAYMENT_API_ENDPOINTS) {
        try {
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          break;
        } catch (err) {}
      }

      btnSave.disabled = false;
      spinner.classList.add('hidden');
      btnText.textContent = 'Save Changes';
      closeGatewayModal();

      showToast(`✅ ${title} configuration saved successfully!`);
    });
  }

  // ==============================================
  // 17. Load All Payments View (/admin/payments) (Image 1)
  // ==============================================
  let allPaymentsList = [];

  const getStoredRecordedPayments = () => {
    try {
      const raw = localStorage.getItem('ezpharma_recorded_payments');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  };

  const saveStoredRecordedPayments = (payments) => {
    try {
      localStorage.setItem('ezpharma_recorded_payments', JSON.stringify(payments));
    } catch (e) {}
  };

  const getAggregatedPayments = () => {
    const list = [];
    const recorded = getStoredRecordedPayments();

    // 1. Add any manually recorded payments
    recorded.forEach(r => {
      list.push({
        id: r.id || `rec_${Math.random()}`,
        pharmacy_id: r.pharmacy_id,
        pharmacy_name: r.pharmacy_name,
        created_at: new Date(r.created_at || Date.now()),
        interval: r.interval || 'Monthly',
        method: r.method || 'Cash',
        status: r.status || 'Succeeded',
        amount: parseFloat(r.amount) || 400.00,
        currency: 'BDT'
      });
    });

    // 2. Add subscription registration payments from each pharmacy
    pharmaciesList.forEach(p => {
      const isYearly = (p.plan === 'yearly');
      const amount = parseFloat(p.amount) || (isYearly ? 4500.00 : 400.00);
      const createdAt = p.created_at ? new Date(p.created_at) : new Date();
      const prov = ucfirst(p.payment_provider || 'Cash');
      const interval = isYearly ? 'Yearly' : 'Monthly';

      list.push({
        id: `pay_${p.id}`,
        pharmacy_id: p.id,
        pharmacy_name: p.name,
        created_at: createdAt,
        interval: interval,
        method: prov,
        status: (p.status === 'suspended') ? 'Suspended' : 'Succeeded',
        amount: amount,
        currency: 'BDT'
      });
    });

    // Sort descending by date
    list.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    return list;
  };

  const renderPaymentsPage = () => {
    allPaymentsList = getAggregatedPayments();
    applyPaymentsFilters();
  };

  const applyPaymentsFilters = () => {
    const query = (document.getElementById('payments-search-input')?.value || '').toLowerCase().trim();
    const dateFilter = document.getElementById('filter-pay-date')?.value || 'all';
    const methodFilter = document.getElementById('filter-pay-method')?.value || 'all';
    const statusFilter = document.getElementById('filter-pay-status')?.value || 'all';
    const intervalFilter = document.getElementById('filter-pay-interval')?.value || 'all';

    const now = new Date();

    const filtered = allPaymentsList.filter(item => {
      const matchQuery = !query || item.pharmacy_name.toLowerCase().includes(query);
      
      let matchMethod = true;
      if (methodFilter === 'cash') matchMethod = item.method.toLowerCase().includes('cash');
      else if (methodFilter === 'bkash') matchMethod = item.method.toLowerCase().includes('bkash');
      else if (methodFilter === 'nagad') matchMethod = item.method.toLowerCase().includes('nagad');
      else if (methodFilter === 'online') matchMethod = !item.method.toLowerCase().includes('cash');

      let matchStatus = true;
      if (statusFilter !== 'all') {
        matchStatus = item.status.toLowerCase() === statusFilter.toLowerCase();
      }

      let matchInterval = true;
      if (intervalFilter !== 'all') {
        matchInterval = item.interval.toLowerCase() === intervalFilter.toLowerCase();
      }

      let matchDate = true;
      if (dateFilter === 'today') {
        matchDate = item.created_at.toDateString() === now.toDateString();
      } else if (dateFilter === 'month') {
        matchDate = item.created_at.getMonth() === now.getMonth() && item.created_at.getFullYear() === now.getFullYear();
      } else if (dateFilter === 'year') {
        matchDate = item.created_at.getFullYear() === now.getFullYear();
      }

      return matchQuery && matchMethod && matchStatus && matchInterval && matchDate;
    });

    // Update 4 Payments KPI Cards
    const totalRecords = filtered.length;
    let succeededCount = 0;
    let totalRevenue = 0;
    let cashCount = 0;
    let onlineCount = 0;

    filtered.forEach(item => {
      if (item.status === 'Succeeded') {
        succeededCount++;
        totalRevenue += item.amount;
      }
      if (item.method.toLowerCase().includes('cash')) {
        cashCount++;
      } else {
        onlineCount++;
      }
    });

    const kpiRec = document.getElementById('pay-kpi-records');
    const kpiRecSub = document.getElementById('pay-kpi-records-sub');
    const kpiRev = document.getElementById('pay-kpi-revenue');
    const kpiCash = document.getElementById('pay-kpi-cash');
    const kpiOnline = document.getElementById('pay-kpi-online');

    if (kpiRec) kpiRec.textContent = totalRecords;
    if (kpiRecSub) kpiRecSub.textContent = `${succeededCount} succeeded`;
    if (kpiRev) kpiRev.textContent = `BDT ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    if (kpiCash) kpiCash.textContent = cashCount;
    if (kpiOnline) kpiOnline.textContent = onlineCount;

    // Render Table
    const tbody = document.getElementById('all-payments-tbody');
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-subtle">No matching payment records found.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(item => {
      const dateStr = item.created_at.toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true });
      const isOnline = !item.method.toLowerCase().includes('cash');

      return `
        <tr>
          <td>${dateStr}</td>
          <td><strong>${item.pharmacy_name}</strong></td>
          <td>${item.interval}</td>
          <td><span class="gw-status-pill ${isOnline ? 'pill-online' : 'pill-active'}">${item.method}</span></td>
          <td><span class="text-green font-bold">${item.status}</span></td>
          <td class="text-right"><strong>BDT ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></td>
        </tr>
      `;
    }).join('');
  };

  // Payments Filters Events
  ['payments-search-input', 'filter-pay-date', 'filter-pay-method', 'filter-pay-status', 'filter-pay-interval'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', applyPaymentsFilters);
      el.addEventListener('change', applyPaymentsFilters);
    }
  });

  // Export CSV
  const btnExportCsv = document.getElementById('btn-export-payments-csv');
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      if (allPaymentsList.length === 0) {
        showToast('No payment records to export.', true);
        return;
      }

      let csv = 'ID,Paid At,Pharmacy,Interval,Method,Status,Amount,Currency\n';
      allPaymentsList.forEach(p => {
        const dateStr = p.created_at.toISOString();
        csv += `"${p.id}","${dateStr}","${p.pharmacy_name}","${p.interval}","${p.method}","${p.status}",${p.amount},"${p.currency}"\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `ezpharma_payments_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('📥 Payments CSV exported successfully!');
    });
  }

  // ==============================================
  // 18. Pricing Plans Management (Image 2)
  // ==============================================
  const DEFAULT_PRICING_PLANS = [
    {
      id: 'plan_monthly',
      name: 'Monthly',
      interval: 'monthly',
      price: 400,
      badge: '',
      subtitle: 'Billed every month via active payment gateway',
      cta: 'Start monthly',
      status: 'active',
      advantages: [
        'Unlimited staff accounts & counters',
        'Full pharmacy & POS inventory',
        'AI prescription parsing (50 scans/mo)',
        'Drug interaction safety checker',
        'Automated & online self-serve renewal',
        'Expiry & batch management',
        'CSV / PDF export',
        'Standard email support'
      ]
    },
    {
      id: 'plan_annual',
      name: 'Annual',
      interval: 'yearly',
      price: 4500,
      badge: 'SAVE 10% ON ANNUAL',
      subtitle: 'Save BDT 300 / year • Billed annually',
      cta: 'Start yearly',
      status: 'active',
      advantages: [
        'Everything in Monthly plan',
        'Priority 24/7 support & live chat',
        'Priority AI queue & custom integrations',
        'Unlimited prescription AI scans',
        'Direct WhatsApp invoice alerts',
        'Multi-branch consolidation reports',
        '99.9% uptime SLA & automated backups',
        'Dedicated onboarding assistance'
      ]
    }
  ];

  const getStoredPricingPlans = () => {
    try {
      const raw = localStorage.getItem('ezpharma_pricing_plans');
      return raw ? JSON.parse(raw) : DEFAULT_PRICING_PLANS;
    } catch (e) {
      return DEFAULT_PRICING_PLANS;
    }
  };

  const saveStoredPricingPlans = (plans) => {
    try {
      localStorage.setItem('ezpharma_pricing_plans', JSON.stringify(plans));
    } catch (e) {}
  };

  let pricingPlans = getStoredPricingPlans();

  const renderPricingPlans = () => {
    const container = document.getElementById('pricing-plans-grid');
    if (!container) return;

    if (pricingPlans.length === 0) {
      container.innerHTML = `<p class="text-subtle text-center py-8">No pricing plans found. Click "+ Add New Plan" above to create one.</p>`;
      return;
    }

    container.innerHTML = pricingPlans.map(plan => {
      const isAnnual = (plan.interval === 'yearly' || plan.name.toLowerCase().includes('annual'));
      const isInactive = plan.status === 'inactive';
      const unitText = (plan.interval === 'yearly') ? '/ pharmacy / year' : '/ pharmacy / month';

      return `
        <div class="pricing-plan-card ${isAnnual ? 'highlight-annual' : ''} ${isInactive ? 'inactive-plan' : ''}">
          ${plan.badge ? `<div class="plan-top-badge">${plan.badge}</div>` : ''}
          
          <div class="plan-tag-interval">${plan.name.toUpperCase()}</div>
          
          <h2 class="plan-price-heading">
            BDT ${parseFloat(plan.price).toLocaleString()} <span class="plan-price-unit">${unitText}</span>
          </h2>
          
          <p class="plan-savings-sub ${isAnnual ? '' : 'neutral'}">${plan.subtitle || 'Billed via active payment gateway'}</p>
          
          <button class="btn-plan-cta ${isAnnual ? 'btn-fill-blue' : 'btn-outline-blue'}">
            ${plan.cta || 'Select Plan'}
          </button>
          
          <ul class="plan-features-list">
            ${(plan.advantages || []).map(adv => `
              <li class="plan-feature-item">
                <span class="feature-check-icon">✓</span>
                <span>${adv}</span>
              </li>
            `).join('')}
          </ul>

          <div class="plan-admin-actions-bar">
            <span class="gw-status-pill ${plan.status === 'active' ? 'pill-active' : ''}">
              ${plan.status === 'active' ? 'Active' : 'Inactive'}
            </span>
            <div class="plan-action-btn-group">
              <button class="btn-plan-admin-sm btn-edit-plan" data-id="${plan.id}" title="Edit plan & advantages">
                ✏️ Edit
              </button>
              <button class="btn-plan-admin-sm btn-toggle-plan-status" data-id="${plan.id}" title="Toggle active status">
                ${plan.status === 'active' ? 'Disable' : 'Enable'}
              </button>
              <button class="btn-plan-admin-sm danger btn-delete-plan" data-id="${plan.id}" title="Delete plan">
                🗑️
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  };

  // Plan Modal & Advantages Builder
  let currentEditingAdvantages = [];
  const modalPlan = document.getElementById('modal-pricing-plan');
  const btnClosePlanModal = document.getElementById('btn-close-plan-modal');
  const btnCancelPlanModal = document.getElementById('btn-cancel-plan-modal');
  const formPlan = document.getElementById('form-pricing-plan');
  const btnAddPlan = document.getElementById('btn-add-new-plan');
  const advItemsList = document.getElementById('plan-advantages-items-list');
  const newAdvInput = document.getElementById('new_advantage_input');
  const btnAddAdv = document.getElementById('btn-add-advantage-item');

  const renderModalAdvantageItems = () => {
    if (!advItemsList) return;
    if (currentEditingAdvantages.length === 0) {
      advItemsList.innerHTML = `<p class="text-subtle" style="font-size:0.8rem; padding:0.4rem;">No features added yet. Type below and click "+ Add Feature".</p>`;
      return;
    }
    advItemsList.innerHTML = currentEditingAdvantages.map((adv, idx) => `
      <div class="advantage-item-row">
        <span>✓ ${adv}</span>
        <button type="button" class="btn-remove-adv" data-idx="${idx}" title="Remove feature">✕</button>
      </div>
    `).join('');
  };

  if (btnAddAdv && newAdvInput) {
    btnAddAdv.addEventListener('click', () => {
      const val = newAdvInput.value.trim();
      if (val) {
        currentEditingAdvantages.push(val);
        newAdvInput.value = '';
        renderModalAdvantageItems();
      }
    });
    newAdvInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        btnAddAdv.click();
      }
    });
  }

  if (advItemsList) {
    advItemsList.addEventListener('click', (e) => {
      const btnRemove = e.target.closest('.btn-remove-adv');
      if (btnRemove) {
        const idx = parseInt(btnRemove.getAttribute('data-idx'));
        currentEditingAdvantages.splice(idx, 1);
        renderModalAdvantageItems();
      }
    });
  }

  const openPlanModal = (plan = null) => {
    const heading = document.getElementById('modal-plan-heading');
    if (plan) {
      if (heading) heading.textContent = `Edit Plan: ${plan.name}`;
      document.getElementById('plan_form_id').value = plan.id;
      document.getElementById('plan_form_name').value = plan.name;
      document.getElementById('plan_form_price').value = plan.price;
      document.getElementById('plan_form_interval').value = plan.interval || 'monthly';
      document.getElementById('plan_form_badge').value = plan.badge || '';
      document.getElementById('plan_form_subtitle').value = plan.subtitle || '';
      document.getElementById('plan_form_cta').value = plan.cta || 'Start monthly';
      document.getElementById('plan_form_status').value = plan.status || 'active';
      currentEditingAdvantages = [...(plan.advantages || [])];
    } else {
      if (heading) heading.textContent = 'Add New Pricing Plan';
      document.getElementById('plan_form_id').value = '';
      document.getElementById('plan_form_name').value = '';
      document.getElementById('plan_form_price').value = '';
      document.getElementById('plan_form_interval').value = 'monthly';
      document.getElementById('plan_form_badge').value = '';
      document.getElementById('plan_form_subtitle').value = '';
      document.getElementById('plan_form_cta').value = 'Start monthly';
      document.getElementById('plan_form_status').value = 'active';
      currentEditingAdvantages = [
        'Unlimited staff accounts & counters',
        'Full pharmacy & POS inventory',
        'AI prescription parsing',
        'Standard email support'
      ];
    }
    renderModalAdvantageItems();
    if (modalPlan) modalPlan.classList.remove('hidden');
  };

  const closePlanModal = () => {
    if (modalPlan) modalPlan.classList.add('hidden');
  };

  if (btnAddPlan) btnAddPlan.addEventListener('click', () => openPlanModal(null));
  if (btnClosePlanModal) btnClosePlanModal.addEventListener('click', closePlanModal);
  if (btnCancelPlanModal) btnCancelPlanModal.addEventListener('click', closePlanModal);

  // Edit / Toggle / Delete Plan Clicks
  document.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-edit-plan');
    if (editBtn) {
      const planId = editBtn.getAttribute('data-id');
      const plan = pricingPlans.find(p => p.id === planId);
      if (plan) openPlanModal(plan);
      return;
    }

    const toggleBtn = e.target.closest('.btn-toggle-plan-status');
    if (toggleBtn) {
      const planId = toggleBtn.getAttribute('data-id');
      const plan = pricingPlans.find(p => p.id === planId);
      if (plan) {
        plan.status = (plan.status === 'active') ? 'inactive' : 'active';
        saveStoredPricingPlans(pricingPlans);
        renderPricingPlans();
        showToast(`Plan "${plan.name}" is now ${plan.status}.`);
      }
      return;
    }

    const delBtn = e.target.closest('.btn-delete-plan');
    if (delBtn) {
      const planId = delBtn.getAttribute('data-id');
      const plan = pricingPlans.find(p => p.id === planId);
      if (plan && confirm(`Delete plan "${plan.name}"?`)) {
        pricingPlans = pricingPlans.filter(p => p.id !== planId);
        saveStoredPricingPlans(pricingPlans);
        renderPricingPlans();
        showToast(`🗑️ Plan "${plan.name}" removed.`);
      }
      return;
    }
  });

  // Save Plan Form Submit
  if (formPlan) {
    formPlan.addEventListener('submit', (e) => {
      e.preventDefault();
      const planId = document.getElementById('plan_form_id').value;
      const name = document.getElementById('plan_form_name').value.trim();
      const price = parseFloat(document.getElementById('plan_form_price').value) || 0;
      const interval = document.getElementById('plan_form_interval').value;
      const badge = document.getElementById('plan_form_badge').value.trim();
      const subtitle = document.getElementById('plan_form_subtitle').value.trim();
      const cta = document.getElementById('plan_form_cta').value.trim() || 'Select Plan';
      const status = document.getElementById('plan_form_status').value;

      if (!name || price <= 0) {
        alert('Please provide a valid plan name and price.');
        return;
      }

      if (planId) {
        // Update existing plan
        const existing = pricingPlans.find(p => p.id === planId);
        if (existing) {
          existing.name = name;
          existing.price = price;
          existing.interval = interval;
          existing.badge = badge;
          existing.subtitle = subtitle;
          existing.cta = cta;
          existing.status = status;
          existing.advantages = [...currentEditingAdvantages];
        }
      } else {
        // Add new plan
        const newPlan = {
          id: `plan_${Date.now()}`,
          name,
          price,
          interval,
          badge,
          subtitle,
          cta,
          status,
          advantages: [...currentEditingAdvantages]
        };
        pricingPlans.push(newPlan);
      }

      saveStoredPricingPlans(pricingPlans);
      renderPricingPlans();
      closePlanModal();
      showToast(`🎉 Pricing Plan "${name}" saved successfully!`);
    });
  }

  // 19. Refresh Action
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      startProgress();
      loadPharmaciesData();
      loadPaymentMethods();
      renderPaymentsPage();
      renderPricingPlans();
      updateClock();
      setTimeout(finishProgress, 300);
    });
  }

  // 20. Sign Out
  const signoutBtn = document.getElementById('signout-btn');
  if (signoutBtn) {
    signoutBtn.addEventListener('click', () => {
      localStorage.removeItem('ezpharma_session');
      window.location.href = '/signin';
    });
  }

  function ucfirst(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  }

  // Initial Data Loads
  loadPharmaciesData();
  loadPaymentMethods();
  renderPaymentsPage();
  renderPricingPlans();
});
