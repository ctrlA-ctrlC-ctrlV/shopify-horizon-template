/**
 * Kitchen Cabinets - Client-side product search
 *
 * Provides instant filtering of the product grid by product title.
 * Works alongside the Shopify sidebar-filters and results-list components
 * without interfering with their Liquid-driven filtering / pagination.
 *
 * Usage:
 *   The catalog section renders a search input with [data-kc-search-input].
 *   Each product li carries data-product-title, data-product-type, and
 *   data-product-vendor attributes for matching.
 */

(() => {
  /** Minimum characters before filtering kicks in */
  const MIN_QUERY_LENGTH = 2;

  /** Debounce delay in ms */
  const DEBOUNCE_MS = 200;

  /**
   * Simple debounce helper.
   * @param {(...a: any[]) => void} fn
   * @param {number} delay
   * @returns {(...a: any[]) => void}
   */
  function debounce(fn, delay) {
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timer;
    return (/** @type {any[]} */ ...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  /**
   * Initialise search for one [data-kc-search] container.
   * @param {Element} containerEl
   */
  function initSearch(containerEl) {
    const container = /** @type {HTMLElement} */ (containerEl);
    const input = /** @type {HTMLInputElement | null} */ (
      container.querySelector('[data-kc-search-input]')
    );
    const clearBtn = /** @type {HTMLButtonElement | null} */ (
      container.querySelector('[data-kc-search-clear]')
    );
    const statusEl = container.querySelector('[data-kc-search-status]');

    if (!input) return;

    // The product grid lives inside the same results-list parent.
    const sectionEl = container.closest('results-list') || container.closest('.section');
    if (!sectionEl) return;
    /** @type {Element} */
    const section = sectionEl;

    /**
     * Gather all product items currently in the DOM.
     * We re-query each time because infinite scroll may have added cards.
     * @returns {HTMLElement[]}
     */
    function getItems() {
      return /** @type {HTMLElement[]} */ (
        Array.from(section.querySelectorAll('.product-grid__item[data-product-title]'))
      );
    }

    /**
     * Run the filter.
     * @param {string} raw - raw query string
     */
    function filterProducts(raw) {
      const query = raw.trim().toLowerCase();
      const items = getItems();

      // Toggle clear button visibility
      if (clearBtn) {
        clearBtn.hidden = query.length === 0;
      }

      // If query is too short, show everything
      if (query.length < MIN_QUERY_LENGTH) {
        items.forEach((item) => {
          item.removeAttribute('data-kc-hidden');
        });
        announceStatus('');
        toggleNoResults(false, '');
        return;
      }

      // Split query into individual terms for multi-word matching
      const terms = query.split(/\s+/).filter(Boolean);

      let visible = 0;

      items.forEach((item) => {
        const title = item.dataset.productTitle || '';
        const type = item.dataset.productType || '';
        const vendor = item.dataset.productVendor || '';
        const haystack = title + ' ' + type + ' ' + vendor;

        // Every term must appear somewhere in the haystack
        const matches = terms.every((t) => haystack.includes(t));

        if (matches) {
          item.removeAttribute('data-kc-hidden');
          visible++;
        } else {
          item.setAttribute('data-kc-hidden', 'true');
        }
      });

      announceStatus(
        visible === 0
          ? 'No products found for "' + raw.trim() + '".'
          : visible + ' product' + (visible === 1 ? '' : 's') + ' found.'
      );

      // Show / hide a no-results message inside the grid
      toggleNoResults(visible === 0, raw.trim());
    }

    /**
     * Update the live-region for screen readers.
     * @param {string} msg
     */
    function announceStatus(msg) {
      if (statusEl) statusEl.textContent = msg;
    }

    /**
     * Show or hide a "no results" message block.
     * @param {boolean} show
     * @param {string} query
     */
    function toggleNoResults(show, query) {
      const grid = section.querySelector('.product-grid');
      if (!grid || !grid.parentElement) return;

      let msg = /** @type {HTMLElement | null} */ (
        grid.parentElement.querySelector('.kc-search__no-results')
      );

      if (show) {
        if (!msg) {
          msg = document.createElement('div');
          msg.className = 'kc-search__no-results';
          grid.parentElement.insertBefore(msg, grid);
        }
        msg.innerHTML =
          'No kitchen cabinets match <strong>"' + escapeHtml(query) + '"</strong>. Try a different search term.';
        msg.hidden = false;
      } else if (msg) {
        msg.hidden = true;
      }
    }

    /**
     * Basic HTML-escape to prevent XSS from the search input.
     * @param {string} str
     * @returns {string}
     */
    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    // --- Event listeners ---

    const debouncedFilter = debounce(() => filterProducts(input.value), DEBOUNCE_MS);

    input.addEventListener('input', /** @type {EventListener} */ (debouncedFilter));

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        input.value = '';
        filterProducts('');
        input.focus();
      });
    }

    // Run once in case the page loaded with a value already filled
    if (input.value.length >= MIN_QUERY_LENGTH) {
      filterProducts(input.value);
    }
  }

  // --- Bootstrap ---

  function init() {
    document.querySelectorAll('[data-kc-search]').forEach((el) => initSearch(el));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  // Re-init after Shopify section rendering (theme editor live reload)
  document.addEventListener('shopify:section:load', (e) => {
    const target = /** @type {HTMLElement | null} */ (e.target);
    if (!target) return;
    const container = target.querySelector('[data-kc-search]');
    if (container) initSearch(container);
  });
})();
