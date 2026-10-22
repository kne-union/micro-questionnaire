const { z } = require('zod');
const { generateObject } = require('ai');
const { createChatModel } = require('./azure-openai');

const MIN_SIZE = 200;
const MAX_SIZE = 4000;
const MAX_REQUIREMENT_LENGTH = 2000;

const posterSchema = z.object({
  html: z.string().describe('Poster HTML: a single root <div>, inline styles only')
});

const buildPrompt = ({ name, description, width, height, requirement, hasBackground, locale }) => `你是资深海报设计师，请为一份问卷设计分享海报，输出 HTML。

## 海报内容
- 问卷名称（必须原样展示，作为主标题）：${name}
- 问卷说明（有则展示，可适当截断）：${description || '无'}
- 画布尺寸：宽 ${width}px，高 ${height}px

## 硬性规则
1. 只输出一个根元素 <div>，根元素 style 必须包含 width:${width}px;height:${height}px;position:relative;overflow:hidden;box-sizing:border-box。
2. 只用内联 style，禁止 <style>、<script>、<link>、<iframe>、事件属性（onclick 等）、外部图片、外部字体、CSS 动画。
3. 必须且只能有一个二维码：<img src="{{qrcode}}" />，正方形，边长不小于画布短边的 22%，外包白色底和内边距，保证扫码清晰；二维码附近放一句扫码引导文案。
${hasBackground ? '4. 可使用问卷背景图：在 CSS 中写 background-image:url({{background}})，或 <img src="{{background}}" />；文字压在图上时加半透明遮罩保证可读。' : '4. 没有背景图，用渐变、色块、几何图形等纯 CSS 营造画面，不要引用任何图片。'}
5. 字体使用 font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif；字号按画布尺寸等比设计，标题醒目，所有内容不得超出画布。
6. 文案语言：${locale === 'en-US' ? 'English' : '简体中文'}（问卷名称与说明保持原样）。

## 用户要求
"""
${requirement || '简洁大方、有设计感'}
"""`;

const sanitizeSize = value => {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number) || number < MIN_SIZE || number > MAX_SIZE) {
    throw new Error(`海报尺寸需在 ${MIN_SIZE}-${MAX_SIZE}px 之间`);
  }
  return number;
};

const generatePosterHtml = async (fastify, { name, description, width, height, requirement, hasBackground, locale }) => {
  const title = String(name || '').trim();
  if (!title) {
    throw new Error('缺少问卷名称');
  }
  const text = String(requirement || '').trim();
  if (text.length > MAX_REQUIREMENT_LENGTH) {
    throw new Error('海报要求过长');
  }
  const posterWidth = sanitizeSize(width);
  const posterHeight = sanitizeSize(height);

  const { object } = await generateObject({
    model: createChatModel(fastify.config),
    schema: posterSchema,
    prompt: buildPrompt({
      name: title,
      description: String(description || '').trim(),
      width: posterWidth,
      height: posterHeight,
      requirement: text,
      hasBackground: !!hasBackground,
      locale: locale === 'en-US' ? 'en-US' : 'zh-CN'
    }),
    maxOutputTokens: 8000
  });

  const html = String(object?.html || '').trim();
  if (!html.includes('{{qrcode}}')) {
    throw new Error('AI 没有生成有效海报，请重试');
  }
  return { html };
};

const APPEARANCE_SIZES = {
  background: { width: 1920, height: 1080 },
  banner: { width: 1520, height: 400 }
};

const APPEARANCE_RULES = {
  background: `这是问卷填写页的全屏背景图，页面中间会叠加一列约 760px 宽的白色问卷表单。
- 不要放任何文字。
- 画面以渐变、柔和色块、几何图形、光斑等装饰为主；中间区域保持低对比、干净，装饰元素集中在左右两侧与边角。
- 图会按 cover 方式铺满不同尺寸的屏幕，四边可能被裁切，不要放必须完整展示的元素。`,
  banner: `这是问卷填写页顶部的 Banner 横幅，展示时会以 cover 方式裁切：桌面端约 760×200，手机端约 350×160（左右两侧会被裁掉）。
- 可以展示问卷名称作为标题（原样，不要改写），可加一句不超过 16 个字的短标语；不要放问卷说明全文。
- 所有文字与关键元素必须放在水平居中的 50% 宽度、垂直居中的 70% 高度安全区内，两侧只放装饰。
- 文字要足够大（标题不小于 64px），与背景有足够对比度。`
};

const buildAppearancePrompt = ({ kind, name, description, themeColor, requirement, locale }) => {
  const { width, height } = APPEARANCE_SIZES[kind];
  return `你是资深视觉设计师，请为一份问卷设计${kind === 'banner' ? '顶部 Banner' : '页面背景图'}，输出 HTML。

## 问卷信息
- 问卷名称：${name}
- 问卷说明：${description || '无'}
- 主题色：${themeColor || '未设置，可自行选择协调的配色'}
- 画布尺寸：宽 ${width}px，高 ${height}px

## 设计要求
${APPEARANCE_RULES[kind]}

## 硬性规则
1. 只输出一个根元素 <div>，根元素 style 必须包含 width:${width}px;height:${height}px;position:relative;overflow:hidden;box-sizing:border-box。
2. 只用内联 style，可用内联 <svg> 画图形；禁止 <style>、<script>、<link>、<iframe>、<img>、事件属性、外部图片、外部字体、CSS 动画。
3. 字体使用 font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif。
4. 文案语言：${locale === 'en-US' ? 'English' : '简体中文'}（问卷名称保持原样）。

## 用户要求
"""
${requirement || '简洁大方、有设计感'}
"""`;
};

const generateAppearanceHtml = async (fastify, { kind, name, description, themeColor, requirement, locale }) => {
  if (!APPEARANCE_SIZES[kind]) {
    throw new Error('不支持的图片类型');
  }
  const text = String(requirement || '').trim();
  if (text.length > MAX_REQUIREMENT_LENGTH) {
    throw new Error('要求过长');
  }

  const { object } = await generateObject({
    model: createChatModel(fastify.config),
    schema: posterSchema,
    prompt: buildAppearancePrompt({
      kind,
      name: String(name || '').trim(),
      description: String(description || '').trim(),
      themeColor,
      requirement: text,
      locale: locale === 'en-US' ? 'en-US' : 'zh-CN'
    }),
    maxOutputTokens: 8000
  });

  const html = String(object?.html || '').trim();
  if (!html) {
    throw new Error('AI 没有生成有效图片，请重试');
  }
  return Object.assign({ html }, APPEARANCE_SIZES[kind]);
};

module.exports = {
  generatePosterHtml,
  generateAppearanceHtml
};
