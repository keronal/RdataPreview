// @ts-check
/** @typedef {import('../rBridge').RDataResult} RDataResult */
/** @typedef {import('../rBridge').RObjectInfo} RObjectInfo */

(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi();

  const DOM = {
    loading: /** @type {HTMLElement} */ (document.getElementById('loading')),
    error: /** @type {HTMLElement} */ (document.getElementById('error')),
    content: /** @type {HTMLElement} */ (document.getElementById('content')),
    sidebar: /** @type {HTMLElement} */ (document.getElementById('sidebar')),
    toolbar: /** @type {HTMLElement} */ (document.getElementById('toolbar')),
    viewContainer: /** @type {HTMLElement} */ (document.getElementById('view-container')),
  };

  /** @type {RDataResult | null} */
  let currentData = null;
  let activeObjectIndex = 0;

  // Table state
  const PAGE_SIZE = 100;
  let currentPage = 0;
  let sortColumn = -1;
  let sortAsc = true;
  let searchQuery = '';
  /** @type {Record<string, unknown>[] | null} */
  let filteredRows = null;

  // View mode override: null = auto, 'table', 'tree'
  /** @type {string | null} */
  let viewModeOverride = null;

  // Tree search
  let treeSearchQuery = '';

  // ── Message Handler ──
  window.addEventListener('message', (event) => {
    const msg = event.data;
    switch (msg.type) {
      case 'loading':
        show('loading');
        break;
      case 'error':
        showError(msg.message);
        break;
      case 'data':
        currentData = msg.payload;
        activeObjectIndex = 0;
        resetTableState();
        viewModeOverride = null;
        treeSearchQuery = '';
        render();
        break;
    }
  });

  function show(/** @type {'loading' | 'error' | 'content'} */ section) {
    DOM.loading.classList.toggle('hidden', section !== 'loading');
    DOM.error.classList.toggle('hidden', section !== 'error');
    DOM.content.classList.toggle('hidden', section !== 'content');
  }

  function showError(/** @type {string} */ message) {
    show('error');
    DOM.error.innerHTML = `
      <div class="error-icon">⚠️</div>
      <div class="error-message">${escapeHtml(message)}</div>
    `;
  }

  function resetTableState() {
    currentPage = 0;
    sortColumn = -1;
    sortAsc = true;
    searchQuery = '';
    filteredRows = null;
  }

  /** @param {RObjectInfo} obj */
  function getViewCapabilities(obj) {
    if (obj.viewType === 'table') {
      return { canTable: true, canTree: !!obj.tree };
    }
    if (obj.viewType === 'tree') {
      return { canTable: !!(obj.canTable && obj.data && obj.columns), canTree: true };
    }
    return { canTable: false, canTree: false };
  }

  /** @param {RObjectInfo} obj */
  function getEffectiveViewMode(obj) {
    const caps = getViewCapabilities(obj);
    if (viewModeOverride) {
      if (viewModeOverride === 'table' && caps.canTable) return 'table';
      if (viewModeOverride === 'tree' && caps.canTree) return 'tree';
    }
    return obj.viewType;
  }

  // ── Main Render ──
  function render() {
    if (!currentData || !currentData.objects || currentData.objects.length === 0) {
      showError('No objects found in file.');
      return;
    }
    show('content');
    renderSidebar();
    renderObject(currentData.objects[activeObjectIndex]);
  }

  // ── Sidebar ──
  function renderSidebar() {
    if (!currentData) return;
    const objects = currentData.objects;
    if (objects.length <= 1) {
      DOM.sidebar.classList.add('single-object');
      return;
    }
    DOM.sidebar.classList.remove('single-object');

    let html = '<div class="sidebar-title">Objects</div>';
    objects.forEach((obj, idx) => {
      const active = idx === activeObjectIndex ? ' active' : '';
      const typeLabel = Array.isArray(obj.class) ? obj.class[0] : obj.class;
      html += `
        <div class="sidebar-item${active}" data-index="${idx}">
          <span>${escapeHtml(obj.name)}</span>
          <span class="type-badge">${escapeHtml(typeLabel)}</span>
        </div>
      `;
    });
    DOM.sidebar.innerHTML = html;

    DOM.sidebar.querySelectorAll('.sidebar-item').forEach((el) => {
      el.addEventListener('click', () => {
        activeObjectIndex = parseInt(/** @type {HTMLElement} */ (el).dataset.index || '0', 10);
        resetTableState();
        viewModeOverride = null;
        treeSearchQuery = '';
        render();
      });
    });
  }

  // ── View Toggle ──
  /** @param {RObjectInfo} obj */
  function renderViewToggle(obj) {
    const caps = getViewCapabilities(obj);
    if (!caps.canTable || !caps.canTree) return '';
    const mode = getEffectiveViewMode(obj);
    return `
      <div class="view-toggle">
        <button class="toggle-btn ${mode === 'table' ? 'active' : ''}" data-mode="table" title="Table View">⊞ Table</button>
        <button class="toggle-btn ${mode === 'tree' ? 'active' : ''}" data-mode="tree" title="Tree View">⊟ Tree</button>
      </div>
    `;
  }

  // ── Object Rendering ──
  /** @param {RObjectInfo} obj */
  function renderObject(obj) {
    const mode = getEffectiveViewMode(obj);
    switch (mode) {
      case 'table':
        renderTableView(obj);
        break;
      case 'tree':
        renderTreeView(obj);
        break;
      case 'atomic':
        renderAtomicView(obj);
        break;
      case 'function':
      case 'text':
        renderTextView(obj);
        break;
      case 'null':
        renderTextView({ ...obj, value: 'NULL' });
        break;
      default:
        renderTextView({ ...obj, value: obj.value || JSON.stringify(obj, null, 2) });
    }

    // Attach toggle handlers
    DOM.toolbar.querySelectorAll('.toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        viewModeOverride = /** @type {HTMLElement} */ (btn).dataset.mode || null;
        resetTableState();
        renderObject(obj);
      });
    });
  }

  // ══════════════════════════════════════════
  // ██  TABLE VIEW
  // ══════════════════════════════════════════

  /** @param {RObjectInfo} obj */
  function renderTableView(obj) {
    const columns = obj.columns || [];
    const allRows = obj.data || [];
    const totalRowsInFile = obj.nrow || allRows.length;

    DOM.toolbar.innerHTML = `
      <div class="toolbar-info">
        <strong>${escapeHtml(obj.name)}</strong>
        — ${totalRowsInFile.toLocaleString()} rows × ${(obj.ncol || columns.length)} cols
        ${Array.isArray(obj.class) ? ' · ' + obj.class.join(', ') : ''}
      </div>
      ${renderViewToggle(obj)}
      <input class="search-box" type="text" placeholder="Search…" value="${escapeHtml(searchQuery)}">
    `;

    const searchBox = /** @type {HTMLInputElement} */ (DOM.toolbar.querySelector('.search-box'));
    searchBox.addEventListener('input', () => {
      searchQuery = searchBox.value;
      currentPage = 0;
      filteredRows = null;
      renderTableContent(columns, allRows, totalRowsInFile, obj.truncated || false);
    });

    renderTableContent(columns, allRows, totalRowsInFile, obj.truncated || false);
  }

  /**
   * @param {{ name: string; type: string }[]} columns
   * @param {Record<string, unknown>[]} allRows
   * @param {number} totalRowsInFile
   * @param {boolean} truncated
   */
  function renderTableContent(columns, allRows, totalRowsInFile, truncated) {
    let rows = allRows;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rows = allRows.filter((row) =>
        columns.some((col) => {
          const val = row[col.name];
          return val !== null && val !== undefined && String(val).toLowerCase().includes(q);
        })
      );
    }
    filteredRows = rows;

    if (sortColumn >= 0 && sortColumn < columns.length) {
      const colName = columns[sortColumn].name;
      rows = [...rows].sort((a, b) => {
        const va = a[colName];
        const vb = b[colName];
        if (va === null || va === undefined) return 1;
        if (vb === null || vb === undefined) return -1;
        if (typeof va === 'number' && typeof vb === 'number') {
          return sortAsc ? va - vb : vb - va;
        }
        return sortAsc
          ? String(va).localeCompare(String(vb))
          : String(vb).localeCompare(String(va));
      });
    }

    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (currentPage >= totalPages) currentPage = totalPages - 1;
    const startIdx = currentPage * PAGE_SIZE;
    const pageRows = rows.slice(startIdx, startIdx + PAGE_SIZE);

    let html = '<div class="table-wrapper"><table class="data-table"><thead><tr>';
    html += '<th class="row-index-header">#</th>';
    columns.forEach((col, idx) => {
      const isSort = sortColumn === idx;
      const arrow = isSort ? (sortAsc ? '▲' : '▼') : '▲';
      const arrowClass = isSort ? 'sort-arrow active' : 'sort-arrow';
      html += `<th data-col="${idx}">
        ${escapeHtml(col.name)}
        <span class="col-type">&lt;${escapeHtml(col.type)}&gt;</span>
        <span class="${arrowClass}">${arrow}</span>
      </th>`;
    });
    html += '</tr></thead><tbody>';

    pageRows.forEach((row, rowIdx) => {
      html += '<tr>';
      html += `<td class="row-index">${startIdx + rowIdx + 1}</td>`;
      columns.forEach((col) => {
        const val = row[col.name];
        if (val === null || val === undefined || val === 'NA') {
          html += `<td><span class="na-value">NA</span></td>`;
        } else {
          html += `<td title="${escapeHtml(String(val))}">${escapeHtml(String(val))}</td>`;
        }
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';

    if (truncated) {
      html += `<div class="truncation-notice">Showing first ${allRows.length.toLocaleString()} rows. Adjust rdataPreview.maxRows to change limit.</div>`;
    }
    if (totalPages > 1) {
      html += `<div class="pagination">
        <button id="pg-first" ${currentPage === 0 ? 'disabled' : ''}>⟪</button>
        <button id="pg-prev" ${currentPage === 0 ? 'disabled' : ''}>◀</button>
        <span class="page-info">${currentPage + 1} / ${totalPages}
          (${rows.length.toLocaleString()} rows${searchQuery ? ' filtered' : ''})</span>
        <button id="pg-next" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>▶</button>
        <button id="pg-last" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>⟫</button>
      </div>`;
    }

    DOM.viewContainer.innerHTML = html;

    // Sort handlers
    DOM.viewContainer.querySelectorAll('th[data-col]').forEach((th) => {
      th.addEventListener('click', () => {
        const col = parseInt(/** @type {HTMLElement} */ (th).dataset.col || '0', 10);
        if (sortColumn === col) { sortAsc = !sortAsc; }
        else { sortColumn = col; sortAsc = true; }
        currentPage = 0;
        renderTableContent(columns, allRows, 0, truncated);
      });
    });

    const bind = (/** @type {string} */ id, /** @type {() => void} */ fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };
    bind('pg-first', () => { currentPage = 0; renderTableContent(columns, allRows, 0, truncated); });
    bind('pg-prev', () => { currentPage = Math.max(0, currentPage - 1); renderTableContent(columns, allRows, 0, truncated); });
    bind('pg-next', () => { currentPage = Math.min(totalPages - 1, currentPage + 1); renderTableContent(columns, allRows, 0, truncated); });
    bind('pg-last', () => { currentPage = totalPages - 1; renderTableContent(columns, allRows, 0, truncated); });
  }

  // ══════════════════════════════════════════
  // ██  TREE VIEW (enhanced)
  // ══════════════════════════════════════════

  /** @param {RObjectInfo} obj */
  function renderTreeView(obj) {
    DOM.toolbar.innerHTML = `
      <div class="toolbar-info">
        <strong>${escapeHtml(obj.name)}</strong>
        — ${Array.isArray(obj.class) ? obj.class.join(', ') : obj.class}
        ${obj.length !== undefined ? ' · ' + obj.length + ' elements' : ''}
        ${obj.nrow !== undefined ? ' · ' + obj.nrow + ' rows × ' + obj.ncol + ' cols' : ''}
      </div>
      ${renderViewToggle(obj)}
      <input class="search-box tree-search" type="text" placeholder="Filter keys…" value="${escapeHtml(treeSearchQuery)}">
      <button class="toolbar-btn" id="expand-all" title="Expand All">⊞ Expand</button>
      <button class="toolbar-btn" id="collapse-all" title="Collapse All">⊟ Collapse</button>
    `;

    // Search handler
    const searchBox = /** @type {HTMLInputElement} */ (DOM.toolbar.querySelector('.tree-search'));
    searchBox.addEventListener('input', () => {
      treeSearchQuery = searchBox.value;
      renderTreeContent(obj);
    });

    renderTreeContent(obj);

    // Expand/collapse all handlers
    document.getElementById('expand-all')?.addEventListener('click', () => {
      DOM.viewContainer.querySelectorAll('.tree-children.collapsed').forEach((el) => el.classList.remove('collapsed'));
      DOM.viewContainer.querySelectorAll('.tree-toggle').forEach((el) => {
        if (!el.classList.contains('leaf')) el.classList.add('expanded');
      });
    });
    document.getElementById('collapse-all')?.addEventListener('click', () => {
      DOM.viewContainer.querySelectorAll('.tree-children').forEach((el) => el.classList.add('collapsed'));
      DOM.viewContainer.querySelectorAll('.tree-toggle.expanded').forEach((el) => el.classList.remove('expanded'));
    });
  }

  /** @param {RObjectInfo} obj */
  function renderTreeContent(obj) {
    const tree = obj.tree;
    const html = `<div class="tree-view">${renderTreeNode('root', tree, 0, true)}</div>`;
    DOM.viewContainer.innerHTML = html;
    attachTreeHandlers();
  }

  /**
   * Check if a tree node (or any of its descendants) matches the search query.
   * @param {string} name
   * @param {any} node
   * @param {string} query
   * @returns {boolean}
   */
  function treeNodeMatches(name, node, query) {
    if (!query) return true;
    const q = query.toLowerCase();
    if (name.toLowerCase().includes(q)) return true;
    // Check value
    if (node.value !== undefined && node.value !== null) {
      const valStr = Array.isArray(node.value) ? node.value.join(', ') : String(node.value);
      if (valStr.toLowerCase().includes(q)) return true;
    }
    if (node.type && node.type.toLowerCase().includes(q)) return true;
    // Check children recursively
    if (node.children) {
      for (const [childName, childNode] of Object.entries(node.children)) {
        if (treeNodeMatches(childName, childNode, query)) return true;
      }
    }
    return false;
  }

  /**
   * @param {string} name
   * @param {any} node
   * @param {number} depth
   * @param {boolean} expanded
   * @returns {string}
   */
  function renderTreeNode(name, node, depth, expanded) {
    if (!node) return '';

    // Filter by search
    if (treeSearchQuery && !treeNodeMatches(name, node, treeSearchQuery)) {
      return '';
    }
    // If searching, auto-expand matches
    if (treeSearchQuery) expanded = true;

    const hasChildren = node.children && Object.keys(node.children).length > 0;
    const hasInlineTable = (node.type === 'data.frame' || node.type.startsWith('matrix[')) && node.data;
    const isExpandable = hasChildren || hasInlineTable;
    const toggleClass = isExpandable
      ? (expanded ? 'tree-toggle expanded' : 'tree-toggle')
      : 'tree-toggle leaf';

    // Format value display
    let valueHtml = '';
    if (node.value !== undefined && node.value !== null) {
      valueHtml = formatTreeValue(node);
    }

    // Type badge
    const typeStr = node.type || '';
    const typeBadgeClass = getTypeBadgeClass(typeStr);

    let html = `<div class="tree-node">
      <div class="tree-node-header" style="--depth: ${depth}">
        <span class="${toggleClass}">▶</span>
        <span class="tree-node-name">${escapeHtml(name)}</span>
        <span class="tree-type-badge ${typeBadgeClass}">${escapeHtml(typeStr)}</span>
        ${valueHtml}
      </div>`;

    // Children (list items)
    if (hasChildren) {
      const childClass = expanded ? 'tree-children' : 'tree-children collapsed';
      html += `<div class="${childClass}">`;
      for (const [childName, childNode] of Object.entries(node.children)) {
        html += renderTreeNode(childName, childNode, depth + 1, false);
      }
      html += '</div>';
    }

    // Inline data.frame table
    if (hasInlineTable) {
      html += renderInlineTable(node, depth, expanded);
    }

    html += '</div>';
    return html;
  }

  /**
   * Render an inline mini-table for data.frame nodes inside a tree.
   * @param {any} node
   * @param {number} depth
   * @param {boolean} expanded
   * @returns {string}
   */
  function renderInlineTable(node, depth, expanded) {
    const columns = node.columns || [];
    const rows = node.data || [];
    if (!Array.isArray(columns) || columns.length === 0) return '';

    const childClass = expanded ? 'tree-children inline-table-wrapper' : 'tree-children inline-table-wrapper collapsed';
    let html = `<div class="${childClass}" style="--depth: ${depth}">`;
    html += `<div class="inline-table-info">${node.nrow} rows × ${node.ncol} cols${node.truncated ? ' (truncated)' : ''}</div>`;
    html += '<div class="inline-table-scroll"><table class="inline-table"><thead><tr>';

    // Column headers
    columns.forEach((col) => {
      const colName = typeof col === 'string' ? col : col.name;
      const colType = typeof col === 'object' && col.type ? col.type : '';
      html += `<th>${escapeHtml(colName)}${colType ? `<span class="col-type"> &lt;${escapeHtml(colType)}&gt;</span>` : ''}</th>`;
    });
    html += '</tr></thead><tbody>';

    // Rows (show up to 50 inline)
    const displayRows = rows.slice(0, 50);
    displayRows.forEach((row) => {
      html += '<tr>';
      columns.forEach((col) => {
        const colName = typeof col === 'string' ? col : col.name;
        const val = row[colName];
        if (val === null || val === undefined || val === 'NA') {
          html += `<td><span class="na-value">NA</span></td>`;
        } else {
          html += `<td>${escapeHtml(String(val))}</td>`;
        }
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';

    if (rows.length > 50) {
      html += `<div class="inline-table-more">Showing 50 of ${rows.length} rows</div>`;
    }
    html += '</div>';
    return html;
  }

  /**
   * Format a tree node value for display.
   * @param {any} node
   * @returns {string}
   */
  function formatTreeValue(node) {
    if (node.value === undefined || node.value === null) return '';

    if (Array.isArray(node.value)) {
      const items = node.value.map((/** @type {any} */ v) => {
        if (v === null) return '<span class="na-value">NA</span>';
        if (typeof v === 'string') return `<span class="val-string">"${escapeHtml(v)}"</span>`;
        if (typeof v === 'boolean') return `<span class="val-bool">${v}</span>`;
        return `<span class="val-num">${v}</span>`;
      });
      let display = items.slice(0, 8).join(', ');
      if (items.length > 8 || node.truncated) display += ', <span class="val-ellipsis">…</span>';
      return `<span class="tree-node-value">[${display}]</span>`;
    }

    const v = node.value;
    if (typeof v === 'string') {
      const truncated = v.length > 80 ? v.slice(0, 80) + '…' : v;
      return `<span class="tree-node-value"><span class="val-string">"${escapeHtml(truncated)}"</span></span>`;
    }
    if (typeof v === 'number') {
      return `<span class="tree-node-value"><span class="val-num">${v}</span></span>`;
    }
    if (typeof v === 'boolean') {
      return `<span class="tree-node-value"><span class="val-bool">${v}</span></span>`;
    }
    return `<span class="tree-node-value">${escapeHtml(String(v))}</span>`;
  }

  /**
   * Get CSS class for type badge based on type name.
   * @param {string} type
   * @returns {string}
   */
  function getTypeBadgeClass(type) {
    if (type.startsWith('integer') || type.startsWith('numeric') || type.startsWith('double')) return 'type-num';
    if (type.startsWith('character')) return 'type-chr';
    if (type.startsWith('logical')) return 'type-lgl';
    if (type.startsWith('factor')) return 'type-fct';
    if (type === 'data.frame') return 'type-df';
    if (type.startsWith('matrix')) return 'type-df';
    if (type.startsWith('list')) return 'type-list';
    if (type === 'NULL') return 'type-null';
    return '';
  }

  function attachTreeHandlers() {
    DOM.viewContainer.querySelectorAll('.tree-node-header').forEach((header) => {
      header.addEventListener('click', () => {
        const toggle = header.querySelector('.tree-toggle');
        if (!toggle || toggle.classList.contains('leaf')) return;
        toggle.classList.toggle('expanded');
        // Toggle all direct sibling tree-children divs
        let sibling = header.nextElementSibling;
        while (sibling) {
          if (sibling.classList.contains('tree-children')) {
            sibling.classList.toggle('collapsed');
          }
          sibling = sibling.nextElementSibling;
        }
      });
    });
  }

  // ══════════════════════════════════════════
  // ██  ATOMIC VIEW
  // ══════════════════════════════════════════

  /** @param {RObjectInfo} obj */
  function renderAtomicView(obj) {
    DOM.toolbar.innerHTML = `
      <div class="toolbar-info">
        <strong>${escapeHtml(obj.name)}</strong>
        — ${Array.isArray(obj.class) ? obj.class.join(', ') : obj.class}
        [${obj.length || 0}]
        ${obj.levels ? ' · ' + obj.levels.length + ' levels' : ''}
      </div>
    `;

    const values = obj.values || [];
    let html = '<div class="atomic-view">';
    html += `<div class="meta">${typeof values[0]} vector, length ${obj.length || values.length}</div>`;
    html += '<div class="atomic-values">';
    values.forEach((v) => {
      if (v === null || v === undefined) {
        html += `<span class="val na-value">NA</span>`;
      } else {
        html += `<span class="val">${escapeHtml(String(v))}</span>`;
      }
    });
    if (obj.truncated) {
      html += `<span class="val" style="opacity:0.5">… (${((obj.length || 0) - values.length).toLocaleString()} more)</span>`;
    }
    html += '</div></div>';

    if (obj.truncated) {
      html += `<div class="truncation-notice">Showing first ${values.length.toLocaleString()} values of ${(obj.length || 0).toLocaleString()}</div>`;
    }

    DOM.viewContainer.innerHTML = html;
  }

  // ══════════════════════════════════════════
  // ██  TEXT VIEW
  // ══════════════════════════════════════════

  /** @param {RObjectInfo} obj */
  function renderTextView(obj) {
    DOM.toolbar.innerHTML = `
      <div class="toolbar-info">
        <strong>${escapeHtml(obj.name)}</strong>
        — ${Array.isArray(obj.class) ? obj.class.join(', ') : obj.class}
      </div>
    `;
    DOM.viewContainer.innerHTML = `<div class="text-view"><pre>${escapeHtml(obj.value || '')}</pre></div>`;
  }

  // ── Utility ──
  /** @param {string} str */
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
