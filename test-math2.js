const katex = require('katex');
try {
 console.log('Without $$:', katex.renderToString('\\begin{align} a &= b \\end{align}', {displayMode: true}));
} catch (e) { console.error('Error 1:', e.message); }
try {
 console.log('With $$:', katex.renderToString('$$\\begin{align} a &= b \\end{align}$$', {displayMode: true}));
} catch (e) { console.error('Error 2:', e.message); }
