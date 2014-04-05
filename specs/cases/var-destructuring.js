var {x, y} = z;

var {x: z, y} = a;

var x = 11, {y} = z;

var x = 11, {y} = a, z = 12;

var {x: {y}} = z;

var a = 0, {x: {y}} = z;

var {x: {y}} = z, b = 1;

var a = 0, {x: {y}} = z, b = 1;

var [x, y] = z;

var a = 0, [x, y] = z;

var [x, [y]] = z;

var [x, {y}] = z;

var {x, y} = {
  x: 11,
  y: 12
};

var [x, y] = [
  11,
  12
];

var [x, {y}] = [
  11,
  {y: 12}
];

// single prop object patterns are emitted without intermediate assignment

var {y} = x;

var {y: {x}} = z;

var {y: {x, z}} = a;

// single elem array pattern are emitted without intermediate assignment

var [x] = y;

var [[x]] = y;

var [{x}] = y;

// tough cases

var [
  x, y
] = z;

var {
  x, y
} = z;

var {
  x,
  y
} = {
  x: 11,
  y: 12
};

// skip values in array pattern

var [x,] = arr;

var [,x,] = arr;

var [x,,y] = arr;

// rest in array pattern

var [...y] = arr;

var [x, ...y] = arr;

var [x,, ...y] = arr;

// with functions

var {x} = (function(
      {x},
      {y}) { return x + y; })(12);
