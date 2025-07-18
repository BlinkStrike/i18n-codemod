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
    // More robust check: A file is a component if it contains JSX.
    const hasJsx = root.find(j.JSXElement).length > 0 || root.find(j.JSXFragment).length > 0;

    if (!hasJsx) {
      console.log(`Skipping non-component file (no JSX): ${file.path}`);
      return file.source;
    }

    console.log(`\nProcessing component: ${componentName} (${file.path})`);

    // Ensure useTranslation is imported if not already present
    const hasI18nImport = root.find(j.ImportDeclaration, {
      source: { value: 'react-i18next' },
    }).length > 0;

  if (!hasI18nImport) {
    root.get().node.program.body.unshift(
      j.importDeclaration(
        [j.importSpecifier(j.identifier('useTranslation'))],
        j.literal('react-i18next')
      )
    );
  }

  // Helper function to add useTranslation hook
  const addUseTranslationHook = (node) => {
    let body = node.body;

    // Handle implicit return in arrow functions
    if (body.type !== 'BlockStatement') {
      if (body.type === 'JSXElement' || body.type === 'JSXFragment') {
        node.body = j.blockStatement([j.returnStatement(body)]);
        body = node.body;
      } else {
        // Not a component if it doesn't return JSX
        return;
      }
    }

    const bodyStatements = body.body;

    // Check if this is a React component (returns JSX)
    const returnsJsx = bodyStatements.some(stmt =>
      stmt.type === 'ReturnStatement' &&
      stmt.argument &&
      (stmt.argument.type === 'JSXElement' || stmt.argument.type === 'JSXFragment')
    );

    if (!returnsJsx) return;

    // Check if we already have the t function
    const alreadyHasT = bodyStatements.some(
      stmt =>
        stmt.type === 'VariableDeclaration' &&
        stmt.declarations.some(
          d =>
            d.id.type === 'ObjectPattern' &&
            d.id.properties.some(prop => prop.key.name === 't')
        )
    );

    if (!alreadyHasT) {
      bodyStatements.unshift(
        j.variableDeclaration('const', [
          j.variableDeclarator(
            j.objectPattern([
              j.property('init', j.identifier('t'), j.identifier('t'))
            ]),
            j.callExpression(j.identifier('useTranslation'), [])
          )
        ])
      );
      console.log('✅ Added useTranslation hook to component');
    } else {
      console.log('ℹ️ Component already has t function');
    }
  };

  // Find all function declarations, expressions, and arrow functions
  root.find(j.Function).forEach(p => {
    // Check if it's a likely component (name starts with uppercase)
    let isComponent = false;
    if (p.node.type === 'FunctionDeclaration' && p.node.id.name.match(/^[A-Z]/)) {
      isComponent = true;
    }
    if ((p.node.type === 'FunctionExpression' || p.node.type === 'ArrowFunctionExpression') && p.parent.node.type === 'VariableDeclarator' && p.parent.node.id.name.match(/^[A-Z]/)) {
        isComponent = true;
    }

    if (isComponent) {
        try {
            addUseTranslationHook(p.node);
        } catch (error) {
            console.error('Error processing function component:', error);
        }
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
