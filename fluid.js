const dt = 0.0005;
const forceAmplifier = 100;
const forceOffset = 0.5;
const PRESSURE_STEPS = 10;

let canvas = document.querySelector("#fluid_sim");
let gl = canvas.getContext("webgl");
let vertexShader;
let fillProgram;
let fieldProgram;
let divergenceProgram;
let pressureProgram;
let velocityUpdateProgram;
let advectionProgram;
let colorProgram;
let positionLocation;

let divergence;
let velocity;
let pressure;
let mouseHeld = false
let mousePos = null;
let prevMousePos = null;

var velocityFramebuffers = [];
var pressureFramebuffers = [];
var viscosityFramebuffers = [];

gl.getExtension("OES_texture_float");

function getCurrentFramebuffer(FBarray, i){
    return FBarray[i%2];
}

function resizeCanvasToDisplaySize(canvas) {
    // Lookup the size the browser is displaying the canvas in CSS pixels.
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    // Check if the canvas is not the same size.
    const needResize = canvas.width !== displayWidth ||
        canvas.height !== displayHeight;

    if (needResize) {
        // Make the canvas the same size
        canvas.width = displayWidth;
        canvas.height = displayHeight;
    }

    return needResize;
}

function createShader(type, source) {
    let shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    let success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (success) {
        return shader;
    }

    console.log(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
}

class Program {
    constructor(vertexShader, fragmentShader) {
        this.program = createProgram(vertexShader, fragmentShader);
        this.uniforms = getUniforms(this.program);
    }
}

function createProgram(vertexShader, fragmentShader) {
    let program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    let success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (success) {
        return program;
    }

    console.log(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
}

/*
 * Function to generate a dictionary of uniform locations for easy access.
 * Taken from https://github.com/PavelDoGreat/WebGL-Fluid-Simulation/blob/54ed78b00d7d8209790dd167dece747bfe9c5b88/script.js#L408
 */
function getUniforms(program) {
    let uniforms = [];
    let uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < uniformCount; i++) {
        let uniformName = gl.getActiveUniform(program, i).name;
        uniforms[uniformName] = gl.getUniformLocation(program, uniformName);
    }
    return uniforms;
}

function createAndSetupTexture() {
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    return texture;
}

function createFrameBufferObject() {
    gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0,
        gl.RGBA, gl.FLOAT, null);
}


/* Create Programs */

const defaultVertexShaderStr = `
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
}`

const fillShaderStr = `
precision highp float;

uniform vec4 color;

void main() {
  gl_FragColor = color;
}`

vertexShader = createShader(gl.VERTEX_SHADER, defaultVertexShaderStr);
fillShader = createShader(gl.FRAGMENT_SHADER, fillShaderStr);
fillProgram = new Program(vertexShader, fillShader);
// Create a buffer to put three 2d clip space points in
let positionBuffer = gl.createBuffer();
// Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0, 0,
    1, 0,
    0, 1,
    0, 1,
    1, 0,
    1, 1,
 ]), gl.STATIC_DRAW);

function render(dt) {
    resizeCanvasToDisplaySize(canvas);

    // Create a texture.
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Set the parameters so we can render any size image.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0,
        gl.RGBA, gl.UNSIGNED_BYTE, null);


    // Create FBO
    let fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Clear the canvas
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Bind Program
    gl.useProgram(fillProgram.program);
    gl.enableVertexAttribArray(gl.getAttribLocation(fillProgram.program, "aPosition"));
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Set FBO
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    // Set fill color
    gl.uniform4fv(fillProgram.uniforms.color, [0.0, 1.0, 0.0, 1.0]);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Display
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.viewport(0, 0, canvas.width, canvas.height);
}

render(1);