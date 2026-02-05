// ============================================
// Homurun Contest - Pro Fighting Game Style
// ============================================

const { World, Vec2, Box, Circle, Edge } = planck;

// Game Configuration
const CONFIG = {
    canvas: { width: 1000, height: 600 },
    physics: { scale: 30, gravity: -50 },  // 重力強化（素早く落下）
    game: { timeLimit: 15 },  // 15秒に延長

    player: {
        width: 0.8,
        height: 1.5,
        speed: 8,
        jumpForce: 20,  // 重力強化に合わせて調整
        maxJumps: 2,
        airDashSpeed: 12,
        airDashDuration: 0.15
    },

    sandbag: {
        width: 2.4,
        height: 3.6,
        mass: 5,
        weight: 100,        // スマブラ式の重さ（100が標準）
        restitution: 0.6,
        friction: 0.2,
        hitstun: 0.3
    },

    // スマブラ式ノックバック計算パラメータ
    knockback: {
        baseGravity: 0.03,      // 基本落下補正
        hitstunMultiplier: 0.4, // ヒットストン倍率
        diStrength: 0.3,        // DI（方向影響）の強さ
        bounceDecay: 0.7,       // バウンド減衰
        wallBounceThreshold: 30 // 壁バウンドの閾値
    },

    // コンボシステム
    combo: {
        // コンボボーナス（ダメージ増加！）
        bonus: {
            perHit: 0.08,       // 1ヒットごとのボーナス増加
            maximum: 1.8        // 最大倍率
        },
        stale: {
            queueSize: 6,       // ステールキュー
            penalty: 0.08,      // 1回あたりのペナルティ
            minimum: 0.4        // 最低倍率
        },
        justFrame: {
            window: 0.08,       // ジャストフレームの猶予（秒）
            bonus: 1.3          // ジャストフレームボーナス
        },
        counterHit: {
            damageMultiplier: 1.5,
            knockbackMultiplier: 1.3,
            hitstunMultiplier: 1.5
        }
    },

    // Rage（怒り）システム
    rage: {
        enabled: true,
        startDamage: 0,         // Rageが始まるダメージ
        maxDamage: 150,         // 最大Rageダメージ
        maxMultiplier: 1.15     // 最大ノックバック倍率
    },

    attacks: {
        // ============ 地上技 ============
        // 弱攻撃 - 連打用、キャンセル可能
        weak: {
            damage: 3,
            baseKnockback: 8,
            knockbackGrowth: 0.6,
            angle: 40,
            startup: 0.03,
            active: 0.08,
            recovery: 0.05,
            range: 1.2,
            hitstop: 0.03,
            cancelable: ['weak2', 'strong', 'upperStrong', 'downStrong', 'jump'],
            landingLag: 0.05,
            hitboxDir: 'forward'
        },
        // 弱攻撃2段目
        weak2: {
            damage: 3,
            baseKnockback: 10,
            knockbackGrowth: 0.7,
            angle: 50,
            startup: 0.03,
            active: 0.08,
            recovery: 0.06,
            range: 1.3,
            hitstop: 0.04,
            cancelable: ['weak3', 'strong', 'upperStrong', 'jump'],
            landingLag: 0.05,
            hitboxDir: 'forward'
        },
        // 弱攻撃3段目（フィニッシュ）
        weak3: {
            damage: 5,
            baseKnockback: 18,
            knockbackGrowth: 1.0,
            angle: 45,
            startup: 0.04,
            active: 0.1,
            recovery: 0.12,
            range: 1.5,
            hitstop: 0.06,
            cancelable: [],
            landingLag: 0.08,
            hitboxDir: 'forward'
        },
        // 横強攻撃
        strong: {
            damage: 8,
            baseKnockback: 16,
            knockbackGrowth: 1.1,
            angle: 35,
            startup: 0.06,
            active: 0.1,
            recovery: 0.1,
            range: 1.8,
            hitstop: 0.06,
            cancelable: ['smash', 'jump'],
            landingLag: 0.1,
            hitboxDir: 'forward'
        },
        // 上強 - ランチャー（浮かせ技）強化！
        upperStrong: {
            damage: 9,
            baseKnockback: 45,      // 大幅強化
            knockbackGrowth: 1.3,
            angle: 88,              // ほぼ真上
            startup: 0.05,
            active: 0.12,
            recovery: 0.12,
            range: 2.0,             // 範囲拡大
            hitstop: 0.08,
            cancelable: ['jump'],
            landingLag: 0.08,
            hitboxDir: 'up'         // 上方向ヒットボックス
        },
        // 下強 - 足払い
        downStrong: {
            damage: 6,
            baseKnockback: 12,
            knockbackGrowth: 0.8,
            angle: 25,              // 低い角度
            startup: 0.04,
            active: 0.1,
            recovery: 0.08,
            range: 1.6,
            hitstop: 0.04,
            cancelable: ['strong', 'upperStrong', 'jump'],
            landingLag: 0.06,
            hitboxDir: 'forward'
        },
        // スマッシュ - フィニッシャー
        smash: {
            damage: 15,
            maxDamage: 30,
            baseKnockback: 35,
            maxBaseKnockback: 60,
            knockbackGrowth: 1.8,
            maxKnockbackGrowth: 2.8,
            angle: 42,
            startup: 0.1,
            active: 0.12,
            recovery: 0.18,
            range: 2.0,
            hitstop: 0.12,
            chargeTime: 1.5,
            cancelable: [],
            landingLag: 0.2,
            hitboxDir: 'forward'
        },
        // 上スマッシュ
        upSmash: {
            damage: 14,
            maxDamage: 26,
            baseKnockback: 40,
            maxBaseKnockback: 70,
            knockbackGrowth: 1.6,
            maxKnockbackGrowth: 2.4,
            angle: 85,
            startup: 0.08,
            active: 0.15,
            recovery: 0.2,
            range: 2.2,
            hitstop: 0.1,
            chargeTime: 1.5,
            cancelable: [],
            landingLag: 0.2,
            hitboxDir: 'up'
        },
        // 下スマッシュ（両側攻撃）
        downSmash: {
            damage: 13,
            maxDamage: 24,
            baseKnockback: 28,
            maxBaseKnockback: 50,
            knockbackGrowth: 1.5,
            maxKnockbackGrowth: 2.2,
            angle: 25,              // 低い角度で吹っ飛ばす
            startup: 0.06,
            active: 0.18,
            recovery: 0.22,
            range: 2.0,
            hitstop: 0.1,
            chargeTime: 1.5,
            cancelable: [],
            landingLag: 0.2,
            hitboxDir: 'around'     // 両側
        },
        // ダッシュ攻撃
        dashAttack: {
            damage: 10,
            baseKnockback: 20,
            knockbackGrowth: 1.1,
            angle: 55,
            startup: 0.04,
            active: 0.15,
            recovery: 0.15,
            range: 1.8,
            hitstop: 0.07,
            cancelable: [],
            landingLag: 0.1,
            hitboxDir: 'forward'
        },
        // ============ 空中技 ============
        // 空中N攻撃（ニュートラル）
        nair: {
            damage: 7,
            baseKnockback: 14,
            knockbackGrowth: 0.9,
            angle: 50,
            startup: 0.04,
            active: 0.15,
            recovery: 0.1,
            range: 1.8,
            hitstop: 0.05,
            cancelable: [],
            landingLag: 0.08,
            hitboxDir: 'around'     // 周囲
        },
        // 空中前攻撃
        fair: {
            damage: 9,
            baseKnockback: 18,
            knockbackGrowth: 1.2,
            angle: 40,
            startup: 0.06,
            active: 0.1,
            recovery: 0.12,
            range: 1.6,
            hitstop: 0.07,
            cancelable: [],
            landingLag: 0.1,
            hitboxDir: 'forward'
        },
        // 空中後攻撃（強力）
        bair: {
            damage: 12,
            baseKnockback: 22,
            knockbackGrowth: 1.4,
            angle: 35,
            startup: 0.08,
            active: 0.08,
            recovery: 0.15,
            range: 1.5,
            hitstop: 0.1,
            cancelable: [],
            landingLag: 0.12,
            hitboxDir: 'back'
        },
        // 空中上攻撃
        uair: {
            damage: 8,
            baseKnockback: 20,
            knockbackGrowth: 1.1,
            angle: 80,
            startup: 0.05,
            active: 0.12,
            recovery: 0.1,
            range: 1.8,
            hitstop: 0.06,
            cancelable: [],
            landingLag: 0.08,
            hitboxDir: 'up'
        },
        // 空中下攻撃（メテオ）強化！
        dair: {
            damage: 13,
            baseKnockback: 30,      // 強化
            knockbackGrowth: 1.5,
            angle: -75,             // 真下に近い
            startup: 0.1,
            active: 0.12,           // 持続延長
            recovery: 0.2,
            range: 2.0,             // 範囲拡大
            hitstop: 0.18,
            cancelable: [],
            landingLag: 0.2,
            hitboxDir: 'down',
            isMeteor: true
        },
        // バット - 最終兵器（溜め可能！）
        bat: {
            damage: 35,
            maxDamage: 50,           // 最大溜めダメージ
            baseKnockback: 200,
            maxBaseKnockback: 350,   // 最大溜めノックバック
            knockbackGrowth: 3.5,
            maxKnockbackGrowth: 5.0, // 最大溜め成長率
            angle: 45,
            startup: 0.15,
            active: 0.2,
            recovery: 0.4,
            range: 3.0,
            hitstop: 0.3,
            chargeTime: 2.0,         // 溜め時間
            cancelable: [],
            landingLag: 0.3,
            hitboxDir: 'forward'
        }
    }
};

// Game State
const state = {
    phase: 'start',
    timer: CONFIG.game.timeLimit,
    damage: 0,
    playerDamage: 0,    // プレイヤーのダメージ（Rage用）
    combo: 0,
    maxCombo: 0,
    lastHitTime: 0,
    comboTimer: 0,
    distance: 0,
    maxDistance: 0,
    launched: false,
    hitstop: 0,         // グローバルヒットストップ
    slowMotion: 0,      // スローモーション残り時間
    slowMotionScale: 1, // スローの倍率
    staleQueue: [],     // ステールキュー
    lastJustFrame: false,
    lastCounterHit: false,
    totalDamageDealt: 0,
    comboProration: 1.0
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
const rankingScreen = document.getElementById('ranking-screen');
const rankingList = document.getElementById('ranking-list');
const rankingBtn = document.getElementById('rankingBtn');
const closeRankingBtn = document.getElementById('closeRankingBtn');

// Physics
let world, ground, platform, sandbag, playerBody;

// Player State
const player = {
    facingRight: true,
    grounded: false,
    jumpsLeft: CONFIG.player.maxJumps,
    attacking: false,
    attackType: null,
    attackPhase: null,
    attackTimer: 0,
    charging: false,
    chargeAmount: 0,
    canAttack: true,
    airDashing: false,
    airDashTimer: 0,
    canAirDash: true,
    lastAttackHit: false,
    cancelWindow: false,
    landingLag: 0
};

// Input State
const input = {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    jumpPressed: false,
    weak: false,
    weakPressed: false,
    strong: false,
    strongPressed: false,
    smash: false,
    smashReleased: false,
    bat: false,
    airDash: false,
    airDashPressed: false
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
    ground.setUserData({ type: 'ground' });

    // Platform
    const platformX = 8;
    platform = world.createBody({ type: 'static', position: Vec2(platformX, 2) });
    platform.createFixture({ shape: new Box(5, 0.3), friction: 0.9 });
    platform.setUserData({ type: 'platform' });

    // Walls removed - handled in updateSandbag

    // Sandbag
    createSandbag(platformX, 5);

    // Player
    createPlayer(platformX - 3, 5);

}

function createSandbag(x, y) {
    sandbag = world.createBody({
        type: 'dynamic',
        position: Vec2(x, y),
        linearDamping: 0.02,
        angularDamping: 0.3,
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
    sandbag.inRecovery = false;     // 攻撃硬直中フラグ（カウンターヒット判定用）
    sandbag.setUserData({ type: 'sandbag' });
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

// ============================================
// コンボ・ダメージ計算システム
// ============================================

// ステール補正の計算
function getStaleMultiplier(attackType) {
    const queue = state.staleQueue;
    let count = 0;

    for (const attack of queue) {
        if (attack === attackType) count++;
    }

    const penalty = count * CONFIG.combo.stale.penalty;
    return Math.max(CONFIG.combo.stale.minimum, 1 - penalty);
}

// ステールキューに追加
function addToStaleQueue(attackType) {
    state.staleQueue.push(attackType);
    if (state.staleQueue.length > CONFIG.combo.stale.queueSize) {
        state.staleQueue.shift();
    }
}

// コンボボーナスの計算（ダメージ増加！）
function getComboBonus() {
    const { perHit, maximum } = CONFIG.combo.bonus;
    const bonus = 1.0 + (state.combo - 1) * perHit;
    return Math.min(maximum, bonus);
}

// Rage補正の計算
function getRageMultiplier() {
    if (!CONFIG.rage.enabled) return 1.0;

    const { startDamage, maxDamage, maxMultiplier } = CONFIG.rage;
    const effectiveDamage = Math.max(0, state.playerDamage - startDamage);
    const ratio = Math.min(1, effectiveDamage / (maxDamage - startDamage));

    return 1 + (maxMultiplier - 1) * ratio;
}

// スマブラ式ノックバック計算
function calculateKnockback(attack, targetDamage, chargeMultiplier = 1.0) {
    // 基本パラメータ
    let baseKB = attack.baseKnockback;
    let growth = attack.knockbackGrowth;

    // チャージボーナス（スマッシュ用）
    if (attack.maxBaseKnockback) {
        baseKB = attack.baseKnockback + (attack.maxBaseKnockback - attack.baseKnockback) * chargeMultiplier;
        growth = attack.knockbackGrowth + (attack.maxKnockbackGrowth - attack.knockbackGrowth) * chargeMultiplier;
    }

    // スマブラ式ノックバック計算
    // KB = (((damage * growth / 10) + baseKB) * (200 / (weight + 100)))
    const weight = CONFIG.sandbag.weight;
    const damageComponent = (targetDamage * growth) / 10;
    const weightModifier = 200 / (weight + 100);

    let knockback = (damageComponent + baseKB) * weightModifier;

    // Rage補正
    knockback *= getRageMultiplier();

    // カウンターヒット補正
    if (state.lastCounterHit) {
        knockback *= CONFIG.combo.counterHit.knockbackMultiplier;
    }

    return knockback;
}

// Attack System
function startAttack(type) {
    if (!player.canAttack || state.phase !== 'playing' || state.launched) return;

    // 着地硬直中は攻撃不可
    if (player.landingLag > 0) return;

    // 実際の攻撃タイプを決定
    let actualType = determineAttackType(type);

    // キャンセル判定
    if (player.attacking) {
        const currentAttack = CONFIG.attacks[player.attackType];
        if (!currentAttack) return;

        // キャンセル可能な技かチェック
        const canCancel = currentAttack.cancelable.includes(actualType) ||
                          currentAttack.cancelable.includes(type) ||
                          type === 'jump';
        if (!canCancel) return;
        if (!player.cancelWindow && !player.lastAttackHit) return;
    }

    player.attacking = true;
    player.attackType = actualType;
    player.attackPhase = 'startup';
    player.attackTimer = 0;
    player.lastAttackHit = false;
    player.cancelWindow = false;

    // スマッシュ系はチャージ可能
    const chargeableTypes = ['smash', 'upSmash', 'downSmash', 'bat'];
    if (chargeableTypes.includes(actualType)) {
        player.charging = true;
        player.chargeAmount = 0;
        chargeBar.classList.remove('hidden');
    }
}

// 入力から実際の攻撃タイプを決定
function determineAttackType(type) {
    // 空中技
    if (!player.grounded) {
        switch (type) {
            case 'weak':
                // 方向入力で空中技を変える
                if (input.up) return 'uair';
                if (input.down) return 'dair';  // メテオ！
                if (input.left || input.right) {
                    // 向いている方向と入力が同じなら空前、逆なら空後
                    const inputDir = input.right ? 1 : -1;
                    const facingDir = player.facingRight ? 1 : -1;
                    return inputDir === facingDir ? 'fair' : 'bair';
                }
                return 'nair';  // ニュートラル

            case 'strong':
                if (input.up) return 'uair';
                if (input.down) return 'dair';  // メテオ！
                return 'fair';

            case 'smash':
                if (input.down) return 'dair';  // 空中下スマはメテオ
                return 'fair';  // 空中ではスマッシュ不可、空前に

            default:
                return type;
        }
    }

    // ダッシュ中の攻撃はダッシュ攻撃に
    const vel = playerBody ? playerBody.getLinearVelocity() : { x: 0 };
    const isRunning = Math.abs(vel.x) > 5;

    // 地上技
    switch (type) {
        case 'weak':
            // ダッシュ中はダッシュ攻撃
            if (isRunning) return 'dashAttack';
            // 弱攻撃は連打で派生
            if (player.attackType === 'weak' && player.cancelWindow) return 'weak2';
            if (player.attackType === 'weak2' && player.cancelWindow) return 'weak3';
            if (input.up) return 'upperStrong';
            if (input.down) return 'downStrong';
            return 'weak';

        case 'strong':
            if (isRunning) return 'dashAttack';
            if (input.up) return 'upperStrong';
            if (input.down) return 'downStrong';
            return 'strong';

        case 'smash':
            if (input.up) return 'upSmash';
            if (input.down) return 'downSmash';
            return 'smash';

        default:
            return type;
    }
}

function releaseSmash() {
    const chargeableTypes = ['smash', 'upSmash', 'downSmash', 'bat'];
    if (chargeableTypes.includes(player.attackType) && player.charging) {
        player.charging = false;
        player.attackTimer = 0;  // タイマーリセットしてstartupフェーズから開始
        player.attackPhase = 'startup';
        chargeBar.classList.add('hidden');
    }
}

function updateAttack(dt) {
    if (!player.attacking) return;

    // ヒットストップ中は時間が止まる
    if (state.hitstop > 0) return;

    const attack = CONFIG.attacks[player.attackType];
    if (!attack) return;

    // Charging（溜め攻撃：スマッシュ系とバット）
    // 溜め中は攻撃タイマーを進めない
    if (player.charging && attack.chargeTime) {
        player.chargeAmount = Math.min(1, player.chargeAmount + dt / attack.chargeTime);
        chargeFill.style.width = (player.chargeAmount * 100) + '%';
        return;  // 溜め中はここで止まる（キーを離すまで攻撃しない）
    }

    // 溜め中でない時のみ攻撃タイマーを進める
    player.attackTimer += dt;

    // Attack phases
    if (player.attackPhase === 'startup') {
        if (player.attackTimer >= attack.startup) {
            player.attackPhase = 'active';
            player.attackTimer = 0;
        }
    } else if (player.attackPhase === 'active') {
        checkAttackHit();

        if (player.attackTimer >= attack.active) {
            player.attackPhase = 'recovery';
            player.attackTimer = 0;
        }
    } else if (player.attackPhase === 'recovery') {
        // キャンセル猶予（ヒット時のみ）
        if (player.lastAttackHit && player.attackTimer < 0.2) {
            player.cancelWindow = true;
        } else {
            player.cancelWindow = false;
        }

        if (player.attackTimer >= attack.recovery) {
            endAttack();
        }
    }
}

function checkAttackHit() {
    if (!sandbag || player.lastAttackHit) return;

    const attack = CONFIG.attacks[player.attackType];
    if (!attack) return;

    const playerPos = playerBody.getPosition();
    const sandbagPos = sandbag.getPosition();
    const direction = player.facingRight ? 1 : -1;

    // ヒットボックスの位置を攻撃タイプに応じて計算
    let hitboxX = playerPos.x;
    let hitboxY = playerPos.y;
    const hitboxDir = attack.hitboxDir || 'forward';

    switch (hitboxDir) {
        case 'forward':
            hitboxX = playerPos.x + direction * (CONFIG.player.width / 2 + attack.range / 2);
            break;
        case 'back':
            hitboxX = playerPos.x - direction * (CONFIG.player.width / 2 + attack.range / 2);
            break;
        case 'up':
            hitboxY = playerPos.y + CONFIG.player.height / 2 + attack.range / 2;
            break;
        case 'down':
            hitboxY = playerPos.y - CONFIG.player.height / 2 - attack.range / 2;
            break;
        case 'around':
            // 周囲全体 - プレイヤー中心
            break;
    }

    const dx = sandbagPos.x - hitboxX;
    const dy = sandbagPos.y - hitboxY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // ヒット判定（サンドバッグの大きさも考慮）
    const hitRange = attack.range / 2 + Math.max(CONFIG.sandbag.width, CONFIG.sandbag.height) / 2;

    if (dist < hitRange) {
        // 後ろ攻撃の場合は方向を反転
        const hitDirection = hitboxDir === 'back' ? -direction : direction;
        applyHit(attack, hitDirection);
        player.lastAttackHit = true;
        player.cancelWindow = true;

        player.attackPhase = 'recovery';
        player.attackTimer = 0;
    }
}

function applyHit(attack, direction) {
    const now = performance.now();

    // ジャストフレーム判定（コンボ中の次のヒットまでのタイミング）
    let justFrameBonus = 1.0;
    state.lastJustFrame = false;
    if (state.combo > 0) {
        const timeSinceLastHit = (now - state.lastHitTime) / 1000;
        if (timeSinceLastHit <= CONFIG.combo.justFrame.window) {
            justFrameBonus = CONFIG.combo.justFrame.bonus;
            state.lastJustFrame = true;
        }
    }

    // カウンターヒット判定（相手がヒットストップ直後の硬直中）
    state.lastCounterHit = sandbag.inRecovery;
    let counterHitBonus = state.lastCounterHit ? CONFIG.combo.counterHit.damageMultiplier : 1.0;

    // ダメージ計算（溜め攻撃対応）
    let baseDamage = attack.damage;
    if (attack.maxDamage && player.chargeAmount > 0) {
        baseDamage = attack.damage + (attack.maxDamage - attack.damage) * player.chargeAmount;
    }

    // 各種補正を適用
    const staleMultiplier = getStaleMultiplier(player.attackType);
    const comboBonus = getComboBonus();

    const finalDamage = baseDamage * staleMultiplier * comboBonus * justFrameBonus * counterHitBonus;
    state.damage += finalDamage;
    state.totalDamageDealt += finalDamage;

    // ステールキューに追加
    addToStaleQueue(player.attackType);

    // コンボ更新
    if (now - state.lastHitTime < 1500) {
        state.combo++;
        state.comboTimer = 1.5;
    } else {
        state.combo = 1;
        state.comboTimer = 1.5;
        state.comboProration = 1.0;
    }
    state.lastHitTime = now;
    state.maxCombo = Math.max(state.maxCombo, state.combo);

    // ノックバック計算（溜め攻撃対応）
    const chargeMultiplier = attack.chargeTime ? player.chargeAmount : 0;
    const knockback = calculateKnockback(attack, state.damage, chargeMultiplier);

    // 角度の計算（度からラジアン）
    let angle = attack.angle * Math.PI / 180;

    // メテオスマッシュの処理
    if (attack.isMeteor) {
        // メテオは下向き
        angle = attack.angle * Math.PI / 180;
    }

    // 空中での攻撃は角度が変わる
    if (!player.grounded && !attack.isMeteor) {
        angle += 0.1; // やや上向きに
    }

    // ノックバックベクトル
    const kbX = Math.cos(angle) * knockback * direction;
    const kbY = Math.sin(angle) * knockback;

    // ヒットストップ
    let hitstopTime = attack.hitstop;
    if (state.lastCounterHit) {
        hitstopTime *= CONFIG.combo.counterHit.hitstunMultiplier;
    }
    state.hitstop = hitstopTime;

    // 速度をリセットしてインパルスを適用
    sandbag.setLinearVelocity(Vec2(0, 0));
    sandbag.applyLinearImpulse(Vec2(kbX, kbY), sandbag.getPosition());

    // ヒットストン（のけぞり時間）
    let hitstun = CONFIG.sandbag.hitstun + (state.damage / 100) * CONFIG.knockback.hitstunMultiplier;
    if (state.lastCounterHit) {
        hitstun *= CONFIG.combo.counterHit.hitstunMultiplier;
    }
    sandbag.hitstun = hitstun;

    // リカバリーフラグ（カウンターヒット判定用）
    setTimeout(() => {
        if (sandbag) sandbag.inRecovery = true;
        setTimeout(() => {
            if (sandbag) sandbag.inRecovery = false;
        }, 200);
    }, hitstopTime * 1000);

    // バット打ち上げ
    if (player.attackType === 'bat') {
        state.launched = true;
        state.phase = 'flying';
        distanceEl.classList.remove('hidden');

        // スローモーション演出
        state.slowMotion = 0.8;  // 0.8秒間スロー
        state.slowMotionScale = 0.2;  // 20%速度
    }

    // エフェクト
    createHitEffect(sandbag.getPosition(), knockback, state.lastJustFrame, state.lastCounterHit, player.attackType === 'bat');
    updateUI();
}

function endAttack() {
    const attack = CONFIG.attacks[player.attackType];

    // 着地硬直の設定（空中攻撃の場合）
    if (!player.grounded && attack) {
        player.landingLag = attack.landingLag;
    }

    player.attacking = false;
    player.attackType = null;
    player.attackPhase = null;
    player.attackTimer = 0;
    player.charging = false;
    player.chargeAmount = 0;
    player.cancelWindow = false;
    chargeBar.classList.add('hidden');

    setTimeout(() => { player.canAttack = true; }, 30);
}

// ============================================
// Hit Effects (Enhanced)
// ============================================
const hitEffects = [];

function createHitEffect(pos, knockback, isJustFrame, isCounterHit, isBatHit = false) {
    const effect = {
        x: pos.x,
        y: pos.y,
        life: isBatHit ? 1.0 : 0.4,
        maxLife: isBatHit ? 1.0 : 0.4,
        knockback: knockback,
        justFrame: isJustFrame,
        counterHit: isCounterHit,
        batHit: isBatHit
    };
    hitEffects.push(effect);
}

function createWallBounceEffect(pos, side) {
    hitEffects.push({
        x: side === 'left' ? 3 : 13.5,
        y: pos.y,
        life: 0.3,
        maxLife: 0.3,
        type: 'wallBounce'
    });
}

function createGroundBounceEffect(pos) {
    hitEffects.push({
        x: pos.x,
        y: 1.5,
        life: 0.25,
        maxLife: 0.25,
        type: 'groundBounce'
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

// Player Movement (Enhanced)
function updatePlayer(dt) {
    if (state.phase !== 'playing' || state.launched) {
        if (playerBody) {
            playerBody.setLinearVelocity(Vec2(0, 0));
        }
        return;
    }

    // ヒットストップ中は動かない
    if (state.hitstop > 0) return;

    const vel = playerBody.getLinearVelocity();
    const pos = playerBody.getPosition();

    // 着地判定
    const wasGrounded = player.grounded;
    player.grounded = pos.y < 3.5 && vel.y <= 0.1;

    // 着地時の処理
    if (player.grounded && !wasGrounded) {
        player.jumpsLeft = CONFIG.player.maxJumps;
        player.canAirDash = true;

        // 着地硬直
        if (player.attacking) {
            const attack = CONFIG.attacks[player.attackType];
            player.landingLag = attack.landingLag;
            endAttack();
        }
    }

    // 着地硬直の更新
    if (player.landingLag > 0) {
        player.landingLag -= dt;
        playerBody.setLinearVelocity(Vec2(0, vel.y));
        return;
    }

    // 空中ダッシュ
    if (input.airDashPressed && !player.grounded && player.canAirDash && !player.attacking) {
        player.airDashing = true;
        player.airDashTimer = CONFIG.player.airDashDuration;
        player.canAirDash = false;
        input.airDashPressed = false;
    }

    if (player.airDashing) {
        player.airDashTimer -= dt;
        const dashDir = player.facingRight ? 1 : -1;
        playerBody.setLinearVelocity(Vec2(CONFIG.player.airDashSpeed * dashDir, 0));

        if (player.airDashTimer <= 0) {
            player.airDashing = false;
        }
        return;
    }

    // 通常移動
    const speedMult = player.attacking ? 0.3 : 1;
    let targetVelX = 0;

    if (input.left) {
        targetVelX = -CONFIG.player.speed * speedMult;
        if (!player.attacking) player.facingRight = false;
    }
    if (input.right) {
        targetVelX = CONFIG.player.speed * speedMult;
        if (!player.attacking) player.facingRight = true;
    }

    playerBody.setLinearVelocity(Vec2(targetVelX, vel.y));

    // ジャンプ（キャンセル対応）
    if (input.jumpPressed) {
        const canJumpCancel = player.attacking && player.cancelWindow &&
            CONFIG.attacks[player.attackType]?.cancelable.includes('jump');

        if ((player.jumpsLeft > 0 && !player.attacking) || canJumpCancel) {
            if (canJumpCancel) {
                endAttack();
            }
            playerBody.setLinearVelocity(Vec2(vel.x, CONFIG.player.jumpForce));
            player.jumpsLeft--;
            input.jumpPressed = false;
        }
    }

    // 境界
    if (pos.x < 3) playerBody.setPosition(Vec2(3, pos.y));
    if (pos.x > 13) playerBody.setPosition(Vec2(13, pos.y));
}

// Sandbag Update (Enhanced)
function updateSandbag(dt) {
    if (!sandbag) return;

    // ヒットストップ中は停止
    if (state.hitstop > 0) return;

    // ヒットストンの更新
    if (sandbag.hitstun > 0) {
        sandbag.hitstun -= dt;
    }

    if (state.phase === 'playing') {
        const pos = sandbag.getPosition();
        const vel = sandbag.getLinearVelocity();
        const speed = vel.length();

        // バリアが有効かどうか（残り1秒以上）
        const barrierActive = state.timer > 1.0;

        // ヒットストン中でない時のみ減速
        if (sandbag.hitstun <= 0 && pos.y < 3.5) {
            sandbag.setLinearVelocity(Vec2(vel.x * 0.99, vel.y));
        }

        if (barrierActive) {
            // バリア有効時：壁バウンド
            // 壁バウンド（左）
            if (pos.x < 3) {
                if (speed > CONFIG.knockback.wallBounceThreshold) {
                    const bounceDamage = Math.floor(speed * 0.1);
                    state.damage += bounceDamage;
                    createWallBounceEffect(pos, 'left');
                }
                const decay = CONFIG.knockback.bounceDecay;
                sandbag.setLinearVelocity(Vec2(Math.abs(vel.x) * decay + 3, vel.y * decay * 0.9));
            }
            // 壁バウンド（右）
            if (pos.x > 13) {
                if (speed > CONFIG.knockback.wallBounceThreshold) {
                    const bounceDamage = Math.floor(speed * 0.1);
                    state.damage += bounceDamage;
                    createWallBounceEffect(pos, 'right');
                }
                const decay = CONFIG.knockback.bounceDecay;
                sandbag.setLinearVelocity(Vec2(-Math.abs(vel.x) * decay - 3, vel.y * decay * 0.9));
            }
        } else {
            // バリア解除時：外に出たらflyingフェーズへ
            if (pos.x < 2 || pos.x > 14) {
                state.launched = true;
                state.phase = 'flying';
                distanceEl.classList.remove('hidden');
            }
        }

        // 地面バウンド
        if (pos.y < 3.5 && vel.y < -15 && !sandbag.lastGroundBounce) {
            const bounceDamage = Math.floor(Math.abs(vel.y) * 0.05);
            state.damage += bounceDamage;
            createGroundBounceEffect(pos);
            sandbag.lastGroundBounce = true;
        }
        if (pos.y > 4) {
            sandbag.lastGroundBounce = false;
        }
    }

    // 飛行フェーズ
    if (state.phase === 'flying') {
        const pos = sandbag.getPosition();
        state.distance = Math.max(0, pos.x - sandbag.startX);
        state.maxDistance = Math.max(state.maxDistance, state.distance);

        const vel = sandbag.getLinearVelocity();

        // 終了条件:
        // 1. 速度が十分小さく地面近く
        // 2. 画面外に落下
        // 3. 飛行時間が15秒を超えた（タイムアウト）
        const stopped = vel.length() < 0.5 && pos.y < 3;
        const fellOff = pos.y < -10;
        const timeout = (state.flyingTime || 0) > 15;

        if (stopped || fellOff || timeout) {
            showResult();
        }
    }
}

// Hitstop Update
function updateHitstop(dt) {
    if (state.hitstop > 0) {
        state.hitstop -= dt;
        if (state.hitstop < 0) state.hitstop = 0;
    }
}

// Coordinate Conversion
function toCanvas(x, y) {
    return {
        x: x * CONFIG.physics.scale,
        y: CONFIG.canvas.height - y * CONFIG.physics.scale
    };
}

// ============================================
// Drawing (Enhanced)
// ============================================
function draw() {
    ctx.clearRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);

    let cameraX = 0;
    if (state.phase === 'flying' && sandbag) {
        cameraX = Math.max(0, (sandbag.getPosition().x - 10) * CONFIG.physics.scale);
    }

    ctx.save();
    ctx.translate(-cameraX, 0);

    // ヒットストップ中は画面を少し揺らす
    if (state.hitstop > 0) {
        const shake = (Math.random() - 0.5) * 8;
        ctx.translate(shake, shake);
    }

    drawBackground(cameraX);
    drawDistanceMarkers(cameraX);
    drawPlatform();
    drawBarrier();
    drawSandbag();
    drawPlayer();
    drawAttackHitbox();
    drawHitEffects();

    ctx.restore();

    // UI要素
    drawComboInfo();
    drawRageIndicator();
}

function drawBackground(cameraX) {
    const gradient = ctx.createLinearGradient(0, 0, 0, CONFIG.canvas.height);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(0.7, '#E0F7FA');
    gradient.addColorStop(1, '#90EE90');
    ctx.fillStyle = gradient;
    ctx.fillRect(cameraX, 0, CONFIG.canvas.width, CONFIG.canvas.height);

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
        const y = CONFIG.canvas.height - CONFIG.physics.scale - 60;

        ctx.strokeStyle = m % 10 === 0 ? '#333' : '#888';
        ctx.lineWidth = m % 10 === 0 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(x, y + 40);
        ctx.lineTo(x, y + 55);
        ctx.stroke();

        if (m % 10 === 0) {
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

function drawBarrier() {
    if (state.phase !== 'playing') return;

    const barrierActive = state.timer > 1.0;

    // 左バリア
    const leftX = toCanvas(3, 0).x;
    // 右バリア
    const rightX = toCanvas(13, 0).x;
    const groundY = CONFIG.canvas.height - CONFIG.physics.scale;
    const barrierHeight = 400;

    // 残り2秒以下で警告開始
    if (state.timer <= 2.0 && state.timer > 1.0) {
        const flash = Math.floor(Date.now() / 200) % 2 === 0;
        if (flash) {
            ctx.fillStyle = 'rgba(255, 200, 0, 0.2)';
            ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
        }
    }

    if (barrierActive) {
        // バリア有効：青い半透明の壁
        const alpha = state.timer <= 2.0 ? 0.3 + Math.sin(Date.now() / 100) * 0.2 : 0.3;
        ctx.fillStyle = `rgba(100, 150, 255, ${alpha})`;
        ctx.fillRect(leftX - 5, groundY - barrierHeight, 10, barrierHeight);
        ctx.fillRect(rightX - 5, groundY - barrierHeight, 10, barrierHeight);

        // バリアの枠線
        ctx.strokeStyle = 'rgba(100, 150, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(leftX - 5, groundY - barrierHeight, 10, barrierHeight);
        ctx.strokeRect(rightX - 5, groundY - barrierHeight, 10, barrierHeight);
    } else {
        // バリア解除：画面全体が赤く点滅
        const flash = Math.floor(Date.now() / 100) % 2 === 0;
        if (flash) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
            ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
        }

        // 大きな警告テキスト
        ctx.fillStyle = flash ? '#FF0000' : '#FF6600';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('BARRIER OFF!', CONFIG.canvas.width / 2, 80);

        // 壊れたバリアの残骸（点線）
        ctx.setLineDash([10, 10]);
        ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(leftX, groundY - barrierHeight);
        ctx.lineTo(leftX, groundY);
        ctx.moveTo(rightX, groundY - barrierHeight);
        ctx.lineTo(rightX, groundY);
        ctx.stroke();
        ctx.setLineDash([]);
    }
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

    // ヒットストップ中のフラッシュ
    if (state.hitstop > 0) {
        ctx.filter = 'brightness(2) saturate(0.5)';
    } else if (sandbag.hitstun > 0 && Math.floor(sandbag.hitstun * 20) % 2 === 0) {
        ctx.filter = 'brightness(1.5)';
    }

    if (sandbagImage) {
        ctx.drawImage(sandbagImage, -w/2, -h/2, w, h);
    } else {
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

    // ダメージ表示
    const damageColor = state.damage > 100 ? '#FF0000' : state.damage > 50 ? '#FF6600' : '#FFCC00';
    ctx.fillStyle = damageColor;
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.floor(state.damage)}%`, canvasPos.x, canvasPos.y - h/2 - 20);
}

function drawPlayer() {
    if (!playerBody) return;

    const pos = playerBody.getPosition();
    const canvasPos = toCanvas(pos.x, pos.y);
    const w = CONFIG.player.width * CONFIG.physics.scale;
    const h = CONFIG.player.height * CONFIG.physics.scale;

    ctx.save();
    ctx.translate(canvasPos.x, canvasPos.y);

    // バット溜め中は震える
    if (player.charging && player.attackType === 'bat') {
        const shake = (Math.random() - 0.5) * player.chargeAmount * 6;
        ctx.translate(shake, shake * 0.5);
    }

    if (!player.facingRight) ctx.scale(-1, 1);

    // 着地硬直中は色を変える
    let bodyColor = '#4A90D9';
    if (player.charging && player.attackType === 'bat') {
        // バット溜め中は光る
        const glow = Math.floor(player.chargeAmount * 255);
        bodyColor = `rgb(${100 + glow}, ${50 + glow/2}, ${50})`;
    } else if (player.attacking) {
        bodyColor = player.attackPhase === 'active' ? '#FF3333' : '#FF6B6B';
    } else if (player.landingLag > 0) {
        bodyColor = '#666699';
    } else if (player.airDashing) {
        bodyColor = '#33CCFF';
    }

    ctx.fillStyle = bodyColor;
    ctx.fillRect(-w/2, -h/2, w, h);

    // バット溜め中のオーラエフェクト
    if (player.charging && player.attackType === 'bat') {
        const alpha = player.chargeAmount * 0.5;
        const size = 30 + player.chargeAmount * 20;
        ctx.strokeStyle = `rgba(255, 200, 50, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.stroke();
    }

    // 頭
    ctx.fillStyle = '#FFCC99';
    ctx.beginPath();
    ctx.arc(0, -h/2 - 12, 12, 0, Math.PI * 2);
    ctx.fill();

    // 攻撃中の腕
    if (player.attacking && player.attackPhase === 'active') {
        ctx.fillStyle = '#FFCC99';
        const attack = CONFIG.attacks[player.attackType];
        const armLength = attack.range * CONFIG.physics.scale * 0.5;

        if (player.attackType === 'upperStrong' || player.attackType === 'meteor') {
            // 上方向/下方向の攻撃
            const yDir = player.attackType === 'meteor' ? 1 : -1;
            ctx.fillRect(-5, -h/2, 10, armLength * yDir);
        } else {
            ctx.fillRect(w/2 - 5, -5, armLength, 10);
        }

        // バット
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

    // 空中ダッシュエフェクト
    if (player.airDashing) {
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.5)';
        ctx.lineWidth = 3;
        for (let i = 1; i <= 3; i++) {
            const offsetX = player.facingRight ? -i * 15 : i * 15;
            ctx.beginPath();
            ctx.arc(canvasPos.x + offsetX, canvasPos.y, w/2 + 5, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

function drawAttackHitbox() {
    if (!player.attacking || player.attackPhase !== 'active') return;

    const attack = CONFIG.attacks[player.attackType];
    if (!attack) return;

    const pos = playerBody.getPosition();
    const direction = player.facingRight ? 1 : -1;
    const hitboxDir = attack.hitboxDir || 'forward';

    let hitboxX = pos.x;
    let hitboxY = pos.y;

    switch (hitboxDir) {
        case 'forward':
            hitboxX = pos.x + direction * (CONFIG.player.width / 2 + attack.range / 2);
            break;
        case 'back':
            hitboxX = pos.x - direction * (CONFIG.player.width / 2 + attack.range / 2);
            break;
        case 'up':
            hitboxY = pos.y + CONFIG.player.height / 2 + attack.range / 2;
            break;
        case 'down':
            hitboxY = pos.y - CONFIG.player.height / 2 - attack.range / 2;
            break;
        case 'around':
            // プレイヤー中心
            break;
    }

    const canvasPos = toCanvas(hitboxX, hitboxY);

    // 攻撃タイプで色を変える
    let color = 'rgba(255, 0, 0, 0.6)';
    if (attack.isMeteor) color = 'rgba(255, 100, 0, 0.8)';
    else if (hitboxDir === 'up') color = 'rgba(0, 200, 255, 0.6)';
    else if (hitboxDir === 'around') color = 'rgba(255, 255, 0, 0.5)';

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(canvasPos.x, canvasPos.y, attack.range / 2 * CONFIG.physics.scale, 0, Math.PI * 2);
    ctx.stroke();
}

function drawHitEffects() {
    for (const effect of hitEffects) {
        const pos = toCanvas(effect.x, effect.y);
        const progress = 1 - effect.life / effect.maxLife;

        if (effect.type === 'wallBounce') {
            // 壁バウンスエフェクト
            ctx.strokeStyle = `rgba(255, 100, 100, ${1 - progress})`;
            ctx.lineWidth = 5;
            const size = 40 + progress * 60;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
            ctx.stroke();
        } else if (effect.type === 'groundBounce') {
            // 地面バウンスエフェクト
            ctx.strokeStyle = `rgba(200, 150, 50, ${1 - progress})`;
            ctx.lineWidth = 4;
            const width = 60 + progress * 80;
            ctx.beginPath();
            ctx.ellipse(pos.x, pos.y, width, 20, 0, 0, Math.PI * 2);
            ctx.stroke();
        } else if (effect.batHit) {
            // バットヒット専用エフェクト（大きく派手に）
            const size = 50 + progress * 150;
            const alpha = 1 - progress * 0.8;

            // 複数の円で爆発感を演出
            for (let ring = 0; ring < 3; ring++) {
                const ringSize = size * (0.6 + ring * 0.3);
                const ringAlpha = alpha * (1 - ring * 0.3);
                ctx.strokeStyle = `rgba(255, ${150 - ring * 50}, 0, ${ringAlpha})`;
                ctx.lineWidth = 8 - ring * 2;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, ringSize, 0, Math.PI * 2);
                ctx.stroke();
            }

            // 放射状のライン（多め）
            ctx.strokeStyle = `rgba(255, 255, 100, ${alpha})`;
            ctx.lineWidth = 4;
            for (let i = 0; i < 16; i++) {
                const angle = (i / 16) * Math.PI * 2;
                const inner = size * 0.3;
                const outer = size * (1.2 + progress * 0.5);
                ctx.beginPath();
                ctx.moveTo(pos.x + Math.cos(angle) * inner, pos.y + Math.sin(angle) * inner);
                ctx.lineTo(pos.x + Math.cos(angle) * outer, pos.y + Math.sin(angle) * outer);
                ctx.stroke();
            }

            // HOME RUN!! テキスト
            if (effect.life > 0.5) {
                ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
                ctx.font = 'bold 48px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('HOME RUN!!', pos.x, pos.y - size - 20);
            }
        } else {
            // 通常のヒットエフェクト
            const size = 30 + progress * 50 + (effect.knockback || 20) * 0.3;
            const alpha = 1 - progress;

            // ジャストフレーム/カウンターヒットで色が変わる
            let color = '255, 200, 0';
            if (effect.justFrame) {
                color = '0, 255, 255';
            }
            if (effect.counterHit) {
                color = '255, 50, 50';
            }

            ctx.strokeStyle = `rgba(${color}, ${alpha})`;
            ctx.lineWidth = effect.counterHit ? 6 : 4;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
            ctx.stroke();

            // インパクトライン
            const lineCount = effect.counterHit ? 12 : 8;
            for (let i = 0; i < lineCount; i++) {
                const angle = (i / lineCount) * Math.PI * 2;
                const inner = size * 0.5;
                const outer = size * (1 + progress * 0.5);
                ctx.beginPath();
                ctx.moveTo(pos.x + Math.cos(angle) * inner, pos.y + Math.sin(angle) * inner);
                ctx.lineTo(pos.x + Math.cos(angle) * outer, pos.y + Math.sin(angle) * outer);
                ctx.stroke();
            }

            // テキスト表示
            if (effect.justFrame && effect.life > 0.25) {
                ctx.fillStyle = '#00FFFF';
                ctx.font = 'bold 20px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('JUST!', pos.x, pos.y - size - 10);
            }
            if (effect.counterHit && effect.life > 0.25) {
                ctx.fillStyle = '#FF3333';
                ctx.font = 'bold 24px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('COUNTER!', pos.x, pos.y - size - 30);
            }
        }
    }
}

function drawComboInfo() {
    if (state.combo <= 1 || state.comboTimer <= 0) return;

    const x = 80;
    const y = 150;

    // コンボ数
    ctx.fillStyle = state.combo >= 5 ? '#FF3333' : state.combo >= 3 ? '#FFAA00' : '#FFFFFF';
    ctx.font = `bold ${40 + state.combo * 2}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(`${state.combo}`, x, y);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('COMBO', x, y + 25);

    // コンボボーナス表示
    const bonus = Math.floor(getComboBonus() * 100);
    ctx.fillStyle = bonus > 130 ? '#00FF00' : bonus > 110 ? '#FFFF00' : '#AAAAAA';
    ctx.font = '14px Arial';
    ctx.fillText(`DMG: ${bonus}%`, x, y + 45);
}

function drawRageIndicator() {
    if (!CONFIG.rage.enabled || state.playerDamage <= 0) return;

    const rageMultiplier = getRageMultiplier();
    if (rageMultiplier <= 1.01) return;

    const x = CONFIG.canvas.width - 100;
    const y = 80;

    // Rageバー
    const ragePercent = (rageMultiplier - 1) / (CONFIG.rage.maxMultiplier - 1);
    ctx.fillStyle = '#333';
    ctx.fillRect(x - 40, y, 80, 10);
    ctx.fillStyle = `rgb(255, ${Math.floor(100 - ragePercent * 100)}, 0)`;
    ctx.fillRect(x - 40, y, 80 * ragePercent, 10);

    ctx.fillStyle = '#FF6600';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('RAGE', x, y - 5);
    ctx.fillText(`x${rageMultiplier.toFixed(2)}`, x, y + 25);
}

// UI Update
function updateUI() {
    timerEl.textContent = `Time: ${state.timer.toFixed(1)}`;
    damageEl.textContent = `${Math.floor(state.damage)}%`;

    // 残り時間による警告表示
    if (state.timer <= 1.0 && state.phase === 'playing') {
        timerEl.style.color = '#FF0000';
        timerEl.style.fontSize = '32px';
        timerEl.style.animation = 'pulse 0.2s infinite';
    } else if (state.timer <= 3.0 && state.phase === 'playing') {
        timerEl.style.color = '#FF6600';
        timerEl.style.fontSize = '28px';
        timerEl.style.animation = '';
    } else {
        timerEl.style.color = '#ff6b6b';
        timerEl.style.fontSize = '24px';
        timerEl.style.animation = '';
    }

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
    const realDt = Math.min((currentTime - lastTime) / 1000, 0.05);
    lastTime = currentTime;

    // スローモーション処理（表示用のdtをスケール）
    let displayDt = realDt;
    if (state.slowMotion > 0) {
        state.slowMotion -= realDt;
        displayDt = realDt * state.slowMotionScale;
        if (state.slowMotion <= 0) {
            state.slowMotion = 0;
            state.slowMotionScale = 1;
        }
    }

    if (state.phase === 'playing') {
        state.timer -= realDt;  // タイマーは実時間で
        state.comboTimer -= realDt;

        if (state.timer <= 0) {
            state.timer = 0;
            if (!state.launched) {
                // 時間切れ：現在の状態のままflyingフェーズへ
                state.launched = true;
                state.phase = 'flying';
                state.flyingTime = 0;  // 飛行時間カウント開始
                distanceEl.classList.remove('hidden');
            }
        }
    }

    // 飛行時間のカウント（タイムアウト用）
    if (state.phase === 'flying') {
        state.flyingTime = (state.flyingTime || 0) + realDt;
    }

    // ヒットストップの更新
    updateHitstop(displayDt);

    if (state.phase === 'playing' || state.phase === 'flying') {
        // ヒットストップ中は物理シミュレーションを停止
        if (state.hitstop <= 0) {
            world.step(1/60, displayDt, 3);
        }

        updatePlayer(displayDt);
        updateAttack(displayDt);
        updateSandbag(displayDt);
        updateHitEffects(displayDt);
    }

    draw();
    updateUI();
    requestAnimationFrame(gameLoop);
}

// Result Screen
function showResult() {
    state.phase = 'result';
    resultScreen.classList.remove('hidden');

    const distance = state.maxDistance;
    finalDistanceEl.textContent = `${distance.toFixed(2)}m`;
    maxComboEl.textContent = `Max Combo: ${state.maxCombo}`;

    // ランキングに保存
    const rank = saveToRanking(distance, state.damage, state.maxCombo);

    // ベストスコア処理
    const bestScore = parseFloat(localStorage.getItem('homurun_best') || '0');
    const isNewRecord = distance > bestScore;

    if (isNewRecord && distance > 0) {
        localStorage.setItem('homurun_best', distance.toFixed(2));
    }

    // ベストスコア表示
    const bestEl = document.getElementById('best-score');
    if (bestEl) {
        const displayBest = isNewRecord ? distance : bestScore;
        bestEl.textContent = `Best: ${displayBest.toFixed(2)}m`;
        bestEl.style.color = isNewRecord ? '#FFD700' : '#888';
    }

    // 新記録表示
    const recordEl = document.getElementById('new-record');
    if (recordEl) {
        recordEl.style.display = isNewRecord && distance > 0 ? 'block' : 'none';
    }

    // 距離に応じた評価
    const ratingEl = document.getElementById('rating');
    if (ratingEl) {
        let rating = '';
        let color = '#fff';
        if (distance >= 1000) { rating = 'LEGENDARY!!'; color = '#FF00FF'; }
        else if (distance >= 500) { rating = 'AMAZING!'; color = '#FFD700'; }
        else if (distance >= 200) { rating = 'GREAT!'; color = '#00FF00'; }
        else if (distance >= 100) { rating = 'NICE!'; color = '#00BFFF'; }
        else if (distance >= 50) { rating = 'GOOD'; color = '#FFFFFF'; }
        else { rating = ''; }
        ratingEl.textContent = rating;
        ratingEl.style.color = color;
    }
}

// ============================================
// Ranking System
// ============================================
function saveToRanking(distance, damage, maxCombo) {
    if (distance <= 0) return;

    // ランキングを読み込み
    const rankings = JSON.parse(localStorage.getItem('homurun_rankings') || '[]');

    // 新しい記録を追加
    const record = {
        distance: parseFloat(distance.toFixed(2)),
        damage: Math.floor(damage),
        maxCombo: maxCombo,
        date: new Date().toISOString()
    };
    rankings.push(record);

    // 距離で降順ソートしてTop 10のみ保持
    rankings.sort((a, b) => b.distance - a.distance);
    const top10 = rankings.slice(0, 10);

    localStorage.setItem('homurun_rankings', JSON.stringify(top10));

    // 今回の記録が何位かを返す
    const rank = top10.findIndex(r => r.date === record.date);
    return rank >= 0 ? rank + 1 : -1;
}

function showRanking() {
    const rankings = JSON.parse(localStorage.getItem('homurun_rankings') || '[]');

    rankingList.innerHTML = '';

    if (rankings.length === 0) {
        rankingList.innerHTML = '<div class="no-records">記録がありません</div>';
    } else {
        rankings.forEach((record, index) => {
            const item = document.createElement('div');
            item.className = 'ranking-item';
            if (index === 0) item.classList.add('gold');
            else if (index === 1) item.classList.add('silver');
            else if (index === 2) item.classList.add('bronze');

            const date = new Date(record.date);
            const dateStr = `${date.getFullYear()}/${(date.getMonth()+1).toString().padStart(2,'0')}/${date.getDate().toString().padStart(2,'0')}`;

            item.innerHTML = `
                <div class="rank-number">${index + 1}</div>
                <div class="rank-info">
                    <div class="rank-distance">${record.distance.toFixed(2)}m</div>
                    <div class="rank-details">${record.damage}% | ${record.maxCombo} Combo</div>
                </div>
                <div class="rank-date">${dateStr}</div>
            `;
            rankingList.appendChild(item);
        });
    }

    rankingScreen.classList.remove('hidden');
}

function hideRanking() {
    rankingScreen.classList.add('hidden');
}

// Start/Reset
function startGame() {
    state.phase = 'playing';
    state.timer = CONFIG.game.timeLimit;
    state.damage = 0;
    state.playerDamage = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.comboTimer = 0;
    state.distance = 0;
    state.maxDistance = 0;
    state.launched = false;
    state.hitstop = 0;
    state.slowMotion = 0;
    state.slowMotionScale = 1;
    state.flyingTime = 0;
    state.staleQueue = [];
    state.lastJustFrame = false;
    state.lastCounterHit = false;
    state.totalDamageDealt = 0;
    state.comboProration = 1.0;

    player.attacking = false;
    player.canAttack = true;
    player.charging = false;
    player.chargeAmount = 0;
    player.airDashing = false;
    player.canAirDash = true;
    player.landingLag = 0;
    player.cancelWindow = false;

    startScreen.classList.add('hidden');
    resultScreen.classList.add('hidden');
    distanceEl.classList.add('hidden');
    chargeBar.classList.add('hidden');

    if (sandbag) world.destroyBody(sandbag);
    if (playerBody) world.destroyBody(playerBody);
    createSandbag(8, 5);
    createPlayer(5, 5);

    updateUI();
}

function resetGame() {
    // RETRYは直接ゲームを再開
    rankingScreen.classList.add('hidden');
    startGame();
}

// Input Handling (Enhanced)
document.addEventListener('keydown', (e) => {
    if (e.repeat) return;

    switch (e.code) {
        case 'KeyA': case 'ArrowLeft':
            input.left = true;
            break;
        case 'KeyD': case 'ArrowRight':
            input.right = true;
            break;
        case 'KeyW': case 'ArrowUp':
            input.up = true;
            break;
        case 'KeyS': case 'ArrowDown':
            input.down = true;
            break;
        case 'Space':
            e.preventDefault();
            input.jump = true;
            input.jumpPressed = true;
            break;
        case 'KeyJ':
            input.weak = true;
            input.weakPressed = true;
            startAttack('weak');
            break;
        case 'KeyK':
            input.strong = true;
            input.strongPressed = true;
            startAttack('strong');
            break;
        case 'KeyL':
            startAttack('smash');
            break;
        case 'KeyB':
            startAttack('bat');
            break;
        case 'ShiftLeft': case 'ShiftRight':
            input.airDash = true;
            input.airDashPressed = true;
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
        case 'KeyW': case 'ArrowUp': input.up = false; break;
        case 'KeyS': case 'ArrowDown': input.down = false; break;
        case 'Space': input.jump = false; break;
        case 'KeyJ': input.weak = false; break;
        case 'KeyK': input.strong = false; break;
        case 'KeyL': releaseSmash(); break;
        case 'KeyB': releaseSmash(); break;  // バットも溜め攻撃
        case 'ShiftLeft': case 'ShiftRight': input.airDash = false; break;
    }
});

// Buttons
startBtn.addEventListener('click', startGame);
retryBtn.addEventListener('click', resetGame);
rankingBtn.addEventListener('click', showRanking);
closeRankingBtn.addEventListener('click', hideRanking);

// Initialize
function init() {
    loadImages();
    initPhysics();
    requestAnimationFrame(gameLoop);
}

init();
