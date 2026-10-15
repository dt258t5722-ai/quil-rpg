/* Ashdice: 2d6 where each 6 counts as 0. Totals 0–10. */
window.QuilDice = (() => {
  const log = [];

  function faceValue(raw) {
    const n = Number(raw);
    if (n === 6) return 0;
    return n;
  }

  function autoRoll() {
    const buf = new Uint32Array(2);
    crypto.getRandomValues(buf);
    const a = (buf[0] % 6) + 1;
    const b = (buf[1] % 6) + 1;
    return [a, b];
  }

  function evaluate(rawA, rawB, modifiers, target) {
    const vA = faceValue(rawA);
    const vB = faceValue(rawB);
    const natural = vA + vB;
    const modTotal = Math.min(8, (modifiers || []).reduce((s, m) => s + (m.value || 0), 0));
    const total = natural + modTotal;
    const margin = total - target;
    let outcome = 'fail';
    if (natural === 10) outcome = 'critical';
    else if (natural === 0) outcome = 'fumble';
    else if (total >= target) outcome = margin >= 3 ? 'strong' : 'success';
    const entry = {
      raw: [rawA, rawB], values: [vA, vB], natural, modifiers: modifiers || [],
      modTotal, total, target, margin, outcome, ts: Date.now()
    };
    log.push(entry);
    if (log.length > 100) log.shift();
    return entry;
  }

  /** Promise-based dice pad UI */
  function promptRoll({ title, target, modifiers, mode }) {
    return new Promise(resolve => {
      const pad = document.getElementById('dice-pad');
      const sheet = pad.querySelector('.dice-sheet');
      const auto = (mode || window.QuilSave?.get()?.settings?.diceMode || 'physical') === 'auto'
        || document.getElementById('auto-roll-toggle')?.classList.contains('on');

      sheet.innerHTML = '';
      const h = document.createElement('h3');
      h.textContent = title || 'Ashdice Roll';
      sheet.appendChild(h);

      const meta = document.createElement('div');
      meta.className = 'dice-meta';
      const modStr = (modifiers || []).map(m => `${m.label} ${m.value >= 0 ? '+' : ''}${m.value}`).join(' · ') || 'no modifiers';
      meta.innerHTML = `Target <strong>${target}</strong><div class="breakdown">${modStr} (cap +8)</div>`;
      sheet.appendChild(meta);

      const toggleRow = document.createElement('div');
      toggleRow.className = 'toggle-row';
      toggleRow.innerHTML = `<span>Auto-roll</span><div class="toggle ${auto ? 'on' : ''}" id="pad-auto"></div>`;
      sheet.appendChild(toggleRow);
      const padAuto = toggleRow.querySelector('#pad-auto');
      padAuto.onclick = () => padAuto.classList.toggle('on');

      const label = document.createElement('div');
      label.style.cssText = 'text-align:center;color:#8a7a60;font-size:13px;margin-top:8px';
      label.textContent = 'Tap two bone dice (6 = 0)';
      sheet.appendChild(label);

      const slots = document.createElement('div');
      slots.className = 'die-slots';
      slots.innerHTML = '<div class="die-slot" data-i="0">—</div><div class="die-slot" data-i="1">—</div>';
      sheet.appendChild(slots);

      const row = document.createElement('div');
      row.className = 'die-row';
      for (let i = 1; i <= 6; i++) {
        const b = document.createElement('button');
        b.className = 'die-btn' + (i === 6 ? ' six' : '');
        b.textContent = i === 6 ? '6=0' : String(i);
        b.dataset.val = i;
        row.appendChild(b);
      }
      sheet.appendChild(row);

      const result = document.createElement('div');
      result.className = 'roll-result hidden';
      sheet.appendChild(result);

      const actions = document.createElement('div');
      actions.className = 'dice-actions';
      actions.innerHTML = `
        <button class="btn ghost" id="dice-undo">Undo</button>
        <button class="btn" id="dice-autoroll">🎲 Auto-roll</button>
        <button class="btn primary" id="dice-confirm" disabled>Confirm</button>`;
      sheet.appendChild(actions);

      let picked = [];
      let finalEntry = null;

      function renderSlots() {
        slots.querySelectorAll('.die-slot').forEach((el, i) => {
          if (picked[i] != null) {
            el.classList.add('filled');
            el.textContent = picked[i] === 6 ? '0' : String(picked[i]);
          } else {
            el.classList.remove('filled');
            el.textContent = '—';
          }
        });
        document.getElementById('dice-confirm').disabled = picked.length !== 2;
        if (picked.length === 2) showResult();
        else {
          result.classList.add('hidden');
          finalEntry = null;
        }
      }

      function showResult() {
        finalEntry = evaluate(picked[0], picked[1], modifiers, target);
        result.classList.remove('hidden', 'pass', 'fail', 'crit', 'fumble');
        const ok = finalEntry.outcome === 'success' || finalEntry.outcome === 'strong' || finalEntry.outcome === 'critical';
        result.classList.add(ok ? 'pass' : 'fail');
        if (finalEntry.outcome === 'critical') result.classList.add('crit');
        if (finalEntry.outcome === 'fumble') result.classList.add('fumble');
        const labels = { critical: 'CRITICAL', fumble: 'GRAVEDICE', strong: 'STRONG SUCCESS', success: 'SUCCESS', fail: 'FAILURE' };
        result.innerHTML = `
          <div class="total">${finalEntry.total} vs ${target}</div>
          <div class="seal">${labels[finalEntry.outcome]} · natural ${finalEntry.natural} (${picked[0]===6?0:picked[0]}+${picked[1]===6?0:picked[1]})${finalEntry.modTotal ? ' +' + finalEntry.modTotal : ''}</div>
          <div style="font-size:13px;color:#8a7a60;margin-top:4px">Margin ${finalEntry.margin >= 0 ? '+' : ''}${finalEntry.margin}</div>`;
      }

      row.querySelectorAll('.die-btn').forEach(b => {
        b.onclick = () => {
          if (picked.length >= 2) return;
          picked.push(Number(b.dataset.val));
          b.classList.add('picked');
          setTimeout(() => b.classList.remove('picked'), 200);
          renderSlots();
        };
      });

      document.getElementById('dice-undo').onclick = () => {
        picked = [];
        finalEntry = null;
        renderSlots();
      };

      function doAuto() {
        picked = autoRoll();
        renderSlots();
      }
      document.getElementById('dice-autoroll').onclick = doAuto;

      document.getElementById('dice-confirm').onclick = () => {
        if (!finalEntry) return;
        pad.classList.remove('open');
        resolve(finalEntry);
      };

      pad.classList.add('open');
      renderSlots();
      if (padAuto.classList.contains('on')) {
        setTimeout(doAuto, 280);
      }
    });
  }

  return { faceValue, autoRoll, evaluate, promptRoll, getLog: () => log.slice() };
})();
