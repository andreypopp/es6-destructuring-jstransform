'use strict';

var Syntax  = require('esprima-fb').Syntax;
var utils   = require('jstransform/src/utils');

function writeDestructured(what, traverse, path, state) {
  if (isString(what)) {
    utils.append(what, state);
  } else if (Array.isArray(what)) {
    what.forEach(function(w) {
      writeDestructured(w, traverse, path, state);
    });
  } else {
    utils.move(what.range[0], state);
    traverse(what, path, state);
    utils.catchup(what.range[1], state);
  }
}

function destructure(pattern, what, traverse, path, state) {
  utils.catchupNewlines(pattern.range[1], state);

  // a special case with an object pattern which has single property, so we can
  // reference it derectly
  if (pattern.type === Syntax.ObjectPattern &&
      pattern.properties.length === 1) {

    var prop = pattern.properties[0];

    if (isPattern(prop.value)) {
      destructure(prop.value, [what, '.', prop.key.name], traverse, path, state);
    } else {
      utils.append(prop.value.name + ' = ', state);
      writeDestructured(what, traverse, path, state);
      utils.append('.' + prop.key.name, state);
    }

    return false;
  }

  // a special case with an object pattern which has single property, so we can
  // reference it derectly
  if (pattern.type === Syntax.ArrayPattern &&
      pattern.elements.length === 1) {

    var elem = pattern.elements[0];

    if (isPattern(elem)) {
      destructure(elem, [what, '[0]'], traverse, path, state);
    } else if (elem.type === Syntax.SpreadElement) {
      utils.append(elem.argument.name + ' = ', state);
      writeDestructured(what, traverse, path, state);
      utils.append('.slice(0)', state);
    } else {
      utils.append(elem.name + ' = ', state);
      writeDestructured(what, traverse, path, state);
      utils.append('[0]', state);
    }

    return false;
  }

  var id;

  if (what.type === Syntax.Identifier) {
    id = what.name;
  } else if (isString(what)) {
    id = what;
  } else {
    id = genID('var');
    utils.append(id + ' = ', state);
    writeDestructured(what, traverse, path, state);

    utils.append(', ', state);
  }

  if (pattern.type === Syntax.ObjectPattern) {

    pattern.properties.forEach(function(prop, idx) {
      var comma = (idx !== pattern.properties.length - 1) ? ', ' : '';

      if (isPattern(prop.value)) {
        destructure(prop.value, id + '.' + prop.key.name, traverse, path, state);
      } else {
        utils.append(prop.value.name + ' = ' + id + '.' + prop.key.name, state);
        utils.append(comma, state);
      }
    });

  } else {

    pattern.elements.forEach(function(elem, idx) {
      if (elem === null) {
        return;
      }

      var comma = (idx !== pattern.elements.length - 1) ? ', ' : '';

      if (isPattern(elem)) {
        destructure(elem, id + '[' + idx + ']', traverse, path, state);
      } else if (elem.type === Syntax.SpreadElement) {
        utils.append(elem.argument.name + ' = ' + id, state);
        utils.append('.slice(' + idx + ')', state);
        utils.append(comma, state);
      } else {
        utils.append(elem.name + ' = ' + id + '[' + idx + ']', state);
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
