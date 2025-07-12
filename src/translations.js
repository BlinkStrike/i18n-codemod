const fs = require('fs');
const path = require('path');

// Helper function to safely read and parse JSON file
function readJsonFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e);
  }
  return {};
}

// Helper function to safely write to JSON file
function writeJsonFile(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error(`Error writing to ${filePath}:`, e);
    return false;
  }
}

// Get the translation file paths
function getTranslationFilePaths() {
  const cwd = process.cwd();
  return {
    en: path.join(cwd, 'en.json'),
    he: path.join(cwd, 'he.json')
  };
}

// Add a single translation
function addTranslation(key, text) {
  console.log(`Adding translation: ${key} = ${text}`);
  
  const paths = getTranslationFilePaths();
  
  // Read existing translations
  const enTranslations = readJsonFile(paths.en);
  const heTranslations = readJsonFile(paths.he);
  
  // Add new translations
  enTranslations[key] = text;
  if (!(key in heTranslations)) {
    heTranslations[key] = '';
  }
  
  // Save back to files
  writeJsonFile(paths.en, enTranslations);
  writeJsonFile(paths.he, heTranslations);
}

// Save all translations (for backward compatibility)
function saveTranslations() {
  console.log('All translations have been saved incrementally.');
  
  const paths = getTranslationFilePaths();
  const enTranslations = readJsonFile(paths.en);
  const heTranslations = readJsonFile(paths.he);
  
  console.log(`Total translations: ${Object.keys(enTranslations).length} keys`);
  console.log(`Translation files saved at:\n- ${paths.en}\n- ${paths.he}`);
}

module.exports = { addTranslation, saveTranslations };
