const path = require('path');
const j = require('jscodeshift');
const { addTranslation } = require('./translations');

function generateKey(componentName, text) {
  // Convert text to camelCase
  return text
    .toLowerCase()
    // Replace any non-alphanumeric characters with a space
    .replace(/[^a-z0-9]+/g, ' ')
    // Trim whitespace
    .trim()
    // Convert to camelCase
    .replace(/(?:^|\s)(\w)/g, (match, p1, offset) => 
      offset === 0 ? p1.toLowerCase() : p1.toUpperCase()
    )
    // Remove any remaining spaces
    .replace(/\s+/g, '');
}

module.exports = function transformer(file, api) {
  try {
    const root = j(file.source);
    const componentName = path.basename(file.path, '.js');
    let hasImport = false;
    
    // Track if we're in a component file
    const isComponentFile = file.path.includes('components/') || file.path.includes('Components/');
    
    if (!isComponentFile) {
      console.log(`Skipping non-component file: ${file.path}`);
      return file.source; // Skip non-component files
    }
    
    console.log(`\nProcessing component: ${componentName} (${file.path})`);
  root.find(j.ImportDeclaration).forEach(p => {
    if (p.node.source.value === 'react-i18next') {
      hasImport = true;
    }
  });
  if (!hasImport) {
    root.get().node.program.body.unshift(
      j.importDeclaration(
        [j.importSpecifier(j.identifier('useTranslation'))],
        j.literal('react-i18next')
      )
    );
  }

  root.find(j.FunctionDeclaration).forEach(p => {
    const body = p.node.body.body;
    const alreadyHasT = body.some(
      stmt =>
        stmt.type === 'VariableDeclaration' &&
        stmt.declarations.some(
          d =>
            d.id.type === 'ObjectPattern' &&
            d.id.properties.some(prop => prop.key.name === 't')
        )
    );
    if (!alreadyHasT) {
      body.unshift(
        j.variableDeclaration('const', [
          j.variableDeclarator(
            j.objectPattern([j.property('init', j.identifier('t'), j.identifier('t'))]),
            j.callExpression(j.identifier('useTranslation'), [])
          )
        ])
      );
    }
  });

  // Process simple text nodes
  root.find(j.JSXText).forEach(pathNode => {
    try {
      const text = pathNode.node.value.trim();
      if (!text) return;
      
      // Skip if the text is just a parameter like {error}
      if (/^\s*\{[^}]+\}\s*$/.test(text)) {
        console.log(`Skipping parameter: ${text}`);
        return;
      }
      
      const key = generateKey(componentName, text);
      console.log(`Processing text: "${text}" -> ${key}`);
      
      addTranslation(key, text);
      pathNode.replace(
        j.jsxExpressionContainer(
          j.callExpression(j.identifier('t'), [j.literal(key)])
        )
      );
    } catch (error) {
      console.error(`Error processing text node at line ${pathNode.node.loc?.start?.line} in ${file.path}:`);
      console.error(`Text: "${pathNode.node.value}"`);
      console.error('Error:', error.message);
      throw error; // Re-throw to stop execution
    }
  });

  root.find(j.JSXElement).forEach(pathNode => {
    const children = pathNode.node.children;
    if (
      children &&
      children.length > 1 &&
      children.some(c => c.type === 'JSXExpressionContainer')
    ) {
      let textParts = [];
      let variables = [];

      children.forEach(child => {
        if (child.type === 'JSXText') {
          const txt = child.value.trim();
          if (txt) textParts.push(txt);
        } else if (child.type === 'JSXExpressionContainer') {
          if (child.expression.type === 'Identifier') {
            textParts.push(`{{${child.expression.name}}}`);
            variables.push(child.expression.name);
          }
        }
      });

      const fullText = textParts.join(' ');
      if (fullText) {
        // Only process if there's actual text content beyond just parameters
        const hasNonParameterContent = textParts.some(part => !/^\{\{[^}]+\}\}$/.test(part));
        
        if (hasNonParameterContent) {
          const key = generateKey(componentName, fullText);
          addTranslation(key, fullText);

          const params = variables.map(v =>
            j.property('init', j.identifier(v), j.identifier(v))
          );
          
          const tCallArgs = [j.literal(key)];
          if (params.length > 0) {
            tCallArgs.push(j.objectExpression(params));
          }
          
          pathNode.node.children = [
            j.jsxExpressionContainer(
              j.callExpression(j.identifier('t'), tCallArgs)
            )
          ];
        }
      }
    }
  });

    return root.toSource({ quote: 'single' });
  } catch (error) {
    console.error('\n❌ Transformation failed in file:', file.path);
    console.error('Error:', error.message);
    console.error('Stack:', error.stack?.split('\n').slice(0, 3).join('\n'));
    console.error('\nPlease check the component for any syntax errors or unsupported patterns.');
    
    // Return the original source to avoid breaking the build
    return file.source;
  }
};
