# RData Preview

在 VS Code 中直接预览 `.RData`、`.rda` 和 `.rds` 文件——再也不用为了看数据切到 RStudio 了。

![VS Code](https://img.shields.io/badge/VS%20Code-1.80+-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 功能特性

### 📊 交互式表格视图
- Data frame、tibble 和 matrix 以可排序、可搜索、可分页的表格展示
- 点击列头排序，搜索框全列过滤
- 每列显示类型标注（`<integer>`、`<character>` 等）

### 🌳 增强树形视图
- List、环境和嵌套结构以可折叠树形展示
- **内嵌表格** — list 中的 data.frame 和 matrix 节点展开后直接显示为嵌入式表格
- **彩色类型标签** — numeric（蓝色）、character（橙色）、logical（绿色）、data.frame/matrix（青色）、list（黄色）
- **搜索过滤** — 按键名或值过滤树节点
- **全部展开/折叠** — 一键展开或折叠整棵树

### 🔄 视图切换
当一个对象同时支持表格和树形展示时（如 data.frame），工具栏会出现 Table/Tree 切换按钮。

### 📁 多对象支持
包含多个对象的 `.RData` 文件会在左侧显示对象选择栏，方便切换。

### 🎨 主题自适应
自动适配 VS Code 的亮色/暗色主题。

## 前提条件

- 安装 [R](https://www.r-project.org/)，且 `Rscript` 在系统 PATH 中
- 安装 [`jsonlite`](https://cran.r-project.org/package=jsonlite) R 包

```r
install.packages("jsonlite")
```

## 使用方法

在 VS Code 中打开任意 `.RData`、`.rda` 或 `.rds` 文件，预览会自动打开。

### 表格视图
- 点击列头排序（再次点击反向排序）
- 搜索框输入关键字，按所有列过滤行
- 大数据集使用底部分页控件翻页

### 树形视图
- 点击节点展开/折叠
- list 中的 data.frame 和 matrix 展开后显示为内嵌表格
- 使用 **⊞ Expand** / **⊟ Collapse** 按钮一键展开/折叠所有节点
- 使用 **Filter keys…** 搜索框快速定位

### 视图切换
当一个对象同时可以表格和树形展示时，工具栏会出现切换按钮。

## 扩展设置

| 设置项 | 默认值 | 说明 |
|---|---|---|
| `rdataPreview.rscriptPath` | `""` | Rscript 可执行文件路径。留空则使用系统 PATH。 |
| `rdataPreview.maxRows` | `1000` | Data frame 和 matrix 最大预览行数。 |

## 支持的 R 对象类型

| R 类型 | 展示方式 |
|---|---|
| `data.frame`、`tibble`、`data.table` | 表格（可切换至树形） |
| `matrix` | 表格 / 树中内嵌表格（显示维度如 `matrix[5×4]`） |
| `list` | 树形，嵌套的 data.frame/matrix 自动展示为内嵌表格 |
| `vector`（numeric、character、logical 等） | 原子值列表，带类型颜色标注 |
| `function` | 源代码展示 |
| 其他 | `str()` 文本输出 |

## 开发

```bash
# 安装依赖
npm install

# 编译
npm run compile

# 监听模式
npm run watch
```

按 `Fn + F5`（macOS）或 `F5`（Windows/Linux）启动扩展开发宿主进行测试。

## 许可证

MIT
