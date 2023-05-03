precision highp float;

varying vec2 v_uv;

uniform vec2 wall_size;
uniform sampler2D velocity;

void main() {
    if(v_uv.x < wall_size.x) {
        // Left wall
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        //gl_FragColor = -texture2D(velocity, vec2(wall_size.x, v_uv.y));
    } else if((1.0 - v_uv.x) < wall_size.x) {
        // Right wall
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        // gl_FragColor = -texture2D(velocity, vec2(1.0 - wall_size.x, v_uv.y));
    } else if(v_uv.y < wall_size.y) {
        // Floor
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        // gl_FragColor = -texture2D(velocity, vec2(v_uv.x, wall_size.y));
    } else if((1.0 - v_uv.y) < wall_size.y) {
        // Ceiling
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        // gl_FragColor = -texture2D(velocity, vec2(v_uv.x, 1.0 - wall_size.y));
    } else {
        gl_FragColor = texture2D(velocity, v_uv);
    }
}