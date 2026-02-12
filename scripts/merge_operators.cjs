const fs = require('fs');
const path = require('path');

const OPERATORS_FILE = path.join(__dirname, '../src/data/operators.js');
const PATCH_FILE = path.join(__dirname, '../src/data/operators_patch.txt');

// 1. Read existing operators
const fileContent = fs.readFileSync(OPERATORS_FILE, 'utf8');

// Extract all {...} blocks
const matches = fileContent.match(/\{[\s\S]*?\}/g);

if (!matches) {
    console.error('No operator objects found in file');
    process.exit(1);
}

// Parse each object individually
const existingOperators = matches.map(m => {
    try {
        return eval('(' + m + ')');
    } catch (e) {
        console.error('Failed to parse object:', m);
        return null;
    }
}).filter(op => op !== null);

console.log(`Loaded ${existingOperators.length} existing operators.`);

// 2. Read and parse patch file
const patchContent = fs.readFileSync(PATCH_FILE, 'utf8');
const patchLines = patchContent.split('\n').filter(line => line.trim() !== '');
const patchOperators = patchLines.map(line => {
    const parts = line.split('\t');
    if (parts.length < 3) return null;

    const group = parts[0].trim();
    let site = parts[1].trim();
    const name = parts[2].trim();

    // Normalize Site
    if (site.toUpperCase() === 'PRIBBENOW') site = 'Pribbenow';
    if (site.toUpperCase() === 'EL DESCANSO') site = 'El Descanso';

    return { group, site, name };
}).filter(op => op !== null);

console.log(`Loaded ${patchOperators.length} patch operators.`);

// 3. Merge and Dedup
// Key: name|site|group
const operatorMap = new Map();

// Add existing (keep them)
existingOperators.forEach(op => {
    const key = `${op.name}|${op.site}|${op.group}`;
    operatorMap.set(key, op);
});

// Add patch (overwrite/add)
patchOperators.forEach(op => {
    const key = `${op.name}|${op.site}|${op.group}`;
    operatorMap.set(key, op); // If existing, overwrite with patch version (same data)
});

const mergedOperators = Array.from(operatorMap.values());

// 4. Sort
mergedOperators.sort((a, b) => a.name.localeCompare(b.name));

console.log(`Total merged operators: ${mergedOperators.length}`);

// 5. Write back
const outputContent = `export const OPERATORS = [
${mergedOperators.map(op => `    { group: '${op.group}', site: '${op.site}', name: '${op.name}' },`).join('\n')}
];
`;

fs.writeFileSync(OPERATORS_FILE, outputContent);
console.log('Successfully wrote to src/data/operators.js');
