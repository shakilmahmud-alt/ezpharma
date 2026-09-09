// EZ Pharma - Pharmacy Admin Dashboard Logic
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

  // 2. Populate Dynamic Pharmacy Session Data
  let sessionData = null;
  const sessionStr = localStorage.getItem('ezpharma_session');
  const pharmacyStr = localStorage.getItem('ezpharma_current_pharmacy');

  if (sessionStr) {
    try {
      sessionData = JSON.parse(sessionStr);
    } catch (e) {}
  }

  let currentPharm = null;
  if (pharmacyStr) {
    try {
      currentPharm = JSON.parse(pharmacyStr);
    } catch (e) {}
  }

  // Fallback to demo pharmacy if empty
  if (!sessionData) {
    sessionData = {
      full_name: 'Pharmacy Admin',
      email: 'admin@pharmacy.com',
      role: 'pharmacy_admin',
      pharmacy_name: 'Demo Pharmacy',
      status: 'active'
    };
  }

  const pharmacyId = (currentPharm && currentPharm.id) || sessionData.pharmacy_id || 1;
  let savedSettings = null;
  try {
    const rawSettings = localStorage.getItem(`ezpharma_settings_pharm_${pharmacyId}`);
    if (rawSettings) savedSettings = JSON.parse(rawSettings);
  } catch (e) {}

  let pharmName = (savedSettings && savedSettings.business_name) || (currentPharm && currentPharm.name) || sessionData.pharmacy_name || 'Demo Pharmacy';
  const userName = sessionData.full_name || 'Pharmacy Admin';
  const userDisplay = document.getElementById('admin-user-display');
  const pharmacyDisplay = document.getElementById('display-pharmacy-name');
  const bannerPharmacyTitle = document.getElementById('banner-pharmacy-title');

  if (userDisplay) userDisplay.textContent = userName;
  if (pharmacyDisplay) pharmacyDisplay.textContent = pharmName;
  if (bannerPharmacyTitle) bannerPharmacyTitle.textContent = pharmName;

  const updatePharmacyBrandName = (newName) => {
    if (!newName) return;
    pharmName = newName;
    if (pharmacyDisplay) pharmacyDisplay.textContent = newName;
    if (bannerPharmacyTitle) bannerPharmacyTitle.textContent = newName;
    sessionData.pharmacy_name = newName;
    try { localStorage.setItem('ezpharma_session', JSON.stringify(sessionData)); } catch (e) {}
    if (currentPharm) {
      currentPharm.name = newName;
      try { localStorage.setItem('ezpharma_current_pharmacy', JSON.stringify(currentPharm)); } catch (e) {}
    }
  };

  // 3. Payment Status & Read-Only Enforcement
  let isPendingPayment = false;
  if (currentPharm && (currentPharm.status === 'pending_payment' || currentPharm.status === 'pending')) {
    isPendingPayment = true;
  } else if (sessionData.status === 'pending_payment' || sessionData.payment_status === 'pending_payment') {
    isPendingPayment = true;
  }

  // Cross check against registered pharmacies list
  try {
    const rawList = localStorage.getItem('ezpharma_local_pharmacies');
    if (rawList) {
      const list = JSON.parse(rawList);
      const match = list.find(p => (currentPharm && p.id == currentPharm.id) || p.name === pharmName || (sessionData.email && p.owner_email === sessionData.email));
      if (match) {
        if (match.status === 'active' || match.status === 'paid') {
          isPendingPayment = false;
        } else if (match.status === 'pending_payment') {
          isPendingPayment = true;
        }
      }
    }
  } catch (e) {}

  const noticeBanner = document.getElementById('dashboard-payment-notice');
  if (noticeBanner) {
    if (isPendingPayment) {
      noticeBanner.classList.remove('hidden');
    } else {
      noticeBanner.classList.add('hidden');
    }
  }

  const enforceReadOnly = (actionName) => {
    if (isPendingPayment) {
      showToast(`⚠️ Read-Only Mode: "${actionName}" is disabled until payment is recorded for ${pharmName}.`, true);
      return true;
    }
    return false;
  };

  // 4. Live Clock in Header
  const liveClock = document.getElementById('live-clock');
  const updateClock = () => {
    if (liveClock) {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      liveClock.textContent = `${dateStr} ${timeStr}`;
    }
  };
  updateClock();
  setInterval(updateClock, 1000);

  // 5. Toast Notification
  const toast = document.getElementById('toast-notification');
  const showToast = (msg, isError = false) => {
    if (!toast) return;
    toast.textContent = msg;
    toast.style.background = isError ? '#ef4444' : '#10b981';
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3500);
  };

  // Reusable Project Theme Confirmation Dialog
  const showConfirmDialog = ({ title = 'Delete Confirmation', message = 'Are you sure you want to proceed?', confirmText = 'Delete', isDanger = true }) => {
    return new Promise((resolve) => {
      const modal = document.getElementById('modal-confirm-dialog');
      const titleEl = document.getElementById('confirm-modal-title');
      const msgEl = document.getElementById('confirm-modal-message');
      const btnProceed = document.getElementById('btn-confirm-proceed');
      const btnProceedText = document.getElementById('confirm-btn-text');
      const btnCancel = document.getElementById('btn-confirm-cancel');

      if (!modal) {
        resolve(window.confirm(message));
        return;
      }

      if (titleEl) titleEl.textContent = title;
      if (msgEl) msgEl.textContent = message;
      if (btnProceedText) btnProceedText.textContent = confirmText;
      if (btnProceed) {
        btnProceed.className = isDanger ? 'btn-confirm-danger' : 'btn-confirm-primary';
      }

      modal.classList.remove('hidden');

      const cleanup = () => {
        modal.classList.add('hidden');
        btnProceed?.removeEventListener('click', onConfirm);
        btnCancel?.removeEventListener('click', onCancel);
        modal.removeEventListener('click', onOverlayClick);
      };

      const onConfirm = (e) => {
        if (e) e.preventDefault();
        cleanup();
        resolve(true);
      };

      const onCancel = (e) => {
        if (e) e.preventDefault();
        cleanup();
        resolve(false);
      };

      const onOverlayClick = (e) => {
        if (e.target === modal) onCancel(e);
      };

      btnProceed?.addEventListener('click', onConfirm, { once: true });
      btnCancel?.addEventListener('click', onCancel, { once: true });
      modal.addEventListener('click', onOverlayClick, { once: true });
    });
  };

  const ucfirst = (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const escapeHtml = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // 6. Router & View Management (Clean URLs without #)
  const viewDashboardMain = document.getElementById('view-dashboard-main');
  const viewPos = document.getElementById('view-pos');
  const viewSalesHistory = document.getElementById('view-sales-history');
  const viewCashDrawer = document.getElementById('view-cash-drawer');
  const viewProductsCatalog = document.getElementById('view-products-catalog');
  const viewProductCategories = document.getElementById('view-product-categories');
  const viewProductManufacturers = document.getElementById('view-product-manufacturers');
  const viewStock = document.getElementById('view-stock');
  const viewStockBulkImport = document.getElementById('view-stock-bulk-import');
  const viewStockAlerts = document.getElementById('view-stock-alerts');
  const viewBulkImport = document.getElementById('view-bulk-import');
  const viewCustomers = document.getElementById('view-customers');
  const viewCustomerInsights = document.getElementById('view-customer-insights');
  const viewCustomerTiers = document.getElementById('view-customer-tiers');
  const viewSuppliers = document.getElementById('view-suppliers');
  const viewPurchaseOrders = document.getElementById('view-purchase-orders');
  const viewPharmacyUsers = document.getElementById('view-pharmacy-users');
  const viewPharmacyBilling = document.getElementById('view-pharmacy-billing');
  const viewSystemSettings = document.getElementById('view-system-settings');
  const viewReports = document.getElementById('view-reports');
  const viewExpenses = document.getElementById('view-expenses');
  const viewNotifications = document.getElementById('view-notifications');
  const viewProfile = document.getElementById('view-profile');
  
  const posGroup = document.getElementById('group-pos');
  const posParentBtn = document.getElementById('nav-item-pos-parent');
  const customersGroup = document.getElementById('group-customers');
  const customersParentBtn = document.getElementById('nav-item-customers');
  const inventoryGroup = document.getElementById('group-inventory');
  const inventoryParentBtn = document.getElementById('nav-item-inventory');
  const procurementGroup = document.getElementById('group-procurement');
  const procurementParentBtn = document.getElementById('nav-item-procurement');
  const financeGroup = document.getElementById('group-finance');
  const financeParentBtn = document.getElementById('nav-item-finance');
  const accountGroup = document.getElementById('group-account');
  const accountParentBtn = document.getElementById('nav-item-account');
  const adminGroup = document.getElementById('group-administration');
  const adminParentBtn = document.getElementById('nav-item-admin');

  const closeAllAccordions = () => {
    if (posGroup) posGroup.classList.remove('open');
    if (posParentBtn) {
      posParentBtn.classList.remove('active');
      posParentBtn.setAttribute('aria-expanded', 'false');
      posParentBtn.blur();
    }
    if (customersGroup) customersGroup.classList.remove('open');
    if (customersParentBtn) {
      customersParentBtn.classList.remove('active');
      customersParentBtn.setAttribute('aria-expanded', 'false');
      customersParentBtn.blur();
    }
    if (inventoryGroup) inventoryGroup.classList.remove('open');
    if (inventoryParentBtn) {
      inventoryParentBtn.classList.remove('active');
      inventoryParentBtn.setAttribute('aria-expanded', 'false');
      inventoryParentBtn.blur();
    }
    if (procurementGroup) procurementGroup.classList.remove('open');
    if (procurementParentBtn) {
      procurementParentBtn.classList.remove('active');
      procurementParentBtn.setAttribute('aria-expanded', 'false');
      procurementParentBtn.blur();
    }
    if (financeGroup) financeGroup.classList.remove('open');
    if (financeParentBtn) {
      financeParentBtn.classList.remove('active');
      financeParentBtn.setAttribute('aria-expanded', 'false');
      financeParentBtn.blur();
    }
    if (accountGroup) accountGroup.classList.remove('open');
    if (accountParentBtn) {
      accountParentBtn.classList.remove('active');
      accountParentBtn.setAttribute('aria-expanded', 'false');
      accountParentBtn.blur();
    }
    if (adminGroup) adminGroup.classList.remove('open');
    if (adminParentBtn) {
      adminParentBtn.classList.remove('active');
      adminParentBtn.setAttribute('aria-expanded', 'false');
      adminParentBtn.blur();
    }
  };

  // Top Progress Loader Bar (YouTube / NProgress style)
  let topLoaderTimeout = null;
  const startTopLoader = () => {
    const bar = document.getElementById('app-top-loading-bar');
    if (!bar) return;
    clearTimeout(topLoaderTimeout);
    bar.style.transition = 'none';
    bar.style.width = '0%';
    bar.style.opacity = '1';
    bar.classList.add('loading');

    // Force reflow
    void bar.offsetWidth;

    bar.style.transition = 'width 0.3s cubic-bezier(0.1, 0.9, 0.2, 1)';
    bar.style.width = '35%';

    topLoaderTimeout = setTimeout(() => {
      bar.style.transition = 'width 0.5s ease';
      bar.style.width = '75%';
    }, 120);
  };

  const finishTopLoader = () => {
    const bar = document.getElementById('app-top-loading-bar');
    if (!bar) return;
    clearTimeout(topLoaderTimeout);
    bar.style.transition = 'width 0.2s ease, opacity 0.25s ease 0.15s';
    bar.style.width = '100%';
    topLoaderTimeout = setTimeout(() => {
      bar.style.opacity = '0';
      setTimeout(() => {
        bar.classList.remove('loading');
        bar.style.width = '0%';
      }, 250);
    }, 150);
  };

  const navigateTo = async (path, updateHistory = true) => {
    startTopLoader();
    if (!path) path = '/dashboard';
    const clean = path.split('?')[0].split('#')[0].replace(/\/$/, '') || '/dashboard';

    // Remove any zero-flash prehide styles that may prevent views from displaying
    document.getElementById('style-dashboard-prehide')?.remove();

    // Hide all subviews
    if (viewDashboardMain) {
      viewDashboardMain.classList.add('hidden');
      viewDashboardMain.style.removeProperty('display');
    }
    if (viewPos) viewPos.classList.add('hidden');
    if (viewSalesHistory) viewSalesHistory.classList.add('hidden');
    if (viewCashDrawer) viewCashDrawer.classList.add('hidden');
    if (viewProductsCatalog) viewProductsCatalog.classList.add('hidden');
    if (viewProductCategories) viewProductCategories.classList.add('hidden');
    if (viewProductManufacturers) viewProductManufacturers.classList.add('hidden');
    if (viewStock) viewStock.classList.add('hidden');
    if (viewStockBulkImport) viewStockBulkImport.classList.add('hidden');
    if (viewStockAlerts) viewStockAlerts.classList.add('hidden');
    if (viewBulkImport) viewBulkImport.classList.add('hidden');
    if (viewCustomers) viewCustomers.classList.add('hidden');
    if (viewCustomerInsights) viewCustomerInsights.classList.add('hidden');
    if (viewCustomerTiers) viewCustomerTiers.classList.add('hidden');
    if (viewSuppliers) viewSuppliers.classList.add('hidden');
    if (viewPurchaseOrders) viewPurchaseOrders.classList.add('hidden');
    if (viewPharmacyUsers) viewPharmacyUsers.classList.add('hidden');
    if (viewPharmacyBilling) viewPharmacyBilling.classList.add('hidden');
    if (viewSystemSettings) viewSystemSettings.classList.add('hidden');
    if (viewReports) viewReports.classList.add('hidden');
    if (viewExpenses) viewExpenses.classList.add('hidden');
    if (viewNotifications) viewNotifications.classList.add('hidden');
    if (viewProfile) viewProfile.classList.add('hidden');

    // Reset active states
    document.querySelectorAll('.sidebar-menu .menu-item, .sidebar-menu button, .submenu-item').forEach(el => {
      el.classList.remove('active');
      el.blur();
    });

    // Control floating shortcut button visibility (POS Page Only - Image Match)
    const floatingShortcutBtn = document.getElementById('btn-open-pos-shortcuts');
    if ((clean.includes('/pos') || clean.endsWith('pos')) && !clean.includes('/sales-history') && !clean.includes('/cash-drawer')) {
      if (floatingShortcutBtn) floatingShortcutBtn.classList.remove('hidden');
    } else {
      if (floatingShortcutBtn) floatingShortcutBtn.classList.add('hidden');
    }

    if (clean.includes('/pos/sales-history') || clean.includes('/sales-history')) {
      if (viewSalesHistory) viewSalesHistory.classList.remove('hidden');
      closeAllAccordions();
      if (posGroup) posGroup.classList.add('open');
      if (posParentBtn) {
        posParentBtn.classList.add('active');
        posParentBtn.setAttribute('aria-expanded', 'true');
      }
      const shLink = document.getElementById('nav-item-sales-history');
      if (shLink) shLink.classList.add('active');
      await loadAndRenderSalesHistory(1);
    } else if (clean.includes('/pos/cash-drawer') || clean.includes('/cash-drawer')) {
      if (viewCashDrawer) viewCashDrawer.classList.remove('hidden');
      closeAllAccordions();
      if (posGroup) posGroup.classList.add('open');
      if (posParentBtn) {
        posParentBtn.classList.add('active');
        posParentBtn.setAttribute('aria-expanded', 'true');
      }
      const cdLink = document.getElementById('nav-item-cash-drawer');
      if (cdLink) cdLink.classList.add('active');
      await loadAndRenderCashDrawer();
    } else if (clean.includes('/pos') || clean.endsWith('pos')) {
      if (viewPos) viewPos.classList.remove('hidden');
      closeAllAccordions();
      if (posGroup) posGroup.classList.add('open');
      if (posParentBtn) {
        posParentBtn.classList.add('active');
        posParentBtn.setAttribute('aria-expanded', 'true');
      }
      const posLink = document.getElementById('nav-item-pos');
      if (posLink) posLink.classList.add('active');
      await initAndLoadPos();
    } else if (clean.includes('/customers/insights') || clean.includes('/customer-insights')) {
      if (viewCustomerInsights) viewCustomerInsights.classList.remove('hidden');
      closeAllAccordions();
      if (customersGroup) customersGroup.classList.add('open');
      if (customersParentBtn) {
        customersParentBtn.classList.add('active');
        customersParentBtn.setAttribute('aria-expanded', 'true');
      }
      const ciLink = document.getElementById('nav-item-customer-insights');
      if (ciLink) ciLink.classList.add('active');
      await loadAndRenderCustomerInsights();
    } else if (clean.includes('/customers/tiers') || clean.includes('/customer-tiers')) {
      if (viewCustomerTiers) viewCustomerTiers.classList.remove('hidden');
      closeAllAccordions();
      if (customersGroup) customersGroup.classList.add('open');
      if (customersParentBtn) {
        customersParentBtn.classList.add('active');
        customersParentBtn.setAttribute('aria-expanded', 'true');
      }
      const ctLink = document.getElementById('nav-item-customer-tiers');
      if (ctLink) ctLink.classList.add('active');
    } else if (clean.includes('/customers') || clean.endsWith('customers')) {
      if (viewCustomers) viewCustomers.classList.remove('hidden');
      closeAllAccordions();
      if (customersGroup) customersGroup.classList.add('open');
      if (customersParentBtn) {
        customersParentBtn.classList.add('active');
        customersParentBtn.setAttribute('aria-expanded', 'true');
      }
      const cLink = document.getElementById('nav-item-customers-list');
      if (cLink) cLink.classList.add('active');
      await loadAndRenderCustomers(1);
    } else if (clean.includes('/stock/bulk-import') || clean.includes('/stock-import') || clean.includes('/stock-bulk-import') || clean.includes('/inventory/bulk-import')) {
      if (viewStockBulkImport) viewStockBulkImport.classList.remove('hidden');
      closeAllAccordions();
      if (inventoryGroup) inventoryGroup.classList.add('open');
      if (inventoryParentBtn) {
        inventoryParentBtn.classList.add('active');
        inventoryParentBtn.setAttribute('aria-expanded', 'true');
      }
      const sLink = document.getElementById('nav-item-stock');
      if (sLink) sLink.classList.add('active');
    } else if (clean.includes('/products') || clean.endsWith('products')) {
      if (viewProductsCatalog) viewProductsCatalog.classList.remove('hidden');
      closeAllAccordions();
      if (inventoryGroup) inventoryGroup.classList.add('open');
      if (inventoryParentBtn) {
        inventoryParentBtn.classList.add('active');
        inventoryParentBtn.setAttribute('aria-expanded', 'true');
      }
      const pLink = document.getElementById('nav-item-products');
      if (pLink) pLink.classList.add('active');
      await loadAndRenderProducts(1);
    } else if (clean.includes('/categories') || clean.endsWith('categories')) {
      if (viewProductCategories) viewProductCategories.classList.remove('hidden');
      closeAllAccordions();
      if (inventoryGroup) inventoryGroup.classList.add('open');
      if (inventoryParentBtn) {
        inventoryParentBtn.classList.add('active');
        inventoryParentBtn.setAttribute('aria-expanded', 'true');
      }
      const cLink = document.getElementById('nav-item-categories');
      if (cLink) cLink.classList.add('active');
      await loadAndRenderCategories();
    } else if (clean.includes('/manufacturers') || clean.endsWith('manufacturers')) {
      if (viewProductManufacturers) viewProductManufacturers.classList.remove('hidden');
      closeAllAccordions();
      if (inventoryGroup) inventoryGroup.classList.add('open');
      if (inventoryParentBtn) {
        inventoryParentBtn.classList.add('active');
        inventoryParentBtn.setAttribute('aria-expanded', 'true');
      }
      const mLink = document.getElementById('nav-item-manufacturers');
      if (mLink) mLink.classList.add('active');
      await loadAndRenderManufacturers();
    } else if (clean.includes('/stock-alerts') || clean.endsWith('stock-alerts')) {
      if (viewStockAlerts) viewStockAlerts.classList.remove('hidden');
      closeAllAccordions();
      if (inventoryGroup) inventoryGroup.classList.add('open');
      if (inventoryParentBtn) {
        inventoryParentBtn.classList.add('active');
        inventoryParentBtn.setAttribute('aria-expanded', 'true');
      }
      const aLink = document.getElementById('nav-item-stock-alerts');
      if (aLink) aLink.classList.add('active');
      await loadAndRenderStockAlerts();
    } else if (clean.includes('/stock') || clean.endsWith('stock') || clean.includes('/inventory') || clean.endsWith('inventory')) {
      if (viewStock) viewStock.classList.remove('hidden');
      closeAllAccordions();
      if (inventoryGroup) inventoryGroup.classList.add('open');
      if (inventoryParentBtn) {
        inventoryParentBtn.classList.add('active');
        inventoryParentBtn.setAttribute('aria-expanded', 'true');
      }
      const sLink = document.getElementById('nav-item-stock');
      if (sLink) sLink.classList.add('active');
      await loadAndRenderStock(1);
    } else if (clean.includes('/bulk-import') || clean.endsWith('bulk-import')) {
      if (viewBulkImport) viewBulkImport.classList.remove('hidden');
      closeAllAccordions();
      if (inventoryGroup) inventoryGroup.classList.add('open');
      if (inventoryParentBtn) {
        inventoryParentBtn.classList.add('active');
        inventoryParentBtn.setAttribute('aria-expanded', 'true');
      }
      const bLink = document.getElementById('nav-item-bulk-import');
      if (bLink) bLink.classList.add('active');
    } else if (clean.includes('/suppliers') || clean.endsWith('suppliers')) {
      if (viewSuppliers) viewSuppliers.classList.remove('hidden');
      closeAllAccordions();
      if (procurementGroup) procurementGroup.classList.add('open');
      if (procurementParentBtn) {
        procurementParentBtn.classList.add('active');
        procurementParentBtn.setAttribute('aria-expanded', 'true');
      }
      const supLink = document.getElementById('nav-item-suppliers');
      if (supLink) supLink.classList.add('active');
      await loadAndRenderSuppliers();
    } else if (clean.includes('/purchase-orders') || clean.endsWith('purchase-orders') || clean.includes('/procurement') || clean.endsWith('procurement')) {
      if (viewPurchaseOrders) viewPurchaseOrders.classList.remove('hidden');
      closeAllAccordions();
      if (procurementGroup) procurementGroup.classList.add('open');
      if (procurementParentBtn) {
        procurementParentBtn.classList.add('active');
        procurementParentBtn.setAttribute('aria-expanded', 'true');
      }
      const poLink = document.getElementById('nav-item-purchase-orders');
      if (poLink) poLink.classList.add('active');
      await loadAndRenderPurchaseOrders();
    } else if (clean.includes('/users') || clean.endsWith('users')) {
      if (viewPharmacyUsers) viewPharmacyUsers.classList.remove('hidden');
      closeAllAccordions();
      if (adminGroup) adminGroup.classList.add('open');
      if (adminParentBtn) {
        adminParentBtn.classList.add('active');
        adminParentBtn.setAttribute('aria-expanded', 'true');
      }
      const uLink = document.getElementById('nav-item-users');
      if (uLink) uLink.classList.add('active');
      await loadPharmacyUsersList();
    } else if (clean.includes('/billing') || clean.endsWith('billing')) {
      if (viewPharmacyBilling) viewPharmacyBilling.classList.remove('hidden');
      closeAllAccordions();
      if (adminGroup) adminGroup.classList.add('open');
      if (adminParentBtn) {
        adminParentBtn.classList.add('active');
        adminParentBtn.setAttribute('aria-expanded', 'true');
      }
      const bLink = document.getElementById('nav-item-billing');
      if (bLink) bLink.classList.add('active');
      await renderPharmacyBillingPage();
    } else if (clean.includes('/settings') || clean.endsWith('settings')) {
      if (viewSystemSettings) viewSystemSettings.classList.remove('hidden');
      closeAllAccordions();
      if (adminGroup) adminGroup.classList.add('open');
      if (adminParentBtn) {
        adminParentBtn.classList.add('active');
        adminParentBtn.setAttribute('aria-expanded', 'true');
      }
      const sLink = document.getElementById('nav-item-settings');
      if (sLink) sLink.classList.add('active');
      await loadPharmacySettings();
    } else if (clean.includes('/reports') || clean.endsWith('reports')) {
      if (viewReports) viewReports.classList.remove('hidden');
      closeAllAccordions();
      if (financeGroup) financeGroup.classList.add('open');
      if (financeParentBtn) {
        financeParentBtn.classList.add('active');
        financeParentBtn.setAttribute('aria-expanded', 'true');
      }
      const repLink = document.getElementById('nav-item-reports');
      if (repLink) repLink.classList.add('active');
      await loadAndRenderReports();
    } else if (clean.includes('/expenses') || clean.endsWith('expenses')) {
      if (viewExpenses) viewExpenses.classList.remove('hidden');
      closeAllAccordions();
      if (financeGroup) financeGroup.classList.add('open');
      if (financeParentBtn) {
        financeParentBtn.classList.add('active');
        financeParentBtn.setAttribute('aria-expanded', 'true');
      }
      const expLink = document.getElementById('nav-item-expenses');
      if (expLink) expLink.classList.add('active');
      await loadAndRenderExpenses();
    } else if (clean.includes('/notifications') || clean.endsWith('notifications')) {
      if (viewNotifications) viewNotifications.classList.remove('hidden');
      closeAllAccordions();
      if (accountGroup) accountGroup.classList.add('open');
      if (accountParentBtn) {
        accountParentBtn.classList.add('active');
        accountParentBtn.setAttribute('aria-expanded', 'true');
      }
      const notifLink = document.getElementById('nav-item-notifications');
      if (notifLink) notifLink.classList.add('active');
      await loadAndRenderNotifications('all');
    } else if (clean.includes('/profile') || clean.endsWith('profile')) {
      if (viewProfile) viewProfile.classList.remove('hidden');
      closeAllAccordions();
      if (accountGroup) accountGroup.classList.add('open');
      if (accountParentBtn) {
        accountParentBtn.classList.add('active');
        accountParentBtn.setAttribute('aria-expanded', 'true');
      }
      const profLink = document.getElementById('nav-item-profile');
      if (profLink) profLink.classList.add('active');
      await loadAndRenderProfile();
    } else {
      // Default to /dashboard overview
      document.getElementById('style-dashboard-prehide')?.remove();
      if (viewDashboardMain) {
        viewDashboardMain.classList.remove('hidden');
        viewDashboardMain.style.removeProperty('display');
      }
      closeAllAccordions();
      const dLink = document.querySelector('a[data-path="/dashboard"], a[href="/dashboard"]');
      if (dLink) dLink.classList.add('active');
      await loadAndRenderDashboardOverview();
    }

    if (updateHistory && window.location.pathname !== clean) {
      window.history.pushState(null, '', clean);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    finishTopLoader();
  };

  // Listen to popstate (browser Back/Forward)
  window.addEventListener('popstate', () => {
    navigateTo(window.location.pathname, false);
  });

  // 7. Sidebar Accordion Behavior (Single Open, Auto-close on other mother clicks)
  if (posParentBtn && posGroup) {
    posParentBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = posGroup.classList.contains('open');
      closeAllAccordions();
      if (!isOpen) {
        posGroup.classList.add('open');
        posParentBtn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  if (customersParentBtn && customersGroup) {
    customersParentBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = customersGroup.classList.contains('open');
      closeAllAccordions();
      if (!isOpen) {
        customersGroup.classList.add('open');
        customersParentBtn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  if (inventoryParentBtn && inventoryGroup) {
    inventoryParentBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = inventoryGroup.classList.contains('open');
      closeAllAccordions();
      if (!isOpen) {
        inventoryGroup.classList.add('open');
        inventoryParentBtn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  if (financeParentBtn && financeGroup) {
    financeParentBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = financeGroup.classList.contains('open');
      closeAllAccordions();
      if (!isOpen) {
        financeGroup.classList.add('open');
        financeParentBtn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  if (procurementParentBtn && procurementGroup) {
    procurementParentBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = procurementGroup.classList.contains('open');
      closeAllAccordions();
      if (!isOpen) {
        procurementGroup.classList.add('open');
        procurementParentBtn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  if (accountParentBtn && accountGroup) {
    accountParentBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = accountGroup.classList.contains('open');
      closeAllAccordions();
      if (!isOpen) {
        accountGroup.classList.add('open');
        accountParentBtn.classList.add('active');
        accountParentBtn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  if (adminParentBtn && adminGroup) {
    adminParentBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = adminGroup.classList.contains('open');
      closeAllAccordions();
      if (!isOpen) {
        adminGroup.classList.add('open');
        adminParentBtn.classList.add('active');
        adminParentBtn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  // Global click delegation for all router links & buttons
  document.addEventListener('click', (e) => {
    // Accordion Parent Toggle Delegation (Guarantees all accordions open/close reliably)
    const parentBtn = e.target.closest('.menu-parent-btn');
    if (parentBtn) {
      e.preventDefault();
      e.stopPropagation();
      const group = parentBtn.closest('.menu-accordion-group');
      if (group) {
        const isOpen = group.classList.contains('open');
        closeAllAccordions();
        if (!isOpen) {
          group.classList.add('open');
          parentBtn.classList.add('active');
          parentBtn.setAttribute('aria-expanded', 'true');
        }
      }
      return;
    }

    // Add Buttons Delegation
    const addProdBtn = e.target.closest('#btn-open-add-product');
    if (addProdBtn) {
      e.preventDefault();
      openAddProductModal();
      return;
    }
    const addCatBtn = e.target.closest('#btn-open-add-category');
    if (addCatBtn) {
      e.preventDefault();
      openAddCategoryModal();
      return;
    }
    const addMfrBtn = e.target.closest('#btn-open-add-manufacturer');
    if (addMfrBtn) {
      e.preventDefault();
      openAddManufacturerModal();
      return;
    }
    const addUserBtn = e.target.closest('#btn-open-add-user');
    if (addUserBtn) {
      e.preventDefault();
      openAddUserModal();
      return;
    }

    const subLink = e.target.closest('.submenu-item, #nav-item-products, #nav-item-categories, #nav-item-manufacturers, #nav-item-users, #nav-item-billing, #nav-item-settings, #nav-item-notifications, #nav-item-profile');
    if (subLink) {
      e.preventDefault();
      const targetPath = subLink.getAttribute('data-path') || subLink.getAttribute('href') || '/dashboard';
      navigateTo(targetPath);
      return;
    }

    const motherLink = e.target.closest('.sidebar-menu > .router-link, .sidebar-menu > .menu-item:not(.menu-parent-btn)');
    if (motherLink && !motherLink.classList.contains('menu-parent-btn')) {
      e.preventDefault();
      closeAllAccordions();

      const targetPath = motherLink.getAttribute('data-path') || motherLink.getAttribute('href') || '/dashboard';
      if (targetPath === '/dashboard' || targetPath.endsWith('/dashboard')) {
        navigateTo('/dashboard');
      } else {
        const title = motherLink.querySelector('span')?.textContent || 'Module';
        if (enforceReadOnly(title)) return;
        showToast(`🛒 ${title} module is ready for ${pharmName}.`);
        navigateTo('/dashboard');
      }
    }
  });

  // ==============================================
  // 7.4. Product Catalog, Categories & Manufacturers Logic (Images 1 & 2)
  // ==============================================
  const PRODUCT_API_ENDPOINTS = [
    'https://api.holidaymartbd.com/ezpharma/products.php',
    '/api/products.php'
  ];
  const CAT_API_ENDPOINTS = [
    'https://api.holidaymartbd.com/ezpharma/categories.php',
    '/api/categories.php'
  ];
  const MFR_API_ENDPOINTS = [
    'https://api.holidaymartbd.com/ezpharma/manufacturers.php',
    '/api/manufacturers.php'
  ];

  let currentProducts = [];
  let currentCategories = [];
  let currentManufacturers = [];
  let productCurrentPage = 1;
  let productPerPage = 20;
  let productSortField = 'created_at';
  let productSortAsc = false;
  let productSearchQuery = '';
  let productCategoryFilter = '';

  // Centralized Currency & Localization Helper
  const getActiveCurrencySymbol = () => {
    try {
      const raw = localStorage.getItem(`ezpharma_settings_pharm_${pharmacyId}`);
      const s = raw ? JSON.parse(raw) : null;
      if (s && s.currency) {
        if (s.currency.includes('৳') || s.currency.includes('BDT') || s.currency.includes('Taka')) return '৳';
        if (s.currency.includes('€') || s.currency.includes('Euro')) return '€';
        if (s.currency.includes('£') || s.currency.includes('Pound')) return '£';
        if (s.currency.includes('₹') || s.currency.includes('Rupee')) return '₹';
        if (s.currency.includes('SAR') || s.currency.includes('Riyal')) return 'SAR';
        if (s.currency.includes('AED') || s.currency.includes('Dirham')) return 'AED';
        if (s.currency.includes('CAD')) return 'C$';
        if (s.currency.includes('AUD')) return 'A$';
        if (s.currency.includes('$')) return '$';
        const match = s.currency.match(/\((.*?)\)/);
        if (match && match[1]) return match[1];
      }
    } catch (e) {}
    return '$';
  };

  const formatPrice = (amount) => {
    const sym = getActiveCurrencySymbol();
    const val = parseFloat(amount || 0).toFixed(2);
    return `${sym} ${val}`;
  };

  const updateAllCurrencyDisplays = () => {
    const sym = getActiveCurrencySymbol();
    document.querySelectorAll('.curr-symbol').forEach(el => {
      el.textContent = sym;
    });
    // Re-render product catalog table if active
    const prodView = document.getElementById('view-products-catalog');
    if (prodView && !prodView.classList.contains('hidden') && currentProducts.length > 0) {
      renderProductsTable(currentProducts, currentProducts.length, productCurrentPage, productPerPage);
    }
  };

  // Render Product Catalog Table (Image 1)
  const renderProductsTable = (productsList, totalCount = 0, page = 1, perPage = 20) => {
    const tbody = document.getElementById('products-table-tbody');
    const countLabel = document.getElementById('products-count-label');
    const paginationContainer = document.getElementById('products-pagination-controls');
    if (!tbody) return;

    if (!productsList || productsList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">No products found. Click <strong>+ Add Product</strong> to add your first medicine.</td></tr>`;
      if (countLabel) countLabel.textContent = 'Showing 0 to 0 of 0 results';
      if (paginationContainer) paginationContainer.innerHTML = '';
      return;
    }

    const startIdx = (page - 1) * perPage + 1;
    const endIdx = Math.min(startIdx + productsList.length - 1, totalCount || productsList.length);
    if (countLabel) {
      countLabel.textContent = `Showing ${startIdx} to ${endIdx} of ${totalCount || productsList.length} results`;
    }

    tbody.innerHTML = productsList.map(p => {
      const formattedPrice = formatPrice(p.selling_price || 0);
      const isRx = p.requires_rx == 1 || p.requires_rx === '1' || p.requires_rx === true;
      const genericTxt = p.generic_name ? `<div class="prod-meta"><em>Generic:</em> ${escapeHtml(p.generic_name)}</div>` : '';
      const mfrTxt = p.manufacturer_name ? `<div class="prod-meta"><em>Mfr:</em> ${escapeHtml(p.manufacturer_name)}</div>` : '';

      return `
        <tr>
          <td>
            <strong>${escapeHtml(p.name)}</strong>
            ${genericTxt}
            ${mfrTxt}
          </td>
          <td><span class="category-pill">${escapeHtml(p.category_name || 'General')}</span></td>
          <td><span class="sku-code">${escapeHtml(p.sku || 'N/A')}</span></td>
          <td><strong>${formattedPrice}</strong></td>
          <td>${isRx ? '<span class="rx-yes">Yes</span>' : '<span class="rx-no">No</span>'}</td>
          <td class="text-right">
            <div class="user-action-btns">
              <button type="button" class="btn-user-action btn-product-edit" data-id="${p.id}" title="Edit Product">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button type="button" class="btn-user-action btn-product-delete" data-id="${p.id}" data-name="${escapeHtml(p.name)}" title="Delete Product">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Render Pagination Buttons
    if (paginationContainer) {
      const totalPages = Math.ceil((totalCount || productsList.length) / perPage) || 1;
      if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
      }

      let pagHtml = `<button type="button" class="page-btn" ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}">&lsaquo; Prev</button>`;
      for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
          pagHtml += `<button type="button" class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
        } else if (i === page - 3 || i === page + 3) {
          pagHtml += `<span class="px-1 text-muted">...</span>`;
        }
      }
      pagHtml += `<button type="button" class="page-btn" ${page >= totalPages ? 'disabled' : ''} data-page="${page + 1}">Next &rsaquo;</button>`;
      paginationContainer.innerHTML = pagHtml;
    }
  };

  // Populate Categories & Manufacturers Dropdowns
  const updateCategoryAndMfrSelectors = (selectedCategory = '', selectedManufacturer = '') => {
    const catFilter = document.getElementById('products-category-filter');
    const catSelect = document.getElementById('prod_input_category');
    const mfrSelect = document.getElementById('prod_input_manufacturer');

    if (catFilter) {
      const curVal = catFilter.value;
      let opts = '<option value="">All Categories</option>';
      currentCategories.forEach(c => {
        opts += `<option value="${escapeHtml(c.name)}" ${curVal === c.name ? 'selected' : ''}>${escapeHtml(c.name)}</option>`;
      });
      catFilter.innerHTML = opts;
    }

    if (catSelect) {
      const curVal = selectedCategory || catSelect.value || '';
      let opts = '<option value="">Select Category</option>';
      currentCategories.forEach(c => {
        opts += `<option value="${escapeHtml(c.name)}" ${curVal === c.name ? 'selected' : ''}>${escapeHtml(c.name)}</option>`;
      });
      catSelect.innerHTML = opts;
    }

    if (mfrSelect) {
      const curVal = selectedManufacturer || mfrSelect.value || '';
      let opts = '<option value="">Select Manufacturer</option>';
      currentManufacturers.forEach(m => {
        opts += `<option value="${escapeHtml(m.name)}" ${curVal === m.name ? 'selected' : ''}>${escapeHtml(m.name)}</option>`;
      });
      mfrSelect.innerHTML = opts;
    }
  };

  const sortProductList = (list) => {
    if (!Array.isArray(list)) return [];
    return [...list].sort((a, b) => {
      let valA = a[productSortField];
      let valB = b[productSortField];

      if (productSortField === 'created_at') {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : (parseInt(a.id) || 0);
        const dateB = b.created_at ? new Date(b.created_at).getTime() : (parseInt(b.id) || 0);
        return productSortAsc ? dateA - dateB : dateB - dateA;
      }

      if (productSortField === 'selling_price' || productSortField === 'cost_price') {
        const priceA = parseFloat(valA) || 0;
        const priceB = parseFloat(valB) || 0;
        return productSortAsc ? priceA - priceB : priceB - priceA;
      }

      const strA = (valA || '').toString().trim().toLowerCase();
      const strB = (valB || '').toString().trim().toLowerCase();
      return productSortAsc ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  };

  // Load Products from MySQL Database API
  const loadAndRenderProducts = async (page = 1) => {
    productCurrentPage = page;
    const tbody = document.getElementById('products-table-tbody');
    if (tbody && currentProducts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">Loading products...</td></tr>`;
    }

    // Try Local Fallback first
    try {
      const stored = localStorage.getItem(`ezpharma_products_pharm_${pharmacyId}`);
      if (stored && currentProducts.length === 0) {
        currentProducts = sortProductList(JSON.parse(stored));
        renderProductsTable(currentProducts, currentProducts.length, page, productPerPage);
      }
    } catch (e) {}

    // Fetch from MySQL API
    for (const url of PRODUCT_API_ENDPOINTS) {
      try {
        const queryParams = new URLSearchParams({
          pharmacy_id: pharmacyId,
          search: productSearchQuery,
          category: productCategoryFilter,
          sort: productSortField,
          order: productSortAsc ? 'ASC' : 'DESC',
          page: page,
          per_page: productPerPage
        });

        const res = await fetch(`${url}?${queryParams.toString()}`, { method: 'GET' });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success) {
            currentProducts = sortProductList(json.products || []);
            if (Array.isArray(json.categories)) currentCategories = json.categories;
            if (Array.isArray(json.manufacturers)) currentManufacturers = json.manufacturers;

            updateCategoryAndMfrSelectors();
            renderProductsTable(currentProducts, json.pagination?.total || currentProducts.length, page, productPerPage);
            localStorage.setItem(`ezpharma_products_pharm_${pharmacyId}`, JSON.stringify(currentProducts));
            break;
          }
        }
      } catch (err) {}
    }
  };

  // Load & Render Categories View
  const loadAndRenderCategories = async () => {
    const tbody = document.getElementById('categories-table-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">Loading categories...</td></tr>`;
    }

    for (const url of CAT_API_ENDPOINTS) {
      try {
        const res = await fetch(`${url}?pharmacy_id=${pharmacyId}`, { method: 'GET' });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success && Array.isArray(json.categories)) {
            currentCategories = json.categories;
            updateCategoryAndMfrSelectors();
            break;
          }
        }
      } catch (err) {}
    }

    if (!tbody) return;
    if (currentCategories.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">No categories found. Click <strong>+ Add Category</strong> to create one.</td></tr>`;
      return;
    }

    tbody.innerHTML = currentCategories.map(c => {
      const cDate = new Date(c.created_at || Date.now()).toLocaleDateString('en-GB');
      return `
        <tr>
          <td><strong>${escapeHtml(c.name)}</strong></td>
          <td>${escapeHtml(c.description || '—')}</td>
          <td><span class="category-pill">${c.product_count || 0} Products</span></td>
          <td>${cDate}</td>
          <td class="text-right">
            <div class="user-action-btns">
              <button type="button" class="btn-user-action btn-cat-edit" data-id="${c.id}" data-name="${escapeHtml(c.name)}" data-desc="${escapeHtml(c.description || '')}" title="Edit Category">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button type="button" class="btn-user-action btn-cat-delete" data-id="${c.id}" data-name="${escapeHtml(c.name)}" title="Delete Category">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  };

  // Load & Render Manufacturers View
  const loadAndRenderManufacturers = async () => {
    const tbody = document.getElementById('manufacturers-table-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">Loading manufacturers...</td></tr>`;
    }

    for (const url of MFR_API_ENDPOINTS) {
      try {
        const res = await fetch(`${url}?pharmacy_id=${pharmacyId}`, { method: 'GET' });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success && Array.isArray(json.manufacturers)) {
            currentManufacturers = json.manufacturers;
            updateCategoryAndMfrSelectors();
            break;
          }
        }
      } catch (err) {}
    }

    if (!tbody) return;
    if (currentManufacturers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">No manufacturers found. Click <strong>+ Add Manufacturer</strong> to create one.</td></tr>`;
      return;
    }

    tbody.innerHTML = currentManufacturers.map(m => {
      const contactInfo = [m.email, m.phone].filter(Boolean).join(' • ') || '—';
      return `
        <tr>
          <td><strong>${escapeHtml(m.name)}</strong></td>
          <td>${escapeHtml(m.contact_person || '—')}</td>
          <td>${escapeHtml(contactInfo)}</td>
          <td><span class="category-pill">${m.product_count || 0} Products</span></td>
          <td class="text-right">
            <div class="user-action-btns">
              <button type="button" class="btn-user-action btn-mfr-edit" data-id="${m.id}" data-name="${escapeHtml(m.name)}" data-contact="${escapeHtml(m.contact_person || '')}" data-email="${escapeHtml(m.email || '')}" data-phone="${escapeHtml(m.phone || '')}" title="Edit Manufacturer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button type="button" class="btn-user-action btn-mfr-delete" data-id="${m.id}" data-name="${escapeHtml(m.name)}" title="Delete Manufacturer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  };

  // Product Catalog Search & Filters Listeners
  let searchTimeout = null;
  document.getElementById('products-search-input')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    productSearchQuery = e.target.value.trim();
    searchTimeout = setTimeout(() => loadAndRenderProducts(1), 300);
  });

  document.getElementById('products-category-filter')?.addEventListener('change', (e) => {
    productCategoryFilter = e.target.value;
    loadAndRenderProducts(1);
  });

  document.getElementById('products-sort-field')?.addEventListener('change', (e) => {
    productSortField = e.target.value;
    loadAndRenderProducts(1);
  });

  document.getElementById('btn-toggle-sort-order')?.addEventListener('click', () => {
    productSortAsc = !productSortAsc;
    const btn = document.getElementById('btn-toggle-sort-order');
    const icon = document.getElementById('sort-arrow-icon');
    if (btn) {
      btn.title = `Toggle Sort Direction (${productSortAsc ? 'Ascending' : 'Descending'})`;
    }
    if (icon) {
      icon.innerHTML = productSortAsc 
        ? `<polyline points="18 15 12 9 6 15"></polyline>` 
        : `<polyline points="6 9 12 15 18 9"></polyline>`;
    }
    loadAndRenderProducts(1);
  });

  document.getElementById('products-per-page')?.addEventListener('change', (e) => {
    productPerPage = parseInt(e.target.value) || 20;
    loadAndRenderProducts(1);
  });

  document.getElementById('products-pagination-controls')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.page-btn');
    if (btn && !btn.disabled) {
      const targetPage = parseInt(btn.getAttribute('data-page'));
      if (targetPage) loadAndRenderProducts(targetPage);
    }
  });

  // Add / Edit Product Modal Controls (Image 2)
  const modalProduct = document.getElementById('modal-product-form');
  const btnOpenAddProduct = document.getElementById('btn-open-add-product');
  const btnCloseProductModal = document.getElementById('btn-close-product-modal');
  const btnCancelProductModal = document.getElementById('btn-cancel-product-modal');

  const openAddProductModal = () => {
    if (enforceReadOnly('Add Product')) return;
    document.getElementById('modal-product-title').textContent = 'Add New Product';
    document.getElementById('prod_form_action').value = 'create';
    document.getElementById('prod_form_id').value = '';
    document.getElementById('prod_input_name').value = '';
    document.getElementById('prod_input_generic').value = '';
    document.getElementById('prod_input_desc').value = '';
    document.getElementById('prod_input_category').value = '';
    document.getElementById('prod_input_manufacturer').value = '';
    document.getElementById('prod_input_sku').value = '';
    document.getElementById('prod_input_selling_price').value = '0';
    document.getElementById('prod_input_cost_price').value = '0';
    document.getElementById('prod_chk_rx').checked = false;
    document.getElementById('prod_chk_expiry').checked = true;
    document.getElementById('btn-save-product-text').textContent = 'Create Product';

    updateCategoryAndMfrSelectors('', '');
    updateAllCurrencyDisplays();
    if (modalProduct) {
      modalProduct.classList.remove('hidden');
      modalProduct.scrollTop = 0;
      const card = modalProduct.querySelector('.modal-card') || modalProduct.firstElementChild;
      if (card) card.scrollTop = 0;
      setTimeout(() => {
        if (card) card.scrollTop = 0;
        modalProduct.scrollTop = 0;
        document.getElementById('prod_input_name')?.focus({ preventScroll: true });
      }, 15);
    }
  };

  const openEditProductModal = (productId) => {
    if (enforceReadOnly('Edit Product')) return;
    const prod = currentProducts.find(p => p.id == productId);
    if (!prod) return;

    document.getElementById('modal-product-title').textContent = 'Edit Product';
    document.getElementById('prod_form_action').value = 'update';
    document.getElementById('prod_form_id').value = prod.id;
    document.getElementById('prod_input_name').value = prod.name || '';
    document.getElementById('prod_input_generic').value = prod.generic_name || '';
    document.getElementById('prod_input_desc').value = prod.description || '';
    document.getElementById('prod_input_sku').value = prod.sku || '';
    document.getElementById('prod_input_selling_price').value = prod.selling_price || 0;
    document.getElementById('prod_input_cost_price').value = prod.cost_price || 0;
    document.getElementById('prod_chk_rx').checked = prod.requires_rx == 1;
    document.getElementById('prod_chk_expiry').checked = prod.track_expiry != 0;
    document.getElementById('btn-save-product-text').textContent = 'Save Changes';

    updateCategoryAndMfrSelectors(prod.category_name || '', prod.manufacturer_name || '');
    updateAllCurrencyDisplays();
    if (modalProduct) {
      modalProduct.classList.remove('hidden');
      modalProduct.scrollTop = 0;
      const card = modalProduct.querySelector('.modal-card') || modalProduct.firstElementChild;
      if (card) card.scrollTop = 0;
      setTimeout(() => {
        if (card) card.scrollTop = 0;
        modalProduct.scrollTop = 0;
        document.getElementById('prod_input_name')?.focus({ preventScroll: true });
      }, 15);
    }
  };

  const closeProductModal = () => {
    if (modalProduct) modalProduct.classList.add('hidden');
  };

  if (btnOpenAddProduct) btnOpenAddProduct.addEventListener('click', openAddProductModal);
  if (btnCloseProductModal) btnCloseProductModal.addEventListener('click', closeProductModal);
  if (btnCancelProductModal) btnCancelProductModal.addEventListener('click', closeProductModal);

  // Product Table Edit / Delete Actions
  document.getElementById('products-table-tbody')?.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.btn-product-edit');
    if (editBtn) {
      openEditProductModal(editBtn.getAttribute('data-id'));
      return;
    }

    const delBtn = e.target.closest('.btn-product-delete');
    if (delBtn) {
      if (enforceReadOnly('Delete Product')) return;
      const pid = delBtn.getAttribute('data-id');
      const pname = delBtn.getAttribute('data-name') || 'this product';
      const confirmed = await showConfirmDialog({
        title: 'Delete Product',
        message: `Are you sure you want to permanently delete "${pname}"? This action cannot be undone.`,
        confirmText: 'Delete Product',
        isDanger: true
      });
      if (confirmed) {
        currentProducts = currentProducts.filter(p => p.id != pid);
        renderProductsTable(currentProducts, currentProducts.length, productCurrentPage, productPerPage);
        try {
          localStorage.setItem(`ezpharma_products_pharm_${pharmacyId}`, JSON.stringify(currentProducts));
        } catch (e) {}

        for (const url of PRODUCT_API_ENDPOINTS) {
          try {
            await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'delete', id: pid, pharmacy_id: pharmacyId })
            });
            break;
          } catch (err) {}
        }
        showToast('✅ Product deleted successfully!');
      }
    }
  });

  // Product Form Submit Handler
  document.getElementById('form-product-management')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const action = document.getElementById('prod_form_action').value;
    const prodId = document.getElementById('prod_form_id').value;
    const name = document.getElementById('prod_input_name').value.trim();
    const generic = document.getElementById('prod_input_generic').value.trim();
    const desc = document.getElementById('prod_input_desc').value.trim();
    const category = document.getElementById('prod_input_category').value.trim();
    const manufacturer = document.getElementById('prod_input_manufacturer').value.trim();
    const sku = document.getElementById('prod_input_sku').value.trim();
    const sellingPrice = parseFloat(document.getElementById('prod_input_selling_price').value) || 0;
    const costPrice = parseFloat(document.getElementById('prod_input_cost_price').value) || 0;
    const requiresRx = document.getElementById('prod_chk_rx').checked ? 1 : 0;
    const trackExpiry = document.getElementById('prod_chk_expiry').checked ? 1 : 0;

    if (!name) {
      showToast('⚠️ Please enter a product name.', true);
      return;
    }

    const btnSubmit = document.getElementById('btn-save-product-submit');
    const btnText = document.getElementById('btn-save-product-text');
    const spinner = document.getElementById('prod-save-spinner');

    if (btnSubmit) btnSubmit.disabled = true;
    if (spinner) spinner.classList.remove('hidden');
    if (btnText) btnText.textContent = 'Saving...';

    const payload = {
      action,
      id: prodId,
      pharmacy_id: pharmacyId,
      name,
      generic_name: generic,
      description: desc,
      category_name: category,
      manufacturer_name: manufacturer,
      sku,
      selling_price: sellingPrice,
      cost_price: costPrice,
      requires_rx: requiresRx,
      track_expiry: trackExpiry
    };

    for (const url of PRODUCT_API_ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const json = await res.json();
          if (json && !json.success && json.message) {
            showToast(`⚠️ ${json.message}`, true);
            if (btnSubmit) btnSubmit.disabled = false;
            if (spinner) spinner.classList.add('hidden');
            if (btnText) btnText.textContent = action === 'create' ? 'Create Product' : 'Save Changes';
            return;
          }
        }
        break;
      } catch (err) {}
    }

    if (btnSubmit) btnSubmit.disabled = false;
    if (spinner) spinner.classList.add('hidden');
    if (btnText) btnText.textContent = action === 'create' ? 'Create Product' : 'Save Changes';

    closeProductModal();
    showToast(action === 'create' ? '✅ Product created successfully!' : '✅ Product updated successfully!');
    loadAndRenderProducts(productCurrentPage);
  });

  // Category Modal & Management Controls
  const modalCategory = document.getElementById('modal-category-form');
  const openAddCategoryModal = () => {
    if (enforceReadOnly('Add Category')) return;
    document.getElementById('modal-category-title').textContent = 'Add Category';
    document.getElementById('cat_form_action').value = 'create';
    document.getElementById('cat_form_id').value = '';
    document.getElementById('cat_input_name').value = '';
    document.getElementById('cat_input_desc').value = '';
    if (modalCategory) {
      modalCategory.classList.remove('hidden');
      modalCategory.scrollTop = 0;
      const card = modalCategory.querySelector('.modal-card') || modalCategory.firstElementChild;
      if (card) card.scrollTop = 0;
    }
  };

  const openEditCategoryModal = (catId) => {
    if (enforceReadOnly('Edit Category')) return;
    const cat = currentCategories.find(c => c.id == catId);
    if (!cat) return;
    document.getElementById('modal-category-title').textContent = 'Edit Category';
    document.getElementById('cat_form_action').value = 'update';
    document.getElementById('cat_form_id').value = cat.id;
    document.getElementById('cat_input_name').value = cat.name || '';
    document.getElementById('cat_input_desc').value = cat.description || '';
    if (modalCategory) {
      modalCategory.classList.remove('hidden');
      modalCategory.scrollTop = 0;
      const card = modalCategory.querySelector('.modal-card') || modalCategory.firstElementChild;
      if (card) card.scrollTop = 0;
    }
  };

  const closeCategoryModal = () => {
    if (modalCategory) modalCategory.classList.add('hidden');
  };

  document.getElementById('btn-open-add-category')?.addEventListener('click', openAddCategoryModal);
  document.getElementById('btn-close-category-modal')?.addEventListener('click', closeCategoryModal);
  document.getElementById('btn-cancel-category-modal')?.addEventListener('click', closeCategoryModal);

  document.getElementById('categories-table-tbody')?.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.btn-cat-edit');
    if (editBtn) {
      openEditCategoryModal(editBtn.getAttribute('data-id'));
      return;
    }
    const delBtn = e.target.closest('.btn-cat-delete');
    if (delBtn) {
      if (enforceReadOnly('Delete Category')) return;
      const cid = delBtn.getAttribute('data-id');
      const cname = delBtn.getAttribute('data-name') || 'this category';
      const confirmed = await showConfirmDialog({
        title: 'Delete Category',
        message: `Are you sure you want to delete category "${cname}"? Products in this category will remain available.`,
        confirmText: 'Delete Category',
        isDanger: true
      });
      if (confirmed) {
        currentCategories = currentCategories.filter(c => c.id != cid);
        loadAndRenderCategories();
        for (const url of CAT_API_ENDPOINTS) {
          try {
            await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'delete', id: cid, pharmacy_id: pharmacyId })
            });
            break;
          } catch (err) {}
        }
        showToast('✅ Category deleted successfully!');
      }
    }
  });

  document.getElementById('form-category-management')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const action = document.getElementById('cat_form_action').value;
    const catId = document.getElementById('cat_form_id').value;
    const name = document.getElementById('cat_input_name').value.trim();
    const desc = document.getElementById('cat_input_desc').value.trim();

    if (!name) {
      showToast('⚠️ Please enter a category name.', true);
      return;
    }

    for (const url of CAT_API_ENDPOINTS) {
      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, id: catId, pharmacy_id: pharmacyId, name, description: desc })
        });
        break;
      } catch (err) {}
    }

    closeCategoryModal();
    showToast('✅ Category saved successfully!');
    loadAndRenderCategories();
  });

  // Manufacturer Modal & Management Controls
  const modalManufacturer = document.getElementById('modal-manufacturer-form');
  const openAddManufacturerModal = () => {
    if (enforceReadOnly('Add Manufacturer')) return;
    document.getElementById('modal-manufacturer-title').textContent = 'Add Manufacturer';
    document.getElementById('mfr_form_action').value = 'create';
    document.getElementById('mfr_form_id').value = '';
    document.getElementById('mfr_input_name').value = '';
    document.getElementById('mfr_input_contact').value = '';
    document.getElementById('mfr_input_phone').value = '';
    document.getElementById('mfr_input_email').value = '';
    if (modalManufacturer) {
      modalManufacturer.classList.remove('hidden');
      modalManufacturer.scrollTop = 0;
      const card = modalManufacturer.querySelector('.modal-card') || modalManufacturer.firstElementChild;
      if (card) card.scrollTop = 0;
    }
  };

  const openEditManufacturerModal = (mfrId) => {
    if (enforceReadOnly('Edit Manufacturer')) return;
    const mfr = currentManufacturers.find(m => m.id == mfrId);
    if (!mfr) return;
    document.getElementById('modal-manufacturer-title').textContent = 'Edit Manufacturer';
    document.getElementById('mfr_form_action').value = 'update';
    document.getElementById('mfr_form_id').value = mfr.id;
    document.getElementById('mfr_input_name').value = mfr.name || '';
    document.getElementById('mfr_input_contact').value = mfr.contact_person || '';
    document.getElementById('mfr_input_phone').value = mfr.phone || '';
    document.getElementById('mfr_input_email').value = mfr.email || '';
    if (modalManufacturer) {
      modalManufacturer.classList.remove('hidden');
      modalManufacturer.scrollTop = 0;
      const card = modalManufacturer.querySelector('.modal-card') || modalManufacturer.firstElementChild;
      if (card) card.scrollTop = 0;
    }
  };

  const closeManufacturerModal = () => {
    if (modalManufacturer) modalManufacturer.classList.add('hidden');
  };

  document.getElementById('btn-open-add-manufacturer')?.addEventListener('click', openAddManufacturerModal);
  document.getElementById('btn-close-manufacturer-modal')?.addEventListener('click', closeManufacturerModal);
  document.getElementById('btn-cancel-manufacturer-modal')?.addEventListener('click', closeManufacturerModal);

  document.getElementById('manufacturers-table-tbody')?.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.btn-mfr-edit');
    if (editBtn) {
      openEditManufacturerModal(editBtn.getAttribute('data-id'));
      return;
    }
    const delBtn = e.target.closest('.btn-mfr-delete');
    if (delBtn) {
      if (enforceReadOnly('Delete Manufacturer')) return;
      const mid = delBtn.getAttribute('data-id');
      const mname = delBtn.getAttribute('data-name') || 'this manufacturer';
      const confirmed = await showConfirmDialog({
        title: 'Delete Manufacturer',
        message: `Are you sure you want to delete manufacturer "${mname}"?`,
        confirmText: 'Delete Manufacturer',
        isDanger: true
      });
      if (confirmed) {
        currentManufacturers = currentManufacturers.filter(m => m.id != mid);
        loadAndRenderManufacturers();
        for (const url of MFR_API_ENDPOINTS) {
          try {
            await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'delete', id: mid, pharmacy_id: pharmacyId })
            });
            break;
          } catch (err) {}
        }
        showToast('✅ Manufacturer deleted successfully!');
      }
    }
  });

  document.getElementById('form-manufacturer-management')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const action = document.getElementById('mfr_form_action').value;
    const mfrId = document.getElementById('mfr_form_id').value;
    const name = document.getElementById('mfr_input_name').value.trim();
    const contact = document.getElementById('mfr_input_contact').value.trim();
    const phone = document.getElementById('mfr_input_phone').value.trim();
    const email = document.getElementById('mfr_input_email').value.trim();

    if (!name) {
      showToast('⚠️ Please enter a manufacturer name.', true);
      return;
    }

    for (const url of MFR_API_ENDPOINTS) {
      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, id: mfrId, pharmacy_id: pharmacyId, name, contact_person: contact, phone, email })
        });
        break;
      } catch (err) {}
    }

    closeManufacturerModal();
    showToast('✅ Manufacturer saved successfully!');
    loadAndRenderManufacturers();
  });

  // ==============================================
  // 7.4.4. Bulk Import Logic (Image 1 & Image 2)
  // ==============================================
  let parsedImportProducts = [];

  // Top header button in Product Catalog navigates to Bulk Import
  document.getElementById('btn-products-bulk-import')?.addEventListener('click', () => {
    navigateTo('/dashboard/bulk-import');
  });

  // 1. Download CSV Template (Matching Image 2 columns)
  document.getElementById('btn-download-csv-template')?.addEventListener('click', () => {
    const headers = [
      'name',
      'genericName',
      'description',
      'category',
      'manufacturer',
      'sku',
      'price',
      'costPrice',
      'requiresPrescription',
      'expiryDateRequired'
    ];

    const sampleRows = [
      ['Paracetamol 500mg', 'Acetaminophen', 'Pain relief medication', 'Pain Relief', 'Generic Pharma', 'PAR-001', '10', '7.5', 'FALSE', 'TRUE'],
      ['Amoxicillin 250mg', 'Amoxicillin', 'Antibiotic medication', 'Antibiotics', 'MedCorp', 'AMO-002', '15', '12', 'TRUE', 'TRUE']
    ];

    const csvContent = [
      headers.join(','),
      ...sampleRows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'ezpharma_products_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('📥 CSV Template downloaded successfully!');
  });

  // 2. CSV Parser Function (Resilient to comma, tab, semicolon, headers)
  const parseCSVText = (text) => {
    const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];

    // Detect delimiter: check first line for tab, semicolon or comma
    const firstLine = lines[0];
    let delimiter = ',';
    if (firstLine.includes('\t')) delimiter = '\t';
    else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';

    const parseLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      return result;
    };

    const rawHeaders = parseLine(lines[0]);
    const headers = rawHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      if (values.length === 0 || (values.length === 1 && !values[0])) continue;

      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = values[idx] !== undefined ? values[idx] : '';
      });

      // Flexible property extraction
      const name = obj['name'] || obj['productname'] || obj['itemname'] || obj['item'] || values[0] || '';
      if (!name || name.toLowerCase() === 'name') continue;

      const generic = obj['genericname'] || obj['generic'] || obj['generictitle'] || values[1] || '';
      const desc = obj['description'] || obj['desc'] || obj['details'] || values[2] || '';
      const category = obj['category'] || obj['categoryname'] || obj['cat'] || values[3] || 'General';
      const manufacturer = obj['manufacturer'] || obj['manufacturername'] || obj['mfr'] || obj['company'] || obj['brand'] || values[4] || '';
      const sku = obj['sku'] || obj['code'] || obj['barcode'] || obj['itemcode'] || values[5] || '';
      
      const priceRaw = obj['price'] || obj['sellingprice'] || obj['mrp'] || obj['rate'] || values[6] || 0;
      const price = parseFloat(String(priceRaw).replace(/[^0-9.]/g, '')) || 0;

      const costRaw = obj['costprice'] || obj['cost'] || obj['buyprice'] || obj['purchaseprice'] || values[7] || 0;
      const costPrice = parseFloat(String(costRaw).replace(/[^0-9.]/g, '')) || 0;

      const rxVal = String(obj['requiresprescription'] || obj['requiresrx'] || obj['prescription'] || obj['rx'] || values[8] || '').toLowerCase().trim();
      const requiresRx = rxVal === 'true' || rxVal === '1' || rxVal === 'yes';

      const expVal = String(obj['expirydaterequired'] || obj['trackexpiry'] || obj['expiry'] || obj['exp'] || values[9] || '').toLowerCase().trim();
      const trackExpiry = expVal !== 'false' && expVal !== '0' && expVal !== 'no';

      rows.push({
        name: name.trim(),
        generic_name: generic.trim(),
        description: desc.trim(),
        category_name: (category.trim() || 'General'),
        manufacturer_name: manufacturer.trim(),
        sku: (sku.trim() || `SKU-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 900 + 100)}`),
        selling_price: price,
        cost_price: costPrice,
        requires_rx: requiresRx ? 1 : 0,
        track_expiry: trackExpiry ? 1 : 0
      });
    }

    return rows;
  };

  // 3. Drop Zone & File Selection Listeners
  const dropZone = document.getElementById('csv-drop-zone');
  const fileInput = document.getElementById('csv-file-input');
  const promptBox = document.getElementById('drop-zone-prompt');
  const selectedInfo = document.getElementById('selected-file-info');
  const previewFileName = document.getElementById('preview-file-name');
  const previewFileStats = document.getElementById('preview-file-stats');
  const previewWrap = document.getElementById('bulk-parsed-preview');
  const previewTbody = document.getElementById('bulk-preview-tbody');
  const parsedRowsCount = document.getElementById('parsed-rows-count');
  const btnSubmitImport = document.getElementById('btn-submit-bulk-import');
  const btnRemoveFile = document.getElementById('btn-remove-selected-file');

  const resetBulkImportUI = () => {
    parsedImportProducts = [];
    if (fileInput) fileInput.value = '';
    if (promptBox) promptBox.classList.remove('hidden');
    if (selectedInfo) selectedInfo.classList.add('hidden');
    if (previewWrap) previewWrap.classList.add('hidden');
    if (previewTbody) previewTbody.innerHTML = '';
    if (btnSubmitImport) btnSubmitImport.disabled = true;
  };

  const handleSelectedFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      parsedImportProducts = parseCSVText(text);

      if (parsedImportProducts.length === 0) {
        showToast('⚠️ No valid product rows found. Please ensure column "name" exists in the CSV.', true);
        resetBulkImportUI();
        return;
      }

      if (previewFileName) previewFileName.textContent = file.name;
      if (previewFileStats) previewFileStats.textContent = `Ready to import • ${parsedImportProducts.length} valid product(s) found`;
      if (promptBox) promptBox.classList.add('hidden');
      if (selectedInfo) selectedInfo.classList.remove('hidden');
      if (btnSubmitImport) btnSubmitImport.disabled = false;

      // Render Preview Table
      if (previewWrap && previewTbody && parsedRowsCount) {
        parsedRowsCount.textContent = parsedImportProducts.length;
        previewTbody.innerHTML = parsedImportProducts.slice(0, 10).map(p => `
          <tr>
            <td><strong>${escapeHtml(p.name)}</strong></td>
            <td>${escapeHtml(p.generic_name || '—')}</td>
            <td><span class="category-pill">${escapeHtml(p.category_name || 'General')}</span></td>
            <td>${escapeHtml(p.manufacturer_name || '—')}</td>
            <td><span class="sku-code">${escapeHtml(p.sku || 'Auto')}</span></td>
            <td><strong>${formatPrice(p.selling_price)}</strong></td>
            <td>${formatPrice(p.cost_price)}</td>
            <td>${p.requires_rx ? '<span class="rx-yes">Yes</span>' : '<span class="rx-no">No</span>'}</td>
            <td>${p.track_expiry ? '<span class="rx-yes">Yes</span>' : '<span class="rx-no">No</span>'}</td>
          </tr>
        `).join('');
        previewWrap.classList.remove('hidden');
      }

      showToast(`📄 Parsed ${parsedImportProducts.length} product(s) from "${file.name}"`);
    };

    reader.onerror = () => {
      showToast('⚠️ Failed to read file. Please try again.', true);
    };

    reader.readAsText(file);
  };

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', (e) => {
      if (e.target.closest('#btn-remove-selected-file')) return;
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handleSelectedFile(file);
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    ['dragleave', 'dragend'].forEach(type => {
      dropZone.addEventListener(type, () => {
        dropZone.classList.remove('dragover');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleSelectedFile(file);
    });
  }

  if (btnRemoveFile) {
    btnRemoveFile.addEventListener('click', (e) => {
      e.stopPropagation();
      resetBulkImportUI();
    });
  }

  // 4. Submit Bulk Import to Database with reliable fallback
  if (btnSubmitImport) {
    btnSubmitImport.addEventListener('click', async () => {
      if (enforceReadOnly('Bulk Import')) return;
      if (parsedImportProducts.length === 0) {
        showToast('⚠️ Please select a CSV file with products first.', true);
        return;
      }

      const spinner = document.getElementById('import-btn-spinner');
      const btnIcon = document.getElementById('import-btn-icon');
      const btnText = document.getElementById('import-btn-text');

      btnSubmitImport.disabled = true;
      if (spinner) spinner.classList.remove('hidden');
      if (btnIcon) btnIcon.classList.add('hidden');
      if (btnText) btnText.textContent = `Importing ${parsedImportProducts.length} products...`;

      let importedCount = 0;
      let bulkSuccess = false;

      // 1. Try bulk_import action
      for (const url of PRODUCT_API_ENDPOINTS) {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'bulk_import',
              pharmacy_id: pharmacyId,
              products: parsedImportProducts
            })
          });

          if (res.ok) {
            const json = await res.json();
            if (json && json.success) {
              importedCount = json.total_processed || json.imported_count || parsedImportProducts.length;
              bulkSuccess = true;
              break;
            }
          }
        } catch (err) {}
      }

      // 2. If remote bulk_import didn't complete, perform individual create calls to guarantee database entry
      if (!bulkSuccess) {
        for (const item of parsedImportProducts) {
          for (const url of PRODUCT_API_ENDPOINTS) {
            try {
              const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'create',
                  pharmacy_id: pharmacyId,
                  name: item.name,
                  generic_name: item.generic_name,
                  description: item.description,
                  category_name: item.category_name,
                  manufacturer_name: item.manufacturer_name,
                  sku: item.sku,
                  selling_price: item.selling_price,
                  cost_price: item.cost_price,
                  requires_rx: item.requires_rx,
                  track_expiry: item.track_expiry
                })
              });
              if (res.ok) {
                const json = await res.json();
                if (json && json.success) {
                  importedCount++;
                  break;
                }
              }
            } catch (e) {}
          }
        }
      }

      // 3. Local fallback storage sync
      try {
        const stored = localStorage.getItem(`ezpharma_products_pharm_${pharmacyId}`);
        let currentList = stored ? JSON.parse(stored) : [];
        parsedImportProducts.forEach((np, idx) => {
          const existingIdx = currentList.findIndex(p => p.name.toLowerCase() === np.name.toLowerCase() || (np.sku && p.sku === np.sku));
          const prodObj = {
            id: Date.now() + idx,
            pharmacy_id: pharmacyId,
            name: np.name,
            generic_name: np.generic_name,
            description: np.description,
            category_name: np.category_name,
            manufacturer_name: np.manufacturer_name,
            sku: np.sku || `SKU-${Date.now() + idx}`,
            selling_price: np.selling_price,
            cost_price: np.cost_price,
            requires_rx: np.requires_rx,
            track_expiry: np.track_expiry,
            status: 'active',
            created_at: new Date().toISOString()
          };
          if (existingIdx >= 0) {
            currentList[existingIdx] = { ...currentList[existingIdx], ...prodObj };
          } else {
            currentList.push(prodObj);
          }
        });
        localStorage.setItem(`ezpharma_products_pharm_${pharmacyId}`, JSON.stringify(currentList));
        currentProducts = sortProductList(currentList);
      } catch (e) {}

      btnSubmitImport.disabled = false;
      if (spinner) spinner.classList.add('hidden');
      if (btnIcon) btnIcon.classList.remove('hidden');
      if (btnText) btnText.textContent = 'Import file';

      const totalCount = importedCount || parsedImportProducts.length;
      resetBulkImportUI();
      showToast(`✅ Successfully imported ${totalCount} product(s) to database!`);

      // 4. Reload and navigate to Product Catalog page
      productSortField = 'created_at';
      productSortAsc = false;
      navigateTo('/dashboard/products');
      loadAndRenderProducts(1);
    });
  }

  // ==============================================
  // 7.4.5. Procurement: Suppliers Management (Images 1 & 2)
  // ==============================================
  const SUPPLIER_API_ENDPOINTS = [
    '/api/suppliers.php',
    'https://api.holidaymartbd.com/ezpharma/suppliers.php'
  ];

  let currentSuppliers = [];

  const loadAndRenderSuppliers = async () => {
    const tbody = document.getElementById('suppliers-table-tbody');
    if (!tbody) return;

    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-5 text-muted">
          <div class="loading-wrap-center">
            <div class="spinner"></div>
            <span>Loading suppliers...</span>
          </div>
        </td>
      </tr>
    `;

    let suppliers = [];
    for (const url of SUPPLIER_API_ENDPOINTS) {
      try {
        const res = await fetch(`${url}?action=list&pharmacy_id=${pharmacyId}`);
        if (res.ok) {
          const json = await res.json();
          if (json && json.success && Array.isArray(json.suppliers)) {
            suppliers = json.suppliers;
            break;
          }
        }
      } catch (err) {}
    }

    if (suppliers.length > 0) {
      currentSuppliers = suppliers;
      try {
        localStorage.setItem(`ezpharma_suppliers_pharm_${pharmacyId}`, JSON.stringify(suppliers));
      } catch (e) {}
    } else {
      try {
        const local = localStorage.getItem(`ezpharma_suppliers_pharm_${pharmacyId}`);
        currentSuppliers = local ? JSON.parse(local) : [];
      } catch (e) {
        currentSuppliers = [];
      }
    }

    renderSuppliersTable(currentSuppliers);
  };

  const renderSuppliersTable = (suppliers) => {
    const tbody = document.getElementById('suppliers-table-tbody');
    if (!tbody) return;

    if (!suppliers || suppliers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-5">
            <div class="po-empty-box">
              <div class="po-empty-icon">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
              </div>
              <h4 class="po-empty-title">No suppliers added yet</h4>
              <p class="po-empty-sub">Click "+ Add supplier" to add vendors for purchase orders.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = suppliers.map(s => `
      <tr>
        <td><strong>${escapeHtml(s.name)}</strong></td>
        <td>${escapeHtml(s.phone || '—')}</td>
        <td>${escapeHtml(s.email || '—')}</td>
        <td><span class="badge-status badge-received">Active</span></td>
        <td class="text-right">
          <div class="user-action-btns justify-end">
            <button type="button" class="btn-user-action btn-user-edit btn-supplier-edit" data-id="${s.id}" title="Edit supplier">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
            </button>
            <button type="button" class="btn-user-action btn-user-delete btn-supplier-delete" data-id="${s.id}" data-name="${escapeHtml(s.name)}" title="Delete supplier">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  };

  // Supplier Modal Actions
  const modalSupplier = document.getElementById('modal-supplier-form');
  const openAddSupplierModal = () => {
    if (enforceReadOnly('Add Supplier')) return;
    document.getElementById('modal-supplier-title').textContent = 'New supplier';
    document.getElementById('supplier_form_action').value = 'create';
    document.getElementById('supplier_form_id').value = '';
    document.getElementById('supplier_input_name').value = '';
    document.getElementById('supplier_input_phone').value = '';
    document.getElementById('supplier_input_email').value = '';
    document.getElementById('supplier_input_address').value = '';
    document.getElementById('supplier_input_notes').value = '';
    if (modalSupplier) {
      modalSupplier.classList.remove('hidden');
      modalSupplier.scrollTop = 0;
    }
  };

  const openEditSupplierModal = (supId) => {
    if (enforceReadOnly('Edit Supplier')) return;
    const sup = currentSuppliers.find(s => s.id == supId);
    if (!sup) return;
    document.getElementById('modal-supplier-title').textContent = 'Edit supplier';
    document.getElementById('supplier_form_action').value = 'update';
    document.getElementById('supplier_form_id').value = sup.id;
    document.getElementById('supplier_input_name').value = sup.name || '';
    document.getElementById('supplier_input_phone').value = sup.phone || '';
    document.getElementById('supplier_input_email').value = sup.email || '';
    document.getElementById('supplier_input_address').value = sup.address || '';
    document.getElementById('supplier_input_notes').value = sup.notes || '';
    if (modalSupplier) {
      modalSupplier.classList.remove('hidden');
      modalSupplier.scrollTop = 0;
    }
  };

  const closeSupplierModal = () => {
    if (modalSupplier) modalSupplier.classList.add('hidden');
  };

  document.getElementById('btn-open-add-supplier')?.addEventListener('click', openAddSupplierModal);
  document.getElementById('btn-close-supplier-modal')?.addEventListener('click', closeSupplierModal);
  document.getElementById('btn-cancel-supplier-modal')?.addEventListener('click', closeSupplierModal);

  // Supplier Form Submit
  document.getElementById('form-supplier-management')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const action = document.getElementById('supplier_form_action').value;
    const supId = document.getElementById('supplier_form_id').value;
    const name = document.getElementById('supplier_input_name').value.trim();
    const phone = document.getElementById('supplier_input_phone').value.trim();
    const email = document.getElementById('supplier_input_email').value.trim();
    const address = document.getElementById('supplier_input_address').value.trim();
    const notes = document.getElementById('supplier_input_notes').value.trim();

    if (!name) {
      showToast('⚠️ Supplier Name is required.', true);
      return;
    }

    const spinner = document.getElementById('supplier-save-spinner');
    if (spinner) spinner.classList.remove('hidden');

    for (const url of SUPPLIER_API_ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, id: supId, pharmacy_id: pharmacyId, name, phone, email, address, notes })
        });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success) {
            break;
          }
        }
      } catch (err) {}
    }

    if (spinner) spinner.classList.add('hidden');
    closeSupplierModal();
    showToast(action === 'create' ? '✅ Supplier added successfully!' : '✅ Supplier updated successfully!');
    loadAndRenderSuppliers();
  });

  // Supplier Table Click Actions (Edit & Delete)
  document.getElementById('suppliers-table-tbody')?.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.btn-supplier-edit');
    if (editBtn) {
      openEditSupplierModal(editBtn.getAttribute('data-id'));
      return;
    }

    const delBtn = e.target.closest('.btn-supplier-delete');
    if (delBtn) {
      if (enforceReadOnly('Delete Supplier')) return;
      const sid = delBtn.getAttribute('data-id');
      const sname = delBtn.getAttribute('data-name') || 'this supplier';
      const confirmed = await showConfirmDialog({
        title: 'Delete Supplier',
        message: `Are you sure you want to delete supplier "${sname}"?`,
        confirmText: 'Delete Supplier',
        isDanger: true
      });
      if (confirmed) {
        currentSuppliers = currentSuppliers.filter(s => s.id != sid);
        renderSuppliersTable(currentSuppliers);

        for (const url of SUPPLIER_API_ENDPOINTS) {
          try {
            await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'delete', id: sid, pharmacy_id: pharmacyId })
            });
            break;
          } catch (err) {}
        }
        showToast('✅ Supplier deleted successfully!');
      }
    }
  });

  // ==============================================
  // 7.4.6. Procurement: Purchase Orders Management (Images 3, 4 & 5)
  // ==============================================
  const PO_API_ENDPOINTS = [
    'https://api.holidaymartbd.com/ezpharma/purchase_orders.php',
    '/api/purchase_orders.php'
  ];

  let currentPurchaseOrders = [];
  let poCurrentPage = 1;
  const poPerPage = 20;

  const loadAndRenderPurchaseOrders = async () => {
    const tbody = document.getElementById('purchase-orders-tbody');
    if (!tbody) return;

    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center py-5 text-muted">
          <div class="loading-wrap-center">
            <div class="spinner"></div>
            <span>Loading purchase orders...</span>
          </div>
        </td>
      </tr>
    `;

    // Ensure suppliers and products are fetched
    if (currentSuppliers.length === 0) {
      for (const url of SUPPLIER_API_ENDPOINTS) {
        try {
          const res = await fetch(`${url}?action=list&pharmacy_id=${pharmacyId}`);
          if (res.ok) {
            const json = await res.json();
            if (json && json.success) currentSuppliers = json.suppliers || [];
          }
        } catch (e) {}
      }
    }

    // Populate supplier filter dropdown
    const filterSupplierSelect = document.getElementById('po-filter-supplier');
    if (filterSupplierSelect) {
      const selectedVal = filterSupplierSelect.value;
      filterSupplierSelect.innerHTML = '<option value="">All suppliers</option>' +
        currentSuppliers.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
      filterSupplierSelect.value = selectedVal;
    }

    let orders = [];
    for (const url of PO_API_ENDPOINTS) {
      try {
        const res = await fetch(`${url}?action=list&pharmacy_id=${pharmacyId}`, { method: 'GET' });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success && Array.isArray(json.purchase_orders)) {
            orders = json.purchase_orders;
            break;
          }
        }
      } catch (err) {}
    }

    if (orders.length > 0) {
      currentPurchaseOrders = orders;
      try {
        localStorage.setItem(`ezpharma_pos_pharm_${pharmacyId}`, JSON.stringify(orders));
      } catch (e) {}
    } else {
      try {
        const local = localStorage.getItem(`ezpharma_pos_pharm_${pharmacyId}`);
        currentPurchaseOrders = local ? JSON.parse(local) : [];
      } catch (e) {
        currentPurchaseOrders = [];
      }
    }

    applyPOFiltersAndRender();
  };

  const applyPOFiltersAndRender = () => {
    const searchVal = (document.getElementById('po-search-input')?.value || '').toLowerCase().trim();
    const statusVal = document.getElementById('po-filter-status')?.value || '';
    const supplierVal = document.getElementById('po-filter-supplier')?.value || '';
    const fromDate = document.getElementById('po-filter-date-from')?.value || '';
    const toDate = document.getElementById('po-filter-date-to')?.value || '';

    let filtered = currentPurchaseOrders.filter(po => {
      if (searchVal && !((po.po_number || '').toLowerCase().includes(searchVal) || (po.supplier_name || '').toLowerCase().includes(searchVal))) {
        return false;
      }
      if (statusVal && po.status !== statusVal) return false;
      if (supplierVal && String(po.supplier_id) !== String(supplierVal)) return false;
      if (fromDate) {
        const poDate = new Date(po.created_at).toISOString().split('T')[0];
        if (poDate < fromDate) return false;
      }
      if (toDate) {
        const poDate = new Date(po.created_at).toISOString().split('T')[0];
        if (poDate > toDate) return false;
      }
      return true;
    });

    const countEl = document.getElementById('po-orders-count');
    if (countEl) countEl.textContent = filtered.length;

    renderPurchaseOrdersTable(filtered);
  };

  const renderPurchaseOrdersTable = (orders) => {
    const tbody = document.getElementById('purchase-orders-tbody');
    if (!tbody) return;

    if (!orders || orders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center py-5">
            <div class="po-empty-box">
              <div class="po-empty-icon">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
              </div>
              <h4 class="po-empty-title">No purchase orders found</h4>
              <p class="po-empty-sub">Click "+ New purchase order" to create an order.</p>
            </div>
          </td>
        </tr>
      `;
      const pageInfo = document.getElementById('po-page-info');
      if (pageInfo) pageInfo.textContent = 'Showing 0 orders';
      return;
    }

    const totalPages = Math.ceil(orders.length / poPerPage) || 1;
    if (poCurrentPage > totalPages) poCurrentPage = 1;
    const startIndex = (poCurrentPage - 1) * poPerPage;
    const pageItems = orders.slice(startIndex, startIndex + poPerPage);

    const pageInfo = document.getElementById('po-page-info');
    if (pageInfo) {
      pageInfo.textContent = `Showing ${startIndex + 1} to ${Math.min(startIndex + poPerPage, orders.length)} of ${orders.length} orders`;
    }

    const pageDisplay = document.getElementById('po-current-page-display');
    if (pageDisplay) pageDisplay.textContent = `Page ${poCurrentPage} of ${totalPages}`;

    const prevBtn = document.getElementById('po-btn-prev');
    const nextBtn = document.getElementById('po-btn-next');
    if (prevBtn) prevBtn.disabled = poCurrentPage <= 1;
    if (nextBtn) nextBtn.disabled = poCurrentPage >= totalPages;

    tbody.innerHTML = pageItems.map(po => {
      const dateStr = po.created_at ? new Date(po.created_at).toLocaleString() : '—';
      const statusClass = po.status === 'Received' ? 'badge-received' : (po.status === 'Cancelled' ? 'badge-cancelled' : 'badge-ordered');

      return `
        <tr>
          <td>
            <strong>${escapeHtml(po.po_number || `PO-${po.id}`)}</strong>
            <span class="po-item-sku-sub">${escapeHtml(dateStr)}</span>
          </td>
          <td><strong>${escapeHtml(po.supplier_name || 'Supplier #' + po.supplier_id)}</strong></td>
          <td><span class="badge-status ${statusClass}">${escapeHtml(po.status || 'Ordered')}</span></td>
          <td class="text-right">
            <div class="po-actions-cell">
              <button type="button" class="btn-po-action btn-po-view-details" data-id="${po.id}" title="View Details">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              </button>
              <button type="button" class="btn-po-action btn-po-print-row" data-id="${po.id}" title="Print Purchase Order">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              </button>
              ${po.status === 'Ordered' ? `
                <button type="button" class="btn-po-action btn-po-receive-row" data-id="${po.id}" title="Receive Stock">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                </button>
                <button type="button" class="btn-po-action btn-po-cancel" data-id="${po.id}" title="Cancel Purchase Order">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  };

  // PO Filters Listeners
  document.getElementById('po-search-input')?.addEventListener('input', applyPOFiltersAndRender);
  document.getElementById('po-filter-status')?.addEventListener('change', applyPOFiltersAndRender);
  document.getElementById('po-filter-supplier')?.addEventListener('change', applyPOFiltersAndRender);
  document.getElementById('po-filter-date-from')?.addEventListener('change', applyPOFiltersAndRender);
  document.getElementById('po-filter-date-to')?.addEventListener('change', applyPOFiltersAndRender);

  document.getElementById('po-btn-prev')?.addEventListener('click', () => {
    if (poCurrentPage > 1) {
      poCurrentPage--;
      applyPOFiltersAndRender();
    }
  });

  document.getElementById('po-btn-next')?.addEventListener('click', () => {
    poCurrentPage++;
    applyPOFiltersAndRender();
  });

  // Ensure products list is loaded from memory/cache/API
  const ensureProductsLoaded = async () => {
    if (currentProducts && currentProducts.length > 0) return currentProducts;

    try {
      const stored = localStorage.getItem(`ezpharma_products_pharm_${pharmacyId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          currentProducts = parsed;
        }
      }
    } catch (e) {}

    if (!currentProducts || currentProducts.length === 0) {
      for (const url of PRODUCT_API_ENDPOINTS) {
        try {
          const res = await fetch(`${url}?pharmacy_id=${pharmacyId}&per_page=500`, { method: 'GET' });
          if (res.ok) {
            const json = await res.json();
            if (json && json.success && Array.isArray(json.products) && json.products.length > 0) {
              currentProducts = json.products;
              localStorage.setItem(`ezpharma_products_pharm_${pharmacyId}`, JSON.stringify(currentProducts));
              break;
            }
          }
        } catch (err) {}
      }
    }

    return currentProducts || [];
  };

  // ==============================================
  // New PO Modal (Image 3 & 4)
  // ==============================================
  let poLineItems = [];
  const modalPOCreate = document.getElementById('modal-po-create');

  const openNewPOModal = async () => {
    if (enforceReadOnly('Create Purchase Order')) return;

    if (modalPOCreate) {
      modalPOCreate.classList.remove('hidden');
      modalPOCreate.scrollTop = 0;
    }

    // Reset line items with 1 default item
    poLineItems = [{
      product_id: '',
      product_name: '',
      sku: '',
      qty: 1,
      unit_cost: 0
    }];

    document.getElementById('po_create_notes').value = '';
    renderPOLineItems();

    // Ensure suppliers exist
    if (currentSuppliers.length === 0) {
      for (const url of SUPPLIER_API_ENDPOINTS) {
        try {
          const res = await fetch(`${url}?action=list&pharmacy_id=${pharmacyId}`);
          if (res.ok) {
            const json = await res.json();
            if (json && json.success) currentSuppliers = json.suppliers || [];
          }
        } catch (e) {}
      }
    }

    const supSelect = document.getElementById('po_create_supplier');
    if (supSelect) {
      supSelect.innerHTML = '<option value="">Select supplier...</option>' +
        currentSuppliers.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
    }

    // Preload products in background
    ensureProductsLoaded();
  };

  const closePOCreateModal = () => {
    if (modalPOCreate) modalPOCreate.classList.add('hidden');
  };

  // Render Searchable Product Combobox (Image 3)
  const renderPOLineItems = () => {
    const container = document.getElementById('po-line-items-container');
    if (!container) return;

    container.innerHTML = poLineItems.map((item, idx) => {
      const selectedName = item.product_name || 'Select product...';
      const isPlaceholder = !item.product_name;

      return `
        <div class="po-line-item-row" data-index="${idx}">
          <div class="form-group mb-0" style="position: relative;">
            <label style="font-size: 0.78rem; margin-bottom: 0.25rem;">Product</label>
            <div class="po-prod-combobox" data-index="${idx}">
              <div class="po-combobox-trigger" data-index="${idx}">
                <div class="po-trigger-left">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  <span class="po-selected-prod-name ${isPlaceholder ? 'placeholder' : ''}" id="po-selected-name-${idx}">${escapeHtml(selectedName)}</span>
                </div>
                <svg class="chevron-down-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>

              <!-- Dropdown Menu (Image 3) -->
              <div class="po-combobox-dropdown hidden" id="po-combobox-dropdown-${idx}">
                <div class="po-combobox-search-box">
                  <input type="text" class="po-combobox-search-input" data-index="${idx}" placeholder="Search by name, SKU, manufacturer..." />
                </div>
                <div class="po-combobox-options-list" id="po-options-list-${idx}">
                  <!-- Options populated dynamically -->
                </div>
              </div>
            </div>
          </div>
          <div class="form-group mb-0">
            <label style="font-size: 0.78rem; margin-bottom: 0.25rem;">Qty</label>
            <input type="number" class="po-line-qty-input" data-index="${idx}" min="1" value="${item.qty || 1}" />
          </div>
          <div class="form-group mb-0">
            <label style="font-size: 0.78rem; margin-bottom: 0.25rem;">Unit cost</label>
            <input type="number" class="po-line-cost-input" data-index="${idx}" step="0.01" min="0" value="${item.unit_cost || 0}" />
          </div>
          <div>
            ${poLineItems.length > 1 ? `
              <button type="button" class="btn-remove-line btn-remove-po-line" data-index="${idx}" title="Remove line">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            ` : '<div style="width: 28px;"></div>'}
          </div>
        </div>
      `;
    }).join('');

    recalculatePOTotal();
  };

  const renderComboboxOptions = async (idx, filterText = '') => {
    const listEl = document.getElementById(`po-options-list-${idx}`);
    if (!listEl) return;

    if (!currentProducts || currentProducts.length === 0) {
      listEl.innerHTML = `<div style="padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.82rem;">Loading products...</div>`;
      await ensureProductsLoaded();
    }

    const query = (filterText || '').toLowerCase().trim();
    const filtered = (currentProducts || []).filter(p => {
      if (!query) return true;
      return (p.name || '').toLowerCase().includes(query) ||
             (p.sku || '').toLowerCase().includes(query) ||
             (p.manufacturer_name || '').toLowerCase().includes(query) ||
             (p.generic_name || '').toLowerCase().includes(query);
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `<div style="padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.82rem;">No products found</div>`;
      return;
    }

    listEl.innerHTML = filtered.map(p => `
      <div class="po-combobox-option" data-line-index="${idx}" data-id="${p.id}" data-cost="${p.cost_price || 0}" data-sku="${escapeHtml(p.sku || '')}" data-name="${escapeHtml(p.name)}">
        <div class="po-opt-top">
          <strong class="po-opt-name">${escapeHtml(p.name)}</strong>
          ${p.sku ? `<span class="po-opt-sku">${escapeHtml(p.sku)}</span>` : ''}
        </div>
        <div class="po-opt-bottom">
          Cost ${formatPrice(p.cost_price || 0)}${p.manufacturer_name ? ` · ${escapeHtml(p.manufacturer_name)}` : ''}
        </div>
      </div>
    `).join('');
  };

  const recalculatePOTotal = () => {
    let total = 0;
    poLineItems.forEach(item => {
      const q = parseFloat(item.qty) || 0;
      const c = parseFloat(item.unit_cost) || 0;
      total += (q * c);
    });

    const totalEl = document.getElementById('po-est-total-display');
    if (totalEl) totalEl.textContent = formatPrice(total);
  };

  // Combobox click & search delegation
  document.addEventListener('click', (e) => {
    // 1. Toggle Combobox Trigger
    const trigger = e.target.closest('.po-combobox-trigger');
    if (trigger) {
      e.stopPropagation();
      const idx = trigger.getAttribute('data-index');
      const dropdown = document.getElementById(`po-combobox-dropdown-${idx}`);
      const isOpen = !dropdown.classList.contains('hidden');

      // Close all other dropdowns
      document.querySelectorAll('.po-combobox-dropdown').forEach(d => d.classList.add('hidden'));
      document.querySelectorAll('.po-combobox-trigger').forEach(t => t.classList.remove('open'));

      if (!isOpen) {
        dropdown.classList.remove('hidden');
        trigger.classList.add('open');
        renderComboboxOptions(idx);
        const searchInput = dropdown.querySelector('.po-combobox-search-input');
        if (searchInput) {
          searchInput.value = '';
          setTimeout(() => searchInput.focus(), 50);
        }
      }
      return;
    }

    // 2. Select Option
    const option = e.target.closest('.po-combobox-option');
    if (option) {
      e.stopPropagation();
      const lineIdx = parseInt(option.getAttribute('data-line-index'), 10);
      const prodId = option.getAttribute('data-id');
      const prodName = option.getAttribute('data-name');
      const sku = option.getAttribute('data-sku');
      const cost = parseFloat(option.getAttribute('data-cost')) || 0;

      if (!isNaN(lineIdx) && poLineItems[lineIdx]) {
        poLineItems[lineIdx].product_id = prodId;
        poLineItems[lineIdx].product_name = prodName;
        poLineItems[lineIdx].sku = sku;
        poLineItems[lineIdx].unit_cost = cost;

        const nameDisplay = document.getElementById(`po-selected-name-${lineIdx}`);
        if (nameDisplay) {
          nameDisplay.textContent = prodName;
          nameDisplay.classList.remove('placeholder');
        }

        const costInput = document.querySelector(`.po-line-cost-input[data-index="${lineIdx}"]`);
        if (costInput) costInput.value = cost;

        recalculatePOTotal();
      }

      // Close dropdowns
      document.querySelectorAll('.po-combobox-dropdown').forEach(d => d.classList.add('hidden'));
      document.querySelectorAll('.po-combobox-trigger').forEach(t => t.classList.remove('open'));
      return;
    }

    // 3. Close when clicking outside combobox
    if (!e.target.closest('.po-prod-combobox')) {
      document.querySelectorAll('.po-combobox-dropdown').forEach(d => d.classList.add('hidden'));
      document.querySelectorAll('.po-combobox-trigger').forEach(t => t.classList.remove('open'));
    }
  });

  // Combobox Search Input listener
  document.addEventListener('input', (e) => {
    if (e.target.classList.contains('po-combobox-search-input')) {
      const idx = e.target.getAttribute('data-index');
      renderComboboxOptions(idx, e.target.value);
    }
  });

  // Line items Qty & Cost inputs
  document.getElementById('po-line-items-container')?.addEventListener('input', (e) => {
    const idx = parseInt(e.target.getAttribute('data-index'), 10);
    if (isNaN(idx) || !poLineItems[idx]) return;

    if (e.target.classList.contains('po-line-qty-input')) {
      poLineItems[idx].qty = Math.max(1, parseInt(e.target.value, 10) || 1);
      recalculatePOTotal();
    } else if (e.target.classList.contains('po-line-cost-input')) {
      poLineItems[idx].unit_cost = Math.max(0, parseFloat(e.target.value) || 0);
      recalculatePOTotal();
    }
  });

  document.getElementById('po-line-items-container')?.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.btn-remove-po-line');
    if (removeBtn) {
      const idx = parseInt(removeBtn.getAttribute('data-index'), 10);
      if (!isNaN(idx) && poLineItems.length > 1) {
        poLineItems.splice(idx, 1);
        renderPOLineItems();
      }
    }
  });

  document.getElementById('btn-add-po-line')?.addEventListener('click', () => {
    poLineItems.push({
      product_id: '',
      product_name: '',
      sku: '',
      qty: 1,
      unit_cost: 0
    });
    renderPOLineItems();
  });

  document.getElementById('btn-open-new-po')?.addEventListener('click', openNewPOModal);
  document.getElementById('btn-close-po-create')?.addEventListener('click', closePOCreateModal);
  document.getElementById('btn-cancel-po-create')?.addEventListener('click', closePOCreateModal);

  // Submit New PO
  document.getElementById('form-po-create')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const supplierId = document.getElementById('po_create_supplier').value;
    const notes = document.getElementById('po_create_notes').value.trim();

    if (!supplierId) {
      showToast('⚠️ Please select a supplier.', true);
      return;
    }

    const validItems = poLineItems.filter(item => item.product_id || item.product_name);
    if (validItems.length === 0) {
      showToast('⚠️ Please select at least one product in line items.', true);
      return;
    }

    const spinner = document.getElementById('po-create-spinner');
    const btnText = document.getElementById('btn-create-po-text');
    if (spinner) spinner.classList.remove('hidden');
    if (btnText) btnText.textContent = 'Creating...';

    // Generate PO-YYYYMMDD001 format
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const datePrefix = `PO-${yyyy}${mm}${dd}`;
    const todayOrders = (currentPurchaseOrders || []).filter(o => o.po_number && o.po_number.startsWith(datePrefix));
    const nextSeq = String(todayOrders.length + 1).padStart(3, '0');
    const customPONumber = `${datePrefix}${nextSeq}`;

    let createdPO = null;

    for (const url of PO_API_ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            pharmacy_id: pharmacyId,
            po_number: customPONumber,
            supplier_id: supplierId,
            notes,
            items: validItems
          })
        });

        if (res.ok) {
          const json = await res.json();
          if (json && json.success) {
            createdPO = json;
            break;
          }
        }
      } catch (err) {}
    }

    if (spinner) spinner.classList.add('hidden');
    if (btnText) btnText.textContent = 'Create order';

    closePOCreateModal();
    showToast('✅ Purchase order created successfully!');
    loadAndRenderPurchaseOrders();
  });

  // ==============================================
  // View PO Details Modal (Image 5)
  // ==============================================
  const modalPODetails = document.getElementById('modal-po-details');
  let activeDetailPO = null;

  const openPODetailsModal = async (poId) => {
    let poData = null;

    for (const url of PO_API_ENDPOINTS) {
      try {
        const res = await fetch(`${url}?action=get&id=${poId}&pharmacy_id=${pharmacyId}`);
        if (res.ok) {
          const json = await res.json();
          if (json && json.success && json.purchase_order) {
            poData = json.purchase_order;
            break;
          }
        }
      } catch (err) {}
    }

    if (!poData) {
      poData = currentPurchaseOrders.find(p => p.id == poId);
    }

    if (!poData) {
      showToast('⚠️ Could not load purchase order details.', true);
      return;
    }

    activeDetailPO = poData;

    // Header info
    document.getElementById('po-details-number').textContent = poData.po_number || `PO-${poData.id}`;
    const statusBadge = document.getElementById('po-details-status-badge');
    if (statusBadge) {
      statusBadge.textContent = poData.status || 'Ordered';
      statusBadge.className = `badge-status ${poData.status === 'Received' ? 'badge-received' : (poData.status === 'Cancelled' ? 'badge-cancelled' : 'badge-ordered')}`;
    }

    const dateStr = poData.created_at ? new Date(poData.created_at).toLocaleString() : '—';
    document.getElementById('po-details-timestamp').textContent = `Ordered ${dateStr}`;

    // Supplier info (Image 5)
    document.getElementById('po-details-supplier-name').textContent = poData.supplier_name || 'Vendor';
    const contactLine = [poData.supplier_phone, poData.supplier_email].filter(Boolean).join(' · ');
    document.getElementById('po-details-supplier-contact').textContent = contactLine || 'No contact details';
    document.getElementById('po-details-supplier-address').textContent = poData.supplier_address || 'No address provided';

    // Items table (Image 5)
    const itemsTbody = document.getElementById('po-details-items-tbody');
    const items = poData.items && poData.items.length > 0 ? poData.items : [
      { product_name: 'Item', sku: '—', qty: 1, received_qty: poData.status === 'Received' ? 1 : 0, unit_cost: poData.total_amount || 0, total_cost: poData.total_amount || 0 }
    ];

    itemsTbody.innerHTML = items.map(item => `
      <tr>
        <td>
          <strong>${escapeHtml(item.product_name || 'Item')}</strong>
          <span class="po-item-sku-sub">${escapeHtml(item.sku || '—')}</span>
        </td>
        <td class="text-center">${item.qty || 1}</td>
        <td class="text-center">${item.received_qty || 0}</td>
        <td class="text-right">${formatPrice(item.unit_cost || 0)}</td>
        <td class="text-right"><strong>${formatPrice(item.total_cost || ((item.qty || 1) * (item.unit_cost || 0)))}</strong></td>
      </tr>
    `).join('');

    document.getElementById('po-details-grand-total').textContent = formatPrice(poData.total_amount || 0);

    // Toggle receive button visibility
    const recvBtn = document.getElementById('btn-po-receive-stock');
    if (recvBtn) {
      recvBtn.style.display = poData.status === 'Ordered' ? 'inline-flex' : 'none';
    }

    if (modalPODetails) {
      modalPODetails.classList.remove('hidden');
      modalPODetails.scrollTop = 0;
    }
  };

  const closePODetailsModal = () => {
    if (modalPODetails) modalPODetails.classList.add('hidden');
  };

  document.getElementById('btn-close-po-details')?.addEventListener('click', closePODetailsModal);
  document.getElementById('btn-close-po-details-btn')?.addEventListener('click', closePODetailsModal);

  // ==============================================
  // Receive Stock Modal (Image 4)
  // ==============================================
  const modalPOReceive = document.getElementById('modal-po-receive');
  let activeReceivePO = null;

  const openPOReceiveModal = async (poId) => {
    if (enforceReadOnly('Receive Stock')) return;

    let poData = currentPurchaseOrders.find(p => p.id == poId);
    if (!poData || !poData.items) {
      for (const url of PO_API_ENDPOINTS) {
        try {
          const res = await fetch(`${url}?action=get&id=${poId}&pharmacy_id=${pharmacyId}`);
          if (res.ok) {
            const json = await res.json();
            if (json && json.success && json.purchase_order) {
              poData = json.purchase_order;
              break;
            }
          }
        } catch (e) {}
      }
    }

    if (!poData) {
      showToast('⚠️ Could not load purchase order details.', true);
      return;
    }

    activeReceivePO = poData;
    document.getElementById('po_receive_target_id').value = poData.id;
    document.getElementById('po-receive-modal-number').textContent = poData.po_number || `PO-${poData.id}`;
    document.getElementById('po-receive-modal-supplier').textContent = poData.supplier_name || 'Vendor';

    const container = document.getElementById('po-receive-items-container');
    const items = poData.items && poData.items.length > 0 ? poData.items : [
      { id: 1, product_id: 1, product_name: 'Product', sku: 'SKU', qty: 1, received_qty: 0, unit_cost: 0 }
    ];

    container.innerHTML = items.map(item => {
      const remaining = Math.max(1, (item.qty || 1) - (item.received_qty || 0));
      return `
        <div class="po-receive-item-card" data-item-id="${item.id}" data-prod-id="${item.product_id || ''}">
          <div class="po-receive-card-head">
            <h4 class="po-receive-prod-name">${escapeHtml(item.product_name)}</h4>
            <p class="po-receive-prod-sub">
              SKU ${escapeHtml(item.sku || '—')} · Ordered ${item.qty || 1} · Received ${item.received_qty || 0} · Remaining ${remaining} · Unit cost ${formatPrice(item.unit_cost || 0)}
            </p>
          </div>
          <div class="po-receive-fields-grid">
            <div class="form-group mb-0">
              <label>Qty</label>
              <input type="number" class="po-recv-qty" min="1" max="${remaining}" value="${remaining}" required />
            </div>
            <div class="form-group mb-0">
              <label>Batch *</label>
              <input type="text" class="po-recv-batch" placeholder="Batch / lot number" required />
            </div>
            <div class="form-group mb-0">
              <label>Expiry</label>
              <input type="date" class="po-recv-expiry" placeholder="mm/dd/yyyy" />
            </div>
          </div>
          <div class="po-receive-fields-grid-lower">
            <div class="form-group mb-0">
              <label>Location</label>
              <input type="text" class="po-recv-location" value="Main" placeholder="e.g. Main / Shelf A" />
            </div>
            <div class="form-group mb-0">
              <label>Reorder level</label>
              <input type="number" class="po-recv-reorder" min="0" value="0" />
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (modalPODetails) modalPODetails.classList.add('hidden');
    if (modalPOReceive) {
      modalPOReceive.classList.remove('hidden');
      modalPOReceive.scrollTop = 0;
    }
  };

  const closePOReceiveModal = () => {
    if (modalPOReceive) modalPOReceive.classList.add('hidden');
  };

  document.getElementById('btn-close-po-receive')?.addEventListener('click', closePOReceiveModal);
  document.getElementById('btn-cancel-po-receive')?.addEventListener('click', closePOReceiveModal);

  // Submit Receive Stock to Backend Database (Image 4)
  document.getElementById('form-po-receive-stock')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (enforceReadOnly('Receive Stock')) return;

    const poId = document.getElementById('po_receive_target_id').value;
    const cards = document.querySelectorAll('.po-receive-item-card');
    const receiveItems = [];

    let hasError = false;
    cards.forEach(card => {
      const itemId = card.getAttribute('data-item-id');
      const prodId = card.getAttribute('data-prod-id');
      const qty = parseInt(card.querySelector('.po-recv-qty')?.value, 10) || 1;
      const batch = card.querySelector('.po-recv-batch')?.value.trim();
      const expiry = card.querySelector('.po-recv-expiry')?.value;
      const location = card.querySelector('.po-recv-location')?.value.trim() || 'Main';
      const reorder = parseInt(card.querySelector('.po-recv-reorder')?.value, 10) || 0;

      if (!batch) {
        hasError = true;
        card.querySelector('.po-recv-batch')?.focus();
      }

      receiveItems.push({
        item_id: itemId,
        product_id: prodId,
        qty,
        batch_number: batch,
        expiry_date: expiry,
        location,
        reorder_level: reorder
      });
    });

    if (hasError) {
      showToast('⚠️ Please enter batch numbers for all received items.', true);
      return;
    }

    const spinner = document.getElementById('po-receive-spinner');
    const btnText = document.getElementById('btn-po-receive-text');
    if (spinner) spinner.classList.remove('hidden');
    if (btnText) btnText.textContent = 'Receiving...';

    let receiveSuccess = false;
    // 1. Try atomic receive_stock on STOCK_API_ENDPOINTS
    for (const url of STOCK_API_ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'receive_stock',
            id: poId,
            pharmacy_id: pharmacyId,
            items: receiveItems
          })
        });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success) {
            receiveSuccess = true;
            break;
          }
        }
      } catch (err) {}
    }

    // 2. Try atomic receive_stock on PO_API_ENDPOINTS if not succeeded
    if (!receiveSuccess) {
      for (const url of PO_API_ENDPOINTS) {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'receive_stock',
              id: poId,
              pharmacy_id: pharmacyId,
              items: receiveItems
            })
          });
          if (res.ok) {
            const json = await res.json();
            if (json && json.success) {
              receiveSuccess = true;
              break;
            }
          }
        } catch (err) {}
      }
    }

    // 3. Fallback: Add each batch directly via action: 'add' on stock.php and update PO status
    if (!receiveSuccess) {
      for (const item of receiveItems) {
        if (!item.product_id || !item.batch_number) continue;
        for (const url of STOCK_API_ENDPOINTS) {
          try {
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'add',
                pharmacy_id: pharmacyId,
                product_id: item.product_id,
                batch_number: item.batch_number,
                quantity: item.qty,
                location: item.location,
                reorder_level: item.reorder_level,
                expiry_date: item.expiry_date
              })
            });
            if (res.ok) {
              const json = await res.json();
              if (json && json.success) break;
            }
          } catch (err) {}
        }
      }

      // Update PO status to Received
      for (const url of PO_API_ENDPOINTS) {
        try {
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update_status',
              id: poId,
              status: 'Received',
              pharmacy_id: pharmacyId
            })
          });
          break;
        } catch (err) {}
      }
    }

    if (spinner) spinner.classList.add('hidden');
    if (btnText) btnText.textContent = 'Confirm receive';

    closePOReceiveModal();
    showToast('📦 Stock successfully received into inventory!');
    navigateTo('/dashboard/stock');
  });

  document.getElementById('btn-po-receive-stock')?.addEventListener('click', () => {
    if (activeDetailPO) openPOReceiveModal(activeDetailPO.id);
  });

  // Download PO PDF (Matching Image 2 Design)
  const downloadPurchaseOrderPDF = async (po) => {
    if (!po) return;

    showToast('📄 Generating Purchase Order PDF...');

    // Fetch full PO if items missing
    if (!po.items || po.items.length === 0) {
      for (const url of PO_API_ENDPOINTS) {
        try {
          const res = await fetch(`${url}?action=get&id=${po.id}&pharmacy_id=${pharmacyId}`);
          if (res.ok) {
            const json = await res.json();
            if (json && json.success && json.purchase_order) {
              po = json.purchase_order;
              break;
            }
          }
        } catch (e) {}
      }
    }

    const currentSettings = getStoredPharmacySettings();
    const pharmacyName = (currentSettings && currentSettings.business_name) || (currentPharm && currentPharm.name) || sessionData.pharmacy_name || 'Demo Pharmacy';
    const formattedDate = po.created_at ? new Date(po.created_at).toLocaleString() : new Date().toLocaleString();
    const poNumber = po.po_number || `PO-${po.id}`;
    const statusText = po.status || 'Ordered';

    const formatPDFPrice = (amount) => {
      const sym = getActiveCurrencySymbol();
      const num = parseFloat(amount || 0);
      const formattedNum = num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      let pdfSym = sym;
      if (sym === '৳' || sym.includes('৳') || sym.includes('BDT') || sym.includes('Taka')) {
        pdfSym = 'Tk';
      } else if (sym === '₹') {
        pdfSym = 'Rs';
      }
      return `${pdfSym} ${formattedNum}`;
    };

    const items = po.items && po.items.length > 0 ? po.items : [
      { product_name: 'Item', sku: '—', qty: 1, received_qty: 0, unit_cost: po.total_amount || 0, total_cost: po.total_amount || 0 }
    ];

    try {
      const { jsPDF } = window.jspdf || {};
      if (jsPDF) {
        const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });

        // Header
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(15, 23, 42); // #0f172a
        doc.text('Purchase Order', 40, 55);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.5);
        doc.setTextColor(71, 85, 105); // #475569
        doc.text(pharmacyName, 40, 72);

        // PO Number top right
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(15, 23, 42);
        doc.text(poNumber, 555, 52, { align: 'right' });

        // Status Badge pill
        if (statusText === 'Received') {
          doc.setFillColor(220, 252, 231); // #dcfce7
          doc.roundedRect(485, 60, 70, 16, 8, 8, 'F');
          doc.setTextColor(22, 101, 52); // #166534
        } else if (statusText === 'Cancelled') {
          doc.setFillColor(254, 226, 226); // #fee2e2
          doc.roundedRect(485, 60, 70, 16, 8, 8, 'F');
          doc.setTextColor(153, 27, 27); // #991b1b
        } else {
          doc.setFillColor(241, 245, 249); // #f1f5f9
          doc.roundedRect(485, 60, 70, 16, 8, 8, 'F');
          doc.setTextColor(71, 85, 105); // #475569
        }
        doc.setFontSize(8.5);
        doc.text(statusText, 520, 71, { align: 'center' });

        // Divider
        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(1.8);
        doc.line(40, 90, 555, 90);

        // Supplier info
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139); // #64748b
        doc.text('Supplier', 40, 112);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(po.supplier_name || 'Vendor', 40, 126);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        let currY = 140;
        if (po.supplier_phone) {
          doc.text(String(po.supplier_phone), 40, currY);
          currY += 12;
        }
        if (po.supplier_email) {
          doc.text(String(po.supplier_email), 40, currY);
          currY += 12;
        }
        if (po.supplier_address) {
          const splitAddr = doc.splitTextToSize(String(po.supplier_address), 320);
          doc.text(splitAddr, 40, currY);
          currY += (splitAddr.length * 12);
        }

        // Order Date top right
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text('Order date', 555, 112, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(51, 65, 85);
        doc.text(formattedDate, 555, 126, { align: 'right' });

        // Items Table
        const tableBody = items.map(i => [
          { content: `${i.product_name || 'Product'}\n${i.sku || '—'}` },
          { content: String(i.qty || 1), styles: { halign: 'right' } },
          { content: String(i.received_qty || 0), styles: { halign: 'right' } },
          { content: formatPDFPrice(i.unit_cost || 0), styles: { halign: 'right' } },
          { content: formatPDFPrice(i.total_cost || ((i.qty || 1) * (i.unit_cost || 0))), styles: { halign: 'right', fontStyle: 'bold' } }
        ]);

        const startTableY = Math.max(currY + 15, 175);

        doc.autoTable({
          startY: startTableY,
          margin: { left: 40, right: 40 },
          head: [['ITEM', 'QTY', 'RECEIVED', 'UNIT COST', 'LINE TOTAL']],
          body: tableBody,
          foot: [
            [
              { content: 'Total', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fontSize: 10, textColor: [15, 23, 42] } },
              { content: formatPDFPrice(po.total_amount || 0), styles: { halign: 'right', fontStyle: 'bold', fontSize: 10, textColor: [15, 23, 42] } }
            ]
          ],
          theme: 'plain',
          headStyles: {
            textColor: [15, 23, 42],
            fontStyle: 'bold',
            fontSize: 8.5,
            fillColor: [255, 255, 255],
            lineWidth: { bottom: 1, top: 0, left: 0, right: 0 },
            lineColor: [203, 213, 225]
          },
          bodyStyles: {
            textColor: [51, 65, 85],
            fontSize: 9,
            cellPadding: { top: 7, bottom: 7, left: 0, right: 10 },
            lineWidth: { bottom: 0.5, top: 0, left: 0, right: 0 },
            lineColor: [241, 245, 249]
          },
          footStyles: {
            fillColor: [255, 255, 255],
            lineWidth: { top: 1, bottom: 0, left: 0, right: 0 },
            lineColor: [203, 213, 225],
            cellPadding: { top: 10, bottom: 10, left: 0, right: 10 }
          },
          columnStyles: {
            0: { cellWidth: 230 },
            1: { halign: 'right', cellWidth: 60 },
            2: { halign: 'right', cellWidth: 70 },
            3: { halign: 'right', cellWidth: 75 },
            4: { halign: 'right', cellWidth: 80 }
          }
        });

        let finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 25 : startTableY + 150;

        // Notes Box
        if (po.notes) {
          doc.setDrawColor(203, 213, 225);
          doc.setLineWidth(2.5);
          doc.line(40, finalY, 40, finalY + 30);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9.5);
          doc.setTextColor(15, 23, 42);
          doc.text('Notes', 48, finalY + 10);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(51, 65, 85);
          const splitNotes = doc.splitTextToSize(String(po.notes), 500);
          doc.text(splitNotes, 48, finalY + 22);
        }

        doc.save(`${poNumber}.pdf`);
        showToast('✅ Purchase Order PDF downloaded successfully!');
        return;
      }
    } catch (err) {
      console.error('jsPDF error:', err);
    }

    window.print();
  };

  document.getElementById('btn-po-print-details')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (activeDetailPO) downloadPurchaseOrderPDF(activeDetailPO);
  });

  // Table row click actions
  document.getElementById('purchase-orders-tbody')?.addEventListener('click', async (e) => {
    const viewBtn = e.target.closest('.btn-po-view-details');
    if (viewBtn) {
      openPODetailsModal(viewBtn.getAttribute('data-id'));
      return;
    }

    const printBtn = e.target.closest('.btn-po-print-row');
    if (printBtn) {
      const pid = printBtn.getAttribute('data-id');
      let po = currentPurchaseOrders.find(p => p.id == pid);
      if (!po) po = { id: pid };
      downloadPurchaseOrderPDF(po);
      return;
    }

    const recvBtn = e.target.closest('.btn-po-receive-row');
    if (recvBtn) {
      openPOReceiveModal(recvBtn.getAttribute('data-id'));
      return;
    }

    const cancelBtn = e.target.closest('.btn-po-cancel');
    if (cancelBtn) {
      if (enforceReadOnly('Cancel Purchase Order')) return;
      const pid = cancelBtn.getAttribute('data-id');
      const confirmed = await showConfirmDialog({
        title: 'Cancel Purchase Order',
        message: 'Are you sure you want to cancel this purchase order?',
        confirmText: 'Cancel Order',
        isDanger: true
      });
      if (confirmed) {
        for (const url of PO_API_ENDPOINTS) {
          try {
            await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'update_status', id: pid, status: 'Cancelled', pharmacy_id: pharmacyId })
            });
            break;
          } catch (err) {}
        }
        showToast('✅ Purchase order cancelled.');
        loadAndRenderPurchaseOrders();
      }
    }
  });

  // ==============================================
  // 7.4.4. Stock Management Logic (Image 3 & 5)
  // ==============================================
  const STOCK_API_ENDPOINTS = [
    'https://api.holidaymartbd.com/ezpharma/stock.php',
    '/api/stock.php'
  ];

  let currentStockBatches = [];
  let stockSummaryCounts = { total: 0, low_stock: 0, out_of_stock: 0, expiring_soon: 0, expired: 0 };
  let stockCurrentPage = 1;
  let stockPerPage = 20;
  let stockSortField = 'created_at';
  let stockSortAsc = false;
  let stockSearchQuery = '';
  let stockFilterLowStock = false;
  let stockFilterExpiringSoon = false;

  const loadAndRenderStock = async (page = 1) => {
    stockCurrentPage = page;
    const tbody = document.getElementById('stock-table-tbody');
    if (tbody && currentStockBatches.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-muted">Loading stock inventory...</td></tr>`;
    }

    ensureProductsLoaded();

    let batches = [];
    for (const url of STOCK_API_ENDPOINTS) {
      try {
        const queryParams = new URLSearchParams({
          pharmacy_id: pharmacyId,
          search: stockSearchQuery,
          low_stock: stockFilterLowStock ? '1' : '0',
          expiring_soon: stockFilterExpiringSoon ? '1' : '0',
          sort: stockSortField,
          order: stockSortAsc ? 'ASC' : 'DESC'
        });

        const res = await fetch(`${url}?${queryParams.toString()}`, { method: 'GET' });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success && Array.isArray(json.batches)) {
            batches = json.batches;
            if (json.counts) stockSummaryCounts = json.counts;
            break;
          }
        }
      } catch (e) {}
    }

    // Filter out any legacy demo stock batches (Burnsil, Oculip, Azmasol, etc.)
    batches = batches.filter(b => {
      const pName = (b.product_name || '').toLowerCase();
      const bNum = (b.batch_number || '').toUpperCase();
      const sku = (b.product_sku || '').toUpperCase();
      if (pName.includes('burnsil') || pName.includes('oculip') || pName.includes('azmasol') || bNum === 'BATCH789' || bNum === 'BATCH123' || bNum === 'BATCH456' || sku === 'BRN-CRM-01' || sku === 'OCU-DRP-01' || sku === 'AZM-INH-01') {
        return false;
      }
      return true;
    });

    currentStockBatches = batches;
    try {
      localStorage.setItem(`ezpharma_stock_pharm_${pharmacyId}`, JSON.stringify(batches));
    } catch (e) {}

    renderStockTable(currentStockBatches, page, stockPerPage);
  };

  const renderStockTable = (batches, page = 1, perPage = 20) => {
    const tbody = document.getElementById('stock-table-tbody');
    const countLabel = document.getElementById('stock-count-label');
    const pageInfo = document.getElementById('stock-page-info');
    const pageDisplay = document.getElementById('stock-current-page-display');
    const prevBtn = document.getElementById('stock-btn-prev');
    const nextBtn = document.getElementById('stock-btn-next');

    if (!tbody) return;

    if (!batches || batches.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-5 text-muted">
            No stock batches found. Click <strong>+ Add Inventory</strong> or receive a Purchase Order to add stock.
          </td>
        </tr>
      `;
      if (countLabel) countLabel.textContent = 'Showing 0 to 0 of 0 results';
      if (pageInfo) pageInfo.textContent = 'Showing 0 results';
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      return;
    }

    const totalPages = Math.ceil(batches.length / perPage) || 1;
    if (page > totalPages) page = 1;
    const startIdx = (page - 1) * perPage;
    const pageItems = batches.slice(startIdx, startIdx + perPage);

    if (countLabel) {
      countLabel.textContent = `Showing ${startIdx + 1} to ${Math.min(startIdx + perPage, batches.length)} of ${batches.length} results`;
    }
    if (pageInfo) {
      pageInfo.textContent = `Showing ${startIdx + 1} to ${Math.min(startIdx + perPage, batches.length)} of ${batches.length} results`;
    }
    if (pageDisplay) pageDisplay.textContent = `Page ${page} of ${totalPages}`;
    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextBtn) nextBtn.disabled = page >= totalPages;

    const todayStr = new Date().toISOString().split('T')[0];

    tbody.innerHTML = pageItems.map(b => {
      const reorderLvl = parseInt(b.reorder_level || 0, 10);
      const batchQty = parseInt(b.quantity || 0, 10);

      const isExpired = b.expiry_date && b.expiry_date < todayStr;
      const isExpiringSoon = b.expiry_date && !isExpired && (new Date(b.expiry_date) - new Date() <= 90 * 86400000);
      const isLowStock = batchQty <= reorderLvl && batchQty > 0;
      const isOutOfStock = batchQty === 0;

      // Expiry display
      let expiryHtml = '—';
      if (b.expiry_date) {
        const parts = b.expiry_date.split('-');
        const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : b.expiry_date;
        if (isExpired) {
          expiryHtml = `<span class="stock-date-expired">${escapeHtml(formattedDate)} ⚠️</span>`;
        } else {
          expiryHtml = escapeHtml(formattedDate);
        }
      }

      // Quantity display
      let qtyHtml = b.quantity;
      if (isOutOfStock || isLowStock) {
        qtyHtml = `<span class="stock-qty-warning">${b.quantity} ⚠️</span>`;
      }

      // Status Badges
      let statusBadges = [];
      if (isOutOfStock) {
        statusBadges.push('<span class="badge-status badge-out-of-stock">Out of Stock</span>');
      }
      if (isExpired) {
        statusBadges.push('<span class="badge-status badge-expired">Expired</span>');
      }
      if (isLowStock && !isOutOfStock) {
        statusBadges.push('<span class="badge-status badge-low-stock">Low Stock</span>');
      }
      if (statusBadges.length === 0) {
        statusBadges.push('<span class="badge-status badge-good">Good</span>');
      }

      return `
        <tr>
          <td>
            <strong>${escapeHtml(b.product_name)}</strong>
            <span class="po-item-sku-sub">SKU: ${escapeHtml(b.product_sku || 'N/A')}</span>
          </td>
          <td>${escapeHtml(b.batch_number)}</td>
          <td>
            ${qtyHtml}
            <span class="stock-qty-sub">Reorder at: ${b.reorder_level || 0}</span>
          </td>
          <td>${escapeHtml(b.location || 'Main')}</td>
          <td>${expiryHtml}</td>
          <td>${statusBadges.join(' ')}</td>
          <td class="text-right">
            <div class="user-action-btns" style="justify-content: flex-end;">
              <button type="button" class="btn-user-action btn-stock-delete" data-id="${b.id}" data-name="${escapeHtml(b.product_name)}" data-batch="${escapeHtml(b.batch_number)}" title="Delete Batch">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  };

  // Stock Filter Events
  document.getElementById('stock-search-input')?.addEventListener('input', (e) => {
    stockSearchQuery = e.target.value.trim();
    loadAndRenderStock(1);
  });

  document.getElementById('stock-pill-low-stock')?.addEventListener('click', (e) => {
    stockFilterLowStock = !stockFilterLowStock;
    e.target.classList.toggle('active', stockFilterLowStock);
    loadAndRenderStock(1);
  });

  document.getElementById('stock-pill-expiring-soon')?.addEventListener('click', (e) => {
    stockFilterExpiringSoon = !stockFilterExpiringSoon;
    e.target.classList.toggle('active', stockFilterExpiringSoon);
    loadAndRenderStock(1);
  });

  document.getElementById('stock-sort-by')?.addEventListener('change', (e) => {
    stockSortField = e.target.value;
    loadAndRenderStock(1);
  });

  document.getElementById('stock-btn-sort-order')?.addEventListener('click', () => {
    stockSortAsc = !stockSortAsc;
    const icon = document.getElementById('stock-sort-order-icon');
    if (icon) icon.textContent = stockSortAsc ? '↑' : '↓';
    loadAndRenderStock(1);
  });

  document.getElementById('stock-per-page')?.addEventListener('change', (e) => {
    stockPerPage = parseInt(e.target.value, 10) || 20;
    renderStockTable(currentStockBatches, 1, stockPerPage);
  });

  document.getElementById('stock-btn-prev')?.addEventListener('click', () => {
    if (stockCurrentPage > 1) {
      stockCurrentPage--;
      renderStockTable(currentStockBatches, stockCurrentPage, stockPerPage);
    }
  });

  document.getElementById('stock-btn-next')?.addEventListener('click', () => {
    stockCurrentPage++;
    renderStockTable(currentStockBatches, stockCurrentPage, stockPerPage);
  });

  // Delete Stock Batch
  document.getElementById('stock-table-tbody')?.addEventListener('click', async (e) => {
    const delBtn = e.target.closest('.btn-stock-delete');
    if (delBtn) {
      if (enforceReadOnly('Delete Inventory Batch')) return;
      const batchId = delBtn.getAttribute('data-id');
      const prodName = delBtn.getAttribute('data-name');
      const batchNo = delBtn.getAttribute('data-batch');

      const confirmed = await showConfirmDialog({
        title: 'Delete Stock Batch',
        message: `Are you sure you want to delete Batch "${batchNo}" of ${prodName}? This will remove it from inventory.`,
        confirmText: 'Delete Batch',
        isDanger: true
      });

      if (confirmed) {
        for (const url of STOCK_API_ENDPOINTS) {
          try {
            await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'delete', id: batchId, pharmacy_id: pharmacyId })
            });
            break;
          } catch (err) {}
        }
        showToast('🗑️ Stock batch removed from inventory.');
        loadAndRenderStock(stockCurrentPage);
      }
    }
  });

  // ==============================================
  // Add Inventory Modal (Image 5)
  // ==============================================
  const modalAddInventory = document.getElementById('modal-add-inventory');

  const openAddInventoryModal = async () => {
    if (enforceReadOnly('Add Inventory')) return;

    await ensureProductsLoaded();

    const prodSelect = document.getElementById('inv_product_id');
    if (prodSelect) {
      prodSelect.innerHTML = '<option value="">Search by product name or generic name...</option>' +
        currentProducts.map(p => `<option value="${p.id}">${escapeHtml(p.name)} ${p.sku ? `(${escapeHtml(p.sku)})` : ''}</option>`).join('');
    }

    document.getElementById('inv_batch_number').value = '';
    document.getElementById('inv_quantity').value = '';
    document.getElementById('inv_location').value = 'Main';
    document.getElementById('inv_reorder_level').value = '0';
    document.getElementById('inv_expiry_date').value = '';

    if (modalAddInventory) {
      modalAddInventory.classList.remove('hidden');
      modalAddInventory.scrollTop = 0;
    }
  };

  const closeAddInventoryModal = () => {
    if (modalAddInventory) modalAddInventory.classList.add('hidden');
  };

  document.getElementById('btn-open-add-inventory')?.addEventListener('click', openAddInventoryModal);
  document.getElementById('btn-close-add-inventory')?.addEventListener('click', closeAddInventoryModal);
  document.getElementById('btn-cancel-add-inventory')?.addEventListener('click', closeAddInventoryModal);

  document.getElementById('form-add-inventory')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (enforceReadOnly('Add Inventory')) return;

    const productId = document.getElementById('inv_product_id').value;
    const batchNumber = document.getElementById('inv_batch_number').value.trim();
    const quantity = parseInt(document.getElementById('inv_quantity').value, 10) || 0;
    const location = document.getElementById('inv_location').value.trim() || 'Main';
    const reorderLevel = parseInt(document.getElementById('inv_reorder_level').value, 10) || 0;
    const expiryDate = document.getElementById('inv_expiry_date').value;

    if (!productId) {
      showToast('⚠️ Please select a product.', true);
      return;
    }
    if (!batchNumber) {
      showToast('⚠️ Batch number is required.', true);
      return;
    }
    if (quantity <= 0) {
      showToast('⚠️ Quantity must be greater than 0.', true);
      return;
    }

    const spinner = document.getElementById('add-inventory-spinner');
    const btnText = document.getElementById('btn-add-inventory-text');
    if (spinner) spinner.classList.remove('hidden');
    if (btnText) btnText.textContent = 'Adding...';

    for (const url of STOCK_API_ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add',
            pharmacy_id: pharmacyId,
            product_id: productId,
            batch_number: batchNumber,
            quantity: quantity,
            location: location,
            reorder_level: reorderLevel,
            expiry_date: expiryDate
          })
        });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success) break;
        }
      } catch (err) {}
    }

    if (spinner) spinner.classList.add('hidden');
    if (btnText) btnText.textContent = 'Add Inventory';

    closeAddInventoryModal();
    showToast('📦 Inventory batch added successfully!');
    loadAndRenderStock(1);
  });

  // ==============================================
  // 7.4.4.1. Stock Bulk Import Controller (Images 2 & 3)
  // ==============================================
  let parsedStockImportBatches = [];

  // Download Sample Inventory CSV (Exact Image 3 Layout)
  const downloadStockSampleCSV = () => {
    const csvContent = "product_sku,batch,quantity,expiryDate,location,reorderLevel\r\n" +
                       "PRC500,BATCH123,1000,12/31/2025,Warehouse A-1,100\r\n" +
                       "AMX250,BATCH456,500,6/30/2024,Warehouse B-2,50\r\n" +
                       "IBU400,BATCH789,750,3/15/2025,Refrigerator C-3,75\r\n";

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample_inventory_import.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('📥 Sample Inventory CSV downloaded successfully!');
  };

  document.getElementById('btn-download-stock-sample-csv')?.addEventListener('click', downloadStockSampleCSV);

  // Parse Stock File (CSV / XLSX)
  const stockFileInput = document.getElementById('stock-csv-file-input');
  const stockFileNameDisplay = document.getElementById('stock-file-name-display');
  const stockPreviewWrap = document.getElementById('stock-bulk-parsed-preview');
  const stockPreviewTbody = document.getElementById('stock-bulk-preview-tbody');
  const stockParsedRowsCount = document.getElementById('stock-parsed-rows-count');
  const btnSubmitStockBulkImport = document.getElementById('btn-submit-stock-bulk-import');

  const parseStockFileContent = (dataArray) => {
    if (!dataArray || dataArray.length < 2) return [];

    const headers = dataArray[0].map(h => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, ''));
    const results = [];

    for (let i = 1; i < dataArray.length; i++) {
      const row = dataArray[i];
      if (!row || row.length === 0) continue;

      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = row[idx] !== undefined ? row[idx] : '';
      });

      const sku = String(obj['productsku'] || obj['sku'] || obj['code'] || obj['barcode'] || row[0] || '').trim();
      if (!sku || sku.toLowerCase() === 'product_sku' || sku.toLowerCase() === 'sku') continue;

      const batch = String(obj['batch'] || obj['batchnumber'] || obj['batchno'] || obj['lot'] || row[1] || `BATCH-${Date.now().toString().slice(-4)}${i}`).trim();
      const qty = parseInt(String(obj['quantity'] || obj['qty'] || obj['count'] || obj['stock'] || row[2] || 0).replace(/[^0-9]/g, ''), 10) || 0;
      const expiry = String(obj['expirydate'] || obj['expiry'] || obj['expdate'] || obj['exp'] || row[3] || '').trim();
      const location = String(obj['location'] || obj['loc'] || obj['warehouse'] || row[4] || 'Main').trim() || 'Main';
      const reorder = parseInt(String(obj['reorderlevel'] || obj['reorder'] || obj['minstock'] || row[5] || 10).replace(/[^0-9]/g, ''), 10) || 10;

      results.push({
        product_sku: sku,
        batch: batch,
        quantity: qty,
        expiryDate: expiry,
        location: location,
        reorderLevel: reorder
      });
    }

    return results;
  };

  const handleStockFileSelected = async (file) => {
    if (!file) return;

    if (stockFileNameDisplay) stockFileNameDisplay.textContent = file.name;

    const fileExt = file.name.split('.').pop().toLowerCase();

    if (fileExt === 'xlsx' || fileExt === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          if (window.XLSX && window.XLSX.read) {
            const workbook = window.XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonSheet = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            parsedStockImportBatches = parseStockFileContent(jsonSheet);
            renderStockImportPreview(parsedStockImportBatches);
          } else {
            showToast('⚠️ Excel parser is loading. Please try again or use CSV.', true);
          }
        } catch (err) {
          showToast('⚠️ Error parsing Excel file.', true);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const rows = text.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0).map(line => {
            return line.split(',').map(cell => cell.trim().replace(/^["']|["']$/g, ''));
          });
          parsedStockImportBatches = parseStockFileContent(rows);
          renderStockImportPreview(parsedStockImportBatches);
        } catch (err) {
          showToast('⚠️ Error reading CSV file.', true);
        }
      };
      reader.readAsText(file);
    }
  };

  const renderStockImportPreview = (batches) => {
    if (!batches || batches.length === 0) {
      if (stockPreviewWrap) stockPreviewWrap.classList.add('hidden');
      if (btnSubmitStockBulkImport) btnSubmitStockBulkImport.disabled = true;
      showToast('⚠️ No valid stock rows found in file.', true);
      return;
    }

    if (stockParsedRowsCount) stockParsedRowsCount.textContent = batches.length;
    if (stockPreviewTbody) {
      stockPreviewTbody.innerHTML = batches.map(b => `
        <tr>
          <td><strong>${escapeHtml(b.product_sku)}</strong></td>
          <td>${escapeHtml(b.batch)}</td>
          <td><strong>${b.quantity}</strong></td>
          <td>${escapeHtml(b.expiryDate || '—')}</td>
          <td>${escapeHtml(b.location)}</td>
          <td>Reorder at: ${b.reorderLevel}</td>
        </tr>
      `).join('');
    }

    if (stockPreviewWrap) stockPreviewWrap.classList.remove('hidden');
    if (btnSubmitStockBulkImport) btnSubmitStockBulkImport.disabled = false;
    showToast(`✅ Parsed ${batches.length} inventory batches! Ready to import.`);
  };

  stockFileInput?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleStockFileSelected(e.target.files[0]);
    }
  });

  btnSubmitStockBulkImport?.addEventListener('click', async () => {
    if (enforceReadOnly('Bulk Import Stock Inventory')) return;

    if (!parsedStockImportBatches || parsedStockImportBatches.length === 0) {
      showToast('⚠️ Please choose and parse a CSV / Excel file first.', true);
      return;
    }

    const spinner = document.getElementById('stock-import-spinner');
    const icon = document.getElementById('stock-import-btn-icon');
    const text = document.getElementById('stock-import-btn-text');

    if (btnSubmitStockBulkImport) btnSubmitStockBulkImport.disabled = true;
    if (spinner) spinner.classList.remove('hidden');
    if (icon) icon.classList.add('hidden');
    if (text) text.textContent = 'Importing...';

    let successCount = 0;
    const payload = {
      action: 'bulk_import',
      pharmacy_id: pharmacyId,
      batches: parsedStockImportBatches
    };

    let importedSuccess = false;
    for (const url of STOCK_API_ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success) {
            successCount = json.inserted_count || parsedStockImportBatches.length;
            importedSuccess = true;
            break;
          }
        }
      } catch (err) {}
    }

    // Individual Add Fallback if remote bulk_import action is not yet available
    if (!importedSuccess) {
      const prods = await ensureProductsLoaded();
      for (const b of parsedStockImportBatches) {
        let matchedProd = prods.find(p => p.sku && p.sku.toUpperCase() === b.product_sku.toUpperCase());
        let prodId = matchedProd ? matchedProd.id : null;

        if (!prodId) {
          for (const pUrl of PRODUCT_API_ENDPOINTS) {
            try {
              const pRes = await fetch(pUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'create',
                  pharmacy_id: pharmacyId,
                  name: b.product_sku,
                  sku: b.product_sku,
                  generic_name: b.product_sku,
                  selling_price: 0,
                  cost_price: 0
                })
              });
              if (pRes.ok) {
                const pJson = await pRes.json();
                if (pJson && pJson.success) {
                  prodId = pJson.id;
                  prods.push({ id: prodId, sku: b.product_sku, name: b.product_sku });
                  break;
                }
              }
            } catch (e) {}
          }
        }

        for (const sUrl of STOCK_API_ENDPOINTS) {
          try {
            const sRes = await fetch(sUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'add',
                pharmacy_id: pharmacyId,
                product_id: prodId || 1,
                batch_number: b.batch,
                quantity: b.quantity,
                location: b.location,
                reorder_level: b.reorderLevel,
                expiry_date: b.expiryDate ? new Date(b.expiryDate).toISOString().split('T')[0] : null
              })
            });
            if (sRes.ok) {
              const sJson = await sRes.json();
              if (sJson && sJson.success) {
                successCount++;
                break;
              }
            }
          } catch (e) {}
        }
      }
    }

    // Update Local Stock State Immediately so user never waits or sees blank table
    const prods = await ensureProductsLoaded();
    const newItems = parsedStockImportBatches.map((b, idx) => {
      const p = prods.find(pr => pr.sku && pr.sku.toUpperCase() === b.product_sku.toUpperCase());
      return {
        id: Date.now() + idx,
        pharmacy_id: pharmacyId,
        product_id: p ? p.id : 1,
        product_name: p ? p.name : b.product_sku,
        product_sku: b.product_sku,
        batch_number: b.batch,
        quantity: b.quantity,
        expiry_date: b.expiryDate ? new Date(b.expiryDate).toISOString().split('T')[0] : null,
        location: b.location || 'Main',
        reorder_level: b.reorderLevel || 10,
        created_at: new Date().toISOString()
      };
    });

    currentStockBatches = [...newItems, ...currentStockBatches];
    try {
      localStorage.setItem(`ezpharma_stock_pharm_${pharmacyId}`, JSON.stringify(currentStockBatches));
    } catch (e) {}

    if (spinner) spinner.classList.add('hidden');
    if (icon) icon.classList.remove('hidden');
    if (text) text.textContent = 'Import Inventory';

    // Reset preview
    parsedStockImportBatches = [];
    if (stockFileInput) stockFileInput.value = '';
    if (stockFileNameDisplay) stockFileNameDisplay.textContent = 'No file chosen';
    if (stockPreviewWrap) stockPreviewWrap.classList.add('hidden');
    if (btnSubmitStockBulkImport) btnSubmitStockBulkImport.disabled = true;

    showToast(`📦 Successfully imported ${successCount || newItems.length} inventory batches into stock!`);
    navigateTo('/dashboard/stock');
    loadAndRenderStock(1);
  });

  // ==============================================
  // 7.4.5. Stock Alerts Logic (Image 4)
  // ==============================================
  let currentAlertsList = [];
  let alertActiveTab = 'low_stock';
  let alertSearchQuery = '';
  let alertSortField = 'alert_type';
  let alertSortAsc = true;
  let alertPerPage = 20;
  let alertCurrentPage = 1;

  const loadAndRenderStockAlerts = async (page = 1) => {
    alertCurrentPage = page;
    const tbody = document.getElementById('alerts-table-tbody');
    if (tbody && currentAlertsList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-muted">Loading stock alerts...</td></tr>`;
    }

    let batches = [];
    for (const url of STOCK_API_ENDPOINTS) {
      try {
        const res = await fetch(`${url}?pharmacy_id=${pharmacyId}&sort=created_at&order=DESC`, { method: 'GET' });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success && Array.isArray(json.batches)) {
            batches = json.batches;
            if (json.counts) stockSummaryCounts = json.counts;
            break;
          }
        }
      } catch (e) {}
    }

    // Update Top 3 Metric Cards (Image 4)
    document.getElementById('alert-card-low-stock-count').textContent = stockSummaryCounts.low_stock || 0;
    document.getElementById('alert-card-expiring-count').textContent = stockSummaryCounts.expiring_soon || 0;
    document.getElementById('alert-card-out-of-stock-count').textContent = stockSummaryCounts.out_of_stock || 0;

    currentAlertsList = batches;
    applyAlertFiltersAndRender();
  };

  const applyAlertFiltersAndRender = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const searchVal = (document.getElementById('alerts-search-input')?.value || '').toLowerCase().trim();
    const filterType = document.getElementById('alerts-filter-type')?.value || 'all';

    let filtered = currentAlertsList.filter(b => {
      const reorderLvl = parseInt(b.reorder_level || 0, 10);
      const batchQty = parseInt(b.quantity || 0, 10);

      const isExpired = b.expiry_date && b.expiry_date < todayStr;
      const isExpiringSoon = b.expiry_date && !isExpired && (new Date(b.expiry_date) - new Date() <= 90 * 86400000);
      const isLowStock = batchQty <= reorderLvl && batchQty > 0;
      const isOutOfStock = batchQty === 0;

      // Filter by Segmented Tab
      if (alertActiveTab === 'low_stock' && !isLowStock) return false;
      if (alertActiveTab === 'expiring_soon' && !isExpiringSoon && !isExpired) return false;
      if (alertActiveTab === 'out_of_stock' && !isOutOfStock) return false;

      // Filter by Dropdown
      if (filterType === 'low_stock' && !isLowStock) return false;
      if (filterType === 'expiring_soon' && !isExpiringSoon && !isExpired) return false;
      if (filterType === 'out_of_stock' && !isOutOfStock) return false;

      // Filter by Search
      if (searchVal) {
        const nameMatch = (b.product_name || '').toLowerCase().includes(searchVal);
        const skuMatch = (b.product_sku || '').toLowerCase().includes(searchVal);
        const locMatch = (b.location || '').toLowerCase().includes(searchVal);
        if (!nameMatch && !skuMatch && !locMatch) return false;
      }

      return isLowStock || isExpiringSoon || isExpired || isOutOfStock;
    });

    renderAlertsTable(filtered, alertCurrentPage, alertPerPage);
  };

  const renderAlertsTable = (alerts, page = 1, perPage = 20) => {
    const tbody = document.getElementById('alerts-table-tbody');
    const countLabel = document.getElementById('alerts-count-label');
    const pageInfo = document.getElementById('alerts-page-info');
    const pageDisplay = document.getElementById('alerts-current-page-display');
    const prevBtn = document.getElementById('alerts-btn-prev');
    const nextBtn = document.getElementById('alerts-btn-next');

    if (!tbody) return;

    if (!alerts || alerts.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-5 text-muted">
            No stock alerts found for current criteria. All inventory levels are healthy!
          </td>
        </tr>
      `;
      if (countLabel) countLabel.textContent = 'Showing 0 to 0 of 0 results';
      if (pageInfo) pageInfo.textContent = 'Showing 0 results';
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      return;
    }

    const totalPages = Math.ceil(alerts.length / perPage) || 1;
    if (page > totalPages) page = 1;
    const startIdx = (page - 1) * perPage;
    const pageItems = alerts.slice(startIdx, startIdx + perPage);

    if (countLabel) countLabel.textContent = `Showing ${startIdx + 1} to ${Math.min(startIdx + perPage, alerts.length)} of ${alerts.length} results`;
    if (pageInfo) pageInfo.textContent = `Showing ${startIdx + 1} to ${Math.min(startIdx + perPage, alerts.length)} of ${alerts.length} results`;
    if (pageDisplay) pageDisplay.textContent = `Page ${page} of ${totalPages}`;
    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextBtn) nextBtn.disabled = page >= totalPages;

    const todayStr = new Date().toISOString().split('T')[0];

    tbody.innerHTML = pageItems.map(b => {
      const reorderLvl = parseInt(b.reorder_level || 0, 10);
      const batchQty = parseInt(b.quantity || 0, 10);

      const isExpired = b.expiry_date && b.expiry_date < todayStr;
      const isExpiringSoon = b.expiry_date && !isExpired && (new Date(b.expiry_date) - new Date() <= 90 * 86400000);
      const isLowStock = batchQty <= reorderLvl && batchQty > 0;
      const isOutOfStock = batchQty === 0;

      let statusBadge = '<span class="badge-status badge-good">Good</span>';
      if (isOutOfStock) statusBadge = '<span class="badge-status badge-out-of-stock">Out of Stock</span>';
      else if (isExpired) statusBadge = '<span class="badge-status badge-expired">Expired</span>';
      else if (isExpiringSoon) statusBadge = '<span class="badge-status badge-low-stock">Expiring Soon</span>';
      else if (isLowStock) statusBadge = '<span class="badge-status badge-low-stock">Low Stock</span>';

      let formattedDate = '—';
      if (b.expiry_date) {
        const parts = b.expiry_date.split('-');
        formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : b.expiry_date;
      }

      return `
        <tr>
          <td><span class="sku-code">${escapeHtml(b.product_sku || 'N/A')}</span></td>
          <td><strong>${escapeHtml(b.product_name)}</strong></td>
          <td><span style="color: ${isOutOfStock || isLowStock ? '#dc2626' : 'inherit'}; font-weight: 800;">${b.quantity}</span></td>
          <td>${reorderLvl}</td>
          <td>${escapeHtml(formattedDate)}</td>
          <td>${escapeHtml(b.location || 'Main')}</td>
          <td class="text-right">${statusBadge}</td>
        </tr>
      `;
    }).join('');
  };

  // Alerts Tab Listeners
  document.querySelectorAll('.alert-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.alert-tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      alertActiveTab = e.target.getAttribute('data-tab');
      applyAlertFiltersAndRender();
    });
  });

  document.getElementById('alerts-search-input')?.addEventListener('input', applyAlertFiltersAndRender);
  document.getElementById('alerts-filter-type')?.addEventListener('change', applyAlertFiltersAndRender);
  document.getElementById('alerts-per-page')?.addEventListener('change', (e) => {
    alertPerPage = parseInt(e.target.value, 10) || 20;
    applyAlertFiltersAndRender();
  });

  document.getElementById('alerts-btn-prev')?.addEventListener('click', () => {
    if (alertCurrentPage > 1) {
      alertCurrentPage--;
      applyAlertFiltersAndRender();
    }
  });

  document.getElementById('alerts-btn-next')?.addEventListener('click', () => {
    alertCurrentPage++;
    applyAlertFiltersAndRender();
  });

  // ==============================================
  // 7.4.5. Point of Sale (POS), Sales History & Cash Drawer (Images 1, 2, 3, 4, 5)
  // ==============================================
  const POS_API_ENDPOINTS = [
    'https://api.holidaymartbd.com/ezpharma/pos.php',
    '/api/pos.php'
  ];

  let posCart = [];
  let posSelectedCustomer = null;
  let posHeldCarts = [];
  let posSelectedPayMethod = 'Cash';
  let posProductsList = [];
  let posProductPage = 1;
  const posProductPerPage = 18; // 3 columns x 6 rows (Image 1)
  let posProductSearch = '';
  let posSelectedProductIndex = -1;
  let posVatRate = 0; // Configured from settings or default 0%

  // 1. Initialize & Load POS
  const fetchPosCustomers = async () => {
    if (currentCustomersList.length > 0) return;
    for (const url of CUSTOMER_API_ENDPOINTS) {
      try {
        const res = await fetch(`${url}?pharmacy_id=${pharmacyId}`);
        if (res.ok) {
          const json = await res.json();
          if (json && json.success && Array.isArray(json.customers)) {
            currentCustomersList = json.customers;
            break;
          }
        }
      } catch (e) {}
    }
    if (currentCustomersList.length === 0) {
      try {
        const local = localStorage.getItem(`ezpharma_customers_pharm_${pharmacyId}`);
        if (local) currentCustomersList = JSON.parse(local);
      } catch (e) {}
    }
  };

  const initAndLoadPos = async () => {
    loadHeldCartsFromLocal();
    await Promise.all([
      fetchPosProducts(),
      fetchPosCustomers()
    ]);
    renderPosProductsGrid();
    calculatePosTotals();
  };

  const fetchPosProducts = async () => {
    try {
      // 1. Try fetching from Products API with per_page=500
      for (const url of PRODUCT_API_ENDPOINTS) {
        try {
          const res = await fetch(`${url}?pharmacy_id=${pharmacyId}&limit=500&per_page=500`);
          if (res.ok) {
            const json = await res.json();
            if (json && json.success && Array.isArray(json.products)) {
              posProductsList = json.products;
              try {
                localStorage.setItem(`ezpharma_products_pharm_${pharmacyId}`, JSON.stringify(posProductsList));
              } catch (e) {}
              break;
            }
          }
        } catch (e) {}
      }
    } catch (e) {}

    // Fallback to local storage if API didn't return
    if (posProductsList.length === 0) {
      try {
        const local = localStorage.getItem(`ezpharma_products_pharm_${pharmacyId}`);
        if (local) posProductsList = JSON.parse(local);
      } catch (e) {}
    }
  };

  // 2. Render 3x6 Product Grid with Pagination (Image 1)
  const renderPosProductsGrid = () => {
    const gridContainer = document.getElementById('pos-product-grid');
    const pageDisplay = document.getElementById('pos-grid-page-display');
    const prevBtn = document.getElementById('pos-btn-prev-page');
    const nextBtn = document.getElementById('pos-btn-next-page');

    if (!gridContainer) return;

    // Filter by live search
    const query = posProductSearch.toLowerCase().trim();
    const filtered = posProductsList.filter(p => {
      if (!query) return true;
      const name = (p.name || '').toLowerCase();
      const sku = (p.sku || '').toLowerCase();
      const generic = (p.generic_name || '').toLowerCase();
      return name.includes(query) || sku.includes(query) || generic.includes(query);
    });

    if (filtered.length === 0) {
      gridContainer.innerHTML = `
        <div style="grid-column: 1 / -1;" class="text-center py-5 text-muted">
          No products found matching "${escapeHtml(posProductSearch)}".
        </div>
      `;
      if (pageDisplay) pageDisplay.textContent = 'Page 1 of 1';
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      return;
    }

    const totalPages = Math.ceil(filtered.length / posProductPerPage) || 1;
    if (posProductPage > totalPages) posProductPage = 1;
    const startIdx = (posProductPage - 1) * posProductPerPage;
    const pageProducts = filtered.slice(startIdx, startIdx + posProductPerPage);

    if (pageDisplay) pageDisplay.textContent = `Page ${posProductPage} of ${totalPages}`;
    if (prevBtn) prevBtn.disabled = posProductPage <= 1;
    if (nextBtn) nextBtn.disabled = posProductPage >= totalPages;

    gridContainer.innerHTML = pageProducts.map((p, idx) => {
      const stock = parseInt(p.stock_quantity !== undefined && p.stock_quantity !== null ? p.stock_quantity : (p.quantity !== undefined ? p.quantity : (p.stock !== undefined ? p.stock : 0)), 10);
      const isOutOfStock = stock <= 0;
      const isLow = !isOutOfStock && stock <= (p.reorder_level || 10);
      const stockClass = isOutOfStock ? 'pos-stock-out' : (isLow ? 'pos-stock-low' : 'pos-stock-in');
      const isSelected = idx === posSelectedProductIndex ? 'kb-selected' : '';
      const stockLabel = isOutOfStock ? 'Out of stock (0)' : `${stock} in stock`;

      return `
        <div class="pos-product-card ${isSelected} ${isOutOfStock ? 'card-out-of-stock' : ''}" data-id="${p.id}" data-index="${idx}">
          <div class="pos-card-title-row">
            <span class="pos-card-title">${escapeHtml(p.name || 'Medicine')}</span>
            ${p.requires_prescription || p.is_rx ? '<span class="pos-rx-badge">Rx</span>' : ''}
          </div>
          <div class="pos-card-subtitle">${escapeHtml(p.generic_name || p.manufacturer_name || 'Standard Unit')}</div>
          <div class="pos-card-bottom-row">
            <span class="pos-card-price">${formatPrice(p.selling_price || p.price || 0)}</span>
            <span class="pos-stock-badge ${stockClass}">${stockLabel}</span>
          </div>
        </div>
      `;
    }).join('');
  };

  // Product Click Event Delegation
  document.getElementById('pos-product-grid')?.addEventListener('click', (e) => {
    const card = e.target.closest('.pos-product-card');
    if (!card) return;
    const pId = card.getAttribute('data-id');
    const product = posProductsList.find(p => p.id == pId);
    if (product) {
      addProductToPosCart(product);
    }
  });

  // Product Live Search Listener (F1)
  let posSearchTimer = null;
  document.getElementById('pos-product-search-input')?.addEventListener('input', (e) => {
    clearTimeout(posSearchTimer);
    posSearchTimer = setTimeout(() => {
      posProductSearch = e.target.value;
      posProductPage = 1;
      posSelectedProductIndex = -1;
      renderPosProductsGrid();
    }, 150);
  });

  document.getElementById('btn-pos-search-trigger')?.addEventListener('click', () => {
    posProductSearch = document.getElementById('pos-product-search-input').value;
    posProductPage = 1;
    renderPosProductsGrid();
  });

  // Grid Pagination Listeners
  document.getElementById('pos-btn-prev-page')?.addEventListener('click', () => {
    if (posProductPage > 1) {
      posProductPage--;
      posSelectedProductIndex = -1;
      renderPosProductsGrid();
    }
  });

  document.getElementById('pos-btn-next-page')?.addEventListener('click', () => {
    posProductPage++;
    posSelectedProductIndex = -1;
    renderPosProductsGrid();
  });

  // 3. Add / Update Cart Item with Strict Stock Validation
  const addProductToPosCart = (product) => {
    const availableStock = parseInt(product.stock_quantity !== undefined && product.stock_quantity !== null ? product.stock_quantity : (product.quantity !== undefined ? product.quantity : (product.stock !== undefined ? product.stock : 0)), 10);
    
    if (availableStock <= 0) {
      showToast(`⚠️ Out of stock! "${product.name}" has 0 available in inventory.`, true);
      return;
    }

    const existing = posCart.find(item => item.id == product.id);
    if (existing) {
      if (existing.quantity >= availableStock) {
        showToast(`⚠️ Cannot add more! Available stock for "${product.name}" is only ${availableStock} units.`, true);
        return;
      }
      existing.quantity += 1;
    } else {
      posCart.push({
        id: product.id,
        name: product.name || 'Medicine',
        sku: product.sku || '',
        price: parseFloat(product.selling_price || product.price || 0),
        quantity: 1,
        max_stock: availableStock,
        discount_percent: 0,
        requires_prescription: !!(product.requires_prescription || product.is_rx)
      });
    }
    renderPosCart();
    calculatePosTotals();
  };

  const renderPosCart = () => {
    const emptyState = document.getElementById('pos-empty-cart-state');
    const tableWrap = document.getElementById('pos-cart-table-wrap');
    const itemsList = document.getElementById('pos-cart-items-list');
    const cartCount = document.getElementById('pos-cart-count');

    const totalCount = posCart.reduce((sum, item) => sum + item.quantity, 0);
    if (cartCount) cartCount.textContent = totalCount;

    if (!itemsList) return;

    if (posCart.length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      if (tableWrap) tableWrap.classList.add('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (tableWrap) tableWrap.classList.remove('hidden');

    itemsList.innerHTML = posCart.map((item, idx) => {
      const gross = item.price * item.quantity;
      const discAmt = gross * ((item.discount_percent || 0) / 100);
      const lineTotal = gross - discAmt;

      return `
        <div class="pos-cart-row-item" data-idx="${idx}">
          <div>
            <div class="item-title">${escapeHtml(item.name)} ${item.requires_prescription ? '<span class="pos-rx-badge">Rx</span>' : ''}</div>
            <div class="item-sku">${escapeHtml(item.sku || 'SKU-STANDARD')} <span style="color:#64748b; font-size:0.75rem; margin-left:4px;">(Max: ${item.max_stock ?? '—'})</span></div>
          </div>
          <div>
            <div style="font-size: 0.72rem; color: #64748b;">Price</div>
            <strong>${formatPrice(item.price)}</strong>
          </div>
          <div>
            <div style="font-size: 0.72rem; color: #64748b;">Qty</div>
            <div class="pos-qty-stepper">
              <button type="button" class="pos-qty-btn btn-qty-dec" data-idx="${idx}">-</button>
              <span class="pos-qty-val">${item.quantity}</span>
              <button type="button" class="pos-qty-btn btn-qty-inc" data-idx="${idx}" ${item.quantity >= (item.max_stock ?? 999999) ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>+</button>
            </div>
          </div>
          <div>
            <div style="font-size: 0.72rem; color: #64748b;">Disc %</div>
            <div style="display: flex; align-items: center; gap: 2px;">
              <input type="number" class="pos-disc-input" data-idx="${idx}" min="0" max="100" value="${item.discount_percent || 0}" />
              <span style="font-size: 0.75rem;">%</span>
            </div>
          </div>
          <div class="pos-cart-line-total-wrap">
            <strong style="color: #2563eb;">${formatPrice(lineTotal)}</strong>
            <button type="button" class="btn-remove-cart-item" data-idx="${idx}" title="Remove item (Delete)">
              🗑
            </button>
          </div>
        </div>
      `;
    }).join('');
  };

  // Cart Row Interactions (Qty + / -, Discount %, Delete) with Max Stock Guards
  document.getElementById('pos-cart-items-list')?.addEventListener('click', (e) => {
    const decBtn = e.target.closest('.btn-qty-dec');
    if (decBtn) {
      const idx = parseInt(decBtn.getAttribute('data-idx'), 10);
      if (posCart[idx]) {
        if (posCart[idx].quantity > 1) {
          posCart[idx].quantity -= 1;
        } else {
          posCart.splice(idx, 1);
        }
        renderPosCart();
        calculatePosTotals();
      }
      return;
    }

    const incBtn = e.target.closest('.btn-qty-inc');
    if (incBtn) {
      const idx = parseInt(incBtn.getAttribute('data-idx'), 10);
      if (posCart[idx]) {
        const item = posCart[idx];
        const maxStock = parseInt(item.max_stock !== undefined ? item.max_stock : 999999, 10);
        if (item.quantity >= maxStock) {
          showToast(`⚠️ Cannot exceed available stock! Max ${maxStock} available for "${item.name}".`, true);
          return;
        }
        item.quantity += 1;
        renderPosCart();
        calculatePosTotals();
      }
      return;
    }

    const delBtn = e.target.closest('.btn-remove-cart-item');
    if (delBtn) {
      const idx = parseInt(delBtn.getAttribute('data-idx'), 10);
      if (posCart[idx]) {
        posCart.splice(idx, 1);
        renderPosCart();
        calculatePosTotals();
      }
    }
  });

  // Discount % change listener on cart rows
  document.getElementById('pos-cart-items-list')?.addEventListener('input', (e) => {
    if (e.target.classList.contains('pos-disc-input')) {
      const idx = parseInt(e.target.getAttribute('data-idx'), 10);
      let disc = parseFloat(e.target.value) || 0;
      if (disc < 0) disc = 0;
      if (disc > 100) disc = 100;
      if (posCart[idx]) {
        posCart[idx].discount_percent = disc;
        calculatePosTotals();
      }
    }
  });

  // 4. Calculate POS Totals (Subtotal, Discount, VAT, Grand Total)
  const calculatePosTotals = () => {
    let rawSubtotal = 0;
    let totalDiscountAmount = 0;

    posCart.forEach(item => {
      const gross = item.price * item.quantity;
      const itemDisc = gross * ((item.discount_percent || 0) / 100);
      rawSubtotal += gross;
      totalDiscountAmount += itemDisc;
    });

    const netSubtotal = Math.max(0, rawSubtotal - totalDiscountAmount);
    const taxAmount = netSubtotal * (posVatRate / 100);
    const grandTotal = netSubtotal + taxAmount;

    // Update UI Summary Elements
    const subtotalEl = document.getElementById('pos-summary-subtotal');
    const discEl = document.getElementById('pos-summary-discount');
    const taxEl = document.getElementById('pos-summary-tax');
    const totalEl = document.getElementById('pos-summary-total');
    const btnTotalEl = document.getElementById('pos-btn-total-amount');
    const completeBtn = document.getElementById('btn-pos-complete-sale');

    if (subtotalEl) subtotalEl.textContent = formatPrice(rawSubtotal);
    if (discEl) discEl.textContent = `- ${formatPrice(totalDiscountAmount)}`;
    if (taxEl) taxEl.textContent = formatPrice(taxAmount);
    if (totalEl) totalEl.textContent = formatPrice(grandTotal);
    if (btnTotalEl) btnTotalEl.textContent = formatPrice(grandTotal);

    if (completeBtn) {
      completeBtn.disabled = posCart.length === 0 || grandTotal <= 0;
    }

    // Update Cash Change Calculation
    updateCashChangeCalculation(grandTotal);

    // Update Credit Limit Verification
    updateCreditValidation(grandTotal);

    return { rawSubtotal, totalDiscountAmount, netSubtotal, taxAmount, grandTotal };
  };

  const updateCashChangeCalculation = (grandTotal) => {
    const cashInput = document.getElementById('pos-cash-received-input');
    const changeBox = document.getElementById('pos-change-due-box');
    const changeAmount = document.getElementById('pos-change-due-amount');

    if (!cashInput || !changeBox) return;

    const cashReceived = parseFloat(cashInput.value) || 0;
    if (cashReceived > grandTotal && grandTotal > 0) {
      changeBox.classList.remove('hidden');
      if (changeAmount) changeAmount.textContent = formatPrice(cashReceived - grandTotal);
    } else {
      changeBox.classList.add('hidden');
    }
  };

  const updateCreditValidation = (grandTotal) => {
    const noCustBox = document.getElementById('pos-credit-no-cust-box');
    const custInfoCard = document.getElementById('pos-credit-cust-info');
    const creditLimitText = document.getElementById('pos-credit-limit-text');
    const creditUsedText = document.getElementById('pos-credit-used-text');
    const creditAvailText = document.getElementById('pos-credit-avail-text');
    const completeBtn = document.getElementById('btn-pos-complete-sale');

    if (posSelectedPayMethod !== 'Credit') return;

    if (!posSelectedCustomer) {
      if (noCustBox) noCustBox.classList.remove('hidden');
      if (custInfoCard) custInfoCard.classList.add('hidden');
      if (completeBtn) completeBtn.disabled = true;
      return;
    }

    if (noCustBox) noCustBox.classList.add('hidden');
    if (custInfoCard) custInfoCard.classList.remove('hidden');

    const limit = parseFloat(posSelectedCustomer.credit_limit || 1000);
    const used = parseFloat(posSelectedCustomer.credit_used || 0);
    const available = Math.max(0, limit - used);

    if (creditLimitText) creditLimitText.textContent = formatPrice(limit);
    if (creditUsedText) creditUsedText.textContent = formatPrice(used);
    if (creditAvailText) {
      creditAvailText.textContent = formatPrice(available);
      creditAvailText.className = available < grandTotal ? 'text-red font-bold' : 'text-green font-bold';
    }

    if (completeBtn) {
      if (grandTotal > available || posCart.length === 0) {
        completeBtn.disabled = true;
      } else {
        completeBtn.disabled = false;
      }
    }
  };

  // Payment Method Tab Switcher
  document.querySelectorAll('.pos-pay-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const method = tab.getAttribute('data-method');
      posSelectedPayMethod = method;

      document.querySelectorAll('.pos-pay-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Hide all panels
      document.querySelectorAll('.pos-pay-panel').forEach(p => p.classList.add('hidden'));

      // Show matching panel
      const targetPanel = document.getElementById(`pos-panel-${method.toLowerCase()}`);
      if (targetPanel) targetPanel.classList.remove('hidden');

      calculatePosTotals();
    });
  });

  // Cash Received Input & Quick Chips (Image 1)
  document.getElementById('pos-cash-received-input')?.addEventListener('input', () => {
    const { grandTotal } = calculatePosTotals();
    updateCashChangeCalculation(grandTotal);
  });

  document.querySelectorAll('.pos-quick-cash-chips .cash-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const { grandTotal } = calculatePosTotals();
      const cashInput = document.getElementById('pos-cash-received-input');
      if (!cashInput) return;

      if (chip.id === 'btn-cash-exact') {
        cashInput.value = grandTotal.toFixed(2);
      } else {
        const val = parseFloat(chip.getAttribute('data-val')) || 0;
        cashInput.value = val.toFixed(2);
      }
      updateCashChangeCalculation(grandTotal);
    });
  });

  // 5. Customer Autocomplete Search in POS (Instant Live Support)
  const custSearchInput = document.getElementById('pos-customer-search-input');
  const custDropdown = document.getElementById('pos-customer-results-dropdown');
  const custBanner = document.getElementById('pos-selected-customer-banner');
  const clearCustBtn = document.getElementById('btn-clear-pos-customer');

  custSearchInput?.addEventListener('input', async (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) {
      if (custDropdown) custDropdown.classList.add('hidden');
      return;
    }

    if (currentCustomersList.length === 0) {
      await fetchPosCustomers();
    }

    const matches = currentCustomersList.filter(c => 
      (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q)
    );

    if (!custDropdown) return;
    custDropdown.classList.remove('hidden');

    let html = `
      <div class="pos-customer-dropdown-item" data-id="walk-in">
        <div><strong>Walk-in Customer</strong> (No membership/credit)</div>
      </div>
    `;

    if (matches.length > 0) {
      html += matches.slice(0, 8).map(c => `
        <div class="pos-customer-dropdown-item" data-id="${c.id}">
          <div>
            <strong>${escapeHtml(c.name)}</strong>
            <span style="font-size: 0.78rem; color: #64748b; margin-left: 0.5rem;">${escapeHtml(c.phone)}</span>
          </div>
          <div>
            <span class="tier-badge-pill pill-${(c.tier || 'Silver').toLowerCase()}">${c.tier || 'Silver'}</span>
          </div>
        </div>
      `).join('');
    } else {
      html += `
        <div class="pos-customer-dropdown-item" data-id="new-create">
          <div style="color: #2563eb;">+ Add "${escapeHtml(q)}" as new customer</div>
        </div>
      `;
    }

    custDropdown.innerHTML = html;
  });

  custDropdown?.addEventListener('click', (e) => {
    const item = e.target.closest('.pos-customer-dropdown-item');
    if (!item) return;

    const id = item.getAttribute('data-id');
    if (id === 'walk-in') {
      selectPosCustomer(null);
    } else if (id === 'new-create') {
      const q = custSearchInput.value.trim();
      openAddCustomerModal();
      document.getElementById('cust_input_name').value = q;
    } else {
      const cust = currentCustomersList.find(c => c.id == id);
      if (cust) selectPosCustomer(cust);
    }

    custDropdown.classList.add('hidden');
  });

  const selectPosCustomer = (cust) => {
    posSelectedCustomer = cust;

    if (!cust) {
      if (custSearchInput) custSearchInput.value = '';
      if (custBanner) custBanner.classList.add('hidden');
      if (clearCustBtn) clearCustBtn.classList.add('hidden');
    } else {
      if (custSearchInput) custSearchInput.value = cust.name;
      if (custBanner) {
        custBanner.classList.remove('hidden');
        document.getElementById('pos-disp-cust-name').textContent = cust.name;
        document.getElementById('pos-disp-cust-phone').textContent = cust.phone || '';
        document.getElementById('pos-disp-cust-tier').textContent = cust.tier || 'Silver';
        
        const limit = (cust.credit_limit !== undefined && cust.credit_limit !== null && !isNaN(parseFloat(cust.credit_limit))) ? parseFloat(cust.credit_limit) : 0;
        const used = parseFloat(cust.credit_used || 0);
        const avail = Math.max(0, limit - used);
        
        const creditWrap = document.getElementById('pos-disp-cust-credit');
        if (creditWrap) {
          let creditHtml = `<span>Credit: Tk <strong id="pos-disp-credit-avail">${avail.toFixed(2)}</strong> Avail</span>`;
          if (used > 0) {
            creditHtml += `<span style="color:#dc2626; font-weight:700; margin-left:8px;">Due: Tk ${used.toFixed(2)}</span>`;
            creditHtml += `<button type="button" class="btn-customer-pay-due" data-id="${cust.id}" data-name="${escapeHtml(cust.name)}" data-phone="${escapeHtml(cust.phone || '')}" data-due="${used}" data-limit="${limit}" style="margin-left:8px; padding:3px 8px; background:#2563eb; color:#fff; border-radius:4px; font-size:0.75rem; border:none; cursor:pointer; font-weight:600;">💳 Pay Due</button>`;
          }
          creditWrap.innerHTML = creditHtml;
        }
      }
      if (clearCustBtn) clearCustBtn.classList.remove('hidden');
    }

    calculatePosTotals();
  };

  clearCustBtn?.addEventListener('click', () => {
    selectPosCustomer(null);
  });

  // 6. Hold & Recall Engine (Images 1, 5)
  const modalHold = document.getElementById('modal-pos-hold');
  const modalHeldList = document.getElementById('modal-pos-held-list');

  const openHoldModal = () => {
    if (posCart.length === 0) {
      showToast('⚠️ Cart is empty. Add products before holding.', true);
      return;
    }

    const { grandTotal } = calculatePosTotals();
    const count = posCart.reduce((sum, i) => sum + i.quantity, 0);

    document.getElementById('hold-cust-disp').textContent = posSelectedCustomer ? posSelectedCustomer.name : 'Walk-in Customer';
    document.getElementById('hold-items-count').textContent = count;
    document.getElementById('hold-total-disp').textContent = formatPrice(grandTotal);
    document.getElementById('hold_notes_input').value = '';

    if (modalHold) modalHold.classList.remove('hidden');
  };

  const closeHoldModal = () => {
    if (modalHold) modalHold.classList.add('hidden');
  };

  document.getElementById('btn-pos-hold-cart')?.addEventListener('click', openHoldModal);
  document.getElementById('btn-close-hold-modal')?.addEventListener('click', closeHoldModal);
  document.getElementById('btn-cancel-hold-modal')?.addEventListener('click', closeHoldModal);

  // Submit Hold Cart Form (Image 5)
  document.getElementById('form-pos-hold-transaction')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { grandTotal } = calculatePosTotals();
    const notes = document.getElementById('hold_notes_input').value.trim();
    if (posCart.length === 0) return;

    const heldItem = {
      id: Date.now(),
      created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      customer: posSelectedCustomer,
      cart: [...posCart],
      total: grandTotal,
      notes: notes
    };

    posHeldCarts.unshift(heldItem);
    saveHeldCartsToLocal();

    posCart = [];
    selectPosCustomer(null);
    renderPosCart();
    calculatePosTotals();
    closeHoldModal();
    showToast('💾 Transaction placed on hold.');
  });

  const loadHeldCartsFromLocal = () => {
    try {
      const local = localStorage.getItem(`ezpharma_held_carts_${pharmacyId}`);
      if (local) posHeldCarts = JSON.parse(local);
    } catch (e) {}
    updateHeldBadge();
  };

  const saveHeldCartsToLocal = () => {
    try {
      localStorage.setItem(`ezpharma_held_carts_${pharmacyId}`, JSON.stringify(posHeldCarts));
    } catch (e) {}
    updateHeldBadge();
  };

  const updateHeldBadge = () => {
    const badge = document.getElementById('btn-pos-recall-held');
    const badgeText = document.getElementById('pos-held-count-badge');
    if (!badge) return;

    if (posHeldCarts.length > 0) {
      badge.classList.remove('hidden');
      if (badgeText) badgeText.textContent = posHeldCarts.length;
    } else {
      badge.classList.add('hidden');
    }
  };

  // Open Held Transactions List Modal
  const openHeldListModal = () => {
    const tbody = document.getElementById('held-transactions-tbody');
    if (!tbody) return;

    if (posHeldCarts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No held transactions currently.</td></tr>`;
    } else {
      tbody.innerHTML = posHeldCarts.map((h, idx) => {
        const itemsSummary = h.cart.map(i => `${i.name} (x${i.quantity})`).join(', ');
        return `
          <tr>
            <td>${h.created_at}</td>
            <td><strong>${escapeHtml(h.customer ? h.customer.name : 'Walk-in')}</strong></td>
            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(itemsSummary)}</td>
            <td><strong>${formatPrice(h.total)}</strong></td>
            <td>${escapeHtml(h.notes || '—')}</td>
            <td class="text-right">
              <button type="button" class="btn-action-round action-history btn-recall-held-item" data-idx="${idx}" title="Recall Cart">
                ↺ Restore
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    if (modalHeldList) modalHeldList.classList.remove('hidden');
  };

  document.getElementById('btn-pos-recall-held')?.addEventListener('click', openHeldListModal);
  document.getElementById('btn-close-held-list-modal')?.addEventListener('click', () => modalHeldList?.classList.add('hidden'));
  document.getElementById('btn-close-held-list-btn')?.addEventListener('click', () => modalHeldList?.classList.add('hidden'));

  // Recall Held Item
  document.getElementById('held-transactions-tbody')?.addEventListener('click', (e) => {
    const recallBtn = e.target.closest('.btn-recall-held-item');
    if (!recallBtn) return;
    const idx = parseInt(recallBtn.getAttribute('data-idx'), 10);
    const item = posHeldCarts[idx];
    if (!item) return;

    posCart = item.cart || [];
    selectPosCustomer(item.customer || null);
    posHeldCarts.splice(idx, 1);
    saveHeldCartsToLocal();

    renderPosCart();
    calculatePosTotals();
    modalHeldList?.classList.add('hidden');
    showToast('🛒 Held transaction restored to active cart!');
  });

  // 7. Complete Sale Action (Checkout & Redirect to Sales History)
  document.getElementById('btn-pos-complete-sale')?.addEventListener('click', async () => {
    if (enforceReadOnly('Complete Sale')) return;

    if (posCart.length === 0) {
      showToast('⚠️ Cart is empty. Add products first.', true);
      return;
    }

    const { rawSubtotal, totalDiscountAmount, netSubtotal, taxAmount, grandTotal } = calculatePosTotals();
    const completeBtn = document.getElementById('btn-pos-complete-sale');
    const cashInput = document.getElementById('pos-cash-received-input');
    const cashReceived = posSelectedPayMethod === 'Cash' ? (parseFloat(cashInput?.value) || grandTotal) : grandTotal;
    const changeDue = Math.max(0, cashReceived - grandTotal);

    // Strict Stock Quantity Verification before checkout
    for (const item of posCart) {
      const maxStock = parseInt(item.max_stock !== undefined ? item.max_stock : 999999, 10);
      if (item.quantity > maxStock) {
        showToast(`⚠️ Cannot complete sale: "${item.name}" quantity (${item.quantity}) exceeds available stock (${maxStock})!`, true);
        return;
      }
    }

    // Credit Sale Verification
    if (posSelectedPayMethod === 'Credit') {
      if (!posSelectedCustomer) {
        showToast('⚠️ Customer required for credit sale. Please select a customer.', true);
        return;
      }
      const custCreditLimit = (posSelectedCustomer.credit_limit !== undefined && posSelectedCustomer.credit_limit !== null && !isNaN(parseFloat(posSelectedCustomer.credit_limit))) ? parseFloat(posSelectedCustomer.credit_limit) : 0;
      const custCreditUsed = parseFloat(posSelectedCustomer.credit_used || 0);
      const avail = Math.max(0, custCreditLimit - custCreditUsed);

      if (avail <= 0 || grandTotal > avail) {
        showToast(`⚠️ Credit limit exceeded! Available: Tk ${avail.toFixed(2)}`, true);
        return;
      }
    }

    if (completeBtn) completeBtn.disabled = true;

    const payload = {
      action: 'complete_sale',
      pharmacy_id: pharmacyId,
      customer_id: posSelectedCustomer ? posSelectedCustomer.id : null,
      customer_name: posSelectedCustomer ? posSelectedCustomer.name : 'Walk-in Customer',
      customer_phone: posSelectedCustomer ? posSelectedCustomer.phone : '',
      items: posCart,
      subtotal: rawSubtotal,
      discount_amount: totalDiscountAmount,
      discount_percent: rawSubtotal > 0 ? ((totalDiscountAmount / rawSubtotal) * 100) : 0,
      tax_amount: taxAmount,
      total_amount: grandTotal,
      payment_method: posSelectedPayMethod,
      cash_received: cashReceived,
      change_due: changeDue,
      notes: ''
    };

    let serverSuccess = false;
    let serverError = null;
    let invoiceNo = `INV-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`;

    for (const url of POS_API_ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success) {
            serverSuccess = true;
            if (json.invoice_number) invoiceNo = json.invoice_number;
            break;
          } else if (json && json.error) {
            serverError = json.error;
            break;
          }
        }
      } catch (err) {}
    }

    if (!serverSuccess && serverError) {
      if (completeBtn) completeBtn.disabled = false;
      showToast(`⚠️ ${serverError}`, true);
      return;
    }

    // Update Customer Credit and Spend in Local State
    if (posSelectedCustomer) {
      const cIdx = currentCustomersList.findIndex(c => c.id == posSelectedCustomer.id);
      if (cIdx !== -1) {
        currentCustomersList[cIdx].total_spend = (parseFloat(currentCustomersList[cIdx].total_spend) || 0) + grandTotal;
        currentCustomersList[cIdx].orders_count = (parseInt(currentCustomersList[cIdx].orders_count, 10) || 0) + 1;
        if (posSelectedPayMethod === 'Credit') {
          currentCustomersList[cIdx].credit_used = (parseFloat(currentCustomersList[cIdx].credit_used) || 0) + grandTotal;
        }
        currentCustomersList[cIdx].last_visit = new Date().toISOString();
        try {
          localStorage.setItem(`ezpharma_customers_pharm_${pharmacyId}`, JSON.stringify(currentCustomersList));
        } catch (e) {}
      }
    }

    // Play POS Beep sound
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.1;
      osc.start();
      setTimeout(() => osc.stop(), 120);
    } catch (e) {}

    showToast(`🎉 Sale completed! Invoice: ${invoiceNo}`);

    // Clear POS State
    posCart = [];
    selectPosCustomer(null);
    if (cashInput) cashInput.value = '';
    renderPosCart();
    calculatePosTotals();
    if (completeBtn) completeBtn.disabled = false;

    // Redirect to Sales History page (Image 1)
    setTimeout(() => {
      navigateTo('/dashboard/pos/sales-history');
    }, 450);
  });

  // 8. Keyboard Shortcuts Modal & Event Handlers (F1 - F11, Esc, Delete) (Image 4)
  const modalShortcuts = document.getElementById('modal-pos-shortcuts');

  const toggleShortcutsModal = () => {
    if (!modalShortcuts) return;
    modalShortcuts.classList.toggle('hidden');
  };

  document.getElementById('btn-open-pos-shortcuts')?.addEventListener('click', toggleShortcutsModal);
  document.getElementById('btn-pos-open-shortcuts')?.addEventListener('click', toggleShortcutsModal);
  document.getElementById('btn-close-shortcuts-modal')?.addEventListener('click', () => modalShortcuts?.classList.add('hidden'));
  document.getElementById('btn-shortcuts-got-it')?.addEventListener('click', () => modalShortcuts?.classList.add('hidden'));

  // POS Theme Toggle Button
  document.getElementById('btn-pos-toggle-theme')?.addEventListener('click', () => {
    const currentTheme = htmlElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
    localStorage.setItem('ezpharma-theme', newTheme);
    showToast(`🎨 Switched to ${newTheme} mode.`);
  });

  // Global Keyboard Listener (F1 to F11)
  window.addEventListener('keydown', (e) => {
    // Only intercept when POS subview is visible
    const isPosActive = viewPos && !viewPos.classList.contains('hidden');

    if (e.key === 'F9') {
      e.preventDefault();
      toggleShortcutsModal();
      return;
    }

    if (!isPosActive) return;

    // F1: Focus product search
    if (e.key === 'F1') {
      e.preventDefault();
      const input = document.getElementById('pos-product-search-input');
      if (input) {
        input.focus();
        input.select();
      }
      return;
    }

    // F2: Start product navigation focus
    if (e.key === 'F2') {
      e.preventDefault();
      posSelectedProductIndex = 0;
      renderPosProductsGrid();
      return;
    }

    // F3: Focus cash received input & switch to Cash mode
    if (e.key === 'F3') {
      e.preventDefault();
      const cashTab = document.querySelector('.pos-pay-tab[data-method="Cash"]');
      if (cashTab) cashTab.click();
      const cashInput = document.getElementById('pos-cash-received-input');
      if (cashInput) {
        cashInput.focus();
        cashInput.select();
      }
      return;
    }

    // F4: Complete Sale
    if (e.key === 'F4') {
      e.preventDefault();
      const compBtn = document.getElementById('btn-pos-complete-sale');
      if (compBtn && !compBtn.disabled) compBtn.click();
      return;
    }

    // F5: Prevent refresh on POS & trigger print
    if (e.key === 'F5') {
      e.preventDefault();
      showToast('🖨️ Printing current invoice receipt...');
      return;
    }

    // F6: Clear cart
    if (e.key === 'F6') {
      e.preventDefault();
      if (posCart.length > 0) {
        posCart = [];
        renderPosCart();
        calculatePosTotals();
        showToast('🗑 Cart cleared');
      }
      return;
    }

    // F7: Focus customer search
    if (e.key === 'F7') {
      e.preventDefault();
      const custInput = document.getElementById('pos-customer-search-input');
      if (custInput) {
        custInput.focus();
        custInput.select();
      }
      return;
    }

    // F8: Focus barcode scanner / search
    if (e.key === 'F8') {
      e.preventDefault();
      const input = document.getElementById('pos-product-search-input');
      if (input) input.focus();
      return;
    }

    // F9: Open keyboard shortcuts help modal (Image Match)
    if (e.key === 'F9') {
      e.preventDefault();
      openShortcutsModal();
      return;
    }

    // F10: Hold transaction (Image 5)
    if (e.key === 'F10') {
      e.preventDefault();
      openHoldModal();
      return;
    }

    // F11: View held transactions
    if (e.key === 'F11') {
      e.preventDefault();
      openHeldListModal();
      return;
    }

    // Delete key: remove last item from cart
    if (e.key === 'Delete' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      if (posCart.length > 0) {
        posCart.pop();
        renderPosCart();
        calculatePosTotals();
      }
      return;
    }

    // Esc: close modals or exit navigation
    if (e.key === 'Escape') {
      modalShortcuts?.classList.add('hidden');
      modalHold?.classList.add('hidden');
      modalHeldList?.classList.add('hidden');
      posSelectedProductIndex = -1;
      renderPosProductsGrid();
      return;
    }

    // Product Arrow Navigation (Image 4 Pro Tips)
    if (posSelectedProductIndex !== -1 && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      const cards = document.querySelectorAll('.pos-product-card');
      const maxIdx = cards.length - 1;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        posSelectedProductIndex = Math.min(maxIdx, posSelectedProductIndex + 1);
        renderPosProductsGrid();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        posSelectedProductIndex = Math.max(0, posSelectedProductIndex - 1);
        renderPosProductsGrid();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        posSelectedProductIndex = Math.min(maxIdx, posSelectedProductIndex + 3);
        renderPosProductsGrid();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        posSelectedProductIndex = Math.max(0, posSelectedProductIndex - 3);
        renderPosProductsGrid();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selectedCard = document.querySelector(`.pos-product-card[data-index="${posSelectedProductIndex}"]`);
        if (selectedCard) {
          const pId = selectedCard.getAttribute('data-id');
          const product = posProductsList.find(p => p.id == pId);
          if (product) addProductToPosCart(product);
        }
      }
    }
  });

  // 9. Sales History View Logic (Image 1, 2, 3, 4, 5)
  let salesHistoryPage = 1;
  let salesHistoryPerPage = 20;
  let salesSortField = 'created_at';
  let salesSortAsc = false;
  let currentSalesHistoryList = [];
  let currentActiveSaleDetails = null;

  const modalInvoiceView = document.getElementById('modal-pos-invoice-view');
  const modalProcessReturn = document.getElementById('modal-pos-process-return');

  const loadAndRenderSalesHistory = async (page = 1) => {
    salesHistoryPage = page;
    const tbody = document.getElementById('sales-history-table-tbody');
    const countLabel = document.getElementById('sales-history-count-label');
    const pageNumContainer = document.getElementById('sales-page-numbers-container');
    const prevBtn = document.getElementById('sales-hist-btn-prev');
    const nextBtn = document.getElementById('sales-hist-btn-next');

    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-muted">Loading sales records...</td></tr>`;

    const search = document.getElementById('sales-history-search-input')?.value || '';
    const dateFrom = document.getElementById('sales-filter-start-date')?.value || '';
    const dateTo = document.getElementById('sales-filter-end-date')?.value || '';
    salesSortField = document.getElementById('sales-sort-by-select')?.value || 'created_at';
    salesHistoryPerPage = parseInt(document.getElementById('sales-per-page-select')?.value || '20', 10);

    let sales = [];
    let total = 0;
    let totalPages = 1;

    for (const url of POS_API_ENDPOINTS) {
      try {
        const queryParams = new URLSearchParams({
          action: 'list_sales',
          pharmacy_id: pharmacyId,
          search,
          from: dateFrom,
          to: dateTo,
          sort: salesSortField,
          order: salesSortAsc ? 'ASC' : 'DESC',
          page,
          per_page: salesHistoryPerPage
        });

        const res = await fetch(`${url}?${queryParams.toString()}`);
        if (res.ok) {
          const json = await res.json();
          if (json && json.success) {
            sales = json.sales || [];
            total = json.total || 0;
            totalPages = json.total_pages || 1;
            break;
          }
        }
      } catch (e) {}
    }

    currentSalesHistoryList = sales;

    if (sales.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-muted">No sales invoices found matching your filters.</td></tr>`;
      if (countLabel) countLabel.textContent = 'Showing 0 of 0 results';
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      if (pageNumContainer) pageNumContainer.innerHTML = '<span class="sales-page-num active">1</span>';
      return;
    }

    const startCount = (page - 1) * salesHistoryPerPage + 1;
    const endCount = Math.min(page * salesHistoryPerPage, total);
    if (countLabel) countLabel.textContent = `Showing ${startCount} to ${endCount} of ${total} results`;
    
    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextBtn) nextBtn.disabled = page >= totalPages;

    // Render pagination page number buttons
    if (pageNumContainer) {
      let pageHtml = '';
      for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= page - 2 && p <= page + 2)) {
          pageHtml += `<span class="sales-page-num ${p === page ? 'active' : ''}" data-page="${p}">${p}</span>`;
        }
      }
      pageNumContainer.innerHTML = pageHtml;
    }

    // Render Rows (Image 1 Table Design)
    tbody.innerHTML = sales.map((s, idx) => {
      const dt = s.created_at ? new Date(s.created_at).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '—';
      const shortId = (s.invoice_number || '').replace('INV-', '').slice(-6).toLowerCase() || `f${(s.id * 1337).toString(16).slice(-6)}`;
      const itemsList = s.items || [];
      const itemsCount = itemsList.length || s.total_items_count || 1;

      // Multiline items list (Image 1)
      let itemsHtml = '';
      if (itemsList.length > 0) {
        itemsHtml = itemsList.map(it => `
          <div class="hist-item-row" style="margin-bottom: 3px;">
            <span class="hist-item-name" style="text-transform: uppercase; font-size: 0.78rem; font-weight: 700; color: #334155;">${escapeHtml(it.product_name || 'Item')}</span>
            <span class="hist-sku-text" style="font-size: 0.7rem; color: #64748b;">SKU: ${escapeHtml(it.sku || (it.product_name ? it.product_name.slice(0, 5).toUpperCase() + '-X' + it.product_id : 'N/A'))}</span>
          </div>
        `).join('');
        itemsHtml += `<div class="hist-items-count-text" style="font-size: 0.72rem; color: #94a3b8; margin-top: 2px;">${itemsCount} item${itemsCount > 1 ? 's' : ''}</div>`;
      } else {
        itemsHtml = `<div class="hist-item-row"><span class="hist-item-name" style="text-transform: uppercase; font-size: 0.78rem; font-weight: 700; color: #334155;">STANDARD SALE</span></div><div class="hist-items-count-text" style="font-size: 0.72rem; color: #94a3b8;">1 item</div>`;
      }

      const payMethod = s.payment_method || 'Cash';

      return `
        <tr data-id="${s.id}" data-idx="${idx}">
          <td><span class="sale-id-mono" style="font-weight: 700; color: #0f172a;">${escapeHtml(shortId)}</span></td>
          <td style="color: #334155; font-size: 0.8rem;">${escapeHtml(dt)}</td>
          <td><strong style="color: #0f172a; font-size: 0.82rem;">${escapeHtml(s.customer_name || 'Walk-in Customer')}</strong></td>
          <td><div class="hist-items-list">${itemsHtml}</div></td>
          <td><strong style="color: #0f172a; font-size: 0.84rem;">${formatPrice(s.total_amount || 0)}</strong></td>
          <td style="color: #334155; font-size: 0.82rem;">${escapeHtml(payMethod)}</td>
          <td><span class="badge-status badge-active" style="background: #dcfce7; color: #15803d; font-weight: 600; font-size: 0.72rem; padding: 2px 8px; border-radius: 9999px;">completed</span></td>
          <td class="text-right">
            <div class="sales-actions-cell" style="display: flex; align-items: center; justify-content: flex-end; gap: 0.5rem;">
              <button type="button" class="btn-hist-action btn-view-receipt" data-idx="${idx}" title="View Receipt" style="color: #2563eb; background: none; border: none; cursor: pointer; padding: 2px;">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
              </button>
              <button type="button" class="btn-hist-action btn-process-return" data-idx="${idx}" title="Process Return" style="color: #ea580c; background: none; border: none; cursor: pointer; padding: 2px;">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
              </button>
              <button type="button" class="btn-hist-action btn-delete-sale" data-idx="${idx}" title="Delete" style="color: #ef4444; background: none; border: none; cursor: pointer; padding: 2px;">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  };

  // Sales History Filter Listeners
  document.getElementById('sales-history-search-input')?.addEventListener('input', () => loadAndRenderSalesHistory(1));
  document.getElementById('sales-filter-start-date')?.addEventListener('change', () => loadAndRenderSalesHistory(1));
  document.getElementById('sales-filter-end-date')?.addEventListener('change', () => loadAndRenderSalesHistory(1));
  document.getElementById('sales-sort-by-select')?.addEventListener('change', () => loadAndRenderSalesHistory(1));
  document.getElementById('sales-per-page-select')?.addEventListener('change', () => loadAndRenderSalesHistory(1));

  // Sort Order Direction Toggle
  document.getElementById('sales-btn-sort-dir')?.addEventListener('click', () => {
    salesSortAsc = !salesSortAsc;
    const arrow = document.getElementById('sales-sort-arrow-icon');
    if (arrow) arrow.textContent = salesSortAsc ? '↑' : '↓';
    loadAndRenderSalesHistory(1);
  });

  // Pagination clicks
  document.getElementById('sales-hist-btn-prev')?.addEventListener('click', () => {
    if (salesHistoryPage > 1) loadAndRenderSalesHistory(salesHistoryPage - 1);
  });
  document.getElementById('sales-hist-btn-next')?.addEventListener('click', () => {
    loadAndRenderSalesHistory(salesHistoryPage + 1);
  });
  document.getElementById('sales-page-numbers-container')?.addEventListener('click', (e) => {
    const num = e.target.closest('.sales-page-num');
    if (num && num.getAttribute('data-page')) {
      const p = parseInt(num.getAttribute('data-page'), 10);
      loadAndRenderSalesHistory(p);
    }
  });

  // Export Buttons (Excel / CSV / Print)
  document.getElementById('btn-sales-export-csv')?.addEventListener('click', () => {
    if (currentSalesHistoryList.length === 0) {
      showToast('⚠️ No sales records to export.', true);
      return;
    }
    const headers = ['Sale ID', 'Invoice Number', 'Date', 'Customer', 'Items Count', 'Subtotal', 'Tax', 'Total', 'Payment Method', 'Status'];
    const rows = currentSalesHistoryList.map(s => [
      s.id,
      `"${s.invoice_number}"`,
      `"${s.created_at}"`,
      `"${s.customer_name || 'Walk-in'}"`,
      s.total_items_count || 1,
      s.subtotal,
      s.tax_amount,
      s.total_amount,
      s.payment_method,
      s.status
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sales_history_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  document.getElementById('btn-sales-export-excel')?.addEventListener('click', () => {
    document.getElementById('btn-sales-export-csv')?.click();
  });

  document.getElementById('btn-sales-export-print')?.addEventListener('click', () => {
    window.print();
  });

  // Table Row Actions: View Receipt (Image 2) & Process Return (Image 5)
  document.getElementById('sales-history-table-tbody')?.addEventListener('click', (e) => {
    // 1. View Receipt
    const viewBtn = e.target.closest('.btn-view-receipt');
    if (viewBtn) {
      const idx = parseInt(viewBtn.getAttribute('data-idx'), 10);
      const sale = currentSalesHistoryList[idx];
      if (sale) openInvoiceDetailsModal(sale);
      return;
    }

    // 2. Process Return (Image 5)
    const retBtn = e.target.closest('.btn-process-return');
    if (retBtn) {
      const idx = parseInt(retBtn.getAttribute('data-idx'), 10);
      const sale = currentSalesHistoryList[idx];
      if (sale) openProcessReturnModal(sale);
      return;
    }

    // 3. Delete Sale
    const delBtn = e.target.closest('.btn-delete-sale');
    if (delBtn) {
      const idx = parseInt(delBtn.getAttribute('data-idx'), 10);
      const sale = currentSalesHistoryList[idx];
      if (sale) {
        showConfirmModal(
          'Delete Sale Record',
          `Are you sure you want to remove invoice ${sale.invoice_number}?`,
          async () => {
            currentSalesHistoryList.splice(idx, 1);
            loadAndRenderSalesHistory(salesHistoryPage);
            showToast('🗑 Sale record deleted.');
          }
        );
      }
    }
  });

  // Helper for dynamic pharmacy brand details
  const getPharmacyBrandDetails = () => {
    let pName = (savedSettings && savedSettings.business_name) || (currentPharm && currentPharm.name) || (sessionData && sessionData.pharmacy_name) || pharmName || 'Demo Pharmacy';
    let pPhone = (savedSettings && (savedSettings.business_phone || savedSettings.phone)) || (currentPharm && currentPharm.phone) || '—';
    let pEmail = (savedSettings && (savedSettings.business_email || savedSettings.email)) || (currentPharm && currentPharm.email) || (sessionData && sessionData.email) || 'admin@pharmacy.com';
    let pAddress = (savedSettings && savedSettings.address) || (currentPharm && currentPharm.address) || '—';
    return { name: pName, phone: pPhone, email: pEmail, address: pAddress };
  };

  // 9.1 Open Invoice Details Modal (Image 2)
  const openInvoiceDetailsModal = async (sale) => {
    if (!sale) return;
    currentActiveSaleDetails = sale;

    // Fetch full item details if not loaded
    if (!sale.items || sale.items.length === 0) {
      for (const url of POS_API_ENDPOINTS) {
        try {
          const res = await fetch(`${url}?action=get_sale&id=${sale.id}&pharmacy_id=${pharmacyId}`);
          if (res.ok) {
            const json = await res.json();
            if (json && json.success && json.items) {
              sale.items = json.items;
              break;
            }
          }
        } catch (e) {}
      }
    }

    const brand = getPharmacyBrandDetails();

    const nameEl = document.getElementById('inv-modal-pharmacy-name');
    const contactEl = document.getElementById('inv-modal-pharmacy-contact');
    const custNameEl = document.getElementById('inv-modal-customer-name');
    const custPhoneEl = document.getElementById('inv-modal-customer-phone');
    const invNumEl = document.getElementById('inv-modal-number');
    const invDateEl = document.getElementById('inv-modal-date');
    const payMethodEl = document.getElementById('inv-modal-pay-method');
    const cashierEl = document.getElementById('inv-modal-cashier');

    if (nameEl) nameEl.textContent = brand.name;
    if (contactEl) contactEl.innerHTML = `—<br>Phone: ${escapeHtml(brand.phone)}<br>Email: ${escapeHtml(brand.email)}`;
    if (custNameEl) custNameEl.textContent = sale.customer_name || 'Walk-in Customer';
    if (custPhoneEl) custPhoneEl.textContent = sale.customer_phone ? `Phone: ${sale.customer_phone}` : '';
    if (invNumEl) invNumEl.textContent = sale.invoice_number || `INV-${sale.id}`;
    if (invDateEl) invDateEl.textContent = sale.created_at ? new Date(sale.created_at).toLocaleString() : new Date().toLocaleString();
    if (payMethodEl) payMethodEl.textContent = (sale.payment_method || 'Cash').toLowerCase();
    if (cashierEl) cashierEl.textContent = 'Pharmacy Admin';

    // Render items table
    const tbody = document.getElementById('inv-modal-items-tbody');
    const items = sale.items || [];
    if (tbody) {
      if (items.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td>
              <strong>General Medicines</strong>
              <div class="text-muted" style="font-size:0.75rem;">Standard item</div>
            </td>
            <td class="text-center">1</td>
            <td class="text-right">${formatPrice(sale.total_amount)}</td>
            <td class="text-right">${formatPrice(0)}</td>
            <td class="text-right"><strong>${formatPrice(sale.total_amount)}</strong></td>
          </tr>
        `;
      } else {
        tbody.innerHTML = items.map(it => {
          const unitPrice = parseFloat(it.unit_price || it.price || 0);
          const qty = parseInt(it.quantity || 1, 10);
          const discAmt = parseFloat(it.discount_amount || 0);
          const amount = parseFloat(it.total_price || (unitPrice * qty - discAmt));
          return `
            <tr>
              <td>
                <strong style="text-transform: uppercase;">${escapeHtml(it.product_name || 'Item')}</strong>
                <div class="text-muted" style="font-size:0.75rem;">SKU: ${escapeHtml(it.sku || 'N/A')}</div>
              </td>
              <td class="text-center">${qty}</td>
              <td class="text-right">${formatPrice(unitPrice)}</td>
              <td class="text-right">${formatPrice(discAmt)}</td>
              <td class="text-right"><strong>${formatPrice(amount)}</strong></td>
            </tr>
          `;
        }).join('');
      }
    }

    const subtotal = parseFloat(sale.subtotal || sale.total_amount || 0);
    const tax = parseFloat(sale.tax_amount || 0);
    const total = parseFloat(sale.total_amount || 0);

    const subtotalEl = document.getElementById('inv-modal-subtotal');
    const vatEl = document.getElementById('inv-modal-vat');
    const grandTotalEl = document.getElementById('inv-modal-grand-total');

    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
    if (vatEl) vatEl.textContent = formatPrice(tax);
    if (grandTotalEl) grandTotalEl.textContent = formatPrice(total);

    if (modalInvoiceView) modalInvoiceView.classList.remove('hidden');
  };

  document.getElementById('btn-close-invoice-modal')?.addEventListener('click', () => modalInvoiceView?.classList.add('hidden'));
  modalInvoiceView?.addEventListener('click', (e) => {
    if (e.target === modalInvoiceView) modalInvoiceView.classList.add('hidden');
  });

  // 9.2 Printable A4 Invoice (Image 3)
  const triggerA4Print = () => {
    if (!currentActiveSaleDetails) return;
    const sale = currentActiveSaleDetails;
    const brand = getPharmacyBrandDetails();
    const items = sale.items || [];

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return;

    let itemsRows = items.map(it => `
      <tr>
        <td style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0;">
          <div style="font-weight: 700; text-transform: uppercase;">${escapeHtml(it.product_name || 'Item')}</div>
          <div style="font-size: 11px; color: #64748b;">SKU: ${escapeHtml(it.sku || 'N/A')}</div>
        </td>
        <td style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; text-align: center;">${it.quantity || 1}</td>
        <td style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatPrice(it.unit_price || it.price || 0)}</td>
        <td style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatPrice(it.discount_amount || 0)}</td>
        <td style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700;">${formatPrice(it.total_price || 0)}</td>
      </tr>
    `).join('');

    if (!itemsRows) {
      itemsRows = `
        <tr>
          <td style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0;">General Medicines</td>
          <td style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; text-align: center;">1</td>
          <td style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatPrice(sale.total_amount)}</td>
          <td style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatPrice(0)}</td>
          <td style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700;">${formatPrice(sale.total_amount)}</td>
        </tr>
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${sale.invoice_number}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #0f172a; line-height: 1.5; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          h1 { margin: 0; font-size: 26px; font-weight: 900; letter-spacing: 0.05em; }
          h3 { margin: 4px 0 0 0; font-size: 16px; font-weight: 700; }
          p { margin: 2px 0; }
          .meta-table { width: 100%; margin: 30px 0 20px 0; }
          .items-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          .items-table th { padding: 8px 6px; border-bottom: 2px solid #0f172a; text-align: left; font-size: 13px; }
          .sum-row { display: flex; justify-content: flex-end; gap: 30px; margin: 4px 0; font-size: 14px; }
          .sum-total { font-size: 16px; font-weight: 900; margin-top: 8px; border-top: 1px solid #0f172a; padding-top: 8px; }
          @media print { @page { margin: 20mm; } }
        </style>
      </head>
      <body>
        <div class="text-center">
          <h1>INVOICE</h1>
          <h3>${escapeHtml(brand.name)}</h3>
          <p>—</p>
          <p>Phone: ${escapeHtml(brand.phone)}</p>
          <p>Email: ${escapeHtml(brand.email)}</p>
        </div>

        <table class="meta-table">
          <tr>
            <td style="vertical-align: top;">
              <div style="font-size: 13px; font-weight: 700; color: #64748b;">Bill To:</div>
              <div style="font-size: 16px; font-weight: 700; margin-top: 4px;">${escapeHtml(sale.customer_name || 'Walk-in Customer')}</div>
            </td>
            <td class="text-right" style="vertical-align: top; font-size: 13px;">
              <div><strong>Invoice #:</strong> ${escapeHtml(sale.invoice_number || `INV-${sale.id}`)}</div>
              <div><strong>Date:</strong> ${escapeHtml(sale.created_at ? new Date(sale.created_at).toLocaleString() : '')}</div>
              <div><strong>Payment Method:</strong> ${(sale.payment_method || 'Cash').toLowerCase()}</div>
              <div><strong>Processed by:</strong> Pharmacy Admin</div>
            </td>
          </tr>
        </table>

        <table class="items-table">
          <thead>
            <tr>
              <th>Item</th>
              <th class="text-center">Qty</th>
              <th class="text-right">Unit Price</th>
              <th class="text-right">Discount</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div style="margin-top: 20px; text-align: right;">
          <div class="sum-row"><span>Subtotal:</span> <strong>${formatPrice(sale.subtotal || sale.total_amount)}</strong></div>
          <div class="sum-row"><span>VAT:</span> <strong>${formatPrice(sale.tax_amount || 0)}</strong></div>
          <div class="sum-row sum-total"><span>Total:</span> <strong>${formatPrice(sale.total_amount)}</strong></div>
        </div>

        <div class="text-center" style="margin-top: 50px;">
          <div style="font-weight: 700;">Thank you for your business!</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Payment is due within 30 days</div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  document.getElementById('btn-modal-print-invoice')?.addEventListener('click', triggerA4Print);
  document.getElementById('btn-modal-print-invoice-btm')?.addEventListener('click', triggerA4Print);

  // 9.3 Thermal Receipt Print (Image 4)
  const triggerThermalPrint = () => {
    if (!currentActiveSaleDetails) return;
    const sale = currentActiveSaleDetails;
    const brand = getPharmacyBrandDetails();
    const items = sale.items || [];

    const printWindow = window.open('', '_blank', 'width=420,height=680');
    if (!printWindow) {
      showToast('⚠️ Pop-up was blocked. Please allow pop-ups for thermal printing.', true);
      return;
    }

    const shortId = (sale.invoice_number || '').replace('INV-', 'INV') || `INV${sale.id}`;
    const dt = sale.created_at ? new Date(sale.created_at).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : new Date().toLocaleString();

    let itemsThermal = items.map(it => {
      const pName = (it.product_name || 'Medicine').toUpperCase();
      const qty = parseInt(it.quantity || 1, 10);
      const unitPrice = parseFloat(it.unit_price || it.price || 0);
      const lineTotal = parseFloat(it.total_price || (unitPrice * qty));
      return `
        <div style="margin: 6px 0;">
          <div style="display: flex; justify-content: space-between; font-weight: bold;">
            <span>${escapeHtml(pName)}</span>
            <span>${qty}&nbsp;&nbsp;${formatPrice(unitPrice)}</span>
          </div>
          <div style="font-weight: bold;">${formatPrice(lineTotal)}</div>
        </div>
      `;
    }).join('');

    if (!itemsThermal) {
      itemsThermal = `
        <div style="margin: 6px 0;">
          <div style="display: flex; justify-content: space-between; font-weight: bold;">
            <span>STANDARD SALE</span>
            <span>1&nbsp;&nbsp;${formatPrice(sale.total_amount)}</span>
          </div>
          <div style="font-weight: bold;">${formatPrice(sale.total_amount)}</div>
        </div>
      `;
    }

    const subtotal = parseFloat(sale.subtotal || sale.total_amount || 0);
    const tax = parseFloat(sale.tax_amount || 0);
    const total = parseFloat(sale.total_amount || 0);
    const payMethod = (sale.payment_method || 'Cash').toLowerCase();

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Thermal Receipt</title>
        <style>
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            background: #ffffff;
            color: #000000;
            width: 76mm;
            margin: 0 auto;
            padding: 16px 10px;
            font-size: 13px;
            line-height: 1.4;
          }
          .text-center { text-align: center; }
          .dashed-divider {
            border-top: 1px dashed #000000;
            margin: 8px 0;
            width: 100%;
          }
          .meta-item {
            margin: 2px 0;
          }
          .flex-row {
            display: flex;
            justify-content: space-between;
          }
          .bold {
            font-weight: bold;
          }
          @media print {
            body {
              width: 100%;
              padding: 0;
              margin: 0;
            }
            @page {
              margin: 0;
              size: 80mm auto;
            }
          }
        </style>
      </head>
      <body>
        <div class="text-center bold" style="font-size: 14px;">${escapeHtml(brand.name)}</div>
        <div class="text-center">-</div>
        <div class="text-center">Phone: ${escapeHtml(brand.phone)}</div>
        <div class="text-center">Email: ${escapeHtml(brand.email)}</div>

        <div class="dashed-divider"></div>
        <div class="text-center bold" style="letter-spacing: 0.05em;">SALES RECEIPT</div>
        <div class="dashed-divider"></div>

        <div class="meta-item">Invoice #: ${escapeHtml(shortId)}</div>
        <div class="meta-item">Date: ${escapeHtml(dt)}</div>
        <div class="meta-item">Customer: ${escapeHtml(sale.customer_name || 'Walk-in Customer')}</div>
        <div class="meta-item">Cashier: Pharmacy Admin</div>

        <div class="dashed-divider"></div>
        <div class="flex-row bold">
          <span>Item</span>
          <span>Qty&nbsp;&nbsp;Price</span>
        </div>
        <div class="bold">Total</div>
        <div class="dashed-divider"></div>

        ${itemsThermal}

        <div class="dashed-divider"></div>
        <div class="meta-item">Subtotal: ${formatPrice(subtotal)}</div>
        <div class="meta-item">Tax: ${formatPrice(tax)}</div>
        <div class="bold" style="margin-top: 4px;">TOTAL</div>
        <div class="bold" style="font-size: 15px; margin-bottom: 2px;">${formatPrice(total)}</div>
        <div class="meta-item">Payment: ${escapeHtml(payMethod)}</div>

        <div class="dashed-divider"></div>
        <div class="text-center" style="margin-top: 14px;">
          <div>Thank you for your business!</div>
          <div style="margin-top: 3px;">Payment is due within 30 days</div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 250);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  document.getElementById('btn-modal-thermal-print')?.addEventListener('click', triggerThermalPrint);
  document.getElementById('btn-modal-thermal-print-btm')?.addEventListener('click', triggerThermalPrint);

  // 9.4 Process Return Modal Controller (Image 5 & Stock Restock)
  const openProcessReturnModal = async (sale) => {
    currentActiveSaleDetails = sale;
    document.getElementById('return-sale-id-input').value = sale.id;

    // Fetch items if missing
    if (!sale.items || sale.items.length === 0) {
      for (const url of POS_API_ENDPOINTS) {
        try {
          const res = await fetch(`${url}?action=get_sale&id=${sale.id}&pharmacy_id=${pharmacyId}`);
          if (res.ok) {
            const json = await res.json();
            if (json && json.success && json.items) {
              sale.items = json.items;
              break;
            }
          }
        } catch (e) {}
      }
    }

    const container = document.getElementById('return-modal-items-container');
    const items = sale.items || [];
    if (!container) return;

    if (items.length === 0) {
      container.innerHTML = `
        <div class="return-item-row">
          <div>
            <div class="return-item-title">Standard Item</div>
            <div class="return-item-sold">Sold: 1</div>
          </div>
          <div class="return-qty-input-wrap">
            <span>Qty</span>
            <input type="number" class="return-qty-ctrl" data-product-id="0" data-unit-price="${sale.total_amount}" min="0" max="1" value="0" />
          </div>
        </div>
      `;
    } else {
      container.innerHTML = items.map((it, idx) => `
        <div class="return-item-row">
          <div>
            <div class="return-item-title">${escapeHtml(it.product_name || 'Medicine')}</div>
            <div class="return-item-sold">Sold: ${it.quantity || 1}</div>
          </div>
          <div class="return-qty-input-wrap">
            <span>Qty</span>
            <input type="number" class="return-qty-ctrl" data-product-id="${it.product_id}" data-unit-price="${it.unit_price}" min="0" max="${it.quantity || 1}" value="0" />
          </div>
        </div>
      `).join('');
    }

    if (modalProcessReturn) modalProcessReturn.classList.remove('hidden');
  };

  document.getElementById('btn-close-return-modal')?.addEventListener('click', () => modalProcessReturn?.classList.add('hidden'));
  document.getElementById('btn-cancel-return-modal')?.addEventListener('click', () => modalProcessReturn?.classList.add('hidden'));

  // Submit Process Return Form (Image 5)
  document.getElementById('form-pos-process-return')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (enforceReadOnly('Process Return')) return;

    const saleId = document.getElementById('return-sale-id-input').value;
    const qtyInputs = document.querySelectorAll('#return-modal-items-container .return-qty-ctrl');
    const returnItems = [];

    qtyInputs.forEach(inp => {
      const qty = parseInt(inp.value, 10) || 0;
      const pId = inp.getAttribute('data-product-id');
      const unitPrice = parseFloat(inp.getAttribute('data-unit-price')) || 0;
      if (qty > 0) {
        returnItems.push({ product_id: pId, quantity: qty, unit_price: unitPrice });
      }
    });

    if (returnItems.length === 0) {
      showToast('⚠️ Please enter return quantity greater than 0.', true);
      return;
    }

    const payload = {
      action: 'process_return',
      pharmacy_id: pharmacyId,
      sale_id: saleId,
      returns: returnItems
    };

    let returnSuccess = false;
    for (const url of POS_API_ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success) {
            returnSuccess = true;
            break;
          }
        }
      } catch (err) {}
    }

    // Update local product inventory quantities
    returnItems.forEach(ret => {
      const p = posProductsList.find(pr => pr.id == ret.product_id);
      if (p) {
        p.stock_quantity = (parseInt(p.stock_quantity || 0, 10) + ret.quantity);
      }
    });

    modalProcessReturn?.classList.add('hidden');
    showToast('✅ Return processed and stock restored to inventory!');
    loadAndRenderSalesHistory(salesHistoryPage);
  });

  // ==============================================
  // 10. Cash Drawer Management Logic (Images 1, 2, 3)
  // ==============================================
  let currentActiveDrawerSession = null;
  const modalCashDrawerTx = document.getElementById('modal-cash-drawer-transaction');
  const modalCloseCashDrawer = document.getElementById('modal-close-cash-drawer');

  // 10.1 Tab Switcher (Current vs History)
  const tabDrawerCurrent = document.getElementById('tab-drawer-current');
  const tabDrawerHistory = document.getElementById('tab-drawer-history');
  const sectionDrawerCurrent = document.getElementById('drawer-current-tab-section');
  const sectionDrawerHistory = document.getElementById('drawer-history-tab-section');

  const cardDrawerClosed = document.getElementById('drawer-closed-state-card');
  const wrapDrawerActive = document.getElementById('drawer-active-state-wrap');

  tabDrawerCurrent?.addEventListener('click', () => {
    tabDrawerCurrent.classList.add('active');
    tabDrawerHistory?.classList.remove('active');
    sectionDrawerCurrent?.classList.remove('hidden');
    sectionDrawerHistory?.classList.add('hidden');
    loadAndRenderCashDrawer();
  });

  tabDrawerHistory?.addEventListener('click', () => {
    tabDrawerHistory.classList.add('active');
    tabDrawerCurrent?.classList.remove('active');
    sectionDrawerHistory?.classList.remove('hidden');
    sectionDrawerCurrent?.classList.add('hidden');
    loadAndRenderDrawerHistory();
  });

  // 10.2 Load and Render Current Cash Drawer (Images 1 & 2)
  const loadAndRenderCashDrawer = async () => {
    // Instant zero-flash sync check from local state
    try {
      const cachedStr = localStorage.getItem(`ezpharma_active_drawer_pharm_${pharmacyId}`);
      if (cachedStr) {
        const cached = JSON.parse(cachedStr);
        if (cached && cached.is_open && cached.drawer) {
          if (cardDrawerClosed) cardDrawerClosed.classList.add('hidden');
          if (wrapDrawerActive) wrapDrawerActive.classList.remove('hidden');
          const d = cached.drawer;
          const openEl = document.getElementById('drawer-disp-opening');
          const currEl = document.getElementById('drawer-disp-current');
          const countEl = document.getElementById('drawer-disp-tx-count');
          const timeEl = document.getElementById('drawer-disp-opened-at');
          if (openEl) openEl.textContent = formatPrice(d.opening_balance || 0);
          if (currEl) currEl.textContent = formatPrice(d.current_balance || 0);
          if (countEl) countEl.textContent = d.transactions_count || 0;
          if (timeEl && d.opened_at) {
            const dt = new Date(d.opened_at);
            const day = String(dt.getDate()).padStart(2, '0');
            const mo = String(dt.getMonth() + 1).padStart(2, '0');
            const yr = dt.getFullYear();
            const time = dt.toTimeString().split(' ')[0];
            timeEl.textContent = `${day}/${mo}/${yr} ${time}`;
          }
        }
      }
    } catch(e) {}

    let drawerData = null;

    for (const url of POS_API_ENDPOINTS) {
      try {
        const res = await fetch(`${url}?action=get_current_drawer&pharmacy_id=${pharmacyId}`);
        if (res.ok) {
          const json = await res.json();
          if (json && json.success) {
            drawerData = json;
            break;
          }
        }
      } catch (e) {}
    }

    const isOpen = Boolean(drawerData && drawerData.is_open && drawerData.drawer);

    if (!isOpen) {
      // STATE 1: DRAWER IS CLOSED (Image 1 - Start Shift Card)
      currentActiveDrawerSession = null;
      localStorage.removeItem(`ezpharma_active_drawer_pharm_${pharmacyId}`);
      document.getElementById('style-drawer-prehide')?.remove();
      if (cardDrawerClosed) {
        cardDrawerClosed.classList.remove('hidden');
        cardDrawerClosed.style.setProperty('display', 'block', 'important');
      }
      if (wrapDrawerActive) {
        wrapDrawerActive.classList.add('hidden');
        wrapDrawerActive.style.setProperty('display', 'none', 'important');
      }
      const startInp = document.getElementById('drawer-open-starting-input');
      if (startInp) startInp.value = '0.00';
      return;
    }

    // STATE 2: DRAWER IS ACTIVE / OPEN (Image 2 - Metric Cards & Live Table)
    localStorage.setItem(`ezpharma_active_drawer_pharm_${pharmacyId}`, JSON.stringify(drawerData));
    if (cardDrawerClosed) {
      cardDrawerClosed.classList.add('hidden');
      cardDrawerClosed.style.setProperty('display', 'none', 'important');
    }
    if (wrapDrawerActive) {
      wrapDrawerActive.classList.remove('hidden');
      wrapDrawerActive.style.setProperty('display', 'block', 'important');
    }

    currentActiveDrawerSession = drawerData.drawer;
    const d = drawerData.drawer;
    const txs = drawerData.transactions || [];

    // Render 4 Top Metrics (Image 2)
    const openEl = document.getElementById('drawer-disp-opening');
    const currEl = document.getElementById('drawer-disp-current');
    const countEl = document.getElementById('drawer-disp-tx-count');
    const timeEl = document.getElementById('drawer-disp-opened-at');

    if (openEl) openEl.textContent = formatPrice(d.opening_balance || 0);
    if (currEl) currEl.textContent = formatPrice(d.current_balance || 0);
    if (countEl) countEl.textContent = d.transactions_count || txs.length || 0;
    if (timeEl) {
      if (d.opened_at) {
        const dt = new Date(d.opened_at);
        const day = String(dt.getDate()).padStart(2, '0');
        const mo = String(dt.getMonth() + 1).padStart(2, '0');
        const yr = dt.getFullYear();
        const time = dt.toTimeString().split(' ')[0];
        timeEl.textContent = `${day}/${mo}/${yr} ${time}`;
      } else {
        timeEl.textContent = '—';
      }
    }

    // Render Transactions Table (Image 2)
    const tbody = document.getElementById('drawer-transactions-tbody');
    if (tbody) {
      if (txs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-5 text-muted drawer-empty-msg">No transactions yet. Sales, returns, and manual cash movements will appear here.</td></tr>`;
      } else {
        tbody.innerHTML = txs.map(t => {
          let timeStr = '—';
          if (t.created_at) {
            const dt = new Date(t.created_at);
            const day = String(dt.getDate()).padStart(2, '0');
            const mo = String(dt.getMonth() + 1).padStart(2, '0');
            const yr = dt.getFullYear();
            const time = dt.toTimeString().split(' ')[0];
            timeStr = `${day}/${mo}/${yr} ${time}`;
          }

          const rawType = (t.type || '').toLowerCase();
          let badgeClass = 'tx-badge-cash-in';
          let badgeText = '↑ Cash In';
          let isPositive = true;

          if (rawType === 'expense' || (t.reason && t.reason.toLowerCase().includes('expense'))) {
            badgeClass = 'tx-badge-expense';
            badgeText = '↓ Expense';
            isPositive = false;
          } else if (rawType === 'cash_out') {
            badgeClass = 'tx-badge-cash-out';
            badgeText = '↓ Cash Out';
            isPositive = false;
          } else if (rawType === 'sale') {
            badgeClass = 'tx-badge-sale';
            badgeText = '🛒 POS Sale';
            isPositive = true;
          } else if (rawType === 'refund') {
            badgeClass = 'tx-badge-expense';
            badgeText = '↩ Refund';
            isPositive = false;
          }

          const amtFormatted = isPositive ? `+${formatPrice(t.amount || 0)}` : `-${formatPrice(t.amount || 0)}`;
          const amtClass = isPositive ? 'tx-amount-green' : 'tx-amount-red';
          const noteText = escapeHtml(t.reason || t.reference_id || '—');

          return `
            <tr>
              <td>${timeStr}</td>
              <td><span class="tx-badge ${badgeClass}">${badgeText}</span></td>
              <td class="${amtClass}">${amtFormatted}</td>
              <td>${noteText}</td>
            </tr>
          `;
        }).join('');
      }
    }
  };

  // 10.3 Open Initial Cash Drawer (Image 1 Form Submit)
  document.getElementById('form-open-initial-drawer')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (enforceReadOnly('Open Drawer')) return;

    const startingCash = parseFloat(document.getElementById('drawer-open-starting-input').value) || 0;
    if (startingCash < 0) {
      showToast('⚠️ Opening balance cannot be negative.', true);
      return;
    }

    const payload = {
      action: 'open_drawer',
      pharmacy_id: pharmacyId,
      opening_balance: startingCash,
      user_name: 'Pharmacy Admin'
    };

    let openOk = false;
    for (const url of POS_API_ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success) {
            openOk = true;
            localStorage.setItem(`ezpharma_active_drawer_pharm_${pharmacyId}`, JSON.stringify(json));
            break;
          }
        }
      } catch (err) {}
    }

    showToast(`✅ Cash drawer opened with opening balance of ${formatPrice(startingCash)}!`);
    loadAndRenderCashDrawer();
  });

  // 10.4 Load and Render Drawer History (All Shifts including Open & Closed)
  const loadAndRenderDrawerHistory = async () => {
    let historyList = [];

    for (const url of POS_API_ENDPOINTS) {
      try {
        const res = await fetch(`${url}?action=get_drawer_history&pharmacy_id=${pharmacyId}`);
        if (res.ok) {
          const json = await res.json();
          if (json && json.success && json.history) {
            historyList = json.history;
            break;
          }
        }
      } catch (e) {}
    }

    const tbody = document.getElementById('drawer-history-tbody');
    if (tbody) {
      if (historyList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-muted">No drawer shifts recorded yet.</td></tr>`;
      } else {
        tbody.innerHTML = historyList.map(h => {
          let openDtStr = '—';
          if (h.opened_at) {
            const dt = new Date(h.opened_at);
            const day = String(dt.getDate()).padStart(2, '0');
            const mo = String(dt.getMonth() + 1).padStart(2, '0');
            const yr = dt.getFullYear();
            const time = dt.toTimeString().split(' ')[0];
            openDtStr = `${day}/${mo}/${yr} ${time}`;
          }

          let closeDtStr = '—';
          if (h.entry_type === 'active_opening' || h.status === 'open') {
            closeDtStr = '<span class="badge-status badge-active" style="background: #dcfce7; color: #15803d; font-weight: 600; padding: 2px 8px; border-radius: 9999px;">Active</span>';
          } else if (h.entry_type === 'closing' && h.closed_at) {
            const dt = new Date(h.closed_at);
            const day = String(dt.getDate()).padStart(2, '0');
            const mo = String(dt.getMonth() + 1).padStart(2, '0');
            const yr = dt.getFullYear();
            const time = dt.toTimeString().split(' ')[0];
            closeDtStr = `${day}/${mo}/${yr} ${time}`;
          } else {
            closeDtStr = '—';
          }

          const diff = parseFloat(h.difference || 0);
          let diffHtml = formatPrice(0);
          if (h.entry_type === 'active_opening' || h.entry_type === 'opening') {
            diffHtml = `<span style="color: #16a34a; font-weight: 600;">${formatPrice(0)}</span>`;
          } else if (diff > 0) {
            diffHtml = `<span class="tx-amount-green">+${formatPrice(diff)}</span>`;
          } else if (diff < 0) {
            diffHtml = `<span class="tx-amount-red">-${formatPrice(Math.abs(diff))}</span>`;
          } else {
            diffHtml = `<span class="tx-amount-green">${formatPrice(0)}</span>`;
          }

          const isOpeningEntry = (h.entry_type === 'opening' || h.entry_type === 'active_opening');
          const closingDisp = isOpeningEntry ? `<span style="color: #64748b; font-weight: 600;">—</span>` : `<strong>${formatPrice(h.closing_balance || 0)}</strong>`;
          const openingDisp = isOpeningEntry ? `<strong>${formatPrice(h.opening_balance || 0)}</strong>` : `${formatPrice(h.opening_balance || 0)}`;

          return `
            <tr>
              <td>${openDtStr}</td>
              <td>${closeDtStr}</td>
              <td><strong>${escapeHtml(h.user_name || 'Pharmacy Admin')}</strong></td>
              <td>${openingDisp}</td>
              <td>${closingDisp}</td>
              <td>${formatPrice(h.expected_balance || h.opening_balance || 0)}</td>
              <td>${diffHtml}</td>
            </tr>
          `;
        }).join('');
      }
    }
  };

  // 10.5 Open Transaction Modals (Image 4 from prior prompt)
  const openDrawerTxModal = (type, title) => {
    if (enforceReadOnly('Cash Drawer')) return;
    const titleEl = document.getElementById('modal-drawer-tx-title');
    const selectEl = document.getElementById('drawer-tx-type-select');
    const amountEl = document.getElementById('drawer-tx-amount-input');
    const noteEl = document.getElementById('drawer-tx-note-input');

    if (titleEl) titleEl.textContent = title;
    if (selectEl) selectEl.value = type;
    if (amountEl) amountEl.value = '';
    if (noteEl) noteEl.value = '';

    if (modalCashDrawerTx) modalCashDrawerTx.classList.remove('hidden');
    amountEl?.focus();
  };

  document.getElementById('btn-open-cash-in')?.addEventListener('click', () => openDrawerTxModal('cash_in', 'Cash In'));
  document.getElementById('btn-open-cash-out')?.addEventListener('click', () => openDrawerTxModal('cash_out', 'Cash Out'));
  document.getElementById('btn-open-expense')?.addEventListener('click', () => openDrawerTxModal('expense', 'Expense'));

  document.getElementById('btn-close-drawer-tx-modal')?.addEventListener('click', () => modalCashDrawerTx?.classList.add('hidden'));
  document.getElementById('btn-cancel-drawer-tx')?.addEventListener('click', () => modalCashDrawerTx?.classList.add('hidden'));

  // Submit Drawer Transaction Form
  document.getElementById('form-cash-drawer-transaction')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (enforceReadOnly('Add Transaction')) return;

    const type = document.getElementById('drawer-tx-type-select').value;
    const amount = parseFloat(document.getElementById('drawer-tx-amount-input').value) || 0;
    const note = document.getElementById('drawer-tx-note-input').value.trim();

    if (amount <= 0) {
      showToast('⚠️ Please enter a valid positive amount.', true);
      return;
    }

    const payload = {
      action: 'add_drawer_transaction',
      pharmacy_id: pharmacyId,
      drawer_id: currentActiveDrawerSession?.id || 0,
      type: type,
      amount: amount,
      note: note,
      user_name: 'Pharmacy Admin'
    };

    let submitOk = false;
    for (const url of POS_API_ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success) {
            submitOk = true;
            break;
          }
        }
      } catch (err) {}
    }

    modalCashDrawerTx?.classList.add('hidden');
    const label = type === 'cash_in' ? 'Cash In' : (type === 'cash_out' ? 'Cash Out' : 'Expense');
    showToast(`✅ ${label} of ${formatPrice(amount)} recorded successfully!`);
    loadAndRenderCashDrawer();
  });

  // Dynamic Discrepancy UI in Close Drawer Modal (Images 1, 2, 3)
  const updateCloseDrawerDiscrepancyUI = () => {
    const actualInput = document.getElementById('close-drawer-actual-input');
    const discBox = document.getElementById('close-drawer-discrepancy-box');
    const discVal = document.getElementById('close-drawer-discrepancy-val');
    const discSub = document.getElementById('close-drawer-discrepancy-sub');
    const submitBtn = document.getElementById('btn-submit-close-drawer');

    if (!actualInput || !discBox || !discVal || !discSub) return;

    const rawVal = actualInput.value.trim();
    if (rawVal === '') {
      // 1st Image State: Default empty, no discrepancy box, default muted button
      discBox.classList.add('hidden');
      discBox.className = 'discrepancy-box hidden';
      if (submitBtn) submitBtn.style.background = '#8c98a4';
      return;
    }

    const actual = parseFloat(rawVal);
    if (isNaN(actual) || actual < 0) {
      discBox.classList.add('hidden');
      if (submitBtn) submitBtn.style.background = '#8c98a4';
      return;
    }

    const expected = parseFloat(currentActiveDrawerSession?.current_balance || currentActiveDrawerSession?.expected_balance || 0);
    const diff = actual - expected;

    discBox.classList.remove('hidden');
    if (submitBtn) submitBtn.style.background = '#334155';

    if (Math.abs(diff) < 0.005) {
      // 2nd Image State: Match ($0.00, Green, "Perfect match!")
      discBox.className = 'discrepancy-box discrepancy-match';
      discVal.textContent = '$0.00';
      discVal.style.color = '#16a34a';
      discSub.textContent = 'Perfect match!';
    } else if (diff < 0) {
      // 3rd Image State: Cash Short (e.g. $-100.00, Red, "Cash short — less cash than expected")
      discBox.className = 'discrepancy-box discrepancy-short';
      discVal.textContent = `$-${Math.abs(diff).toFixed(2)}`;
      discVal.style.color = '#dc2626';
      discSub.textContent = 'Cash short — less cash than expected';
    } else {
      // Cash Over (+$X.XX, Amber/Green, "Cash over — more cash than expected")
      discBox.className = 'discrepancy-box discrepancy-over';
      discVal.textContent = `+$${diff.toFixed(2)}`;
      discVal.style.color = '#d97706';
      discSub.textContent = 'Cash over — more cash than expected';
    }
  };

  document.getElementById('close-drawer-actual-input')?.addEventListener('input', updateCloseDrawerDiscrepancyUI);
  document.getElementById('close-drawer-actual-input')?.addEventListener('keyup', updateCloseDrawerDiscrepancyUI);
  document.getElementById('close-drawer-actual-input')?.addEventListener('change', updateCloseDrawerDiscrepancyUI);

  // 10.6 Open Close Drawer Modal
  document.getElementById('btn-open-close-drawer')?.addEventListener('click', () => {
    if (enforceReadOnly('Close Drawer')) return;
    const openDisp = document.getElementById('close-modal-disp-opening');
    const expDisp = document.getElementById('close-modal-disp-expected');
    const actualInput = document.getElementById('close-drawer-actual-input');

    const opBal = currentActiveDrawerSession?.opening_balance || 0;
    const currBal = currentActiveDrawerSession?.current_balance || 0;

    if (openDisp) openDisp.textContent = formatPrice(opBal);
    if (expDisp) expDisp.textContent = formatPrice(currBal);
    if (actualInput) actualInput.value = '';

    updateCloseDrawerDiscrepancyUI();

    if (modalCloseCashDrawer) modalCloseCashDrawer.classList.remove('hidden');
    actualInput?.focus();
  });

  document.getElementById('btn-close-close-drawer-modal')?.addEventListener('click', () => modalCloseCashDrawer?.classList.add('hidden'));
  document.getElementById('btn-cancel-close-drawer')?.addEventListener('click', () => modalCloseCashDrawer?.classList.add('hidden'));

  // Submit Close Drawer Form
  document.getElementById('form-close-cash-drawer')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (enforceReadOnly('Close Drawer')) return;

    const actual = parseFloat(document.getElementById('close-drawer-actual-input').value);
    if (isNaN(actual) || actual < 0) {
      showToast('⚠️ Please enter the actual counted cash total.', true);
      return;
    }

    const payload = {
      action: 'close_drawer',
      pharmacy_id: pharmacyId,
      drawer_id: currentActiveDrawerSession?.id || 0,
      actual_closing_balance: actual,
      notes: 'Drawer closed at shift end'
    };

    let closeOk = false;
    let diffAmt = 0;
    for (const url of POS_API_ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success) {
            closeOk = true;
            diffAmt = json.difference || 0;
            localStorage.removeItem(`ezpharma_active_drawer_pharm_${pharmacyId}`);
            document.getElementById('style-drawer-prehide')?.remove();
            break;
          }
        }
      } catch (err) {}
    }

    modalCloseCashDrawer?.classList.add('hidden');
    const diffSign = diffAmt >= 0 ? `+${formatPrice(diffAmt)}` : `-${formatPrice(Math.abs(diffAmt))}`;
    showToast(`🔒 Cash drawer closed! Discrepancy: ${diffSign}. Shift ended.`);
    await loadAndRenderCashDrawer();
    loadAndRenderDrawerHistory();
  });

  // ==============================================
  // 7.4.6. Customer Management Logic (Images 1, 2, 3)
  // ==============================================
  const CUSTOMER_API_ENDPOINTS = [
    'https://api.holidaymartbd.com/ezpharma/customers.php',
    '/api/customers.php'
  ];

  let currentCustomersList = [];
  let customerCurrentPage = 1;
  let customerPerPage = 20;
  let customerSortField = 'created_at';
  let customerSortAsc = false;
  let customerSearchQuery = '';

  const loadAndRenderCustomers = async (page = 1) => {
    customerCurrentPage = page;
    const tbody = document.getElementById('customers-table-tbody');
    if (tbody && currentCustomersList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-5 text-muted">Loading customers...</td></tr>`;
    }

    let customers = [];
    for (const url of CUSTOMER_API_ENDPOINTS) {
      try {
        const queryParams = new URLSearchParams({
          pharmacy_id: pharmacyId,
          search: customerSearchQuery,
          sort: customerSortField,
          order: customerSortAsc ? 'ASC' : 'DESC'
        });

        const res = await fetch(`${url}?${queryParams.toString()}`, { method: 'GET' });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success && Array.isArray(json.customers)) {
            customers = json.customers;
            break;
          }
        }
      } catch (e) {}
    }

    if (customers.length === 0) {
      try {
        const local = localStorage.getItem(`ezpharma_customers_pharm_${pharmacyId}`);
        if (local) {
          customers = JSON.parse(local);
        }
      } catch (e) {}
    } else {
      try {
        localStorage.setItem(`ezpharma_customers_pharm_${pharmacyId}`, JSON.stringify(customers));
      } catch (e) {}
    }

    currentCustomersList = customers;
    renderCustomersTable(customers, page, customerPerPage);
  };

  const renderCustomersTable = (customers, page = 1, perPage = 20) => {
    const tbody = document.getElementById('customers-table-tbody');
    const countLabel = document.getElementById('customers-count-label');
    const pageInfo = document.getElementById('customers-page-info');
    const pageDisplay = document.getElementById('customers-current-page-display');
    const prevBtn = document.getElementById('customers-btn-prev');
    const nextBtn = document.getElementById('customers-btn-next');

    if (!tbody) return;

    if (!customers || customers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-5 text-muted">
            No customers found. Click "+ Add Customer" to register your first customer.
          </td>
        </tr>
      `;
      if (countLabel) countLabel.textContent = 'Showing 0 results';
      if (pageInfo) pageInfo.textContent = 'Showing 0 results';
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      return;
    }

    const totalPages = Math.ceil(customers.length / perPage) || 1;
    if (page > totalPages) page = 1;
    const startIdx = (page - 1) * perPage;
    const pageItems = customers.slice(startIdx, startIdx + perPage);

    if (countLabel) countLabel.textContent = `Showing ${startIdx + 1} to ${Math.min(startIdx + perPage, customers.length)} of ${customers.length} results`;
    if (pageInfo) pageInfo.textContent = `Showing ${startIdx + 1} to ${Math.min(startIdx + perPage, customers.length)} of ${customers.length} results`;
    if (pageDisplay) pageDisplay.textContent = `Page ${page} of ${totalPages}`;
    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextBtn) nextBtn.disabled = page >= totalPages;

    tbody.innerHTML = pageItems.map(c => {
      let formattedDate = '—';
      if (c.created_at) {
        const d = new Date(c.created_at);
        formattedDate = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
      }

      const addressHtml = c.address ? `
        <div class="customer-address-box">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#64748b" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          <span>${escapeHtml(c.address)}</span>
        </div>
      ` : '<span class="text-muted">—</span>';

      const limit = (c.credit_limit !== undefined && c.credit_limit !== null && !isNaN(parseFloat(c.credit_limit))) ? parseFloat(c.credit_limit) : 0;
      const used = parseFloat(c.credit_used || 0);
      let dueColHtml = '';
      if (used > 0) {
        dueColHtml = `
          <div style="display:flex; flex-direction:column; gap:2px;">
            <span style="color:#dc2626; font-weight:700; font-size:0.86rem;">Due: ${formatPrice(used)}</span>
            <span style="color:#64748b; font-size:0.75rem;">Limit: ${formatPrice(limit)}</span>
          </div>
        `;
      } else {
        dueColHtml = `
          <div style="display:flex; flex-direction:column; gap:2px;">
            <span style="color:#16a34a; font-weight:600; font-size:0.82rem;">No Due (${formatPrice(0)})</span>
            <span style="color:#64748b; font-size:0.75rem;">Limit: ${formatPrice(limit)}</span>
          </div>
        `;
      }

      const payDueBtnHtml = (used > 0) ? `
        <button type="button" class="btn-customer-action btn-customer-pay-due" data-id="${c.id}" data-name="${escapeHtml(c.name)}" data-phone="${escapeHtml(c.phone || '')}" data-due="${used}" data-limit="${limit}" title="Pay / Collect Due" style="color: #16a34a; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;">
          💳 Pay Due
        </button>
      ` : '';

      return `
        <tr>
          <td>
            <strong>${escapeHtml(c.name || 'Customer')}</strong>
          </td>
          <td>
            <div class="customer-contact-col">
              <div class="contact-row-item">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                <span>${escapeHtml(c.phone || '—')}</span>
              </div>
              ${c.email ? `
                <div class="contact-row-item">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>
                  <span>${escapeHtml(c.email)}</span>
                </div>
              ` : ''}
            </div>
          </td>
          <td>${dueColHtml}</td>
          <td>${addressHtml}</td>
          <td>${escapeHtml(formattedDate)}</td>
          <td class="text-right">
            <div class="table-actions-cell">
              ${payDueBtnHtml}
              <button type="button" class="btn-customer-action btn-customer-history" data-id="${c.id}" data-name="${escapeHtml(c.name)}" title="View Sales History">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              </button>
              <button type="button" class="btn-customer-action btn-customer-edit" data-id="${c.id}" title="Edit Customer">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button type="button" class="btn-customer-action btn-customer-delete" data-id="${c.id}" data-name="${escapeHtml(c.name)}" title="Delete Customer">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  };

  // Customers Search & Sort Listeners
  let custSearchTimer = null;
  document.getElementById('customers-search-input')?.addEventListener('input', (e) => {
    clearTimeout(custSearchTimer);
    custSearchTimer = setTimeout(() => {
      customerSearchQuery = e.target.value.trim();
      loadAndRenderCustomers(1);
    }, 250);
  });

  document.getElementById('customers-sort-field')?.addEventListener('change', (e) => {
    customerSortField = e.target.value;
    loadAndRenderCustomers(1);
  });

  document.getElementById('customers-btn-sort-order')?.addEventListener('click', () => {
    customerSortAsc = !customerSortAsc;
    const icon = document.getElementById('customers-sort-order-icon');
    if (icon) icon.textContent = customerSortAsc ? '↑' : '↓';
    loadAndRenderCustomers(1);
  });

  document.getElementById('customers-per-page')?.addEventListener('change', (e) => {
    customerPerPage = parseInt(e.target.value, 10) || 20;
    renderCustomersTable(currentCustomersList, 1, customerPerPage);
  });

  document.getElementById('customers-btn-prev')?.addEventListener('click', () => {
    if (customerCurrentPage > 1) {
      loadAndRenderCustomers(customerCurrentPage - 1);
    }
  });

  document.getElementById('customers-btn-next')?.addEventListener('click', () => {
    loadAndRenderCustomers(customerCurrentPage + 1);
  });

  // Top header button to Insights
  document.getElementById('btn-header-customer-insights')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('/dashboard/customers/insights');
  });

  // ==============================================
  // Add / Edit Customer Modal (Image 2)
  // ==============================================
  const modalCustomer = document.getElementById('modal-customer-form');

  const openAddCustomerModal = () => {
    if (enforceReadOnly('Add Customer')) return;
    document.getElementById('modal-customer-title').textContent = 'Add New Customer';
    document.getElementById('cust_form_action').value = 'create';
    document.getElementById('cust_form_id').value = '';
    document.getElementById('cust_input_name').value = '';
    document.getElementById('cust_input_phone').value = '';
    document.getElementById('cust_input_email').value = '';
    document.getElementById('cust_input_credit_limit').value = '0';
    document.getElementById('cust_input_address').value = '';
    document.getElementById('btn-save-customer-text').textContent = 'Add Customer';

    if (modalCustomer) modalCustomer.classList.remove('hidden');
  };

  const openEditCustomerModal = (id) => {
    if (enforceReadOnly('Edit Customer')) return;
    const cust = currentCustomersList.find(c => c.id == id);
    if (!cust) return;

    document.getElementById('modal-customer-title').textContent = 'Edit Customer';
    document.getElementById('cust_form_action').value = 'update';
    document.getElementById('cust_form_id').value = cust.id;
    document.getElementById('cust_input_name').value = cust.name || '';
    document.getElementById('cust_input_phone').value = cust.phone || '';
    document.getElementById('cust_input_email').value = cust.email || '';
    const custLimit = (cust.credit_limit !== undefined && cust.credit_limit !== null && !isNaN(parseFloat(cust.credit_limit))) ? parseFloat(cust.credit_limit) : 0;
    document.getElementById('cust_input_credit_limit').value = custLimit;
    document.getElementById('cust_input_address').value = cust.address || '';
    document.getElementById('btn-save-customer-text').textContent = 'Save Changes';

    if (modalCustomer) modalCustomer.classList.remove('hidden');
  };

  const closeCustomerModal = () => {
    if (modalCustomer) modalCustomer.classList.add('hidden');
  };

  document.getElementById('btn-header-add-customer')?.addEventListener('click', openAddCustomerModal);
  document.getElementById('btn-close-customer-modal')?.addEventListener('click', closeCustomerModal);
  document.getElementById('btn-cancel-customer-modal')?.addEventListener('click', closeCustomerModal);

  // Submit Add / Edit Customer Form
  document.getElementById('form-customer-management')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (enforceReadOnly('Save Customer')) return;

    const action = document.getElementById('cust_form_action').value;
    const id = document.getElementById('cust_form_id').value;
    const name = document.getElementById('cust_input_name').value.trim();
    const phone = document.getElementById('cust_input_phone').value.trim();
    const email = document.getElementById('cust_input_email').value.trim();
    const creditLimitRaw = document.getElementById('cust_input_credit_limit').value.trim();
    const credit_limit = (creditLimitRaw === '' || isNaN(parseFloat(creditLimitRaw))) ? 0 : Math.max(0, parseFloat(creditLimitRaw));
    const address = document.getElementById('cust_input_address').value.trim();

    if (!name) {
      showToast('⚠️ Please enter customer name.', true);
      return;
    }
    if (!phone) {
      showToast('⚠️ Please enter customer phone number.', true);
      return;
    }

    const spinner = document.getElementById('cust-save-spinner');
    const btnText = document.getElementById('btn-save-customer-text');
    if (spinner) spinner.classList.remove('hidden');
    if (btnText) btnText.textContent = action === 'create' ? 'Adding...' : 'Saving...';

    const payload = {
      action: action,
      id: id,
      pharmacy_id: pharmacyId,
      name,
      phone,
      email,
      credit_limit,
      address
    };

    let serverSaved = false;
    for (const url of CUSTOMER_API_ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success) {
            serverSaved = true;
            break;
          }
        }
      } catch (err) {}
    }

    // Local State Fallback Sync
    if (action === 'create') {
      const newCust = {
        id: Date.now(),
        pharmacy_id: pharmacyId,
        name,
        phone,
        email,
        credit_limit,
        credit_used: 0,
        address,
        tier: 'Silver',
        total_spend: 0,
        orders_count: 0,
        created_at: new Date().toISOString()
      };
      currentCustomersList.unshift(newCust);
    } else {
      const idx = currentCustomersList.findIndex(c => c.id == id);
      if (idx !== -1) {
        currentCustomersList[idx].name = name;
        currentCustomersList[idx].phone = phone;
        currentCustomersList[idx].email = email;
        currentCustomersList[idx].credit_limit = credit_limit;
        currentCustomersList[idx].address = address;
      }
    }

    try {
      localStorage.setItem(`ezpharma_customers_pharm_${pharmacyId}`, JSON.stringify(currentCustomersList));
    } catch (e) {}

    if (spinner) spinner.classList.add('hidden');
    if (btnText) btnText.textContent = action === 'create' ? 'Add Customer' : 'Save Changes';

    closeCustomerModal();
    showToast(action === 'create' ? '✅ Customer added successfully!' : '✅ Customer updated successfully!');
    renderCustomersTable(currentCustomersList, 1, customerPerPage);
  });

  // Table Action Buttons Click Delegation
  document.getElementById('customers-table-tbody')?.addEventListener('click', async (e) => {
    const histBtn = e.target.closest('.btn-customer-history');
    if (histBtn) {
      const id = histBtn.getAttribute('data-id');
      const name = histBtn.getAttribute('data-name');
      openCustomerSalesHistoryModal(id, name);
      return;
    }

    const editBtn = e.target.closest('.btn-customer-edit');
    if (editBtn) {
      const id = editBtn.getAttribute('data-id');
      openEditCustomerModal(id);
      return;
    }

    const delBtn = e.target.closest('.btn-customer-delete');
    if (delBtn) {
      if (enforceReadOnly('Delete Customer')) return;
      const id = delBtn.getAttribute('data-id');
      const name = delBtn.getAttribute('data-name') || 'this customer';

      const confirmed = await showConfirmDialog({
        title: 'Delete Customer',
        message: `Are you sure you want to permanently delete customer "${name}"? This action cannot be undone.`,
        confirmText: 'Delete',
        isDanger: true
      });

      if (confirmed) {
        currentCustomersList = currentCustomersList.filter(c => c.id != id);
        renderCustomersTable(currentCustomersList, customerCurrentPage, customerPerPage);
        try {
          localStorage.setItem(`ezpharma_customers_pharm_${pharmacyId}`, JSON.stringify(currentCustomersList));
        } catch (e) {}

        for (const url of CUSTOMER_API_ENDPOINTS) {
          try {
            await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'delete', id: id, pharmacy_id: pharmacyId })
            });
            break;
          } catch (err) {}
        }
        showToast('✅ Customer deleted successfully.');
      }
    }
  });

  // ==============================================
  // Receive Customer Due Payment Modal & Handlers
  // ==============================================
  const modalPayDue = document.getElementById('modal-customer-pay-due');
  let currentDuePayingCustomer = null;

  const openPayDueModal = (cust) => {
    if (enforceReadOnly('Receive Due Payment')) return;
    if (!cust) return;
    currentDuePayingCustomer = cust;

    const dueAmt = parseFloat(cust.credit_used || cust.due || 0);
    const custIdEl = document.getElementById('due-pay-customer-id');
    const custNameEl = document.getElementById('due-pay-modal-cust-name');
    const custPhoneEl = document.getElementById('due-pay-modal-cust-phone');
    const custDueEl = document.getElementById('due-pay-modal-cust-due');
    const amtInput = document.getElementById('due-pay-amount-input');
    const noteInput = document.getElementById('due-pay-note-input');

    if (custIdEl) custIdEl.value = cust.id;
    if (custNameEl) custNameEl.textContent = cust.name || 'Customer';
    if (custPhoneEl) custPhoneEl.textContent = cust.phone ? `Phone: ${cust.phone}` : '—';
    if (custDueEl) custDueEl.textContent = formatPrice(dueAmt);
    
    if (amtInput) {
      amtInput.value = dueAmt.toFixed(2);
      amtInput.max = dueAmt;
    }
    if (noteInput) noteInput.value = '';

    if (modalPayDue) modalPayDue.classList.remove('hidden');
  };

  const closePayDueModal = () => {
    if (modalPayDue) modalPayDue.classList.add('hidden');
    currentDuePayingCustomer = null;
  };

  document.getElementById('btn-close-due-pay-modal')?.addEventListener('click', closePayDueModal);
  document.getElementById('btn-cancel-due-pay')?.addEventListener('click', closePayDueModal);

  // Quick Chips in Due Modal
  document.getElementById('btn-due-chip-full')?.addEventListener('click', () => {
    if (!currentDuePayingCustomer) return;
    const dueAmt = parseFloat(currentDuePayingCustomer.credit_used || currentDuePayingCustomer.due || 0);
    const amtInput = document.getElementById('due-pay-amount-input');
    if (amtInput) amtInput.value = dueAmt.toFixed(2);
  });

  document.getElementById('btn-due-chip-half')?.addEventListener('click', () => {
    if (!currentDuePayingCustomer) return;
    const dueAmt = parseFloat(currentDuePayingCustomer.credit_used || currentDuePayingCustomer.due || 0);
    const amtInput = document.getElementById('due-pay-amount-input');
    if (amtInput) amtInput.value = (dueAmt / 2).toFixed(2);
  });

  document.querySelectorAll('#due-pay-quick-chips .due-quick-val')?.forEach(chip => {
    chip.addEventListener('click', () => {
      const val = parseFloat(chip.getAttribute('data-val')) || 0;
      const amtInput = document.getElementById('due-pay-amount-input');
      if (amtInput) amtInput.value = val.toFixed(2);
    });
  });

  // Global delegation for opening Pay Due modal from Customer List or POS
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-customer-pay-due');
    if (btn) {
      const id = btn.getAttribute('data-id');
      const name = btn.getAttribute('data-name');
      const phone = btn.getAttribute('data-phone');
      const due = parseFloat(btn.getAttribute('data-due') || 0);
      const limit = parseFloat(btn.getAttribute('data-limit') || 1000);
      openPayDueModal({ id, name, phone, credit_used: due, credit_limit: limit });
    }
  });

  // Submit Due Payment Form
  document.getElementById('form-customer-pay-due')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (enforceReadOnly('Receive Due Payment')) return;

    const custId = parseInt(document.getElementById('due-pay-customer-id').value, 10);
    const amt = parseFloat(document.getElementById('due-pay-amount-input').value) || 0;
    const method = document.getElementById('due-pay-method-select').value;
    const note = document.getElementById('due-pay-note-input').value.trim();
    const submitBtn = document.getElementById('btn-submit-due-pay');

    if (!custId || amt <= 0) {
      showToast('⚠️ Please enter a valid payment amount.', true);
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Processing...';
    }

    const payload = {
      action: 'receive_due_payment',
      pharmacy_id: pharmacyId,
      customer_id: custId,
      amount: amt,
      payment_method: method,
      note: note || `Customer due payment (${method})`,
      user_name: (sessionData && sessionData.name) || 'Pharmacy Admin'
    };

    let paymentOk = false;
    let resJson = null;

    for (const url of CUSTOMER_API_ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success) {
            paymentOk = true;
            resJson = json;
            break;
          }
        }
      } catch (err) {}
    }

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirm Payment';
    }

    if (paymentOk) {
      closePayDueModal();
      showToast(`✅ Due payment of ${formatPrice(amt)} received via ${method}!`);
      
      // Update local memory
      const custIdx = currentCustomersList.findIndex(c => c.id == custId);
      if (custIdx !== -1) {
        const prev = parseFloat(currentCustomersList[custIdx].credit_used || 0);
        currentCustomersList[custIdx].credit_used = Math.max(0, prev - amt);
        try {
          localStorage.setItem(`ezpharma_customers_pharm_${pharmacyId}`, JSON.stringify(currentCustomersList));
        } catch (e) {}
      }

      // Reload customers list
      loadAndRenderCustomers(customerCurrentPage);
      // Also reload drawer if open and method was Cash
      loadAndRenderCashDrawer();
    } else {
      showToast(resJson?.error || 'Failed to process due payment. Please try again.', true);
    }
  });

  // ==============================================
  // Customer Sales History Modal (Image 1 Green Icon)
  // ==============================================
  const modalHistory = document.getElementById('modal-customer-sales-history');

  const openCustomerSalesHistoryModal = async (customerId, customerName) => {
    let cust = currentCustomersList.find(c => c.id == customerId) || { name: customerName, phone: '—', tier: 'Silver', total_spend: 0, orders_count: 0 };

    document.getElementById('history-modal-customer-name').textContent = `${cust.name || customerName}'s Sales History`;
    const tierBadge = document.getElementById('history-modal-tier-badge');
    if (tierBadge) {
      const tier = cust.tier || 'Silver';
      tierBadge.textContent = tier;
      tierBadge.className = `tier-badge-pill pill-${tier.toLowerCase()}`;
    }

    document.getElementById('history-summary-phone').textContent = cust.phone || '—';
    document.getElementById('history-summary-total-spend').textContent = formatPrice(cust.total_spend || 0);
    document.getElementById('history-summary-orders-count').textContent = cust.orders_count || 0;
    document.getElementById('history-summary-last-visit').textContent = cust.last_visit ? new Date(cust.last_visit).toLocaleDateString() : '—';
    document.getElementById('quick_sale_customer_id').value = customerId;

    const tbody = document.getElementById('customer-sales-history-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">Loading sales records...</td></tr>`;
    }

    if (modalHistory) modalHistory.classList.remove('hidden');

    let sales = [];
    for (const url of CUSTOMER_API_ENDPOINTS) {
      try {
        const res = await fetch(`${url}?action=sales_history&customer_id=${customerId}&pharmacy_id=${pharmacyId}`);
        if (res.ok) {
          const json = await res.json();
          if (json && json.success && Array.isArray(json.sales)) {
            sales = json.sales;
            break;
          }
        }
      } catch (e) {}
    }

    if (!tbody) return;

    if (sales.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-5 text-muted">
            No past sales or orders recorded for this customer yet.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = sales.map(s => `
      <tr>
        <td><strong>${escapeHtml(s.invoice_number || `INV-${s.id}`)}</strong></td>
        <td>${s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}</td>
        <td>${escapeHtml(s.items_summary || 'Prescription Items')}</td>
        <td><span class="badge-status badge-active">${escapeHtml(s.payment_method || 'Cash')}</span></td>
        <td class="text-right"><strong>${formatPrice(s.total_amount || 0)}</strong></td>
      </tr>
    `).join('');
  };

  const closeCustomerHistoryModal = () => {
    if (modalHistory) modalHistory.classList.add('hidden');
  };

  document.getElementById('btn-close-customer-history-modal')?.addEventListener('click', closeCustomerHistoryModal);
  document.getElementById('btn-close-customer-history-btn')?.addEventListener('click', closeCustomerHistoryModal);

  // Quick Record Sale Form Submission
  document.getElementById('form-quick-record-sale')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (enforceReadOnly('Record Customer Sale')) return;

    const customerId = document.getElementById('quick_sale_customer_id').value;
    const items = document.getElementById('quick_sale_items').value.trim();
    const amount = parseFloat(document.getElementById('quick_sale_amount').value) || 0;
    const payment = document.getElementById('quick_sale_payment_method').value;

    if (!customerId) return;
    if (amount <= 0) {
      showToast('⚠️ Please enter a valid sale amount.', true);
      return;
    }

    const payload = {
      action: 'record_sale',
      pharmacy_id: pharmacyId,
      customer_id: customerId,
      total_amount: amount,
      items_summary: items,
      payment_method: payment
    };

    let updatedTier = 'Silver';
    for (const url of CUSTOMER_API_ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success) {
            updatedTier = json.tier || 'Silver';
            break;
          }
        }
      } catch (err) {}
    }

    // Update local state customer
    const cIdx = currentCustomersList.findIndex(c => c.id == customerId);
    if (cIdx !== -1) {
      currentCustomersList[cIdx].total_spend = (parseFloat(currentCustomersList[cIdx].total_spend) || 0) + amount;
      currentCustomersList[cIdx].orders_count = (parseInt(currentCustomersList[cIdx].orders_count, 10) || 0) + 1;
      currentCustomersList[cIdx].last_visit = new Date().toISOString();

      // Tier Calculation (Silver / Gold / Platinum)
      const spend = currentCustomersList[cIdx].total_spend;
      const orders = currentCustomersList[cIdx].orders_count;
      if (spend >= 4000) currentCustomersList[cIdx].tier = 'Platinum';
      else if (spend >= 1500 || orders >= 3) currentCustomersList[cIdx].tier = 'Gold';
      else currentCustomersList[cIdx].tier = 'Silver';

      updatedTier = currentCustomersList[cIdx].tier;
    }

    try {
      localStorage.setItem(`ezpharma_customers_pharm_${pharmacyId}`, JSON.stringify(currentCustomersList));
    } catch (e) {}

    // Reset inputs
    document.getElementById('quick_sale_items').value = '';
    document.getElementById('quick_sale_amount').value = '';

    showToast(`✅ Sale of Tk ${amount.toLocaleString()} recorded! Tier: ${updatedTier}`);

    // Refresh history modal and customer table
    const cust = currentCustomersList.find(c => c.id == customerId);
    openCustomerSalesHistoryModal(customerId, cust?.name || 'Customer');
    renderCustomersTable(currentCustomersList, customerCurrentPage, customerPerPage);
  });

  // ==============================================
  // Customer Insights Controller (Image 3)
  // ==============================================
  const loadAndRenderCustomerInsights = async () => {
    let insightsData = null;

    for (const url of CUSTOMER_API_ENDPOINTS) {
      try {
        const res = await fetch(`${url}?action=insights&pharmacy_id=${pharmacyId}`);
        if (res.ok) {
          const json = await res.json();
          if (json && json.success) {
            insightsData = json;
            break;
          }
        }
      } catch (e) {}
    }

    let metrics = insightsData?.metrics || null;
    let topCustomers = insightsData?.top_customers || [];

    // Local compute fallback if API returned null or no records
    if (!metrics || topCustomers.length === 0) {
      const customers = currentCustomersList.length > 0 ? currentCustomersList : [];
      let newCount = 0;
      let regCount = 0;
      let vipCount = 0;
      let riskCount = 0;
      let totalSpendSum = 0;
      let totalOrdersSum = 0;
      const now = new Date();

      customers.forEach((c, idx) => {
        const spend = parseFloat(c.total_spend) || 0;
        const orders = parseInt(c.orders_count, 10) || 0;
        totalSpendSum += spend;
        totalOrdersSum += orders;

        if (c.created_at && (now - new Date(c.created_at)) <= 30 * 86400000) newCount++;
        if (orders >= 3) regCount++;
        if (idx === 0 && spend > 0) vipCount++;
        if (orders === 0 || (c.last_visit && (now - new Date(c.last_visit)) >= 60 * 86400000)) riskCount++;
      });

      const totalC = customers.length;
      metrics = {
        total_customers: totalC,
        new_customers: newCount,
        regular_customers: regCount,
        vip_customers: vipCount,
        at_risk_customers: riskCount,
        avg_lifetime_value: totalC > 0 ? (totalSpendSum / totalC) : 0,
        avg_visit_frequency: totalC > 0 ? Math.max(1, (totalOrdersSum / totalC / 3)).toFixed(2) : '1.00',
        avg_basket_size: totalOrdersSum > 0 ? (totalSpendSum / totalOrdersSum) : 0
      };
      topCustomers = customers;
    }

    // 1. Populate Top 4 Metric Cards (Image 3)
    document.getElementById('insight-count-new').textContent = metrics.new_customers || 0;
    document.getElementById('insight-count-regular').textContent = metrics.regular_customers || 0;
    document.getElementById('insight-count-vip').textContent = metrics.vip_customers || 0;
    document.getElementById('insight-count-risk').textContent = metrics.at_risk_customers || 0;

    // 2. Populate 3 Financial Metric Cards (Image 3)
    document.getElementById('insight-avg-ltv').textContent = formatPrice(metrics.avg_lifetime_value || 0);
    document.getElementById('insight-avg-frequency').textContent = `${metrics.avg_visit_frequency || '1.00'} /month`;
    document.getElementById('insight-avg-basket').textContent = formatPrice(metrics.avg_basket_size || 0);

    // 3. Populate Top Customers by Spend Table (Image 3)
    const tbody = document.getElementById('insights-top-customers-tbody');
    if (!tbody) return;

    if (topCustomers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-5 text-muted">
            No customer spend records found yet. Customers will appear here once purchases are recorded.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = topCustomers.map((c, idx) => {
      let formattedLastVisit = '—';
      if (c.last_visit) {
        const d = new Date(c.last_visit);
        formattedLastVisit = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
      } else if (c.created_at) {
        const d = new Date(c.created_at);
        formattedLastVisit = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
      }

      const tier = c.tier || 'Silver';
      const tierClass = `pill-${tier.toLowerCase()}`;

      return `
        <tr>
          <td><strong>${idx + 1}</strong></td>
          <td><strong>${escapeHtml(c.name || 'Customer')}</strong></td>
          <td>${escapeHtml(c.phone || '—')}</td>
          <td><strong style="color: #10b981;">${formatPrice(c.total_spend || 0)}</strong></td>
          <td>${c.orders_count || 0}</td>
          <td>${escapeHtml(formattedLastVisit)}</td>
          <td class="text-right">
            <span class="tier-badge-pill ${tierClass}">${escapeHtml(tier)}</span>
          </td>
        </tr>
      `;
    }).join('');
  };

  // Back button from Insights & Tiers
  document.getElementById('btn-insights-back')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('/dashboard/customers');
  });

  document.getElementById('btn-tiers-back')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('/dashboard/customers');
  });

  // ==============================================
  // 7.5. Pharmacy User Management Logic (Images 1, 2, 3, 4, 5)
  // ==============================================
  const USER_API_ENDPOINTS = [
    'https://api.holidaymartbd.com/ezpharma/pharmacy_users.php',
    '/api/pharmacy_users.php'
  ];

  const DEFAULT_STAFF_PERMS = ['pos_sales', 'pos_returns', 'pos_drawer', 'cust_add_edit', 'proc_receive', 'fin_export'];
  const CASHIER_ONLY_PERMS = ['pos_sales', 'pos_returns', 'pos_drawer', 'cust_add_edit'];
  const ALL_PERMS = [
    'pos_sales', 'pos_returns', 'pos_delete', 'pos_drawer', 'pos_adjust',
    'cust_add_edit', 'cust_delete',
    'inv_add_edit', 'inv_delete', 'inv_adjust',
    'proc_suppliers', 'proc_create_po', 'proc_receive', 'proc_cancel',
    'fin_expenses', 'fin_export',
    'admin_users', 'admin_settings', 'admin_ai', 'admin_billing'
  ];

  let currentPharmacyUsers = [];

  const updatePermCounter = () => {
    const checked = document.querySelectorAll('#permissions-container-box .perm-chk:checked');
    const counterEl = document.getElementById('perm-selected-count');
    if (counterEl) counterEl.textContent = checked.length;
  };

  const applyPreset = (presetName) => {
    const allChk = document.querySelectorAll('#permissions-container-box .perm-chk');
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));

    const activeBtn = document.querySelector(`.preset-btn[data-preset="${presetName}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    let targetSet = [];
    if (presetName === 'default_staff') targetSet = DEFAULT_STAFF_PERMS;
    else if (presetName === 'cashier_only') targetSet = CASHIER_ONLY_PERMS;
    else if (presetName === 'all') targetSet = ALL_PERMS;
    else if (presetName === 'none') targetSet = [];

    allChk.forEach(chk => {
      chk.checked = targetSet.includes(chk.value);
    });

    updatePermCounter();
  };

  const selectUserModalRole = (role) => {
    const cardAdmin = document.getElementById('role-card-admin');
    const cardStaff = document.getElementById('role-card-staff');
    const noticeBox = document.getElementById('admin-role-notice-box');
    const permsBox = document.getElementById('permissions-container-box');

    if (role === 'pharmacy_admin' || role === 'admin') {
      if (cardAdmin) cardAdmin.classList.add('active');
      if (cardStaff) cardStaff.classList.remove('active');
      if (noticeBox) noticeBox.classList.remove('hidden');
      if (permsBox) permsBox.classList.add('hidden');
    } else {
      if (cardStaff) cardStaff.classList.add('active');
      if (cardAdmin) cardAdmin.classList.remove('active');
      if (noticeBox) noticeBox.classList.add('hidden');
      if (permsBox) permsBox.classList.remove('hidden');
    }
  };

  const renderUsersTable = (usersList) => {
    const tbody = document.getElementById('users-table-tbody');
    if (!tbody) return;

    if (!usersList || usersList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">No users found for this pharmacy</td></tr>`;
      return;
    }

    tbody.innerHTML = usersList.map(u => {
      const isAdmin = u.role === 'pharmacy_admin' || u.role === 'super_admin' || u.role === 'admin';
      let perms = [];
      try {
        if (typeof u.permissions === 'string') perms = JSON.parse(u.permissions || '[]');
        else if (Array.isArray(u.permissions)) perms = u.permissions;
      } catch (e) {
        perms = [];
      }

      const permCount = perms.length || (isAdmin ? 20 : 6);
      const cDate = new Date(u.created_at || Date.now());
      const dateFormatted = `${String(cDate.getDate()).padStart(2, '0')}/${String(cDate.getMonth() + 1).padStart(2, '0')}/${cDate.getFullYear()}`;

      let roleBadgeHtml = '';
      if (isAdmin) {
        roleBadgeHtml = `<div class="role-badge-cell"><span class="role-pill-admin"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg> Admin</span></div>`;
      } else {
        roleBadgeHtml = `
          <div class="role-badge-cell">
            <span class="role-pill-staff"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> Staff</span>
            <span class="custom-perm-pill">Custom - ${permCount}/20</span>
          </div>
        `;
      }

      const deleteBtnHtml = !isAdmin ? `
        <button type="button" class="btn-user-action btn-user-delete" data-id="${u.id}" data-name="${escapeHtml(u.full_name || u.name)}" title="Delete User">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      ` : '';

      return `
        <tr>
          <td><strong>${escapeHtml(u.full_name || u.name || 'User')}</strong></td>
          <td>${escapeHtml(u.email)}</td>
          <td>${roleBadgeHtml}</td>
          <td>${dateFormatted}</td>
          <td class="text-right">
            <div class="user-action-btns">
              <button type="button" class="btn-user-action btn-user-edit" data-id="${u.id}" title="Edit User">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              ${deleteBtnHtml}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  };

  const loadPharmacyUsersList = async () => {
    // 1. Initial Local Fallback
    try {
      const stored = localStorage.getItem(`ezpharma_users_pharm_${pharmacyId}`);
      if (stored) {
        currentPharmacyUsers = JSON.parse(stored);
        renderUsersTable(currentPharmacyUsers);
      }
    } catch (e) {}

    // 2. Fetch from MySQL Database API
    for (const url of USER_API_ENDPOINTS) {
      try {
        const res = await fetch(`${url}?pharmacy_id=${pharmacyId}`, { method: 'GET' });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success && Array.isArray(json.users)) {
            currentPharmacyUsers = json.users;
            renderUsersTable(currentPharmacyUsers);
            localStorage.setItem(`ezpharma_users_pharm_${pharmacyId}`, JSON.stringify(currentPharmacyUsers));
            break;
          }
        }
      } catch (err) {}
    }

    if (currentPharmacyUsers.length === 0) {
      currentPharmacyUsers = [
        {
          id: 1,
          pharmacy_id: pharmacyId,
          full_name: 'Pharmacy Admin',
          email: sessionData.email || 'admin@pharmacy.com',
          role: 'pharmacy_admin',
          permissions: '[]',
          created_at: '2026-05-11 10:00:00'
        },
        {
          id: 2,
          pharmacy_id: pharmacyId,
          full_name: 'New staff',
          email: 'staff@pharmacy.com',
          role: 'staff',
          permissions: JSON.stringify(CASHIER_ONLY_PERMS),
          created_at: '2026-05-12 11:30:00'
        }
      ];
      renderUsersTable(currentPharmacyUsers);
    }
  };

  // Search input filter
  const usersSearchInput = document.getElementById('users-search-input');
  if (usersSearchInput) {
    usersSearchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        renderUsersTable(currentPharmacyUsers);
        return;
      }
      const filtered = currentPharmacyUsers.filter(u => 
        (u.full_name && u.full_name.toLowerCase().includes(q)) || 
        (u.name && u.name.toLowerCase().includes(q)) || 
        (u.email && u.email.toLowerCase().includes(q))
      );
      renderUsersTable(filtered);
    });
  }

  // Modal open/close controls
  const modalUser = document.getElementById('modal-user-form');
  const btnOpenAddUser = document.getElementById('btn-open-add-user');
  const btnCloseUserModal = document.getElementById('btn-close-user-modal');
  const btnCancelUserModal = document.getElementById('btn-cancel-user-modal');

  const openAddUserModal = () => {
    if (enforceReadOnly('Add User')) return;
    document.getElementById('modal-user-title').textContent = 'Add user';
    document.getElementById('user_form_action').value = 'create';
    document.getElementById('user_form_id').value = '';
    document.getElementById('user_input_name').value = '';
    document.getElementById('user_input_email').value = '';
    document.getElementById('user_input_password').value = '';
    document.getElementById('user_input_password').required = true;
    document.getElementById('user_password_hint').classList.add('hidden');
    document.getElementById('btn-save-user-text').textContent = 'Create user';

    // Default to Staff role with Default staff preset (6 of 20 checked)
    selectUserModalRole('staff');
    applyPreset('default_staff');

    if (modalUser) modalUser.classList.remove('hidden');
  };

  const openEditUserModal = (userId) => {
    if (enforceReadOnly('Edit User')) return;
    const user = currentPharmacyUsers.find(u => u.id == userId);
    if (!user) return;

    document.getElementById('modal-user-title').textContent = 'Edit user';
    document.getElementById('user_form_action').value = 'update';
    document.getElementById('user_form_id').value = user.id;
    document.getElementById('user_input_name').value = user.full_name || user.name || '';
    document.getElementById('user_input_email').value = user.email || '';
    document.getElementById('user_input_password').value = '';
    document.getElementById('user_input_password').required = false;
    document.getElementById('user_password_hint').classList.remove('hidden');
    document.getElementById('btn-save-user-text').textContent = 'Save changes';

    const isAdmin = user.role === 'pharmacy_admin' || user.role === 'super_admin' || user.role === 'admin';
    selectUserModalRole(isAdmin ? 'pharmacy_admin' : 'staff');

    let perms = [];
    try {
      if (typeof user.permissions === 'string') perms = JSON.parse(user.permissions || '[]');
      else if (Array.isArray(user.permissions)) perms = user.permissions;
    } catch (e) {}

    const allChk = document.querySelectorAll('#permissions-container-box .perm-chk');
    allChk.forEach(chk => {
      chk.checked = perms.includes(chk.value);
    });
    updatePermCounter();

    if (modalUser) modalUser.classList.remove('hidden');
  };

  const closeUserModal = () => {
    if (modalUser) modalUser.classList.add('hidden');
  };

  if (btnOpenAddUser) btnOpenAddUser.addEventListener('click', openAddUserModal);
  if (btnCloseUserModal) btnCloseUserModal.addEventListener('click', closeUserModal);
  if (btnCancelUserModal) btnCancelUserModal.addEventListener('click', closeUserModal);

  // Role card click switches
  document.getElementById('role-card-admin')?.addEventListener('click', () => selectUserModalRole('pharmacy_admin'));
  document.getElementById('role-card-staff')?.addEventListener('click', () => selectUserModalRole('staff'));

  // Preset button clicks
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-preset');
      applyPreset(preset);
    });
  });

  // Individual checkbox listeners
  document.querySelectorAll('#permissions-container-box .perm-chk').forEach(chk => {
    chk.addEventListener('change', () => {
      updatePermCounter();
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    });
  });

  // Action clicks (Edit & Delete delegation)
  document.getElementById('users-table-tbody')?.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.btn-user-edit');
    if (editBtn) {
      const uid = editBtn.getAttribute('data-id');
      openEditUserModal(uid);
      return;
    }

    const delBtn = e.target.closest('.btn-user-delete');
    if (delBtn) {
      if (enforceReadOnly('Delete User')) return;
      const uid = delBtn.getAttribute('data-id');
      const uname = delBtn.getAttribute('data-name') || 'this user';
      const ok = confirm(`Are you sure you want to permanently delete user "${uname}"?`);
      if (ok) {
        currentPharmacyUsers = currentPharmacyUsers.filter(u => u.id != uid);
        renderUsersTable(currentPharmacyUsers);
        localStorage.setItem(`ezpharma_users_pharm_${pharmacyId}`, JSON.stringify(currentPharmacyUsers));

        for (const url of USER_API_ENDPOINTS) {
          try {
            await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'delete', id: uid, pharmacy_id: pharmacyId })
            });
            break;
          } catch (err) {}
        }
        showToast(`✅ User deleted successfully!`);
      }
    }
  });

  // Form submit handler
  const formUserManagement = document.getElementById('form-user-management');
  if (formUserManagement) {
    formUserManagement.addEventListener('submit', async (e) => {
      e.preventDefault();
      const action = document.getElementById('user_form_action').value;
      const userId = document.getElementById('user_form_id').value;
      const name = document.getElementById('user_input_name').value.trim();
      const email = document.getElementById('user_input_email').value.trim();
      const password = document.getElementById('user_input_password').value.trim();

      if (!name || !email) {
        showToast('⚠️ Please fill in Name and Email.', true);
        return;
      }
      if (action === 'create' && (!password || password.length < 6)) {
        showToast('⚠️ Password must be at least 6 characters.', true);
        return;
      }

      const isStaff = document.getElementById('role-card-staff')?.classList.contains('active');
      const role = isStaff ? 'staff' : 'pharmacy_admin';

      let permissions = [];
      if (isStaff) {
        document.querySelectorAll('#permissions-container-box .perm-chk:checked').forEach(chk => {
          permissions.push(chk.value);
        });
      } else {
        permissions = ALL_PERMS;
      }

      const btnSave = document.getElementById('btn-save-user-submit');
      const btnText = document.getElementById('btn-save-user-text');
      const spinner = document.getElementById('user-save-spinner');

      if (btnSave) btnSave.disabled = true;
      if (spinner) spinner.classList.remove('hidden');
      if (btnText) btnText.textContent = 'Saving...';

      const payload = {
        action,
        id: userId,
        pharmacy_id: pharmacyId,
        full_name: name,
        email,
        password,
        role,
        permissions
      };

      for (const url of USER_API_ENDPOINTS) {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (res.ok) {
            const json = await res.json();
            if (json && !json.success && json.message) {
              showToast(`⚠️ ${json.message}`, true);
              if (btnSave) btnSave.disabled = false;
              if (spinner) spinner.classList.add('hidden');
              if (btnText) btnText.textContent = action === 'create' ? 'Create user' : 'Save changes';
              return;
            }
          }
          break;
        } catch (err) {}
      }

      if (action === 'create') {
        currentPharmacyUsers.push({
          id: Date.now(),
          pharmacy_id: pharmacyId,
          full_name: name,
          email,
          role,
          permissions,
          created_at: new Date().toISOString()
        });
      } else {
        const uIdx = currentPharmacyUsers.findIndex(u => u.id == userId);
        if (uIdx !== -1) {
          currentPharmacyUsers[uIdx].full_name = name;
          currentPharmacyUsers[uIdx].email = email;
          currentPharmacyUsers[uIdx].role = role;
          currentPharmacyUsers[uIdx].permissions = permissions;
        }
      }

      localStorage.setItem(`ezpharma_users_pharm_${pharmacyId}`, JSON.stringify(currentPharmacyUsers));
      renderUsersTable(currentPharmacyUsers);

      if (btnSave) btnSave.disabled = false;
      if (spinner) spinner.classList.add('hidden');
      if (btnText) btnText.textContent = action === 'create' ? 'Create user' : 'Save changes';

      closeUserModal();
      showToast(action === 'create' ? '✅ User created successfully!' : '✅ User updated successfully!');
    });
  }

  // ==============================================
  // 8. Dynamic Billing Page Logic (Image 1) - MySQL Database Connected
  // ==============================================
  const BILLING_API_ENDPOINTS = [
    'https://api.holidaymartbd.com/ezpharma/billing.php',
    '/api/billing.php'
  ];

  const renderBillingTable = (paymentsList) => {
    const historyTbody = document.getElementById('billing-history-tbody');
    if (!historyTbody) return;

    if (!paymentsList || paymentsList.length === 0) {
      historyTbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">No payment records found</td></tr>`;
      return;
    }

    historyTbody.innerHTML = paymentsList.map(p => {
      const pDate = new Date(p.created_at || p.starts_at || Date.now());
      const whenStr = pDate.toLocaleString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      const method = ucfirst(p.method || p.payment_provider || 'Cash');
      const status = ucfirst(p.status || p.payment_status || 'Succeeded');
      const amountNum = parseFloat(p.amount) || 400.00;
      const formattedAmount = `BDT ${amountNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      return `
        <tr>
          <td>${whenStr}</td>
          <td>${method}</td>
          <td><span class="status-active-badge">${status}</span></td>
          <td><strong>${formattedAmount}</strong></td>
        </tr>
      `;
    }).join('');
  };

  const renderBillingTableFromLocal = () => {
    let recorded = [];
    try {
      const raw = localStorage.getItem('ezpharma_recorded_payments');
      if (raw) recorded = JSON.parse(raw);
    } catch (e) {}

    let pharmPayments = recorded.filter(r => r.pharmacy_id == pharmacyId || r.pharmacy_name === pharmName);
    const isYearly = (currentPharm && currentPharm.plan === 'yearly') || (sessionData.plan === 'yearly');
    const startStr = (currentPharm && currentPharm.created_at) || sessionData.created_at || '2026-08-19';

    if (pharmPayments.length === 0) {
      const initialDate = new Date(startStr);
      pharmPayments.push({
        id: `init_${pharmacyId}`,
        created_at: initialDate.toISOString(),
        method: ucfirst(currentPharm?.payment_provider || 'Cash'),
        status: (currentPharm && currentPharm.status === 'pending_payment') ? 'Pending' : 'Succeeded',
        amount: isYearly ? 4500.00 : 400.00
      });
    }

    pharmPayments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    renderBillingTable(pharmPayments);
  };

  const renderPharmacyBillingPage = async () => {
    // 1. Determine pharmacy's current plan & renewal
    const isYearly = (currentPharm && currentPharm.plan === 'yearly') || (sessionData.plan === 'yearly');
    const planTitleEl = document.getElementById('bill-current-plan-title');
    const renewDateEl = document.getElementById('bill-renew-date');

    if (planTitleEl) {
      planTitleEl.textContent = isYearly ? 'Yearly plan' : 'Monthly plan';
    }

    // Dynamic renew date calculation fallback
    const startStr = (currentPharm && currentPharm.created_at) || sessionData.created_at || '2026-08-19';
    const startDate = new Date(startStr);
    const renewDate = new Date(startDate);
    if (isYearly) {
      renewDate.setFullYear(renewDate.getFullYear() + 1);
    } else {
      renewDate.setMonth(renewDate.getMonth() + 1);
    }
    const renewFormatted = renewDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
    if (renewDateEl) renewDateEl.textContent = renewFormatted;

    // Render local data immediately for smooth instant display
    renderBillingTableFromLocal();

    // 2. Fetch live data from MySQL database
    for (const url of BILLING_API_ENDPOINTS) {
      try {
        const res = await fetch(`${url}?pharmacy_id=${pharmacyId}`, { method: 'GET' });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success) {
            if (json.pharmacy) {
              const pPlan = json.pharmacy.plan === 'yearly';
              if (planTitleEl) planTitleEl.textContent = pPlan ? 'Yearly plan' : 'Monthly plan';
              if (json.pharmacy.renew_date && renewDateEl) {
                const rDate = new Date(json.pharmacy.renew_date);
                renewDateEl.textContent = rDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
              }
            }
            if (json.payments && Array.isArray(json.payments)) {
              renderBillingTable(json.payments);
              break;
            }
          }
        }
      } catch (err) {}
    }
  };

  // Pay monthly / Pay yearly button triggers
  const btnPayMonthly = document.getElementById('btn-pay-monthly');
  const btnPayYearly = document.getElementById('btn-pay-yearly');

  const handlePayPlan = async (planName, amount) => {
    if (enforceReadOnly(`Pay ${planName}`)) return;
    const confirmPay = confirm(`Confirm payment of BDT ${amount.toLocaleString()} for ${planName} plan?`);
    if (confirmPay) {
      const isYearly = planName.toLowerCase().includes('year');
      const payload = {
        pharmacy_id: pharmacyId,
        plan: isYearly ? 'yearly' : 'monthly',
        amount: amount,
        payment_method: 'Online Gateway',
        notes: `Subscription payment for ${planName} plan`
      };

      let recorded = [];
      try {
        const raw = localStorage.getItem('ezpharma_recorded_payments');
        if (raw) recorded = JSON.parse(raw);
      } catch (e) {}

      recorded.unshift({
        id: `rec_${Date.now()}`,
        pharmacy_id: pharmacyId,
        pharmacy_name: pharmName,
        created_at: new Date().toISOString(),
        interval: isYearly ? 'Yearly' : 'Monthly',
        method: 'Online Gateway',
        status: 'Succeeded',
        amount: amount,
        currency: 'BDT'
      });
      localStorage.setItem('ezpharma_recorded_payments', JSON.stringify(recorded));

      // Update current pharmacy plan
      if (currentPharm) {
        currentPharm.plan = isYearly ? 'yearly' : 'monthly';
        currentPharm.status = 'active';
        localStorage.setItem('ezpharma_current_pharmacy', JSON.stringify(currentPharm));
      }

      // POST to MySQL Database API
      for (const url of BILLING_API_ENDPOINTS) {
        try {
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          break;
        } catch (err) {}
      }

      showToast(`✅ Payment of BDT ${amount.toLocaleString()} processed successfully!`);
      renderPharmacyBillingPage();
    }
  };

  if (btnPayMonthly) btnPayMonthly.addEventListener('click', () => handlePayPlan('Monthly', 400));
  if (btnPayYearly) btnPayYearly.addEventListener('click', () => handlePayPlan('Yearly', 4500));

  // 9. Settings Tabs Controller (Business, Localization, Invoice, Tax)
  const settingsTabBtns = document.querySelectorAll('.settings-tab-btn');
  const settingsTabPanes = document.querySelectorAll('.settings-tab-pane');

  settingsTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      settingsTabBtns.forEach(b => b.classList.remove('active'));
      settingsTabPanes.forEach(p => p.classList.add('hidden'));
      btn.classList.add('active');
      const targetPane = document.getElementById(`tab-pane-${targetTab}`);
      if (targetPane) targetPane.classList.remove('hidden');
    });
  });

  // 10. Per-Pharmacy Settings Sync & Persistence
  const SETTINGS_API_ENDPOINTS = [
    'https://api.holidaymartbd.com/ezpharma/pharmacy_settings.php',
    '/api/pharmacy_settings.php'
  ];

  const getStoredPharmacySettings = () => {
    try {
      const raw = localStorage.getItem(`ezpharma_settings_pharm_${pharmacyId}`);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  };

  const saveStoredPharmacySettings = (settings) => {
    try {
      localStorage.setItem(`ezpharma_settings_pharm_${pharmacyId}`, JSON.stringify(settings));
    } catch (e) {}
  };

  const populateSettingsFields = (s) => {
    if (!s) return;
    // 1. Business
    const bName = document.getElementById('set_business_name');
    const bEmail = document.getElementById('set_business_email');
    const bAddr = document.getElementById('set_business_address');
    const bPhone = document.getElementById('set_business_phone');
    const bReg = document.getElementById('set_business_reg_no');
    const bTax = document.getElementById('set_business_tax_id');

    if (bName) bName.value = s.business_name || pharmName;
    if (bEmail) bEmail.value = s.email || sessionData.email || 'admin@pharmacy.com';
    if (bAddr) bAddr.value = s.address || (currentPharm ? currentPharm.address : '') || '';
    if (bPhone) bPhone.value = s.phone || (currentPharm ? currentPharm.phone : '') || '';
    if (bReg) bReg.value = s.registration_number || '';
    if (bTax) bTax.value = s.tax_id || '';

    // 2. Localization
    const locCurr = document.getElementById('set_loc_currency');
    const locDate = document.getElementById('set_loc_date_format');
    const locTz = document.getElementById('set_loc_timezone');

    if (locCurr && s.currency) locCurr.value = s.currency;
    if (locDate && s.date_format) locDate.value = s.date_format;
    if (locTz && s.timezone) locTz.value = s.timezone;

    // 3. Invoice
    const invPref = document.getElementById('set_inv_prefix');
    const invFoot = document.getElementById('set_inv_footer');
    const invTerms = document.getElementById('set_inv_payment_terms');

    if (invPref) invPref.value = s.invoice_prefix || 'INV';
    if (invFoot) invFoot.value = s.invoice_footer || 'Thank you for your business!';
    if (invTerms) invTerms.value = s.payment_terms || 'Payment is due within 30 days';

    // 4. Tax
    const taxEn = document.getElementById('set_tax_enabled');
    const taxLbl = document.getElementById('set_tax_label');
    const taxRt = document.getElementById('set_tax_rate');

    if (taxEn) taxEn.checked = s.tax_enabled == 1 || s.tax_enabled === true || s.tax_enabled === undefined;
    if (taxLbl) taxLbl.value = s.tax_label || 'VAT';
    if (taxRt) taxRt.value = s.tax_rate !== undefined ? s.tax_rate : 16;
  };

  const loadPharmacySettings = async () => {
    const local = getStoredPharmacySettings();
    if (local) {
      populateSettingsFields(local);
    } else {
      // Default prepopulation
      populateSettingsFields({
        business_name: pharmName,
        email: sessionData.email || 'admin@pharmacy.com',
        address: currentPharm ? currentPharm.address : '',
        phone: currentPharm ? currentPharm.phone : '',
        currency: 'US Dollar ($)',
        date_format: 'DD/MM/YYYY',
        timezone: 'UTC',
        invoice_prefix: 'INV',
        invoice_footer: 'Thank you for your business!',
        payment_terms: 'Payment is due within 30 days',
        tax_enabled: 1,
        tax_label: 'VAT',
        tax_rate: 16
      });
    }

    for (const url of SETTINGS_API_ENDPOINTS) {
      try {
        const res = await fetch(`${url}?pharmacy_id=${pharmacyId}`, { method: 'GET' });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success && json.data) {
            populateSettingsFields(json.data);
            saveStoredPharmacySettings(json.data);
            if (json.data.business_name) {
              updatePharmacyBrandName(json.data.business_name);
            }
            updateAllCurrencyDisplays();
            break;
          }
        }
      } catch (err) {}
    }
    updateAllCurrencyDisplays();
  };

  const collectCurrentSettingsPayload = () => {
    return {
      pharmacy_id: pharmacyId,
      business_name: document.getElementById('set_business_name')?.value.trim() || pharmName,
      email: document.getElementById('set_business_email')?.value.trim() || sessionData.email || '',
      address: document.getElementById('set_business_address')?.value.trim() || '',
      phone: document.getElementById('set_business_phone')?.value.trim() || '',
      registration_number: document.getElementById('set_business_reg_no')?.value.trim() || '',
      tax_id: document.getElementById('set_business_tax_id')?.value.trim() || '',
      currency: document.getElementById('set_loc_currency')?.value || 'US Dollar ($)',
      date_format: document.getElementById('set_loc_date_format')?.value || 'DD/MM/YYYY',
      timezone: document.getElementById('set_loc_timezone')?.value || 'UTC',
      invoice_prefix: document.getElementById('set_inv_prefix')?.value.trim() || 'INV',
      invoice_footer: document.getElementById('set_inv_footer')?.value.trim() || 'Thank you for your business!',
      payment_terms: document.getElementById('set_inv_payment_terms')?.value.trim() || 'Payment is due within 30 days',
      tax_enabled: document.getElementById('set_tax_enabled')?.checked ? 1 : 0,
      tax_label: document.getElementById('set_tax_label')?.value.trim() || 'VAT',
      tax_rate: parseFloat(document.getElementById('set_tax_rate')?.value) || 16
    };
  };

  const handleSettingsFormSubmit = async (e, tabName) => {
    e.preventDefault();
    if (enforceReadOnly(`Save ${tabName} Settings`)) return;

    const form = e.target;
    const btn = form.querySelector('.btn-save-settings');
    const btnText = form.querySelector('.btn-save-text');
    const spinner = form.querySelector('.spinner');

    if (btn) btn.disabled = true;
    if (spinner) spinner.classList.remove('hidden');
    if (btnText) btnText.textContent = 'Saving...';

    const payload = collectCurrentSettingsPayload();
    saveStoredPharmacySettings(payload);
    updateAllCurrencyDisplays();

    // Update active pharmacy name across session if business name changed
    if (payload.business_name) {
      updatePharmacyBrandName(payload.business_name);
    }

    for (const url of SETTINGS_API_ENDPOINTS) {
      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        break;
      } catch (err) {}
    }

    if (btn) btn.disabled = false;
    if (spinner) spinner.classList.add('hidden');
    if (btnText) btnText.textContent = '💾 Save Changes';

    showToast(`✅ ${tabName.charAt(0).toUpperCase() + tabName.slice(1)} settings saved successfully!`);
  };

  // Wire Forms
  const formBusiness = document.getElementById('form-settings-business');
  const formLoc = document.getElementById('form-settings-localization');
  const formInv = document.getElementById('form-settings-invoice');
  const formTax = document.getElementById('form-settings-tax');

  if (formBusiness) formBusiness.addEventListener('submit', (e) => handleSettingsFormSubmit(e, 'business'));
  if (formLoc) formLoc.addEventListener('submit', (e) => handleSettingsFormSubmit(e, 'localization'));
  if (formInv) formInv.addEventListener('submit', (e) => handleSettingsFormSubmit(e, 'invoice'));
  if (formTax) formTax.addEventListener('submit', (e) => handleSettingsFormSubmit(e, 'tax'));

  // Reset to Default Buttons
  document.querySelectorAll('.btn-reset-settings').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (tab === 'business') {
        document.getElementById('set_business_name').value = pharmName;
        document.getElementById('set_business_email').value = sessionData.email || 'admin@pharmacy.com';
        document.getElementById('set_business_address').value = '—';
        document.getElementById('set_business_phone').value = '—';
        document.getElementById('set_business_reg_no').value = '';
        document.getElementById('set_business_tax_id').value = '';
      } else if (tab === 'localization') {
        document.getElementById('set_loc_currency').value = 'US Dollar ($)';
        document.getElementById('set_loc_date_format').value = 'DD/MM/YYYY';
        document.getElementById('set_loc_timezone').value = 'UTC';
      } else if (tab === 'invoice') {
        document.getElementById('set_inv_prefix').value = 'INV';
        document.getElementById('set_inv_footer').value = 'Thank you for your business!';
        document.getElementById('set_inv_payment_terms').value = 'Payment is due within 30 days';
      } else if (tab === 'tax') {
        document.getElementById('set_tax_enabled').checked = true;
        document.getElementById('set_tax_label').value = 'VAT';
        document.getElementById('set_tax_rate').value = '16';
      }
      showToast(`Defaults restored for ${tab} tab.`);
    });
  });

  // ==============================================
  // 10.5. Main Dashboard Overview Dynamic Analytics
  // ==============================================
  const DASHBOARD_STATS_API_ENDPOINTS = [
    'https://api.holidaymartbd.com/ezpharma/dashboard_stats.php',
    '/api/dashboard_stats.php'
  ];

  const loadAndRenderDashboardOverview = async () => {
    let stats = null;

    // 1. Fetch live Stock Alerts counts directly from Stock Module API
    let stockAlertsCounts = null;
    for (const sUrl of STOCK_API_ENDPOINTS) {
      try {
        const sRes = await fetch(`${sUrl}?pharmacy_id=${pharmacyId}&sort=created_at&order=DESC`);
        if (sRes.ok) {
          const sJson = await sRes.json();
          if (sJson && sJson.success && sJson.counts) {
            stockAlertsCounts = sJson.counts;
            stockSummaryCounts = sJson.counts;
            break;
          }
        }
      } catch (e) {}
    }

    // 2. Fetch Dashboard Stats
    for (const url of DASHBOARD_STATS_API_ENDPOINTS) {
      try {
        const res = await fetch(`${url}?pharmacy_id=${pharmacyId}`);
        if (res.ok) {
          const json = await res.json();
          if (json && json.success && json.metrics) {
            stats = json;
            break;
          }
        }
      } catch (e) {}
    }

    if (stats && stats.metrics) {
      if (stockAlertsCounts) {
        stats.metrics.low_stock_count = stockAlertsCounts.low_stock !== undefined ? stockAlertsCounts.low_stock : stats.metrics.low_stock_count;
        stats.metrics.expiring_count = stockAlertsCounts.expiring_soon !== undefined ? stockAlertsCounts.expiring_soon : stats.metrics.expiring_count;
        stats.metrics.expired_count = stockAlertsCounts.expired !== undefined ? stockAlertsCounts.expired : stats.metrics.expired_count;
      }

      // Check if expenses need fallback fetch
      if (!stats.metrics.month_expenses) {
        for (const ep of EXPENSES_API_ENDPOINTS) {
          try {
            const expRes = await fetch(`${ep}?action=list&pharmacy_id=${pharmacyId}`);
            if (expRes.ok) {
              const expJson = await expRes.json();
              if (expJson && expJson.summary && expJson.summary.month_amount !== undefined) {
                stats.metrics.month_expenses = parseFloat(expJson.summary.month_amount) || 0;
                stats.metrics.month_est_net = (parseFloat(stats.metrics.month_sales) || 0) - stats.metrics.month_expenses;
                break;
              }
            }
          } catch (e) {}
        }
      }

      renderDashboardMetrics(stats.metrics);
      if (stats.charts) {
        renderDashboardCharts(stats.charts, stats.metrics);
      }
      return;
    }

    // Fallback: compute from local state
    computeAndRenderLocalDashboardMetrics();
  };

  const renderDashboardMetrics = (m) => {
    // 1. Top Banner Pills
    const todaySalesEl = document.getElementById('dash-today-sales');
    const todaySalesSub = document.getElementById('dash-today-sales-sub');
    const todayTransEl = document.getElementById('dash-today-trans');
    const todayTransSub = document.getElementById('dash-today-trans-sub');
    const todayProfitEl = document.getElementById('dash-today-profit');
    const todayProfitSub = document.getElementById('dash-today-profit-sub');
    const todayAvgEl = document.getElementById('dash-today-avg-basket');
    const todayAvgSub = document.getElementById('dash-today-avg-basket-sub');

    if (todaySalesEl) todaySalesEl.textContent = formatPrice(m.today_sales || 0);
    if (todaySalesSub) {
      const pct = m.vs_yesterday_pct || 0;
      todaySalesSub.textContent = `${pct >= 0 ? '+' : ''}${pct}% vs yesterday`;
    }
    if (todayTransEl) todayTransEl.textContent = m.today_transactions || 0;
    if (todayTransSub) todayTransSub.textContent = `${m.today_units || 0} units`;
    if (todayProfitEl) todayProfitEl.textContent = formatPrice(m.today_gross_profit || 0);
    if (todayProfitSub) todayProfitSub.textContent = `${(m.today_margin_pct || 0).toFixed(1)}% margin`;
    if (todayAvgEl) todayAvgEl.textContent = formatPrice(m.today_avg_basket || 0);
    if (todayAvgSub) todayAvgSub.textContent = `${m.today_customers || 0} customers today`;

    // 2. Business Snapshot
    const yestSalesEl = document.getElementById('dash-yesterday-sales');
    const monthTaxEl = document.getElementById('dash-month-tax');
    const monthExpEl = document.getElementById('dash-month-expenses');
    const monthNetEl = document.getElementById('dash-month-est-net');
    const creditSalesTodayEl = document.getElementById('dash-today-credit-sales');
    const creditTransTodaySub = document.getElementById('dash-today-credit-trans-sub');

    if (yestSalesEl) yestSalesEl.textContent = formatPrice(m.yesterday_sales || 0);
    if (monthTaxEl) monthTaxEl.textContent = formatPrice(m.month_tax || 0);
    if (monthExpEl) monthExpEl.textContent = formatPrice(m.month_expenses || 0);
    if (monthNetEl) monthNetEl.textContent = formatPrice(m.month_est_net || 0);
    if (creditSalesTodayEl) creditSalesTodayEl.textContent = formatPrice(m.credit_sales_today || 0);
    if (creditTransTodaySub) creditTransTodaySub.textContent = `${m.credit_transactions_today || 0} transactions`;

    // Mini cards
    const totCustEl = document.getElementById('dash-total-customers');
    const newCustEl = document.getElementById('dash-new-customers-month');
    const arBalEl = document.getElementById('dash-ar-balance');
    const arBalSub = document.getElementById('dash-ar-balance-sub');
    const openPosEl = document.getElementById('dash-open-pos');

    if (totCustEl) totCustEl.textContent = m.total_customers || 0;
    if (newCustEl) newCustEl.textContent = m.new_customers_month || 0;
    if (arBalEl) arBalEl.textContent = formatPrice(m.ar_balance_total || 0);
    if (arBalSub) arBalSub.textContent = `${m.ar_balance_count || 0} with balance > 0`;
    if (openPosEl) openPosEl.textContent = m.open_pos_count || 0;

    // 3. Revenue & Value
    const ytdSalesEl = document.getElementById('dash-ytd-sales');
    const thisMonthSalesEl = document.getElementById('dash-this-month-sales');
    const thisMonthSalesSub = document.getElementById('dash-this-month-sales-sub');
    const last7DaysEl = document.getElementById('dash-last-7-days-sales');
    const invValEl = document.getElementById('dash-inventory-value');

    if (ytdSalesEl) ytdSalesEl.textContent = formatPrice(m.ytd_sales || 0);
    if (thisMonthSalesEl) thisMonthSalesEl.textContent = formatPrice(m.month_sales || 0);
    if (thisMonthSalesSub) {
      const mPct = m.vs_month_pct || 0;
      thisMonthSalesSub.textContent = `${mPct >= 0 ? '+' : ''}${mPct}% vs last month`;
    }
    if (last7DaysEl) last7DaysEl.textContent = formatPrice(m.last_7_days_sales || 0);
    if (invValEl) invValEl.textContent = formatPrice(m.inventory_value || 0);

    // 4. Today's Operations
    const opTransEl = document.getElementById('dash-op-trans');
    const opProfitEl = document.getElementById('dash-op-profit');
    const opProfitSub = document.getElementById('dash-op-profit-sub');
    const opUnitsEl = document.getElementById('dash-op-units');
    const opAvgBasketEl = document.getElementById('dash-op-avg-basket');
    const opCustomersEl = document.getElementById('dash-op-customers');

    if (opTransEl) opTransEl.textContent = m.today_transactions || 0;
    if (opProfitEl) opProfitEl.textContent = formatPrice(m.today_gross_profit || 0);
    if (opProfitSub) opProfitSub.textContent = `${(m.today_margin_pct || 0).toFixed(1)}% margin`;
    if (opUnitsEl) opUnitsEl.textContent = m.today_units || 0;
    if (opAvgBasketEl) opAvgBasketEl.textContent = formatPrice(m.today_avg_basket || 0);
    if (opCustomersEl) opCustomersEl.textContent = m.today_customers || 0;

    // Stock Alerts Strip (Horizontal Top Strip)
    const lowStockEl = document.getElementById('dash-low-stock-count');
    const expiringEl = document.getElementById('dash-expiring-count');
    const expiredEl = document.getElementById('dash-expired-count');

    const lowCount = m.low_stock_count !== undefined ? m.low_stock_count : 0;
    const expCount = m.expiring_count !== undefined ? m.expiring_count : 0;
    const expdCount = m.expired_count !== undefined ? m.expired_count : 0;

    if (lowStockEl) lowStockEl.textContent = lowCount;
    if (expiringEl) expiringEl.textContent = expCount;
    if (expiredEl) expiredEl.textContent = expdCount;

    // Also update Stock & Expiry Widget
    const stockExpiryContainer = document.getElementById('dash-stock-expiry-container');
    if (stockExpiryContainer) {
      const totalSkus = m.total_products_count !== undefined ? m.total_products_count : (posProductsList.length || 0);
      stockExpiryContainer.innerHTML = `
        <div class="stock-expiry-summary-list">
          <div class="stock-expiry-item">
            <span>📦 Total Products Cataloged</span>
            <strong>${totalSkus} SKUs</strong>
          </div>
          <div class="stock-expiry-item">
            <span>⚠️ Low Stock Items</span>
            <strong style="color:#ef4444;">${lowCount}</strong>
          </div>
          <div class="stock-expiry-item">
            <span>⏳ Batches Near Expiry (3 Mo)</span>
            <strong style="color:#f59e0b;">${expCount}</strong>
          </div>
        </div>
      `;
    }
  };

  const renderDashboardCharts = (charts, metrics) => {
    // 1. 14 Days Sales Trend (Image 4 - Smooth Cubic Bezier Line + Area Gradient + Dotted Transactions)
    const trendContainer = document.getElementById('dash-sales-trend-container');
    const trendData = (charts && charts.sales_trend_14_days) || [];
    if (trendContainer) {
      if (trendData.length === 0) {
        trendContainer.innerHTML = `<div class="empty-chart-box"><p>No sales data recorded in the last 14 days.</p></div>`;
      } else {
        const rawMaxRev = Math.max(...trendData.map(d => parseFloat(d.revenue || 0)), 100);
        const maxRev = Math.ceil(rawMaxRev / 100) * 100 || 1000;
        const maxTrans = Math.max(...trendData.map(d => parseInt(d.transactions || 0, 10)), 2);

        // Chart dimensions
        const svgW = 560;
        const svgH = 190;
        const padL = 45;
        const padR = 25;
        const padT = 20;
        const padB = 30;
        const plotW = svgW - padL - padR;
        const plotH = svgH - padT - padB;

        const ptsRev = [];
        const ptsTrx = [];

        trendData.forEach((d, i) => {
          const x = padL + (i / Math.max(1, trendData.length - 1)) * plotW;
          const rev = parseFloat(d.revenue || 0);
          const trx = parseInt(d.transactions || 0, 10);
          const yRev = padT + plotH - (rev / maxRev) * plotH;
          const yTrx = padT + plotH - (trx / maxTrans) * plotH;
          ptsRev.push({ x, y: yRev, rev, label: d.label, trx });
          ptsTrx.push({ x, y: yTrx, trx });
        });

        // Generate smooth Bezier path for curves
        const getBezierPath = (pts) => {
          if (pts.length === 0) return '';
          if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
          let path = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
          for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i === 0 ? 0 : i - 1];
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const p3 = pts[i + 2] || p2;
            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;
            path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
          }
          return path;
        };

        const revLinePath = getBezierPath(ptsRev);
        const trxLinePath = getBezierPath(ptsTrx);
        const revAreaPath = `${revLinePath} L ${ptsRev[ptsRev.length - 1].x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${ptsRev[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;

        // Y-axis gridlines & ticks
        const ySteps = 5;
        let gridHtml = '';
        for (let s = 0; s <= ySteps; s++) {
          const yVal = Math.round((maxRev / ySteps) * s);
          const yPos = padT + plotH - (s / ySteps) * plotH;
          const trxVal = Math.round((maxTrans / ySteps) * s);
          const labelRev = yVal >= 1000 ? `$${(yVal/1000).toFixed(0)}K` : `$${yVal}`;
          gridHtml += `
            <line x1="${padL}" y1="${yPos}" x2="${svgW - padR}" y2="${yPos}" class="chart-grid-line" />
            <text x="${padL - 6}" y="${yPos + 4}" text-anchor="end" class="chart-axis-text">${labelRev}</text>
            <text x="${svgW - padR + 6}" y="${yPos + 4}" text-anchor="start" class="chart-axis-text">${trxVal}</text>
          `;
        }

        // X-axis ticks
        let xTicksHtml = '';
        ptsRev.forEach((p, idx) => {
          if (idx % 2 === 0 || idx === ptsRev.length - 1) {
            xTicksHtml += `<text x="${p.x}" y="${svgH - 8}" text-anchor="middle" class="chart-axis-text">${p.label}</text>`;
          }
        });

        // Interactive Dots with Tooltips
        const dotsHtml = ptsRev.map((p) => `
          <g class="chart-point-group" tabindex="0">
            <circle cx="${p.x}" cy="${p.y}" r="4" fill="#ffffff" stroke="#059669" stroke-width="2" class="chart-dot" />
            <title>${p.label}\nRevenue: ${formatPrice(p.rev)}\nTransactions: ${p.trx}</title>
          </g>
        `).join('');

        const trxDotsHtml = ptsTrx.map(p => `
          <circle cx="${p.x}" cy="${p.y}" r="3" fill="#059669" class="chart-trx-dot" />
        `).join('');

        trendContainer.innerHTML = `
          <div class="sales-trend-chart-box">
            <div class="sales-trend-legend">
              <div class="legend-item"><span class="legend-box-rev"></span><span>Revenue</span></div>
              <div class="legend-item"><span class="legend-box-trx"></span><span>Transactions</span></div>
            </div>
            <svg viewBox="0 0 ${svgW} ${svgH}" class="sales-curve-svg">
              <defs>
                <linearGradient id="salesTrendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#10b981" stop-opacity="0.28"/>
                  <stop offset="100%" stop-color="#10b981" stop-opacity="0.0"/>
                </linearGradient>
              </defs>
              ${gridHtml}
              ${xTicksHtml}
              <path d="${revAreaPath}" fill="url(#salesTrendGrad)" />
              <path d="${revLinePath}" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" />
              <path d="${trxLinePath}" fill="none" stroke="#059669" stroke-width="2" stroke-dasharray="4,4" stroke-linecap="round" />
              ${dotsHtml}
              ${trxDotsHtml}
            </svg>
          </div>
        `;
      }
    }

    // 2. Payment Mix Today (Image 4 - SVG Donut Chart + Summary)
    const payMixContainer = document.getElementById('dash-payment-mix-container');
    const payMixData = (charts && charts.payment_mix_today) || [];
    if (payMixContainer) {
      if (payMixData.length === 0) {
        payMixContainer.innerHTML = `<div class="empty-chart-box"><p>No sales recorded today yet</p></div>`;
      } else {
        const totalRev = payMixData.reduce((sum, p) => sum + parseFloat(p.method_total || 0), 0) || 1;
        const totalCount = payMixData.reduce((sum, p) => sum + parseInt(p.method_count || 0, 10), 0) || 1;

        // Colors for donut segments
        const methodColors = {
          cash: '#059669',
          card: '#2563eb',
          mobile: '#f59e0b',
          credit: '#8b5cf6',
          other: '#64748b'
        };

        const radius = 40;
        const circumference = 2 * Math.PI * radius;
        let accumulatedPercent = 0;

        const segmentsHtml = payMixData.map(p => {
          const amt = parseFloat(p.method_total || 0);
          const pct = amt / totalRev;
          const strokeDash = pct * circumference;
          const strokeOffset = -accumulatedPercent * circumference;
          accumulatedPercent += pct;
          const mKey = (p.payment_method || 'cash').toLowerCase();
          const col = methodColors[mKey] || '#059669';

          return `
            <circle cx="60" cy="60" r="${radius}" fill="none" stroke="${col}" stroke-width="24"
              stroke-dasharray="${strokeDash.toFixed(2)} ${circumference.toFixed(2)}"
              stroke-dashoffset="${strokeOffset.toFixed(2)}">
              <title>${p.payment_method}: ${formatPrice(amt)} (${Math.round(pct * 100)}%)</title>
            </circle>
          `;
        }).join('');

        const primaryMethod = payMixData[0] ? payMixData[0].payment_method : 'Cash';
        const primaryColor = methodColors[primaryMethod.toLowerCase()] || '#059669';

        payMixContainer.innerHTML = `
          <div class="donut-chart-container">
            <div class="donut-svg-wrap">
              <svg viewBox="0 0 120 120" class="donut-svg">
                ${segmentsHtml}
              </svg>
            </div>
            <div class="donut-legend-below">
              <span style="width:10px; height:10px; background:${primaryColor}; border-radius:2px; display:inline-block;"></span>
              <span>${escapeHtml(primaryMethod)}</span>
            </div>
            <div class="donut-summary-footer">
              <span>${escapeHtml(primaryMethod)}</span>
              <strong>${formatPrice(totalRev)} (${totalCount})</strong>
            </div>
          </div>
        `;
      }
    }

    // 3. Hourly Sales Today
    const hourlyContainer = document.getElementById('dash-hourly-sales-container');
    const hourlyData = (charts && charts.hourly_sales_today) || [];
    if (hourlyContainer) {
      const maxH = Math.max(...hourlyData, 10);
      const hasAnyH = hourlyData.some(v => v > 0);

      if (!hasAnyH) {
        hourlyContainer.innerHTML = `<div class="empty-chart-box large"><p>No sales recorded yet today</p></div>`;
      } else {
        let colsHtml = '';
        for (let h = 0; h < 24; h++) {
          const val = hourlyData[h] || 0;
          const hPct = Math.max(3, Math.round((val / maxH) * 100));
          const hLabel = h % 3 === 0 ? `${h}h` : '';
          colsHtml += `
            <div class="hourly-col" title="${h}:00 - ${formatPrice(val)}">
              <div class="hourly-bar" style="height: ${hPct}%;"></div>
              <span class="hourly-label">${hLabel}</span>
            </div>
          `;
        }
        hourlyContainer.innerHTML = `<div class="hourly-bars-track">${colsHtml}</div>`;
      }
    }

    // 4. Top Sellers (Last 7 Days)
    const topSellersContainer = document.getElementById('dash-top-sellers-container');
    const topSellersData = (charts && charts.top_sellers_7_days) || [];
    if (topSellersContainer) {
      if (topSellersData.length === 0) {
        topSellersContainer.innerHTML = `<div class="empty-state-card"><p>No product sales recorded yet</p></div>`;
      } else {
        const maxTop = Math.max(...topSellersData.map(t => parseFloat(t.total_revenue || 0)), 1);
        topSellersContainer.innerHTML = `
          <div class="top-sellers-list">
            ${topSellersData.map(t => {
              const rev = parseFloat(t.total_revenue || 0);
              const pct = Math.round((rev / maxTop) * 100);
              return `
                <div class="top-seller-row">
                  <div class="top-seller-header">
                    <div>
                      <span class="top-seller-name">${escapeHtml(t.product_name)}</span>
                      <span class="top-seller-qty">(${t.total_qty} units sold)</span>
                    </div>
                    <span class="top-seller-amount">${formatPrice(rev)}</span>
                  </div>
                  <div class="top-seller-track">
                    <div class="top-seller-fill" style="width: ${pct}%;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }
    }

    // 5. Recent Sales
    const recentSalesContainer = document.getElementById('dash-recent-sales-container');
    const recentSalesData = (charts && charts.recent_sales) || [];
    if (recentSalesContainer) {
      if (recentSalesData.length === 0) {
        recentSalesContainer.innerHTML = `<div class="empty-state-card"><p>No recent sales found</p></div>`;
      } else {
        recentSalesContainer.innerHTML = `
          <div class="recent-sales-list">
            ${recentSalesData.map(s => {
              const dt = s.created_at ? new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
              const pay = s.payment_method || 'Cash';
              const pClass = pay === 'Credit' ? 'pay-credit' : '';
              return `
                <div class="recent-sale-row">
                  <div class="recent-sale-meta">
                    <span class="recent-sale-inv">${escapeHtml(s.invoice_number)}</span>
                    <span class="recent-sale-sub">${escapeHtml(s.customer_name || 'Walk-in')} • ${dt} (${s.items_count || 1} items)</span>
                  </div>
                  <div class="recent-sale-right">
                    <span class="recent-sale-total">${formatPrice(s.total_amount || 0)}</span>
                    <span class="recent-sale-pay-badge ${pClass}">${escapeHtml(pay)}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }
    }

    // 6. Stock & Expiry Quick Summary
    const stockExpiryContainer = document.getElementById('dash-stock-expiry-container');
    if (stockExpiryContainer) {
      const totalSkus = (metrics && metrics.total_products_count !== undefined) ? metrics.total_products_count : ((charts && charts.total_products_count !== undefined) ? charts.total_products_count : (posProductsList.length || 0));
      const lowCount = (metrics && metrics.low_stock_count !== undefined) ? metrics.low_stock_count : (document.getElementById('dash-low-stock-count')?.textContent || '0');
      const expCount = (metrics && metrics.expiring_count !== undefined) ? metrics.expiring_count : (document.getElementById('dash-expiring-count')?.textContent || '0');

      stockExpiryContainer.innerHTML = `
        <div class="stock-expiry-summary-list">
          <div class="stock-expiry-item">
            <span>📦 Total Products Cataloged</span>
            <strong>${totalSkus} SKUs</strong>
          </div>
          <div class="stock-expiry-item">
            <span>⚠️ Low Stock Items</span>
            <strong style="color:#ef4444;">${lowCount}</strong>
          </div>
          <div class="stock-expiry-item">
            <span>⏳ Batches Near Expiry (3 Mo)</span>
            <strong style="color:#f59e0b;">${expCount}</strong>
          </div>
        </div>
      `;
    }
  };

  const computeAndRenderLocalDashboardMetrics = () => {
    let prods = [];
    let custs = [];
    let batches = [];
    try {
      const p = localStorage.getItem(`ezpharma_products_pharm_${pharmacyId}`);
      if (p) prods = JSON.parse(p);
      const c = localStorage.getItem(`ezpharma_customers_pharm_${pharmacyId}`);
      if (c) custs = JSON.parse(c);
      const b = localStorage.getItem(`ezpharma_stock_pharm_${pharmacyId}`);
      if (b) batches = JSON.parse(b);
    } catch (e) {}

    const now = new Date();
    const in90Days = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    let expiring = 0;
    let expired = 0;

    // Group batches by product / SKU to calculate Low Stock SKUs accurately
    const skuQtyMap = {};
    const skuReorderMap = {};

    batches.forEach(bt => {
      const qty = parseInt(bt.quantity || 0, 10);
      const pKey = bt.product_id ? `id_${bt.product_id}` : (bt.product_sku ? `sku_${bt.product_sku}` : `name_${bt.product_name}`);
      skuQtyMap[pKey] = (skuQtyMap[pKey] || 0) + qty;
      skuReorderMap[pKey] = Math.max(skuReorderMap[pKey] || 0, parseInt(bt.reorder_level || 0, 10));

      if (bt.expiry_date) {
        const exp = new Date(bt.expiry_date);
        if (exp <= now && qty > 0) expired++;
        else if (exp <= in90Days && qty > 0) expiring++;
      }
    });

    let lowStock = 0;
    Object.keys(skuQtyMap).forEach(pKey => {
      const totalQty = skuQtyMap[pKey];
      const reorderLvl = skuReorderMap[pKey] || 10;
      if (totalQty <= reorderLvl && totalQty > 0) {
        lowStock++;
      }
    });

    const invVal = prods.reduce((sum, pr) => sum + ((parseFloat(pr.stock_quantity || 0)) * (parseFloat(pr.selling_price || 0))), 0);
    const arBal = custs.reduce((sum, cu) => sum + (parseFloat(cu.credit_used || 0)), 0);
    const arCount = custs.filter(cu => (parseFloat(cu.credit_used || 0)) > 0).length;

    let exps = [];
    let posList = [];
    let salesList = [];
    try {
      const e = localStorage.getItem(`ezpharma_expenses_pharm_${pharmacyId}`);
      if (e) exps = JSON.parse(e);
      const po = localStorage.getItem(`ezpharma_pos_pharm_${pharmacyId}`);
      if (po) posList = JSON.parse(po);
      const sl = localStorage.getItem(`ezpharma_sales_pharm_${pharmacyId}`);
      if (sl) salesList = JSON.parse(sl);
    } catch (e) {}

    const curMonthExps = exps.filter(ex => {
      const d = new Date(ex.expense_date || Date.now());
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).reduce((sum, ex) => sum + (parseFloat(ex.amount) || 0), 0);

    const openPOs = posList.filter(p => !p.status || ['draft', 'ordered', 'partial', 'pending', 'open'].includes(String(p.status).toLowerCase())).length;

    let mSales = 0;
    let mTax = 0;
    salesList.forEach(s => {
      const d = new Date(s.created_at || Date.now());
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
        mSales += parseFloat(s.total_amount || 0);
        mTax += parseFloat(s.tax_amount || 0);
      }
    });

    renderDashboardMetrics({
      today_sales: 0,
      today_transactions: 0,
      today_gross_profit: 0,
      today_margin_pct: 0,
      today_avg_basket: 0,
      today_units: 0,
      today_customers: 0,
      vs_yesterday_pct: 0,
      yesterday_sales: 0,
      month_tax: mTax,
      month_expenses: curMonthExps,
      month_est_net: (mSales - curMonthExps),
      credit_sales_today: 0,
      credit_transactions_today: 0,
      total_customers: custs.length,
      new_customers_month: custs.length,
      ar_balance_count: arCount,
      ar_balance_total: arBal,
      open_pos_count: openPOs,
      ytd_sales: mSales,
      month_sales: mSales,
      vs_month_pct: 0,
      last_7_days_sales: mSales,
      inventory_value: invVal,
      total_products_count: prods.length,
      low_stock_count: lowStock,
      expiring_count: expiring,
      expired_count: expired
    });
  };

  // 11. POS & Shortcut Clicks
  const openPosBtn = document.getElementById('open-pos-btn');
  if (openPosBtn) {
    openPosBtn.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('/dashboard/pos');
    });
  }

  document.querySelectorAll('.shortcut-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const path = btn.getAttribute('data-path') || '/dashboard';
      navigateTo(path);
    });
  });

  // 12. Sign Out
  const signoutBtn = document.getElementById('signout-btn');
  if (signoutBtn) {
    signoutBtn.addEventListener('click', () => {
      localStorage.removeItem('ezpharma_session');
      localStorage.removeItem('ezpharma_current_pharmacy');
      window.location.href = '/signin';
    });
  }
  // ==============================================
  // 13. REPORTS & INSIGHTS (100% Reference Image Match)
  // ==============================================
  const REPORTS_API_ENDPOINTS = [
    'https://api.holidaymartbd.com/ezpharma/reports.php',
    '/api/reports.php',
    'api/reports.php'
  ];

  let reportsCurrentStartDate = '';
  let reportsCurrentEndDate = '';
  let reportsCurrentData = null;

  // Format Helper for Currency
  const formatReportCurr = (num) => {
    const val = parseFloat(num) || 0;
    return '৳' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Date Range Helper (YYYY-MM-DD)
  const formatIsoDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Initialize Default Date Range (Last 30 Days)
  const initReportsDefaultDates = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 29);
    reportsCurrentStartDate = formatIsoDate(start);
    reportsCurrentEndDate = formatIsoDate(end);
  };
  initReportsDefaultDates();

  const loadAndRenderReports = async (startDate, endDate) => {
    if (startDate) reportsCurrentStartDate = startDate;
    if (endDate) reportsCurrentEndDate = endDate;
    if (!reportsCurrentStartDate || !reportsCurrentEndDate) {
      initReportsDefaultDates();
    }

    // Set input values
    const startInput = document.getElementById('reports-start-date');
    const endInput = document.getElementById('reports-end-date');
    if (startInput) startInput.value = reportsCurrentStartDate;
    if (endInput) endInput.value = reportsCurrentEndDate;

    let responseData = null;

    for (const ep of REPORTS_API_ENDPOINTS) {
      try {
        const url = `${ep}?action=summary&pharmacy_id=${encodeURIComponent(pharmacyId)}&start_date=${encodeURIComponent(reportsCurrentStartDate)}&end_date=${encodeURIComponent(reportsCurrentEndDate)}`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (json && json.success && json.kpis) {
            responseData = json;
            break;
          }
        }
      } catch (e) {}
    }

    // Fallback: If reports.php not uploaded or returned 0, dynamically query pos.php, stock.php, and expenses.php
    if (!responseData || (!responseData.kpis?.transactions && !responseData.kpis?.revenue)) {
      const fallbackData = await computeLiveFallbackReports(reportsCurrentStartDate, reportsCurrentEndDate);
      if (fallbackData && (fallbackData.kpis?.transactions > 0 || !responseData)) {
        responseData = fallbackData;
      }
    }

    // If inventory snapshot has 0, fetch live snapshot from stock APIs
    if (!responseData.inventory_snapshot?.total_skus && !responseData.inventory_snapshot?.retail_stock_value) {
      try {
        for (const ep of STOCK_API_ENDPOINTS) {
          try {
            const res = await fetch(`${ep}?action=alerts&pharmacy_id=${encodeURIComponent(pharmacyId)}`);
            if (res.ok) {
              const aJson = await res.json();
              if (aJson.success && aJson.counts) {
                if (!responseData.inventory_snapshot) responseData.inventory_snapshot = {};
                responseData.inventory_snapshot.low_stock_count = aJson.counts.low_stock || 0;
                responseData.inventory_snapshot.expiring_count = aJson.counts.expiring_soon || aJson.counts.expiring || 0;
                break;
              }
            }
          } catch (e) {}
        }
        for (const ep of STOCK_API_ENDPOINTS) {
          try {
            const sRes = await fetch(`${ep}?action=list&pharmacy_id=${encodeURIComponent(pharmacyId)}&per_page=1000`);
            if (sRes.ok) {
              const sJson = await sRes.json();
              if (sJson.success && Array.isArray(sJson.data)) {
                let totalVal = 0;
                sJson.data.forEach(item => {
                  const q = parseFloat(item.quantity || 0);
                  const p = parseFloat(item.selling_price || item.unit_price || item.price || item.cost_price || 0);
                  totalVal += (q * p);
                });
                if (!responseData.inventory_snapshot) responseData.inventory_snapshot = {};
                responseData.inventory_snapshot.total_skus = sJson.total || sJson.data.length;
                responseData.inventory_snapshot.retail_stock_value = totalVal;
                break;
              }
            }
          } catch (e) {}
        }
      } catch (e) {}
    }

    reportsCurrentData = responseData;

    // 1. Render Top 6 KPI Cards
    renderReportsKpis(responseData.kpis, responseData.sub_kpis);

    // 2. Render Dual-Axis Daily Trend Chart (Canvas)
    renderReportsDailyTrend(responseData.daily_trend || []);

    // 3. Render Payment Mix Donut Chart (Canvas)
    renderReportsPaymentDonut(responseData.payment_mix || []);

    // 4. Render Category Revenue Horizontal Bars
    renderReportsCategoryBars(responseData.category_revenue || []);

    // 5. Render Top Products Table
    renderReportsTopProducts(responseData.top_products || []);

    // 6. Render Inventory Snapshot
    renderReportsInventorySnapshot(responseData.inventory_snapshot || {});

    // 7. Render Payment Methods Detail Table
    renderReportsPaymentDetail(responseData.payment_methods_detail || []);
  };

  // Live Multi-API Fallback Analytics Aggregator
  const computeLiveFallbackReports = async (sDate, eDate) => {
    let sales = [];

    // 1. Fetch sales from pos.php
    for (const url of POS_API_ENDPOINTS) {
      try {
        const res = await fetch(`${url}?action=list_sales&pharmacy_id=${encodeURIComponent(pharmacyId)}&per_page=1000`);
        if (res.ok) {
          const json = await res.json();
          if (json && json.success && Array.isArray(json.sales)) {
            sales = json.sales;
            break;
          }
        }
      } catch (e) {}
    }

    // Fallback to local memory if server list empty
    if (!sales.length && currentSalesHistoryList && currentSalesHistoryList.length) {
      sales = currentSalesHistoryList;
    }
    if (!sales.length) {
      try {
        sales = JSON.parse(localStorage.getItem(`ezpharma_sales_pharm_${pharmacyId}`) || '[]');
      } catch (e) {}
    }

    // 2. Fetch expenses from expenses.php
    let expensesList = [];
    for (const ep of EXPENSES_API_ENDPOINTS) {
      try {
        const res = await fetch(`${ep}?action=list&pharmacy_id=${encodeURIComponent(pharmacyId)}`);
        if (res.ok) {
          const json = await res.json();
          if (json && json.success && Array.isArray(json.data)) {
            expensesList = json.data;
            break;
          }
        }
      } catch (e) {}
    }
    if (!expensesList.length) {
      try {
        expensesList = JSON.parse(localStorage.getItem(`ezpharma_expenses_pharm_${pharmacyId}`) || '[]');
      } catch (e) {}
    }

    const startTs = new Date(sDate + 'T00:00:00').getTime();
    const endTs = new Date(eDate + 'T23:59:59').getTime();

    const filteredSales = sales.filter(s => {
      const t = new Date(s.created_at || s.date || Date.now()).getTime();
      return t >= startTs && t <= endTs && s.status !== 'cancelled';
    });

    let totalRev = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    let totalSubtotal = 0;
    let rxCount = 0;
    let withCustomerCount = 0;
    let walkInCount = 0;

    const paymentMap = {};
    const categoryMap = {};
    const productMap = {};
    const dateMap = {};

    // Build day map
    const cur = new Date(sDate);
    const endObj = new Date(eDate);
    while (cur <= endObj) {
      const dStr = formatIsoDate(cur);
      dateMap[dStr] = { date: dStr, revenue: 0, transactions: 0 };
      cur.setDate(cur.getDate() + 1);
    }

    filteredSales.forEach(s => {
      const amt = parseFloat(s.total_amount || s.grand_total || s.total || 0);
      const tax = parseFloat(s.tax_amount || s.tax || 0);
      const disc = parseFloat(s.discount_amount || s.discount || 0);
      const sub = parseFloat(s.subtotal || (amt - tax + disc));

      totalRev += amt;
      totalTax += tax;
      totalDiscount += disc;
      totalSubtotal += sub;

      if (s.customer_id || (s.customer_name && s.customer_name !== 'Walk-in Customer' && s.customer_name !== 'Walk-in')) {
        withCustomerCount++;
      } else {
        walkInCount++;
      }

      const method = s.payment_method || 'Cash';
      if (!paymentMap[method]) paymentMap[method] = { method, transactions: 0, revenue: 0 };
      paymentMap[method].transactions++;
      paymentMap[method].revenue += amt;

      const dStr = (s.created_at || s.date || '').substring(0, 10);
      if (dateMap[dStr]) {
        dateMap[dStr].revenue += amt;
        dateMap[dStr].transactions++;
      }

      const items = s.items || [];
      let saleHasRx = false;
      items.forEach(item => {
        if (item.requires_rx || item.rx) saleHasRx = true;
        const cat = item.category_name || item.category || 'General';
        categoryMap[cat] = (categoryMap[cat] || 0) + (parseFloat(item.total_price || (item.price * item.quantity) || 0));

        const pName = item.product_name || item.name || 'Product';
        if (!productMap[pName]) productMap[pName] = { name: pName, quantity: 0, revenue: 0 };
        productMap[pName].quantity += parseInt(item.quantity || 1, 10);
        productMap[pName].revenue += parseFloat(item.total_price || (item.price * item.quantity) || 0);
      });
      if (saleHasRx) rxCount++;
    });

    const txCount = filteredSales.length;
    const avgOrder = txCount > 0 ? (totalRev / txCount) : 0;

    let expenses = 0;
    let expenseEntries = 0;
    expensesList.forEach(ex => {
      const exTs = new Date((ex.expense_date || ex.created_at) + 'T00:00:00').getTime();
      if (exTs >= startTs && exTs <= endTs) {
        expenses += parseFloat(ex.amount || 0);
        expenseEntries++;
      }
    });

    return {
      kpis: {
        transactions: txCount,
        revenue: totalRev,
        avg_order: avgOrder,
        tax: totalTax,
        discount: totalDiscount,
        subtotal: totalSubtotal,
        expenses: expenses,
        expense_entries: expenseEntries,
        net_profit: totalRev - expenses
      },
      sub_kpis: {
        prescription_sales: rxCount,
        with_customer: withCustomerCount,
        walk_in: walkInCount,
        subtotal_pre_tax: totalSubtotal
      },
      daily_trend: Object.values(dateMap),
      payment_mix: Object.values(paymentMap),
      category_revenue: Object.entries(categoryMap).map(([category, revenue]) => ({ category, revenue })).sort((a, b) => b.revenue - a.revenue),
      top_products: Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
      inventory_snapshot: {
        total_skus: 0,
        retail_stock_value: 0,
        low_stock_count: 0,
        expiring_count: 0
      },
      payment_methods_detail: Object.values(paymentMap).map(p => ({
        method: p.method,
        transactions: p.transactions,
        revenue: p.revenue,
        avg_ticket: p.transactions > 0 ? p.revenue / p.transactions : 0
      }))
    };
  };

  // 1. Render Top 6 KPIs & Sub-KPIs
  const renderReportsKpis = (kpis = {}, subKpis = {}) => {
    const elTx = document.getElementById('rep-kpi-transactions');
    const elRev = document.getElementById('rep-kpi-revenue');
    const elAvg = document.getElementById('rep-kpi-avg-order');
    const elTax = document.getElementById('rep-kpi-tax');
    const elExp = document.getElementById('rep-kpi-expenses');
    const elExpSub = document.getElementById('rep-kpi-expenses-sub');
    const elNet = document.getElementById('rep-kpi-net');

    if (elTx) elTx.textContent = (kpis.transactions || 0).toLocaleString();
    if (elRev) elRev.textContent = formatReportCurr(kpis.revenue || 0);
    if (elAvg) elAvg.textContent = formatReportCurr(kpis.avg_order || 0);
    if (elTax) elTax.textContent = formatReportCurr(kpis.tax || 0);
    if (elExp) elExp.textContent = formatReportCurr(kpis.expenses || 0);
    if (elExpSub) elExpSub.textContent = `${kpis.expense_entries || 0} entries`;
    if (elNet) {
      elNet.textContent = formatReportCurr(kpis.net_profit || 0);
      if ((kpis.net_profit || 0) < 0) {
        elNet.style.color = '#dc2626';
      } else {
        elNet.style.color = '';
      }
    }

    // Sub-KPIs
    const elRx = document.getElementById('rep-sub-rx-count');
    const elCust = document.getElementById('rep-sub-customer-count');
    const elWalkin = document.getElementById('rep-sub-walkin-count');
    const elPreTax = document.getElementById('rep-sub-pretax-amount');

    if (elRx) elRx.textContent = (subKpis.prescription_sales || 0).toLocaleString();
    if (elCust) elCust.textContent = (subKpis.with_customer || 0).toLocaleString();
    if (elWalkin) elWalkin.textContent = (subKpis.walk_in || 0).toLocaleString();
    if (elPreTax) elPreTax.textContent = formatReportCurr(subKpis.subtotal_pre_tax || 0);
  };

  // 2. Render Dual-Axis Daily Trend Chart (Canvas)
  const renderReportsDailyTrend = (trendData = []) => {
    const canvas = document.getElementById('rep-daily-trend-canvas');
    const wrap = document.getElementById('rep-daily-chart-wrap');
    const tooltip = document.getElementById('rep-daily-chart-tooltip');
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext('2d');
    const rect = wrap.getBoundingClientRect();
    const width = rect.width || 750;
    const height = 280;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    if (!trendData.length) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No transaction data in this period', width / 2, height / 2);
      return;
    }

    const padLeft = 60;
    const padRight = 50;
    const padTop = 30;
    const padBottom = 40;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    const maxRev = Math.max(...trendData.map(d => parseFloat(d.revenue) || 0), 100);
    const maxTrans = Math.max(...trendData.map(d => parseInt(d.transactions, 10) || 0), 5);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? '#334155' : '#f1f5f9';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    // Draw horizontal grid lines (4 lines)
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.fillStyle = textColor;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';

    for (let i = 0; i <= 4; i++) {
      const y = padTop + (chartH / 4) * i;
      const revVal = maxRev * (1 - i / 4);
      const transVal = Math.round(maxTrans * (1 - i / 4));

      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();

      // Left axis label (Revenue)
      ctx.textAlign = 'right';
      ctx.fillText('৳' + Math.round(revVal).toLocaleString(), padLeft - 8, y + 4);

      // Right axis label (Transactions)
      ctx.textAlign = 'left';
      ctx.fillText(transVal, width - padRight + 8, y + 4);
    }

    const count = trendData.length;
    const points = [];

    trendData.forEach((d, idx) => {
      const x = count === 1 ? padLeft + chartW / 2 : padLeft + (chartW / (count - 1)) * idx;
      const rev = parseFloat(d.revenue) || 0;
      const trans = parseInt(d.transactions, 10) || 0;
      const yRev = padTop + chartH - (rev / maxRev) * chartH;
      const yTrans = padTop + chartH - (trans / maxTrans) * chartH;
      points.push({ x, yRev, yTrans, data: d });
    });

    // 1. Draw Revenue Blue Area with Smooth Spline
    if (points.length > 0) {
      const grad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
      grad.addColorStop(0, 'rgba(59, 130, 246, 0.35)');
      grad.addColorStop(1, 'rgba(59, 130, 246, 0.02)');

      ctx.beginPath();
      ctx.moveTo(points[0].x, padTop + chartH);
      ctx.lineTo(points[0].x, points[0].yRev);

      for (let i = 0; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].yRev + points[i + 1].yRev) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].yRev, xc, yc);
      }
      if (points.length > 1) {
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].yRev);
      }
      ctx.lineTo(points[points.length - 1].x, padTop + chartH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Stroke Blue Line
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].yRev);
      for (let i = 0; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].yRev + points[i + 1].yRev) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].yRev, xc, yc);
      }
      if (points.length > 1) {
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].yRev);
      }
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // 2. Draw Transactions Green Line with Dots
    if (points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].yTrans);
      for (let i = 0; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].yTrans + points[i + 1].yTrans) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].yTrans, xc, yc);
      }
      if (points.length > 1) {
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].yTrans);
      }
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw Green dots
      points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.yTrans, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#10b981';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }

    // Draw X-axis date labels (spread evenly)
    ctx.fillStyle = textColor;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';

    const step = Math.ceil(count / 7);
    points.forEach((p, idx) => {
      if (idx % step === 0 || idx === count - 1) {
        const dObj = new Date(p.data.date);
        const label = dObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        ctx.fillText(label, p.x, height - 10);
      }
    });

    // Tooltip Mousemove Listener
    wrap.onmousemove = (e) => {
      const mouseRect = canvas.getBoundingClientRect();
      const mx = e.clientX - mouseRect.left;

      let closest = null;
      let minDst = Infinity;
      points.forEach(p => {
        const dst = Math.abs(p.x - mx);
        if (dst < minDst) {
          minDst = dst;
          closest = p;
        }
      });

      if (closest && minDst < 35 && tooltip) {
        const dObj = new Date(closest.data.date);
        const dateFormatted = dObj.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        tooltip.innerHTML = `
          <strong>${dateFormatted}</strong><br/>
          <span style="color:#60a5fa;">● Revenue:</span> ${formatReportCurr(closest.data.revenue)}<br/>
          <span style="color:#34d399;">● Transactions:</span> ${closest.data.transactions}
        `;
        tooltip.style.left = closest.x + 'px';
        tooltip.style.top = Math.min(closest.yRev, closest.yTrans) + 'px';
        tooltip.classList.remove('hidden');
      } else if (tooltip) {
        tooltip.classList.add('hidden');
      }
    };

    wrap.onmouseleave = () => {
      if (tooltip) tooltip.classList.add('hidden');
    };
  };

  // 3. Render Payment Mix Donut Chart (Canvas)
  const renderReportsPaymentDonut = (paymentMix = []) => {
    const canvas = document.getElementById('rep-payment-donut-canvas');
    const legend = document.getElementById('rep-payment-donut-legend');
    if (!canvas || !legend) return;

    const ctx = canvas.getContext('2d');
    const size = 220;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const totalRev = paymentMix.reduce((acc, p) => acc + (parseFloat(p.revenue) || 0), 0);

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];
    legend.innerHTML = '';

    if (!paymentMix.length || totalRev === 0) {
      // Draw empty gray donut
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, 75, 0, Math.PI * 2);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 26;
      ctx.stroke();

      legend.innerHTML = '<span class="text-muted text-sm">No sales in period</span>';
      return;
    }

    let startAngle = -Math.PI / 2;
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = 75;

    paymentMix.forEach((p, idx) => {
      const rev = parseFloat(p.revenue) || 0;
      const pct = totalRev > 0 ? (rev / totalRev) : 0;
      const sliceAngle = pct * Math.PI * 2;
      const color = colors[idx % colors.length];

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.strokeStyle = color;
      ctx.lineWidth = 26;
      ctx.stroke();

      startAngle += sliceAngle;

      // Add to legend
      const row = document.createElement('div');
      row.className = 'donut-legend-row';
      row.innerHTML = `
        <span class="donut-color-dot" style="background:${color};"></span>
        <span><strong>${escapeHtml(p.method)}</strong>: ${formatReportCurr(rev)} (${(pct * 100).toFixed(1)}%)</span>
      `;
      legend.appendChild(row);
    });
  };

  // 4. Render Category Revenue Horizontal Bars
  const renderReportsCategoryBars = (catData = []) => {
    const container = document.getElementById('rep-category-bars-container');
    if (!container) return;

    if (!catData.length) {
      container.innerHTML = '<p class="text-muted text-sm py-3">No category data available for this range.</p>';
      return;
    }

    const maxRev = Math.max(...catData.map(c => parseFloat(c.revenue) || 0), 1);

    container.innerHTML = catData.map(c => {
      const rev = parseFloat(c.revenue) || 0;
      const pct = Math.min(100, Math.max(5, (rev / maxRev) * 100));
      return `
        <div class="cat-bar-row">
          <div class="cat-bar-header">
            <span class="cat-bar-name">${escapeHtml(c.category || 'General')}</span>
            <span class="cat-bar-amt">${formatReportCurr(rev)}</span>
          </div>
          <div class="cat-bar-track">
            <div class="cat-bar-fill" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    }).join('');
  };

  // 5. Render Top Products Table
  const renderReportsTopProducts = (products = []) => {
    const tbody = document.getElementById('rep-top-products-tbody');
    if (!tbody) return;

    if (!products.length) {
      tbody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-muted">No product sales in this period</td></tr>';
      return;
    }

    tbody.innerHTML = products.map(p => `
      <tr>
        <td style="font-weight: 600;">${escapeHtml(p.name || p.product_name)}</td>
        <td class="text-center" style="font-weight: 700;">${(p.quantity || 0).toLocaleString()}</td>
        <td class="text-right" style="font-weight: 700;">${formatReportCurr(p.revenue)}</td>
      </tr>
    `).join('');
  };

  // 6. Render Inventory Snapshot
  const renderReportsInventorySnapshot = (snap = {}) => {
    const elSkus = document.getElementById('rep-snap-skus');
    const elVal = document.getElementById('rep-snap-stock-value');
    const elLow = document.getElementById('rep-snap-low-stock');
    const elExp = document.getElementById('rep-snap-expiring');

    if (elSkus) elSkus.textContent = (snap.total_skus || 0).toLocaleString();
    if (elVal) elVal.textContent = formatReportCurr(snap.retail_stock_value || 0);
    if (elLow) elLow.textContent = (snap.low_stock_count || 0).toLocaleString();
    if (elExp) elExp.textContent = (snap.expiring_count || 0).toLocaleString();
  };

  // 7. Render Payment Methods Detail Table
  const renderReportsPaymentDetail = (detail = []) => {
    const tbody = document.getElementById('rep-payment-methods-tbody');
    if (!tbody) return;

    if (!detail.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">No payment methods recorded</td></tr>';
      return;
    }

    tbody.innerHTML = detail.map(p => `
      <tr>
        <td style="font-weight: 600;">${escapeHtml(p.method)}</td>
        <td class="text-center">${(p.transactions || 0).toLocaleString()}</td>
        <td class="text-right" style="font-weight: 700;">${formatReportCurr(p.revenue)}</td>
        <td class="text-right">${formatReportCurr(p.avg_ticket || 0)}</td>
      </tr>
    `).join('');
  };

  // Quick Range Buttons Event Handlers
  document.querySelectorAll('#reports-quick-ranges .btn-range-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#reports-quick-ranges .btn-range-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const range = btn.getAttribute('data-range');
      const end = new Date();
      const start = new Date();

      if (range === '7d') {
        start.setDate(end.getDate() - 6);
      } else if (range === '30d') {
        start.setDate(end.getDate() - 29);
      } else if (range === '90d') {
        start.setDate(end.getDate() - 89);
      } else if (range === 'month') {
        start.setDate(1);
      }

      loadAndRenderReports(formatIsoDate(start), formatIsoDate(end));
    });
  });

  // Date Pickers Change Handler
  document.getElementById('reports-start-date')?.addEventListener('change', (e) => {
    document.querySelectorAll('#reports-quick-ranges .btn-range-pill').forEach(b => b.classList.remove('active'));
    loadAndRenderReports(e.target.value, reportsCurrentEndDate);
  });

  document.getElementById('reports-end-date')?.addEventListener('change', (e) => {
    document.querySelectorAll('#reports-quick-ranges .btn-range-pill').forEach(b => b.classList.remove('active'));
    loadAndRenderReports(reportsCurrentStartDate, e.target.value);
  });

  // Dedicated Business Report Print
  const triggerBusinessReportPrint = () => {
    const brand = getPharmacyBrandDetails();
    const pName = brand.name || 'EZ Pharma';
    const data = reportsCurrentData || {};
    const kpis = data.kpis || {};
    const topProds = data.top_products || [];
    const paymentDetail = data.payment_methods_detail || data.payment_mix || [];
    const catRevenue = data.category_revenue || [];
    const inv = data.inventory_snapshot || {};

    const printWindow = window.open('', '_blank', 'width=900,height=750');
    if (!printWindow) {
      showToast('⚠️ Pop-up was blocked. Please allow pop-ups for report printing.', true);
      return;
    }

    const genDateStr = new Date().toLocaleDateString('en-US') + ', ' + new Date().toLocaleTimeString('en-US');
    const periodStr = `${reportsCurrentStartDate || '—'} to ${reportsCurrentEndDate || '—'}`;

    // 1. Top products table rows
    let topProdsRows = '';
    if (topProds && topProds.length > 0) {
      topProdsRows = topProds.map(p => `
        <tr>
          <td>${escapeHtml((p.name || p.product_name || 'Product').toUpperCase())}</td>
          <td style="text-align: center;">${(p.quantity || 0).toLocaleString()}</td>
          <td style="text-align: right; font-weight: 600;">৳${(parseFloat(p.revenue) || 0).toFixed(2)}</td>
        </tr>
      `).join('');
    } else {
      topProdsRows = '<tr><td colspan="3" style="text-align: center; color: #64748b; padding: 10px;">No product sales in this period</td></tr>';
    }

    // 2. Payment mix table rows
    let paymentMixRows = '';
    if (paymentDetail && paymentDetail.length > 0) {
      paymentMixRows = paymentDetail.map(pm => `
        <tr>
          <td>${escapeHtml(pm.method || 'Cash')}</td>
          <td style="text-align: center;">${(pm.transactions || pm.count || 0).toLocaleString()}</td>
          <td style="text-align: right; font-weight: 600;">৳${(parseFloat(pm.revenue) || 0).toFixed(2)}</td>
        </tr>
      `).join('');
    } else {
      paymentMixRows = '<tr><td colspan="3" style="text-align: center; color: #64748b; padding: 10px;">No payment methods recorded</td></tr>';
    }

    // 3. Categories table rows
    let catRows = '';
    if (catRevenue && catRevenue.length > 0) {
      catRows = catRevenue.map(c => `
        <tr>
          <td>${escapeHtml(c.category || 'General')}</td>
          <td style="text-align: center;">${(c.total_qty || c.units || 0).toLocaleString()}</td>
          <td style="text-align: right; font-weight: 600;">৳${(parseFloat(c.revenue) || 0).toFixed(2)}</td>
        </tr>
      `).join('');
    } else {
      catRows = '<tr><td colspan="3" style="text-align: center; color: #64748b; padding: 10px;">No category sales in this period</td></tr>';
    }

    const txCount = kpis.transactions || 0;
    const revTotal = parseFloat(kpis.revenue || 0).toFixed(2);
    const avgOrder = parseFloat(kpis.avg_order || 0).toFixed(2);
    const taxTotal = parseFloat(kpis.tax || 0).toFixed(2);
    const expTotal = parseFloat(kpis.expenses || 0).toFixed(2);
    const netTotal = parseFloat(kpis.net_profit !== undefined ? kpis.net_profit : (kpis.revenue - (kpis.expenses || 0))).toFixed(2);

    const skuCount = (inv.total_skus || 0).toLocaleString();
    const stockVal = parseFloat(inv.retail_stock_value || 0).toFixed(2);
    const lowStock = (inv.low_stock_count || 0).toLocaleString();
    const expiring = (inv.expiring_count || 0).toLocaleString();

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Business Report - ${escapeHtml(pName)}</title>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #ffffff;
            color: #0f172a;
            padding: 30px 40px;
            font-size: 13px;
            line-height: 1.5;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          
          /* Header */
          .rep-header {
            text-align: center;
            margin-bottom: 25px;
          }
          .pharmacy-title {
            font-size: 16px;
            font-weight: 700;
            color: #1e3a8a;
            letter-spacing: 0.02em;
            margin-bottom: 4px;
          }
          .report-main-title {
            font-size: 20px;
            font-weight: 800;
            color: #0f172a;
            margin-bottom: 4px;
          }
          .generated-text {
            font-size: 12px;
            color: #64748b;
          }

          /* Period bar */
          .period-strip {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px 14px;
            font-size: 13px;
            font-weight: 600;
            color: #334155;
            margin-bottom: 20px;
          }

          /* Section block */
          .rep-section {
            margin-bottom: 22px;
          }
          .section-heading {
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 8px;
          }

          /* Summary Line Box */
          .summary-strip {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 10px 14px;
            font-size: 12.5px;
            color: #1e293b;
            line-height: 1.7;
          }
          .summary-strip strong {
            color: #0f172a;
          }
          .sep {
            color: #cbd5e1;
            margin: 0 8px;
            font-weight: bold;
          }

          /* Tables */
          .rep-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12.5px;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            overflow: hidden;
          }
          .rep-table thead {
            background: #f8fafc;
            border-bottom: 1px solid #cbd5e1;
          }
          .rep-table th {
            padding: 8px 12px;
            text-align: left;
            font-size: 12px;
            font-weight: 700;
            color: #475569;
            text-transform: capitalize;
            border-right: 1px solid #e2e8f0;
          }
          .rep-table th:last-child {
            border-right: none;
          }
          .rep-table td {
            padding: 7px 12px;
            border-bottom: 1px solid #f1f5f9;
            border-right: 1px solid #f1f5f9;
            color: #1e293b;
          }
          .rep-table td:last-child {
            border-right: none;
          }
          .rep-table tr:last-child td {
            border-bottom: none;
          }
          .rep-table tbody tr:nth-child(even) {
            background: #fafafa;
          }

          /* Footer */
          .report-doc-footer {
            margin-top: 35px;
            padding-top: 15px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            font-size: 13px;
            color: #0f172a;
          }
          .report-doc-footer strong {
            font-weight: 800;
            color: #0f172a;
          }

          @media print {
            body { padding: 15mm 20mm; }
            @page { margin: 10mm; size: A4; }
            .rep-table { break-inside: avoid; }
            .rep-section { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="rep-header">
          <div class="pharmacy-title">${escapeHtml(pName)}</div>
          <h1 class="report-main-title">Business report</h1>
          <div class="generated-text">Generated: ${escapeHtml(genDateStr)}</div>
        </div>

        <div class="period-strip">
          Period: ${escapeHtml(periodStr)}
        </div>

        <div class="rep-section">
          <h2 class="section-heading">Executive summary</h2>
          <div class="summary-strip">
            <span><strong>Transactions:</strong> ${txCount}</span>
            <span class="sep">|</span>
            <span><strong>Revenue:</strong> ৳${revTotal}</span>
            <span class="sep">|</span>
            <span><strong>Avg order:</strong> ৳${avgOrder}</span>
            <span class="sep">|</span>
            <span><strong>Tax:</strong> ৳${taxTotal}</span>
            <span class="sep">|</span>
            <span><strong>Expenses:</strong> ৳${expTotal}</span>
            <span class="sep">|</span>
            <span><strong>Net:</strong> ৳${netTotal}</span>
          </div>
        </div>

        <div class="rep-section">
          <h2 class="section-heading">Top products</h2>
          <table class="rep-table">
            <thead>
              <tr>
                <th style="width: 60%;">Product</th>
                <th style="width: 15%; text-align: center;">Qty</th>
                <th style="width: 25%; text-align: right;">Revenue</th>
              </tr>
            </thead>
            <tbody>
              ${topProdsRows}
            </tbody>
          </table>
        </div>

        <div class="rep-section">
          <h2 class="section-heading">Payment mix</h2>
          <table class="rep-table">
            <thead>
              <tr>
                <th style="width: 60%;">Method</th>
                <th style="width: 15%; text-align: center;">#</th>
                <th style="width: 25%; text-align: right;">Revenue</th>
              </tr>
            </thead>
            <tbody>
              ${paymentMixRows}
            </tbody>
          </table>
        </div>

        <div class="rep-section">
          <h2 class="section-heading">Categories</h2>
          <table class="rep-table">
            <thead>
              <tr>
                <th style="width: 60%;">Category</th>
                <th style="width: 15%; text-align: center;">Units</th>
                <th style="width: 25%; text-align: right;">Revenue</th>
              </tr>
            </thead>
            <tbody>
              ${catRows}
            </tbody>
          </table>
        </div>

        <div class="rep-section">
          <h2 class="section-heading">Inventory</h2>
          <div class="summary-strip">
            <span><strong>SKU count:</strong> ${skuCount}</span>
            <span class="sep">|</span>
            <span><strong>Stock value:</strong> ৳${stockVal}</span>
            <span class="sep">|</span>
            <span><strong>Low stock:</strong> ${lowStock}</span>
            <span class="sep">|</span>
            <span><strong>Expiring soon:</strong> ${expiring}</span>
          </div>
        </div>

        <div class="report-doc-footer">
          <strong>A system by Shakil Mahmud</strong>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Reports Actions: Print, Full CSV, Excel
  document.getElementById('btn-reports-print')?.addEventListener('click', triggerBusinessReportPrint);

  document.getElementById('btn-reports-export-csv')?.addEventListener('click', () => {
    const url = `https://api.holidaymartbd.com/ezpharma/reports.php?action=export_full_csv&pharmacy_id=${encodeURIComponent(pharmacyId)}&start_date=${encodeURIComponent(reportsCurrentStartDate)}&end_date=${encodeURIComponent(reportsCurrentEndDate)}`;
    window.open(url, '_blank');
  });

  document.getElementById('btn-reports-export-excel')?.addEventListener('click', () => {
    if (!reportsCurrentData) {
      showToast('No report data available to export', true);
      return;
    }

    if (typeof XLSX === 'undefined') {
      showToast('Excel library not loaded, exporting CSV...', false);
      window.open(`https://api.holidaymartbd.com/ezpharma/reports.php?action=export_full_csv&pharmacy_id=${encodeURIComponent(pharmacyId)}&start_date=${encodeURIComponent(reportsCurrentStartDate)}&end_date=${encodeURIComponent(reportsCurrentEndDate)}`, '_blank');
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: KPI Overview
      const kpis = reportsCurrentData.kpis || {};
      const subKpis = reportsCurrentData.sub_kpis || {};
      const summaryRows = [
        { Metric: 'Report Start Date', Value: reportsCurrentStartDate },
        { Metric: 'Report End Date', Value: reportsCurrentEndDate },
        { Metric: 'Total Transactions', Value: kpis.transactions || 0 },
        { Metric: 'Total Revenue (৳)', Value: kpis.revenue || 0 },
        { Metric: 'Average Order Size (৳)', Value: kpis.avg_order || 0 },
        { Metric: 'Total Tax Collected (৳)', Value: kpis.tax || 0 },
        { Metric: 'Total Operating Expenses (৳)', Value: kpis.expenses || 0 },
        { Metric: 'Net Profit (৳)', Value: kpis.net_profit || 0 },
        { Metric: 'Prescription Sales Count', Value: subKpis.prescription_sales || 0 },
        { Metric: 'Registered Customer Sales', Value: subKpis.with_customer || 0 },
        { Metric: 'Walk-in Sales', Value: subKpis.walk_in || 0 }
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'KPI Summary');

      // Sheet 2: Daily Trend
      if (reportsCurrentData.daily_trend && reportsCurrentData.daily_trend.length) {
        const wsTrend = XLSX.utils.json_to_sheet(reportsCurrentData.daily_trend.map(d => ({
          Date: d.date,
          Revenue: d.revenue,
          Transactions: d.transactions
        })));
        XLSX.utils.book_append_sheet(wb, wsTrend, 'Daily Trend');
      }

      // Sheet 3: Top Products
      if (reportsCurrentData.top_products && reportsCurrentData.top_products.length) {
        const wsProds = XLSX.utils.json_to_sheet(reportsCurrentData.top_products.map(p => ({
          Product: p.name || p.product_name,
          Quantity_Sold: p.quantity,
          Revenue: p.revenue
        })));
        XLSX.utils.book_append_sheet(wb, wsProds, 'Top Products');
      }

      // Sheet 4: Payment Methods Detail
      if (reportsCurrentData.payment_methods_detail && reportsCurrentData.payment_methods_detail.length) {
        const wsPay = XLSX.utils.json_to_sheet(reportsCurrentData.payment_methods_detail.map(p => ({
          Method: p.method,
          Transactions: p.transactions,
          Revenue: p.revenue,
          Average_Ticket: p.avg_ticket
        })));
        XLSX.utils.book_append_sheet(wb, wsPay, 'Payment Methods');
      }

      XLSX.writeFile(wb, `EZPharma_Reports_${reportsCurrentStartDate}_to_${reportsCurrentEndDate}.xlsx`);
      showToast('Excel report generated successfully!');
    } catch (err) {
      console.error(err);
      showToast('Failed to export Excel report', true);
    }
  });


  // ==============================================
  // 14. EXPENSES MANAGEMENT LOGIC
  // ==============================================
  const EXPENSES_API_ENDPOINTS = [
    'https://api.holidaymartbd.com/ezpharma/expenses.php',
    '/api/expenses.php',
    'api/expenses.php'
  ];

  let loadedExpensesList = [];
  let expenseSortField = 'expense_date';
  let expenseSortAsc = false;

  const loadAndRenderExpenses = async () => {
    const tbody = document.getElementById('expenses-table-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center py-5 text-muted">Loading expenses...</td></tr>';

    let expenses = [];
    let summary = null;

    for (const ep of EXPENSES_API_ENDPOINTS) {
      try {
        const res = await fetch(`${ep}?action=list&pharmacy_id=${encodeURIComponent(pharmacyId)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            expenses = json.expenses || json.data || [];
            summary = json.summary || null;
            break;
          }
        }
      } catch (e) {}
    }

    if (!expenses.length && !summary) {
      try {
        expenses = JSON.parse(localStorage.getItem(`ezpharma_expenses_pharm_${pharmacyId}`) || '[]');
      } catch (e) {}
    }

    loadedExpensesList = expenses;

    // Render Metrics
    const totalAmt = summary ? summary.total_amount : expenses.reduce((acc, ex) => acc + (parseFloat(ex.amount) || 0), 0);
    const totalCnt = summary ? summary.total_count : expenses.length;
    const monthAmt = summary ? summary.month_amount : expenses.filter(ex => {
      const d = new Date(ex.expense_date || Date.now());
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).reduce((acc, ex) => acc + (parseFloat(ex.amount) || 0), 0);

    const elTotAmt = document.getElementById('exp-total-amount-display');
    const elTotCnt = document.getElementById('exp-total-count-display');
    const elMonthAmt = document.getElementById('exp-month-amount-display');

    if (elTotAmt) elTotAmt.textContent = formatReportCurr(totalAmt);
    if (elTotCnt) elTotCnt.textContent = `${totalCnt} entries total`;
    if (elMonthAmt) elMonthAmt.textContent = formatReportCurr(monthAmt);

    filterAndSortExpenses();
  };

  const getCategoryBadgeClass = (cat = '') => {
    const c = String(cat).toLowerCase();
    if (c.includes('rent')) return 'tag-purple';
    if (c.includes('util') || c.includes('bill')) return 'tag-blue';
    if (c.includes('salar') || c.includes('wage')) return 'tag-green';
    if (c.includes('suppl') || c.includes('pack')) return 'tag-orange';
    if (c.includes('maint') || c.includes('repair')) return 'tag-red';
    return 'tag-grey';
  };

  const renderExpensesTable = (list = []) => {
    const tbody = document.getElementById('expenses-table-tbody');
    const countLabel = document.getElementById('expenses-count-label');
    if (countLabel) countLabel.textContent = `Showing ${list.length} of ${loadedExpensesList.length} results`;

    if (!tbody) return;

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center py-5 text-muted">No expenses found matching your filter. Click "+ Record Expense" to add a new record.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(ex => {
      const dObj = new Date(ex.expense_date || Date.now());
      const dateStr = dObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const badgeCls = getCategoryBadgeClass(ex.category);

      return `
        <tr data-id="${ex.id}">
          <td><span style="color: var(--text-muted, #64748b); font-family: monospace; font-size: 0.82rem; font-weight: 600;">${dateStr}</span></td>
          <td><strong style="color: var(--text-main, #0f172a); font-size: 0.86rem;">${escapeHtml(ex.title)}</strong></td>
          <td><span class="rep-kpi-badge ${badgeCls}" style="margin: 0;">${escapeHtml(ex.category || 'General')}</span></td>
          <td><span style="font-size: 0.8rem; font-weight: 600; color: var(--text-main, #334155); background: var(--table-th-bg, #f1f5f9); padding: 2px 8px; border-radius: 4px;">${escapeHtml(ex.payment_method || 'Cash')}</span></td>
          <td><span style="color: var(--text-muted, #64748b); font-size: 0.82rem;">${escapeHtml(ex.reference_number || '—')}</span></td>
          <td><span style="color: var(--text-muted, #64748b); font-size: 0.82rem; max-width: 220px; display: inline-block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(ex.notes || '—')}</span></td>
          <td class="text-right"><strong class="highlight-red" style="font-size: 0.9rem;">${formatReportCurr(ex.amount)}</strong></td>
          <td class="text-right">
            <div style="display: inline-flex; align-items: center; gap: 0.35rem;">
              <button type="button" class="btn-expense-action btn-edit-expense" data-id="${ex.id}" title="Edit Expense" style="background: #eff6ff; border-color: #dbeafe; color: #2563eb;">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              </button>
              <button type="button" class="btn-expense-action btn-delete-expense" data-id="${ex.id}" title="Delete Expense">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Bind Edit Buttons
    tbody.querySelectorAll('.btn-edit-expense').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const ex = loadedExpensesList.find(x => String(x.id) === String(id));
        if (!ex) return;

        document.getElementById('modal-expense-title').textContent = 'Edit Expense';
        document.getElementById('exp_form_id').value = ex.id;
        document.getElementById('exp_form_action').value = 'update';
        document.getElementById('exp_input_title').value = ex.title || '';
        document.getElementById('exp_input_category').value = ex.category || 'General';
        document.getElementById('exp_input_amount').value = parseFloat(ex.amount) || '';
        document.getElementById('exp_input_date').value = ex.expense_date || formatIsoDate(new Date());
        document.getElementById('exp_input_method').value = ex.payment_method || 'Cash';
        document.getElementById('exp_input_ref').value = ex.reference_number || '';
        document.getElementById('exp_input_notes').value = ex.notes || '';
        document.getElementById('btn-save-expense-text').textContent = 'Update Expense';

        modalExpense?.classList.remove('hidden');
      });
    });

    // Bind Delete Buttons
    tbody.querySelectorAll('.btn-delete-expense').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const id = btn.getAttribute('data-id');
        const confirmed = await showConfirmDialog({
          title: 'Delete Expense',
          message: 'Are you sure you want to delete this expense record? This will adjust your total calculations.',
          confirmText: 'Delete Expense',
          isDanger: true
        });

        if (!confirmed) return;

        for (const ep of EXPENSES_API_ENDPOINTS) {
          try {
            await fetch(`${ep}?action=delete`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                id, 
                pharmacy_id: pharmacyId,
                user_name: (sessionData && (sessionData.name || sessionData.username || sessionData.email)) || 'Admin'
              })
            });
          } catch (e) {}
        }

        // Local storage delete
        try {
          let exList = JSON.parse(localStorage.getItem(`ezpharma_expenses_pharm_${pharmacyId}`) || '[]');
          exList = exList.filter(x => String(x.id) !== String(id));
          localStorage.setItem(`ezpharma_expenses_pharm_${pharmacyId}`, JSON.stringify(exList));
        } catch (e) {}

        showToast('Expense record deleted successfully');
        loadAndRenderExpenses();
      });
    });
  };

  // Search, Filter and Sort for Expenses
  const filterAndSortExpenses = () => {
    const query = (document.getElementById('expenses-search-input')?.value || '').toLowerCase().trim();
    const category = document.getElementById('expenses-filter-category')?.value || 'all';

    let filtered = loadedExpensesList.filter(ex => {
      const matchesQuery = !query || 
        (ex.title && ex.title.toLowerCase().includes(query)) ||
        (ex.reference_number && ex.reference_number.toLowerCase().includes(query)) ||
        (ex.notes && ex.notes.toLowerCase().includes(query));
      
      const matchesCategory = category === 'all' || (ex.category && ex.category.toLowerCase() === category.toLowerCase());
      return matchesQuery && matchesCategory;
    });

    // Sorting
    filtered.sort((a, b) => {
      let valA = a[expenseSortField];
      let valB = b[expenseSortField];

      if (expenseSortField === 'amount') {
        valA = parseFloat(valA) || 0;
        valB = parseFloat(valB) || 0;
      } else if (expenseSortField === 'expense_date') {
        valA = new Date(valA || 0).getTime();
        valB = new Date(valB || 0).getTime();
      } else {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
      }

      if (valA < valB) return expenseSortAsc ? -1 : 1;
      if (valA > valB) return expenseSortAsc ? 1 : -1;
      return 0;
    });

    renderExpensesTable(filtered);
  };

  document.getElementById('expenses-search-input')?.addEventListener('input', filterAndSortExpenses);
  document.getElementById('expenses-filter-category')?.addEventListener('change', filterAndSortExpenses);
  document.getElementById('expenses-sort-field')?.addEventListener('change', (e) => {
    expenseSortField = e.target.value;
    filterAndSortExpenses();
  });
  document.getElementById('expenses-btn-sort-order')?.addEventListener('click', () => {
    expenseSortAsc = !expenseSortAsc;
    const icon = document.getElementById('expenses-sort-order-icon');
    if (icon) icon.textContent = expenseSortAsc ? '↑' : '↓';
    filterAndSortExpenses();
  });

  // Add / Edit Expense Modal
  const modalExpense = document.getElementById('modal-expense-form');
  const formExpense = document.getElementById('form-expense-management');
  const btnOpenAddExpense = document.getElementById('btn-open-add-expense-modal');
  const btnCloseAddExpense = document.getElementById('btn-close-expense-modal');
  const btnCancelAddExpense = document.getElementById('btn-cancel-expense-modal');

  btnOpenAddExpense?.addEventListener('click', () => {
    if (formExpense) formExpense.reset();
    document.getElementById('modal-expense-title').textContent = 'Record Expense';
    document.getElementById('exp_form_id').value = '';
    document.getElementById('exp_form_action').value = 'create';
    document.getElementById('btn-save-expense-text').textContent = 'Save Expense';
    const dateInput = document.getElementById('exp_input_date');
    if (dateInput) dateInput.value = formatIsoDate(new Date());
    modalExpense?.classList.remove('hidden');
  });

  const closeExpenseModal = () => {
    modalExpense?.classList.add('hidden');
  };

  btnCloseAddExpense?.addEventListener('click', closeExpenseModal);
  btnCancelAddExpense?.addEventListener('click', closeExpenseModal);

  formExpense?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const action = document.getElementById('exp_form_action')?.value || 'create';
    const id = document.getElementById('exp_form_id')?.value;
    const title = document.getElementById('exp_input_title')?.value.trim();
    const category = document.getElementById('exp_input_category')?.value || 'General';
    const amount = parseFloat(document.getElementById('exp_input_amount')?.value || 0);
    const date = document.getElementById('exp_input_date')?.value || formatIsoDate(new Date());
    const method = document.getElementById('exp_input_method')?.value || 'Cash';
    const ref = document.getElementById('exp_input_ref')?.value.trim();
    const notes = document.getElementById('exp_input_notes')?.value.trim();

    if (!title || !amount || amount <= 0) {
      showToast('Please provide a valid title and amount', true);
      return;
    }

    const spinner = document.getElementById('expense-save-spinner');
    const btnText = document.getElementById('btn-save-expense-text');
    if (spinner) spinner.classList.remove('hidden');
    if (btnText) btnText.textContent = action === 'update' ? 'Updating...' : 'Saving...';

    const payload = {
      action,
      id,
      pharmacy_id: pharmacyId,
      title,
      category,
      amount,
      expense_date: date,
      payment_method: method,
      reference_number: ref,
      notes,
      created_by: (sessionData && sessionData.id) || null,
      user_name: (sessionData && (sessionData.name || sessionData.username || sessionData.email)) || 'Admin'
    };

    for (const ep of EXPENSES_API_ENDPOINTS) {
      try {
        const res = await fetch(`${ep}?action=${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success) break;
        }
      } catch (e) {}
    }

    // Save to local storage as fallback
    try {
      let exList = JSON.parse(localStorage.getItem(`ezpharma_expenses_pharm_${pharmacyId}`) || '[]');
      if (action === 'update') {
        const idx = exList.findIndex(x => String(x.id) === String(id));
        if (idx !== -1) exList[idx] = { ...exList[idx], ...payload };
      } else {
        payload.id = Date.now();
        payload.created_at = new Date().toISOString();
        exList.unshift(payload);
      }
      localStorage.setItem(`ezpharma_expenses_pharm_${pharmacyId}`, JSON.stringify(exList));
    } catch (e) {}

    if (spinner) spinner.classList.add('hidden');
    if (btnText) btnText.textContent = 'Save Expense';
    closeExpenseModal();
    showToast(action === 'update' ? 'Expense updated successfully!' : 'Expense recorded successfully!');
    loadAndRenderExpenses();
  });

  // ==============================================
  // 15. NOTIFICATIONS CONTROLLER (Matches Image 1)
  // ==============================================
  let currentNotifFilter = 'all';

  const formatNotifTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr.replace(/-/g, '/'));
    if (isNaN(date.getTime())) return dateStr;
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  };

  const updateSidebarNotifBadge = async () => {
    try {
      const res = await fetch(`/api/notifications.php?action=list&pharmacy_id=${pharmacyId}&filter=unread`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          const count = json.unread_count || 0;
          const sideBadge = document.getElementById('sidebar-notif-badge');
          if (sideBadge) {
            sideBadge.textContent = count;
            if (count > 0) sideBadge.classList.remove('hidden');
            else sideBadge.classList.add('hidden');
          }
          const unreadPill = document.getElementById('notif-unread-count-pill');
          if (unreadPill) unreadPill.textContent = count;
          const tabUnreadNum = document.getElementById('notif-tab-unread-num');
          if (tabUnreadNum) tabUnreadNum.textContent = count;
        }
      }
    } catch (e) {}
  };

  const loadAndRenderNotifications = async (filter = 'all') => {
    currentNotifFilter = filter;
    const feed = document.getElementById('notif-card-feed');
    const pill = document.getElementById('notif-unread-count-pill');
    const tabNum = document.getElementById('notif-tab-unread-num');
    const sideBadge = document.getElementById('sidebar-notif-badge');

    if (feed) {
      feed.innerHTML = '<div class="notif-empty-state"><p>Loading notifications...</p></div>';
    }

    try {
      const res = await fetch(`/api/notifications.php?action=list&pharmacy_id=${pharmacyId}&filter=${filter}`);
      if (!res.ok) throw new Error('Failed to load notifications');
      const json = await res.json();

      if (!json.success) {
        if (feed) feed.innerHTML = `<div class="notif-empty-state"><p>${escapeHtml(json.message || 'Error loading notifications')}</p></div>`;
        return;
      }

      const list = json.data || [];
      const unreadCount = json.unread_count || 0;

      if (pill) pill.textContent = unreadCount;
      if (tabNum) tabNum.textContent = unreadCount;
      if (sideBadge) {
        sideBadge.textContent = unreadCount;
        if (unreadCount > 0) sideBadge.classList.remove('hidden');
        else sideBadge.classList.add('hidden');
      }

      if (!feed) return;

      if (list.length === 0) {
        feed.innerHTML = `
          <div class="notif-empty-state">
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 0.75rem; color: #94a3b8; display: block;">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            <p style="margin: 0; font-size: 0.95rem; font-weight: 600;">No notifications found</p>
            <p style="margin: 4px 0 0; font-size: 0.82rem; color: var(--text-muted);">You're all caught up!</p>
          </div>
        `;
        return;
      }

      feed.innerHTML = list.map(item => {
        const isUnread = parseInt(item.is_read, 10) === 0;
        const timeFormatted = formatNotifTime(item.created_at);
        return `
          <div class="notif-card ${isUnread ? 'unread' : ''}" data-id="${item.id}" data-unread="${isUnread ? '1' : '0'}">
            <div class="notif-card-left">
              <div class="notif-icon-box">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <path d="M16 10a4 4 0 0 1-8 0"></path>
                </svg>
              </div>
              <div class="notif-content-text">
                <h4 class="notif-card-title">${escapeHtml(item.title)}</h4>
                <p class="notif-card-desc">${escapeHtml(item.message)}</p>
              </div>
            </div>
            <div class="notif-card-right">
              <span class="notif-card-time">${timeFormatted}</span>
              ${isUnread ? '<span class="notif-unread-dot"></span>' : ''}
            </div>
          </div>
        `;
      }).join('');

      // Add click listener on cards to mark as read
      feed.querySelectorAll('.notif-card').forEach(card => {
        card.addEventListener('click', async () => {
          const id = card.getAttribute('data-id');
          const isUnread = card.getAttribute('data-unread') === '1';
          if (isUnread && id) {
            try {
              const r = await fetch(`/api/notifications.php?action=mark_read&id=${id}&pharmacy_id=${pharmacyId}`, { method: 'POST' });
              const j = await r.json();
              if (j.success) {
                card.classList.remove('unread');
                card.setAttribute('data-unread', '0');
                const dot = card.querySelector('.notif-unread-dot');
                if (dot) dot.remove();
                updateSidebarNotifBadge();
              }
            } catch (e) {}
          }
        });
      });

    } catch (err) {
      if (feed) feed.innerHTML = `<div class="notif-empty-state"><p>Error connecting to notifications service.</p></div>`;
    }
  };

  // Notification Filter Tab Clicks
  const tabNotifAll = document.getElementById('notif-tab-all');
  const tabNotifUnread = document.getElementById('notif-tab-unread');

  if (tabNotifAll && tabNotifUnread) {
    tabNotifAll.addEventListener('click', () => {
      tabNotifAll.classList.add('active');
      tabNotifUnread.classList.remove('active');
      loadAndRenderNotifications('all');
    });

    tabNotifUnread.addEventListener('click', () => {
      tabNotifUnread.classList.add('active');
      tabNotifAll.classList.remove('active');
      loadAndRenderNotifications('unread');
    });
  }

  // Scan Now Button
  const btnNotifScan = document.getElementById('btn-notif-scan');
  if (btnNotifScan) {
    btnNotifScan.addEventListener('click', async () => {
      const svg = btnNotifScan.querySelector('svg');
      if (svg) svg.classList.add('spinning');
      btnNotifScan.disabled = true;

      try {
        const res = await fetch(`/api/notifications.php?action=scan&pharmacy_id=${pharmacyId}`, { method: 'POST' });
        const json = await res.json();
        if (json.success) {
          showToast(`Scan complete: ${json.created_count || 0} alert(s) found.`);
          await loadAndRenderNotifications(currentNotifFilter);
        } else {
          showToast(json.message || 'Scan failed', true);
        }
      } catch (err) {
        showToast('Scan error: could not connect to server', true);
      } finally {
        if (svg) svg.classList.remove('spinning');
        btnNotifScan.disabled = false;
      }
    });
  }

  // Mark All Read Button
  const btnNotifMarkAll = document.getElementById('btn-notif-mark-all');
  if (btnNotifMarkAll) {
    btnNotifMarkAll.addEventListener('click', async () => {
      try {
        const res = await fetch(`/api/notifications.php?action=mark_all_read&pharmacy_id=${pharmacyId}`, { method: 'POST' });
        const json = await res.json();
        if (json.success) {
          showToast('All notifications marked as read.');
          await loadAndRenderNotifications(currentNotifFilter);
        } else {
          showToast(json.message || 'Failed to mark all as read', true);
        }
      } catch (err) {
        showToast('Error marking all as read', true);
      }
    });
  }

  // ==============================================
  // 16. USER PROFILE CONTROLLER (Matches Image 2)
  // ==============================================
  const loadAndRenderProfile = async () => {
    const inputName = document.getElementById('profile-input-name');
    const inputEmail = document.getElementById('profile-input-email');
    const inputPass = document.getElementById('profile-input-password');
    const roleBadge = document.getElementById('profile-role-text');

    if (inputPass) inputPass.value = '';

    const currentUserId = (sessionData && sessionData.id) || 0;
    const currentUserEmail = (sessionData && sessionData.email) || '';

    try {
      const res = await fetch(`/api/profile.php?pharmacy_id=${pharmacyId}&user_id=${currentUserId}&email=${encodeURIComponent(currentUserEmail)}`);
      if (res.ok) {
        const json = await res.json();
        const u = json.data || json.user;
        if (json.success && u) {
          if (inputName) inputName.value = u.full_name || '';
          if (inputEmail) inputEmail.value = u.email || '';
          if (roleBadge) {
            const r = u.role || 'pharmacy_admin';
            roleBadge.textContent = r === 'pharmacy_admin' ? 'Pharmacy admin' : ucfirst(r.replace('_', ' '));
          }
          return;
        }
      }
    } catch (e) {}

    // Fallback to local sessionData
    if (sessionData) {
      if (inputName) inputName.value = sessionData.full_name || 'Pharmacy Admin';
      if (inputEmail) inputEmail.value = sessionData.email || 'admin@pharmacy.com';
      if (roleBadge) {
        const r = sessionData.role || 'pharmacy_admin';
        roleBadge.textContent = r === 'pharmacy_admin' ? 'Pharmacy admin' : ucfirst(r.replace('_', ' '));
      }
    }
  };

  // Profile Form Submit Handler
  const formProfile = document.getElementById('form-user-profile');
  if (formProfile) {
    formProfile.addEventListener('submit', async (e) => {
      e.preventDefault();
      const inputName = document.getElementById('profile-input-name');
      const inputEmail = document.getElementById('profile-input-email');
      const inputPass = document.getElementById('profile-input-password');
      const btnSubmit = document.getElementById('btn-save-profile');

      const name = inputName ? inputName.value.trim() : '';
      const email = inputEmail ? inputEmail.value.trim() : '';
      const password = inputPass ? inputPass.value : '';

      if (!name || !email) {
        showToast('Please fill in Name and Email', true);
        return;
      }

      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span>Updating...</span>';
      }

      const currentUserId = (sessionData && sessionData.id) || 0;
      const currentEmail = (sessionData && sessionData.email) || '';

      try {
        const res = await fetch(`/api/profile.php?action=update&pharmacy_id=${pharmacyId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, user_id: currentUserId, current_email: currentEmail })
        });
        const json = await res.json();

        if (json.success) {
          showToast('Profile updated successfully!');
          if (inputPass) inputPass.value = '';

          // Update local session
          sessionData.full_name = name;
          sessionData.email = email;
          try { localStorage.setItem('ezpharma_session', JSON.stringify(sessionData)); } catch (e) {}
          if (userDisplay) userDisplay.textContent = name;
        } else {
          showToast(json.message || json.error || 'Failed to update profile', true);
        }
      } catch (err) {
        showToast('Error saving profile changes', true);
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = '<span>Update Profile</span>';
        }
      }
    });
  }

  // 17. Initialize on Load
  loadPharmacySettings();
  updateAllCurrencyDisplays();
  updateSidebarNotifBadge();
  navigateTo(window.location.pathname, false);
});
