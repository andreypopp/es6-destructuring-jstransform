
function x({y}) {
}

function x(x, {y}) {
}

function x({y}, z) {
}

function x(x, {y}, z) {
}

function x(x,
           {y},
           z) {
  return y;
}

function x({y}) {return y;}

function x({y}, {z}) {return y + z;}

var x = function({y}) {
  return y;
};

function x({y}) {
  var {z} = y;
}

var {x} = function({y}) {
  var {z} = y;
};

function outer({x}) {
  return function inner({y}) {
    return x + y;
  }
}
