// ============================================
// Homurun Contest - Planck.js Physics Game
// ============================================

const { World, Vec2, Box, Circle, Edge, Settings } = planck;

// Game Configuration
const CONFIG = {
    canvas: {
        width: 1000,
        height: 600
    },
    physics: {
        scale: 30, // pixels per meter
        gravity: -30
    },
    game: {
        timeLimit: 10, // seconds
        maxDamage: 999
    },
    sandbag: {
        width: 1.5,
        height: 2,
        mass: 50,
        restitution: 0.3,
        friction: 0.5
    },
    bat: {
        power: 800,
        upwardAngle: 0.6 // radians (about 35 degrees)
    },
    punch: {
        power: 15,
        damagePerHit: 8
    }
};

// Game State
const state = {
    phase: 'start', // 'start', 'playing', 'flying', 'result'
    timer: CONFIG.game.timeLimit,
    damage: 0,
    distance: 0,
    maxDistance: 0,
    sandbagLaunched: false
};

// Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = CONFIG.canvas.width;
canvas.height = CONFIG.canvas.height;

// DOM Elements
const timerEl = document.getElementById('timer');
const damageEl = document.getElementById('damage');
const distanceEl = document.getElementById('distance');
const startScreen = document.getElementById('start-screen');
const resultScreen = document.getElementById('result-screen');
const finalDistanceEl = document.getElementById('final-distance');
const startBtn = document.getElementById('startBtn');
const retryBtn = document.getElementById('retryBtn');

// Physics World
let world;
let sandbag;
let ground;
let platform;
let platformStartX;

// Image for sandbag
let sandbagImage = null;
const SANDBAG_IMAGE_PATH = 'tubouchi_bag.png';

// Try to load the image
function loadSandbagImage() {
    const img = new Image();
    img.onload = () => {
        sandbagImage = img;
        console.log('Sandbag image loaded successfully');
    };
    img.onerror = () => {
        console.log('Sandbag image not found, using placeholder');
        sandbagImage = null;
    };
    img.src = SANDBAG_IMAGE_PATH;
}

// Initialize Physics World
function initPhysics() {
    world = new World({
        gravity: Vec2(0, CONFIG.physics.gravity)
    });

    // Ground (extends far to the right for flying distance)
    ground = world.createBody({
        type: 'static',
        position: Vec2(500, 0.5)
    });
    ground.createFixture({
        shape: new Box(500, 0.5),
        friction: 0.8
    });

    // Platform (starting area)
    platformStartX = 5;
    platform = world.createBody({
        type: 'static',
        position: Vec2(platformStartX, 2)
    });
    platform.createFixture({
        shape: new Box(3, 0.3),
        friction: 0.9
    });

    // Sandbag
    createSandbag();
}

// Create Sandbag Body
function createSandbag() {
    const startX = platformStartX;
    const startY = 4;

    sandbag = world.createBody({
        type: 'dynamic',
        position: Vec2(startX, startY),
        linearDamping: 0.1,
        angularDamping: 0.3
    });

    sandbag.createFixture({
        shape: new Box(CONFIG.sandbag.width / 2, CONFIG.sandbag.height / 2),
        density: CONFIG.sandbag.mass / (CONFIG.sandbag.width * CONFIG.sandbag.height),
        friction: CONFIG.sandbag.friction,
        restitution: CONFIG.sandbag.restitution
    });

    // Store initial position for distance calculation
    sandbag.startX = startX;
}

// Reset Sandbag
function resetSandbag() {
    if (sandbag) {
        world.destroyBody(sandbag);
    }
    createSandbag();
}

// Apply Punch Force
function punch(direction) {
    if (state.phase !== 'playing' || state.sandbagLaunched) return;

    const force = CONFIG.punch.power * direction;
    const pos = sandbag.getPosition();

    // Apply force slightly above center for more interesting physics
    sandbag.applyLinearImpulse(
        Vec2(force, Math.abs(force) * 0.3),
        Vec2(pos.x, pos.y + 0.5),
        true
    );

    // Add damage
    state.damage = Math.min(state.damage + CONFIG.punch.damagePerHit, CONFIG.game.maxDamage);

    // Visual feedback
    damageEl.classList.add('shake');
    setTimeout(() => damageEl.classList.remove('shake'), 100);

    updateUI();
}

// Launch with Bat (Final Hit)
function batSwing() {
    if (state.phase !== 'playing' || state.sandbagLaunched) return;

    state.sandbagLaunched = true;

    // Calculate launch power based on damage
    const damageMultiplier = 1 + (state.damage / 100);
    const launchPower = CONFIG.bat.power * damageMultiplier;

    const pos = sandbag.getPosition();

    // Launch at an angle
    const angle = CONFIG.bat.upwardAngle;
    const forceX = Math.cos(angle) * launchPower;
    const forceY = Math.sin(angle) * launchPower;

    sandbag.applyLinearImpulse(
        Vec2(forceX, forceY),
        pos,
        true
    );

    // Add some spin for visual effect
    sandbag.applyAngularImpulse(launchPower * 0.01);

    // Switch to flying phase
    state.phase = 'flying';
    distanceEl.classList.remove('hidden');
}

// Convert physics coordinates to canvas coordinates
function toCanvas(x, y) {
    return {
        x: x * CONFIG.physics.scale,
        y: CONFIG.canvas.height - y * CONFIG.physics.scale
    };
}

// Draw Functions
function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);

    // Calculate camera offset based on sandbag position
    let cameraX = 0;
    if (state.phase === 'flying' && sandbag) {
        const pos = sandbag.getPosition();
        cameraX = Math.max(0, (pos.x - 10) * CONFIG.physics.scale);
    }

    ctx.save();
    ctx.translate(-cameraX, 0);

    // Draw sky gradient
    const skyGradient = ctx.createLinearGradient(0, 0, 0, CONFIG.canvas.height);
    skyGradient.addColorStop(0, '#87CEEB');
    skyGradient.addColorStop(0.6, '#E0F7FA');
    skyGradient.addColorStop(1, '#90EE90');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(cameraX, 0, CONFIG.canvas.width, CONFIG.canvas.height);

    // Draw distance markers
    drawDistanceMarkers(cameraX);

    // Draw ground
    drawGround(cameraX);

    // Draw platform
    drawPlatform();

    // Draw sandbag
    drawSandbag();

    ctx.restore();
}

function drawDistanceMarkers(cameraX) {
    ctx.fillStyle = '#333';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';

    const startMeter = Math.floor(cameraX / CONFIG.physics.scale / 10) * 10;
    for (let m = startMeter; m < startMeter + 50; m += 5) {
        if (m <= 0) continue;
        const x = m * CONFIG.physics.scale;
        const groundY = CONFIG.canvas.height - 1 * CONFIG.physics.scale;

        // Marker line
        ctx.strokeStyle = '#666';
        ctx.lineWidth = m % 10 === 0 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(x, groundY);
        ctx.lineTo(x, groundY + 20);
        ctx.stroke();

        // Distance label
        if (m % 10 === 0) {
            ctx.fillText(`${m}m`, x, groundY + 35);
        }
    }
}

function drawGround(cameraX) {
    const groundY = CONFIG.canvas.height - 1 * CONFIG.physics.scale;

    // Grass
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(cameraX, groundY, CONFIG.canvas.width, CONFIG.canvas.height - groundY);

    // Grass pattern
    ctx.strokeStyle = '#388E3C';
    ctx.lineWidth = 2;
    for (let x = cameraX; x < cameraX + CONFIG.canvas.width; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, groundY);
        ctx.lineTo(x + 5, groundY - 10);
        ctx.stroke();
    }
}

function drawPlatform() {
    const pos = toCanvas(platformStartX, 2);
    const width = 6 * CONFIG.physics.scale;
    const height = 0.6 * CONFIG.physics.scale;

    // Platform shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(pos.x - width / 2 + 5, pos.y - height / 2 + 5, width, height);

    // Platform
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(pos.x - width / 2, pos.y - height / 2, width, height);

    // Platform top highlight
    ctx.fillStyle = '#A0522D';
    ctx.fillRect(pos.x - width / 2, pos.y - height / 2, width, height / 3);
}

function drawSandbag() {
    if (!sandbag) return;

    const pos = sandbag.getPosition();
    const angle = sandbag.getAngle();
    const canvasPos = toCanvas(pos.x, pos.y);

    const width = CONFIG.sandbag.width * CONFIG.physics.scale;
    const height = CONFIG.sandbag.height * CONFIG.physics.scale;

    ctx.save();
    ctx.translate(canvasPos.x, canvasPos.y);
    ctx.rotate(-angle);

    if (sandbagImage) {
        // Draw the loaded image
        ctx.drawImage(sandbagImage, -width / 2, -height / 2, width, height);
    } else {
        // Draw placeholder sandbag
        // Body
        ctx.fillStyle = '#FFD93D';
        ctx.fillRect(-width / 2, -height / 2, width, height);

        // Face outline
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 3;
        ctx.strokeRect(-width / 2, -height / 2, width, height);

        // Eyes
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(-width / 6, -height / 6, 8, 0, Math.PI * 2);
        ctx.arc(width / 6, -height / 6, 8, 0, Math.PI * 2);
        ctx.fill();

        // Mouth (changes based on damage)
        ctx.beginPath();
        if (state.damage > 50) {
            // Distressed face
            ctx.arc(0, height / 6, 15, 0.2 * Math.PI, 0.8 * Math.PI);
        } else {
            // Normal face
            ctx.arc(0, height / 8, 15, 0, Math.PI);
        }
        ctx.stroke();

        // "坪内" text
        ctx.fillStyle = '#333';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('坪内', 0, height / 3);
    }

    ctx.restore();

    // Draw damage percentage above sandbag
    if (state.phase === 'playing' || state.phase === 'flying') {
        ctx.fillStyle = '#FF0000';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.floor(state.damage)}%`, canvasPos.x, canvasPos.y - height / 2 - 20);
    }
}

// Update UI
function updateUI() {
    timerEl.textContent = `Time: ${state.timer.toFixed(1)}`;
    damageEl.textContent = `Damage: ${Math.floor(state.damage)}%`;

    if (state.phase === 'flying' || state.phase === 'result') {
        distanceEl.textContent = `Distance: ${state.maxDistance.toFixed(2)}m`;
    }
}

// Game Loop
let lastTime = 0;

function gameLoop(currentTime) {
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    if (state.phase === 'playing') {
        // Update timer
        state.timer -= deltaTime;
        if (state.timer <= 0) {
            state.timer = 0;
            // Auto-launch if time runs out
            if (!state.sandbagLaunched) {
                batSwing();
            }
        }
    }

    if (state.phase === 'playing' || state.phase === 'flying') {
        // Step physics
        world.step(1 / 60, deltaTime, 3);

        // Calculate distance
        if (sandbag) {
            const pos = sandbag.getPosition();
            state.distance = Math.max(0, pos.x - sandbag.startX);
            state.maxDistance = Math.max(state.maxDistance, state.distance);

            // Check if sandbag has stopped (flying phase)
            if (state.phase === 'flying') {
                const vel = sandbag.getLinearVelocity();
                const speed = vel.length();

                // Check if stopped or fell off screen
                if ((speed < 0.5 && pos.y < 3) || pos.y < -5) {
                    showResult();
                }
            }
        }
    }

    // Draw
    draw();
    updateUI();

    requestAnimationFrame(gameLoop);
}

// Show Result
function showResult() {
    state.phase = 'result';
    resultScreen.classList.remove('hidden');
    finalDistanceEl.textContent = `${state.maxDistance.toFixed(2)}m`;
}

// Start Game
function startGame() {
    state.phase = 'playing';
    state.timer = CONFIG.game.timeLimit;
    state.damage = 0;
    state.distance = 0;
    state.maxDistance = 0;
    state.sandbagLaunched = false;

    startScreen.classList.add('hidden');
    resultScreen.classList.add('hidden');
    distanceEl.classList.add('hidden');

    resetSandbag();
    updateUI();
}

// Reset Game
function resetGame() {
    resultScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
}

// Input Handling
const keys = {};

document.addEventListener('keydown', (e) => {
    if (keys[e.code]) return; // Prevent key repeat
    keys[e.code] = true;

    if (state.phase === 'playing') {
        switch (e.code) {
            case 'KeyA':
            case 'ArrowLeft':
                punch(-1);
                break;
            case 'KeyD':
            case 'ArrowRight':
                punch(1);
                break;
            case 'Space':
                e.preventDefault();
                batSwing();
                break;
        }
    }

    if (e.code === 'Enter') {
        if (state.phase === 'start') {
            startGame();
        } else if (state.phase === 'result') {
            resetGame();
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Button Event Listeners
startBtn.addEventListener('click', startGame);
retryBtn.addEventListener('click', resetGame);

// Initialize
function init() {
    loadSandbagImage();
    initPhysics();
    requestAnimationFrame(gameLoop);
}

init();
