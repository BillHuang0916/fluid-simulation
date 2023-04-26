let grid = new Array(10);

class GridCell{
	constructor(position, velocity, color){
		this.position = position;
		this.velocity = velocity;
		this.color = color;
	}
}

let particles = new Array(10);

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

	for (var i = 0; i < 10; i++){
	grid[i] = new Array(10);
	}

	//DEFINE VELOCITY GRID HERE
	for (var i = 0; i < 10; i++){
		for (var j = 0; j < 10; j++){
			grid[i][j] = new GridCell([i,j], [1,-2], color(255));
			// if (j < 5){
			// 	grid[i][j] = new GridCell([i,j], [1,-2], color(255));
			// } 
			// else{
			// 	grid[i][j] = new GridCell([i,j], [-1,-1], color(255));
			// }
			// if (i%50 < 25){
			// 	grid[i][j].color = color(0);
			// 	//console.log(i);
			// }
		}
	}

	grid[5][5] = new GridCell([i,j], [1,-2], color(255, 0, 0));

	
	// for (var i = 0; i < 200; i++){
	// 	particles[i] = new Particle([math.random()*200, math.random()*200]);
	// }
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
  gridCopy = new Array(10);
  for (var i = 0; i < 10; i++){
  	gridCopy[i] = grid[i].slice(0);
  }
  for (var i = 0; i < 10; i++){
  	for (var j = 0; j < 10; j++){
  		cell = grid[i][j];
		for(let x = i * 20; x < (i + 1) * 20; x++) {
			for(let y = j * 20 ; j < (i + 1) * 20; j++) {
				set(cell.position[0] + x, cell.position[1] + y, cell.color);
			}
		}
  		//console.log(cell);
  		//fill(cell.color);
  		//noStroke();
  		//rect(cell.position[0], cell.position[1], 1, 1);

  		// xVel = deltaTime * cell.velocity[0]*0.01;
  		// yVel = deltaTime * cell.velocity[1]*0.01;

  		// cell.color = gridCopy[positiveMod(math.floor(i-yVel),10)][positiveMod(math.floor(j-xVel),10)].color;
  	}
  }
  updatePixels();
  let fps = frameRate();
  fill(255);
  stroke(0);
  text("FPS: " + fps.toFixed(2), 10, height - 10);
}