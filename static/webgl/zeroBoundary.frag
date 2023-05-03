precision highp float;

varying vec2 v_uv;

uniform vec2 wall_size;
uniform sampler2D grid;

void main() {
    if(v_uv.x < wall_size.x) {
        // Left wall
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else if((1.0 - v_uv.x) < wall_size.x) {
        // Right wall
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else if(v_uv.y < wall_size.y) {
        // Floor
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else if((1.0 - v_uv.y) < wall_size.y) {
        // Ceiling
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else {
        gl_FragColor = texture2D(grid, v_uv);
    }
}