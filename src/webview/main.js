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

  /**
   * Determine whether this object can show table view, tree view, or both.
   * @param {RObjectInfo} obj
   * @returns {{ canTable: boolean, canTree: boolean }}
   */
  function getViewCapabilities(obj) {
    if (obj.viewType === 'table') {
      // Table objects always have data; they also have tree if the R script provided it
      return { canTable: true, canTree: !!obj.tree };
    }
    if (obj.viewType === 'tree') {
      // Tree objects may also have table data if R coercion succeeded
      return { canTable: !!(obj.canTable && obj.data && obj.columns), canTree: true };
    }
    return { canTable: false, canTree: false };
  }

  /**
   * Determine actual view mode for an object.
   * @param {RObjectInfo} obj
   * @returns {string}
   */
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
        render();
      });
    });
  }

  // ── View Toggle Button HTML ──
  /**
   * @param {RObjectInfo} obj
   * @returns {string}
   */
  function renderViewToggle(obj) {
    const caps = getViewCapabilities(obj);
    if (!caps.canTable || !caps.canTree) return '';

    const mode = getEffectiveViewMode(obj);
    return `
      <div class="view-toggle">
        <button class="toggle-btn ${mode === 'table' ? 'active' : ''}" data-mode="table" title="Table View">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M0 2v12h16V2H0zm5 11H1v-2h4v2zm0-3H1V8h4v2zm0-3H1V5h4v2zm10 6H6v-2h9v2zm0-3H6V8h9v2zm0-3H6V5h9v2z"/>
          </svg>
          Table
        </button>
        <button class="toggle-btn ${mode === 'tree' ? 'active' : ''}" data-mode="tree" title="Tree View">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 1h4v4H1V1zm6 0h4v4H7V1zM1 7h4v4H1V7zm6 0h4v4H7V7zM1 13h4v2H1v-2zm6 0h4v2H7v-2z"/>
          </svg>
          Tree
        </button>
      </div>
    `;
  }

  // ── Object Rendering ──
  function renderObject(/** @type {RObjectInfo} */ obj) {
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
        const mode = /** @type {HTMLElement} */ (btn).dataset.mode;
        viewModeOverride = mode || null;
        resetTableState();
        renderObject(obj);
      });
    });
  }

  // ── Table View ──
  function renderTableView(/** @type {RObjectInfo} */ obj) {
    const columns = obj.columns || [];
    const allRows = obj.data || [];
    const totalRowsInFile = obj.nrow || allRows.length;

    // Toolbar
    let toolbarHtml = `
      <div class="toolbar-info">
        <strong>${escapeHtml(obj.name)}</strong>
        — ${totalRowsInFile.toLocaleString()} rows × ${(obj.ncol || columns.length)} cols
        ${Array.isArray(obj.class) ? ' · ' + obj.class.join(', ') : ''}
      </div>
      ${renderViewToggle(obj)}
      <input class="search-box" type="text" placeholder="Search…" value="${escapeHtml(searchQuery)}">
    `;
    DOM.toolbar.innerHTML = toolbarHtml;

    // Search handler
    const searchBox = /** @type {HTMLInputElement} */ (DOM.toolbar.querySelector('.search-box'));
    searchBox.addEventListener('input', () => {
      searchQuery = searchBox.value;
      currentPage = 0;
      filteredRows = null;
      renderTableContent(columns, allRows, totalRowsInFile, obj.truncated || false);
    });

    renderTableContent(columns, allRows, totalRowsInFile, obj.truncated || false);
  }

  function renderTableContent(
    /** @type {{ name: string; type: string }[]} */ columns,
    /** @type {Record<string, unknown>[]} */ allRows,
    /** @type {number} */ totalRowsInFile,
    /** @type {boolean} */ truncated
  ) {
    // Apply search filter
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

    // Apply sort
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
        const sa = String(va);
        const sb = String(vb);
        return sortAsc ? sa.localeCompare(sb) : sb.localeCompare(sa);
      });
    }

    // Pagination
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (currentPage >= totalPages) currentPage = totalPages - 1;
    const startIdx = currentPage * PAGE_SIZE;
    const pageRows = rows.slice(startIdx, startIdx + PAGE_SIZE);

    // Build table
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

    // Truncation notice
    if (truncated) {
      html += `<div class="truncation-notice">Showing first ${allRows.length.toLocaleString()} rows (file has more). Adjust rdataPreview.maxRows to change limit.</div>`;
    }

    // Pagination controls
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
        if (sortColumn === col) {
          sortAsc = !sortAsc;
        } else {
          sortColumn = col;
          sortAsc = true;
        }
        currentPage = 0;
        renderTableContent(columns, allRows, 0, truncated);
      });
    });

    // Pagination handlers
    const bind = (/** @type {string} */ id, /** @type {() => void} */ fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };
    bind('pg-first', () => { currentPage = 0; renderTableContent(columns, allRows, 0, truncated); });
    bind('pg-prev', () => { currentPage = Math.max(0, currentPage - 1); renderTableContent(columns, allRows, 0, truncated); });
    bind('pg-next', () => { currentPage = Math.min(totalPages - 1, currentPage + 1); renderTableContent(columns, allRows, 0, truncated); });
    bind('pg-last', () => { currentPage = totalPages - 1; renderTableContent(columns, allRows, 0, truncated); });
  }

  // ── Tree View ──
  function renderTreeView(/** @type {RObjectInfo} */ obj) {
    DOM.toolbar.innerHTML = `
      <div class="toolbar-info">
        <strong>${escapeHtml(obj.name)}</strong>
        — ${Array.isArray(obj.class) ? obj.class.join(', ') : obj.class}
        ${obj.length !== undefined ? ' · ' + obj.length + ' elements' : ''}
        ${obj.nrow !== undefined ? ' · ' + obj.nrow + ' rows × ' + obj.ncol + ' cols' : ''}
      </div>
      ${renderViewToggle(obj)}
    `;

    const tree = obj.tree;
    DOM.viewContainer.innerHTML = `<div class="tree-view">${renderTreeNode('root', tree, 0, true)}</div>`;
    attachTreeHandlers();
  }

  function renderTreeNode(
    /** @type {string} */ name,
    /** @type {any} */ node,
    /** @type {number} */ depth,
    /** @type {boolean} */ expanded
  ) {
    if (!node) return '';

    const hasChildren = node.children && Object.keys(node.children).length > 0;
    const toggleClass = hasChildren ? (expanded ? 'tree-toggle expanded' : 'tree-toggle') : 'tree-toggle leaf';

    let valueStr = '';
    if (node.value !== undefined && node.value !== null) {
      if (Array.isArray(node.value)) {
        valueStr = node.value.map((/** @type {any} */ v) => JSON.stringify(v)).join(', ');
        if (node.truncated) valueStr += ', …';
      } else {
        valueStr = String(node.value);
      }
    }

    let html = `<div class="tree-node">
      <div class="tree-node-header" style="--depth: ${depth}">
        <span class="${toggleClass}">▶</span>
        <span class="tree-node-name">${escapeHtml(name)}</span>
        <span class="tree-node-type">${escapeHtml(node.type || '')}</span>
        ${valueStr ? `<span class="tree-node-value" title="${escapeHtml(valueStr)}">${escapeHtml(valueStr)}</span>` : ''}
      </div>`;

    if (hasChildren) {
      const childClass = expanded ? 'tree-children' : 'tree-children collapsed';
      html += `<div class="${childClass}">`;
      for (const [childName, childNode] of Object.entries(node.children)) {
        html += renderTreeNode(childName, childNode, depth + 1, false);
      }
      html += '</div>';
    }

    // If it's a data.frame node in tree, show inline summary
    if (node.type === 'data.frame' && node.columns) {
      const cols = /** @type {string[]} */ (node.columns);
      html += `<div class="tree-children${expanded ? '' : ' collapsed'}" style="padding-left: ${(depth + 1) * 16 + 8}px">
        <span class="tree-node-type">${node.nrow}×${node.ncol}: ${cols.slice(0, 5).join(', ')}${cols.length > 5 ? '…' : ''}</span>
      </div>`;
    }

    html += '</div>';
    return html;
  }

  function attachTreeHandlers() {
    DOM.viewContainer.querySelectorAll('.tree-node-header').forEach((header) => {
      header.addEventListener('click', () => {
        const toggle = header.querySelector('.tree-toggle');
        if (!toggle || toggle.classList.contains('leaf')) return;
        toggle.classList.toggle('expanded');
        const children = /** @type {HTMLElement | null} */ (header.nextElementSibling);
        if (children && children.classList.contains('tree-children')) {
          children.classList.toggle('collapsed');
        }
      });
    });
  }

  // ── Atomic View ──
  function renderAtomicView(/** @type {RObjectInfo} */ obj) {
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

  // ── Text View ──
  function renderTextView(/** @type {RObjectInfo} */ obj) {
    DOM.toolbar.innerHTML = `
      <div class="toolbar-info">
        <strong>${escapeHtml(obj.name)}</strong>
        — ${Array.isArray(obj.class) ? obj.class.join(', ') : obj.class}
      </div>
    `;
    DOM.viewContainer.innerHTML = `<div class="text-view"><pre>${escapeHtml(obj.value || '')}</pre></div>`;
  }

  // ── Utility ──
  function escapeHtml(/** @type {string} */ str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
