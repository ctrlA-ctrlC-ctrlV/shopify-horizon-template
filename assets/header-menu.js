import { Component } from '@theme/component';

/**
 * HeaderMenu custom element that manages desktop dropdown/mega-menu behavior.
 *
 * Handles hover/focus activation of submenu panels with animated height transitions
 * and manages the overflow "More" menu state.
 *
 * @typedef {object} HeaderMenuRefs
 * @property {HTMLElement} overflowMenu - The overflow-list element wrapping the menu.
 * @property {HTMLElement} headerMenu - Self-reference (unused but declared in parent).
 * @property {HTMLElement[]} submenu - Array of submenu panel elements.
 * @property {HTMLElement[]} menuitem - Array of menu item anchor/button elements.
 *
 * @extends {Component<HeaderMenuRefs>}
 */
class HeaderMenu extends Component {
    /**
     * The delay (ms) before closing a submenu, allowing pointer to travel into it.
     * @type {number}
     */
    get #animationDelay() {
        return parseInt(this.dataset.animationDelay ?? '200', 10);
    }

    /**
     * Timeout ID for deferred deactivation.
     * @type {number | null}
     */
    #deactivateTimeout = null;

    /**
     * The currently active list-item element (if any).
     * @type {HTMLElement | null}
     */
    #activeItem = null;

    connectedCallback() {
        super.connectedCallback();

        // Close any open submenu when the pointer leaves the entire header-menu area
        this.addEventListener('pointerleave', this.#onPointerLeave);

        // Close submenus on Escape
        this.addEventListener('keydown', this.#onKeyDown);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener('pointerleave', this.#onPointerLeave);
        this.removeEventListener('keydown', this.#onKeyDown);
    }

    // ───────────────────────────────────────────────
    // Public methods called via `on:` declarative events
    // ───────────────────────────────────────────────

    /**
     * Activate (open) the submenu for the hovered/focused list-item.
     * Called by `on:pointerenter="/activate"` and `on:focus="/activate"`.
     *
     * @param {Event} event
     */
    activate(event) {
        const listItem = this.#getListItem(event);
        if (!listItem) return;

        // Cancel any pending close
        this.#clearDeactivateTimeout();

        // If this item is already active, nothing to do
        if (this.#activeItem === listItem) return;

        // Deactivate the previously open item immediately
        if (this.#activeItem) {
            this.#closeSubmenu(this.#activeItem, true);
        }

        this.#activeItem = listItem;
        this.#openSubmenu(listItem);
    }

    /**
     * Deactivate (close) the submenu for the un-hovered/blurred list-item.
     * Called by `on:pointerleave="/deactivate"` and `on:blur="/deactivate"`.
     *
     * @param {Event} event
     */
    deactivate(event) {
        const listItem = this.#getListItem(event);
        if (!listItem) return;

        // Delay closing so the user can move their pointer into the submenu
        this.#clearDeactivateTimeout();
        this.#deactivateTimeout = setTimeout(() => {
            this.#closeSubmenu(listItem, false);
            if (this.#activeItem === listItem) {
                this.#activeItem = null;
            }
            this.#updateSubmenuBackground();
        }, this.#animationDelay);
    }

    // ───────────────────────────────────────────────
    // Private helpers
    // ───────────────────────────────────────────────

    /**
     * Open the submenu for a given list-item.
     * @param {HTMLElement} listItem
     */
    #openSubmenu(listItem) {
        const trigger = listItem.querySelector('[aria-haspopup]');
        if (!trigger) return;

        // Mark as animating briefly for CSS transition purposes
        trigger.setAttribute('data-animating', '');
        trigger.setAttribute('aria-expanded', 'true');

        // Update the shared submenu background height
        this.#updateSubmenuBackground();

        // Remove the animating flag after the transition
        requestAnimationFrame(() => {
            setTimeout(() => {
                trigger.removeAttribute('data-animating');
            }, this.#animationDelay);
        });

        // If this is an overflow item, mark the overflow as expanded
        if (listItem.getAttribute('slot') === 'overflow') {
            this.dataset.overflowExpanded = 'true';
        }
    }

    /**
     * Close the submenu for a given list-item.
     * @param {HTMLElement} listItem
     * @param {boolean} immediate - Skip animation delay
     */
    #closeSubmenu(listItem, immediate) {
        const trigger = listItem.querySelector('[aria-haspopup]');
        if (!trigger) return;

        if (immediate) {
            trigger.setAttribute('data-animating', '');
        }

        trigger.setAttribute('aria-expanded', 'false');

        if (immediate) {
            requestAnimationFrame(() => {
                trigger.removeAttribute('data-animating');
            });
        }

        // If this is an overflow item, mark the overflow as collapsed
        if (listItem.getAttribute('slot') === 'overflow') {
            this.dataset.overflowExpanded = 'false';
        }
    }

    /**
     * Measure the active submenu panel and set `--submenu-height` on the overflow wrapper
     * so the CSS background/clip-path animation can use it.
     */
    #updateSubmenuBackground() {
        const overflowMenu = this.refs.overflowMenu;
        if (!overflowMenu) return;

        let maxHeight = 0;

        // Find the currently expanded submenu
        if (this.#activeItem) {
            const submenu = this.#activeItem.querySelector('.menu-list__submenu');
            if (submenu) {
                const inner = submenu.querySelector('.menu-list__submenu-inner');
                if (inner) {
                    maxHeight = inner.scrollHeight;
                }
            }
        }

        overflowMenu.style.setProperty('--submenu-height', maxHeight > 0 ? `${maxHeight}px` : '0px');
        overflowMenu.style.setProperty('--submenu-opacity', maxHeight > 0 ? '1' : '0');
    }

    /**
     * Resolve the `.menu-list__list-item` ancestor from an event target.
     * @param {Event} event
     * @returns {HTMLElement | null}
     */
    #getListItem(event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return null;
        return target.closest('.menu-list__list-item');
    }

    /**
     * Clear any pending deactivation timeout.
     */
    #clearDeactivateTimeout() {
        if (this.#deactivateTimeout !== null) {
            clearTimeout(this.#deactivateTimeout);
            this.#deactivateTimeout = null;
        }
    }

    /**
     * Close all open submenus when the pointer fully leaves the header-menu.
     */
    #onPointerLeave = () => {
        this.#clearDeactivateTimeout();
        this.#deactivateTimeout = setTimeout(() => {
            this.#closeAllSubmenus();
        }, this.#animationDelay);
    };

    /**
     * Handle keyboard interactions.
     * @param {KeyboardEvent} event
     */
    #onKeyDown = (event) => {
        if (event.key === 'Escape') {
            this.#closeAllSubmenus();
            // Return focus to the trigger that opened the submenu
            if (this.#activeItem) {
                const trigger = this.#activeItem.querySelector('[aria-haspopup]');
                if (trigger instanceof HTMLElement) {
                    trigger.focus();
                }
            }
            this.#activeItem = null;
        }
    };

    /**
     * Close every open submenu.
     */
    #closeAllSubmenus() {
        const expandedTriggers = this.querySelectorAll('[aria-expanded="true"]');
        expandedTriggers.forEach((trigger) => {
            trigger.setAttribute('aria-expanded', 'false');
            trigger.removeAttribute('data-animating');
        });

        this.#activeItem = null;
        this.dataset.overflowExpanded = 'false';
        this.#updateSubmenuBackground();
    }
}

if (!customElements.get('header-menu')) {
    customElements.define('header-menu', HeaderMenu);
}
