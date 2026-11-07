// Petit stockage JSON (ids du serveur, tickets ouverts).
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'data');

function read(name, fallback) {
    try {
        return JSON.parse(fs.readFileSync(path.join(dir, name + '.json'), 'utf8'));
    } catch {
        return fallback;
    }
}

function write(name, value) {
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, name + '.json');
    fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2));
    fs.renameSync(file + '.tmp', file);
}

module.exports = { read, write };
