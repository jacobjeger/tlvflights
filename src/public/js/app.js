// ---- Client-side filtering ----

(function () {
  let activeDate = 'all';
  let activeAirline = 'all';
  let searchQuery = '';

  // Date chip filtering
  const dateChips = document.getElementById('date-chips');
  if (dateChips) {
    dateChips.addEventListener('click', function (e) {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      dateChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeDate = chip.dataset.date;
      applyFilters();
    });
  }

  // Airline chip filtering
  const airlineChips = document.getElementById('airline-chips');
  if (airlineChips) {
    airlineChips.addEventListener('click', function (e) {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      airlineChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeAirline = chip.dataset.airline;
      applyFilters();
    });
  }

  // Search input
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      searchQuery = this.value.toLowerCase().trim();
      applyFilters();
    });
  }

  function applyFilters() {
    const destCards = document.querySelectorAll('.dest-card');

    destCards.forEach(function (card) {
      const rows = card.querySelectorAll('.flight-row');
      let visibleCount = 0;

      rows.forEach(function (row) {
        let show = true;

        // Date filter
        if (activeDate !== 'all' && row.dataset.date !== activeDate) {
          show = false;
        }

        // Airline filter
        if (activeAirline !== 'all' && row.dataset.airline !== activeAirline) {
          show = false;
        }

        // Search filter
        if (searchQuery && !row.dataset.search.includes(searchQuery)) {
          show = false;
        }

        row.classList.toggle('hidden', !show);
        if (show) visibleCount++;
      });

      // Hide entire destination card if no visible rows
      card.classList.toggle('hidden', visibleCount === 0);
    });
  }
})();

// ---- Refresh trigger ----
function triggerRefresh() {
  fetch('/api/refresh', { method: 'POST' })
    .then(function (r) { return r.json(); })
    .then(function () { window.location.reload(); })
    .catch(function (err) { console.error('Refresh failed:', err); });
}

// ---- Auto-refresh every 60 seconds ----
setTimeout(function () { window.location.reload(); }, 60000);
