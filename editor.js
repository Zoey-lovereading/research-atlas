(function () {
  'use strict';

  const tabs = {
    settings: { label: '项目设置' },
    reviews: { label: '来源文献', singular: '文献', empty: '先添加一篇综述或原始研究论文，记录出处和研究主题。' },
    categories: { label: '分类', singular: '分类', empty: '从文献目录导入分类，或先手动建立一个分类。' },
    mappings: { label: '分类证据', singular: '证据', empty: '把文献章节与分类对应起来，再记录机制、观测方法和研究结果。' },
    milestones: { label: '研究进展', singular: '进展', empty: '记录一项已有研究进展，并关联分类和来源。' },
    plans: { label: '研究计划', singular: '计划', empty: '记录一个待研究的问题、预计时间和交付成果。' },
  };
  const statuses = { idea: '构想', planned: '已计划', active: '进行中', done: '已完成' };

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(text, variant, action) {
    const node = element('button', `button ${variant} button-${variant}`, text);
    node.type = 'button';
    if (action) node.addEventListener('click', action);
    return node;
  }

  function categoryPath(project, id) {
    const names = [];
    const seen = new Set();
    let category = project.categories.find(item => item.id === id);
    while (category && !seen.has(category.id)) {
      seen.add(category.id);
      names.unshift(category.name);
      const parentId = category.parentId;
      category = project.categories.find(item => item.id === parentId);
    }
    return names.join(' / ');
  }

  function isDescendant(project, candidate, ancestorId) {
    let category = candidate;
    while (category) {
      if (category.id === ancestorId) return true;
      const parentId = category.parentId;
      category = project.categories.find(item => item.id === parentId);
    }
    return false;
  }

  function makeId(project, collection) {
    const prefix = { reviews: 'review', categories: 'category', milestones: 'milestone', plans: 'plan' }[collection];
    let id;
    do {
      const suffix = window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
      id = `${prefix}-${suffix}`;
    } while (project[collection].some(item => item.id === id));
    return id;
  }

  function titleFor(project, section, item) {
    if (section === 'categories') return categoryPath(project, item.id);
    if (section === 'mappings') {
      const review = project.reviews.find(source => source.id === item.reviewId);
      return `${review.title} → ${categoryPath(project, item.categoryId)}`;
    }
    return item.title;
  }

  function detailFor(section, item) {
    if (section === 'reviews') return [item.year, item.authors, item.summary].filter(Boolean).join(' · ');
    if (section === 'mappings') {
      const evidence = [item.mechanism && '机制', item.observation && '观测方法', item.finding && '研究结果'].filter(Boolean);
      return [item.section, evidence.length ? `已记录${evidence.join('、')}` : '待补充证据', item.note].filter(Boolean).join(' · ');
    }
    if (section === 'milestones') return [item.date, item.description].filter(Boolean).join(' · ');
    if (section === 'plans') return [item.date, statuses[item.status], item.deliverable || item.description].filter(Boolean).join(' · ');
    return item.description;
  }

  function removeEntry(project, section, index) {
    const [removed] = project[section].splice(index, 1);
    if (section === 'reviews') {
      project.mappings = project.mappings.filter(item => item.reviewId !== removed.id);
      for (const item of [...project.milestones, ...project.plans]) {
        item.reviewIds = item.reviewIds.filter(id => id !== removed.id);
      }
    }
    if (section === 'categories') {
      for (const item of project.categories) {
        if (item.parentId === removed.id) item.parentId = removed.parentId;
      }
      project.mappings = project.mappings.filter(item => item.categoryId !== removed.id);
      for (const item of [...project.milestones, ...project.plans]) {
        item.categoryIds = item.categoryIds.filter(id => id !== removed.id);
      }
    }
  }

  function importHeadings(project, { reviewId, parentId, headings }) {
    const stack = [];
    let addedCategories = 0;
    let addedMappings = 0;
    const normalizedName = name => name.normalize('NFKC').replace(/\s+/g, ' ').toLowerCase();

    for (const line of headings.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const markdown = trimmed.match(/^(#{1,6})\s+(.+?)(?:\s+#+)?$/u);
      const heading = markdown ? markdown[2] : trimmed;
      const number = heading.match(/^(\d+(?:[.．]\d+)*)(?:[.、．)])?\s+/u);
      const level = markdown?.[1].length || (number ? number[1].split(/[.．]/u).length : 1);
      const name = (number ? heading.slice(number[0].length) : heading.replace(/^第[一二三四五六七八九十百\d]+[章节]\s+/u, '')).trim() || heading;
      while (stack.length && stack.at(-1).level >= level) stack.pop();
      const categoryParent = stack.at(-1)?.id ?? parentId;
      const matches = project.categories.filter(category => (
        category.parentId === categoryParent && normalizedName(category.name) === normalizedName(name)
      ));
      if (matches.length > 1) throw new Error(`同一上级下有多个“${name}”分类。请先在分类页合并或改名。`);

      let category = matches[0];
      if (!category) {
        category = { id: makeId(project, 'categories'), name, description: '', parentId: categoryParent };
        project.categories.push(category);
        addedCategories += 1;
      }
      stack.push({ id: category.id, level, heading });
      const section = stack.map(item => item.heading).join(' / ');
      const exists = project.mappings.some(item => item.reviewId === reviewId && item.categoryId === category.id && item.section === section);
      if (!exists) {
        project.mappings.push({ reviewId, categoryId: category.id, section, mechanism: '', observation: '', finding: '', note: '' });
        addedMappings += 1;
      }
    }

    return { addedCategories, addedMappings };
  }

  function mount({ dialog, getProject, saveProject, notify }) {
    let section = 'reviews';
    let mode = 'list';
    let selectedIndex = -1;
    let dirty = false;
    let returnFocus = null;
    let feedback = '';

    dialog.setAttribute('aria-labelledby', 'editor-title');

    function allowDiscard() {
      return !dirty || window.confirm('放弃当前未保存的编辑？');
    }

    function goTo(nextSection, nextMode = 'list', index = -1) {
      if (!allowDiscard()) return;
      section = nextSection;
      mode = nextMode;
      selectedIndex = index;
      dirty = false;
      feedback = '';
      render(true);
    }

    function requestClose() {
      if (allowDiscard()) dialog.close();
    }

    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      requestClose();
    });
    dialog.addEventListener('close', () => {
      dirty = false;
      const openingAction = returnFocus?.dataset?.edit;
      const replacement = [...document.querySelectorAll('[data-edit]')].find(node => node.dataset.edit === openingAction);
      const target = returnFocus?.isConnected ? returnFocus : replacement || document.querySelector('[data-edit="project"]');
      target?.focus();
    });

    function commit(project) {
      const persisted = saveProject(window.ResearchAtlasModel.validate(project));
      dirty = false;
      return persisted !== false;
    }

    function complete(message, persisted) {
      feedback = message + (persisted ? '' : '。浏览器存储不可用，请导出项目保存。');
      render(true);
      notify(feedback);
    }

    function removeItem(index, error) {
      const project = structuredClone(getProject());
      const item = project[section][index];
      let consequence = '';
      if (section === 'reviews') consequence = '\n相关分类证据会删除，进展和计划中的文献关联会解除。';
      if (section === 'categories') consequence = '\n相关分类证据会删除，进展和计划的分类关联会解除，子分类会移到上一级。';
      const title = titleFor(project, section, item);
      const citation = section === 'mappings' && item.section ? ` · ${item.section}` : '';
      if (!window.confirm(`删除“${title}${citation}”？${consequence}`)) return;
      try {
        removeEntry(project, section, index);
        const persisted = commit(project);
        complete(`已删除${tabs[section].singular}`, persisted);
      } catch (failure) {
        error.textContent = failure.message;
      }
    }

    function renderList(body, project) {
      const heading = element('h3', '', tabs[section].label);
      const toolbar = element('div', 'editor-toolbar');
      const actions = element('div', 'editor-item-actions');
      toolbar.append(heading, actions);
      const add = button(`添加${tabs[section].singular}`, 'primary', () => goTo(section, 'edit'));
      add.dataset.editorFocus = '';
      if (section === 'mappings') {
        const importButton = button('按目录导入', 'secondary', () => goTo(section, 'import'));
        importButton.disabled = !project.reviews.length;
        add.disabled = !project.reviews.length || !project.categories.length;
        if (add.disabled && !importButton.disabled) importButton.dataset.editorFocus = '';
        actions.append(importButton);
      }
      actions.append(add);
      body.append(toolbar);

      const errors = element('p', 'editor-error');
      errors.setAttribute('role', 'alert');
      body.append(errors);
      if (!project[section].length) {
        body.append(element('p', 'editor-empty', tabs[section].empty));
        return;
      }

      const list = element('ul', 'editor-list');
      project[section].forEach((item, index) => {
        const entry = element('li', 'editor-item');
        const copy = element('div', 'editor-item-copy');
        const title = titleFor(project, section, item);
        copy.append(element('strong', '', title));
        const detail = detailFor(section, item);
        if (detail) copy.append(element('p', '', detail));
        const itemActions = element('div', 'editor-item-actions');
        const edit = button('编辑', 'quiet', () => goTo(section, 'edit', index));
        const citation = section === 'mappings' && item.section ? ` · ${item.section}` : '';
        edit.setAttribute('aria-label', `编辑 ${title}${citation}`);
        const remove = button('删除', 'danger', () => removeItem(index, errors));
        remove.setAttribute('aria-label', `删除 ${title}${citation}`);
        itemActions.append(edit, remove);
        entry.append(copy, itemActions);
        list.append(entry);
      });
      body.append(list);
    }

    function renderForm(body, project) {
      const isSettings = section === 'settings';
      const isImport = mode === 'import';
      const existing = !isImport && !isSettings ? project[section][selectedIndex] : null;
      const item = isSettings ? project : existing || {};
      const heading = isSettings ? '项目设置' : isImport ? '从文献目录导入' : `${existing ? '编辑' : '添加'}${tabs[section].singular}`;
      const title = element('h3', '', heading);
      const toolbar = element('div', 'editor-toolbar');
      toolbar.append(title);
      if (!isSettings) toolbar.append(button(`返回${tabs[section].label}列表`, 'quiet', () => goTo(section)));
      body.append(toolbar);

      const form = element('form', 'editor-form');
      const grid = element('div', 'editor-grid');
      const fields = new Map();
      const reviewOptions = project.reviews.map(review => [review.id, review.title]);
      const categoryOptions = project.categories.map(category => [category.id, categoryPath(project, category.id)]);

      function field(key, label, options = {}) {
        const { type = 'text', required = false, choices, placeholder, wide = false, hint, value = item[key] ?? '' } = options;
        const row = element('label', `editor-field${wide ? ' wide' : ''}`);
        row.append(element('span', '', label));
        let control;
        if (type === 'textarea') {
          control = element('textarea');
          control.rows = key === 'headings' ? 8 : 3;
        } else if (type === 'select') {
          control = element('select');
          for (const [optionValue, optionLabel] of choices) {
            const option = element('option', '', optionLabel);
            option.value = optionValue;
            control.append(option);
          }
        } else {
          control = element('input');
          control.type = type;
          if (type === 'number') control.step = '1';
        }
        control.name = key;
        control.required = required;
        control.value = value;
        if (placeholder) control.placeholder = placeholder;
        row.append(control);
        if (hint) {
          const help = element('span', 'editor-hint', hint);
          help.id = `editor-help-${key}`;
          control.setAttribute('aria-describedby', help.id);
          row.append(help);
        }
        grid.append(row);
        fields.set(key, () => type === 'number' ? (control.value === '' ? null : Number(control.value)) : control.value);
      }

      function references(key, label, choices) {
        const group = element('fieldset', 'editor-field');
        group.append(element('legend', '', label));
        const list = element('div', 'editor-ref-list');
        const selected = new Set(item[key] || []);
        const inputs = [];
        for (const [id, name] of choices) {
          const row = element('label');
          const checkbox = element('input');
          checkbox.type = 'checkbox';
          checkbox.value = id;
          checkbox.checked = selected.has(id);
          row.append(checkbox, element('span', '', name));
          list.append(row);
          inputs.push(checkbox);
        }
        if (!choices.length) list.append(element('span', 'editor-hint', '暂无可关联条目。'));
        group.append(list);
        grid.append(group);
        fields.set(key, () => inputs.filter(input => input.checked).map(input => input.value));
      }

      if (isSettings) {
        field('title', '项目名称', { required: true, wide: true });
        field('description', '研究领域与范围', { type: 'textarea', wide: true });
      } else if (isImport) {
        field('reviewId', '来源文献', { type: 'select', choices: reviewOptions, required: true, value: reviewOptions[0]?.[0] });
        field('parentId', '导入到', { type: 'select', choices: [['', '一级分类'], ...categoryOptions] });
        field('headings', '文献目录', {
          type: 'textarea', required: true, wide: true,
          placeholder: '# 1. 主要研究方法\n## 1.1 数据来源\n## 1.2 分析流程',
          hint: '每行一个标题。用 #、##、### 或 1、1.1、1.1.1 标记层级。相同上级中的同名分类会复用。',
        });
      } else if (section === 'reviews') {
        field('title', '文献标题', { required: true, wide: true, hint: '可添加综述或原始研究论文。' });
        field('year', '发表年份', { type: 'number', placeholder: '2025' });
        field('authors', '作者');
        field('url', '来源链接', { type: 'url', placeholder: 'https://doi.org/…', wide: true });
        field('summary', '研究范围或阅读笔记', { type: 'textarea', wide: true });
      } else if (section === 'categories') {
        field('name', '分类名称', { required: true });
        const eligible = project.categories.filter(category => !existing || !isDescendant(project, category, existing.id));
        const parentChoices = eligible.map(category => [category.id, categoryPath(project, category.id)]);
        field('parentId', '上级分类', { type: 'select', choices: [['', '作为一级分类'], ...parentChoices] });
        field('description', '分类范围与关键问题', { type: 'textarea', wide: true });
      } else if (section === 'mappings') {
        field('reviewId', '来源文献', { type: 'select', choices: [['', '请选择文献'], ...reviewOptions], required: true });
        field('categoryId', '对应分类', { type: 'select', choices: [['', '请选择分类'], ...categoryOptions], required: true });
        field('section', '原文章节或页码', {
          placeholder: '如 3.2 降温机制，页 12，图 4', wide: true,
          hint: '保留章节、页码或图表编号，便于回到原文核对。',
        });
        field('mechanism', '机制', {
          type: 'textarea',
          hint: '描述作用路径，注明实测支持、模型推断或作者提出的假说。',
        });
        field('observation', '观测方法', {
          type: 'textarea',
          hint: '记录数据来源、观测变量、研究尺度和比较方法。模拟研究可注明模拟条件。',
        });
        field('finding', '研究结果', {
          type: 'textarea',
          hint: '写明实际报告的发现。定量结果保留原单位和适用条件。',
        });
        field('note', '补充笔记', {
          type: 'textarea',
          hint: '可记录局限、被引原始论文的 DOI 或待核实的问题。',
        });
      } else {
        const plan = section === 'plans';
        field('title', plan ? '研究计划标题' : '进展标题', { required: true, wide: true });
        field('date', plan ? '预计时间' : '进展时间', { required: !plan, placeholder: 'YYYY、YYYY-MM 或 YYYY-MM-DD' });
        if (plan) {
          field('status', '状态', { type: 'select', choices: Object.entries(statuses), required: true, value: item.status || 'idea' });
          field('deliverable', '预期交付成果', { wide: true });
        } else {
          field('url', '研究成果链接', { type: 'url', placeholder: 'https://doi.org/…' });
        }
        field('description', plan ? '研究问题与实施思路' : '研究发现与意义', { type: 'textarea', wide: true });
        references('categoryIds', '关联分类', categoryOptions);
        references('reviewIds', '关联文献', reviewOptions);
      }

      const errors = element('p', 'editor-error');
      errors.setAttribute('role', 'alert');
      const actions = element('div', 'editor-actions');
      const submit = button(isImport ? '生成分类与章节对应' : '保存', 'primary');
      submit.type = 'submit';
      if (!isSettings) actions.append(button('取消', 'secondary', () => goTo(section)));
      actions.append(submit);
      form.append(grid, errors, actions);
      body.append(form);
      form.addEventListener('input', () => { dirty = true; });
      form.addEventListener('submit', event => {
        event.preventDefault();
        errors.textContent = '';
        const values = Object.fromEntries([...fields].map(([key, getValue]) => [key, getValue()]));
        const nextProject = structuredClone(getProject());
        let message = isSettings ? '已保存项目设置' : `已保存${tabs[section].singular}`;
        let persisted;
        try {
          if (isSettings) {
            Object.assign(nextProject, values);
          } else if (isImport) {
            const { addedCategories, addedMappings } = importHeadings(nextProject, values);
            if (!addedCategories && !addedMappings) throw new Error('未发现新的目录条目或映射。');
            message = `已新增 ${addedCategories} 个分类、${addedMappings} 条章节对应`;
          } else if (existing) {
            Object.assign(nextProject[section][selectedIndex], values);
          } else {
            if (section !== 'mappings') values.id = makeId(nextProject, section);
            nextProject[section].push(values);
          }
          persisted = commit(nextProject);
        } catch (error) {
          errors.textContent = error.message;
          return;
        }
        mode = 'list';
        selectedIndex = -1;
        complete(message, persisted);
      });
    }

    function render(focus) {
      const project = getProject();
      const shell = element('div', 'editor-shell');
      const header = element('header', 'editor-header');
      const title = element('h2', '', '编辑研究库');
      title.id = 'editor-title';
      const close = button('关闭', 'quiet', requestClose);
      header.append(title, close);

      const nav = element('nav', 'editor-nav');
      nav.setAttribute('aria-label', '编辑类别');
      for (const [id, tab] of Object.entries(tabs)) {
        const count = project[id]?.length;
        const label = count === undefined ? tab.label : `${tab.label} ${count}`;
        const entry = button(label, 'quiet', () => goTo(id));
        entry.classList.add('editor-tab');
        entry.setAttribute('aria-pressed', String(id === section));
        nav.append(entry);
      }

      const body = element('section', 'editor-body editor-section');
      if (feedback) {
        const status = element('p', 'editor-status', feedback);
        status.setAttribute('role', 'status');
        body.append(status);
      }
      const formMode = section === 'settings' || mode !== 'list';
      if (formMode) renderForm(body, project);
      else renderList(body, project);
      shell.append(header, nav, body);
      dialog.replaceChildren(shell);
      if (focus) focusContent();
    }

    function focusContent() {
      const target = dialog.querySelector('.editor-form input, .editor-form select, .editor-form textarea')
        || dialog.querySelector('[data-editor-focus]:not(:disabled)')
        || dialog.querySelector('.editor-tab[aria-pressed="true"]');
      target?.focus();
    }

    function open(target = 'reviews') {
      const requestedSection = target === 'project' ? 'settings' : target;
      const nextSection = Object.hasOwn(tabs, requestedSection) ? requestedSection : 'reviews';
      if (dialog.open) {
        goTo(nextSection);
        return;
      }
      returnFocus = document.activeElement;
      section = nextSection;
      mode = 'list';
      selectedIndex = -1;
      dirty = false;
      feedback = '';
      render(false);
      dialog.showModal();
      focusContent();
    }

    return { open };
  }

  window.ResearchAtlasEditor = { mount };
}());
