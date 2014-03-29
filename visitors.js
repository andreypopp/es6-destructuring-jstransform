'use strict';

var Syntax  = require('esprima-fb').Syntax;
var utils   = require('jstransform/src/utils');

/**
 * Render expression
 *
 * @param {Node|String|Array} expr
 */
function renderGeneric(expr, traverse, path, state) {
  if (isString(expr)) {
    utils.append(expr, state);
  } else if (Array.isArray(expr)) {
    expr.forEach(function(w) {
      renderGeneric(w, traverse, path, state);
    });
  } else {
    utils.move(expr.range[0], state);
    traverse(expr, path, state);
    utils.catchup(expr.range[1], state);
  }
}

/**
 * Render expression into a variable declaration and return its id.
 *
 * If we destructure is an identifier (or a string) we use its "value"
 * directly, otherwise we cache it in variable declaration to prevent extra
 * "effectful" evaluations.
 *
 * @param {Node|String|Array} expr
 */
function renderMemoized(expr, traverse, path, state) {
  var evaluated;
  if (expr.type === Syntax.Identifier) {
    evaluated = expr.name;
  } else if (isString(expr)) {
    evaluated = expr;
  } else {
    evaluated = genID('var');
    utils.append(evaluated + ' = ', state);
    renderGeneric(expr, traverse, path, state);

    utils.append(', ', state);
  }
  return evaluated;
}

/**
 * Render destructuration.
 */
function renderDestructuration(name, what, accessor, traverse, path, state) {
  utils.append(name + ' = ', state);
  renderGeneric([what, accessor], traverse, path, state);
}

function destructure(pattern, what, traverse, path, state) {
  utils.catchupNewlines(pattern.range[1], state);

  var id;

  if (pattern.type === Syntax.ObjectPattern && pattern.properties.length === 1) {
    id = what;
  } else if (pattern.type === Syntax.ArrayPattern && pattern.elements.length === 1) {
    id = what;
  } else {
    id = renderMemoized(what, traverse, path, state);
  }

  if (pattern.type === Syntax.ObjectPattern) {

    pattern.properties.forEach(function(prop, idx) {
      var comma = (idx !== pattern.properties.length - 1) ? ', ' : '';

      if (isPattern(prop.value)) {
        destructure(prop.value, [id, '.', prop.key.name], traverse, path, state);
      } else {
        renderDestructuration(prop.value.name, id, '.' + prop.key.name, traverse, path, state);
        utils.append(comma, state);
      }
    });

  } else {

    pattern.elements.forEach(function(elem, idx) {
      // null means skip
      if (elem === null) {
        return;
      }

      var comma = (idx !== pattern.elements.length - 1) ? ', ' : '';

      if (isPattern(elem)) {
        destructure(elem, [id, '[' + idx + ']'], traverse, path, state);
      } else if (elem.type === Syntax.SpreadElement) {
        renderDestructuration(elem.argument.name, id, '.slice(' + idx + ')', traverse, path, state);
        utils.append(comma, state);
      } else {
        renderDestructuration(elem.name, id, '[' + idx + ']', traverse, path, state);
        utils.append(comma, state);
      }
    });
  }
}

function visitVariableDeclaration(traverse, node, path, state) {
  utils.catchup(node.range[0], state);
  node.declarations.forEach(function(decl, idx) {
    utils.catchup(decl.range[0], state);
    if (isPattern(decl.id)) {
      destructure(decl.id, decl.init, traverse, path, state);
      utils.move(decl.range[1], state);
    } else {
      traverse(decl, path, state);
      utils.catchup(decl.range[1], state);
    }
  });

  return false;
}

visitVariableDeclaration.test = function(node, path, state) {
  return node.type === Syntax.VariableDeclaration;
};

function visitFunction(traverse, node, path, state) {
  utils.catchup(node.range[0], state);

  if (node.params.filter(isPattern).length > 0) {
    var patterns = [];

    // go through params and replace patterns with synthesized args
    utils.catchup(node.params[0].range[0], state);

    node.params.forEach(function(param) {
      utils.catchup(param.range[0], state);
      if (isPattern(param)) {
        var id = genID('arg');
        utils.append(id, state);
        utils.move(param.range[1], state);
        patterns.push({pattern: param, what: id});
      } else {
        traverse(param, path, state);
        utils.catchup(param.range[1], state);
      }
    });

    utils.catchup(node.params[node.params.length - 1].range[1], state);

    // inject destructures right after the block's "{"
    utils.catchup(node.body.range[0] + 1, state);
    utils.append('var ', state);
    patterns.forEach(function(pattern, idx) {
      destructure(pattern.pattern, pattern.what, traverse, path, state);
      if (idx !== patterns.length - 1) {
        utils.append(', ', state);
      }
    });
    utils.append(';', state);

    traverse(node.body, path, state);

    return false;
  }

  return true;
}

function visitFunctionDeclaration(traverse, node, path, state) {
  return visitFunction(traverse, node, path, state);
}

visitFunctionDeclaration.test = function(node, path, state) {
  return node.type === Syntax.FunctionDeclaration;
};

function visitFunctionExpression(traverse, node, path, state) {
  return visitFunction(traverse, node, path, state);
}

visitFunctionExpression.test = function(node, path, state) {
  return node.type === Syntax.FunctionExpression;
};

function isPattern(node) {
  return (node.type === Syntax.ObjectPattern ||
          node.type === Syntax.ArrayPattern);
}

function isString(o) {
  return Object.prototype.toString.call(o) === '[object String]';
}

var num = 0;

/**
 * Generate unique identifier with a given prefix.
 *
 * @private
 */
function genID(prefix) {
  return prefix + '$' + (num++);
}

module.exports.__resetModuleState = function() { num = 0; };

module.exports.visitorList = [
  visitFunctionDeclaration,
  visitFunctionExpression,
  visitVariableDeclaration
];
