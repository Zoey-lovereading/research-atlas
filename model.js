(() => {
  'use strict';

  const planStatuses = new Set(['idea', 'planned', 'active', 'done']);

  function record(value, label) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`${label}需要是一个对象。`);
    }
    return value;
  }

  function list(value, label) {
    if (!Array.isArray(value)) throw new Error(`${label}需要是一个列表。`);
    return value;
  }

  function text(value, label, required = false) {
    if (value == null && !required) return '';
    if (typeof value !== 'string') throw new Error(`${label}需要是文本。`);
    const trimmed = value.trim();
    if (required && !trimmed) throw new Error(`请填写${label}。`);
    return trimmed;
  }

  function identifier(value, label) {
    const id = text(value, label, true);
    if (/[\u0000-\u001f\u007f]/.test(id)) throw new Error(`${label}包含控制字符。`);
    return id;
  }

  function link(value, label) {
    const url = text(value, label);
    if (!url) return '';
    try {
      const parsed = new URL(url);
      if (/^https?:\/\//i.test(url) && ['https:', 'http:'].includes(parsed.protocol)) {
        return parsed.href;
      }
    } catch {
      // The same field-specific message covers malformed and unsupported links.
    }
    throw new Error(`${label}需要是完整的 HTTP 或 HTTPS 链接。`);
  }

  function year(value, label) {
    if (value == null || value === '') return null;
    if (!Number.isInteger(value) || value < 1 || value > 9999) {
      throw new Error(`${label}需要是 1 至 9999 之间的整数。`);
    }
    return value;
  }

  function date(value, label, required = false) {
    const input = text(value, label, required);
    if (!input) return '';
    const formatError = `${label}需要是有效日期，格式为 YYYY、YYYY-MM 或 YYYY-MM-DD。`;
    const parts = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(input);
    if (!parts) throw new Error(formatError);
    const [, yearText, monthText = '01', dayText = '01'] = parts;
    const [y, m, d] = [yearText, monthText, dayText].map(Number);
    const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
    const daysPerMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (!y || m < 1 || m > 12 || d < 1 || d > daysPerMonth[m - 1]) throw new Error(formatError);
    return input;
  }

  function entries(value, label, normalize) {
    return list(value, label).map((item, index) => {
      const context = `${label}第 ${index + 1} 条的`;
      return normalize(record(item, `${label}第 ${index + 1} 条`), context);
    });
  }

  function unique(items, key, label) {
    const seen = new Set();
    for (const item of items) {
      const value = key(item);
      if (seen.has(value)) throw new Error(`${label}重复：${value}。`);
      seen.add(value);
    }
    return seen;
  }

  function reference(value, knownIds, label) {
    if (!knownIds.has(value)) throw new Error(`${label}引用了不存在的编号「${value}」。`);
    return value;
  }

  function references(value, knownIds, label) {
    const ids = list(value ?? [], label).map(id => text(id, `${label}编号`, true));
    unique(ids, id => id, `${label}编号`);
    return ids.map(id => reference(id, knownIds, label));
  }

  function checkCategoryParents(categories, categoryIds) {
    const parents = new Map(categories.map(({id, parentId, name}) => [
      id, parentId ? reference(parentId, categoryIds, `分类「${name}」的上级分类`) : '',
    ]));
    const checked = new Set();
    for (const {id, name} of categories) {
      const path = new Set();
      let currentId = id;
      while (currentId && !checked.has(currentId)) {
        if (path.has(currentId)) throw new Error(`分类「${name}」的上级分类形成了循环。`);
        path.add(currentId);
        currentId = parents.get(currentId);
      }
      for (const visitedId of path) checked.add(visitedId);
    }
  }

  function validate(raw) {
    const dataset = record(raw, '研究库');
    if (dataset.version !== 1) throw new Error('仅支持版本 1 的研究库数据。');
    const title = text(dataset.title, '研究库名称', true);
    const description = text(dataset.description, '研究库简介');

    const reviews = entries(dataset.reviews, '综述', (item, context) => ({
      id: identifier(item.id, `${context}编号`),
      title: text(item.title, `${context}标题`, true),
      year: year(item.year, `${context}发表年份`),
      authors: text(item.authors, `${context}作者`),
      url: link(item.url, `${context}来源链接`),
      summary: text(item.summary, `${context}摘要或阅读笔记`),
    }));
    const reviewIds = unique(reviews, item => item.id, '综述编号');

    const categories = entries(dataset.categories, '分类', (item, context) => ({
      id: identifier(item.id, `${context}编号`),
      name: text(item.name, `${context}名称`, true),
      description: text(item.description, `${context}描述`),
      parentId: text(item.parentId, `${context}上级分类编号`),
    }));
    const categoryIds = unique(categories, item => item.id, '分类编号');
    checkCategoryParents(categories, categoryIds);

    const mappings = entries(dataset.mappings, '归类记录', (item, context) => ({
      reviewId: reference(text(item.reviewId, `${context}综述编号`, true), reviewIds, `${context}综述`),
      categoryId: reference(text(item.categoryId, `${context}分类编号`, true), categoryIds, `${context}分类`),
      section: text(item.section, `${context}来源章节`),
      mechanism: text(item.mechanism, `${context}机制解释`),
      observation: text(item.observation, `${context}观测或验证`),
      finding: text(item.finding, `${context}主要发现`),
      note: text(item.note, `${context}笔记`),
    }));
    unique(mappings, ({reviewId, categoryId, section}) => JSON.stringify([
      reviewId, categoryId, section,
    ]), '同一综述、分类和章节的归类记录');

    const milestones = entries(dataset.milestones, '研究进展', (item, context) => ({
      id: identifier(item.id, `${context}编号`),
      title: text(item.title, `${context}标题`, true),
      date: date(item.date, `${context}日期`, true),
      description: text(item.description, `${context}描述`),
      baseline: text(item.baseline, `${context}研究起点`),
      magnitude: text(item.magnitude, `${context}进展幅度`),
      sourceLocator: text(item.sourceLocator, `${context}来源位置`),
      categoryIds: references(item.categoryIds, categoryIds, `${context}分类`),
      reviewIds: references(item.reviewIds, reviewIds, `${context}综述`),
      url: link(item.url, `${context}来源链接`),
    }));
    unique(milestones, item => item.id, '研究进展编号');

    const plans = entries(dataset.plans, '研究计划', (item, context) => {
      const status = text(item.status, `${context}状态`, true);
      if (!planStatuses.has(status)) {
        throw new Error(`${context}状态需要是 idea、planned、active 或 done。`);
      }
      return {
        id: identifier(item.id, `${context}编号`),
        title: text(item.title, `${context}标题`, true),
        date: date(item.date, `${context}目标日期`),
        description: text(item.description, `${context}描述`),
        categoryIds: references(item.categoryIds, categoryIds, `${context}分类`),
        reviewIds: references(item.reviewIds, reviewIds, `${context}综述`),
        status,
        deliverable: text(item.deliverable, `${context}交付物`),
      };
    });
    unique(plans, item => item.id, '研究计划编号');

    return {version: 1, title, description, reviews, categories, mappings, milestones, plans};
  }

  function blank() {
    return {
      version: 1, title: '未命名研究库', description: '', reviews: [], categories: [],
      mappings: [], milestones: [], plans: [],
    };
  }

  window.ResearchAtlasModel = {
    validate,
    blank,
    demo: () => validate(window.ResearchAtlasDemo),
  };
})();
