const fs = require('fs');
const acorn = require('acorn');
try {
  acorn.parse(fs.readFileSync('scripts/update_data.js', 'utf8'), { ecmaVersion: 2022, sourceType: 'module' });
  console.log("OK");
} catch (e) {
  console.log("Error at line " + e.loc.line + " col " + e.loc.column);
  console.log(e.message);
}
