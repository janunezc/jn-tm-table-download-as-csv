// ==UserScript==
// @name         Table to CSV Downloader (Custom Context Menu)
// @namespace    https://github.com/janunezc/jn-tm-table-download-as-csv
// @version      3.0
// @description  Open-source: Download table as CSV via a custom context menu, paint tables with inline red borders, and run once page & network are idle.
// @author       José Ángel Núñez Chaves
// @match        *://*/*
// @grant        GM_addStyle
// @homepageURL  https://github.com/janunezc/jn-tm-table-download-as-csv
// @supportURL   https://github.com/janunezc/jn-tm-table-download-as-csv/issues
// @license      MIT
// @updateURL    https://github.com/janunezc/jn-tm-table-download-as-csv/raw/main/tampermonkeyjn-tm-table-csv-downloader.user.js
// ==/UserScript==

(function() {
    'use strict';
    console.log("BEGIN Tampermonkey Table CSV Downloader (v3.0)");

    // Inject styles for custom menu
    GM_addStyle(`
        #tm-csv-menu {
            position: absolute;
            background: white;
            border: 1px solid #ccc;
            padding: 0;
            margin: 0;
            list-style: none;
            z-index: 99999;
            font-family: sans-serif;
        }
        #tm-csv-menu li {
            padding: 8px 12px;
            cursor: pointer;
        }
        #tm-csv-menu li:hover {
            background: #eee;
        }
    `);

    let lastRightClickedTable = null;

    // Create custom context menu
    const menu = document.createElement('ul');
    menu.id = 'tm-csv-menu';
    menu.style.display = 'none';
    const menuItem = document.createElement('li');
    menuItem.textContent = 'Download table as CSV';
    menuItem.addEventListener('click', () => {
        if (lastRightClickedTable) {
            exportTableToCSV(lastRightClickedTable);
        }
        hideMenu();
    });
    menu.appendChild(menuItem);
    document.body.appendChild(menu);

    // Hide menu on any left-click
    document.addEventListener('click', () => hideMenu());

    function showMenu(x, y) {
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.style.display = 'block';
    }

    function hideMenu() {
        menu.style.display = 'none';
    }

    // Paint tables and bind right-click
    function addRedBorderAndContext() {
        document.querySelectorAll('table').forEach(tbl => {
            tbl.style.border = '3pt solid red';
            tbl.style.borderCollapse = 'collapse';

            // Decide target cells: headers or first-row
            const headerCells = tbl.querySelectorAll('th');
            const targets = headerCells.length ? Array.from(headerCells) : (tbl.rows[0] ? Array.from(tbl.rows[0].cells) : []);

            targets.forEach(cell => {
                cell.style.color = 'red';
                cell.addEventListener('contextmenu', e => {
                    e.preventDefault();
                    lastRightClickedTable = tbl;
                    showMenu(e.pageX, e.pageY);
                });
            });
        });
    }

    // Export a table element to CSV and trigger download
    function exportTableToCSV(table) {
        const rows = Array.from(table.rows);
        const csv = rows.map(row => {
            return Array.from(row.cells).map(cell => {
                const text = cell.innerText.replace(/"/g, '""');
                return `"${text}"`;
            }).join(',');
        }).join('\r\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `table-${new Date().toISOString().slice(0,19)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Wait for network idle before initializing
    function waitForNetworkIdle(idleMs = 2000) {
        return new Promise(resolve => {
            let timer;
            const obs = new PerformanceObserver(() => resetTimer());
            obs.observe({ type: 'resource', buffered: true });
            function resetTimer() {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    obs.disconnect();
                    resolve();
                }, idleMs);
            }
            resetTimer();
        });
    }

    // Intercept fetch and XHR to bump performance marks
    (function() {
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            perfBump();
            return originalFetch.apply(this, args)
                .finally(() => perfBump());
        };
        const origOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(...args) {
            this.addEventListener('loadstart', perfBump);
            this.addEventListener('loadend', perfBump);
            return origOpen.apply(this, args);
        };
        function perfBump() {
            performance.mark(`bump-${Math.random()}`);
        }
    })();

    window.addEventListener('load', () => {
        console.log("Page loaded, waiting for network idle...");
        waitForNetworkIdle(2000).then(() => {
            console.log("Network idle, initializing...");
            addRedBorderAndContext();
        });
    });
})();
