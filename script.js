const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// UI Elements
const fuelText = document.getElementById("fuel-text");
const fuelBar = document.getElementById("fuel-bar");
const scoreText = document.getElementById("score-text");
const highscoreText = document.getElementById("highscore-text");
const gameOverScreen = document.getElementById("game-over-screen");
const gameOverReason = document.getElementById("game-over-reason");
const mobileBlastBtn = document.getElementById("mobile-blast-btn");

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- GAME VARIABLES ---
let gameActive = true;
let score = 0;
let highscore = localStorage.getItem("space_highscore") || 0;
highscoreText.textContent = highscore;

// Speed factor calibrated to match screen sizing automatically
let baseSpeed = 450; // Pixels per second

let player = {
    x: canvas.width / 2, 
    y: canvas.height * 0.7, 
    fuel: 50, 
    size: 14,       
    iconSize: 26,   
    color: "#00ffcc"
};

let asteroids = [];
let fuelCells = [];
let blasts = [];

// Delta Time speed control variables
let lastTime = performance.now();

// Input Trackers
const keys = {};
let isDraggingShip = false;
let touchOffset = { x: 0, y: 0 };

window.addEventListener("keydown", (e) => { keys[e.code] = true; });
window.addEventListener("keyup", (e) => { keys[e.code] = false; });

// --- DIRECT DRAG INTERACTION ---
window.addEventListener("touchstart", (e) => {
    if (!gameActive) return;
    const touch = e.touches[0];
    
    // Check if the user touched directly on or near the spaceship icon
    let distToShip = Math.hypot(touch.clientX - player.x, touch.clientY - player.y);
    
    // Generous bounding check area so fingers don't completely block visibility
    if (distToShip < player.size * 3) {
        isDraggingShip = true;
        // Keep tracking the distance between the touch point and ship center
        touchOffset.x = touch.clientX - player.x;
        touchOffset.y = touch.clientY - player.y;
    }
});

window.addEventListener("touchmove", (e) => {
    if (!isDraggingShip || !gameActive) return;
    const touch = e.touches[0];
    
    // Snap ship center instantly to finger position minus its tracking offset
    player.x = touch.clientX - touchOffset.x;
    player.y = touch.clientY - touchOffset.y;
});

window.addEventListener("touchend", () => {
    isDraggingShip = false;
});

// --- TRIGGERING BLASTING MECHANICS ---
function triggerBlast() {
    if (player.fuel >= 70 && gameActive) {
        blasts.push({
            x: player.x,
            y: player.y,
            radius: player.size * 1.5,
            maxRadius: 220, 
            growthSpeed: 12
        });
        player.fuel -= 25; 
    }
}

window.addEventListener("keydown", (e) => { if (e.code === "Space") triggerBlast(); });
mobileBlastBtn.addEventListener("touchstart", (e) => { e.preventDefault(); triggerBlast(); });

// --- EVOLUTION LOGIC ---
function updateShipEvolution(dt) {
    // Deplete fuel based on real elapsed time delta
    player.fuel -= 2.4 * dt; 

    if (player.fuel > 100) player.fuel = 100;
    if (player.fuel < 0) player.fuel = 0;

    if (player.fuel >= 70) {
        player.size = 22;       
        player.iconSize = 46;   
        player.color = "#ff00ff"; 
    } else if (player.fuel >= 40) {
        player.size = 15;       
        player.iconSize = 32;   
        player.color = "#38bdf8"; 
    } else {
        player.size = 10;        
        player.iconSize = 22;   
        player.color = "#f59e0b"; 
    }

    score += Math.floor(60 * dt); // Consistent dynamic scoring rates
    scoreText.textContent = score;

    fuelText.textContent = Math.floor(player.fuel);
    fuelBar.style.width = player.fuel + "%";
    
    if (player.fuel >= 70) fuelBar.style.backgroundColor = "#ff00ff";
    else if (player.fuel >= 40) fuelBar.style.backgroundColor = "#38bdf8";
    else fuelBar.style.backgroundColor = "#f59e0b";

    if (player.fuel <= 0) {
        endGame("Your ship ran completely out of propulsion fuel!");
    }
}

function handlePlayerMovement(dt) {
    // Keyboard inputs adjusted to balance elapsed frame time
    let speedThisFrame = baseSpeed * dt;

    if (keys["ArrowUp"]) player.y -= speedThisFrame;
    if (keys["ArrowDown"]) player.y += speedThisFrame;
    if (keys["ArrowLeft"]) player.x -= speedThisFrame;
    if (keys["ArrowRight"]) player.x += speedThisFrame;

    // Secure boundary clamps
    if (player.x - player.size < 0) player.x = player.size;
    if (player.x + player.size > canvas.width) player.x = canvas.width - player.size;
    if (player.y - player.size < 0) player.y = player.size;
    if (player.y + player.size > canvas.height) player.y = canvas.height - player.size;
}

function spawnObjects(dt) {
    // Normalizing spawn metrics relative to dynamic hardware speed ratios
    if (Math.random() < 2.4 * dt) { 
        asteroids.push({
            x: Math.random() * canvas.width,
            y: -30,
            size: Math.random() * 25 + 15, 
            speed: (Math.random() * 200 + 150), // Pixels per second
            seed: Math.random() * 1000, 
            vertices: [] 
        });
    }
    if (Math.random() < 1.3 * dt) {
        fuelCells.push({
            x: Math.random() * (canvas.width - 40) + 20,
            y: -20,
            size: 10,
            speed: 160 // Pixels per second
        });
    }
}

function updateObjects(dt) {
    // Translate positional speeds dynamically using time scales
    asteroids.forEach((a) => { a.y += a.speed * dt; });
    fuelCells.forEach((f) => { f.y += f.speed * dt; });

    // Filter out off-screen entities
    asteroids = asteroids.filter(a => a.y <= canvas.height + 40);
    fuelCells = fuelCells.filter(f => f.y <= canvas.height + 20);
}

function checkCollisions() {
    for (let i = fuelCells.length - 1; i >= 0; i--) {
        let f = fuelCells[i];
        let dist = Math.hypot(player.x - f.x, player.y - f.y);
        if (dist < player.size + f.size) {
            player.fuel += 15; 
            score += 200; 
            fuelCells.splice(i, 1);
            continue;
        }
    }

    for (let i = asteroids.length - 1; i >= 0; i--) {
        let a = asteroids[i];
        let distToPlayer = Math.hypot(player.x - a.x, player.y - a.y);
        
        if (distToPlayer < player.size + a.size) {
            if (player.fuel >= 70) {
                blasts.push({
                    x: player.x,
                    y: player.y,
                    radius: player.size * 1.5,
                    maxRadius: 220,
                    growthSpeed: 12
                });
                player.fuel -= 25; 
                asteroids.splice(i, 1);
                isDraggingShip = false; // Reset drag connection on knockback
            } else {
                endGame("KABOOM! Hit an asteroid without enough energy to blast it.");
                return;
            }
            continue;
        }

        for (let j = blasts.length - 1; j >= 0; j--) {
            let b = blasts[j];
            let distToBlast = Math.hypot(b.x - a.x, b.y - a.y);
            if (distToBlast < b.radius + a.size) {
                asteroids.splice(i, 1);
                score += 100; 
                break;
            }
        }
    }
}

function drawRealisticAsteroid(ctx, asteroid) {
    if (asteroid.vertices.length === 0) {
        const numVertices = 12 + Math.floor(asteroid.size / 5);
        for (let i = 0; i < numVertices; i++) {
            const angle = (i / numVertices) * Math.PI * 2;
            const roughness = asteroid.size * 0.3 * (Math.sin(asteroid.seed + i * 2) * 0.5 + 0.5);
            const radius = asteroid.size + roughness;
            asteroid.vertices.push({
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius
            });
        }
    }

    ctx.save();
    ctx.translate(asteroid.x, asteroid.y);
    ctx.fillStyle = "#888"; 
    ctx.strokeStyle = "#444"; 
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(asteroid.vertices[0].x, asteroid.vertices[0].y);
    for (let i = 1; i < asteroid.vertices.length; i++) {
        ctx.lineTo(asteroid.vertices[i].x, asteroid.vertices[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#666"; 
    for (let i = 0; i < asteroid.vertices.length; i += 3) {
        const p = asteroid.vertices[i];
        if (p) {
            ctx.beginPath();
            const cr = asteroid.size * 0.15;
            ctx.arc(p.x * 0.7, p.y * 0.7, cr, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    blasts.forEach((b, index) => {
        ctx.strokeStyle = "rgba(255, 0, 255, " + (1 - b.radius/b.maxRadius) + ")";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.stroke();
        
        b.radius += b.growthSpeed;
        if (b.radius >= b.maxRadius) blasts.splice(index, 1);
    });

    ctx.save(); 
    ctx.translate(player.x, player.y); 

    ctx.shadowBlur = 25;
    ctx.shadowColor = player.color;
    ctx.fillStyle = player.color + "55"; 
    ctx.beginPath();
    ctx.arc(0, 0, player.size + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0; 

    ctx.rotate(-45 * Math.PI / 180); 

    ctx.font = `${player.iconSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🚀", 0, 0);

    ctx.restore(); 

    asteroids.forEach((a) => { drawRealisticAsteroid(ctx, a); });

    fuelCells.forEach((f) => {
        ctx.font = `${f.size * 2}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🔋", f.x, f.y); 
    });
}

// --- SYSTEM ENGINE LOOPS ---
function gameLoop(currentTime) {
    if (!gameActive) return;

    // Calculate real elapsed time delta fraction (dt)
    let dt = (currentTime - lastTime) / 1000;
    if (dt > 0.1) dt = 0.1; // Protect loops from spikes during browser tab unfocus
    lastTime = currentTime;

    handlePlayerMovement(dt);
    updateShipEvolution(dt);
    spawnObjects(dt);
    updateObjects(dt);
    checkCollisions();
    draw();

    requestAnimationFrame(gameLoop);
}

function endGame(reason) {
    gameActive = false;
    gameOverReason.textContent = reason;
    gameOverScreen.classList.remove("hidden");

    if (score > highscore) {
        highscore = score;
        localStorage.setItem("space_highscore", highscore);
        highscoreText.textContent = highscore;
        gameOverReason.textContent += " NEW HIGH SCORE RECORD SET!";
    }
}

function restartGame() {
    gameActive = true;
    score = 0;
    player.x = canvas.width / 2;
    player.y = canvas.height * 0.7;
    player.fuel = 50;
    asteroids = [];
    fuelCells = [];
    blasts = [];
    isDraggingShip = false;
    gameOverScreen.classList.add("hidden");
    lastTime = performance.now();
    
    gameLoop(lastTime);
}

// Launch Game!
gameLoop(performance.now());