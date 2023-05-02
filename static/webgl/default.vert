attribute vec2 aPosition;
varying vec2 v_uv;
varying vec2 v_pos;

void main() {
  // We need to negate the y coordinate because p5.js has (0,0) defined
  // in the bottom left corner while WebGL has it in the top left corner.
  v_uv = vec2(aPosition.x, 1.0 - aPosition.y);
  
  // WebGL canvas ranges from -1 to 1 for both x and y.
  v_pos = v_uv * 2.0 - 1.0;
  gl_Position = vec4(aPosition * 2.0 - 1.0, 0.0, 1.0);
}