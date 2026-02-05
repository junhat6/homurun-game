// ============================================
// Homurun Contest - Smash Bros Style
// ============================================

const { World, Vec2, Box, Circle, Edge } = planck;

// Game Configuration
const CONFIG = {
    canvas: { width: 1000, height: 600 },
    physics: { scale: 30, gravity: -25 },
    game: { timeLimit: 10 },

    player: {
        width: 0.8,
        height: 1.5,
        speed: 8,
        jumpForce: 15,
        maxJumps: 2
    },

    sandbag: {
        width: 2.4,         // 2x bigger
        height: 3.6,        // 2x bigger
        mass: 5,
        restitution: 0.6,
        friction: 0.2,
        hitstun: 0.3
    },

    attacks: {
        weak: {
            damage: 3,
            knockback: 20,      // Increased
            angle: 0.4,
            startup: 0.05,
            active: 0.1,
            recovery: 0.08,
            range: 1.5
        },
        strong: {
            damage: 8,
            knockback: 40,      // Increased
            angle: 0.5,
            startup: 0.1,
            active: 0.15,
            recovery: 0.15,
            range: 1.8
        },
        smash: {
            damage: 15,
            maxDamage: 30,
            knockback: 60,      // Increased
            maxKnockback: 120,  // Big increase
            angle: 0.45,
            startup: 0.15,
            active: 0.2,
            recovery: 0.25,
            range: 2.0,
            chargeTime: 1.5
        },
        bat: {
            damage: 30,
            knockback: 250,     // Massive for home run
            angle: 0.55,        // Good launch angle
            startup: 0.15,
            active: 0.2,
            recovery: 0.4,
            range: 2.8
        }
    }
};

// Game State
const state = {
    phase: 'start',
    timer: CONFIG.game.timeLimit,
    damage: 0,
    combo: 0,
    maxCombo: 0,
    lastHitTime: 0,
    comboTimer: 0,
    distance: 0,
    maxDistance: 0,
    launched: false
};

// Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = CONFIG.canvas.width;
canvas.height = CONFIG.canvas.height;

// DOM Elements
const timerEl = document.getElementById('timer');
const damageEl = document.getElementById('damage');
const comboEl = document.getElementById('combo');
const distanceEl = document.getElementById('distance');
const startScreen = document.getElementById('start-screen');
const resultScreen = document.getElementById('result-screen');
const finalDistanceEl = document.getElementById('final-distance');
const maxComboEl = document.getElementById('max-combo');
const startBtn = document.getElementById('startBtn');
const retryBtn = document.getElementById('retryBtn');
const chargeBar = document.getElementById('charge-bar');
const chargeFill = document.getElementById('charge-fill');

// Physics
let world, ground, platform, sandbag, playerBody;

// Player State
const player = {
    facingRight: true,
    grounded: false,
    jumpsLeft: CONFIG.player.maxJumps,
    attacking: false,
    attackType: null,
    attackPhase: null,  // 'startup', 'active', 'recovery'
    attackTimer: 0,
    charging: false,
    chargeAmount: 0,
    canAttack: true
};

// Input State
const input = {
    left: false,
    right: false,
    jump: false,
    jumpPressed: false,
    weak: false,
    strong: false,
    smash: false,
    smashReleased: false,
    bat: false
};

// Images
let sandbagImage = null;

function loadImages() {
    const img = new Image();
    img.onload = () => { sandbagImage = img; };
    img.src = 'tubouchi_bag.png';
}

// Physics World Setup
function initPhysics() {
    world = new World({ gravity: Vec2(0, CONFIG.physics.gravity) });

    // Ground
    ground = world.createBody({ type: 'static', position: Vec2(500, 0.5) });
    ground.createFixture({ shape: new Box(500, 0.5), friction: 0.8 });

    // Platform
    const platformX = 8;
    platform = world.createBody({ type: 'static', position: Vec2(platformX, 2) });
    platform.createFixture({ shape: new Box(5, 0.3), friction: 0.9 });

    // Sandbag
    createSandbag(platformX, 5);

    // Player
    createPlayer(platformX - 3, 5);
}

function createSandbag(x, y) {
    sandbag = world.createBody({
        type: 'dynamic',
        position: Vec2(x, y),
        linearDamping: 0.05,    // Much less air resistance
        angularDamping: 0.5,
        fixedRotation: false
    });

    sandbag.createFixture({
        shape: new Box(CONFIG.sandbag.width / 2, CONFIG.sandbag.height / 2),
        density: CONFIG.sandbag.mass / (CONFIG.sandbag.width * CONFIG.sandbag.height),
        friction: CONFIG.sandbag.friction,
        restitution: CONFIG.sandbag.restitution
    });

    sandbag.startX = x;
    sandbag.hitstun = 0;
}

function createPlayer(x, y) {
    playerBody = world.createBody({
        type: 'dynamic',
        position: Vec2(x, y),
        fixedRotation: true,
        linearDamping: 0.1
    });

    playerBody.createFixture({
        shape: new Box(CONFIG.player.width / 2, CONFIG.player.height / 2),
        density: 1.0,
        friction: 0.3
    });
}

// Attack System
function startAttack(type) {
    if (!player.canAttack || player.attacking || state.phase !== 'playing' || state.launched) return;

    player.attacking = true;
    player.attackType = type;
    player.attackPhase = 'startup';
    player.attackTimer = 0;
    player.canAttack = false;

    if (type === 'smash') {
        player.charging = true;
        player.chargeAmount = 0;
        chargeBar.classList.remove('hidden');
    }
}

function releaseSmash() {
    if (player.attackType === 'smash' && player.charging) {
        player.charging = false;
        chargeBar.classList.add('hidden');
    }
}

function updateAttack(dt) {
    if (!player.attacking) return;

    const attack = CONFIG.attacks[player.attackType];
    player.attackTimer += dt;

    // Charging smash
    if (player.attackType === 'smash' && player.charging) {
        player.chargeAmount = Math.min(1, player.chargeAmount + dt / attack.chargeTime);
        chargeFill.style.width = (player.chargeAmount * 100) + '%';
        return;
    }

    // Attack phases
    if (player.attackPhase === 'startup') {
        if (player.attackTimer >= attack.startup) {
            player.attackPhase = 'active';
            player.attackTimer = 0;
        }
    } else if (player.attackPhase === 'active') {
        // Check hit
        checkAttackHit();

        if (player.attackTimer >= attack.active) {
            player.attackPhase = 'recovery';
            player.attackTimer = 0;
        }
    } else if (player.attackPhase === 'recovery') {
        if (player.attackTimer >= attack.recovery) {
            endAttack();
        }
    }
}

function checkAttackHit() {
    if (!sandbag) return;

    const attack = CONFIG.attacks[player.attackType];
    const playerPos = playerBody.getPosition();
    const sandbagPos = sandbag.getPosition();

    // Calculate hitbox position
    const direction = player.facingRight ? 1 : -1;
    const hitboxX = playerPos.x + direction * (CONFIG.player.width / 2 + attack.range / 2);
    const hitboxY = playerPos.y;

    // Check distance to sandbag
    const dx = sandbagPos.x - hitboxX;
    const dy = sandbagPos.y - hitboxY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < attack.range / 2 + CONFIG.sandbag.width / 2) {
        applyHit(attack, direction);
        player.attackPhase = 'recovery';
        player.attackTimer = 0;
    }
}

function applyHit(attack, direction) {
    let damage = attack.damage;
    let knockback = attack.knockback;

    // Smash charge multiplier
    if (player.attackType === 'smash') {
        const charge = player.chargeAmount;
        damage = attack.damage + (attack.maxDamage - attack.damage) * charge;
        knockback = attack.knockback + (attack.maxKnockback - attack.knockback) * charge;
    }

    // Apply damage
    state.damage += damage;

    // Combo system
    const now = performance.now();
    if (now - state.lastHitTime < 1000) {
        state.combo++;
        state.comboTimer = 1.0;
    } else {
        state.combo = 1;
        state.comboTimer = 1.0;
    }
    state.lastHitTime = now;
    state.maxCombo = Math.max(state.maxCombo, state.combo);

    // Combo damage bonus
    const comboMultiplier = 1 + (state.combo - 1) * 0.15;

    // Knockback scales with damage (like Smash Bros) - stronger scaling
    const damageMultiplier = 1 + (state.damage / 50) * 1.2;
    const finalKnockback = knockback * damageMultiplier * comboMultiplier;

    // Calculate knockback vector
    const angle = attack.angle + (player.grounded ? 0 : 0.2); // Slightly more upward in air
    const kbX = Math.cos(angle) * finalKnockback * direction;
    const kbY = Math.sin(angle) * finalKnockback;

    // Apply impulse
    sandbag.setLinearVelocity(Vec2(0, 0)); // Reset velocity for consistent knockback
    sandbag.applyLinearImpulse(Vec2(kbX, kbY), sandbag.getPosition());

    // Hitstun
    sandbag.hitstun = CONFIG.sandbag.hitstun * (state.damage / 50);

    // Bat launches
    if (player.attackType === 'bat') {
        state.launched = true;
        state.phase = 'flying';
        distanceEl.classList.remove('hidden');
    }

    // Visual feedback
    createHitEffect(sandbag.getPosition());
    updateUI();
}

function endAttack() {
    player.attacking = false;
    player.attackType = null;
    player.attackPhase = null;
    player.attackTimer = 0;
    player.charging = false;
    player.chargeAmount = 0;
    chargeBar.classList.add('hidden');

    // Short cooldown before next attack
    setTimeout(() => { player.canAttack = true; }, 50);
}

// Hit Effects
const hitEffects = [];

function createHitEffect(pos) {
    hitEffects.push({
        x: pos.x,
        y: pos.y,
        life: 0.3,
        maxLife: 0.3
    });
}

function updateHitEffects(dt) {
    for (let i = hitEffects.length - 1; i >= 0; i--) {
        hitEffects[i].life -= dt;
        if (hitEffects[i].life <= 0) {
            hitEffects.splice(i, 1);
        }
    }
}

// Player Movement
function updatePlayer(dt) {
    // Stop player control after launch or time up
    if (state.phase !== 'playing' || state.launched) {
        // Stop player movement during flying phase
        if (playerBody) {
            playerBody.setLinearVelocity(Vec2(0, 0));
        }
        return;
    }

    const vel = playerBody.getLinearVelocity();
    const pos = playerBody.getPosition();

    // Ground check
    player.grounded = pos.y < 3.5 && vel.y <= 0.1;
    if (player.grounded) {
        player.jumpsLeft = CONFIG.player.maxJumps;
    }

    // Horizontal movement (reduced during attack)
    const speedMult = player.attacking ? 0.3 : 1;
    let targetVelX = 0;

    if (input.left) {
        targetVelX = -CONFIG.player.speed * speedMult;
        player.facingRight = false;
    }
    if (input.right) {
        targetVelX = CONFIG.player.speed * speedMult;
        player.facingRight = true;
    }

    playerBody.setLinearVelocity(Vec2(targetVelX, vel.y));

    // Jump
    if (input.jumpPressed && player.jumpsLeft > 0 && !player.attacking) {
        playerBody.setLinearVelocity(Vec2(vel.x, CONFIG.player.jumpForce));
        player.jumpsLeft--;
        input.jumpPressed = false;
    }

    // Keep player in bounds during playing phase (match platform: 3-13)
    if (pos.x < 3) playerBody.setPosition(Vec2(3, pos.y));
    if (pos.x > 13) playerBody.setPosition(Vec2(13, pos.y));
}

// Sandbag Update
function updateSandbag(dt) {
    if (!sandbag) return;

    // Update hitstun
    if (sandbag.hitstun > 0) {
        sandbag.hitstun -= dt;
    }

    // During playing phase, keep sandbag in bounds but let it move freely
    if (state.phase === 'playing') {
        const pos = sandbag.getPosition();
        const vel = sandbag.getLinearVelocity();

        // Very light slowdown only when grounded and not in hitstun
        if (sandbag.hitstun <= 0 && pos.y < 3.5) {
            sandbag.setLinearVelocity(Vec2(vel.x * 0.995, vel.y));
        }

        // Soft bounds - bounce back (match platform: 3-13)
        if (pos.x < 3) {
            sandbag.setLinearVelocity(Vec2(Math.abs(vel.x) * 0.9 + 5, vel.y * 0.9));
        }
        if (pos.x > 13) {
            sandbag.setLinearVelocity(Vec2(-Math.abs(vel.x) * 0.9 - 5, vel.y * 0.9));
        }
    }

    // Calculate distance during flying phase
    if (state.phase === 'flying') {
        const pos = sandbag.getPosition();
        state.distance = Math.max(0, pos.x - sandbag.startX);
        state.maxDistance = Math.max(state.maxDistance, state.distance);

        // Check if stopped (more lenient - wait for it to really stop)
        const vel = sandbag.getLinearVelocity();
        if ((vel.length() < 0.3 && pos.y < 2) || pos.y < -10) {
            showResult();
        }
    }
}

// Coordinate Conversion
function toCanvas(x, y) {
    return {
        x: x * CONFIG.physics.scale,
        y: CONFIG.canvas.height - y * CONFIG.physics.scale
    };
}

// Drawing
function draw() {
    ctx.clearRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);

    // Camera follow during flying
    let cameraX = 0;
    if (state.phase === 'flying' && sandbag) {
        cameraX = Math.max(0, (sandbag.getPosition().x - 10) * CONFIG.physics.scale);
    }

    ctx.save();
    ctx.translate(-cameraX, 0);

    drawBackground(cameraX);
    drawDistanceMarkers(cameraX);
    drawPlatform();
    drawSandbag();
    drawPlayer();
    drawAttackHitbox();
    drawHitEffects();

    ctx.restore();
}

function drawBackground(cameraX) {
    // Sky
    const gradient = ctx.createLinearGradient(0, 0, 0, CONFIG.canvas.height);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(0.7, '#E0F7FA');
    gradient.addColorStop(1, '#90EE90');
    ctx.fillStyle = gradient;
    ctx.fillRect(cameraX, 0, CONFIG.canvas.width, CONFIG.canvas.height);

    // Ground
    const groundY = CONFIG.canvas.height - CONFIG.physics.scale;
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(cameraX, groundY, CONFIG.canvas.width, CONFIG.physics.scale);
}

function drawDistanceMarkers(cameraX) {
    ctx.fillStyle = '#333';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';

    const startM = Math.floor(cameraX / CONFIG.physics.scale / 5) * 5;
    for (let m = Math.max(0, startM); m < startM + 40; m += 5) {
        const x = m * CONFIG.physics.scale;
        const y = CONFIG.canvas.height - CONFIG.physics.scale - 60; // Moved up

        ctx.strokeStyle = m % 10 === 0 ? '#333' : '#888';
        ctx.lineWidth = m % 10 === 0 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(x, y + 40);
        ctx.lineTo(x, y + 55);
        ctx.stroke();

        if (m % 10 === 0) {
            // Background for readability
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.fillRect(x - 25, y - 5, 50, 22);
            ctx.fillStyle = '#333';
            ctx.fillText(`${m}m`, x, y + 12);
        }
    }
}

function drawPlatform() {
    const pos = toCanvas(8, 2);
    const w = 10 * CONFIG.physics.scale;
    const h = 0.6 * CONFIG.physics.scale;

    ctx.fillStyle = '#8B4513';
    ctx.fillRect(pos.x - w/2, pos.y - h/2, w, h);
    ctx.fillStyle = '#A0522D';
    ctx.fillRect(pos.x - w/2, pos.y - h/2, w, h/3);
}

function drawSandbag() {
    if (!sandbag) return;

    const pos = sandbag.getPosition();
    const angle = sandbag.getAngle();
    const canvasPos = toCanvas(pos.x, pos.y);
    const w = CONFIG.sandbag.width * CONFIG.physics.scale;
    const h = CONFIG.sandbag.height * CONFIG.physics.scale;

    ctx.save();
    ctx.translate(canvasPos.x, canvasPos.y);
    ctx.rotate(-angle);

    // Hitstun flash effect
    if (sandbag.hitstun > 0 && Math.floor(sandbag.hitstun * 20) % 2 === 0) {
        ctx.filter = 'brightness(1.5)';
    }

    if (sandbagImage) {
        ctx.drawImage(sandbagImage, -w/2, -h/2, w, h);
    } else {
        // Placeholder
        ctx.fillStyle = '#FFD93D';
        ctx.fillRect(-w/2, -h/2, w, h);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 3;
        ctx.strokeRect(-w/2, -h/2, w, h);

        ctx.fillStyle = '#333';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('坪内', 0, 5);
    }

    ctx.restore();

    // Damage display
    ctx.fillStyle = '#FF0000';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.floor(state.damage)}%`, canvasPos.x, canvasPos.y - h/2 - 15);
}

function drawPlayer() {
    if (!playerBody) return;

    const pos = playerBody.getPosition();
    const canvasPos = toCanvas(pos.x, pos.y);
    const w = CONFIG.player.width * CONFIG.physics.scale;
    const h = CONFIG.player.height * CONFIG.physics.scale;

    ctx.save();
    ctx.translate(canvasPos.x, canvasPos.y);
    if (!player.facingRight) ctx.scale(-1, 1);

    // Body
    ctx.fillStyle = player.attacking ? '#FF6B6B' : '#4A90D9';
    ctx.fillRect(-w/2, -h/2, w, h);

    // Head
    ctx.fillStyle = '#FFCC99';
    ctx.beginPath();
    ctx.arc(0, -h/2 - 12, 12, 0, Math.PI * 2);
    ctx.fill();

    // Attack arm
    if (player.attacking && player.attackPhase === 'active') {
        ctx.fillStyle = '#FFCC99';
        const armLength = CONFIG.attacks[player.attackType].range * CONFIG.physics.scale * 0.5;
        ctx.fillRect(w/2 - 5, -5, armLength, 10);

        // Fist/weapon
        if (player.attackType === 'bat') {
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(w/2 + armLength - 10, -15, 40, 12);
        } else {
            ctx.beginPath();
            ctx.arc(w/2 + armLength, 0, 8, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.restore();
}

function drawAttackHitbox() {
    if (!player.attacking || player.attackPhase !== 'active') return;

    const attack = CONFIG.attacks[player.attackType];
    const pos = playerBody.getPosition();
    const direction = player.facingRight ? 1 : -1;
    const hitboxX = pos.x + direction * (CONFIG.player.width / 2 + attack.range / 2);
    const canvasPos = toCanvas(hitboxX, pos.y);

    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(canvasPos.x, canvasPos.y, attack.range / 2 * CONFIG.physics.scale, 0, Math.PI * 2);
    ctx.stroke();
}

function drawHitEffects() {
    for (const effect of hitEffects) {
        const pos = toCanvas(effect.x, effect.y);
        const progress = 1 - effect.life / effect.maxLife;
        const size = 30 + progress * 50;
        const alpha = 1 - progress;

        ctx.strokeStyle = `rgba(255, 200, 0, ${alpha})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
        ctx.stroke();

        // Impact lines
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const inner = size * 0.5;
            const outer = size * (1 + progress * 0.5);
            ctx.beginPath();
            ctx.moveTo(pos.x + Math.cos(angle) * inner, pos.y + Math.sin(angle) * inner);
            ctx.lineTo(pos.x + Math.cos(angle) * outer, pos.y + Math.sin(angle) * outer);
            ctx.stroke();
        }
    }
}

// UI Update
function updateUI() {
    timerEl.textContent = `Time: ${state.timer.toFixed(1)}`;
    damageEl.textContent = `${Math.floor(state.damage)}%`;

    if (state.combo > 1 && state.comboTimer > 0) {
        comboEl.textContent = `${state.combo} COMBO`;
        comboEl.classList.remove('hidden');
    } else {
        comboEl.classList.add('hidden');
    }

    if (state.phase === 'flying' || state.phase === 'result') {
        distanceEl.textContent = `Distance: ${state.maxDistance.toFixed(2)}m`;
    }
}

// Game Loop
let lastTime = 0;

function gameLoop(currentTime) {
    const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
    lastTime = currentTime;

    if (state.phase === 'playing') {
        state.timer -= dt;
        state.comboTimer -= dt;

        if (state.timer <= 0) {
            state.timer = 0;
            if (!state.launched) {
                // Force bat swing at end - bypass normal attack check
                state.launched = true;
                state.phase = 'flying';
                distanceEl.classList.remove('hidden');

                // Apply bat hit directly
                const attack = CONFIG.attacks.bat;
                const damageMultiplier = 1 + (state.damage / 50) * 1.2;
                const finalKnockback = attack.knockback * damageMultiplier;
                const angle = attack.angle;
                const kbX = Math.cos(angle) * finalKnockback;
                const kbY = Math.sin(angle) * finalKnockback;

                sandbag.setLinearVelocity(Vec2(0, 0));
                sandbag.applyLinearImpulse(Vec2(kbX, kbY), sandbag.getPosition());
                createHitEffect(sandbag.getPosition());
            }
        }
    }

    if (state.phase === 'playing' || state.phase === 'flying') {
        world.step(1/60, dt, 3);

        updatePlayer(dt);
        updateAttack(dt);
        updateSandbag(dt);
        updateHitEffects(dt);
    }

    draw();
    updateUI();
    requestAnimationFrame(gameLoop);
}

// Result Screen
function showResult() {
    state.phase = 'result';
    resultScreen.classList.remove('hidden');
    finalDistanceEl.textContent = `${state.maxDistance.toFixed(2)}m`;
    maxComboEl.textContent = `Max Combo: ${state.maxCombo}`;
}

// Start/Reset
function startGame() {
    state.phase = 'playing';
    state.timer = CONFIG.game.timeLimit;
    state.damage = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.comboTimer = 0;
    state.distance = 0;
    state.maxDistance = 0;
    state.launched = false;

    player.attacking = false;
    player.canAttack = true;
    player.charging = false;
    player.chargeAmount = 0;

    startScreen.classList.add('hidden');
    resultScreen.classList.add('hidden');
    distanceEl.classList.add('hidden');
    chargeBar.classList.add('hidden');

    // Reset physics bodies
    if (sandbag) world.destroyBody(sandbag);
    if (playerBody) world.destroyBody(playerBody);
    createSandbag(8, 5);
    createPlayer(5, 5);

    updateUI();
}

function resetGame() {
    resultScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
}

// Input Handling
document.addEventListener('keydown', (e) => {
    if (e.repeat) return;

    switch (e.code) {
        case 'KeyA': case 'ArrowLeft': input.left = true; break;
        case 'KeyD': case 'ArrowRight': input.right = true; break;
        case 'KeyW': case 'ArrowUp': case 'Space':
            e.preventDefault();
            input.jump = true;
            input.jumpPressed = true;
            break;
        case 'KeyJ': startAttack('weak'); break;
        case 'KeyK': startAttack('strong'); break;
        case 'KeyL': startAttack('smash'); break;
        case 'KeyB':
            startAttack('bat');
            break;
        case 'Enter':
            if (state.phase === 'start') startGame();
            else if (state.phase === 'result') resetGame();
            break;
    }
});

document.addEventListener('keyup', (e) => {
    switch (e.code) {
        case 'KeyA': case 'ArrowLeft': input.left = false; break;
        case 'KeyD': case 'ArrowRight': input.right = false; break;
        case 'KeyW': case 'ArrowUp': case 'Space': input.jump = false; break;
        case 'KeyL': releaseSmash(); break;
    }
});

// Buttons
startBtn.addEventListener('click', startGame);
retryBtn.addEventListener('click', resetGame);

// Initialize
function init() {
    loadImages();
    initPhysics();
    requestAnimationFrame(gameLoop);
}

init();
