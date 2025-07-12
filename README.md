# react-i18n-codemod

🚀 CLI to automatically parametrize static strings & interpolations in React components for translation.

## Install
```bash
git clone <repo>
cd react-i18n-codemod
npm install
```

## Usage
```bash
npx i18n-codemod <source-folder>
```

Example:
```bash
npx i18n-codemod src/components
```

## What it does
✅ Finds static JSX text & interpolations  
✅ Replaces with `t('key')` or `t('key', { param })`  
✅ Saves translation keys to `en.json` & `he.json`  
✅ Merges when you re-run

## Notes
- Uses `react-i18next`. Make sure you load `en.json` and `he.json` in your i18n config.
- Hebrew texts are saved empty to fill later.
