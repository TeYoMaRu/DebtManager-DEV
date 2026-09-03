const fs = require('fs');
let code = fs.readFileSync('styles.css', 'utf8');

const target = `.compact-item {`;
const insert = `.compact-item.sortable-ghost {
  opacity: 0.5 !important;
  background-color: #f1f5f9 !important;
  border: 1px dashed #94a3b8 !important;
}

.compact-item.sortable-drag {
  background-color: #ffffff !important;
  border: 1px solid var(--primary) !important;
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05) !important;
  opacity: 1 !important;
  cursor: grabbing !important;
}

`;

if (!code.includes('sortable-ghost')) {
  code = code.replace(target, insert + target);
  fs.writeFileSync('styles.css', code);
  console.log('CSS patched');
}
