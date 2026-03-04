const MarkdownIt = require('markdown-it');
const md = new MarkdownIt({ html: true });

function injectLineNumbers(md) {
    // We override opening tags of blocks
    const rules = ['paragraph_open', 'heading_open', 'table_open', 'blockquote_open', 'bullet_list_open', 'ordered_list_open', 'code_block', 'fence'];
    
    rules.forEach(rule => {
        const defaultRenderer = md.renderer.rules[rule] || function (tokens, idx, options, env, self) {
            return self.renderToken(tokens, idx, options);
        };
        
        md.renderer.rules[rule] = function (tokens, idx, options, env, self) {
            if (tokens[idx].map && tokens[idx].map.length) {
                // tokens[idx].map[0] is the starting line of the block (0-indexed)
                tokens[idx].attrPush(['data-line', tokens[idx].map[0].toString()]);
            }
            return defaultRenderer(tokens, idx, options, env, self);
        };
    });
}

md.use(injectLineNumbers);
console.log(md.render('# Heading 1\n\nSome paragraph.\n\n```python\nprint("hello")\n```\n\n* List item 1\n* List item 2'));
