const path = require('path');
const j = require('jscodeshift');
const { addTranslation } = require('./translations');

function generateKey(componentName, text) {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `${componentName}_${slug}`;
}

module.exports = function transformer(file, api) {
  const root = j(file.source);
  const componentName = path.basename(file.path, '.js');

  let hasImport = false;
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

  root.find(j.JSXText).forEach(pathNode => {
    const text = pathNode.node.value.trim();
    if (text) {
      const key = generateKey(componentName, text);
      addTranslation(key, text);

      pathNode.replace(
        j.jsxExpressionContainer(
          j.callExpression(j.identifier('t'), [j.literal(key)])
        )
      );
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
        const key = generateKey(componentName, fullText);
        addTranslation(key, fullText);

        const params = variables.map(v =>
          j.property('init', j.identifier(v), j.identifier(v))
        );
        pathNode.node.children = [
          j.jsxExpressionContainer(
            j.callExpression(j.identifier('t'), [
              j.literal(key),
              j.objectExpression(params)
            ])
          )
        ];
      }
    }
  });

  return root.toSource({ quote: 'single' });
};
