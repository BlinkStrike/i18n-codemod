const fs = require('fs');
const path = require('path');

// Helper function to safely read and parse JSON file
function readJsonFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8').trim();
      // If file exists but is empty, return empty object
      if (!content) return {};
      return JSON.parse(content);
    }
  } catch (e) {
    console.warn(`Warning: Could not read ${filePath}, starting with empty translations. Error:`, e.message);
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

// Add a single translation if it doesn't already exist
function addTranslation(key, text) {
  if (!key || !text) return; // Skip if key or text is empty
  
  const paths = getTranslationFilePaths();
  
  // Read existing translations
  const enTranslations = readJsonFile(paths.en);
  const heTranslations = readJsonFile(paths.he);
  
  let updated = false;
  
  // Only add if the key doesn't exist in English translations
  if (!(key in enTranslations)) {
    console.log(`Adding new translation: ${key} = ${text}`);
    enTranslations[key] = text;
    updated = true;
  }
  
  // Ensure the key exists in Hebrew translations (empty if new)
  if (!(key in heTranslations)) {
    heTranslations[key] = '';
    updated = true;
  }
  
  // Only write files if there were updates
  if (updated) {
    writeJsonFile(paths.en, enTranslations);
    writeJsonFile(paths.he, heTranslations);
  }
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
