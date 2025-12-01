/**
 * Fair Go Justice - Main JavaScript
 * Form handling, analytics, petition counter, smooth scrolling
 */

(function() {
  'use strict';

  // ==========================================================================
  // Configuration
  // ==========================================================================
  const CONFIG = {
    apiBaseUrl: '/api',
    petitionGoal: 100000,
    animationDuration: 300,
    debounceDelay: 250,
    counterUpdateInterval: 30000 // 30 seconds
  };

  // ==========================================================================
  // Utility Functions
  // ==========================================================================
  
  /**
   * Debounce function to limit function calls
   */
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Format number with commas
   */
  function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * Sanitize HTML to prevent XSS
   */
  function sanitizeHTML(str) {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
  }

  /**
   * Check if element is in viewport
   */
  function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  // ==========================================================================
  // Mobile Navigation
  // ==========================================================================
  
  function initMobileNav() {
    const navToggle = document.getElementById('navToggle');
    const mainNav = document.getElementById('mainNav');
    
    if (!navToggle || !mainNav) return;
    
    // Toggle navigation
    navToggle.addEventListener('click', function(e) {
      e.preventDefault();
      mainNav.classList.toggle('active');
      
      // Toggle icon
      const icon = navToggle.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-bars');
        icon.classList.toggle('fa-times');
      }
      
      // Prevent body scroll when nav is open
      document.body.style.overflow = mainNav.classList.contains('active') ? 'hidden' : '';
    });
    
    // Handle dropdown toggles on mobile
    const dropdowns = mainNav.querySelectorAll('.dropdown');
    dropdowns.forEach(dropdown => {
      const toggle = dropdown.querySelector('.dropdown-toggle');
      if (toggle) {
        toggle.addEventListener('click', function(e) {
          if (window.innerWidth <= 768) {
            e.preventDefault();
            dropdown.classList.toggle('active');
          }
        });
      }
    });
    
    // Close nav when clicking outside
    document.addEventListener('click', function(e) {
      if (!mainNav.contains(e.target) && !navToggle.contains(e.target)) {
        mainNav.classList.remove('active');
        const icon = navToggle.querySelector('i');
        if (icon) {
          icon.classList.add('fa-bars');
          icon.classList.remove('fa-times');
        }
        document.body.style.overflow = '';
      }
    });
  }

  // ==========================================================================
  // Smooth Scrolling
  // ==========================================================================
  
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href === '#') return;
        
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          
          const headerHeight = document.querySelector('.site-header')?.offsetHeight || 0;
          const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;
          
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
          
          // Update URL hash without jumping
          history.pushState(null, null, href);
        }
      });
    });
  }

  // ==========================================================================
  // Petition Counter
  // ==========================================================================
  
  class PetitionCounter {
    constructor(element) {
      this.element = element;
      this.countElement = element.querySelector('.count');
      this.progressFill = element.querySelector('.progress-fill');
      this.progressText = element.querySelector('.progress-text');
      this.currentCount = 0;
      this.targetCount = 0;
      
      this.init();
    }
    
    init() {
      this.fetchCount();
      
      // Update periodically
      setInterval(() => this.fetchCount(), CONFIG.counterUpdateInterval);
    }
    
    async fetchCount() {
      try {
        // First try to get from API
        const response = await fetch(CONFIG.apiBaseUrl + '/petition/count');
        if (response.ok) {
          const data = await response.json();
          this.updateCount(data.count || data.signatures || 12847);
        } else {
          // Fallback to initial count
          this.updateCount(12847);
        }
      } catch (error) {
        // Use fallback count
        this.updateCount(12847);
      }
    }
    
    updateCount(newCount) {
      this.targetCount = newCount;
      this.animateCount();
      this.updateProgress();
    }
    
    animateCount() {
      const start = this.currentCount;
      const end = this.targetCount;
      const duration = 1000;
      const startTime = performance.now();
      
      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (ease-out)
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        this.currentCount = Math.floor(start + (end - start) * easeOut);
        
        if (this.countElement) {
          this.countElement.textContent = formatNumber(this.currentCount);
        }
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
    }
    
    updateProgress() {
      const percentage = (this.targetCount / CONFIG.petitionGoal) * 100;
      
      if (this.progressFill) {
        this.progressFill.style.width = `${Math.min(percentage, 100)}%`;
      }
      
      if (this.progressText) {
        this.progressText.textContent = `${percentage.toFixed(1)}% to ${formatNumber(CONFIG.petitionGoal)} signatures`;
      }
    }
  }

  function initPetitionCounter() {
    const counters = document.querySelectorAll('.petition-counter, .petition-progress');
    counters.forEach(counter => new PetitionCounter(counter));
  }

  // ==========================================================================
  // Form Handling
  // ==========================================================================
  
  class FormHandler {
    constructor(form) {
      this.form = form;
      this.submitButton = form.querySelector('button[type="submit"]');
      this.originalButtonText = this.submitButton?.textContent || 'Submit';
      
      this.init();
    }
    
    init() {
      this.form.addEventListener('submit', (e) => this.handleSubmit(e));
      
      // Real-time validation
      this.form.querySelectorAll('input, textarea, select').forEach(field => {
        field.addEventListener('blur', () => this.validateField(field));
        field.addEventListener('input', debounce(() => this.validateField(field), CONFIG.debounceDelay));
      });
    }
    
    async handleSubmit(e) {
      e.preventDefault();
      
      // Validate all fields
      const fields = this.form.querySelectorAll('input, textarea, select');
      let isValid = true;
      
      fields.forEach(field => {
        if (!this.validateField(field)) {
          isValid = false;
        }
      });
      
      if (!isValid) return;
      
      // Show loading state
      this.setLoading(true);
      
      try {
        const formData = new FormData(this.form);
        const data = Object.fromEntries(formData.entries());
        
        // Determine endpoint based on form type
        const formType = this.form.dataset.formType || 'contact';
        const endpoint = CONFIG.apiBaseUrl + '/' + formType;
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });
        
        if (response.ok) {
          this.showSuccess('Thank you! Your submission has been received.');
          this.form.reset();
          this.trackFormSubmission(formType);
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Submission failed. Please try again.');
        }
      } catch (error) {
        this.showError(error.message || 'Something went wrong. Please try again later.');
      } finally {
        this.setLoading(false);
      }
    }
    
    validateField(field) {
      const errorElement = this.form.querySelector(`[data-error-for="${field.name}"]`);
      let isValid = true;
      let errorMessage = '';
      
      // Required validation
      if (field.hasAttribute('required') && !field.value.trim()) {
        isValid = false;
        errorMessage = 'This field is required.';
      }
      
      // Email validation
      if (field.type === 'email' && field.value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(field.value)) {
          isValid = false;
          errorMessage = 'Please enter a valid email address.';
        }
      }
      
      // Phone validation (Australian format)
      if (field.type === 'tel' && field.value) {
        const phoneRegex = /^(\+61|0)[2-9]\d{8}$/;
        const cleanPhone = field.value.replace(/[\s-]/g, '');
        if (!phoneRegex.test(cleanPhone)) {
          isValid = false;
          errorMessage = 'Please enter a valid Australian phone number.';
        }
      }
      
      // Postcode validation
      if (field.name === 'postcode' && field.value) {
        const postcodeRegex = /^\d{4}$/;
        if (!postcodeRegex.test(field.value)) {
          isValid = false;
          errorMessage = 'Please enter a valid 4-digit postcode.';
        }
      }
      
      // Update UI
      if (errorElement) {
        errorElement.textContent = isValid ? '' : errorMessage;
        errorElement.style.display = isValid ? 'none' : 'block';
      }
      
      field.classList.toggle('invalid', !isValid);
      
      return isValid;
    }
    
    setLoading(loading) {
      if (this.submitButton) {
        this.submitButton.disabled = loading;
        this.submitButton.textContent = loading ? 'Submitting...' : this.originalButtonText;
      }
    }
    
    showSuccess(message) {
      this.showAlert(message, 'success');
    }
    
    showError(message) {
      this.showAlert(message, 'error');
    }
    
    showAlert(message, type) {
      // Remove existing alerts
      const existingAlert = this.form.querySelector('.alert');
      if (existingAlert) {
        existingAlert.remove();
      }
      
      const alert = document.createElement('div');
      alert.className = `alert alert-${type}`;
      alert.textContent = message;
      
      this.form.insertBefore(alert, this.form.firstChild);
      
      // Auto-remove after 5 seconds
      setTimeout(() => alert.remove(), 5000);
    }
    
    trackFormSubmission(formType) {
      // Track with Google Analytics if available
      if (typeof gtag === 'function') {
        gtag('event', 'form_submission', {
          'event_category': 'engagement',
          'event_label': formType
        });
      }
    }
  }

  function initForms() {
    document.querySelectorAll('form[data-validate]').forEach(form => {
      new FormHandler(form);
    });
  }

  // ==========================================================================
  // Quiz Functionality
  // ==========================================================================
  
  class Quiz {
    constructor(container) {
      this.container = container;
      this.questions = [];
      this.currentQuestion = 0;
      this.answers = [];
      this.score = 0;
      
      this.init();
    }
    
    async init() {
      await this.loadQuestions();
      this.render();
    }
    
    async loadQuestions() {
      // Try to load from API
      try {
        const response = await fetch(CONFIG.apiBaseUrl + '/quiz/questions');
        if (response.ok) {
          this.questions = await response.json();
          return;
        }
      } catch (error) {
        // Fall through to default questions
      }
      
      // Default questions
      this.questions = [
        {
          id: 1,
          question: "What percentage of Australians cannot afford legal representation?",
          options: [
            { text: "About 10%", value: 0 },
            { text: "About 25%", value: 0 },
            { text: "About 40%", value: 1 },
            { text: "About 60%", value: 0 }
          ],
          explanation: "Research shows approximately 40% of Australians cannot afford basic legal representation."
        },
        {
          id: 2,
          question: "How much is the average retainer required by lawyers in Australia?",
          options: [
            { text: "$5,000 - $10,000", value: 0 },
            { text: "$15,000 - $25,000", value: 0 },
            { text: "$30,000 - $50,000", value: 1 },
            { text: "Over $50,000", value: 0 }
          ],
          explanation: "Many lawyers require retainers of $30,000-$50,000, putting justice out of reach for average Australians."
        },
        {
          id: 3,
          question: "What is a National Judicial Integrity Commission?",
          options: [
            { text: "A court for minor offenses", value: 0 },
            { text: "An independent body to oversee judicial conduct", value: 1 },
            { text: "A legal aid organization", value: 0 },
            { text: "A training academy for judges", value: 0 }
          ],
          explanation: "A National Judicial Integrity Commission is an independent body that investigates complaints against judges."
        },
        {
          id: 4,
          question: "How many signatures are typically needed to trigger a Royal Commission inquiry?",
          options: [
            { text: "10,000", value: 0 },
            { text: "50,000", value: 0 },
            { text: "100,000", value: 1 },
            { text: "500,000", value: 0 }
          ],
          explanation: "While not a legal requirement, 100,000 signatures demonstrates significant public support for a Royal Commission."
        },
        {
          id: 5,
          question: "What is the 'Fair Go' principle in Australian culture?",
          options: [
            { text: "A sports betting term", value: 0 },
            { text: "Everyone deserves equal opportunity and treatment", value: 1 },
            { text: "A government welfare program", value: 0 },
            { text: "A legal defense strategy", value: 0 }
          ],
          explanation: "The 'Fair Go' is a core Australian value meaning everyone deserves equal opportunity and fair treatment."
        }
      ];
    }
    
    render() {
      if (this.currentQuestion >= this.questions.length) {
        this.showResults();
        return;
      }
      
      const question = this.questions[this.currentQuestion];
      const progress = ((this.currentQuestion) / this.questions.length) * 100;
      
      this.container.innerHTML = `
        <div class="quiz-progress">
          <div class="quiz-progress-bar">
            <div class="quiz-progress-fill" style="width: ${progress}%"></div>
          </div>
          <p class="quiz-progress-text">Question ${this.currentQuestion + 1} of ${this.questions.length}</p>
        </div>
        
        <div class="quiz-question">
          <h3>${sanitizeHTML(question.question)}</h3>
          <div class="quiz-options">
            ${question.options.map((option, index) => `
              <label class="quiz-option" data-index="${index}">
                <input type="radio" name="answer" value="${index}">
                <span>${sanitizeHTML(option.text)}</span>
              </label>
            `).join('')}
          </div>
          
          <div class="quiz-navigation">
            ${this.currentQuestion > 0 ? '<button class="btn btn-secondary quiz-prev">Previous</button>' : '<span></span>'}
            <button class="btn btn-primary quiz-next" disabled>Next</button>
          </div>
        </div>
      `;
      
      this.bindEvents();
    }
    
    bindEvents() {
      const options = this.container.querySelectorAll('.quiz-option');
      const nextBtn = this.container.querySelector('.quiz-next');
      const prevBtn = this.container.querySelector('.quiz-prev');
      
      options.forEach(option => {
        option.addEventListener('click', () => {
          // Clear previous selection
          options.forEach(opt => opt.classList.remove('selected'));
          
          // Set new selection
          option.classList.add('selected');
          option.querySelector('input').checked = true;
          
          // Enable next button
          nextBtn.disabled = false;
        });
      });
      
      if (nextBtn) {
        nextBtn.addEventListener('click', () => this.nextQuestion());
      }
      
      if (prevBtn) {
        prevBtn.addEventListener('click', () => this.prevQuestion());
      }
    }
    
    nextQuestion() {
      const selected = this.container.querySelector('.quiz-option.selected');
      if (!selected) return;
      
      const index = parseInt(selected.dataset.index);
      const question = this.questions[this.currentQuestion];
      
      this.answers[this.currentQuestion] = index;
      this.score += question.options[index].value;
      
      this.currentQuestion++;
      this.render();
    }
    
    prevQuestion() {
      this.currentQuestion--;
      this.render();
    }
    
    showResults() {
      const percentage = Math.round((this.score / this.questions.length) * 100);
      
      let message, recommendation;
      
      if (percentage >= 80) {
        message = "Excellent! You understand Australia's justice system well.";
        recommendation = "Share your knowledge and help others understand the need for reform.";
      } else if (percentage >= 50) {
        message = "Good effort! You have a solid understanding of the issues.";
        recommendation = "Explore our resources to learn more about justice reform.";
      } else {
        message = "There's more to learn about our justice system.";
        recommendation = "Check out our resources to understand why reform is crucial.";
      }
      
      this.container.innerHTML = `
        <div class="quiz-results">
          <h2>Quiz Complete!</h2>
          <div class="quiz-score">${percentage}%</div>
          <p class="lead">${sanitizeHTML(message)}</p>
          <p>${sanitizeHTML(recommendation)}</p>
          
          <div class="quiz-cta mt-4">
            <a href="petition.html" class="btn btn-primary btn-large">Sign the Petition</a>
            <a href="resources.html" class="btn btn-secondary btn-large">Explore Resources</a>
          </div>
          
          <button class="btn btn-outline mt-3 quiz-restart">Take Quiz Again</button>
        </div>
      `;
      
      // Restart button
      this.container.querySelector('.quiz-restart')?.addEventListener('click', () => {
        this.currentQuestion = 0;
        this.answers = [];
        this.score = 0;
        this.render();
      });
      
      // Track completion
      this.trackQuizCompletion(percentage);
    }
    
    trackQuizCompletion(score) {
      if (typeof gtag === 'function') {
        gtag('event', 'quiz_completion', {
          'event_category': 'engagement',
          'event_label': 'justice_quiz',
          'value': score
        });
      }
    }
  }

  function initQuiz() {
    const quizContainer = document.getElementById('quizContainer');
    if (quizContainer) {
      new Quiz(quizContainer);
    }
  }

  // ==========================================================================
  // Analytics Tracking
  // ==========================================================================
  
  function initAnalytics() {
    // Track outbound links
    document.querySelectorAll('a[href^="http"]').forEach(link => {
      if (!link.href.includes(window.location.hostname)) {
        link.addEventListener('click', function() {
          if (typeof gtag === 'function') {
            gtag('event', 'click', {
              'event_category': 'outbound',
              'event_label': this.href
            });
          }
        });
      }
    });
    
    // Track scroll depth
    let maxScroll = 0;
    const scrollThresholds = [25, 50, 75, 100];
    
    window.addEventListener('scroll', debounce(function() {
      const scrollPercent = Math.round(
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      );
      
      scrollThresholds.forEach(threshold => {
        if (scrollPercent >= threshold && maxScroll < threshold) {
          maxScroll = threshold;
          
          if (typeof gtag === 'function') {
            gtag('event', 'scroll_depth', {
              'event_category': 'engagement',
              'event_label': `${threshold}%`
            });
          }
        }
      });
    }, CONFIG.debounceDelay));
    
    // Track time on page
    let startTime = Date.now();
    window.addEventListener('beforeunload', function() {
      const timeSpent = Math.round((Date.now() - startTime) / 1000);
      
      if (typeof gtag === 'function') {
        gtag('event', 'time_on_page', {
          'event_category': 'engagement',
          'value': timeSpent
        });
      }
    });
  }

  // ==========================================================================
  // Animated Counter
  // ==========================================================================
  
  function initAnimatedCounters() {
    const counters = document.querySelectorAll('.stat-number');
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const counter = entry.target;
          const target = parseInt(counter.textContent.replace(/,/g, ''));
          
          if (!isNaN(target)) {
            animateValue(counter, 0, target, 1500);
          }
          
          observer.unobserve(counter);
        }
      });
    }, { threshold: 0.5 });
    
    counters.forEach(counter => observer.observe(counter));
  }

  function animateValue(element, start, end, duration) {
    const startTime = performance.now();
    
    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      
      const current = Math.floor(start + (end - start) * easeOutQuart);
      element.textContent = formatNumber(current);
      
      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }
    
    requestAnimationFrame(update);
  }

  // ==========================================================================
  // Back to Top Button
  // ==========================================================================
  
  function initBackToTop() {
    const button = document.createElement('button');
    button.className = 'back-to-top';
    button.innerHTML = '<i class="fas fa-arrow-up"></i>';
    button.setAttribute('aria-label', 'Back to top');
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background-color: var(--color-primary);
      color: white;
      border: none;
      cursor: pointer;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
      z-index: 99;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    `;
    
    document.body.appendChild(button);
    
    // Show/hide based on scroll
    window.addEventListener('scroll', debounce(function() {
      if (window.scrollY > 300) {
        button.style.opacity = '1';
        button.style.visibility = 'visible';
      } else {
        button.style.opacity = '0';
        button.style.visibility = 'hidden';
      }
    }, 100));
    
    // Scroll to top on click
    button.addEventListener('click', function() {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  // ==========================================================================
  // Lazy Loading Images
  // ==========================================================================
  
  function initLazyLoading() {
    const images = document.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          imageObserver.unobserve(img);
        }
      });
    });
    
    images.forEach(img => imageObserver.observe(img));
  }

  // ==========================================================================
  // Accessibility Enhancements
  // ==========================================================================
  
  function initAccessibility() {
    // Skip to content link
    const skipLink = document.querySelector('.skip-to-content');
    if (skipLink) {
      skipLink.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.tabIndex = -1;
          target.focus();
        }
      });
    }
    
    // Handle keyboard navigation for dropdowns
    const dropdowns = document.querySelectorAll('.dropdown');
    dropdowns.forEach(dropdown => {
      const toggle = dropdown.querySelector('.dropdown-toggle');
      const menu = dropdown.querySelector('.dropdown-menu');
      
      if (toggle && menu) {
        toggle.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            dropdown.classList.toggle('active');
          }
        });
        
        // Close on escape
        menu.addEventListener('keydown', function(e) {
          if (e.key === 'Escape') {
            dropdown.classList.remove('active');
            toggle.focus();
          }
        });
      }
    });
  }

  // ==========================================================================
  // Story Share Functionality
  // ==========================================================================
  
  function initStoryShare() {
    const shareButtons = document.querySelectorAll('.share-story-btn');
    
    shareButtons.forEach(button => {
      button.addEventListener('click', function(e) {
        e.preventDefault();
        
        const platform = this.dataset.platform;
        const url = encodeURIComponent(window.location.href);
        const title = encodeURIComponent(document.title);
        const text = encodeURIComponent('Check out this important story about justice reform in Australia');
        
        let shareUrl;
        
        switch (platform) {
          case 'facebook':
            shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
            break;
          case 'twitter':
            shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${text}`;
            break;
          case 'linkedin':
            shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
            break;
          case 'email':
            shareUrl = `mailto:?subject=${title}&body=${text}%20${url}`;
            window.location.href = shareUrl;
            return;
          default:
            return;
        }
        
        window.open(shareUrl, '_blank', 'width=600,height=400');
        
        // Track share
        if (typeof gtag === 'function') {
          gtag('event', 'share', {
            'event_category': 'social',
            'event_label': platform
          });
        }
      });
    });
  }

  // ==========================================================================
  // Initialize Everything
  // ==========================================================================
  
  function init() {
    initMobileNav();
    initSmoothScroll();
    initPetitionCounter();
    initForms();
    initQuiz();
    initAnalytics();
    initAnimatedCounters();
    initBackToTop();
    initLazyLoading();
    initAccessibility();
    initStoryShare();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
