const fs = require('fs');

const translations = {};

function addTranslation(key, text) {
  translations[key] = text;
}

function mergeAndWrite(file, newData) {
  let oldData = {};
  if (fs.existsSync(file)) {
    oldData = JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  const merged = { ...oldData, ...newData };
  fs.writeFileSync(file, JSON.stringify(merged, null, 2));
}

function saveTranslations() {
  const en = {};
  const he = {};

  Object.entries(translations).forEach(([key, text]) => {
    en[key] = text;
    he[key] = ''; 
  });

  mergeAndWrite('en.json', en);
  mergeAndWrite('he.json', he);
  console.log('✅ Translations saved/merged: en.json & he.json');
}

module.exports = { addTranslation, saveTranslations };
