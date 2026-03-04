const MarkdownIt = require('markdown-it');
const md = new MarkdownIt({ linkify: true });
console.log(md.render('tv综合吧 weibo.com/u/5260536046'));
console.log(md.render('易搜 yiso.fun'));
