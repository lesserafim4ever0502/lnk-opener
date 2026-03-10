const MarkdownIt = require('markdown-it');
const md = new MarkdownIt();
md.validateLink = () => true;
const text = '![未成熟样例图](file:///C:/Users/ljr13/.gemini/antigravity/brain/6915db8f-02d5-460c-8c84-4d90d0c93c45/unripe_camellia_1773126121167.png)';
const html = md.render(text);
console.log('HTML:', html);
const imgRegex = /<img([^>]*?)src=["']([^"']+)["']([^>]*)>/g;
let match;
while ((match = imgRegex.exec(html)) !== null) {
    console.log('Match found!');
    console.log('Prefix:', match[1]);
    console.log('Src:', match[2]);
    console.log('Suffix:', match[3]);
}
