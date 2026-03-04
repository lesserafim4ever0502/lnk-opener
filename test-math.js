const MarkdownIt = require('markdown-it');
const katexPlugin = require('@iktakahiro/markdown-it-katex');
const md = new MarkdownIt({ html: true }).use(katexPlugin);
console.log('--- aligned ---');
console.log(md.render('$$\n\\begin{aligned}\nf(x) &= ax^2 + bx + c \\\\\nf\'(x) &= 2ax + b \\\\\nf\'\'(x) &= 2a\n\\end{aligned}\n$$'));
console.log('--- raw align ---');
console.log(md.render('\\begin{align}\nf(x) &= 1 \\\\\n\\end{align}'));
