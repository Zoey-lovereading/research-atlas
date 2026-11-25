# 研究图谱 · Research Atlas

研究图谱是一个浏览器工具，适合用几篇互补综述快速熟悉一个研究方向。它把文献分类、原文章节、研究进展和后续计划关联起来，方便按分支比较不同论文的发现。

[在线打开研究图谱](https://zoey-lovereading.github.io/research-atlas/) · [直接打开综述分期](https://zoey-lovereading.github.io/research-atlas/#periods) · [查看分析技能](skills/review-chronology/SKILL.md)

## 快速开始

1. 打开 [在线版](https://zoey-lovereading.github.io/research-atlas/)。网页可直接使用，无需登录或安装。首次打开会显示虚构的城市热岛研究示例。
2. 在「分类与进展」点开一个分支，试用「查看分类证据」。再打开「综述分期」，把「每段年数」从 3 年改为 5 年，看看同一批成果如何重新分段。
3. 开始自己的研究时，选「项目 → 新建空白项目」手动录入，也可以从「项目 → 导入 JSON」载入整理好的项目。新建、导入或载入示例会替换当前项目，已有内容可先导出备份。

## 从五篇综述开始

先写清研究对象、时间范围和纳入边界。选一篇覆盖面较广的综述搭框架，再用几篇聚焦不同问题、方法或应用场景的综述补充分支。实际篇数可以随资料调整。

### 在网页中手动录入

| 步骤 | 在哪里操作 | 整理什么 |
| --- | --- | --- |
| 1. 登记文献 | 「文献与分类 → 管理文献」 | 录入综述和关键原始研究的题名、作者、年份、链接及覆盖范围。 |
| 2. 建立研究分支 | 「编辑项目 → 分类证据 → 按目录导入」 | 选择已登记的文献，粘贴 Markdown 标题或数字编号目录。到「分类与进展 → 管理分类」校对层级，并写明每个分支研究什么。 |
| 3. 对读同一类证据 | 「分类与进展 → 管理证据」 | 把不同论文的相关章节关联到同一分类，记录机制、观测方法、研究结果及原文章节、图表或页码。 |
| 4. 记录里程碑 | 「综述分期 → 管理进展」 | 填写原始成果时间、此前状态、新增进展、进展幅度和原文位置，关联分类与文献。多篇综述转述同一原始结果时，合并为一条里程碑并保留对应来源。 |
| 5. 写下下一步 | 「研究计划 → 管理计划」 | 记录待核实的问题、实施思路、预期产出、时间及状态。 |

### 用 AI 辅助生成项目

1. 在「综述分期」点「下载分析技能」。把下载的技能文件和你的综述 PDF 或全文附在同一个能读取文件的 AI 对话里。已有项目可同时附上导出的 JSON，便于在现有分类上继续整理。
2. 复制下面的指令，让助手生成项目 JSON。

   ```text
   请按随附的 review-chronology 技能处理我提供的综述。
   整合各篇的分类，说明每个研究分支的问题、对象和常用方法。
   按原始成果年份每三年分期，比较此前状态、新增进展和有出处的变化幅度。
   保留文献与章节位置，合并多篇综述转述的同一成果，列出待核实内容。
   交付可导入 Research Atlas 的版本 1 项目 JSON。已有项目时，在原记录上补充。
   ```

3. 核对关键年份、量化结果和原文位置。把生成的 `.json` 文件通过「项目 → 导入 JSON」载入，再到「综述分期」查看。

网页接收项目 JSON。使用 AI 辅助时，把论文附在你自己的对话中即可。

## 查看和比较进展

- **分类与进展**。点开分支查看它的子类和里程碑，用「查看分类证据」对读该分支及其子类的机制、方法和结果。
- **综述分期**。从项目中最早的里程碑年份起算，各分支共用时间边界，默认每 3 年一段，可切换 4 年或 5 年。按分类筛选后，可以对照每段的此前状态、新增进展、变化幅度和出处。
- **进展时间线**。按单条成果日期浏览，支持分类筛选和正反排序。

量化幅度要注明可比的指标、对象、单位和基准。机制解释、验证范围或研究能力的变化可以定性记录。证据不足时留空，分期视图会显示「幅度待判」。内置示例中的文献和成果均为虚构演示。

## 保存、分享与离线使用

- **保存自己的项目**。编辑结果保存在当前浏览器。用「项目 → 导出 JSON」备份，换浏览器或设备时再导入。清除网站数据前也可先导出。
- **分享工具或项目**。分享 [在线版链接](https://zoey-lovereading.github.io/research-atlas/) 即可让别人使用工具。如果还要分享你整理的图谱，把对应的 JSON 一并发给对方，由对方自行导入。
- **离线使用**。[下载仓库 ZIP](https://github.com/Zoey-lovereading/research-atlas/archive/refs/heads/main.zip) 并解压，保留目录结构，在浏览器中打开 `index.html`。用 JSON 在在线版与离线版之间传递项目。

## 自行部署到 GitHub Pages

1. 新建 GitHub 仓库，将此目录内的文件放到仓库根目录，包括 `index.html` 和 `.nojekyll`。
2. 在仓库中打开 **Settings → Pages**。在 **Source** 选择 **Deploy from a branch**，再选择包含这些文件的分支（例如 `main`）和 **/(root)**，然后保存。
3. 发布完成后，在 **Settings → Pages** 通过 **Visit site** 打开网站，再把链接分享给其他人。

参阅 [GitHub Pages 发布源配置](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)和 [GitHub Pages 站点创建指南](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)。

## 项目 JSON

导出使用版本 1 的结构，综述与原始研究均存放在 `reviews` 数组里。新增记录时，同一集合中的 ID 应唯一且保持稳定。分类的 `parentId` 留空表示顶级分类，各关系使用对应记录的 ID。文献年份未知时用 `null`。里程碑日期必填，计划日期可以留空，日期格式为 `YYYY`、`YYYY-MM` 或 `YYYY-MM-DD`。有效计划状态为 `idea`（构想）、`planned`（已计划）、`active`（进行中）和 `done`（已完成）。

文献与分类之间的映射通过 `section` 记录原文位置，并可填写 `mechanism`（机制）、`observation`（观测方法）、`finding`（研究结果）和 `note`（补充备注）。已有版本 1 的 JSON 可以直接导入。旧映射中的 `note` 会保留，新增字段可在编辑时补充。下方使用虚构数据演示同一分类如何关联一篇综述和一篇原始研究。

里程碑还可填写 `baseline`（比较基准）、`magnitude`（有证据的变化幅度）和 `sourceLocator`（文献与原文位置），类型均为字符串。旧项目缺少这些字段时按空文本处理。日期记录原始结果的年份，具体章节或图表写入 `sourceLocator`。

<details>
<summary>展开项目 JSON 示例</summary>

```json
{
  "version": 1,
  "title": "街道树冠如何改变行人热暴露",
  "description": "虚构示例，关注夏季白天的街道遮阴和行人热暴露。",
  "reviews": [
    {
      "id": "review-1",
      "title": "街道树冠与步行热舒适",
      "year": 2020,
      "authors": "示例作者组 A",
      "url": "",
      "summary": "梳理树冠遮阴与蒸散对行人热暴露的影响。"
    },
    {
      "id": "review-2",
      "title": "树荫与开阔街段的行人热暴露对照",
      "year": 2024,
      "authors": "示例作者组 B",
      "url": "",
      "summary": "原始研究，在相邻街段同步观测气温和辐射。"
    }
  ],
  "categories": [
    {
      "id": "cooling",
      "name": "降温干预",
      "description": "街道与街区尺度的高温应对措施。",
      "parentId": ""
    },
    {
      "id": "street-shade",
      "name": "树冠遮阴",
      "description": "街道树冠改变行人高度的辐射暴露。",
      "parentId": "cooling"
    }
  ],
  "mappings": [
    {
      "reviewId": "review-1",
      "categoryId": "street-shade",
      "section": "第 2.1 节 · 树冠与短波辐射",
      "mechanism": "树冠削弱到达行人的太阳短波辐射。",
      "observation": "比较相邻树荫和开阔测点的平均辐射温度。",
      "finding": "晴天正午的组间差异在平均辐射温度上更明显。",
      "note": "见该节图 2，测点时间和天气条件一致。"
    },
    {
      "reviewId": "review-2",
      "categoryId": "street-shade",
      "section": "第 3.2 节 · 街段对照结果",
      "mechanism": "",
      "observation": "在行人高度同步测量气温、辐射与风速。",
      "finding": "在受测街段，晴天中午树荫点位的平均辐射温度较低，气温差异较小。",
      "note": "见表 2，样本来自同一条街道的相邻路段。"
    }
  ],
  "milestones": [
    {
      "id": "milestone-1",
      "title": "同步对照树荫与开阔街段",
      "date": "2024",
      "description": "在相邻街段同步测量气温和平均辐射温度，比较晴天午间的暴露差异。",
      "baseline": "相邻开阔街段的同期观测",
      "magnitude": "树荫点位的平均辐射温度较低，气温差异较小；本示例未给出量值。",
      "sourceLocator": "review-2，第 3.2 节，表 2",
      "categoryIds": ["street-shade"],
      "reviewIds": ["review-2"],
      "url": ""
    }
  ],
  "plans": [
    {
      "id": "plan-1",
      "title": "补查不同街道朝向的遮阴证据",
      "date": "",
      "description": "按街道朝向、观测时段和指标归纳可比研究。",
      "categoryIds": ["street-shade"],
      "reviewIds": [],
      "status": "idea",
      "deliverable": "带来源链接的街段对照表"
    }
  ]
}
```

</details>

## 关于作者

研究图谱由 **Zoey** 发布。

- **抖音、小红书**　爱读书的zoey
- **B 站（哔哩哔哩）**
- **微信视频号**

| 抖音主页 | 小红书主页 |
| --- | --- |
| ![抖音主页：爱读书的zoey](https://raw.githubusercontent.com/Zoey-lovereading/topic-search/a1c75e713a08a3e7b1489917de647ccd5c653957/assets/douyin.jpg) | ![小红书主页：爱读书的zoey](https://raw.githubusercontent.com/Zoey-lovereading/topic-search/a1c75e713a08a3e7b1489917de647ccd5c653957/assets/xiaohongshu.jpg) |
