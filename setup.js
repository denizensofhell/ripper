const fs = require('fs');
const path = require('path');

const directoriesToCreate = [
  path.join(__dirname, 'ripper-downloads'),
  path.join(__dirname, 'ripper-downloads', 'audio'),
  path.join(__dirname, 'ripper-downloads', 'video'),
  path.join(__dirname, 'ripper-downloads', 'logs'),
];

directoriesToCreate.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  } else {
    console.log(`Directory already exists: ${dir} skipping...`);
  }
});
