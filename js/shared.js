/* ===== ShareSchool — Shared Functionality ===== */

// ===== Progress Tracking =====
const ShareSchool = {
  MODULES: [
    { id: 'm1', title: 'What Is the Stock Market?', url: '/modules/what-is-the-stock-market.html', free: true },
    { id: 'm2', title: 'Key Metrics', url: '/modules/key-metrics.html', free: true },
    { id: 'm3', title: 'How Trading Works', url: '/modules/how-trading-works.html', free: true },
    { id: 'm4', title: 'Reading Stock Charts', url: '/modules/reading-charts.html', free: true },
    { id: 'm5', title: 'Risk & Diversification', url: '/modules/risk-and-diversification.html', free: false },
    { id: 'm6', title: 'Costs & Taxes', url: '/modules/costs-and-taxes.html', free: false },
    { id: 'm7', title: 'Investor Psychology', url: '/modules/investor-psychology.html', free: false },
    { id: 'm8', title: 'Strategy & Next Steps', url: '/modules/strategy-and-next-steps.html', free: false },
  ],

  // Get progress from localStorage
  getProgress() {
    try {
      return JSON.parse(localStorage.getItem('shareschool_progress') || '{}');
    } catch { return {}; }
  },

  // Save progress
  saveProgress(progress) {
    localStorage.setItem('shareschool_progress', JSON.stringify(progress));
  },

  // Mark knowledge point as read
  markRead(moduleId, kpId) {
    const progress = this.getProgress();
    if (!progress[moduleId]) progress[moduleId] = { read: [], quizPassed: false };
    if (!progress[moduleId].read.includes(kpId)) {
      progress[moduleId].read.push(kpId);
    }
    this.saveProgress(progress);
    this.updateUI(moduleId);
  },

  // Mark quiz passed
  markQuizPassed(moduleId) {
    const progress = this.getProgress();
    if (!progress[moduleId]) progress[moduleId] = { read: [], quizPassed: false };
    progress[moduleId].quizPassed = true;
    this.saveProgress(progress);
    this.updateUI(moduleId);
    this.triggerConfetti();
  },

  // Get module completion %
  getModuleProgress(moduleId, totalKps) {
    const progress = this.getProgress();
    if (!progress[moduleId]) return 0;
    const readCount = progress[moduleId].read.length;
    const quizBonus = progress[moduleId].quizPassed ? 1 : 0;
    return Math.min(100, Math.round(((readCount + quizBonus) / (totalKps + 1)) * 100));
  },

  // Get overall completion
  getOverallProgress() {
    const progress = this.getProgress();
    let completed = 0;
    this.MODULES.forEach(m => {
      if (progress[m.id] && progress[m.id].quizPassed) completed++;
    });
    return { completed, total: this.MODULES.length };
  },

  // Update sidebar icons to reflect read/active state
  updateSidebar(moduleId) {
    if (!moduleId) return;
    const progress = this.getProgress();
    const readKps = (progress[moduleId] && progress[moduleId].read) || [];
    const activeItem = document.querySelector('.sidebar-item.active');
    const activeKp = activeItem ? activeItem.dataset.kp : null;

    document.querySelectorAll('.sidebar-item[data-kp]').forEach(item => {
      const kp = item.dataset.kp;
      const icon = item.querySelector('.sidebar-icon');
      if (!icon) return;
      icon.className = 'sidebar-icon';
      if (readKps.includes(kp)) {
        icon.classList.add('done');
        icon.innerHTML = '&#10003;';
      } else if (kp === activeKp) {
        icon.classList.add('active-icon');
        icon.innerHTML = '';
      } else {
        icon.classList.add('pending');
        icon.innerHTML = '';
      }
    });
  },

  // Update nav progress bar
  updateUI(moduleId) {
    const { completed, total } = this.getOverallProgress();
    const pct = Math.round((completed / total) * 100);
    const fill = document.querySelector('.nav-progress-fill');
    const text = document.querySelector('.nav-progress-text');
    if (fill) fill.style.width = pct + '%';
    if (text) text.textContent = `${completed}/${total} completed`;

    // Update index page module cards if present
    document.querySelectorAll('.module-card').forEach(card => {
      const mid = card.dataset.module;
      if (!mid) return;
      const totalKps = parseInt(card.dataset.totalKps || '6');
      const pctModule = this.getModuleProgress(mid, totalKps);
      const fill = card.querySelector('.card-progress-fill');
      if (fill) fill.style.width = pctModule + '%';
    });

    this.updateSidebar(moduleId || this._currentModuleId);
  },

  // ===== Email Gate =====
  isUnlocked() {
    return localStorage.getItem('shareschool_unlocked') === 'true';
  },

  unlock() {
    localStorage.setItem('shareschool_unlocked', 'true');
  },

  initEmailGate() {
    if (this.isUnlocked()) {
      // Remove gate, show content
      document.querySelectorAll('.email-gate-overlay').forEach(el => el.remove());
      document.querySelectorAll('.email-gate-blur').forEach(el => {
        el.classList.remove('email-gate-blur');
      });
      return;
    }

    document.querySelectorAll('.email-gate-form').forEach(form => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = form.querySelector('input[type="email"]');
        const email = input.value.trim();
        if (!email) return;

        // Submit to Formspree (replace with your form ID)
        const formId = 'xpwzgjkl'; // placeholder
        fetch(`https://formspree.io/f/${formId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, source: 'shareschool_unlock' })
        }).then(() => {
          this.unlock();
          const msg = form.parentElement.querySelector('.email-gate-msg');
          if (msg) { msg.style.display = 'block'; msg.textContent = 'Unlocked! Refreshing...'; }
          setTimeout(() => location.reload(), 800);
        }).catch(() => {
          // Still unlock on error (offline-friendly)
          this.unlock();
          location.reload();
        });
      });
    });
  },

  // ===== Quiz Engine =====
  initQuiz(moduleId, quizData) {
    const section = document.querySelector('.quiz-section');
    if (!section) return;

    let answered = 0;
    let correct = 0;
    const total = quizData.length;

    quizData.forEach((q, qi) => {
      const block = section.querySelectorAll('.quiz-question-block')[qi];
      if (!block) return;

      const options = block.querySelectorAll('.quiz-option');
      const feedback = block.querySelector('.quiz-feedback');

      options.forEach((opt, oi) => {
        opt.addEventListener('click', () => {
          if (opt.classList.contains('disabled')) return;

          answered++;
          const isCorrect = oi === q.answer;

          options.forEach(o => o.classList.add('disabled'));
          if (isCorrect) {
            opt.classList.add('correct');
            correct++;
            if (feedback) {
              feedback.textContent = q.explanation || 'Correct!';
              feedback.classList.add('correct-fb', 'show');
            }
          } else {
            opt.classList.add('wrong');
            options[q.answer].classList.add('correct');
            if (feedback) {
              feedback.textContent = q.explanation || 'Not quite.';
              feedback.classList.add('wrong-fb', 'show');
            }
          }

          // Check if quiz complete
          if (answered === total) {
            const result = section.querySelector('.quiz-result');
            if (result) {
              result.classList.add('show');
              const score = result.querySelector('.score');
              if (score) score.textContent = `${correct}/${total}`;
              if (correct === total) {
                this.markQuizPassed(moduleId);
              }
            }
          }
        });
      });
    });

    // Retry button
    const retryBtn = section.querySelector('.retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        section.querySelectorAll('.quiz-option').forEach(o => {
          o.classList.remove('correct', 'wrong', 'disabled');
        });
        section.querySelectorAll('.quiz-feedback').forEach(f => {
          f.classList.remove('show', 'correct-fb', 'wrong-fb');
        });
        const result = section.querySelector('.quiz-result');
        if (result) result.classList.remove('show');
        answered = 0;
        correct = 0;
      });
    }
  },

  // ===== Confetti =====
  triggerConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) {
      const c = document.createElement('canvas');
      c.id = 'confetti-canvas';
      document.body.appendChild(c);
      this._doConfetti(c);
    } else {
      this._doConfetti(canvas);
    }
  },

  _doConfetti(canvas) {
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles = [];
    const colors = ['#2eaa6e', '#5b8fd9', '#d4930d', '#b34dd1', '#e05c5c'];

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 100,
        w: 6 + Math.random() * 6,
        h: 4 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vy: 2 + Math.random() * 3,
        vx: (Math.random() - 0.5) * 3,
        rot: Math.random() * 360,
        rotV: (Math.random() - 0.5) * 10,
      });
    }

    let frame = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      particles.forEach(p => {
        p.y += p.vy;
        p.x += p.vx;
        p.rot += p.rotV;
        p.vy += 0.05;
        if (p.y < canvas.height + 20) alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      frame++;
      if (alive && frame < 180) {
        requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    animate();
  },

  // ===== Navigation Scroll Spy =====
  initScrollSpy(moduleId) {
    this._currentModuleId = moduleId;
    const kpCards = document.querySelectorAll('.kp-card[id]');
    const sidebarItems = document.querySelectorAll('.sidebar-item[data-kp]');
    if (!kpCards.length || !sidebarItems.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          sidebarItems.forEach(item => {
            item.classList.toggle('active', item.dataset.kp === id);
          });
          // 只更新侧边栏高亮，不 markRead——打勾由答对 quiz 触发
          this.updateSidebar(moduleId);
        }
      });
    }, { rootMargin: '-20% 0px -60% 0px' });

    kpCards.forEach(card => observer.observe(card));

    // Click to scroll
    sidebarItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.getElementById(item.dataset.kp);
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      });
    });
  },

  // ===== Mobile Nav Toggle =====
  initMobileNav() {
    const btn = document.querySelector('.nav-hamburger');
    const links = document.querySelector('.nav-links');
    if (!btn || !links) return;
    btn.addEventListener('click', () => {
      links.classList.toggle('open');
    });
  },

  // ===== Inline Quiz Engine =====
  initInlineQuiz(moduleId, inlineQuizData) {
    let firstTryCorrect = 0;
    let totalAnswered = 0;
    const total = inlineQuizData.length;

    // 恢复已答题的状态：已 markRead 的 KP，quiz 显示为已完成
    const progress = this.getProgress();
    const readKps = (progress[moduleId] && progress[moduleId].read) || [];

    inlineQuizData.forEach((q, qi) => {
      const container = document.querySelector(`.kp-check[data-kp="${q.kpId}"]`);
      if (!container) return;

      const options = container.querySelectorAll('.kp-check-opt');
      const feedback = container.querySelector('.kp-check-feedback');

      // 如果这个 KP 已经在上次答过，标记为已完成
      if (readKps.includes(q.kpId)) {
        container.classList.add('answered');
        options[q.answer].classList.add('correct');
        totalAnswered++;
        firstTryCorrect++; // 宽松处理：恢复时算首次正确
        if (feedback) {
          feedback.textContent = q.explanation || 'Correct!';
          feedback.className = 'kp-check-feedback show correct-fb';
        }
        return; // 跳过事件绑定
      }

      options.forEach((opt, oi) => {
        opt.addEventListener('click', () => {
          if (container.classList.contains('answered')) return;
          container.classList.add('answered');
          totalAnswered++;

          const isCorrect = oi === q.answer;
          if (isCorrect) {
            opt.classList.add('correct');
            firstTryCorrect++;
            // 答对才打勾——这是成就感的来源
            this.markRead(moduleId, q.kpId);
            if (feedback) {
              feedback.textContent = q.explanation || 'Correct!';
              feedback.className = 'kp-check-feedback show correct-fb';
            }
          } else {
            opt.classList.add('wrong');
            options[q.answer].classList.add('correct');
            // 答错也 markRead——看到解释后也算学到了
            this.markRead(moduleId, q.kpId);
            if (feedback) {
              feedback.textContent = q.explanation || 'Not quite.';
              feedback.className = 'kp-check-feedback show wrong-fb';
            }
          }

          // 全部答完后显示总结
          if (totalAnswered === total) {
            const completeSection = document.querySelector('.module-complete');
            if (completeSection) {
              completeSection.style.display = 'block';
              const scoreEl = completeSection.querySelector('.complete-score');
              if (scoreEl) scoreEl.textContent = `${firstTryCorrect}/${total} correct on first try`;
            }
            if (firstTryCorrect === total) {
              this.markQuizPassed(moduleId);
            }
          }
        });
      });
    });
  },

  // ===== Think First Component =====
  initThinkFirst() {
    document.querySelectorAll('.think-first').forEach(el => {
      const btn = el.querySelector('.think-reveal');
      const answer = el.querySelector('.think-answer');
      if (!btn || !answer) return;
      btn.addEventListener('click', () => {
        answer.hidden = !answer.hidden;
        btn.textContent = answer.hidden ? 'Tap to see the answer' : 'Hide answer';
      });
    });
  },

  // ===== Try It Calculator =====
  initTryIt() {
    document.querySelectorAll('.try-it').forEach(el => {
      const monthlyInput = el.querySelector('.try-input');
      const slider = el.querySelector('.try-slider');
      const yearsSpans = el.querySelectorAll('.try-years');
      const resultStrong = el.querySelector('.try-result-value');
      if (!monthlyInput || !slider || !resultStrong) return;

      const calculate = () => {
        const monthly = parseFloat(monthlyInput.value) || 0;
        const years = parseInt(slider.value) || 1;
        yearsSpans.forEach(s => s.textContent = years);
        // 复利公式: FV = PMT * (((1+r)^n - 1) / r)，r = 月利率, n = 总月数
        const r = 0.10 / 12; // 10% 年化 → 月利率
        const n = years * 12;
        const fv = monthly * ((Math.pow(1 + r, n) - 1) / r);
        resultStrong.textContent = '$' + Math.round(fv).toLocaleString('en-US');
      };

      monthlyInput.addEventListener('input', calculate);
      slider.addEventListener('input', calculate);
      calculate(); // 初始化
    });
  },

  // ===== Init =====
  init(options = {}) {
    this.initMobileNav();
    this._currentModuleId = options.moduleId;
    this.updateUI(options.moduleId);

    if (options.emailGate) {
      this.initEmailGate();
    }
    if (options.moduleId && options.totalKps) {
      this.initScrollSpy(options.moduleId);
    }
    // 新 inline quiz 优先，旧 quiz 作为 fallback
    if (options.moduleId && options.inlineQuizData) {
      this.initInlineQuiz(options.moduleId, options.inlineQuizData);
    } else if (options.moduleId && options.quizData) {
      this.initQuiz(options.moduleId, options.quizData);
    }
    this.initThinkFirst();
    this.initTryIt();
  }
};

// Auto-init on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  ShareSchool.initMobileNav();
  ShareSchool.updateUI();
});
