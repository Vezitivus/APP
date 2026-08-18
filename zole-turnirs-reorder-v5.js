'use strict';

(() => {
  const HOLD_MS = 420;
  const MOVE_CANCEL_PX = 9;
  let pendingPress = null;
  let holdTimer = null;
  let dragState = null;

  function canReorderPlayers() {
    return !isTournamentStarted() && state.players.length > 1;
  }

  function orderedPlayers() {
    return [...state.players].sort((a, b) => a.registrationNo - b.registrationNo);
  }

  function ensureHint() {
    const subtitle = refs.playersSubtitle;
    if (!subtitle?.parentNode) return null;
    let hint = document.getElementById('playerReorderHint');
    if (!hint) {
      hint = document.createElement('p');
      hint.id = 'playerReorderHint';
      hint.className = 'player-reorder-hint';
      hint.textContent = 'Pieturi spēlētāja rindu un velc uz augšu vai leju, lai mainītu 1. kārtas secību.';
      subtitle.insertAdjacentElement('afterend', hint);
    }
    hint.classList.toggle('hidden', !canReorderPlayers());
    return hint;
  }

  function decorateRows() {
    ensureHint();
    const players = orderedPlayers();
    const rows = [...refs.playerList.querySelectorAll('.player-row')];
    const enabled = canReorderPlayers();

    rows.forEach((row, index) => {
      const player = players[index];
      if (!player) return;
      row.dataset.reorderPlayerId = player.id;
      row.classList.toggle('reorder-enabled', enabled);
      row.setAttribute('aria-label', enabled
        ? `${player.name}. Pieturi un velc, lai mainītu vietu sarakstā.`
        : player.name);
    });
  }

  function clearHoldTimer() {
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = null;
  }

  function clearPendingPress() {
    clearHoldTimer();
    pendingPress = null;
  }

  function makeGhost(row, clientY) {
    const rect = row.getBoundingClientRect();
    const ghost = row.cloneNode(true);
    ghost.removeAttribute('id');
    ghost.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    ghost.classList.remove('reorder-placeholder');
    ghost.classList.add('reorder-ghost');
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    document.body.appendChild(ghost);
    return { ghost, offsetY: Math.max(0, Math.min(rect.height, clientY - rect.top)) };
  }

  function beginDrag() {
    if (!pendingPress || !canReorderPlayers()) return;
    const { row, inputType, inputId, clientY } = pendingPress;
    clearHoldTimer();

    const originalOrder = [...refs.playerList.querySelectorAll('.player-row')]
      .map(item => item.dataset.reorderPlayerId)
      .filter(Boolean);
    const { ghost, offsetY } = makeGhost(row, clientY);

    dragState = { row, ghost, inputType, inputId, offsetY, originalOrder };
    pendingPress = null;
    row.classList.add('reorder-placeholder');
    document.body.classList.add('player-reordering');

    if (inputType === 'pointer') {
      try { row.setPointerCapture(inputId); } catch (_) {}
    }
    if (navigator.vibrate) {
      try { navigator.vibrate(18); } catch (_) {}
    }
  }

  function moveGhost(clientY) {
    if (dragState) dragState.ghost.style.top = `${clientY - dragState.offsetY}px`;
  }

  function movePlaceholder(clientY) {
    if (!dragState) return;
    const list = refs.playerList;
    const row = dragState.row;
    const candidates = [...list.querySelectorAll('.player-row')].filter(item => item !== row);
    let before = null;

    for (const candidate of candidates) {
      const rect = candidate.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        before = candidate;
        break;
      }
    }

    if (before) list.insertBefore(row, before);
    else list.appendChild(row);
  }

  function autoScroll(clientY) {
    const edge = 88;
    if (clientY < edge) window.scrollBy(0, -12);
    else if (clientY > window.innerHeight - edge) window.scrollBy(0, 12);
  }

  function commitOrder() {
    const ids = [...refs.playerList.querySelectorAll('.player-row')]
      .map(row => row.dataset.reorderPlayerId)
      .filter(Boolean);
    if (ids.length !== state.players.length) return false;

    const changed = ids.some((id, index) => id !== dragState.originalOrder[index]);
    const byId = new Map(state.players.map(player => [player.id, player]));
    ids.forEach((id, index) => {
      const player = byId.get(id);
      if (player) player.registrationNo = index + 1;
    });
    state.players.sort((a, b) => a.registrationNo - b.registrationNo);
    saveState();
    return changed;
  }

  function endDrag({ commit }) {
    if (!dragState) return;
    const { row, ghost, inputType, inputId } = dragState;
    if (inputType === 'pointer') {
      try { row.releasePointerCapture(inputId); } catch (_) {}
    }
    ghost.remove();
    row.classList.remove('reorder-placeholder');
    document.body.classList.remove('player-reordering');

    let changed = false;
    if (commit) changed = commitOrder();
    dragState = null;
    renderAll();
    if (commit && changed) showToast('Spēlētāju secība saglabāta');
  }

  function beginPending(row, inputType, inputId, clientX, clientY) {
    clearPendingPress();
    pendingPress = { row, inputType, inputId, startX: clientX, startY: clientY, clientY };
    holdTimer = setTimeout(beginDrag, HOLD_MS);
  }

  function trackPending(inputType, inputId, clientX, clientY) {
    if (!pendingPress || pendingPress.inputType !== inputType || pendingPress.inputId !== inputId) return;
    pendingPress.clientY = clientY;
    const distance = Math.hypot(clientX - pendingPress.startX, clientY - pendingPress.startY);
    if (distance > MOVE_CANCEL_PX) clearPendingPress();
  }

  function touchById(touchList, id) {
    return [...touchList].find(touch => touch.identifier === id) || null;
  }

  refs.playerList.addEventListener('touchstart', event => {
    if (!canReorderPlayers() || event.touches.length !== 1) return;
    if (event.target.closest('button,input,a,label')) return;
    const row = event.target.closest('.player-row.reorder-enabled');
    const touch = event.touches[0];
    if (!row || !touch) return;
    beginPending(row, 'touch', touch.identifier, touch.clientX, touch.clientY);
  }, { passive: true });

  refs.playerList.addEventListener('touchmove', event => {
    if (dragState?.inputType === 'touch') {
      const touch = touchById(event.touches, dragState.inputId);
      if (!touch) return;
      event.preventDefault();
      moveGhost(touch.clientY);
      movePlaceholder(touch.clientY);
      autoScroll(touch.clientY);
      return;
    }

    if (pendingPress?.inputType === 'touch') {
      const touch = touchById(event.touches, pendingPress.inputId);
      if (touch) trackPending('touch', touch.identifier, touch.clientX, touch.clientY);
    }
  }, { passive: false });

  refs.playerList.addEventListener('touchend', event => {
    if (dragState?.inputType === 'touch' && touchById(event.changedTouches, dragState.inputId)) {
      event.preventDefault();
      endDrag({ commit: true });
      return;
    }
    if (pendingPress?.inputType === 'touch' && touchById(event.changedTouches, pendingPress.inputId)) clearPendingPress();
  }, { passive: false });

  refs.playerList.addEventListener('touchcancel', event => {
    if (dragState?.inputType === 'touch' && touchById(event.changedTouches, dragState.inputId)) {
      endDrag({ commit: false });
      return;
    }
    if (pendingPress?.inputType === 'touch' && touchById(event.changedTouches, pendingPress.inputId)) clearPendingPress();
  });

  refs.playerList.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch' || !canReorderPlayers() || event.button > 0) return;
    if (event.target.closest('button,input,a,label')) return;
    const row = event.target.closest('.player-row.reorder-enabled');
    if (!row) return;
    beginPending(row, 'pointer', event.pointerId, event.clientX, event.clientY);
  });

  refs.playerList.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    if (dragState?.inputType === 'pointer' && event.pointerId === dragState.inputId) {
      event.preventDefault();
      moveGhost(event.clientY);
      movePlaceholder(event.clientY);
      autoScroll(event.clientY);
      return;
    }
    trackPending('pointer', event.pointerId, event.clientX, event.clientY);
  });

  refs.playerList.addEventListener('pointerup', event => {
    if (event.pointerType === 'touch') return;
    if (dragState?.inputType === 'pointer' && event.pointerId === dragState.inputId) {
      endDrag({ commit: true });
      return;
    }
    if (pendingPress?.inputType === 'pointer' && event.pointerId === pendingPress.inputId) clearPendingPress();
  });

  refs.playerList.addEventListener('pointercancel', event => {
    if (event.pointerType === 'touch') return;
    if (dragState?.inputType === 'pointer' && event.pointerId === dragState.inputId) {
      endDrag({ commit: false });
      return;
    }
    if (pendingPress?.inputType === 'pointer' && event.pointerId === pendingPress.inputId) clearPendingPress();
  });

  refs.playerList.addEventListener('contextmenu', event => {
    if (canReorderPlayers() && event.target.closest('.player-row.reorder-enabled')) event.preventDefault();
  });

  const baseRenderAll = renderAll;
  renderAll = function renderAllWithPlayerReorder() {
    baseRenderAll();
    decorateRows();
  };

  decorateRows();
})();
