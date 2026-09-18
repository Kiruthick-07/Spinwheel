/* =========================================
   SPIN WHEEL — Main Application Script
   ========================================= */

(function () {
  'use strict';

  // ─── STATE ──────────────────────────────
  const state = {
    // Number mode
    minNumber: 1,
    maxNumber: 50,
    availableNumbers: [],
    selectedNumbers: [],
    remainingNumbers: [],
    roundResults: [],
    currentRound: 0,
    roundConfig: [25, 15, 7, 3, 1],
    selectionMode: 'progressive', // 'progressive' | 'independent'
    isSpinning: false,
    wheelGenerated: false,
    currentRoundSelections: [],
    currentRoundTarget: 0,
    eventComplete: false,

    // Team mode
    teams: [],
    selectedTeam: null,
    teamsLoaded: false,

    // UI
    currentPage: 'number', // 'number' | 'team'
    eventMode: false,
    soundEnabled: true,

    // Wheel animation
    wheelAngle: 0,
    wheelItems: [],
  };

  // ─── DOM REFS ──────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    // Pages
    numberPage: $('#numberPage'),
    teamPage: $('#teamPage'),
    navNumber: $('#navNumber'),
    navTeam: $('#navTeam'),

    // Number config
    minInput: $('#minNumber'),
    maxInput: $('#maxNumber'),
    modeSelect: $('#selectionMode'),
    roundsInput: $('#roundsConfig'),
    generateBtn: $('#generateBtn'),
    resetBtn: $('#resetBtn'),

    // Wheel
    wheelCanvas: $('#wheelCanvas'),
    wheelPointer: $('#wheelPointer'),
    wheelEmpty: $('#wheelEmpty'),
    spinBtn: $('#spinBtn'),
    nextRoundBtn: $('#nextRoundBtn'),
    resetEventBtn: $('#resetEventBtn'),

    // Info
    roundBadge: $('#roundBadge'),
    roundInfo: $('#roundInfo'),
    statTotal: $('#statTotal'),
    statSelected: $('#statSelected'),
    statRemaining: $('#statRemaining'),
    statRound: $('#statRound'),
    roundProgress: $('#roundProgress'),
    selectedNumbersList: $('#selectedNumbersList'),
    roundHistory: $('#roundHistory'),
    spinProgress: $('#spinProgress'),

    // Team mode
    teamTextarea: $('#teamTextarea'),
    loadTeamsBtn: $('#loadTeamsBtn'),
    teamWheelCanvas: $('#teamWheelCanvas'),
    teamWheelPointer: $('#teamWheelPointer'),
    teamWheelEmpty: $('#teamWheelEmpty'),
    teamSpinBtn: $('#teamSpinBtn'),
    resetTeamBtn: $('#resetTeamBtn'),
    teamCount: $('#teamCount'),
    teamList: $('#teamList'),
    teamStatTotal: $('#teamStatTotal'),
    teamStatSelected: $('#teamStatSelected'),

    // Result overlay
    resultOverlay: $('#resultOverlay'),
    resultRoundLabel: $('#resultRoundLabel'),
    resultSubtitle: $('#resultSubtitle'),
    resultContent: $('#resultContent'),
    resultCloseBtn: $('#resultCloseBtn'),

    // Confetti
    confettiCanvas: $('#confettiCanvas'),

    // Particles
    particleCanvas: $('#particleCanvas'),

    // Header controls
    soundToggle: $('#soundToggle'),
    eventModeBtn: $('#eventModeBtn'),

    // Confirm modal
    confirmModal: $('#confirmModal'),
    confirmTitle: $('#confirmTitle'),
    confirmMsg: $('#confirmMsg'),
    confirmYes: $('#confirmYes'),
    confirmNo: $('#confirmNo'),

    // Toast
    toastContainer: $('#toastContainer'),
  };

  // ─── AUDIO (Web Audio API) ─────────────
  let audioCtx = null;
  let audioInitialized = false;

  function initAudio() {
    if (audioInitialized) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioInitialized = true;
    } catch (e) {
      console.warn('Web Audio API not available');
    }
  }

  function playTone(freq, duration, type = 'sine', volume = 0.15) {
    if (!state.soundEnabled || !audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(volume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) { }
  }

  function playTickSound() {
    playTone(800 + Math.random() * 400, 0.05, 'square', 0.08);
  }

  function playSelectSound() {
    playTone(600, 0.15, 'sine', 0.2);
    setTimeout(() => playTone(900, 0.15, 'sine', 0.2), 100);
    setTimeout(() => playTone(1200, 0.2, 'sine', 0.2), 200);
  }

  function playWinnerSound() {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((n, i) => {
      setTimeout(() => playTone(n, 0.25, 'sine', 0.2), i * 120);
    });
  }

  function playSpinStartSound() {
    playTone(300, 0.3, 'sawtooth', 0.1);
  }

  // ─── TOAST NOTIFICATIONS ──────────────
  function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    dom.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ─── CONFIRMATION MODAL ───────────────
  function showConfirm(title, msg) {
    return new Promise((resolve) => {
      dom.confirmTitle.textContent = title;
      dom.confirmMsg.textContent = msg;
      dom.confirmModal.classList.add('show');
      const yes = () => { cleanup(); resolve(true); };
      const no = () => { cleanup(); resolve(false); };
      const cleanup = () => {
        dom.confirmModal.classList.remove('show');
        dom.confirmYes.removeEventListener('click', yes);
        dom.confirmNo.removeEventListener('click', no);
      };
      dom.confirmYes.addEventListener('click', yes);
      dom.confirmNo.addEventListener('click', no);
    });
  }

  // ─── PAGE NAVIGATION ─────────────────
  function switchPage(page) {
    state.currentPage = page;
    dom.numberPage.classList.toggle('active', page === 'number');
    dom.teamPage.classList.toggle('active', page === 'team');
    dom.navNumber.classList.toggle('active', page === 'number');
    dom.navTeam.classList.toggle('active', page === 'team');
  }

  // ─── NUMBER WHEEL — GENERATION ─────────
  function parseRoundsConfig(str) {
    const parts = str.split(/[,→>\-\s]+/).map(s => s.trim()).filter(s => s);
    const nums = parts.map(Number).filter(n => !isNaN(n) && n > 0 && Number.isInteger(n));
    return nums;
  }

  function validateAndGenerate() {
    const min = parseInt(dom.minInput.value, 10);
    const max = parseInt(dom.maxInput.value, 10);

    if (isNaN(min) || isNaN(max)) {
      showToast('Please enter valid numbers', 'error');
      return;
    }
    if (min < 0 || max < 0) {
      showToast('Numbers must be positive', 'error');
      return;
    }
    if (min >= max) {
      showToast('Minimum must be less than maximum', 'error');
      return;
    }

    const totalNumbers = max - min + 1;
    let rounds = parseRoundsConfig(dom.roundsInput.value);

    if (rounds.length === 0) {
      showToast('Please enter valid round configuration', 'error');
      return;
    }

    // Validate progressive mode
    if (state.selectionMode === 'progressive') {
      const totalNeeded = rounds.reduce((a, b) => a + b, 0);
      if (totalNeeded > totalNumbers) {
        showToast(`Total selections (${totalNeeded}) exceed available numbers (${totalNumbers}). Adjusting rounds.`, 'error');
        return;
      }
    } else {
      // Independent mode: each round must not exceed total
      for (const r of rounds) {
        if (r > totalNumbers) {
          showToast(`Round requires ${r} numbers but only ${totalNumbers} available`, 'error');
          return;
        }
      }
    }

    state.minNumber = min;
    state.maxNumber = max;
    state.roundConfig = rounds;
    state.availableNumbers = [];
    for (let i = min; i <= max; i++) state.availableNumbers.push(i);
    state.remainingNumbers = [...state.availableNumbers];
    state.selectedNumbers = [];
    state.roundResults = [];
    state.currentRound = 0;
    state.currentRoundSelections = [];
    state.currentRoundTarget = rounds[0];
    state.wheelGenerated = true;
    state.eventComplete = false;
    state.wheelItems = [...state.availableNumbers];

    drawNumberWheel(state.wheelItems, 0);
    updateNumberUI();
    showToast(`Wheel generated: ${totalNumbers} numbers`, 'success');

    dom.wheelEmpty.style.display = 'none';
    dom.wheelCanvas.style.display = 'block';
    dom.spinBtn.disabled = false;
  }

  // ─── DRAW NUMBER WHEEL ────────────────
  function drawNumberWheel(items, angle) {
    const canvas = dom.wheelCanvas;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const size = canvas.parentElement.clientWidth || 580;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 4;
    const count = items.length;

    if (count === 0) {
      ctx.clearRect(0, 0, size, size);
      return;
    }

    const sliceAngle = (2 * Math.PI) / count;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // Colors for segments
    const colors = [
      '#0d3a0d', '#0a2a0a', '#113311', '#082208',
      '#0f2f0f', '#071d07', '#143614', '#0b280b'
    ];

    for (let i = 0; i < count; i++) {
      const startAngle = i * sliceAngle;
      const endAngle = startAngle + sliceAngle;

      // Draw segment
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();

      // Segment border
      ctx.strokeStyle = 'rgba(0, 230, 118, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw text
      ctx.save();
      ctx.rotate(startAngle + sliceAngle / 2);

      const text = String(items[i]);
      let fontSize;
      if (count <= 10) fontSize = 24;
      else if (count <= 20) fontSize = 18;
      else if (count <= 40) fontSize = 14;
      else if (count <= 60) fontSize = 11;
      else if (count <= 100) fontSize = 9;
      else fontSize = 7;

      ctx.font = `bold ${fontSize}px 'Inter', sans-serif`;
      ctx.fillStyle = '#00e676';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const textRadius = radius * 0.7;
      ctx.fillText(text, textRadius, 0);
      ctx.restore();
    }

    // Center circle
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.15, 0, 2 * Math.PI);
    ctx.fillStyle = '#0a0a0a';
    ctx.fill();
    ctx.strokeStyle = '#00e676';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Outer ring glow
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(0, 230, 118, 0.3)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
  }

  // ─── DRAW TEAM WHEEL ──────────────────
  function drawTeamWheel(items, angle) {
    const canvas = dom.teamWheelCanvas;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const size = canvas.parentElement.clientWidth || 580;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 4;
    const count = items.length;

    if (count === 0) return;

    const sliceAngle = (2 * Math.PI) / count;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    const colors = [
      '#0d3a0d', '#0a2a0a', '#113311', '#082208',
      '#0f2f0f', '#071d07', '#143614', '#0b280b'
    ];

    for (let i = 0; i < count; i++) {
      const startAngle = i * sliceAngle;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 230, 118, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Team name text
      ctx.save();
      ctx.rotate(startAngle + sliceAngle / 2);

      const name = items[i];
      let fontSize;
      if (count <= 6) fontSize = 18;
      else if (count <= 12) fontSize = 15;
      else if (count <= 20) fontSize = 12;
      else if (count <= 35) fontSize = 10;
      else fontSize = 8;

      ctx.font = `bold ${fontSize}px 'Inter', sans-serif`;
      ctx.fillStyle = '#00e676';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const textRadius = radius * 0.65;
      // Truncate long names
      let displayName = name;
      const maxWidth = radius * 0.45;
      while (ctx.measureText(displayName).width > maxWidth && displayName.length > 3) {
        displayName = displayName.slice(0, -1);
      }
      if (displayName !== name) displayName += '…';

      ctx.fillText(displayName, textRadius, 0);
      ctx.restore();
    }

    // Center circle
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.15, 0, 2 * Math.PI);
    ctx.fillStyle = '#0a0a0a';
    ctx.fill();
    ctx.strokeStyle = '#00e676';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(0, 230, 118, 0.3)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
  }

  // ─── SPIN ANIMATION ──────────────────
  function spinWheel(items, drawFn, canvas, targetIndex, onComplete) {
    if (state.isSpinning) return;
    state.isSpinning = true;
    initAudio();
    playSpinStartSound();
    canvas.classList.add('spinning');

    const count = items.length;
    const sliceAngle = (2 * Math.PI) / count;

    // The pointer is at the top (12 o'clock = -π/2 in standard math)
    // We want the target segment to land under the pointer
    // Segment i spans from i*sliceAngle to (i+1)*sliceAngle
    // Center of target segment = targetIndex * sliceAngle + sliceAngle/2
    // To align to top pointer: we need rotation such that the center of the target is at -π/2
    // Required angle = -π/2 - (targetIndex * sliceAngle + sliceAngle/2)
    // Add full rotations for dramatic spin

    const fullSpins = 5 + Math.floor(Math.random() * 4); // 5-8 full rotations
    const targetAngle = -(targetIndex * sliceAngle + sliceAngle / 2) - Math.PI / 2;
    const totalRotation = fullSpins * 2 * Math.PI + targetAngle;

    const startAngle = state.wheelAngle;
    const deltaAngle = totalRotation - startAngle;

    const duration = 3500 + Math.random() * 1500; // 3.5-5 seconds
    const startTime = performance.now();

    let lastTickAngle = startAngle;

    function animate(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing: cubic ease-out
      const eased = 1 - Math.pow(1 - progress, 3);

      const currentAngle = startAngle + deltaAngle * eased;
      state.wheelAngle = currentAngle;

      drawFn(items, currentAngle);

      // Tick sound - play when crossing segment boundary
      const angleDiff = Math.abs(currentAngle - lastTickAngle);
      if (angleDiff > sliceAngle * 0.9) {
        playTickSound();
        lastTickAngle = currentAngle;
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        state.wheelAngle = totalRotation;
        state.isSpinning = false;
        canvas.classList.remove('spinning');
        drawFn(items, totalRotation);
        onComplete();
      }
    }

    requestAnimationFrame(animate);
  }

  // ─── NUMBER SPIN ──────────────────────
  function handleNumberSpin() {
    if (state.isSpinning || !state.wheelGenerated || state.eventComplete) return;
    initAudio();

    const round = state.roundConfig[state.currentRound];
    const needed = round - state.currentRoundSelections.length;

    if (needed <= 0) {
      showToast('Round complete! Click Next Round.', 'info');
      return;
    }

    // Determine pool based on mode
    let pool;
    if (state.selectionMode === 'progressive') {
      pool = state.remainingNumbers.filter(n => !state.currentRoundSelections.includes(n));
    } else {
      pool = state.availableNumbers.filter(n => !state.currentRoundSelections.includes(n));
    }

    if (pool.length === 0) {
      showToast('No numbers available', 'error');
      return;
    }

    // Randomly select a number
    const randomIndex = Math.floor(Math.random() * pool.length);
    const selectedNumber = pool[randomIndex];

    // Find index on wheel
    const wheelIndex = state.wheelItems.indexOf(selectedNumber);
    if (wheelIndex === -1) {
      // Number not on current wheel, just select
      finishNumberSelection(selectedNumber);
      return;
    }

    dom.spinBtn.disabled = true;
    dom.spinBtn.classList.add('spinning');
    dom.nextRoundBtn.disabled = true;

    spinWheel(
      state.wheelItems,
      drawNumberWheel,
      dom.wheelCanvas,
      wheelIndex,
      () => {
        finishNumberSelection(selectedNumber);
        dom.spinBtn.classList.remove('spinning');
      }
    );
  }

  function finishNumberSelection(number) {
    state.currentRoundSelections.push(number);
    state.selectedNumbers.push(number);

    if (state.selectionMode === 'progressive') {
      const idx = state.remainingNumbers.indexOf(number);
      if (idx > -1) state.remainingNumbers.splice(idx, 1);
    }

    const target = state.roundConfig[state.currentRound];
    const completed = state.currentRoundSelections.length;
    const isFinal = state.currentRound === state.roundConfig.length - 1;

    playSelectSound();

    // Show result overlay
    showNumberResult(number, completed, target, isFinal && completed === target);

    updateNumberUI();

    if (completed >= target) {
      // Round complete
      dom.spinBtn.disabled = true;
      if (state.currentRound < state.roundConfig.length - 1) {
        dom.nextRoundBtn.disabled = false;
        dom.nextRoundBtn.style.display = '';
      } else {
        // All rounds done
        state.eventComplete = true;
        dom.nextRoundBtn.style.display = 'none';
      }
    } else {
      dom.spinBtn.disabled = false;
      dom.nextRoundBtn.disabled = true;
    }
  }

  function showNumberResult(number, completed, total, isWinner) {
    const roundLabel = state.currentRound === state.roundConfig.length - 1 ? 'FINAL' : `ROUND ${state.currentRound + 1}`;
    dom.resultRoundLabel.textContent = roundLabel;
    dom.resultSubtitle.textContent = isWinner ? '🏆 WINNER 🏆' : `SELECTED (${completed}/${total})`;

    dom.resultContent.innerHTML = '';

    if (isWinner) {
      dom.resultOverlay.classList.add('winner-celebration');
      const label = document.createElement('div');
      label.className = 'winner-label';
      label.textContent = '★ WINNER ★';
      dom.resultContent.appendChild(label);
      playWinnerSound();
      launchConfetti();
    } else {
      dom.resultOverlay.classList.remove('winner-celebration');
    }

    const numDiv = document.createElement('div');
    numDiv.className = 'result-number';
    numDiv.textContent = number;
    dom.resultContent.appendChild(numDiv);

    // Show all selected in this round
    if (state.currentRoundSelections.length > 1) {
      const grid = document.createElement('div');
      grid.className = 'result-selected-grid';
      state.currentRoundSelections.forEach(n => {
        const chip = document.createElement('span');
        chip.className = 'number-chip' + (n === number ? ' latest' : '');
        chip.textContent = n;
        grid.appendChild(chip);
      });
      dom.resultContent.appendChild(grid);
    }

    dom.resultOverlay.classList.add('show');
  }

  function advanceToNextRound() {
    // Save round results
    state.roundResults.push({
      round: state.currentRound + 1,
      label: state.currentRound === state.roundConfig.length - 1 ? 'FINAL' : `Round ${state.currentRound + 1}`,
      selections: [...state.currentRoundSelections],
      target: state.roundConfig[state.currentRound],
    });

    state.currentRound++;
    state.currentRoundSelections = [];

    if (state.currentRound < state.roundConfig.length) {
      state.currentRoundTarget = state.roundConfig[state.currentRound];

      // Update wheel items to remaining numbers
      if (state.selectionMode === 'progressive') {
        state.wheelItems = [...state.remainingNumbers];
      }
      // For independent mode, keep the original wheel

      if (state.wheelItems.length > 0) {
        drawNumberWheel(state.wheelItems, 0);
        state.wheelAngle = 0;
      }

      dom.spinBtn.disabled = false;
      dom.nextRoundBtn.disabled = true;

      showToast(`Round ${state.currentRound + 1} — Select ${state.roundConfig[state.currentRound]} numbers`, 'success');
    }

    updateNumberUI();
  }

  // ─── UPDATE NUMBER UI ─────────────────
  function updateNumberUI() {
    const total = state.availableNumbers.length;
    const selected = state.selectedNumbers.length;
    const remaining = state.selectionMode === 'progressive' ? state.remainingNumbers.length : total;

    dom.statTotal.textContent = total;
    dom.statSelected.textContent = selected;
    dom.statRemaining.textContent = remaining;

    const roundLabel = state.currentRound >= state.roundConfig.length
      ? 'COMPLETE'
      : state.currentRound === state.roundConfig.length - 1 ? 'FINAL' : `ROUND ${state.currentRound + 1}`;
    dom.statRound.textContent = roundLabel;
    dom.roundBadge.textContent = roundLabel;

    // Round info
    if (state.wheelGenerated && !state.eventComplete && state.currentRound < state.roundConfig.length) {
      const target = state.roundConfig[state.currentRound];
      const done = state.currentRoundSelections.length;
      dom.roundInfo.textContent = `Select ${target} numbers — ${done}/${target} done`;
    } else if (state.eventComplete) {
      dom.roundInfo.textContent = 'Event complete!';
    } else {
      dom.roundInfo.textContent = 'Generate a wheel to begin';
    }

    // Spin progress
    if (state.wheelGenerated && state.currentRound < state.roundConfig.length) {
      const target = state.roundConfig[state.currentRound];
      const done = state.currentRoundSelections.length;
      dom.spinProgress.innerHTML = `<strong>${done}</strong> / <strong>${target}</strong> selected this round`;
    } else {
      dom.spinProgress.textContent = '';
    }

    // Round progress dots
    renderRoundProgress();

    // Selected numbers list (current round)
    renderSelectedNumbers();

    // History
    renderHistory();
  }

  function renderRoundProgress() {
    dom.roundProgress.innerHTML = '';
    state.roundConfig.forEach((count, i) => {
      if (i > 0) {
        const arrow = document.createElement('span');
        arrow.className = 'round-arrow';
        arrow.textContent = '→';
        dom.roundProgress.appendChild(arrow);
      }
      const dot = document.createElement('div');
      dot.className = 'round-dot';
      if (i < state.currentRound || (i === state.currentRound && state.currentRoundSelections.length >= count)) {
        dot.classList.add('completed');
      } else if (i === state.currentRound) {
        dot.classList.add('active');
      }
      dot.textContent = count;
      dom.roundProgress.appendChild(dot);
    });
  }

  function renderSelectedNumbers() {
    dom.selectedNumbersList.innerHTML = '';
    if (state.currentRoundSelections.length === 0) {
      dom.selectedNumbersList.innerHTML = '<span style="color:var(--text-muted);font-size:0.75rem;">No selections yet</span>';
      return;
    }
    state.currentRoundSelections.forEach((n, i) => {
      const chip = document.createElement('span');
      chip.className = 'number-chip';
      if (i === state.currentRoundSelections.length - 1) chip.classList.add('latest');
      chip.textContent = n;
      dom.selectedNumbersList.appendChild(chip);
    });
  }

  function renderHistory() {
    dom.roundHistory.innerHTML = '';
    if (state.roundResults.length === 0) {
      dom.roundHistory.innerHTML = '<span style="color:var(--text-muted);font-size:0.75rem;">No history yet</span>';
      return;
    }
    state.roundResults.forEach(r => {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.innerHTML = `
        <div class="history-item-header">
          <span class="history-round">${r.label}</span>
          <span class="history-count">${r.selections.length} selected</span>
        </div>
        <div class="history-numbers">
          ${r.selections.map(n => `<span class="number-chip">${n}</span>`).join('')}
        </div>
      `;
      dom.roundHistory.appendChild(item);
    });
  }

  // ─── RESET FUNCTIONS ──────────────────
  async function resetEvent() {
    if (state.wheelGenerated || state.selectedNumbers.length > 0) {
      const confirmed = await showConfirm('Reset Event', 'This will clear all selections, history, and the wheel. Continue?');
      if (!confirmed) return;
    }

    state.availableNumbers = [];
    state.selectedNumbers = [];
    state.remainingNumbers = [];
    state.roundResults = [];
    state.currentRound = 0;
    state.currentRoundSelections = [];
    state.currentRoundTarget = 0;
    state.wheelGenerated = false;
    state.wheelItems = [];
    state.eventComplete = false;
    state.wheelAngle = 0;

    dom.wheelCanvas.style.display = 'none';
    dom.wheelEmpty.style.display = 'flex';
    dom.spinBtn.disabled = true;
    dom.nextRoundBtn.disabled = true;
    dom.nextRoundBtn.style.display = '';

    updateNumberUI();
    showToast('Event reset', 'success');
  }

  async function resetTeams() {
    if (state.teamsLoaded) {
      const confirmed = await showConfirm('Reset Teams', 'This will clear all team data. Continue?');
      if (!confirmed) return;
    }

    state.teams = [];
    state.selectedTeam = null;
    state.teamsLoaded = false;

    dom.teamWheelCanvas.style.display = 'none';
    dom.teamWheelEmpty.style.display = 'flex';
    dom.teamSpinBtn.disabled = true;
    dom.teamCount.textContent = '0';
    dom.teamList.innerHTML = '';
    dom.teamStatTotal.textContent = '0';
    dom.teamStatSelected.textContent = '0';
    dom.teamTextarea.value = '';

    showToast('Teams reset', 'success');
  }

  // ─── TEAM MODE ────────────────────────
  function loadTeams() {
    const text = dom.teamTextarea.value.trim();
    if (!text) {
      showToast('Please enter team names', 'error');
      return;
    }

    let teams = text.split('\n').map(t => t.trim()).filter(t => t.length > 0);

    if (teams.length < 2) {
      showToast('Please enter at least 2 teams', 'error');
      return;
    }

    // Check for duplicates
    const unique = [...new Set(teams)];
    if (unique.length < teams.length) {
      const dupes = teams.length - unique.length;
      showToast(`Removed ${dupes} duplicate team(s)`, 'info');
      teams = unique;
    }

    state.teams = teams;
    state.selectedTeam = null;
    state.teamsLoaded = true;

    dom.teamWheelEmpty.style.display = 'none';
    dom.teamWheelCanvas.style.display = 'block';
    dom.teamSpinBtn.disabled = false;

    drawTeamWheel(state.teams, 0);
    state.wheelAngle = 0;

    dom.teamCount.textContent = teams.length;
    dom.teamStatTotal.textContent = teams.length;
    dom.teamStatSelected.textContent = '0';

    // Show team list
    dom.teamList.innerHTML = '';
    teams.forEach(t => {
      const chip = document.createElement('span');
      chip.className = 'team-chip';
      chip.textContent = t;
      dom.teamList.appendChild(chip);
    });

    showToast(`Loaded ${teams.length} teams`, 'success');
  }

  function handleTeamSpin() {
    if (state.isSpinning || !state.teamsLoaded || state.teams.length === 0) return;
    initAudio();

    const randomIndex = Math.floor(Math.random() * state.teams.length);

    dom.teamSpinBtn.disabled = true;
    dom.teamSpinBtn.classList.add('spinning');

    spinWheel(
      state.teams,
      drawTeamWheel,
      dom.teamWheelCanvas,
      randomIndex,
      () => {
        state.selectedTeam = state.teams[randomIndex];
        dom.teamSpinBtn.disabled = false;
        dom.teamSpinBtn.classList.remove('spinning');
        dom.teamStatSelected.textContent = '1';

        showTeamResult(state.selectedTeam);

        // Highlight in team list
        dom.teamList.querySelectorAll('.team-chip').forEach(chip => {
          chip.classList.toggle('selected', chip.textContent === state.selectedTeam);
        });
      }
    );
  }

  function showTeamResult(team) {
    dom.resultRoundLabel.textContent = 'TEAM SELECTION';
    dom.resultSubtitle.textContent = 'SELECTED TEAM';
    dom.resultOverlay.classList.remove('winner-celebration');
    dom.resultOverlay.classList.add('winner-celebration');

    dom.resultContent.innerHTML = '';

    const label = document.createElement('div');
    label.className = 'winner-label';
    label.textContent = '★ SELECTED ★';
    dom.resultContent.appendChild(label);

    const nameDiv = document.createElement('div');
    nameDiv.className = 'result-team-name';
    nameDiv.textContent = team;
    dom.resultContent.appendChild(nameDiv);

    dom.resultOverlay.classList.add('show');
    playWinnerSound();
    launchConfetti();
  }

  // ─── CONFETTI ─────────────────────────
  function launchConfetti() {
    const canvas = dom.confettiCanvas;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#00e676', '#00c853', '#39ff14', '#ffffff', '#69f0ae', '#b9f6ca'];

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        w: Math.random() * 10 + 4,
        h: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10,
        opacity: 1,
      });
    }

    let startTime = performance.now();

    function animate(now) {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let active = false;
      particles.forEach(p => {
        if (p.opacity <= 0) return;
        active = true;

        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.rotation += p.rotSpeed;

        if (elapsed > 2000) {
          p.opacity -= 0.02;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      if (active) {
        requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    requestAnimationFrame(animate);
  }

  // ─── PARTICLE BACKGROUND ─────────────
  function initParticles() {
    const canvas = dom.particleCanvas;
    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const particles = [];
    const count = 50;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2 + 0.5,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.3 + 0.05,
      });
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(0, 230, 118, ${p.opacity})`;
        ctx.fill();
      });

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0, 230, 118, ${0.03 * (1 - dist / 150)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(animate);
    }

    animate();
  }

  // ─── EVENT MODE ───────────────────────
  function toggleEventMode() {
    state.eventMode = !state.eventMode;
    document.body.classList.toggle('event-mode', state.eventMode);
    dom.eventModeBtn.textContent = state.eventMode ? '✕ Exit Event Mode' : '⛶ Event Mode';

    if (state.eventMode) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => { });
      }
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => { });
      }
    }

    // Redraw wheels after layout change
    setTimeout(() => {
      if (state.wheelGenerated && state.wheelItems.length > 0) {
        drawNumberWheel(state.wheelItems, state.wheelAngle);
      }
      if (state.teamsLoaded && state.teams.length > 0) {
        drawTeamWheel(state.teams, state.wheelAngle);
      }
    }, 300);
  }

  // ─── SOUND TOGGLE ─────────────────────
  function toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    dom.soundToggle.classList.toggle('active', state.soundEnabled);
    dom.soundToggle.textContent = state.soundEnabled ? '🔊' : '🔇';
    if (state.soundEnabled) initAudio();
  }

  // ─── EVENT LISTENERS ──────────────────
  function bindEvents() {
    // Navigation
    dom.navNumber.addEventListener('click', () => switchPage('number'));
    dom.navTeam.addEventListener('click', () => switchPage('team'));

    // Number config
    dom.generateBtn.addEventListener('click', validateAndGenerate);
    dom.resetBtn.addEventListener('click', resetEvent);
    dom.modeSelect.addEventListener('change', () => {
      state.selectionMode = dom.modeSelect.value;
    });

    // Spin
    dom.spinBtn.addEventListener('click', handleNumberSpin);
    dom.nextRoundBtn.addEventListener('click', advanceToNextRound);
    dom.resetEventBtn.addEventListener('click', resetEvent);

    // Team mode
    dom.loadTeamsBtn.addEventListener('click', loadTeams);
    dom.teamSpinBtn.addEventListener('click', handleTeamSpin);
    dom.resetTeamBtn.addEventListener('click', resetTeams);

    // Result overlay close
    dom.resultCloseBtn.addEventListener('click', () => {
      dom.resultOverlay.classList.remove('show', 'winner-celebration');
    });

    // Close result on click outside card
    dom.resultOverlay.addEventListener('click', (e) => {
      if (e.target === dom.resultOverlay) {
        dom.resultOverlay.classList.remove('show', 'winner-celebration');
      }
    });

    // Header controls
    dom.soundToggle.addEventListener('click', toggleSound);
    dom.eventModeBtn.addEventListener('click', toggleEventMode);

    // Escape to close result/exit event mode
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (dom.resultOverlay.classList.contains('show')) {
          dom.resultOverlay.classList.remove('show', 'winner-celebration');
        }
        if (dom.confirmModal.classList.contains('show')) {
          dom.confirmModal.classList.remove('show');
        }
      }
      // Space to spin
      if (e.key === ' ' && !state.isSpinning) {
        e.preventDefault();
        if (state.currentPage === 'number' && state.wheelGenerated && !dom.spinBtn.disabled) {
          handleNumberSpin();
        } else if (state.currentPage === 'team' && state.teamsLoaded && !dom.teamSpinBtn.disabled) {
          handleTeamSpin();
        }
      }
    });

    // Window resize — redraw wheels
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (state.wheelGenerated && state.wheelItems.length > 0) {
          drawNumberWheel(state.wheelItems, state.wheelAngle);
        }
        if (state.teamsLoaded && state.teams.length > 0) {
          drawTeamWheel(state.teams, state.wheelAngle);
        }
      }, 200);
    });

    // Fullscreen change
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && state.eventMode) {
        state.eventMode = false;
        document.body.classList.remove('event-mode');
        dom.eventModeBtn.textContent = '⛶ Event Mode';
        setTimeout(() => {
          if (state.wheelGenerated && state.wheelItems.length > 0) {
            drawNumberWheel(state.wheelItems, state.wheelAngle);
          }
          if (state.teamsLoaded && state.teams.length > 0) {
            drawTeamWheel(state.teams, state.wheelAngle);
          }
        }, 300);
      }
    });
  }

  // ─── INITIALIZATION ───────────────────
  function init() {
    bindEvents();
    initParticles();
    switchPage('number');
    updateNumberUI();

    // Set initial state
    dom.wheelCanvas.style.display = 'none';
    dom.teamWheelCanvas.style.display = 'none';
    dom.spinBtn.disabled = true;
    dom.teamSpinBtn.disabled = true;
    dom.nextRoundBtn.disabled = true;
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
