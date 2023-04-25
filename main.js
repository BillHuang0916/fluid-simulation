//create the rendering context
var container = document.body;
var gl = GL.create({width:400, height:300});
container.appendChild(gl.canvas);
    
//calling animate will do the requestAnimationFrame automatically and call ondraw
gl.animate();
    
//build the mesh by loading a mesh from a OBJ file
//var mesh = GL.Mesh.fromURL("https://raw.githubusercontent.com/jagenjo/litegl.js/master/examples/man.obj");
    
//set some global properties
var cam_pos = [0,100,250];
var cam_center = [0,100,0];
    
//create basic matrices for cameras and transformation
var proj = mat4.create();
var view = mat4.create();
var model = mat4.create();
var mvp = mat4.create();
var temp = mat4.create();
    
    
//set the camera position
mat4.perspective(proj, 45 * DEG2RAD, gl.canvas.width / gl.canvas.height, 0.1, 1000);

let grid = new Array(300);
let particles = new Array(300);

for (var i = 0; i < 300; i++){
	grid[i] = new Array(400);
}

for (var i = 0; i < 300; i++){
	for (var j = 0; j < 400; j++){
		grid[i][j] = [1,1]
	}
}

class Particle{
	constructor(position){
		this.position = position;
	}
}
    
//basic phong shader
/*var shader = new Shader('\
	precision highp float;\
	attribute vec3 a_vertex;\
	attribute vec3 a_normal;\
	varying vec3 v_normal;\
	uniform mat4 u_mvp;\
	uniform mat4 u_model;\
	void main() {\
		v_normal = (u_model * vec4(a_normal,0.0)).xyz;\
		gl_Position = u_mvp * vec4(a_vertex,1.0);\
	}\
	', '\
	precision highp float;\
	varying vec3 v_normal;\
	uniform vec3 u_lightvector;\
	uniform vec4 u_camera_position;\
	uniform vec4 u_color;\
	void main() {\
	  vec3 N = normalize(v_normal);\
	  //fake half light\n\
	  float NdotL = dot(u_lightvector,N) * 0.5 + 0.5;\
	  NdotL *= NdotL;\
	  gl_FragColor = u_color * max(0.0, NdotL);\
	}\
');
*/     
//generic gl flags and settings
gl.clearColor(0.1,0.1,0.1,1);
gl.enable( gl.DEPTH_TEST );

//rendering loop
gl.ondraw = function()
{
	gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
	mat4.lookAt(view, cam_pos, cam_center, [0,1,0]);
	//create modelview and projection matrices
	mat4.multiply(temp,view,model);
	mat4.multiply(mvp,proj,temp);
	
	//render mesh using the shader
	if(mesh)
		shader.uniforms({ //set uniforms
			u_color: [1,1,1,1],
			u_lightvector: vec3.normalize(vec3.create(),[1,1,1]),
			u_camera_position: cam_pos,
			u_model: model,
			u_mvp: mvp
		}).draw(mesh); //draw mesh
};

//update loop
gl.onupdate = function(dt)
{
	//rotate world
	mat4.rotateY(model,model,dt*0.2);
};