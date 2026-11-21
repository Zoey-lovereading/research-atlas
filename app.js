(() => {
  'use strict';

  const model = window.ResearchAtlasModel;
  const storageKey = 'research-atlas/project/v1';
  const views = ['overview', 'reviews', 'periods', 'timeline', 'plans'];
  const periodWidths = [3, 4, 5];
  const statuses = { idea: '构想', planned: '已计划', active: '进行中', done: '已完成' };
  const palette = ['#267e73', '#4a739a', '#a7723f', '#805b99', '#b15d6b', '#64824f'];
  const evidenceFields = [
    ['mechanism', '机制'], ['observation', '观测方法'],
    ['finding', '研究结果'], ['note', '补充笔记'],
  ];
  const layout = document.querySelector('#view');
  const header = document.querySelector('#project-header');
  const announcement = document.querySelector('#announcement');
  const importInput = document.querySelector('#project-import');
  const replaceDialog = document.querySelector('#replace-dialog');
  const projectMenu = document.querySelector('#project-menu');
  let toastTimeout;
  let pendingReplacement;
  let categoryFilter = '';
  let periodCategory = '';
  let periodWidth = 3;
  let evidenceFilter = null;
  let openBranches = null;
  let evidenceToFocus = false;
  let order = 'desc';
  let storageAvailable = true;
  let project = loadProject();

  const editor = window.ResearchAtlasEditor.mount({
    dialog: document.querySelector('#project-editor'), getProject: () => project, saveProject, notify,
  });

  function escape(value) {
    const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(value ?? '').replace(/[&<>"']/g, character => entities[character]);
  }

  function notify(message) {
    announcement.textContent = message;
    announcement.classList.add('visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => announcement.classList.remove('visible'), 5500);
  }

  function loadProject() {
    let stored;
    try {
      stored = localStorage.getItem(storageKey);
    } catch {
      storageAvailable = false;
    }
    if (stored) {
      try {
        return model.validate(JSON.parse(stored));
      } catch {
        notify('此浏览器保存的项目无法读取，已显示示例。');
      }
    }
    return model.demo();
  }

  function saveProject(value) {
    const next = model.validate(value);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      storageAvailable = true;
    } catch {
      storageAvailable = false;
    }
    project = next;
    if (!project.categories.some(category => category.id === categoryFilter)) categoryFilter = '';
    if (!project.categories.some(category => category.id === periodCategory)) periodCategory = '';
    if (evidenceFilter && !project.categories.some(category => category.id === evidenceFilter)) evidenceFilter = null;
    render();
    return storageAvailable;
  }

  function currentView() {
    const name = location.hash.slice(1);
    return views.includes(name) ? name : 'overview';
  }

  function indexProject() {
    const categories = new Map(project.categories.map(item => [item.id, item]));
    const reviews = new Map(project.reviews.map(item => [item.id, item]));
    const mappingIndexes = new Map(project.mappings.map((item, index) => [item, index]));
    const children = new Map([['', []], ...project.categories.map(item => [item.id, []])]);
    const mappings = new Map(project.categories.map(item => [item.id, []]));
    const milestones = new Map(project.categories.map(item => [item.id, []]));
    for (const item of project.categories) children.get(item.parentId).push(item);
    for (const item of project.mappings) mappings.get(item.categoryId).push(item);
    for (const item of project.milestones) {
      for (const id of item.categoryIds) milestones.get(id).push(item);
    }

    const ordered = [];
    const descendants = new Map();
    const roots = children.get('');
    for (const [index, root] of roots.entries()) {
      const color = palette[index % palette.length];
      const branch = [{ category: root, level: 0 }];
      const stack = [...children.get(root.id)].reverse().map(category => ({ category, level: 1 }));
      while (stack.length) {
        const row = stack.pop();
        branch.push(row);
        for (const category of [...children.get(row.category.id)].reverse()) {
          stack.push({ category, level: row.level + 1 });
        }
      }
      for (const [position, row] of branch.entries()) {
        ordered.push({ ...row, color });
        const ids = new Set([row.category.id]);
        for (let i = position + 1; i < branch.length && branch[i].level > row.level; i++) {
          ids.add(branch[i].category.id);
        }
        descendants.set(row.category.id, ids);
      }
    }
    return { categories, reviews, mappings, mappingIndexes, milestones, roots, children, ordered, descendants };
  }

  function render() {
    const view = currentView();
    const index = indexProject();
    for (const link of document.querySelectorAll('[data-view]')) {
      if (link.dataset.view === view) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    document.querySelector('#storage-status').textContent = storageAvailable
      ? '项目保存在此浏览器' : '存储不可用，请导出项目';
    document.querySelector('.rail-status').classList.toggle('unavailable', !storageAvailable);
    document.title = `${project.title} · 研究图谱`;
    header.innerHTML = `
      <div class="project-heading">
        <h1>${escape(project.title)}</h1>
        ${project.description ? `<p>${escape(project.description)}</p>` : ''}
      </div>`;
    layout.innerHTML = { overview, reviews, periods, timeline, plans }[view](index);
  }

  function emptyState(title, detail, section, action) {
    return `<div class="empty"><h3>${title}</h3><p>${detail}</p><button type="button" class="button" data-edit="${section}">${action}</button></div>`;
  }

  function overview(index) {
    const selected = evidenceSelection(index);
    return `
      <section class="panel">
        <div class="panel-heading"><div><h2>分类与进展</h2><p>点击分支展开子类和研究进展，再点一次即可收起。</p></div><div class="inline-actions"><button type="button" class="button" data-edit="categories">管理分类</button><button type="button" class="button" data-edit="milestones">管理进展</button></div></div>
        ${index.roots.length ? mindMap(index)
          : emptyState('还没有领域分类', '从综述原文提取主题，或者先记录一个待补证据的方向。', 'categories', '添加分类')}
      </section>
      <section class="panel evidence-panel" id="category-evidence" tabindex="-1">
        <div class="panel-heading"><div><h2>分类证据</h2><p>按分类查看各篇文献记录的机制、观测方法和研究结果。</p></div><button type="button" class="button" data-edit="mappings">管理证据</button></div>
        ${index.ordered.length ? `<div class="filters">${categorySelect(index, 'evidence-filter', selected)}</div>` : ''}
        <div id="evidence-results">${categoryEvidence(index, selected)}</div>
      </section>`;
  }

  function mindMap(index) {
    if (!openBranches) {
      const firstRoot = index.roots[0];
      const firstChild = index.children.get(firstRoot.id)[0];
      openBranches = new Set([firstRoot.id, firstChild?.id].filter(Boolean));
    }
    const branches = new Map();
    for (const { category, color, level } of [...index.ordered].reverse()) {
      const id = escape(category.id);
      const children = index.children.get(category.id);
      const milestones = [...index.milestones.get(category.id)].sort((a, b) => dateCompare(a.date, b.date));
      const parentWithProgress = [...index.descendants.get(category.id)].some(key => index.milestones.get(key).length);
      branches.set(category.id, `<li${level ? '' : ` style="--branch:${color}"`}>
        <details class="mind-branch" data-map-branch="${id}"${openBranches.has(category.id) ? ' open' : ''}>
          <summary><span class="mind-toggle" aria-hidden="true"></span><span>${escape(category.name)}</span></summary>
          <div class="branch-body">
            ${category.description ? `<p class="branch-description">${escape(category.description)}</p>` : ''}
            <div class="branch-actions"><button type="button" class="branch-link" data-evidence-category="${id}">查看分类证据 <span aria-hidden="true">↓</span></button>
            ${parentWithProgress ? `<a href="#timeline" data-category="${id}">按时间查看 <span aria-hidden="true">↗</span></a><a href="#periods" data-period-branch="${id}">按阶段比较 <span aria-hidden="true">↗</span></a>` : ''}</div>
            ${children.length ? `<ul class="mind-children">${children.map(child => branches.get(child.id)).join('')}</ul>` : ''}
            ${milestones.length ? `<ul class="mind-milestones" aria-label="${escape(category.name)}的研究进展">${milestones.map(item => mindMilestone(item, index)).join('')}</ul>` : ''}
            ${!children.length && !milestones.length ? '<p class="branch-description">此分类暂无进展记录。</p>' : ''}
          </div>
        </details>
      </li>`);
    }
    return `<div class="mind-map" role="group" aria-label="分类和研究进展思维导图">
      <div class="mind-origin">${escape(project.title)}</div>
      <ul class="mind-tree">${index.roots.map(root => branches.get(root.id)).join('')}</ul>
    </div>`;
  }

  function mindMilestone(item, index) {
    const title = `<time datetime="${escape(item.date)}">${escape(item.date)}</time><strong>${escape(item.title)}</strong>`;
    const details = `${item.description ? `<p>${escape(item.description)}</p>` : ''}${evidence(item, index)}${sourceLink(item.url, '查看出处')}`;
    return `<li class="mind-milestone">${details
      ? `<details class="mind-entry"><summary class="milestone-lead">${title}</summary><div class="milestone-details">${details}</div></details>`
      : `<div class="milestone-lead">${title}</div>`}</li>`;
  }

  function evidenceSelection(index) {
    return evidenceFilter ?? index.roots[0]?.id ?? '';
  }

  function categoryPath(category, index) {
    const names = [];
    for (let node = category; node; node = index.categories.get(node.parentId)) names.unshift(node.name);
    return names.join(' / ');
  }

  function findings(mapping) {
    const entries = evidenceFields.filter(([key]) => mapping[key]);
    return entries.length ? `<dl class="finding-list">${entries.map(([key, label]) => `<div><dt>${label}</dt><dd>${escape(mapping[key])}</dd></div>`).join('')}</dl>` : '<p class="panel-note">已关联文献，待补充证据内容。</p>';
  }

  function categoryEvidence(index, selected) {
    if (!index.ordered.length) return '<p class="panel-note">添加分类并关联文献后，可以在这里整理证据。</p>';
    const inScope = index.descendants.get(selected);
    const groups = index.ordered.filter(({ category }) =>
      (!inScope || inScope.has(category.id)) && (index.mappings.get(category.id).length || category.id === selected));
    if (!groups.length) return emptyState('暂无分类证据', '关联一篇文献并填写原文章节及相关发现。', 'mappings', '添加证据');
    return groups.map(({ category, color }) => {
      const entries = index.mappings.get(category.id);
      return `<section class="evidence-group" style="--branch:${color}"><h3>${escape(categoryPath(category, index))}</h3>
        ${entries.length ? `<div class="record-list">${entries.map(mapping => {
          const review = index.reviews.get(mapping.reviewId);
          const locator = mapping.section ? escape(mapping.section) : '待补原文位置';
          return `<article class="record evidence-record">
            <div class="record-heading"><div><h4><a href="#reviews" data-review="${escape(review.id)}" data-mapping-index="${index.mappingIndexes.get(mapping)}">${escape(review.title)}</a></h4><span class="record-label">${locator}</span></div>${sourceLink(review.url, '打开原文')}</div>
            ${findings(mapping)}</article>`;
        }).join('')}</div>` : '<p class="panel-note">此分类暂无直接证据。</p>'}
      </section>`;
    }).join('');
  }

  function sourceLink(url, text) {
    return url ? `<a class="source-link" href="${escape(url)}" target="_blank" rel="noopener noreferrer">${text} <span aria-hidden="true">↗</span></a>` : '';
  }

  function reviews(index) {
    const reviewMappings = new Map(project.reviews.map(item => [item.id, []]));
    for (const mapping of project.mappings) reviewMappings.get(mapping.reviewId).push(mapping);
    const cards = project.reviews.map(review => {
      const mappings = reviewMappings.get(review.id);
      const metadata = [review.authors, review.year].filter(value => value).map(escape).join(' · ');
      return `<article class="record review-record" tabindex="-1" data-review-card="${escape(review.id)}">
        <div class="record-heading"><div><h3>${escape(review.title)}</h3>${metadata ? `<span class="record-label">${metadata}</span>` : ''}</div>${sourceLink(review.url, '打开原文')}</div>
        ${review.summary ? `<p>${escape(review.summary)}</p>` : ''}
        <details class="review-mappings"><summary>关联的分类与证据</summary>
          ${mappings.length ? `<ul class="map-list">${mappings.map(mapping => `<li tabindex="-1" data-mapping-row="${index.mappingIndexes.get(mapping)}">
            <a href="#overview" data-evidence-category="${escape(mapping.categoryId)}">${escape(index.categories.get(mapping.categoryId).name)}</a>
            ${mapping.section ? `<span>${escape(mapping.section)}</span>` : ''}
            ${findings(mapping)}</li>`).join('')}</ul>` : '<p>还未为这篇文章录入对应的分类。</p>'}
        </details>
      </article>`;
    }).join('');
    return `<section class="panel"><div class="panel-heading"><div><h2>来源文献</h2><p>关联综述或原始研究的章节，在同一分类下对照不同文章的证据。</p></div><div class="inline-actions"><button type="button" class="button" data-edit="mappings">管理证据</button><button type="button" class="button primary" data-edit="reviews">管理文献</button></div></div>
      ${cards ? `<div class="record-list">${cards}</div>` : emptyState('还没有来源文献', '可以从约 5 篇互补的综述开始，逐篇记录出处和分类。', 'reviews', '添加文献')}</section>`;
  }

  function categorySelect(index, id = 'category-filter', selected = categoryFilter) {
    return `<label class="filter">按分类<select id="${id}">
      <option value="">全部分类</option>${index.ordered.map(({ category, level }) => `<option value="${escape(category.id)}" ${selected === category.id ? 'selected' : ''}>${'　'.repeat(Math.min(level, 4))}${escape(category.name)}</option>`).join('')}
    </select></label>`;
  }

  function filterByCategory(records, index) {
    if (!categoryFilter) return records;
    const ids = index.descendants.get(categoryFilter);
    return records.filter(record => record.categoryIds.some(id => ids.has(id)));
  }

  function recordChips(item, index) {
    return item.categoryIds.length ? `<div class="chips">${item.categoryIds.map(id => `<span class="chip">${escape(index.categories.get(id).name)}</span>`).join('')}</div>` : '';
  }

  function evidence(item, index) {
    if (!item.reviewIds.length) return '';
    return `<div class="evidence"><span>相关文献</span>${item.reviewIds.map(id => `<a href="#reviews" data-review="${escape(id)}">${escape(index.reviews.get(id).title)}</a>`).join('')}</div>`;
  }

  function dateCompare(a, b) {
    return a.localeCompare(b, 'en');
  }

  function periods(index) {
    const selected = index.categories.get(periodCategory);
    const branches = selected ? index.children.get(selected.id) : index.roots;
    const rows = branches.map(branch => `<li class="period-branch"><button type="button" class="branch-link" data-period-branch="${escape(branch.id)}">${escape(branch.name)}</button>
      <p>${escape(branch.description || '待补充研究内容。')}</p></li>`).join('');
    const branchOverview = selected
      ? `<div class="period-scope"><h3>${escape(categoryPath(selected, index))}</h3><p>${escape(selected.description || '待补充研究内容。')}</p>
        <a class="branch-link" href="#overview" data-evidence-category="${escape(selected.id)}">查看分类依据 <span aria-hidden="true">↗</span></a></div>`
      : `<h3>研究分支</h3><p class="panel-note">已整理 ${index.roots.length} 个一级分支，${index.categories.size - index.roots.length} 个子分类。</p>`;
    return `<section class="panel period-panel"><div class="panel-heading"><div><h2>综述分期</h2><p>按原始成果年份回顾各分支，比较已有基线与新增进展。</p></div>
      <div class="inline-actions"><a class="button" href="skills/review-chronology/SKILL.md" download="review-chronology-SKILL.md">下载分析技能</a><button type="button" class="button primary" data-edit="milestones">管理进展</button></div></div>
      <div class="period-taxonomy">${branchOverview}${rows ? `<ul class="period-branches">${rows}</ul>` : ''}</div>
      <div class="filters">${categorySelect(index, 'period-category', periodCategory)}<label class="filter">每段年数<select id="period-width">
        ${periodWidths.map(width => `<option value="${width}" ${periodWidth === width ? 'selected' : ''}>${width} 年</option>`).join('')}
      </select></label></div>
      ${periodTimeline(index, selected, branches)}</section>`;
  }

  function periodTimeline(index, selected, branches) {
    const records = [...project.milestones].sort((a, b) => dateCompare(a.date, b.date));
    if (!records.length) return emptyState('暂无分期进展', '记录成果的发表年份，并填写它在原有基础上带来的变化。', 'milestones', '添加进展');

    const firstYear = Number(records[0].date.slice(0, 4));
    const lastYear = Number(records.at(-1).date.slice(0, 4));
    const bands = Array.from({ length: Math.floor((lastYear - firstYear) / periodWidth) + 1 }, () => new Map());
    const scope = selected ? [selected, ...branches] : branches;
    const branchForCategory = new Map();
    for (const branch of scope) {
      for (const categoryId of index.descendants.get(branch.id)) branchForCategory.set(categoryId, branch.id);
    }

    for (const item of records) {
      const assigned = new Set(item.categoryIds.map(id => branchForCategory.get(id)).filter(Boolean));
      if (!selected && !item.categoryIds.length) assigned.add('');
      const year = Number(item.date.slice(0, 4));
      const band = bands[Math.floor((year - firstYear) / periodWidth)];
      for (const branchId of assigned) {
        if (!band.has(branchId)) band.set(branchId, []);
        band.get(branchId).push(item);
      }
    }

    const groups = [...scope, { id: '', name: '未分类' }];
    return `<p class="panel-note period-range">从 ${firstYear} 年起每 ${periodWidth} 年一段。项目中最新记录为 ${lastYear} 年。</p>
      <div class="period-bands">${bands.map((band, offset) => {
        const start = firstYear + offset * periodWidth;
        const end = Math.min(9999, start + periodWidth - 1);
        return `<section class="period-band"><h3>${start}–${end}</h3>
          ${band.size ? `<div class="period-groups">${groups.filter(branch => band.has(branch.id)).map(branch =>
            `<section class="period-group"><h4>${escape(branch.name)}</h4><div class="record-list">
            ${band.get(branch.id).map(item => periodRecord(item, index)).join('')}</div></section>`).join('')}</div>`
            : '<p class="period-gap">本时段暂无已录入的进展。</p>'}</section>`;
      }).join('')}</div>`;
  }

  function periodRecord(item, index) {
    return `<article class="record period-record"><div class="record-heading"><div><time datetime="${escape(item.date)}">${escape(item.date)}</time><h5>${escape(item.title)}</h5></div>${sourceLink(item.url, '查看原始成果')}</div>
      ${recordChips(item, index)}<dl class="finding-list">
        ${item.baseline ? `<div><dt>此前状态</dt><dd>${escape(item.baseline)}</dd></div>` : ''}
        ${item.description ? `<div><dt>新增进展</dt><dd>${escape(item.description)}</dd></div>` : ''}
        <div><dt>进展幅度</dt><dd>${escape(item.magnitude || '幅度待判。')}</dd></div>
      </dl>${item.sourceLocator ? `<p class="period-source">原文位置 ${escape(item.sourceLocator)}</p>` : ''}${evidence(item, index)}</article>`;
  }

  function timeline(index) {
    const records = [...filterByCategory(project.milestones, index)].sort((a, b) =>
      order === 'asc' ? dateCompare(a.date, b.date) : dateCompare(b.date, a.date));
    const groups = new Map();
    for (const record of records) {
      const year = record.date.slice(0, 4);
      if (!groups.has(year)) groups.set(year, []);
      groups.get(year).push(record);
    }
    const maximum = Math.max(0, ...[...groups.values()].map(entries => entries.length));
    return `<section class="panel"><div class="panel-heading"><div><h2>进展时间线</h2><p>按记录日期排列，每条进展可以关联分类、文献和原始出处。</p></div><button type="button" class="button primary" data-edit="milestones">管理进展</button></div>
      <div class="filters">${categorySelect(index)}<label class="filter">排序<select id="timeline-order"><option value="desc" ${order === 'desc' ? 'selected' : ''}>从新到旧</option><option value="asc" ${order === 'asc' ? 'selected' : ''}>从旧到新</option></select></label></div>
      ${records.length ? `<div class="year-chart" aria-label="按年统计已录入的进展"><h3>各年进展记录数</h3>${[...groups.entries()].sort(([a], [b]) => dateCompare(a, b)).map(([year, entries]) => `<div class="year-bar"><a href="#year-${year}" data-year="${year}">${year}</a><span class="bar-track" aria-hidden="true"><span style="--width:${100 * entries.length / maximum}%"></span></span><span>${entries.length} 条</span></div>`).join('')}</div>
      <div class="timeline">${[...groups.entries()].map(([year, entries]) => `<section class="year-group" id="year-${year}" tabindex="-1"><h3>${year}</h3><ol>${entries.map(item => `<li class="record milestone"><div class="record-heading"><div><time datetime="${escape(item.date)}">${escape(item.date)}</time><h4>${escape(item.title)}</h4></div>${sourceLink(item.url, '查看出处')}</div>${recordChips(item, index)}${item.description ? `<p>${escape(item.description)}</p>` : ''}${evidence(item, index)}</li>`).join('')}</ol></section>`).join('')}</div>`
        : emptyState(categoryFilter ? '此分类暂无进展' : '还没有进展记录', '录入一条进展，补充日期和证据来源。', 'milestones', '添加进展')}
    </section>`;
  }

  function plans(index) {
    const records = [...filterByCategory(project.plans, index)].sort((a, b) => {
      if (!a.date || !b.date) return Number(!a.date) - Number(!b.date);
      return dateCompare(a.date, b.date);
    });
    return `<section class="panel"><div class="panel-heading"><div><h2>研究计划</h2><p>按目标日期排列研究任务，保留问题、预期产出和相关文献。</p></div><button type="button" class="button primary" data-edit="plans">管理计划</button></div>
      <div class="filters">${categorySelect(index)}</div>
      ${records.length ? `<ol class="roadmap">${records.map(item => `<li>
        <div class="plan-date">${item.date ? `<time datetime="${escape(item.date)}">${escape(item.date)}</time>` : '待定日期'}</div>
        <article class="record plan-record"><div class="record-heading"><h3>${escape(item.title)}</h3><span class="plan-status ${item.status}">${statuses[item.status]}</span></div>
        ${recordChips(item, index)}${item.description ? `<p>${escape(item.description)}</p>` : ''}
        ${item.deliverable ? `<div class="deliverable"><strong>预期产出</strong> ${escape(item.deliverable)}</div>` : ''}${evidence(item, index)}</article></li>`).join('')}</ol>`
        : emptyState(categoryFilter ? '此分类暂无研究计划' : '还没有研究计划', '从待验证的问题或尚未覆盖的方向出发，写下下一步。', 'plans', '添加计划')}
    </section>`;
  }

  function navigate(view) {
    if (location.hash === `#${view}`) render();
    else location.hash = view;
  }

  function exportProject() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2) + '\n'], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'research-atlas.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('已导出项目 JSON。');
  }

  function requestReplacement(next, message, confirmation, edit = false) {
    pendingReplacement = { next, confirmation, edit };
    document.querySelector('#replace-message').textContent = message;
    replaceDialog.returnValue = 'cancel';
    replaceDialog.showModal();
  }

  let reviewToFocus = '';
  let mappingToFocus = '';
  function focusReview() {
    const target = [...document.querySelectorAll('[data-review-card]')].find(item => item.dataset.reviewCard === reviewToFocus);
    const mappingIndex = mappingToFocus;
    reviewToFocus = '';
    mappingToFocus = '';
    if (!target) return;
    target.querySelector('details').open = true;
    const row = [...target.querySelectorAll('[data-mapping-row]')].find(item => item.dataset.mappingRow === mappingIndex);
    const focus = row || target;
    focus.focus({ preventScroll: true });
    focus.scrollIntoView({ block: row ? 'center' : 'start' });
  }

  function focusCategoryEvidence() {
    evidenceToFocus = false;
    const panel = document.querySelector('#category-evidence');
    panel?.focus({ preventScroll: true });
    panel?.scrollIntoView({ block: 'start' });
  }

  function updateCategoryEvidence() {
    const index = indexProject();
    const selected = evidenceSelection(index);
    document.querySelector('#evidence-filter').value = selected;
    document.querySelector('#evidence-results').innerHTML = categoryEvidence(index, selected);
  }

  layout.addEventListener('toggle', event => {
    const branch = event.target;
    if (!branch.isConnected || !branch.dataset.mapBranch) return;
    if (branch.open) openBranches.add(branch.dataset.mapBranch);
    else openBranches.delete(branch.dataset.mapBranch);
  }, true);

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.ctrlKey || event.shiftKey || event.metaKey || event.altKey) return;
    const action = event.target.closest('[data-edit], [data-action], [data-category], [data-review], [data-evidence-category], [data-period-branch], [data-year], .skip-link');
    if (!projectMenu.contains(event.target)) projectMenu.open = false;
    if (!action) return;
    if (action.classList.contains('skip-link')) {
      event.preventDefault();
      document.querySelector('#main').focus();
      return;
    }
    if (action.dataset.edit) editor.open(action.dataset.edit);
    if (action.dataset.category) {
      event.preventDefault();
      categoryFilter = action.dataset.category;
      navigate('timeline');
    }
    if (action.dataset.periodBranch) {
      event.preventDefault();
      periodCategory = action.dataset.periodBranch;
      const alreadyOnPeriods = currentView() === 'periods';
      navigate('periods');
      if (alreadyOnPeriods) document.querySelector('#period-category')?.focus({ preventScroll: true });
    }
    if (action.dataset.review) {
      event.preventDefault();
      reviewToFocus = action.dataset.review;
      mappingToFocus = action.dataset.mappingIndex || '';
      if (currentView() === 'reviews') focusReview();
      else navigate('reviews');
    }
    if (action.dataset.evidenceCategory) {
      event.preventDefault();
      evidenceFilter = action.dataset.evidenceCategory;
      if (currentView() === 'overview') {
        updateCategoryEvidence();
        focusCategoryEvidence();
      } else {
        evidenceToFocus = true;
        navigate('overview');
      }
    }
    if (action.dataset.year) {
      event.preventDefault();
      const target = document.getElementById(`year-${action.dataset.year}`);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'start' });
    }
    if (!action.dataset.action) return;
    projectMenu.open = false;
    switch (action.dataset.action) {
      case 'new': requestReplacement(model.blank(), '新建空白项目会替换当前项目。可以先导出现有数据。', '已新建空白项目。', true); break;
      case 'demo': requestReplacement(model.demo(), '载入示例会替换当前项目。可以先导出现有数据。', '已载入示例项目。'); break;
      case 'import': importInput.click(); break;
      case 'export': exportProject(); break;
    }
  });

  document.addEventListener('change', event => {
    if (event.target.id === 'evidence-filter') {
      evidenceFilter = event.target.value;
      updateCategoryEvidence();
      return;
    }
    if (event.target.id === 'category-filter') categoryFilter = event.target.value;
    else if (event.target.id === 'timeline-order') order = event.target.value;
    else if (event.target.id === 'period-category') periodCategory = event.target.value;
    else if (event.target.id === 'period-width' && periodWidths.includes(Number(event.target.value))) periodWidth = Number(event.target.value);
    else return;
    render();
    document.getElementById(event.target.id)?.focus({ preventScroll: true });
  });

  importInput.addEventListener('change', async () => {
    const file = importInput.files[0];
    importInput.value = '';
    if (!file) return;
    try {
      const next = model.validate(JSON.parse((await file.text()).replace(/^\uFEFF/, '')));
      requestReplacement(next, `导入「${next.title}」会替换当前项目。可以先导出现有数据。`, '已导入项目。');
    } catch (error) {
      notify(`导入失败。${error instanceof SyntaxError ? '请选择有效的 JSON 文件。' : error.message}`);
    }
  });

  replaceDialog.addEventListener('close', () => {
    const replacement = pendingReplacement;
    pendingReplacement = undefined;
    if (replaceDialog.returnValue !== 'replace' || !replacement) return;
    categoryFilter = '';
    periodCategory = '';
    periodWidth = 3;
    evidenceFilter = null;
    openBranches = null;
    order = 'desc';
    const persisted = saveProject(replacement.next);
    navigate('overview');
    notify(replacement.confirmation + (persisted ? '' : '浏览器存储不可用，请导出 JSON 保存。'));
    if (replacement.edit) editor.open('project');
  });

  window.addEventListener('hashchange', () => {
    render();
    if (reviewToFocus) focusReview();
    else if (evidenceToFocus) focusCategoryEvidence();
    else {
      window.scrollTo(0, 0);
      document.querySelector('#main').focus({ preventScroll: true });
    }
  });

  render();
})();
