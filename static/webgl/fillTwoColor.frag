precision highp float;

varying vec2 v_uv;

uniform vec4 color1;
uniform vec4 color2;

void main() {
    if(v_uv.x < 0.5) {
        gl_FragColor = color1;
    } else {
        gl_FragColor = color2;
    }
}