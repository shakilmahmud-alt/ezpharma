// EZ Pharma Application Logic & Interactivity
document.addEventListener('DOMContentLoaded', () => {
  // 1. Theme Management & Dynamic Logo Switching
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const htmlElement = document.documentElement;
  const brandLogoImg = document.getElementById('brand-logo-img');
  const footerLogoImg = document.getElementById('footer-logo-img');

  const LOGO_LIGHT = 'assets/logo-light.png';
  const LOGO_DARK = 'assets/logo-dark.png';

  const applyTheme = (theme) => {
    htmlElement.setAttribute('data-theme', theme);
    const logoSrc = theme === 'dark' ? LOGO_DARK : LOGO_LIGHT;
    
    if (brandLogoImg) brandLogoImg.src = logoSrc;
    if (footerLogoImg) footerLogoImg.src = logoSrc;
  };

  // Retrieve stored theme or fallback to system preference
  const savedTheme = localStorage.getItem('ezpharma-theme');
  const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme) {
    applyTheme(savedTheme);
  } else if (systemPrefersDark) {
    applyTheme('dark');
  } else {
    applyTheme('light');
  }

  // Toggle theme on button click
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const currentTheme = htmlElement.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      
      applyTheme(newTheme);
      localStorage.setItem('ezpharma-theme', newTheme);
    });
  }

  // 2. Testimonial Carousel
  const testimonials = [
    {
      initials: 'SJ',
      name: 'Dr. Sarah Johnson',
      role: 'Group Director, Regency Pharmacies',
      quote: '“We onboarded 14 pharmacies in two weeks. Each store has its own staff and inventory, but I get one platform dashboard with MRR, active subscriptions, and recent payments.”'
    },
    {
      initials: 'AR',
      name: 'Dr. Arifur Rahman',
      role: 'Managing Partner, MedPlus Dhaka',
      quote: '“The AI prescription processing and automatic drug interaction checks have eliminated dispensing errors across all our branches. Automated billing works flawlessly.”'
    },
    {
      initials: 'MC',
      name: 'Michael Chen, PharmD',
      role: 'Operations Head, Apex Care Network',
      quote: '“Tenant isolation gives our franchised stores peace of mind, while the super admin analytics give me instantaneous clarity on consolidated inventory and revenue.”'
    }
  ];

  let currentSlide = 0;
  const userAvatar = document.querySelector('.user-avatar-circle');
  const userName = document.querySelector('.user-name');
  const userRole = document.querySelector('.user-role');
  const testimonialQuote = document.querySelector('.testimonial-quote');
  const dots = document.querySelectorAll('.carousel-dots .dot');
  const prevBtn = document.querySelector('.prev-btn');
  const nextBtn = document.querySelector('.next-btn');

  const updateTestimonial = (index) => {
    if (!userName || !testimonialQuote) return;
    
    currentSlide = (index + testimonials.length) % testimonials.length;
    const data = testimonials[currentSlide];

    if (userAvatar) userAvatar.textContent = data.initials;
    userName.textContent = data.name;
    if (userRole) userRole.textContent = data.role;
    testimonialQuote.textContent = data.quote;

    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === currentSlide);
    });
  };

  if (prevBtn) {
    prevBtn.addEventListener('click', () => updateTestimonial(currentSlide - 1));
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => updateTestimonial(currentSlide + 1));
  }

  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => updateTestimonial(index));
  });
});
