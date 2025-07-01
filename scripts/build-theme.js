const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { execSync } = require('child_process');

try {
  // --- 1. Load the retro.yml configuration ---
  const configPath = path.resolve(process.cwd(), 'retro.yml');
  const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
  const theme = config.theme || 'academic'; // Default to academic if not set

  console.log(`Building theme: ${theme}`);

  // --- 2. Define input and output paths ---
  const inputFile = path.resolve(process.cwd(), `src/themes/${theme}.scss`);
  const outputFile = path.resolve(process.cwd(), 'dist/style.css');

  // --- 3. Check if the theme file exists ---
  if (!fs.existsSync(inputFile)) {
    console.error(`Error: Theme file not found at ${inputFile}`);
    process.exit(1);
  }

  // --- 4. Compile the theme using sass ---
  const command = `sass ${inputFile} ${outputFile} --no-source-map`;
  execSync(command, { stdio: 'inherit' });

  console.log('Theme built successfully!');

} catch (error) {
  console.error('Error building theme:', error.message);
  process.exit(1);
}
