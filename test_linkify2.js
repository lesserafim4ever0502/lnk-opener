const tlds = require('tlds');  
const MarkdownIt = require('markdown-it');  
const md = new MarkdownIt({ linkify: true }); md.linkify.tlds(tlds, true);  
console.log(md.render('tv×ÛºÏ°É weibo.com/u/5260536046')); console.log(md.render('Ò×ËÑ yiso.fun'));  
