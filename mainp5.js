let grid = new Array(200);

class GridCell{
	constructor(position, velocity, color){
		this.position = position;
		this.velocity = velocity;
		this.color = color;
	}
}

let particles = new Array(200);

function positiveMod(m, n){
	return ((m%n)+n)%n;
}

class Particle{
	constructor(position){
		this.position = position;
	}
}

function setup(){
	createCanvas(200,200);

	for (var i = 0; i < 200; i++){
	grid[i] = new Array(200);
	}

	//DEFINE VELOCITY GRID HERE
	for (var i = 0; i < 200; i++){
		for (var j = 0; j < 200; j++){
			if (j < 100){
				grid[i][j] = new GridCell([i,j], [1,-2], color(255));
			} 
			else{
				grid[i][j] = new GridCell([i,j], [-1,-1], color(255));
			}
			if (i%50 < 25){
				grid[i][j].color = color(0);
				//console.log(i);
			}
		}
	}
	
	for (var i = 0; i < 200; i++){
	particles[i] = new Particle([math.random()*200, math.random()*200]);
	}
}

function mouseClicked(){
	if (mouseX < 200 && mouseY < 200){
		var x = math.floor(mouseX);
		var y = math.floor(mouseY);

		for(var i = x-10; i < x+10; i++){
			for(var j = y-10; j < y+10; j++){
				grid[i][j].velocity[0] += 2;
				grid[i][j].velocity[1] += 2;
			}
		}
	}
}

function draw() {
  gridCopy = new Array(200);
  for (var i = 0; i < 200; i++){
  	gridCopy[i] = grid[i].slice(0);
  }
  for (var i = 0; i < 200; i++){
  	for (var j = 0; j < 200; j++){
  		cell = grid[i][j];
  		set(cell.position[0], cell.position[1], cell.color);
  		//console.log(cell);
  		//fill(cell.color);
  		//noStroke();
  		//rect(cell.position[0], cell.position[1], 1, 1);

  		xVel = deltaTime * cell.velocity[0]*0.1;
  		yVel = deltaTime * cell.velocity[1]*0.1;

  		cell.color = gridCopy[positiveMod(math.floor(i-yVel),200)][positiveMod(math.floor(j-xVel),200)].color;
  	}
  }
  updatePixels();
  let fps = frameRate();
  fill(255);
  stroke(0);
  text("FPS: " + fps.toFixed(2), 10, height - 10);
}