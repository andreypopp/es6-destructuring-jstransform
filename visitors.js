'use strict';

var Syntax  = require('esprima-fb').Syntax;
var utils   = require('jstransform/src/utils');

/**
 * Render an expression
 *
 * This is a helper which can render AST nodes, sting values or arrays which can
 * contain both of the types.
 *
 * @param {Node|String|Array} expr Expression to render
 * @param {Function} traverse
 * @param {Object} path
 * @param {Object} state
 */
function render(expr, traverse, path, state) {
  if (isString(expr)) {
    utils.append(expr, state);
  } else if (Array.isArray(expr)) {
    expr.forEach(function(w) {
      render(w, traverse, path, state);
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
 * @param {Node|String|Array} expr Expression to render
 * @param {Function} traverse
 * @param {Object} path
 * @param {Object} state
 */
function renderExpressionMemoized(expr, traverse, path, state) {
  var evaluated;
  if (expr.type === Syntax.Identifier) {
    evaluated = expr.name;
  } else if (isString(expr)) {
    evaluated = expr;
  } else {
    evaluated = genID('var');
    utils.append(evaluated + ' = ', state);
    render(expr, traverse, path, state);

    utils.append(', ', state);
  }
  return evaluated;
}

/**
 * Render destructuration of the `expr` using provided `pattern`.
 *
 * @param {Node} pattern Pattern to use for destructuration
 * @param {Node|String|Array} expr Expression to destructure
 * @param {Function} traverse
 * @param {Object} path
 * @param {Object} state
 */
function renderDesructuration(pattern, expr, traverse, path, state) {
  utils.catchupNewlines(pattern.range[1], state);

  var id;

  if (pattern.type === Syntax.ObjectPattern && pattern.properties.length === 1) {
    id = expr;
  } else if (pattern.type === Syntax.ArrayPattern && pattern.elements.length === 1) {
    id = expr;
  } else {
    id = renderExpressionMemoized(expr, traverse, path, state);
  }

  if (pattern.type === Syntax.ObjectPattern) {

    pattern.properties.forEach(function(prop, idx) {
      var comma = (idx !== pattern.properties.length - 1) ? ', ' : '';

      if (isPattern(prop.value)) {
        renderDesructuration(prop.value, [id, '.', prop.key.name], traverse, path, state);
      } else {
        utils.append(prop.value.name + ' = ', state);
        render([id, '.' + prop.key.name], traverse, path, state);
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
        renderDesructuration(elem, [id, '[' + idx + ']'], traverse, path, state);
      } else if (elem.type === Syntax.SpreadElement) {
        utils.append(elem.argument.name + ' = ', state);
        render([id, '.slice(' + idx + ')'], traverse, path, state);
        utils.append(comma, state);
      } else {
        utils.append(elem.name + ' = ', state);
        render([id, '[' + idx + ']'], traverse, path, state);
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
      renderDesructuration(decl.id, decl.init, traverse, path, state);
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

    utils.catchup(node.params[0].range[0], state);

    // loop over function parameters and replace all destructuration patterns
    // with synthesized parameters, collect all found patterns to process them
    // later
    node.params.forEach(function(param) {
      utils.catchup(param.range[0], state);
      if (isPattern(param)) {
        var id = genID('arg');
        utils.append(id, state);
        utils.move(param.range[1], state);
        patterns.push({pattern: param, expr: id});
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
      renderDesructuration(pattern.pattern, pattern.expr, traverse, path, state);
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
