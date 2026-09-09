// EZ Pharma - Signup Page Logic
document.addEventListener('DOMContentLoaded', () => {
  // 1. Theme Management
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const htmlElement = document.documentElement;
  const brandLogoImg = document.getElementById('brand-logo-img');

  const LOGO_LIGHT = 'assets/logo-light.png';
  const LOGO_DARK = 'assets/logo-dark.png';

  const applyTheme = (theme) => {
    htmlElement.setAttribute('data-theme', theme);
    const logoSrc = theme === 'dark' ? LOGO_DARK : LOGO_LIGHT;
    if (brandLogoImg) brandLogoImg.src = logoSrc;
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

  // 2. Plan Selection Logic
  const planMonthly = document.getElementById('plan-monthly');
  const planYearly = document.getElementById('plan-yearly');
  const selectedPlanInput = document.getElementById('selected_plan');
  const btnText = document.getElementById('btn-text');

  const selectPlan = (plan) => {
    selectedPlanInput.value = plan;
    if (plan === 'yearly') {
      planYearly.classList.add('active');
      planMonthly.classList.remove('active');
      btnText.textContent = 'Continue to payment • BDT 4,500';
    } else {
      planMonthly.classList.add('active');
      planYearly.classList.remove('active');
      btnText.textContent = 'Continue to payment • BDT 400';
    }
  };

  if (planMonthly) {
    planMonthly.addEventListener('click', () => selectPlan('monthly'));
  }
  if (planYearly) {
    planYearly.addEventListener('click', () => selectPlan('yearly'));
  }

  // Check URL query parameters for pre-selected plan
  const urlParams = new URLSearchParams(window.location.search);
  const planParam = urlParams.get('plan');
  if (planParam === 'yearly') {
    selectPlan('yearly');
  } else {
    selectPlan('monthly');
  }

  // 3. Form Submission & API Integration
  const signupForm = document.getElementById('signup-form');
  const submitBtn = document.getElementById('submit-btn');
  const btnSpinner = document.getElementById('btn-spinner');
  const btnArrow = submitBtn.querySelector('.btn-arrow');
  const alertBox = document.getElementById('alert-box');

  const showAlert = (message, type = 'error') => {
    alertBox.textContent = message;
    alertBox.className = `alert-box alert-${type}`;
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const clearAlert = () => {
    alertBox.textContent = '';
    alertBox.className = 'alert-box hidden';
  };

  const setLoading = (loading) => {
    submitBtn.disabled = loading;
    if (loading) {
      btnSpinner.classList.remove('hidden');
      btnArrow.classList.add('hidden');
    } else {
      btnSpinner.classList.add('hidden');
      btnArrow.classList.remove('hidden');
    }
  };

  // API Endpoints: Primary cPanel Live endpoint, with local fallback
  const PRIMARY_API_URL = 'https://api.holidaymartbd.com/ezpharma/signup.php';
  const LOCAL_API_URL = '/api/signup.php';

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();

    const pharmacy_name = document.getElementById('pharmacy_name').value.trim();
    const address = document.getElementById('address').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const full_name = document.getElementById('full_name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const plan = selectedPlanInput.value;
    const terms_agreed = document.getElementById('terms_agreed').checked;

    // Validation
    if (!pharmacy_name) {
      showAlert('Please enter your Pharmacy Name.');
      document.getElementById('pharmacy_name').focus();
      return;
    }
    if (!full_name) {
      showAlert('Please enter your Admin Full Name.');
      document.getElementById('full_name').focus();
      return;
    }
    if (!email || !email.includes('@')) {
      showAlert('Please enter a valid email address.');
      document.getElementById('email').focus();
      return;
    }
    if (!password || password.length < 6) {
      showAlert('Password must be at least 6 characters long.');
      document.getElementById('password').focus();
      return;
    }
    if (!terms_agreed) {
      showAlert('You must agree to the Terms of Service & Privacy Policy.');
      return;
    }

    const payload = {
      pharmacy_name,
      address,
      phone,
      full_name,
      email,
      password,
      plan,
      terms_agreed
    };

    setLoading(true);

    try {
      let response;
      let data;

      try {
        // Try live cPanel API first
        response = await fetch(PRIMARY_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        data = await response.json();
      } catch (err) {
        // Fallback to local API
        console.warn('Live API unavailable or CORS blocked, attempting local API fallback...', err);
        response = await fetch(LOCAL_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        data = await response.json();
      }

      if (data && data.success) {
        showAlert(`🎉 Account created for "${pharmacy_name}"! Redirecting to your pharmacy dashboard...`, 'success');
        
        // Save session locally for instant dynamic dashboard rendering
        const registeredUser = {
          id: data.data?.user_id || Date.now(),
          full_name: full_name,
          email: email,
          role: 'pharmacy_admin',
          pharmacy_id: data.data?.id || data.data?.pharmacy_id || Date.now(),
          pharmacy_name: pharmacy_name,
          pharmacy_slug: data.data?.slug || pharmacy_name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          plan: plan,
          status: 'pending_payment',
          payment_status: 'pending_payment'
        };

        localStorage.setItem('ezpharma_session', JSON.stringify(registeredUser));
        localStorage.setItem('ezpharma_current_pharmacy', JSON.stringify({
          id: registeredUser.pharmacy_id,
          name: pharmacy_name,
          owner_email: email,
          status: 'pending_payment'
        }));

        // Also add to local registered list for admin view
        try {
          const raw = localStorage.getItem('ezpharma_local_pharmacies');
          const list = raw ? JSON.parse(raw) : [];
          list.unshift({
            id: registeredUser.pharmacy_id,
            name: pharmacy_name,
            slug: registeredUser.pharmacy_slug,
            address: address,
            phone: phone,
            owner_name: full_name,
            owner_email: email,
            plan: plan,
            status: 'pending_payment',
            created_at: new Date().toISOString()
          });
          localStorage.setItem('ezpharma_local_pharmacies', JSON.stringify(list));
        } catch (err) {}

        signupForm.reset();
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1200);
      } else {
        showAlert(data.message || 'Signup failed. Please try again.');
      }
    } catch (error) {
      console.error('Signup error:', error);
      showAlert('Could not connect to API server. If you just created the cPanel folder, please upload the PHP files from /api folder to api.holidaymartbd.com/ezpharma/.');
    } finally {
      setLoading(false);
    }
  });
});
