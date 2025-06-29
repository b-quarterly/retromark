const fs = require('fs');
const path = require('path');

function fixImports(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      fixImports(filePath);
    } else if (filePath.endsWith('.js')) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Fix relative import paths
      content = content.replace(
        /require\("(\.\.?\/[^"]+)"\)/g, 
        (match, importPath) => {
          if (!importPath.endsWith('.js')) {
            return `require("${importPath}.js")`;
          }
          return match;
        }
      );
      
      fs.writeFileSync(filePath, content);
    }
  });
}

fixImports(path.join(__dirname, '../dist'));
