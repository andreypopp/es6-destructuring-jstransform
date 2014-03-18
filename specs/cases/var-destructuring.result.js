var x = z.x, y = z.y;

var z = a.x, y = a.y;

var x = 11, y = z.y;

var x = 11, y = a.y, z = 12;

var y = z.x.y;

var a = 0, y = z.x.y;

var y = z.x.y, b = 1;

var a = 0, y = z.x.y, b = 1;

var x = z[0], y = z[1];

var a = 0, x = z[0], y = z[1];

var x = z[0], y = z[1][0];

var x = z[0], y = z[1].y;

var var$0 = {
  x: 11,
  y: 12
}, x = var$0.x, y = var$0.y;

var var$1 = [
  11,
  12
], x = var$1[0], y = var$1[1];

var var$2 = [
  11,
  {y: 12}
], x = var$2[0], y = var$2[1].y;

// single prop object patterns are emitted without intermediate assignment

var y = x.y;

var x = z.y.x;

var var$3 = a.y, x = var$3.x, z = var$3.z;

// single elem array pattern are emitted without intermediate assignment

var x = y[0];

var x = y[0][0];

var x = y[0].x;

// tough cases

var 

x = z[0], y = z[1];

var 

x = z.x, y = z.y;

var 


var$4 = {
  x: 11,
  y: 12
}, x = var$4.x, y = var$4.y;
