precision highp float;

varying vec2 v_uv;

uniform vec4 color1;
uniform vec4 color2;
uniform vec4 color3;

void main() {
    if(v_uv.x < 0.33) {
        gl_FragColor = color1;
    } else if(v_uv.x < 0.67) {
        gl_FragColor = color2;
    } else {
        gl_FragColor = color3;
    }
}