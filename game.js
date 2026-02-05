// ============================================
// Homurun Contest - Pro Fighting Game Style
// ============================================

// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAaeP21JhnsmcP9TfmiwodaTwF7sIzxfPI",
  authDomain: "homurun-game.firebaseapp.com",
  projectId: "homurun-game",
  storageBucket: "homurun-game.firebasestorage.app",
  messagingSenderId: "629050620178",
  appId: "1:629050620178:web:2e582c40f4b5889afb9bcb",
  measurementId: "G-SGKKNSPQ4R"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

// Anonymous auth
let currentUserId = null;
signInAnonymously(auth).then((userCredential) => {
  currentUserId = userCredential.user.uid;
  console.log("Firebase Auth: Anonymous user signed in");
}).catch((error) => {
  console.error("Firebase Auth error:", error);
});

const { World, Vec2, Box, Circle, Edge } = planck;

// Game Configuration
const CONFIG = {
  canvas: { width: 1000, height: 600 },
  physics: { scale: 30, gravity: -50 },  // 重力強化（素早く落下）
  game: { timeLimit: 13 },  // 13秒

  player: {
    width: 0.8,
    height: 1.5,
    speed: 8,
    runSpeed: 12,           // ダッシュ速度
    jumpForce: 20,
    shortHopForce: 12,      // ショートホップ
    maxJumps: 2,
    airSpeed: 6,            // 空中横移動速度
    airDashSpeed: 15,
    airDashDuration: 0.12,
    pivotWindow: 0.1        // ピボット入力猶予
  },

  sandbag: {
    width: 2.7,   // tubouchi.png: 150x200 (アスペクト比 0.75)
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
    bonus: {
      perHit: 0.08,
      maximum: 1.8
    },
    stale: {
      queueSize: 6,
      penalty: 0.08,
      minimum: 0.4
    },
    justFrame: {
      window: 0.08,
      bonus: 1.3
    },
    counterHit: {
      damageMultiplier: 1.5,
      knockbackMultiplier: 1.3,
      hitstunMultiplier: 1.5
    }
  },

  // スイートスポット/サワースポット
  sweetspot: {
    threshold: 0.7,         // 範囲の70%以上でスイートスポット
    damageMultiplier: 1.2,
    knockbackMultiplier: 1.15,
    sourDamageMultiplier: 0.7,
    sourKnockbackMultiplier: 0.6
  },

  // 角度調整（攻撃時の方向入力）
  angleInfluence: {
    up: 8,                  // 上入力で+8度
    down: -8                // 下入力で-8度
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
    // 弱攻撃1 - 発生が早い、コンボ始動
    weak: {
      damage: 2.5,
      baseKnockback: 15,
      knockbackGrowth: 25,    // コンボ継続性維持
      angle: 70,              // やや上に飛ばしてコンボ継続
      startup: 0.033,         // 2F
      active: 0.05,           // 3F
      recovery: 0.083,        // 5F (全体13F)
      range: 1.0,
      hitstop: 0.033,
      cancelable: ['weak2', 'strong', 'upperStrong', 'downStrong', 'jump'],
      landingLag: 0.067,
      hitboxDir: 'forward',
      canAngle: false
    },
    // 弱攻撃2段目
    weak2: {
      damage: 2.5,
      baseKnockback: 18,
      knockbackGrowth: 30,    // コンボ継続性維持
      angle: 72,
      startup: 0.033,
      active: 0.05,
      recovery: 0.1,
      range: 1.1,
      hitstop: 0.033,
      cancelable: ['weak3', 'strong', 'upperStrong', 'jump'],
      landingLag: 0.067,
      hitboxDir: 'forward',
      canAngle: false
    },
    // 弱攻撃3段目（フィニッシュブロー）
    weak3: {
      damage: 4,
      baseKnockback: 35,
      knockbackGrowth: 55,
      angle: 50,              // 斜め上に飛ばす
      startup: 0.067,         // 4F
      active: 0.067,
      recovery: 0.2,          // 後隙大きめ
      range: 1.4,
      hitstop: 0.067,
      cancelable: [],
      landingLag: 0.1,
      hitboxDir: 'forward',
      hasSweetspot: true,     // 先端が強い
      canAngle: true
    },
    // 横強攻撃 - 角度調整可能、リーチ長め
    strong: {
      damage: 8,
      baseKnockback: 30,
      knockbackGrowth: 65,
      angle: 35,              // 横に飛ばす
      startup: 0.083,         // 5F
      active: 0.083,
      recovery: 0.167,        // 後隙10F
      range: 2.0,
      hitstop: 0.067,
      cancelable: ['jump'],
      landingLag: 0.1,
      hitboxDir: 'forward',
      hasSweetspot: true,
      canAngle: true          // 上下で角度変更可能
    },
    // 上強 - ジャグリング用、お手玉の起点
    upperStrong: {
      damage: 7,
      baseKnockback: 32,
      knockbackGrowth: 70,
      angle: 88,              // ほぼ真上
      startup: 0.067,         // 4F
      active: 0.1,
      recovery: 0.183,        // 後隙11F
      range: 1.8,
      hitstop: 0.067,
      cancelable: ['jump'],
      landingLag: 0.083,
      hitboxDir: 'up',
      hasSweetspot: false,
      canAngle: false
    },
    // 下強 - 低姿勢、低角度で飛ばす
    downStrong: {
      damage: 6,
      baseKnockback: 25,
      knockbackGrowth: 55,
      angle: 20,              // 低角度（テクニカル）
      startup: 0.05,          // 3F 発生早い
      active: 0.1,
      recovery: 0.133,
      range: 1.8,
      hitstop: 0.05,
      cancelable: ['strong', 'upperStrong', 'dashAttack', 'jump'],
      landingLag: 0.083,
      hitboxDir: 'forward',
      hasSweetspot: true,
      canAngle: false,
      sendAwayOnSourspot: true  // 根本当てで自分から離す
    },
    // 横スマッシュ - メインフィニッシャー、後隙大
    smash: {
      damage: 14,
      maxDamage: 22,
      baseKnockback: 30,
      maxBaseKnockback: 45,
      knockbackGrowth: 90,
      maxKnockbackGrowth: 110,
      angle: 40,
      startup: 0.183,         // 11F 発生遅め
      active: 0.067,          // 4F
      recovery: 0.35,         // 後隙21F かなり大きい
      range: 2.2,
      hitstop: 0.133,
      chargeTime: 1.0,
      cancelable: [],
      landingLag: 0.25,
      hitboxDir: 'forward',
      hasSweetspot: true,
      canAngle: true
    },
    // 上スマッシュ - 対空、コンボフィニッシュ
    upSmash: {
      damage: 13,
      maxDamage: 20,
      baseKnockback: 30,
      maxBaseKnockback: 50,
      knockbackGrowth: 80,
      maxKnockbackGrowth: 100,
      angle: 85,
      startup: 0.133,         // 8F
      active: 0.117,          // 7F 持続長め
      recovery: 0.333,        // 後隙20F
      range: 2.4,
      hitstop: 0.117,
      chargeTime: 1.0,
      cancelable: [],
      landingLag: 0.25,
      hitboxDir: 'up',
      hasSweetspot: true,     // 出始めが強い
      canAngle: false
    },
    // 下スマッシュ - 両側攻撃、低角度
    downSmash: {
      damage: 12,
      maxDamage: 18,
      baseKnockback: 25,
      maxBaseKnockback: 40,
      knockbackGrowth: 75,
      maxKnockbackGrowth: 95,
      angle: 28,              // 低角度
      startup: 0.1,           // 6F
      active: 0.15,
      recovery: 0.367,        // 後隙22F
      range: 2.0,
      hitstop: 0.1,
      chargeTime: 1.0,
      cancelable: [],
      landingLag: 0.25,
      hitboxDir: 'around',
      hasSweetspot: false,
      canAngle: false
    },
    // ダッシュ攻撃 - 突進、中ダメージ
    dashAttack: {
      damage: 9,
      baseKnockback: 40,
      knockbackGrowth: 55,
      angle: 50,              // やや上
      startup: 0.067,         // 4F
      active: 0.117,
      recovery: 0.233,        // 後隙14F
      range: 1.6,
      hitstop: 0.083,
      cancelable: [],
      landingLag: 0.117,
      hitboxDir: 'forward',
      hasSweetspot: true,     // 出始めが強い
      canAngle: false,
      momentum: true          // 移動しながら攻撃
    },
    // ============ 空中技 ============
    // 空N - 持続長い、暴れ用
    nair: {
      damage: 6,
      baseKnockback: 12,
      knockbackGrowth: 45,
      angle: 45,
      startup: 0.05,          // 3F
      active: 0.2,            // 12F 持続長い
      recovery: 0.117,
      range: 1.6,
      hitstop: 0.05,
      cancelable: [],
      landingLag: 0.1,        // 6F
      autocancel: { early: 0.05, late: 0.3 },  // オートキャンセル
      hitboxDir: 'around',
      hasSweetspot: false,
      canAngle: false
    },
    // 空前 - メイン空中攻撃、コンボパーツ
    fair: {
      damage: 9,
      baseKnockback: 12,
      knockbackGrowth: 65,
      angle: 40,
      startup: 0.1,           // 6F
      active: 0.067,
      recovery: 0.167,
      range: 1.8,
      hitstop: 0.083,
      cancelable: [],
      landingLag: 0.133,      // 8F
      autocancel: { early: 0.067, late: 0.283 },
      hitboxDir: 'forward',
      hasSweetspot: true,
      canAngle: true
    },
    // 空後 - 最強の空中技！スイートスポット重要
    bair: {
      damage: 14,
      baseKnockback: 18,
      knockbackGrowth: 90,
      angle: 35,              // 横に強く飛ばす
      startup: 0.117,         // 7F
      active: 0.05,           // 3F 持続短い
      recovery: 0.217,        // 後隙13F
      range: 1.6,
      hitstop: 0.133,
      cancelable: [],
      landingLag: 0.167,      // 10F 着地隙大きめ
      autocancel: { early: 0.05, late: 0.317 },
      hitboxDir: 'back',
      hasSweetspot: true,     // 先端が超強力
      sweetspotMultiplier: 1.3,  // 空後専用の強化倍率
      canAngle: false
    },
    // 空上 - お手玉用、持続と範囲
    uair: {
      damage: 7,
      baseKnockback: 12,
      knockbackGrowth: 55,
      angle: 80,
      startup: 0.067,         // 4F
      active: 0.117,          // 7F
      recovery: 0.133,
      range: 2.0,
      hitstop: 0.067,
      cancelable: [],
      landingLag: 0.1,        // 6F
      autocancel: { early: 0.05, late: 0.267 },
      hitboxDir: 'up',
      hasSweetspot: false,
      canAngle: false
    },
    // 空下 - メテオ！リスク大、リターン大
    dair: {
      damage: 12,
      baseKnockback: 18,
      knockbackGrowth: 80,
      angle: -80,             // ほぼ真下
      startup: 0.183,         // 11F 発生遅い
      active: 0.083,          // 5F
      recovery: 0.267,        // 後隙16F
      range: 1.8,
      hitstop: 0.2,
      cancelable: [],
      landingLag: 0.267,      // 16F 着地隙大
      autocancel: { early: 0, late: 0.45 },  // ほぼオートキャンセル不可
      hitboxDir: 'down',
      hasSweetspot: true,     // 中心がメテオ
      isMeteor: true,
      canAngle: false
    },
    // バット - 最終兵器
    bat: {
      damage: 30,
      maxDamage: 45,
      baseKnockback: 50,
      maxBaseKnockback: 80,
      knockbackGrowth: 100,    // スマブラ式で/100されて1.0
      maxKnockbackGrowth: 140, // 実質1.4
      angle: 45,
      startup: 0.233,         // 14F
      active: 0.133,          // 8F
      recovery: 0.5,          // 後隙30F 非常に大きい
      range: 2.8,
      hitstop: 0.333,
      chargeTime: 2.0,
      cancelable: [],
      landingLag: 0.333,
      hitboxDir: 'forward',
      hasSweetspot: true,
      sweetspotMultiplier: 1.25,
      canAngle: true
    }
  }
};


// 距離に応じた背景テーマ定義
const BACKGROUND_THEMES = [
  {
    minDistance: -Infinity,
    maxDistance: 0,
    name: '暗闘',
    sky: { top: '#1a1a1a', middle: '#2d2d2d', bottom: '#3d3d3d' },
    ground: '#2a2a2a',
    elements: []
  },
  {
    minDistance: 0,
    maxDistance: 100,
    name: '公園・草原',
    sky: { top: '#4A90D9', middle: '#87CEEB', bottom: '#B4E7CE' },
    ground: '#4CAF50',
    elements: ['grass', 'trees']
  },
  {
    minDistance: 100,
    maxDistance: 200,
    name: '郊外・田園',
    sky: { top: '#5B9BD5', middle: '#7EC8E3', bottom: '#C8E6C9' },
    ground: '#7CB342',
    elements: ['houses', 'windmills']
  },
  {
    minDistance: 200,
    maxDistance: 300,
    name: '山・森林',
    sky: { top: '#2E5984', middle: '#4A7BA7', bottom: '#6B8E6B' },
    ground: '#2E7D32',
    elements: ['mountains', 'conifers']
  },
  {
    minDistance: 300,
    maxDistance: 450,
    name: '高空・雲の上',
    sky: { top: '#1A3A5C', middle: '#2E5984', bottom: '#5B9BD5' },
    ground: null,
    elements: ['bigClouds']
  },
  {
    minDistance: 450,
    maxDistance: Infinity,
    name: '宇宙',
    sky: { top: '#000510', middle: '#0A1628', bottom: '#1A3A5C' },
    ground: null,
    elements: ['stars', 'moon', 'earth']
  }
];

// 色補間ユーティリティ関数
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

// 線形補間関数
function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpColor(color1, color2, t) {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  if (!c1 || !c2) return color1;
  
  const r = c1.r + (c2.r - c1.r) * t;
  const g = c1.g + (c2.g - c1.g) * t;
  const b = c1.b + (c2.b - c1.b) * t;
  return rgbToHex(r, g, b);
}

// 距離に応じたテーマを取得（遷移を含む）
function getBackgroundTheme(distance) {
  const transitionWidth = 20; // 遷移幅（m）
  
  // 現在のテーマと次のテーマを見つける
  let currentTheme = BACKGROUND_THEMES[0];
  let nextTheme = null;
  let transitionProgress = 0;
  
  for (let i = 0; i < BACKGROUND_THEMES.length; i++) {
    const theme = BACKGROUND_THEMES[i];
    if (distance >= theme.minDistance && distance < theme.maxDistance) {
      currentTheme = theme;
      
      // 次のテーマへの遷移をチェック
      if (i < BACKGROUND_THEMES.length - 1) {
        const nextT = BACKGROUND_THEMES[i + 1];
        const distToNext = theme.maxDistance - distance;
        
        if (distToNext <= transitionWidth) {
          nextTheme = nextT;
          transitionProgress = 1 - (distToNext / transitionWidth);
        }
      }
      break;
    }
  }
  
  // 遷移中の場合、色を補間
  if (nextTheme && transitionProgress > 0) {
    return {
      name: currentTheme.name + ' → ' + nextTheme.name,
      sky: {
        top: lerpColor(currentTheme.sky.top, nextTheme.sky.top, transitionProgress),
        middle: lerpColor(currentTheme.sky.middle, nextTheme.sky.middle, transitionProgress),
        bottom: lerpColor(currentTheme.sky.bottom, nextTheme.sky.bottom, transitionProgress)
      },
      ground: currentTheme.ground && nextTheme.ground 
        ? lerpColor(currentTheme.ground, nextTheme.ground, transitionProgress)
        : (transitionProgress < 0.5 ? currentTheme.ground : nextTheme.ground),
      elements: transitionProgress < 0.5 ? currentTheme.elements : nextTheme.elements,
      transitionProgress: transitionProgress,
      currentTheme: currentTheme,
      nextTheme: nextTheme
    };
  }
  
  return {
    ...currentTheme,
    transitionProgress: 0,
    currentTheme: currentTheme,
    nextTheme: null
  };
}

// 背景要素描画関数
function drawBackgroundElements(cameraX, elements, distance, groundY, cameraY = 0) {
  const parallaxFactor = 0.3;
  const baseX = cameraX * parallaxFactor;

  elements.forEach(element => {
    switch(element) {
      case 'grass':
        drawGrass(cameraX, groundY);
        break;
      case 'trees':
        drawTrees(baseX, groundY);
        break;
      case 'houses':
        drawHouses(baseX, groundY);
        break;
      case 'windmills':
        drawWindmills(baseX, groundY);
        break;
      case 'mountains':
        drawMountains(baseX, groundY);
        break;
      case 'conifers':
        drawConifers(baseX, groundY);
        break;
      case 'bigClouds':
        drawBigClouds(cameraX, cameraY);
        break;
      case 'stars':
        drawStars(cameraX, cameraY);
        break;
      case 'moon':
        drawMoon(cameraX, cameraY);
        break;
      case 'earth':
        drawEarth(cameraX, cameraY);
        break;
    }
  });
}

// 草を描画
function drawGrass(cameraX, groundY) {
  ctx.fillStyle = '#228B22';
  const grassWidth = 3;
  const grassSpacing = 15;
  const startX = Math.floor(cameraX / grassSpacing) * grassSpacing;
  
  for (let x = startX; x < cameraX + CONFIG.canvas.width + grassSpacing; x += grassSpacing) {
    const height = 8 + Math.sin(x * 0.1) * 4;
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x - grassWidth / 2, groundY - height);
    ctx.lineTo(x + grassWidth / 2, groundY - height);
    ctx.closePath();
    ctx.fill();
  }
}

// 木を描画
function drawTrees(baseX, groundY) {
  ctx.fillStyle = '#228B22';
  const treeSpacing = 200;
  const startX = Math.floor(baseX / treeSpacing) * treeSpacing;
  
  for (let x = startX; x < baseX + CONFIG.canvas.width / 0.3 + treeSpacing; x += treeSpacing) {
    const screenX = x - baseX + 50;
    const treeHeight = 60 + Math.sin(x * 0.01) * 20;
    
    // 幹
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(screenX - 5, groundY - treeHeight, 10, treeHeight * 0.4);
    
    // 葉
    ctx.fillStyle = '#228B22';
    ctx.beginPath();
    ctx.arc(screenX, groundY - treeHeight * 0.7, treeHeight * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 家を描画
function drawHouses(baseX, groundY) {
  const houseSpacing = 300;
  const startX = Math.floor(baseX / houseSpacing) * houseSpacing;
  
  for (let x = startX; x < baseX + CONFIG.canvas.width / 0.3 + houseSpacing; x += houseSpacing) {
    const screenX = x - baseX + 100;
    const houseWidth = 50;
    const houseHeight = 35;
    
    // 壁
    ctx.fillStyle = '#F5DEB3';
    ctx.fillRect(screenX - houseWidth / 2, groundY - houseHeight, houseWidth, houseHeight);
    
    // 屋根
    ctx.fillStyle = '#8B0000';
    ctx.beginPath();
    ctx.moveTo(screenX - houseWidth / 2 - 5, groundY - houseHeight);
    ctx.lineTo(screenX, groundY - houseHeight - 25);
    ctx.lineTo(screenX + houseWidth / 2 + 5, groundY - houseHeight);
    ctx.closePath();
    ctx.fill();
    
    // 窓
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(screenX - 10, groundY - houseHeight + 10, 8, 8);
    ctx.fillRect(screenX + 2, groundY - houseHeight + 10, 8, 8);
  }
}

// 風車を描画
function drawWindmills(baseX, groundY) {
  const windmillSpacing = 400;
  const startX = Math.floor(baseX / windmillSpacing) * windmillSpacing + 150;
  
  for (let x = startX; x < baseX + CONFIG.canvas.width / 0.3 + windmillSpacing; x += windmillSpacing) {
    const screenX = x - baseX;
    const height = 80;
    const time = Date.now() / 1000;
    
    // 塔
    ctx.fillStyle = '#F5F5DC';
    ctx.beginPath();
    ctx.moveTo(screenX - 8, groundY);
    ctx.lineTo(screenX + 8, groundY);
    ctx.lineTo(screenX + 4, groundY - height);
    ctx.lineTo(screenX - 4, groundY - height);
    ctx.closePath();
    ctx.fill();
    
    // 羽根
    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const angle = time * 2 + (i * Math.PI / 2);
      const bladeLength = 30;
      ctx.beginPath();
      ctx.moveTo(screenX, groundY - height);
      ctx.lineTo(
        screenX + Math.cos(angle) * bladeLength,
        groundY - height + Math.sin(angle) * bladeLength
      );
      ctx.stroke();
    }
  }
}

// 山を描画
function drawMountains(baseX, groundY) {
  const mountainSpacing = 250;
  const startX = Math.floor(baseX / mountainSpacing) * mountainSpacing;
  
  for (let x = startX; x < baseX + CONFIG.canvas.width / 0.3 + mountainSpacing; x += mountainSpacing) {
    const screenX = x - baseX;
    const height = 150 + Math.sin(x * 0.005) * 50;
    
    // 山本体
    ctx.fillStyle = '#4A5D4A';
    ctx.beginPath();
    ctx.moveTo(screenX - 100, groundY);
    ctx.lineTo(screenX, groundY - height);
    ctx.lineTo(screenX + 100, groundY);
    ctx.closePath();
    ctx.fill();
    
    // 雪冠
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(screenX - 20, groundY - height + 30);
    ctx.lineTo(screenX, groundY - height);
    ctx.lineTo(screenX + 20, groundY - height + 30);
    ctx.closePath();
    ctx.fill();
  }
}

// 針葉樹を描画
function drawConifers(baseX, groundY) {
  const treeSpacing = 120;
  const startX = Math.floor(baseX / treeSpacing) * treeSpacing;
  
  for (let x = startX; x < baseX + CONFIG.canvas.width / 0.3 + treeSpacing; x += treeSpacing) {
    const screenX = x - baseX + 30;
    const treeHeight = 50 + Math.sin(x * 0.02) * 15;
    
    // 幹
    ctx.fillStyle = '#654321';
    ctx.fillRect(screenX - 4, groundY - treeHeight * 0.3, 8, treeHeight * 0.3);
    
    // 三角形の葉
    ctx.fillStyle = '#1B4D1B';
    ctx.beginPath();
    ctx.moveTo(screenX, groundY - treeHeight);
    ctx.lineTo(screenX - 20, groundY - treeHeight * 0.3);
    ctx.lineTo(screenX + 20, groundY - treeHeight * 0.3);
    ctx.closePath();
    ctx.fill();
  }
}

// 大きな雲を描画（高空）
function drawBigClouds(cameraX, cameraY = 0) {
  // 基本の雲データ
  const baseCloudData = [
    { x: 200, y: 400, size: 1.5 },
    { x: 500, y: 300, size: 2 },
    { x: 800, y: 450, size: 1.8 },
    { x: 1200, y: 350, size: 2.2 },
    { x: 1600, y: 420, size: 1.6 }
  ];

  // カメラが上に行くほど雲を追加で描画
  const cloudData = [...baseCloudData];
  const extraLayers = Math.ceil(cameraY / 300);
  for (let layer = 1; layer <= extraLayers; layer++) {
    baseCloudData.forEach((cloud, i) => {
      cloudData.push({
        x: cloud.x + layer * 100,
        y: cloud.y - layer * 300,  // 上方向に追加
        size: cloud.size * (0.8 + Math.random() * 0.4)
      });
    });
  }

  const parallaxFactor = 0.2;
  const parallaxFactorY = 0.1;
  const offsetX = (cameraX * parallaxFactor) % 2000;
  const offsetY = cameraY * parallaxFactorY;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';

  cloudData.forEach(cloud => {
    let screenX = cloud.x - offsetX;
    if (screenX < -200) screenX += 2000;
    if (screenX > CONFIG.canvas.width + 200) return;

    const screenY = cloud.y + offsetY;
    const size = cloud.size * 40;

    // 複数の円で雲を構成
    ctx.beginPath();
    ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
    ctx.arc(screenX - size * 0.6, screenY + size * 0.2, size * 0.7, 0, Math.PI * 2);
    ctx.arc(screenX + size * 0.6, screenY + size * 0.2, size * 0.7, 0, Math.PI * 2);
    ctx.arc(screenX - size * 0.3, screenY - size * 0.3, size * 0.6, 0, Math.PI * 2);
    ctx.arc(screenX + size * 0.3, screenY - size * 0.3, size * 0.6, 0, Math.PI * 2);
    ctx.fill();
  });
}

// 星を描画（宇宙）
function drawStars(cameraX, cameraY = 0) {
  // カメラが上に行くほど星を多く描画
  const baseStarCount = 100;
  const extraStars = Math.floor(cameraY / 50);
  const starCount = baseStarCount + extraStars;
  const parallaxFactor = 0.05;
  const parallaxFactorY = 0.03;
  const offsetX = (cameraX * parallaxFactor) % 3000;
  const offsetY = cameraY * parallaxFactorY;

  // 描画範囲をカメラYに応じて拡大
  const yRange = CONFIG.canvas.height + cameraY * 1.5;

  ctx.fillStyle = '#FFFFFF';

  for (let i = 0; i < starCount; i++) {
    // 疑似乱数でシード固定
    const seed = i * 12345;
    const x = ((seed * 9301 + 49297) % 233280) / 233280 * 3000;
    const y = ((seed * 7621 + 35677) % 233280) / 233280 * yRange - cameraY * 0.5;
    const size = ((seed * 4567 + 12345) % 233280) / 233280 * 2 + 0.5;
    const twinkle = Math.sin(Date.now() / 500 + i) * 0.3 + 0.7;

    let screenX = x - offsetX;
    if (screenX < -10) screenX += 3000;
    if (screenX > CONFIG.canvas.width + 10) continue;

    const screenY = y + offsetY;

    ctx.globalAlpha = twinkle;
    ctx.beginPath();
    ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// 月を描画
function drawMoon(cameraX, cameraY = 0) {
  const parallaxFactor = 0.02;
  const parallaxFactorY = 0.05;
  const moonX = 700 - cameraX * parallaxFactor;
  // カメラが上に行くと月も相対的に下に移動（視差効果）
  const moonY = 100 + cameraY * parallaxFactorY;
  const moonRadius = 50;

  if (moonX < -moonRadius || moonX > CONFIG.canvas.width + moonRadius) return;

  // 月の光
  const gradient = ctx.createRadialGradient(moonX, moonY, moonRadius * 0.8, moonX, moonY, moonRadius * 2);
  gradient.addColorStop(0, 'rgba(255, 255, 200, 0.3)');
  gradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonRadius * 2, 0, Math.PI * 2);
  ctx.fill();

  // 月本体
  ctx.fillStyle = '#FFFACD';
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
  ctx.fill();

  // クレーター
  ctx.fillStyle = 'rgba(200, 200, 180, 0.3)';
  ctx.beginPath();
  ctx.arc(moonX - 15, moonY - 10, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(moonX + 20, moonY + 15, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(moonX - 5, moonY + 20, 6, 0, Math.PI * 2);
  ctx.fill();
}

// 地球を描画
function drawEarth(cameraX, cameraY = 0) {
  const parallaxFactor = 0.01;
  const parallaxFactorY = 0.3;  // 地球は遠いのでY方向のパララックスは大きめ
  const earthX = 300 - cameraX * parallaxFactor;
  // カメラが上に行くと地球は相対的に下に大きく移動
  const earthY = CONFIG.canvas.height - 80 + cameraY * parallaxFactorY;
  const earthRadius = 200;

  // 地球の一部（下半分が見える）
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, -cameraY, CONFIG.canvas.width, CONFIG.canvas.height + cameraY * 2);
  ctx.clip();

  // 大気の光（グロー効果）
  const glowGradient = ctx.createRadialGradient(earthX, earthY, earthRadius * 0.9, earthX, earthY, earthRadius * 1.2);
  glowGradient.addColorStop(0, 'rgba(100, 180, 255, 0.4)');
  glowGradient.addColorStop(1, 'rgba(100, 180, 255, 0)');
  ctx.fillStyle = glowGradient;
  ctx.beginPath();
  ctx.arc(earthX, earthY, earthRadius * 1.2, 0, Math.PI * 2);
  ctx.fill();

  // 地球本体（青い部分）
  ctx.fillStyle = '#1E90FF';
  ctx.beginPath();
  ctx.arc(earthX, earthY, earthRadius, 0, Math.PI * 2);
  ctx.fill();

  // 大陸（緑）
  ctx.fillStyle = '#228B22';
  // 簡略化された大陸
  ctx.beginPath();
  ctx.ellipse(earthX - 40, earthY - 60, 50, 30, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(earthX + 60, earthY - 30, 35, 45, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // 雲
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.beginPath();
  ctx.ellipse(earthX - 20, earthY - 80, 40, 15, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(earthX + 50, earthY - 50, 30, 10, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

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
  maxDistance: null,
  launched: false,
  hitstop: 0,         // グローバルヒットストップ
  slowMotion: 0,      // スローモーション残り時間
  slowMotionScale: 1, // スローの倍率
  staleQueue: [],     // ステールキュー
  lastJustFrame: false,
  lastCounterHit: false,
  lastSweetspot: false,   // スイートスポットヒット
  lastSourspot: false,    // サワースポットヒット
  totalDamageDealt: 0,
  comboProration: 1.0,
  dismembered: false,  // バラバラになったかどうか
  farthestPart: null,  // 一番遠くに飛んだパーツ
  timeUpPending: false, // チャージ中の時間切れ保留フラグ
  cameraX: 0,          // カメラX座標
  cameraY: 0           // カメラY座標
};

// ============================================
// Audio System - Web Audio API
// ============================================
let audioContext = null;

function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
}

// スイング音（攻撃タイプに応じて変化）
function playSwingSound(type) {
  if (!audioContext) return;

  const now = audioContext.currentTime;

  // ノイズ生成
  const bufferSize = audioContext.sampleRate * 0.1;
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
  }

  const noise = audioContext.createBufferSource();
  noise.buffer = buffer;

  // フィルター（攻撃タイプで周波数変更）
  const filter = audioContext.createBiquadFilter();
  filter.type = 'bandpass';

  const gain = audioContext.createGain();

  switch (type) {
    case 'weak':
    case 'weak2':
    case 'weak3':
      filter.frequency.value = 3000;
      filter.Q.value = 1;
      gain.gain.setValueAtTime(0.15, now);
      break;
    case 'strong':
    case 'dtilt':
    case 'utilt':
      filter.frequency.value = 1500;
      filter.Q.value = 0.8;
      gain.gain.setValueAtTime(0.25, now);
      break;
    case 'smash':
    case 'upSmash':
    case 'downSmash':
      filter.frequency.value = 800;
      filter.Q.value = 0.5;
      gain.gain.setValueAtTime(0.35, now);
      break;
    case 'bat':
      filter.frequency.value = 500;
      filter.Q.value = 0.3;
      gain.gain.setValueAtTime(0.5, now);
      break;
    default:
      filter.frequency.value = 2000;
      filter.Q.value = 1;
      gain.gain.setValueAtTime(0.2, now);
  }

  gain.gain.exponentialDecayTo && gain.gain.exponentialDecayTo(0.001, now + 0.1);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioContext.destination);

  noise.start(now);
  noise.stop(now + 0.15);
}

// カウントダウン音（3, 2, 1）- 短いビープ音
function playCountdownSound(count) {
  if (!audioContext) return;

  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();

  osc.type = 'sine';
  osc.frequency.value = 440 + (3 - count) * 50;  // 3: 440Hz, 2: 490Hz, 1: 540Hz

  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

  osc.connect(gain);
  gain.connect(audioContext.destination);

  osc.start(now);
  osc.stop(now + 0.2);
}

// GO!音 - より高く明るい音
function playGoSound() {
  if (!audioContext) return;

  const now = audioContext.currentTime;

  // メイン音（高い周波数）
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();

  osc.type = 'sine';
  osc.frequency.value = 880;  // 高い音

  gain.gain.setValueAtTime(0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

  osc.connect(gain);
  gain.connect(audioContext.destination);

  osc.start(now);
  osc.stop(now + 0.4);

  // ハーモニー音（オクターブ上）
  const osc2 = audioContext.createOscillator();
  const gain2 = audioContext.createGain();

  osc2.type = 'sine';
  osc2.frequency.value = 1320;

  gain2.gain.setValueAtTime(0.2, now);
  gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

  osc2.connect(gain2);
  gain2.connect(audioContext.destination);

  osc2.start(now);
  osc2.stop(now + 0.3);
}

// ヒット音（ダメージ量とヒットタイプで変化）
function playHitSound(knockback, hitType, isBat = false) {
  if (!audioContext) return;

  const now = audioContext.currentTime;

  // インパクト音（オシレーター）
  const osc = audioContext.createOscillator();
  const oscGain = audioContext.createGain();

  // ノイズ成分
  const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.15, audioContext.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (noiseData.length * 0.2));
  }
  const noise = audioContext.createBufferSource();
  noise.buffer = noiseBuffer;
  const noiseGain = audioContext.createGain();

  // ヒットタイプによる音の変化
  let baseFreq = 150;
  let volume = 0.3;
  let duration = 0.1;

  if (isBat) {
    // バット音 - 強烈なインパクト
    baseFreq = 80;
    volume = 0.7;
    duration = 0.3;
    osc.type = 'sawtooth';
  } else if (hitType === 'sweetspot') {
    // スイートスポット - クリーンな高い音
    baseFreq = 300 + knockback * 2;
    volume = 0.5;
    duration = 0.15;
    osc.type = 'triangle';
  } else if (hitType === 'sourspot') {
    // サワースポット - 鈍い音
    baseFreq = 100;
    volume = 0.2;
    duration = 0.08;
    osc.type = 'sine';
  } else {
    // 通常ヒット
    baseFreq = 150 + knockback;
    volume = 0.3 + Math.min(knockback / 100, 0.3);
    osc.type = 'square';
  }

  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.3, now + duration);

  oscGain.gain.setValueAtTime(volume, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  noiseGain.gain.setValueAtTime(volume * 0.5, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.7);

  osc.connect(oscGain);
  oscGain.connect(audioContext.destination);

  noise.connect(noiseGain);
  noiseGain.connect(audioContext.destination);

  osc.start(now);
  osc.stop(now + duration);
  noise.start(now);
  noise.stop(now + duration);
}

// コンボ音（コンボ数に応じてピッチ上昇）
function playComboSound(comboCount) {
  if (!audioContext || comboCount < 3) return;

  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();

  // コンボ数でピッチを上げる
  const baseFreq = 400 + Math.min(comboCount * 50, 800);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.setValueAtTime(baseFreq * 1.5, now + 0.05);

  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

  osc.connect(gain);
  gain.connect(audioContext.destination);

  osc.start(now);
  osc.stop(now + 0.1);
}

// バラバラになる時のグロ効果音
function playDismemberSound() {
  if (!audioContext) return;

  const now = audioContext.currentTime;

  // 1. 肉が裂ける音 (低音のウェットなノイズ)
  const tearBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.4, audioContext.sampleRate);
  const tearData = tearBuffer.getChannelData(0);
  for (let i = 0; i < tearData.length; i++) {
    const t = i / tearData.length;
    // 不規則なノイズ + 低周波のうねり
    tearData[i] = (Math.random() * 2 - 1) * Math.exp(-t * 3) *
      (1 + Math.sin(t * 50) * 0.5) *
      (Math.random() > 0.7 ? 1.5 : 1);
  }
  const tearNoise = audioContext.createBufferSource();
  tearNoise.buffer = tearBuffer;

  const tearFilter = audioContext.createBiquadFilter();
  tearFilter.type = 'lowpass';
  tearFilter.frequency.value = 800;
  tearFilter.Q.value = 2;

  const tearGain = audioContext.createGain();
  tearGain.gain.setValueAtTime(0.6, now);
  tearGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

  tearNoise.connect(tearFilter);
  tearFilter.connect(tearGain);
  tearGain.connect(audioContext.destination);

  tearNoise.start(now);
  tearNoise.stop(now + 0.4);

  // 2. 骨が折れる音 (複数のクラック音)
  for (let i = 0; i < 3; i++) {
    const crackTime = now + i * 0.05 + Math.random() * 0.03;

    const crackOsc = audioContext.createOscillator();
    const crackGain = audioContext.createGain();

    crackOsc.type = 'square';
    crackOsc.frequency.setValueAtTime(200 + Math.random() * 100, crackTime);
    crackOsc.frequency.exponentialRampToValueAtTime(50, crackTime + 0.03);

    crackGain.gain.setValueAtTime(0.4, crackTime);
    crackGain.gain.exponentialRampToValueAtTime(0.001, crackTime + 0.05);

    crackOsc.connect(crackGain);
    crackGain.connect(audioContext.destination);

    crackOsc.start(crackTime);
    crackOsc.stop(crackTime + 0.05);
  }

  // 3. 内臓が飛び散る音 (ぐちゃっとしたウェット音)
  const splatterBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.3, audioContext.sampleRate);
  const splatterData = splatterBuffer.getChannelData(0);
  for (let i = 0; i < splatterData.length; i++) {
    const t = i / splatterData.length;
    // バブル的な音 + ランダムなスプラッター
    splatterData[i] = (Math.random() * 2 - 1) *
      Math.exp(-t * 4) *
      (1 + Math.sin(t * 200 + Math.random() * 10) * 0.8);
  }
  const splatterNoise = audioContext.createBufferSource();
  splatterNoise.buffer = splatterBuffer;

  const splatterFilter = audioContext.createBiquadFilter();
  splatterFilter.type = 'bandpass';
  splatterFilter.frequency.value = 400;
  splatterFilter.Q.value = 1;

  const splatterGain = audioContext.createGain();
  splatterGain.gain.setValueAtTime(0.5, now + 0.05);
  splatterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  splatterNoise.connect(splatterFilter);
  splatterFilter.connect(splatterGain);
  splatterGain.connect(audioContext.destination);

  splatterNoise.start(now + 0.05);
  splatterNoise.stop(now + 0.35);

  // 4. 低音のインパクト (ズンという重低音)
  const impactOsc = audioContext.createOscillator();
  const impactGain = audioContext.createGain();

  impactOsc.type = 'sine';
  impactOsc.frequency.setValueAtTime(60, now);
  impactOsc.frequency.exponentialRampToValueAtTime(20, now + 0.3);

  impactGain.gain.setValueAtTime(0.7, now);
  impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

  impactOsc.connect(impactGain);
  impactGain.connect(audioContext.destination);

  impactOsc.start(now);
  impactOsc.stop(now + 0.3);
}

// 結果表示音
function playResultSound(distance) {
  if (!audioContext) return;

  const now = audioContext.currentTime;

  // 距離に応じた音の変化
  let notes;
  if (distance >= 500) {
    notes = [523, 659, 784, 1047]; // ド ミ ソ ド（高）
  } else if (distance >= 100) {
    notes = [392, 494, 587]; // ソ シ レ
  } else {
    notes = [262, 330]; // ド ミ
  }

  notes.forEach((freq, i) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = 'triangle';
    osc.frequency.value = freq;

    const startTime = now + i * 0.15;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.5);
  });
}

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
const minusRankingList = document.getElementById('minus-ranking-list');
const rankingBtn = document.getElementById('rankingBtn');
const startRankingBtn = document.getElementById('startRankingBtn');
const closeRankingBtn = document.getElementById('closeRankingBtn');
const nameInputModal = document.getElementById('name-input-modal');
const playerNameInput = document.getElementById('player-name-input');
const submitNameBtn = document.getElementById('submitNameBtn');
const skipNameBtn = document.getElementById('skipNameBtn');
const modalDistance = document.getElementById('modal-distance');
const currentPlayerNameEl = document.getElementById('current-player-name');
const changeNameBtn = document.getElementById('changeNameBtn');

// Pending score for ranking submission
let pendingScore = null;

// Physics
let world, ground, platform, sandbag, playerBody;

// Body Parts System (Happy Wheels style dismemberment)
let bodyParts = [];  // 体のバラバラになったパーツ
let bloodEffects = [];  // 血しぶきエフェクト
let bloodPools = [];  // 地面の血だまり

// Player State
const player = {
  facingRight: true,
  grounded: false,
  jumpsLeft: CONFIG.player.maxJumps,
  attacking: false,
  attackType: null,
  attackPhase: null,
  attackTimer: 0,
  attackTotalTime: 0,     // 攻撃の総経過時間（オートキャンセル用）
  charging: false,
  chargeAmount: 0,
  canAttack: true,
  airDashing: false,
  airDashTimer: 0,
  canAirDash: true,
  lastAttackHit: false,
  cancelWindow: false,
  landingLag: 0,
  // 新しい移動系
  running: false,         // ダッシュ中か
  runTimer: 0,
  pivotTimer: 0,          // ピボット入力タイマー
  lastMoveDir: 0,         // 最後の移動方向
  jumpHeld: false,        // ジャンプボタン長押し判定
  jumpHeldTime: 0,        // ジャンプボタン押し時間
  shortHopWindow: 0.083,  // 5Fでショートホップ判定
  // RAR (Reverse Aerial Rush)
  turnaroundTimer: 0,
  wantsTurnaround: false
};

// Input State
const input = {
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
  jumpPressed: false,
  jumpReleased: false,    // ショートホップ判定用
  weak: false,
  weakPressed: false,
  strong: false,
  strongPressed: false,
  smash: false,
  smashReleased: false,
  bat: false,
  airDash: false,
  airDashPressed: false,
  // 方向入力の履歴（ピボット用）
  lastHorizontal: 0,
  horizontalTime: 0
};

// Images
let sandbagImage = null;

function loadImages() {
  const img = new Image();
  img.onload = () => { sandbagImage = img; };
  img.src = 'tubouchi.png';
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
// Happy Wheels Style Dismemberment System
// ============================================

// 体パーツの定義
const BODY_PART_TYPES = {
  head: {
    name: '頭',
    width: 0.8,
    height: 0.8,
    color: '#FFE0BD',
    offsetX: 0,
    offsetY: 1.2,
    mass: 0.8,
    gore: true,
    eyes: true
  },
  torso: {
    name: '胴体',
    width: 1.0,
    height: 1.2,
    color: '#FFD93D',
    offsetX: 0,
    offsetY: 0,
    mass: 2.0,
    gore: true
  },
  leftArm: {
    name: '左腕',
    width: 0.3,
    height: 0.8,
    color: '#FFE0BD',
    offsetX: -0.8,
    offsetY: 0.4,
    mass: 0.5,
    gore: true
  },
  rightArm: {
    name: '右腕',
    width: 0.3,
    height: 0.8,
    color: '#FFE0BD',
    offsetX: 0.8,
    offsetY: 0.4,
    mass: 0.5,
    gore: true
  },
  leftLeg: {
    name: '左脚',
    width: 0.35,
    height: 1.0,
    color: '#4A4A4A',
    offsetX: -0.4,
    offsetY: -1.0,
    mass: 0.7,
    gore: true
  },
  rightLeg: {
    name: '右脚',
    width: 0.35,
    height: 1.0,
    color: '#4A4A4A',
    offsetX: 0.4,
    offsetY: -1.0,
    mass: 0.7,
    gore: true
  },
  intestines: {
    name: '内臓',
    width: 0.5,
    height: 0.4,
    color: '#8B0000',
    offsetX: 0,
    offsetY: -0.3,
    mass: 0.3,
    gore: true,
    isGore: true
  }
};

// サンドバッグをバラバラにする
function dismemberSandbag() {
  if (!sandbag || state.dismembered) return;

  // グロ効果音を再生
  playDismemberSound();

  const pos = sandbag.getPosition();
  const vel = sandbag.getLinearVelocity();
  const angle = sandbag.getAngle();
  const angVel = sandbag.getAngularVelocity();

  // 衝撃の強さに応じて飛び散り方を変える
  const impactForce = vel.length();
  const explosionMultiplier = Math.min(3, 1 + impactForce * 0.05);

  // 大量の血しぶきを生成
  for (let i = 0; i < 50; i++) {
    createBloodSplatter(pos.x, pos.y, vel.x * 0.3, vel.y * 0.3, explosionMultiplier);
  }

  // 体のパーツを生成
  for (const [partType, partDef] of Object.entries(BODY_PART_TYPES)) {
    const partX = pos.x + partDef.offsetX * Math.cos(angle) - partDef.offsetY * Math.sin(angle);
    const partY = pos.y + partDef.offsetX * Math.sin(angle) + partDef.offsetY * Math.cos(angle);

    // ランダムな飛び散り速度
    const spreadAngle = Math.random() * Math.PI * 2;
    const spreadForce = (5 + Math.random() * 15) * explosionMultiplier;
    const partVelX = vel.x * 0.5 + Math.cos(spreadAngle) * spreadForce;
    const partVelY = vel.y * 0.5 + Math.sin(spreadAngle) * spreadForce + 5;

    createBodyPart(partType, partDef, partX, partY, partVelX, partVelY, angle, angVel);
  }

  // 追加の肉片を生成
  for (let i = 0; i < 8; i++) {
    const goreX = pos.x + (Math.random() - 0.5) * 2;
    const goreY = pos.y + (Math.random() - 0.5) * 2;
    const spreadAngle = Math.random() * Math.PI * 2;
    const spreadForce = (3 + Math.random() * 20) * explosionMultiplier;
    createGorePiece(goreX, goreY,
      vel.x * 0.3 + Math.cos(spreadAngle) * spreadForce,
      vel.y * 0.3 + Math.sin(spreadAngle) * spreadForce + 3
    );
  }

  // サンドバッグを削除
  world.destroyBody(sandbag);
  sandbag = null;
  state.dismembered = true;

  // 画面を揺らす
  state.screenShake = 0.5;
}

// 体パーツを生成
function createBodyPart(partType, partDef, x, y, velX, velY, angle, angVel) {
  const body = world.createBody({
    type: 'dynamic',
    position: Vec2(x, y),
    angle: angle + (Math.random() - 0.5) * 0.5,
    linearDamping: 0.1,
    angularDamping: 0.3,
    fixedRotation: false
  });

  body.createFixture({
    shape: new Box(partDef.width / 2, partDef.height / 2),
    density: partDef.mass / (partDef.width * partDef.height),
    friction: 0.5,
    restitution: 0.3
  });

  body.setLinearVelocity(Vec2(velX, velY));
  body.setAngularVelocity(angVel + (Math.random() - 0.5) * 10);

  const part = {
    body: body,
    type: partType,
    def: partDef,
    startX: sandbag ? sandbag.startX : 8,
    bleeding: partDef.gore,
    bleedTimer: 0,
    settled: false,
    trailPoints: []
  };

  bodyParts.push(part);
  body.setUserData({ type: 'bodyPart', part: part });
}

// 追加の肉片を生成
function createGorePiece(x, y, velX, velY) {
  const size = 0.15 + Math.random() * 0.25;
  const body = world.createBody({
    type: 'dynamic',
    position: Vec2(x, y),
    angle: Math.random() * Math.PI * 2,
    linearDamping: 0.1,
    angularDamping: 0.5,
    fixedRotation: false
  });

  body.createFixture({
    shape: new Box(size / 2, size / 2),
    density: 0.5,
    friction: 0.6,
    restitution: 0.2
  });

  body.setLinearVelocity(Vec2(velX, velY));
  body.setAngularVelocity((Math.random() - 0.5) * 20);

  const part = {
    body: body,
    type: 'gore',
    def: {
      name: '肉片',
      width: size,
      height: size,
      color: ['#8B0000', '#A52A2A', '#800000', '#660000'][Math.floor(Math.random() * 4)],
      isGore: true
    },
    startX: sandbag ? sandbag.startX : 8,
    bleeding: true,
    bleedTimer: 0,
    settled: false,
    trailPoints: []
  };

  bodyParts.push(part);
  body.setUserData({ type: 'bodyPart', part: part });
}

// 血しぶきを生成
function createBloodSplatter(x, y, baseVelX, baseVelY, multiplier = 1) {
  const angle = Math.random() * Math.PI * 2;
  const speed = (2 + Math.random() * 8) * multiplier;

  bloodEffects.push({
    x: x,
    y: y,
    velX: baseVelX + Math.cos(angle) * speed,
    velY: baseVelY + Math.sin(angle) * speed + 2,
    size: 2 + Math.random() * 6,
    life: 1.0,
    color: ['#8B0000', '#A52A2A', '#800000', '#B22222', '#DC143C'][Math.floor(Math.random() * 5)],
    gravity: -25 - Math.random() * 10
  });
}

// 血だまりを作成
function createBloodPool(x, y) {
  bloodPools.push({
    x: x,
    y: y,
    size: 5 + Math.random() * 15,
    alpha: 0.8,
    growing: true,
    maxSize: 20 + Math.random() * 30
  });
}

// 体パーツの更新
function updateBodyParts(dt) {
  if (bodyParts.length === 0) return;

  let farthestDistance = null;
  let farthestPart = null;

  for (const part of bodyParts) {
    const pos = part.body.getPosition();
    const vel = part.body.getLinearVelocity();

    // 距離を計算
    const distance = pos.x - part.startX;

    // 一番遠いパーツを選択（プラス優先、同じ符号なら絶対値で比較）
    if (farthestDistance === null) {
      farthestDistance = distance;
      farthestPart = part;
    } else if (distance >= 0 && farthestDistance < 0) {
      // 新しいのがプラスで既存がマイナス → 新しい方を採用
      farthestDistance = distance;
      farthestPart = part;
    } else if (distance < 0 && farthestDistance >= 0) {
      // 新しいのがマイナスで既存がプラス → 既存をキープ
    } else {
      // 同じ符号なら絶対値で比較
      if (Math.abs(distance) > Math.abs(farthestDistance)) {
        farthestDistance = distance;
        farthestPart = part;
      }
    }

    // 出血エフェクト
    if (part.bleeding && !part.settled) {
      part.bleedTimer += dt;
      if (part.bleedTimer > 0.05) {
        part.bleedTimer = 0;
        createBloodSplatter(pos.x, pos.y, vel.x * 0.1, vel.y * 0.1, 0.5);

        // 軌跡を記録
        part.trailPoints.push({ x: pos.x, y: pos.y });
        if (part.trailPoints.length > 20) {
          part.trailPoints.shift();
        }
      }
    }

    // 地面に落ちて停止したら
    if (pos.y < 2.5 && vel.length() < 1) {
      if (!part.settled) {
        part.settled = true;
        part.bleeding = false;
        createBloodPool(pos.x, pos.y);
      }
    }
  }

  // 一番遠くのパーツを更新
  if (farthestPart) {
    state.farthestPart = farthestPart;
    state.distance = farthestDistance;
    // maxDistanceを更新（プラス > マイナス。同じ符号なら絶対値で比較）
    if (state.maxDistance === null) {
      state.maxDistance = state.distance;
    } else if (state.distance >= 0 && state.maxDistance < 0) {
      state.maxDistance = state.distance;
    } else if (state.distance < 0 && state.maxDistance >= 0) {
      // プラスのままキープ
    } else {
      // 同じ符号なら絶対値で比較
      if (Math.abs(state.distance) > Math.abs(state.maxDistance)) {
        state.maxDistance = state.distance;
      }
    }
  }

  // 血しぶきの更新
  for (let i = bloodEffects.length - 1; i >= 0; i--) {
    const blood = bloodEffects[i];
    blood.velY += blood.gravity * dt;
    blood.x += blood.velX * dt;
    blood.y += blood.velY * dt;
    blood.life -= dt * 2;

    // 地面に落ちたら血だまりに
    if (blood.y < 2) {
      if (Math.random() < 0.3) {
        createBloodPool(blood.x, 2);
      }
      blood.life = 0;
    }

    if (blood.life <= 0) {
      bloodEffects.splice(i, 1);
    }
  }

  // 血だまりの更新
  for (const pool of bloodPools) {
    if (pool.growing && pool.size < pool.maxSize) {
      pool.size += dt * 10;
    } else {
      pool.growing = false;
      pool.alpha = Math.max(0.3, pool.alpha - dt * 0.05);
    }
  }
}

// 体パーツの描画
function drawBodyParts() {
  // 血の軌跡を先に描画
  for (const part of bodyParts) {
    if (part.trailPoints.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(139, 0, 0, 0.5)';
      ctx.lineWidth = 3;
      const firstPoint = toCanvas(part.trailPoints[0].x, part.trailPoints[0].y);
      ctx.moveTo(firstPoint.x, firstPoint.y);
      for (let i = 1; i < part.trailPoints.length; i++) {
        const point = toCanvas(part.trailPoints[i].x, part.trailPoints[i].y);
        ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();
    }
  }

  // 血だまり
  for (const pool of bloodPools) {
    const pos = toCanvas(pool.x, 2);
    ctx.fillStyle = `rgba(139, 0, 0, ${pool.alpha})`;
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y + 10, pool.size, pool.size * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 血しぶき
  for (const blood of bloodEffects) {
    const pos = toCanvas(blood.x, blood.y);
    ctx.fillStyle = blood.color;
    ctx.globalAlpha = blood.life;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, blood.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // 体パーツを描画
  for (const part of bodyParts) {
    const pos = part.body.getPosition();
    const angle = part.body.getAngle();
    const canvasPos = toCanvas(pos.x, pos.y);
    const w = part.def.width * CONFIG.physics.scale;
    const h = part.def.height * CONFIG.physics.scale;

    ctx.save();
    ctx.translate(canvasPos.x, canvasPos.y);
    ctx.rotate(-angle);

    // 肉片の場合は不定形に
    if (part.def.isGore) {
      ctx.fillStyle = part.def.color;
      ctx.beginPath();
      ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
      ctx.fill();

      // 血の滴り
      ctx.fillStyle = '#660000';
      ctx.beginPath();
      ctx.arc(w * 0.2, h * 0.3, w * 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 通常のパーツ
      ctx.fillStyle = part.def.color;
      ctx.fillRect(-w / 2, -h / 2, w, h);

      // 切断面（赤い端）
      ctx.fillStyle = '#8B0000';
      if (part.type === 'head') {
        ctx.fillRect(-w / 2, h / 2 - 4, w, 4);
      } else if (part.type === 'torso') {
        ctx.fillRect(-w / 2, -h / 2, w, 3);
        ctx.fillRect(-w / 2, h / 2 - 3, w, 3);
        ctx.fillRect(-w / 2, -h / 2, 3, h);
        ctx.fillRect(w / 2 - 3, -h / 2, 3, h);
      } else if (part.type.includes('Arm') || part.type.includes('Leg')) {
        ctx.fillRect(-w / 2, -h / 2, w, 3);
      }

      // 頭の顔
      if (part.def.eyes) {
        // 目（×印で死んだ目）
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        // 左目
        ctx.beginPath();
        ctx.moveTo(-w * 0.25 - 4, -h * 0.1 - 4);
        ctx.lineTo(-w * 0.25 + 4, -h * 0.1 + 4);
        ctx.moveTo(-w * 0.25 + 4, -h * 0.1 - 4);
        ctx.lineTo(-w * 0.25 - 4, -h * 0.1 + 4);
        ctx.stroke();
        // 右目
        ctx.beginPath();
        ctx.moveTo(w * 0.25 - 4, -h * 0.1 - 4);
        ctx.lineTo(w * 0.25 + 4, -h * 0.1 + 4);
        ctx.moveTo(w * 0.25 + 4, -h * 0.1 - 4);
        ctx.lineTo(w * 0.25 - 4, -h * 0.1 + 4);
        ctx.stroke();

        // 口（舌を出した死に顔）
        ctx.fillStyle = '#333';
        ctx.fillRect(-w * 0.2, h * 0.15, w * 0.4, 3);
        ctx.fillStyle = '#FF6B6B';
        ctx.beginPath();
        ctx.ellipse(0, h * 0.25, w * 0.15, h * 0.1, 0, 0, Math.PI);
        ctx.fill();
      }

      // 胴体の内臓が見える感じ
      if (part.type === 'torso') {
        ctx.fillStyle = '#8B0000';
        ctx.beginPath();
        ctx.ellipse(0, 0, w * 0.3, h * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#A52A2A';
        ctx.beginPath();
        ctx.ellipse(-w * 0.1, h * 0.1, w * 0.15, h * 0.1, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // 骨が見える
      if (part.type.includes('Arm') || part.type.includes('Leg')) {
        ctx.fillStyle = '#FFFFF0';
        ctx.fillRect(-w * 0.15, -h / 2, w * 0.3, h * 0.15);
      }
    }

    ctx.restore();
  }

  // 一番遠くのパーツにマーカー
  if (state.farthestPart && state.phase === 'flying') {
    const pos = state.farthestPart.body.getPosition();
    const canvasPos = toCanvas(pos.x, pos.y);

    // 矢印マーカー
    ctx.fillStyle = '#FFD700';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(canvasPos.x, canvasPos.y - 60);
    ctx.lineTo(canvasPos.x - 10, canvasPos.y - 75);
    ctx.lineTo(canvasPos.x + 10, canvasPos.y - 75);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // パーツ名
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${state.farthestPart.def.name}`, canvasPos.x, canvasPos.y - 80);
  }
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

// スマブラ式ノックバック計算（本家準拠）
function calculateKnockback(attack, targetDamage, chargeMultiplier = 1.0) {
  // 基本パラメータ
  let baseKB = attack.baseKnockback;
  let growth = attack.knockbackGrowth;

  // チャージボーナス（スマッシュ用）
  if (attack.maxBaseKnockback) {
    baseKB = attack.baseKnockback + (attack.maxBaseKnockback - attack.baseKnockback) * chargeMultiplier;
    growth = attack.knockbackGrowth + (attack.maxKnockbackGrowth - attack.knockbackGrowth) * chargeMultiplier;
  }

  const weight = CONFIG.sandbag.weight;

  // 攻撃のダメージ（チャージ対応）
  const attackDamage = attack.maxDamage
    ? attack.damage + (attack.maxDamage - attack.damage) * chargeMultiplier
    : attack.damage;

  // 本家スマブラ準拠: ((p/10 + p*d/20) × 200/(w+100) × 1.4 + 18) × s + b
  // p: ターゲットのダメージ%, d: 攻撃のダメージ, w: 重さ, s: スケーリング(growth/100), b: 基本ノックバック
  const damageComponent = (targetDamage / 10) + (targetDamage * attackDamage / 20);
  const weightModifier = 200 / (weight + 100);
  const scaledDamage = (damageComponent * weightModifier * 1.4 + 18) * (growth / 100);

  let knockback = scaledDamage + baseKB;

  // デバッグ出力
  console.log(`[KB Debug] targetDamage=${targetDamage}, attackDamage=${attackDamage}, growth=${growth}, baseKB=${baseKB}`);
  console.log(`[KB Debug] damageComponent=${damageComponent.toFixed(1)}, weightMod=${weightModifier.toFixed(2)}, scaledDamage=${scaledDamage.toFixed(1)}, knockback=${knockback.toFixed(1)}`);

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
  player.attackTotalTime = 0;  // オートキャンセル判定用
  player.lastAttackHit = false;
  player.cancelWindow = false;

  // スマッシュ系はチャージ可能
  const chargeableTypes = ['smash', 'upSmash', 'downSmash', 'bat'];
  if (chargeableTypes.includes(actualType)) {
    player.charging = true;
    player.chargeAmount = 0;
    chargeBar.classList.remove('hidden');
  }

  // スイング音を再生
  playSwingSound(actualType);
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
  player.attackTotalTime += dt;  // オートキャンセル判定用

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
    // スイートスポット/サワースポット判定
    let hitType = 'normal';
    if (attack.hasSweetspot) {
      // ヒットボックスの中心からの距離の割合
      const hitboxRadius = attack.range / 2;
      const distFromCenter = dist;
      const distRatio = distFromCenter / hitboxRadius;

      // 外側（先端）がスイートスポット
      if (distRatio >= CONFIG.sweetspot.threshold) {
        hitType = 'sweetspot';
      } else if (distRatio < 0.4) {
        hitType = 'sourspot';
      }
    }

    // 後ろ攻撃の場合は方向を反転
    const hitDirection = hitboxDir === 'back' ? -direction : direction;
    applyHit(attack, hitDirection, hitType);
    player.lastAttackHit = true;
    player.cancelWindow = true;

    player.attackPhase = 'recovery';
    player.attackTimer = 0;
  }
}

function applyHit(attack, direction, hitType = 'normal') {
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

  // スイートスポット/サワースポット補正
  let sweetspotDamageMultiplier = 1.0;
  let sweetspotKBMultiplier = 1.0;
  state.lastSweetspot = false;
  state.lastSourspot = false;

  if (hitType === 'sweetspot') {
    const baseMultiplier = attack.sweetspotMultiplier || CONFIG.sweetspot.damageMultiplier;
    sweetspotDamageMultiplier = baseMultiplier;
    sweetspotKBMultiplier = attack.sweetspotMultiplier || CONFIG.sweetspot.knockbackMultiplier;
    state.lastSweetspot = true;
  } else if (hitType === 'sourspot') {
    sweetspotDamageMultiplier = CONFIG.sweetspot.sourDamageMultiplier;
    sweetspotKBMultiplier = CONFIG.sweetspot.sourKnockbackMultiplier;
    state.lastSourspot = true;
  }

  // ダメージ計算（溜め攻撃対応）
  let baseDamage = attack.damage;
  if (attack.maxDamage && player.chargeAmount > 0) {
    baseDamage = attack.damage + (attack.maxDamage - attack.damage) * player.chargeAmount;
  }

  // 各種補正を適用
  const staleMultiplier = getStaleMultiplier(player.attackType);
  const comboBonus = getComboBonus();

  const finalDamage = baseDamage * staleMultiplier * comboBonus * justFrameBonus * counterHitBonus * sweetspotDamageMultiplier;
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

  // ノックバック計算（溜め攻撃対応 + スイートスポット）
  const chargeMultiplier = attack.chargeTime ? player.chargeAmount : 0;
  let knockback = calculateKnockback(attack, state.damage, chargeMultiplier);
  knockback *= sweetspotKBMultiplier;

  // 角度の計算（度からラジアン）
  let baseAngle = attack.angle;

  // 角度調整（攻撃時の方向入力）
  if (attack.canAngle) {
    if (input.up) {
      baseAngle += CONFIG.angleInfluence.up;
    } else if (input.down) {
      baseAngle += CONFIG.angleInfluence.down;
    }
  }

  let angle = baseAngle * Math.PI / 180;

  // サワースポットで当てると自分から離れる方向に飛ぶ（下強など）
  if (attack.sendAwayOnSourspot && hitType === 'sourspot') {
    // 方向を反転させる
    direction = -direction;
  }

  // 空中での攻撃は角度が変わる
  if (!player.grounded && !attack.isMeteor) {
    angle += 0.05; // やや上向きに
  }

  // ノックバックベクトル（物理エンジン用にスケーリング）
  // ノックバック値を物理エンジンが扱える範囲にスケーリング
  // 高%でより飛ぶように、平方根ではなく線形スケーリングを使用
  const physicsScale = 0.20;  // 物理エンジン用スケール係数（1000m到達用）
  const scaledKnockback = knockback * physicsScale;

  console.log(`[KB Debug] Final knockback=${knockback.toFixed(1)}, scaledForPhysics=${scaledKnockback.toFixed(1)}`);

  const kbX = Math.cos(angle) * scaledKnockback * direction;
  const kbY = Math.sin(angle) * scaledKnockback;

  // ヒットストップ（スイートスポットで増加）
  let hitstopTime = attack.hitstop;
  if (state.lastCounterHit) {
    hitstopTime *= CONFIG.combo.counterHit.hitstunMultiplier;
  }
  if (state.lastSweetspot) {
    hitstopTime *= 1.3;  // スイートスポットでヒットストップ増加
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
    state.slowMotion = 0.8;
    state.slowMotionScale = 0.2;
  }

  // エフェクト（hitTypeを渡す）
  createHitEffect(sandbag.getPosition(), knockback, state.lastJustFrame, state.lastCounterHit, player.attackType === 'bat', hitType);

  // ヒット音を再生
  playHitSound(knockback, hitType, player.attackType === 'bat');

  // コンボ音を再生
  playComboSound(state.combo);

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

  // 時間切れ保留中なら flying フェーズへ移行
  if (state.timeUpPending && !state.launched) {
    state.launched = true;
    state.phase = 'flying';
    state.flyingTime = 0;
    distanceEl.classList.remove('hidden');
    state.timeUpPending = false;
  }

  setTimeout(() => { player.canAttack = true; }, 30);
}

// ============================================
// Hit Effects (Enhanced)
// ============================================
const hitEffects = [];

function createHitEffect(pos, knockback, isJustFrame, isCounterHit, isBatHit = false, hitType = 'normal') {
  const effect = {
    x: pos.x,
    y: pos.y,
    life: isBatHit ? 1.0 : 0.4,
    maxLife: isBatHit ? 1.0 : 0.4,
    knockback: knockback,
    justFrame: isJustFrame,
    counterHit: isCounterHit,
    batHit: isBatHit,
    hitType: hitType  // 'normal', 'sweetspot', 'sourspot'
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

// Player Movement (Enhanced with Short Hop, Pivot, RAR)
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
    player.running = false;

    // 着地硬直（オートキャンセル判定）
    if (player.attacking) {
      const attack = CONFIG.attacks[player.attackType];
      let landLag = attack.landingLag;

      // オートキャンセル判定
      if (attack.autocancel) {
        const totalTime = player.attackTotalTime;
        if (totalTime < attack.autocancel.early || totalTime > attack.autocancel.late) {
          landLag = 0.067;  // オートキャンセル成功：4F
        }
      }

      player.landingLag = landLag;
      endAttack();
    }
  }

  // 着地硬直の更新
  if (player.landingLag > 0) {
    player.landingLag -= dt;
    playerBody.setLinearVelocity(Vec2(0, vel.y));
    return;
  }

  // ピボット/ターンアラウンドタイマー更新
  if (player.pivotTimer > 0) {
    player.pivotTimer -= dt;
  }
  if (player.turnaroundTimer > 0) {
    player.turnaroundTimer -= dt;
  }

  // ショートホップ判定
  if (player.jumpHeld) {
    player.jumpHeldTime += dt;
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

  // 移動処理
  const speedMult = player.attacking ? 0.3 : 1;
  let targetVelX = 0;
  let currentMoveDir = 0;

  if (input.left) currentMoveDir = -1;
  if (input.right) currentMoveDir = 1;

  if (player.grounded) {
    // 地上移動
    // ピボット判定（方向転換）
    if (currentMoveDir !== 0 && player.lastMoveDir !== 0 && currentMoveDir !== player.lastMoveDir) {
      player.pivotTimer = CONFIG.player.pivotWindow;
      player.wantsTurnaround = true;
    }

    if (currentMoveDir !== 0) {
      // ダッシュ判定
      if (Math.abs(vel.x) > CONFIG.player.speed * 0.8) {
        player.running = true;
      }

      const speed = player.running ? CONFIG.player.runSpeed : CONFIG.player.speed;
      targetVelX = currentMoveDir * speed * speedMult;

      if (!player.attacking) {
        player.facingRight = currentMoveDir > 0;
      }
    } else {
      // 停止
      player.running = false;
    }

    player.lastMoveDir = currentMoveDir;
  } else {
    // 空中移動（空中制御）
    if (currentMoveDir !== 0) {
      targetVelX = currentMoveDir * CONFIG.player.airSpeed;

      // RAR (Reverse Aerial Rush) - 空中で反対方向を入力すると振り向く
      if (!player.attacking) {
        const wantsFacing = currentMoveDir > 0;
        if (wantsFacing !== player.facingRight) {
          player.turnaroundTimer = 0.1;  // 振り向き猶予
          player.facingRight = wantsFacing;
        }
      }
    }

    // 空中では現在の速度を維持しつつ入力で調整
    targetVelX = vel.x * 0.95 + targetVelX * 0.3;
  }

  playerBody.setLinearVelocity(Vec2(targetVelX, vel.y));

  // ジャンプ処理
  if (input.jumpPressed) {
    const canJumpCancel = player.attacking && player.cancelWindow &&
      CONFIG.attacks[player.attackType]?.cancelable.includes('jump');

    if ((player.jumpsLeft > 0 && !player.attacking) || canJumpCancel) {
      if (canJumpCancel) {
        endAttack();
      }

      // ジャンプボタンを押した瞬間
      player.jumpHeld = true;
      player.jumpHeldTime = 0;
      input.jumpPressed = false;
    }
  }

  // ジャンプ実行（ボタンを離したときor長押し時）
  if (player.jumpHeld && player.jumpsLeft > 0) {
    if (input.jumpReleased || player.jumpHeldTime >= player.shortHopWindow) {
      // ショートホップ or フルホップ判定
      const isShortHop = player.jumpHeldTime < player.shortHopWindow && input.jumpReleased;
      const jumpForce = isShortHop ? CONFIG.player.shortHopForce : CONFIG.player.jumpForce;

      playerBody.setLinearVelocity(Vec2(vel.x, jumpForce));
      player.jumpsLeft--;
      player.jumpHeld = false;
      player.jumpHeldTime = 0;
      input.jumpReleased = false;

      // 空中ジャンプ時は向きを変えられる
      if (!player.grounded && currentMoveDir !== 0) {
        player.facingRight = currentMoveDir > 0;
      }
    }
  } else if (!player.jumpHeld) {
    // ジャンプボタンを押していない時はreleased flagをクリア
    input.jumpReleased = false;
  }

  // 境界
  if (pos.x < 3) playerBody.setPosition(Vec2(3, pos.y));
  if (pos.x > 13) playerBody.setPosition(Vec2(13, pos.y));
}

// Sandbag Update (Enhanced)
function updateSandbag(dt) {
  // バラバラフェーズの処理（sandbagがなくても実行）
  if (state.dismembered) {
    updateBodyParts(dt);

    // 全パーツが停止したら終了
    let allSettled = true;
    for (const part of bodyParts) {
      const vel = part.body.getLinearVelocity();
      const pos = part.body.getPosition();
      if (vel.length() > 0.3 || pos.y > 3) {
        allSettled = false;
        break;
      }
    }

    // 5秒経過または全パーツ停止で終了
    const dismemberTime = (state.flyingTime || 0);
    if ((allSettled && dismemberTime > 2) || dismemberTime > 20) {
      showResult();
    }
    return;
  }

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
  if (state.phase === 'flying' && !state.dismembered) {
    const pos = sandbag.getPosition();
    state.distance = pos.x - sandbag.startX;
    // maxDistanceを更新（プラス > マイナス。同じ符号なら絶対値で比較）
    if (state.maxDistance === null) {
      state.maxDistance = state.distance;
    } else if (state.distance >= 0 && state.maxDistance < 0) {
      state.maxDistance = state.distance;
    } else if (state.distance < 0 && state.maxDistance >= 0) {
      // プラスのままキープ
    } else {
      // 同じ符号なら絶対値で比較
      if (Math.abs(state.distance) > Math.abs(state.maxDistance)) {
        state.maxDistance = state.distance;
      }
    }

    const vel = sandbag.getLinearVelocity();
    const speed = vel.length();
    const flyingTime = state.flyingTime || 0;

    // 地面に着いたらバラバラになる！
    if (pos.y < 3.2 && vel.y < -5) {
      // インパクト！バラバラに！
      dismemberSandbag();
      return;
    }

    // サンドバッグがほぼ静止している場合（スタートエリアで止まっている等）
    // 破裂せずに直接結果画面へ
    if (speed < 1 && pos.y < 5 && flyingTime > 2) {
      showResult();
      return;
    }

    // タイムアウト
    const timeout = flyingTime > 15;
    if (timeout) {
      dismemberSandbag();
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
  let cameraY = 0;

  // バラバラフェーズでは一番遠いパーツを追跡
  if (state.phase === 'flying') {
    let pos = null;
    if (state.dismembered && state.farthestPart) {
      pos = state.farthestPart.body.getPosition();
    } else if (sandbag) {
      pos = sandbag.getPosition();
    }

    if (pos) {
      // X方向：サンドバッグを画面左側に配置
      const targetCameraX = (pos.x - 10) * CONFIG.physics.scale;

      // Y方向：サンドバッグを画面中央付近に
      // 画面高さの中央をメートル単位で計算
      const screenCenterY = CONFIG.canvas.height / 2 / CONFIG.physics.scale;
      // 地面より下にカメラが行かないように制限（cameraY >= 0）
      const targetCameraY = Math.max(0, (pos.y - screenCenterY) * CONFIG.physics.scale);

      // Lerpで滑らかに追従
      // 落下時（カメラが下に移動する時）は追従を速くする
      const lerpFactorY = targetCameraY < state.cameraY ? 0.25 : 0.1;
      cameraX = lerp(state.cameraX, targetCameraX, 0.1);
      cameraY = lerp(state.cameraY, targetCameraY, lerpFactorY);

      state.cameraX = cameraX;
      state.cameraY = cameraY;
    }
  } else {
    // flying以外のフェーズではカメラをリセット
    state.cameraX = 0;
    state.cameraY = 0;
  }

  ctx.save();
  // Y方向は符号注意：カメラYが正（上に移動）の時、ctx.translateは正の値
  ctx.translate(-cameraX, cameraY);

  // ヒットストップ中は画面を少し揺らす
  if (state.hitstop > 0) {
    const shake = (Math.random() - 0.5) * 8;
    ctx.translate(shake, shake);
  }

  // バラバラになった瞬間の画面揺れ
  if (state.screenShake && state.screenShake > 0) {
    const shake = (Math.random() - 0.5) * state.screenShake * 30;
    ctx.translate(shake, shake);
    state.screenShake -= 0.02;
  }

  drawBackground(cameraX, cameraY);
  drawDistanceMarkers(cameraX);
  drawPlatform();
  drawBarrier();

  // バラバラでなければサンドバッグを描画
  if (!state.dismembered) {
    drawSandbag();
  } else {
    // バラバラの体パーツを描画
    drawBodyParts();
  }

  drawPlayer();
  drawAttackHitbox();
  drawHitEffects();

  ctx.restore();

  // UI要素
  drawComboInfo();
  drawRageIndicator();
}

function drawBackground(cameraX, cameraY = 0) {
  // 現在の距離を取得（flyingフェーズでなければ0）
  const distance = state.phase === 'flying' ? state.distance : 0;

  // 距離に応じたテーマを取得
  const theme = getBackgroundTheme(distance);

  // 空のグラデーション（画面全体を覆うように）
  const gradient = ctx.createLinearGradient(0, -cameraY, 0, CONFIG.canvas.height - cameraY);
  gradient.addColorStop(0, theme.sky.top);
  gradient.addColorStop(0.5, theme.sky.middle);
  gradient.addColorStop(1, theme.sky.bottom);
  ctx.fillStyle = gradient;
  // 背景は画面全体を覆う（cameraYの分も考慮して十分大きく描画）
  ctx.fillRect(cameraX, -cameraY, CONFIG.canvas.width, CONFIG.canvas.height + cameraY + 100);

  const groundY = CONFIG.canvas.height - CONFIG.physics.scale;

  // 背景要素を描画
  drawBackgroundElements(cameraX, theme.elements, distance, groundY, cameraY);

  // 地面を描画（地面がある場合のみ）
  if (theme.ground) {
    ctx.fillStyle = theme.ground;
    // 地面も十分に広く描画
    ctx.fillRect(cameraX, groundY, CONFIG.canvas.width, CONFIG.physics.scale + cameraY + 100);
  }
}

function drawDistanceMarkers(cameraX) {
  ctx.fillStyle = '#333';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';

  const startM = Math.floor(cameraX / CONFIG.physics.scale / 5) * 5;
  for (let m = startM; m < startM + 40; m += 5) {
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
  ctx.fillRect(pos.x - w / 2, pos.y - h / 2, w, h);
  ctx.fillStyle = '#A0522D';
  ctx.fillRect(pos.x - w / 2, pos.y - h / 2, w, h / 3);
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
    ctx.drawImage(sandbagImage, -w / 2, -h / 2, w, h);
  } else {
    ctx.fillStyle = '#FFD93D';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    ctx.strokeRect(-w / 2, -h / 2, w, h);

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
  ctx.fillText(`${Math.floor(state.damage)}%`, canvasPos.x, canvasPos.y - h / 2 - 20);
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

  const facingDir = player.facingRight ? 1 : -1;

  // 状態に応じて色を変える
  let bodyColor = '#4A90D9';
  let isAttackingBack = player.attacking && CONFIG.attacks[player.attackType]?.hitboxDir === 'back';

  if (player.charging && player.attackType === 'bat') {
    const glow = Math.floor(player.chargeAmount * 255);
    bodyColor = `rgb(${100 + glow}, ${50 + glow / 2}, ${50})`;
  } else if (isAttackingBack) {
    bodyColor = '#FF9933';  // 空後は特別なオレンジ色
  } else if (player.attacking) {
    bodyColor = player.attackPhase === 'active' ? '#FF3333' : '#FF6B6B';
  } else if (player.landingLag > 0) {
    bodyColor = '#666699';
  } else if (player.airDashing) {
    bodyColor = '#33CCFF';
  } else if (player.running) {
    bodyColor = '#5AA0E9';
  } else if (player.pivotTimer > 0) {
    bodyColor = '#FFAA33';
  }

  // 体（向きがわかるように斜めに）
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2);
  ctx.lineTo(w / 2 + facingDir * 5, -h / 2);  // 前側が少し出る
  ctx.lineTo(w / 2 + facingDir * 3, h / 2);
  ctx.lineTo(-w / 2 - facingDir * 3, h / 2);
  ctx.closePath();
  ctx.fill();

  // 背中側のマーク（後ろがわかるように）
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  const backX = -facingDir * (w / 2 - 5);
  ctx.fillRect(backX - 3, -h / 4, 6, h / 2);

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

  // 頭（向いている方向に少しずらす）
  const headX = facingDir * 3;
  ctx.fillStyle = '#FFCC99';
  ctx.beginPath();
  ctx.arc(headX, -h / 2 - 12, 12, 0, Math.PI * 2);
  ctx.fill();

  // 目（前を向いている方向）
  ctx.fillStyle = '#333';
  const eyeX = headX + facingDir * 5;
  ctx.beginPath();
  ctx.arc(eyeX, -h / 2 - 14, 3, 0, Math.PI * 2);
  ctx.fill();

  // 向きインジケーター（矢印）
  if (!player.attacking) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const arrowX = facingDir * (w / 2 + 8);
    ctx.moveTo(arrowX, 0);
    ctx.lineTo(arrowX + facingDir * 10, 0);
    ctx.lineTo(arrowX + facingDir * 5, -5);
    ctx.moveTo(arrowX + facingDir * 10, 0);
    ctx.lineTo(arrowX + facingDir * 5, 5);
    ctx.stroke();
  }

  // 攻撃中の腕とエフェクト
  if (player.attacking && player.attackPhase === 'active') {
    const attack = CONFIG.attacks[player.attackType];
    const armLength = attack.range * CONFIG.physics.scale * 0.5;
    const hitboxDir = attack.hitboxDir || 'forward';

    ctx.fillStyle = '#FFCC99';

    if (hitboxDir === 'up' || player.attackType === 'uair' || player.attackType === 'upSmash' || player.attackType === 'upperStrong') {
      // 上方向の攻撃
      ctx.fillRect(-5, -h / 2 - armLength, 10, armLength);
      ctx.beginPath();
      ctx.arc(0, -h / 2 - armLength, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (hitboxDir === 'down' || player.attackType === 'dair') {
      // 下方向の攻撃（メテオ）
      ctx.fillRect(-5, h / 2, 10, armLength);
      ctx.beginPath();
      ctx.arc(0, h / 2 + armLength, 10, 0, Math.PI * 2);
      ctx.fill();
      // メテオマーク
      ctx.fillStyle = '#FF6600';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('▼', 0, h / 2 + armLength + 5);
    } else if (hitboxDir === 'back') {
      // 空後！後ろに攻撃
      const backDir = -facingDir;
      ctx.save();

      // 後ろ向きの腕
      ctx.fillRect(backDir * w / 2, -10, backDir * armLength, 15);

      // 空後の足（キック）
      ctx.fillStyle = bodyColor;
      ctx.fillRect(backDir * w / 2, 5, backDir * (armLength * 0.8), 12);

      // 空後のインパクトエフェクト
      ctx.strokeStyle = '#FF9933';
      ctx.lineWidth = 4;
      const impactX = backDir * (w / 2 + armLength);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(impactX, 0, 15 + i * 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // "BAIR" テキスト
      ctx.fillStyle = '#FF9933';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('BAIR', impactX, -25);

      ctx.restore();
    } else if (hitboxDir === 'around') {
      // 周囲攻撃
      ctx.strokeStyle = 'rgba(255, 200, 100, 0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, armLength, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // 前方向の攻撃
      ctx.fillRect(facingDir * w / 2, -5, facingDir * armLength, 10);

      if (player.attackType === 'bat') {
        // バット
        ctx.fillStyle = '#8B4513';
        const batX = facingDir * (w / 2 + armLength - 5);
        ctx.fillRect(batX, -15, facingDir * 40, 12);

        // バットの先端（スイートスポット）
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(batX + facingDir * 30, -15, facingDir * 10, 12);
      } else {
        // 拳
        ctx.beginPath();
        ctx.arc(facingDir * (w / 2 + armLength), 0, 8, 0, Math.PI * 2);
        ctx.fill();
      }
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
      ctx.arc(canvasPos.x + offsetX, canvasPos.y, w / 2 + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // 向きテキスト表示（デバッグ用、常時表示）
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.font = '10px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(player.facingRight ? '→前' : '前←', canvasPos.x, canvasPos.y - h / 2 - 35);
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

      // ヒットタイプ/ジャストフレーム/カウンターヒットで色が変わる
      let color = '255, 200, 0';
      let lineWidth = 4;

      // スイートスポット/サワースポット
      if (effect.hitType === 'sweetspot') {
        color = '255, 100, 255';  // 紫（スイートスポット）
        lineWidth = 6;
      } else if (effect.hitType === 'sourspot') {
        color = '150, 150, 150';  // 灰色（サワースポット）
        lineWidth = 3;
      }

      // ジャストフレームとカウンターヒットは優先
      if (effect.justFrame) {
        color = '0, 255, 255';
      }
      if (effect.counterHit) {
        color = '255, 50, 50';
        lineWidth = 6;
      }

      ctx.strokeStyle = `rgba(${color}, ${alpha})`;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
      ctx.stroke();

      // インパクトライン
      const lineCount = effect.counterHit ? 12 : (effect.hitType === 'sweetspot' ? 10 : 8);
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
      let textY = pos.y - size - 10;
      if (effect.hitType === 'sweetspot' && effect.life > 0.25) {
        ctx.fillStyle = '#FF66FF';
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('SWEET!', pos.x, textY);
        textY -= 25;
      }
      if (effect.justFrame && effect.life > 0.25) {
        ctx.fillStyle = '#00FFFF';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('JUST!', pos.x, textY);
        textY -= 25;
      }
      if (effect.counterHit && effect.life > 0.25) {
        ctx.fillStyle = '#FF3333';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('COUNTER!', pos.x, textY);
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
    const displayDistance = state.maxDistance !== null ? state.maxDistance : 0;
    // バラバラの場合は一番遠くのパーツを表示
    if (state.dismembered && state.farthestPart && state.farthestPart.def) {
      distanceEl.textContent = `${state.farthestPart.def.name}: ${displayDistance.toFixed(2)}m`;
    } else {
      distanceEl.textContent = `Distance: ${displayDistance.toFixed(2)}m`;
    }
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
        if (player.charging) {
          // チャージ中なら移行を保留
          state.timeUpPending = true;
        } else {
          // チャージ中でなければflyingフェーズへ
          state.launched = true;
          state.phase = 'flying';
          state.flyingTime = 0;  // 飛行時間カウント開始
          distanceEl.classList.remove('hidden');
        }
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
      world.step(1 / 60, displayDt, 3);
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

  // プレイヤー名を表示
  updatePlayerNameDisplay();

  // 結果表示音を再生
  const distance = state.maxDistance !== null ? state.maxDistance : 0;
  playResultSound(distance);

  // 一番遠くのパーツの名前を表示
  let partName = '';
  if (state.farthestPart && state.farthestPart.def) {
    partName = state.farthestPart.def.name;
  }

  // 距離とパーツ名を表示
  if (partName) {
    finalDistanceEl.innerHTML = `<span style="color: #FF6B6B; font-size: 0.7em;">${partName}が</span><br>${distance.toFixed(2)}m<span style="color: #FF6B6B; font-size: 0.6em;"> 飛んだ！</span>`;
  } else {
    finalDistanceEl.textContent = `${distance.toFixed(2)}m`;
  }
  maxComboEl.textContent = `Max Combo: ${state.maxCombo}`;

  // ランキング登録モーダルを表示
  promptForRanking(distance, state.damage, state.maxCombo);

  // ベストスコア処理
  const bestScore = parseFloat(localStorage.getItem('homurun_best') || '0');
  // 新しい記録がプラスで旧記録がマイナス → 新記録
  // 両方プラス → 大きい方が新記録
  // 両方マイナス → 絶対値が大きい方が新記録
  // 新しい記録がマイナスで旧記録がプラス → 新記録ではない
  let isNewRecord = false;
  if (distance > 0 && bestScore <= 0) {
    isNewRecord = true;
  } else if (distance <= 0 && bestScore > 0) {
    isNewRecord = false;
  } else if (distance > 0) {
    isNewRecord = distance > bestScore;
  } else {
    isNewRecord = Math.abs(distance) > Math.abs(bestScore);
  }

  if (isNewRecord && distance !== 0) {
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
    recordEl.style.display = isNewRecord && distance !== 0 ? 'block' : 'none';
  }

  // 距離に応じた煽りメッセージ
  const ratingEl = document.getElementById('rating');
  if (ratingEl) {
    const tauntMessages = {
      negative: [
        "ボタンを押すたびにIQが下がってないか？右に飛ばすという猿でもできることができないなら、もう人間やめろ。",
        "どこ飛ばしてるんだよ。お前の実力は『下手』という言葉ですら生ぬるい。ただのゴミだ。"
      ],
      zero: [
        "おーい、最後。吹っ飛ばすの忘れてるぞ？操作方法すら覚えられないなら、もうゲーム機売ってこい。",
        "もしかして、ボタンの押し方も分からない赤ちゃんかな？早く哺乳瓶咥えて寝てろよ。"
      ],
      tier1: [ // 1m - 100m
        "バットが一番吹っ飛ばし力が高い。なぜ使わない？シンプルにアホなのか？",
        "操作方法ちゃんと見たか？バット使えと書いてるだろう。ったくこれだからZ世代は……"
      ],
      tier2: [ // 101m - 200m
        "弱い。脳みそ足りてるか？まだ哺乳瓶咥えてるんじゃないだろうな？",
        "今の、打ったんじゃなくて『置いた』だけだよね？バットが飾りだってことにいつ気づくんだ？"
      ],
      tier3: [ // 201m - 300m
        "その指、タイピング専用か？画面の向こうで寝てるなら、起きてから出直してこい。",
        "仕様通りに動かせないエンジニアかよ。お前の人生も一度デバッグしたほうがいいぞ。"
      ],
      tier4: [ // 301m - 449m
        "ふん、ようやくおむつが取れたようだな。バットの使い方が少しは分かってきたか？",
        "合格点だが、満足してんじゃねえぞ。お前の実力なんてAIの予備動作以下なんだからな。"
      ],
      tier5: [ // 450m以上
        "…チッ、使いこなしやがって。宇宙まで飛ばして満足か？次は現実の課題でも飛ばしてろ。",
        "認めたくないが、お前が最強だ。完璧すぎてムカつくわ。さっさと次のステージへ消えろ。"
      ]
    };

    let messages;
    let color = '#FF6B6B';
    if (distance < 0) {
      messages = tauntMessages.negative;
    } else if (distance === 0) {
      messages = tauntMessages.zero;
    } else if (distance <= 100) {
      messages = tauntMessages.tier1;
    } else if (distance <= 200) {
      messages = tauntMessages.tier2;
    } else if (distance <= 300) {
      messages = tauntMessages.tier3;
    } else if (distance <= 449) {
      messages = tauntMessages.tier4;
      color = '#FFD700';
    } else {
      messages = tauntMessages.tier5;
      color = '#00FF00';
    }

    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    ratingEl.textContent = randomMessage;
    ratingEl.style.color = color;
  }
}

// ============================================
// Ranking System (Firebase)
// ============================================

// Check if name input modal is open (to prevent key conflicts)
function isNameModalOpen() {
  return !nameInputModal.classList.contains('hidden');
}

// Show name input modal after game ends (only if no saved name)
function promptForRanking(distance, damage, maxCombo) {
  if (distance === 0) return;

  const savedName = localStorage.getItem('homurun_player_name');

  // 名前が保存されていれば自動登録
  if (savedName) {
    saveToRankingDirect(savedName, distance, damage, maxCombo);
    return;
  }

  // 初回のみモーダル表示
  pendingScore = {
    distance: parseFloat(distance.toFixed(2)),
    damage: Math.floor(damage),
    maxCombo: maxCombo
  };

  modalDistance.textContent = `${distance.toFixed(2)}m`;
  playerNameInput.value = '';
  nameInputModal.classList.remove('hidden');
  setTimeout(() => playerNameInput.focus(), 100);
}

// Direct save without modal (for auto-save)
async function saveToRankingDirect(playerName, distance, damage, maxCombo) {
  try {
    await addDoc(collection(db, "rankings"), {
      playerName: playerName || "名無し",
      distance: parseFloat(distance.toFixed(2)),
      damage: Math.floor(damage),
      maxCombo: maxCombo,
      userId: currentUserId,
      createdAt: serverTimestamp()
    });
    console.log("Score auto-saved");
  } catch (error) {
    console.error("Error saving score:", error);
  }
}

// Save score to Firebase (from modal)
async function saveToRanking(playerName) {
  const nameToSave = playerName || "名無し";

  // Remember player name
  localStorage.setItem('homurun_player_name', nameToSave);
  updatePlayerNameDisplay();

  // If we have a pending score, save it to Firebase
  if (pendingScore) {
    try {
      await addDoc(collection(db, "rankings"), {
        playerName: nameToSave,
        distance: pendingScore.distance,
        damage: pendingScore.damage,
        maxCombo: pendingScore.maxCombo,
        userId: currentUserId,
        createdAt: serverTimestamp()
      });
      console.log("Score saved");
    } catch (error) {
      console.error("Error saving score:", error);
    }
  }

  pendingScore = null;
  nameInputModal.classList.add('hidden');
}

// Submit name and save
function submitName() {
  const name = playerNameInput.value.trim();
  saveToRanking(name);
}

// Skip name input (save as 名無し)
function skipName() {
  saveToRanking("名無し");
}

// Change name (from result screen)
function showChangeNameModal() {
  pendingScore = null; // Don't save to ranking, just change name
  modalDistance.textContent = '名前変更';
  playerNameInput.value = localStorage.getItem('homurun_player_name') || '';
  nameInputModal.classList.remove('hidden');
  setTimeout(() => playerNameInput.focus(), 100);
}

// Update displayed player name
function updatePlayerNameDisplay() {
  const name = localStorage.getItem('homurun_player_name') || '名無し';
  if (currentPlayerNameEl) {
    currentPlayerNameEl.textContent = name;
  }
}

// Real-time ranking listener
let unsubscribeRanking = null;
let unsubscribeMinusRanking = null;

function showRanking() {
  rankingList.innerHTML = '<div class="loading">読み込み中</div>';
  minusRankingList.innerHTML = '<div class="loading">読み込み中</div>';
  rankingScreen.classList.remove('hidden');

  // Set up real-time listener for positive rankings
  const q = query(
    collection(db, "rankings"),
    orderBy("distance", "desc"),
    limit(10)
  );

  unsubscribeRanking = onSnapshot(q, (snapshot) => {
    rankingList.innerHTML = '';

    if (snapshot.empty) {
      rankingList.innerHTML = '<div class="no-records">記録がありません</div>';
      return;
    }

    snapshot.docs.forEach((doc, index) => {
      const record = doc.data();
      const item = document.createElement('div');
      item.className = 'ranking-item';
      if (index === 0) item.classList.add('gold');
      else if (index === 1) item.classList.add('silver');
      else if (index === 2) item.classList.add('bronze');

      // Highlight own scores
      if (record.userId === currentUserId) {
        item.style.borderLeft = '3px solid #4a90d9';
      }

      let dateStr = '-';
      if (record.createdAt) {
        const date = record.createdAt.toDate();
        dateStr = `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
      }

      item.innerHTML = `
                <div class="rank-number">${index + 1}</div>
                <div class="rank-info">
                    <div class="rank-name">${escapeHtml(record.playerName || '名無し')}</div>
                    <div class="rank-distance">${record.distance.toFixed(2)}m</div>
                    <div class="rank-details">${record.damage}% | ${record.maxCombo} Combo</div>
                </div>
                <div class="rank-date">${dateStr}</div>
            `;
      rankingList.appendChild(item);
    });
  }, (error) => {
    console.error("Error fetching rankings:", error);
    rankingList.innerHTML = '<div class="no-records">エラーが発生しました</div>';
  });

  // Set up real-time listener for minus rankings (negative distances)
  const minusQuery = query(
    collection(db, "rankings"),
    orderBy("distance", "asc"),
    limit(10)
  );

  const minusRankIcons = ['🏴', '🟤', '🟣'];
  const minusRankClasses = ['minus-first', 'minus-second', 'minus-third'];

  unsubscribeMinusRanking = onSnapshot(minusQuery, (snapshot) => {
    minusRankingList.innerHTML = '';

    // Filter for negative distances only
    const minusRecords = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(record => record.distance < 0)
      .slice(0, 3);

    if (minusRecords.length === 0) {
      minusRankingList.innerHTML = '<div class="no-records">まだ誰も後ろに飛んでいません...</div>';
      return;
    }

    minusRecords.forEach((record, index) => {
      const item = document.createElement('div');
      item.className = 'ranking-item ' + minusRankClasses[index];

      // Highlight own scores
      if (record.userId === currentUserId) {
        item.style.borderLeft = '3px solid #ff6b6b';
      }

      let dateStr = '-';
      if (record.createdAt) {
        const date = record.createdAt.toDate();
        dateStr = `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
      }

      item.innerHTML = `
                <div class="rank-number">${minusRankIcons[index]}</div>
                <div class="rank-info">
                    <div class="rank-name">${escapeHtml(record.playerName || '名無し')}</div>
                    <div class="rank-distance minus">${record.distance.toFixed(2)}m</div>
                    <div class="rank-details">${record.damage}% | ${record.maxCombo} Combo</div>
                </div>
                <div class="rank-date">${dateStr}</div>
            `;
      minusRankingList.appendChild(item);
    });
  }, (error) => {
    console.error("Error fetching minus rankings:", error);
    minusRankingList.innerHTML = '<div class="no-records">エラーが発生しました</div>';
  });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function hideRanking() {
  if (unsubscribeRanking) {
    unsubscribeRanking();
    unsubscribeRanking = null;
  }
  if (unsubscribeMinusRanking) {
    unsubscribeMinusRanking();
    unsubscribeMinusRanking = null;
  }
  rankingScreen.classList.add('hidden');
}

// Start/Reset
function startGame() {
  // オーディオを初期化（ユーザーインタラクション後に呼び出す必要がある）
  initAudio();

  state.phase = 'countdown';  // カウントダウンフェーズから開始
  state.timer = CONFIG.game.timeLimit;
  state.damage = 0;
  state.playerDamage = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.comboTimer = 0;
  state.distance = 0;
  state.maxDistance = null;
  state.launched = false;
  state.timeUpPending = false;
  state.hitstop = 0;
  state.slowMotion = 0;
  state.slowMotionScale = 1;
  state.flyingTime = 0;
  state.staleQueue = [];
  state.lastJustFrame = false;
  state.lastCounterHit = false;
  state.lastSweetspot = false;
  state.lastSourspot = false;
  state.totalDamageDealt = 0;
  state.comboProration = 1.0;
  state.dismembered = false;
  state.farthestPart = null;
  state.screenShake = 0;

  // バラバラのパーツをクリア
  for (const part of bodyParts) {
    if (part.body) {
      world.destroyBody(part.body);
    }
  }
  bodyParts = [];
  bloodEffects = [];
  bloodPools = [];

  player.attacking = false;
  player.canAttack = true;
  player.charging = false;
  player.chargeAmount = 0;
  player.airDashing = false;
  player.canAirDash = true;
  player.landingLag = 0;
  player.cancelWindow = false;
  player.running = false;
  player.runTimer = 0;
  player.pivotTimer = 0;
  player.lastMoveDir = 0;
  player.jumpHeld = false;
  player.jumpHeldTime = 0;
  player.turnaroundTimer = 0;
  player.wantsTurnaround = false;
  player.attackTotalTime = 0;

  startScreen.classList.add('hidden');
  resultScreen.classList.add('hidden');
  distanceEl.classList.add('hidden');
  chargeBar.classList.add('hidden');

  if (sandbag) world.destroyBody(sandbag);
  if (playerBody) world.destroyBody(playerBody);
  createSandbag(8, 5);
  createPlayer(5, 5);

  updateUI();

  // カウントダウン開始
  startCountdown();
}

// カウントダウン処理
function startCountdown() {
  const overlay = document.getElementById('countdown-overlay');
  const text = document.getElementById('countdown-text');
  overlay.classList.remove('hidden');

  let count = 2;
  text.textContent = count;
  // アニメーションをリセットするためにクラスを再適用
  text.style.animation = 'none';
  text.offsetHeight; // reflow
  text.style.animation = '';
  playCountdownSound(count);

  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      text.textContent = count;
      text.style.animation = 'none';
      text.offsetHeight;
      text.style.animation = '';
      playCountdownSound(count);
    } else if (count === 0) {
      text.textContent = 'GO!';
      text.style.animation = 'none';
      text.offsetHeight;
      text.style.animation = '';
      playGoSound();
      clearInterval(interval);
      // GOの後は短い待ち時間でゲーム開始
      setTimeout(() => {
        overlay.classList.add('hidden');
        state.phase = 'playing';
      }, 400);
    }
  }, 1000);
}

function resetGame() {
  // RETRYは直接ゲームを再開
  rankingScreen.classList.add('hidden');
  startGame();
}

// Rキーでスタート画面に戻る
function returnToStart() {
  state.phase = 'start';
  startScreen.classList.remove('hidden');
  resultScreen.classList.add('hidden');
  rankingScreen.classList.add('hidden');
  distanceEl.classList.add('hidden');
  chargeBar.classList.add('hidden');
}

// Input Handling (Enhanced)
document.addEventListener('keydown', (e) => {
  if (e.repeat) return;

  // モーダルが開いている間はゲーム操作を無効化
  if (isNameModalOpen()) return;

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
      else if (state.phase === 'result' || !rankingScreen.classList.contains('hidden')) resetGame();
      break;
    case 'KeyR':
      // どの画面からでもスタート画面に戻る
      returnToStart();
      break;
  }
});

document.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'KeyA': case 'ArrowLeft': input.left = false; break;
    case 'KeyD': case 'ArrowRight': input.right = false; break;
    case 'KeyW': case 'ArrowUp': input.up = false; break;
    case 'KeyS': case 'ArrowDown': input.down = false; break;
    case 'Space':
      input.jump = false;
      input.jumpReleased = true;  // ショートホップ判定用
      break;
    case 'KeyJ': input.weak = false; break;
    case 'KeyK': input.strong = false; break;
    case 'KeyL': releaseSmash(); break;
    case 'KeyB': releaseSmash(); break;
    case 'ShiftLeft': case 'ShiftRight': input.airDash = false; break;
  }
});

// Buttons
startBtn.addEventListener('click', startGame);
retryBtn.addEventListener('click', resetGame);
rankingBtn.addEventListener('click', showRanking);
startRankingBtn.addEventListener('click', showRanking);
closeRankingBtn.addEventListener('click', hideRanking);
submitNameBtn.addEventListener('click', submitName);
skipNameBtn.addEventListener('click', skipName);
changeNameBtn.addEventListener('click', showChangeNameModal);
playerNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    submitName();
  }
});

// Initialize
function init() {
  loadImages();
  initPhysics();
  requestAnimationFrame(gameLoop);
}

init();
