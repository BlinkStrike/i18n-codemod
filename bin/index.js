#!/usr/bin/env node
const { program } = require('commander');
const path = require('path');
const { execSync } = require('child_process');
const { saveTranslations } = require('../src/translations');

program
  .argument('<source>', 'source folder or file')
  .option('-t, --transform <file>', 'transform script', path.join(__dirname, '../src/transform.js'))
  .action((source, options) => {
    const transformFile = options.transform;

    console.log('📦 Running codemod...');
    execSync(`npx jscodeshift -t "${transformFile}" "${source}"`, { stdio: 'inherit' });

    saveTranslations();
  });

program.parse();
