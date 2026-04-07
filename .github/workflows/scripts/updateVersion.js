const fs = require('fs');

const filePath = 'android/app/build.gradle';
let content = fs.readFileSync(filePath, 'utf8');

// versionCode update
let versionCodeMatch = content.match(/versionCode (\d+)/);
let versionCode = parseInt(versionCodeMatch[1]) + 1;

// versionName update (1.0.x)
let versionNameMatch = content.match(/versionName "(\d+\.\d+\.)(\d+)"/);
let base = versionNameMatch[1];
let patch = parseInt(versionNameMatch[2]) + 1;
let versionName = base + patch;

// replace values
content = content.replace(/versionCode \d+/, `versionCode ${versionCode}`);
content = content.replace(/versionName ".*"/, `versionName "${versionName}"`);

fs.writeFileSync(filePath, content);

console.log(`Updated to versionName ${versionName}, versionCode ${versionCode}`);