// Canvas and Context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
const gameState = {
    currentState: 'title', // title, menu, customize, playing, paused, gameOver
    currentLevel: 1,
    playerConfig: {
        name: 'Player',
        color: '#FF6B6B',
        size: 'normal'
    },
    lives: 3,
    coins: 0,
    unlockedLevels: 1
};

// Load unlocked levels from localStorage
function loadGameProgress() {
    const saved = localStorage.getItem('platformerUnlockedLevels');
    if (saved) {
        gameState.unlockedLevels = parseInt(saved);
    }
}

// Save unlocked levels to localStorage
function saveGameProgress() {
    localStorage.setItem('platformerUnlockedLevels', gameState.unlockedLevels);
}

// Game constants
const GRAVITY = 0.6;
const GROUND_FRICTION = 0.85;
const AIR_FRICTION = 0.95;
const MAX_FALL_SPEED = 15;
const JUMP_POWER = 16;

// Player class
class Player {
    constructor(x, y, config) {
        this.x = x;
        this.y = y;
        this.config = config;
        
        // Size settings
        const sizes = { small: { w: 20, h: 25 }, normal: { w: 25, h: 35 }, large: { w: 35, h: 45 } };
        const size = sizes[config.size] || sizes.normal;
        
        this.width = size.w;
        this.height = size.h;
        this.velocityX = 0;
        this.velocityY = 0;
        this.isJumping = false;
        this.isGrounded = false;
        this.direction = 1; // 1 for right, -1 for left
        this.invulnerable = false; // Prevent multiple hits in same frame
        this.currentPlatform = null; // Track which platform player is on
    }

    update(platforms, enemies, obstacles, coins) {
        // Apply gravity
        this.velocityY += GRAVITY;
        if (this.velocityY > MAX_FALL_SPEED) this.velocityY = MAX_FALL_SPEED;

        // Apply friction
        this.velocityX *= this.isGrounded ? GROUND_FRICTION : AIR_FRICTION;

        // Update position
        this.x += this.velocityX;
        this.y += this.velocityY;

        this.isGrounded = false;

        // Platform collision
        platforms.forEach(platform => {
            // Skip invisible platforms
            if (platform.type === 'disappearing' && !platform.visible) return;
            
            if (this.collidesWith(platform)) {
                if (this.velocityY > 0) {
                    this.y = platform.y - this.height;
                    this.velocityY = 0;
                    this.isGrounded = true;
                    this.isJumping = false;
                    this.currentPlatform = platform; // Track current platform
                } else if (this.velocityY < 0) {
                    this.y = platform.y + platform.height;
                    this.velocityY = 0;
                }
            }
        });

        // Apply moving platform movement to player
        if (this.isGrounded && this.currentPlatform && this.currentPlatform.type === 'moving') {
            const platformDelta = this.currentPlatform.x - this.currentPlatform.prevX;
            this.x += platformDelta; // Move player with platform
        } else if (!this.isGrounded) {
            this.currentPlatform = null; // Clear platform reference when in air
        }

        // Enemy collision
        enemies.forEach(enemy => {
            if (this.collidesWith(enemy)) {
                if (this.velocityY > 0 && this.y + this.height - this.velocityY <= enemy.y + 10) {
                    // Jump on enemy
                    this.velocityY = -JUMP_POWER;
                    this.isJumping = true;
                    enemy.kill();
                } else {
                    // Hit by enemy
                    this.takeDamage();
                }
            }
        });

        // Obstacle collision
        obstacles.forEach(obstacle => {
            if (this.collidesWith(obstacle)) {
                this.takeDamage();
            }
        });

        // Coin collection
        for (let i = coins.length - 1; i >= 0; i--) {
            if (this.collidesWith(coins[i])) {
                gameState.coins++;
                coins.splice(i, 1);
            }
        }

        // Boundary check - fall off screen
        if (this.y > canvas.height) {
            this.takeDamage();
        }
    }

    collidesWith(obj) {
        return this.x < obj.x + obj.width &&
               this.x + this.width > obj.x &&
               this.y < obj.y + obj.height &&
               this.y + this.height > obj.y;
    }

    jump() {
        if (this.isGrounded) {
            this.velocityY = -JUMP_POWER;
            this.isJumping = true;
            this.isGrounded = false;
        }
    }

    moveLeft() {
        this.velocityX = -7;
        this.direction = -1;
    }

    moveRight() {
        this.velocityX = 7;
        this.direction = 1;
    }

    takeDamage() {
        if (this.invulnerable) return; // Prevent multiple hits in same frame
        this.invulnerable = true;
        gameState.lives--;
        if (gameState.lives <= 0) {
            gameState.currentState = 'gameOver';
        } else {
            currentLevel.resetPlayer();
        }
    }

    draw(ctx) {
        // Body
        ctx.fillStyle = this.config.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Eyes
        ctx.fillStyle = 'white';
        const eyeY = this.y + this.height * 0.3;
        ctx.fillRect(this.x + 5, eyeY, 4, 4);
        ctx.fillRect(this.x + this.width - 9, eyeY, 4, 4);

        // Pupils
        ctx.fillStyle = 'black';
        const pupilOffset = this.direction === 1 ? 2 : 1;
        ctx.fillRect(this.x + 5 + pupilOffset, eyeY + 1, 2, 2);
        ctx.fillRect(this.x + this.width - 9 + pupilOffset, eyeY + 1, 2, 2);
    }
}

// Platform class
class Platform {
    constructor(x, y, width, height, type = 'normal') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type; // normal, moving, disappearing
        this.time = 0;
        this.originalX = x;
        this.originalY = y;
        this.prevX = x; // Track previous x for delta calculation
        this.moveRange = 50;
        this.moveSpeed = 2;
        this.visible = true;
        this.disappearTime = 0;
        this.disappearDuration = 120;
    }

    update() {
        this.prevX = this.x; // Store previous x before updating
        
        if (this.type === 'moving') {
            this.time++;
            this.x = this.originalX + Math.sin(this.time * 0.03) * this.moveRange;
        } else if (this.type === 'disappearing') {
            this.disappearTime++;
            if (this.disappearTime > this.disappearDuration) {
                this.visible = !this.visible;
                this.disappearTime = 0;
            }
        }
    }

    draw(ctx) {
        if (this.type === 'disappearing' && !this.visible) return;

        // Keep ground green, make other platforms brown
        const isGround = this.y === 550 && this.height === 50;
        
        if (isGround) {
            ctx.fillStyle = '#228B22'; // Forest green for ground
            ctx.strokeStyle = '#1a6b1a'; // Dark green border
        } else {
            ctx.fillStyle = this.type === 'moving' ? '#CD853F' : '#8B4513'; // Brown tones
            ctx.strokeStyle = '#654321'; // Dark brown border
        }
        
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Border
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
    }
}

// Enemy classes
class Walker {
    constructor(x, y, width = 25, height = 25) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.velocityX = -3;
        this.minX = x - 100;
        this.maxX = x + 100;
        this.alive = true;
    }

    update() {
        this.x += this.velocityX;
        if (this.x < this.minX || this.x > this.maxX) {
            this.velocityX *= -1;
        }
    }

    kill() {
        this.alive = false;
    }

    draw(ctx) {
        if (!this.alive) return;
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Eyes
        ctx.fillStyle = 'white';
        ctx.fillRect(this.x + 5, this.y + 5, 5, 5);
        ctx.fillRect(this.x + 15, this.y + 5, 5, 5);
    }
}

class Flyer {
    constructor(x, y, width = 25, height = 20) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.velocityX = -2;
        this.velocityY = 0;
        this.time = 0;
        this.minX = x - 150;
        this.maxX = x + 150;
        this.minY = y - 50;
        this.maxY = y + 50;
        this.alive = true;
    }

    update() {
        this.time++;
        this.x += this.velocityX;
        this.y += Math.sin(this.time * 0.05) * 0.5;

        if (this.x < this.minX || this.x > this.maxX) {
            this.velocityX *= -1;
        }

        this.y = Math.max(this.minY, Math.min(this.maxY, this.y));
    }

    kill() {
        this.alive = false;
    }

    draw(ctx) {
        if (!this.alive) return;
        ctx.fillStyle = '#FF69B4';
        ctx.beginPath();
        ctx.ellipse(this.x + 12.5, this.y + 10, 12.5, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Wings
        ctx.fillStyle = '#FF1493';
        ctx.beginPath();
        ctx.ellipse(this.x - 5, this.y + 10, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(this.x + 30, this.y + 10, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Obstacle classes
class Spike {
    constructor(x, y, width = 30, height = 30) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    draw(ctx) {
        ctx.fillStyle = '#FF4444';
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y);
        ctx.lineTo(this.x + this.width, this.y + this.height);
        ctx.lineTo(this.x, this.y + this.height);
        ctx.closePath();
        ctx.fill();
    }
}

class Lava {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.time = 0;
    }

    update() {
        this.time++;
    }

    draw(ctx) {
        ctx.fillStyle = '#FF6600';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Animated surface
        ctx.fillStyle = 'rgba(255, 100, 0, 0.5)';
        for (let i = 0; i < this.width; i += 20) {
            ctx.fillRect(this.x + i, this.y + Math.sin(this.time * 0.05 + i * 0.05) * 3, 15, 5);
        }
    }
}

// Coin class
class Coin {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 15;
        this.height = 15;
        this.time = 0;
    }

    update() {
        this.time++;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x + 7.5, this.y + 7.5);
        ctx.rotate(this.time * 0.05);
        
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#FFA500';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }
}

// Goal class
class Goal {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 40;
        this.time = 0;
    }

    update() {
        this.time++;
    }

    collidesWith(player) {
        return player.x < this.x + this.width &&
               player.x + player.width > this.x &&
               player.y < this.y + this.height &&
               player.y + player.height > this.y;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x + 20, this.y + 20);
        ctx.rotate(this.time * 0.05);

        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
            const x = Math.cos(angle) * 20;
            const y = Math.sin(angle) * 20;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#FFA500';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }
}

// Level class
class Level {
    constructor(levelNumber, levelData) {
        this.levelNumber = levelNumber;
        this.levelData = levelData;
        this.player = new Player(100, 500, gameState.playerConfig);
        this.platforms = [];
        this.enemies = [];
        this.obstacles = [];
        this.coins = [];
        this.goal = null;
        this.scrollOffsetX = 0;
        this.scrollOffsetY = 0;
        this.levelWidth = 2000;
        this.levelHeight = 600;
        
        this.loadLevel();
    }

    loadLevel() {
        const data = this.levelData;

        // Create platforms
        data.platforms.forEach(p => {
            this.platforms.push(new Platform(p.x, p.y, p.width, p.height, p.type || 'normal'));
        });

        // Create enemies
        data.enemies.forEach(e => {
            if (e.type === 'walker') {
                this.enemies.push(new Walker(e.x, e.y, e.width, e.height));
            } else if (e.type === 'flyer') {
                this.enemies.push(new Flyer(e.x, e.y, e.width, e.height));
            }
        });

        // Create obstacles
        data.obstacles.forEach(o => {
            if (o.type === 'spike') {
                this.obstacles.push(new Spike(o.x, o.y, o.width, o.height));
            } else if (o.type === 'lava') {
                this.obstacles.push(new Lava(o.x, o.y, o.width, o.height));
            }
        });

        // Create coins
        data.coins.forEach(c => {
            this.coins.push(new Coin(c.x, c.y));
        });

        // Create goal
        this.goal = new Goal(data.goal.x, data.goal.y);
    }

    resetPlayer() {
        this.player = new Player(100, 500, gameState.playerConfig);
    }

    update() {
        // Update entities
        this.platforms.forEach(p => p.update());
        this.enemies.forEach(e => e.update());
        this.obstacles.forEach(o => o.update?.());
        this.coins.forEach(c => c.update());
        this.goal.update();

        // Update player
        this.player.update(this.platforms, this.enemies, this.obstacles, this.coins);
        
        // Remove dead enemies after collision handling
        this.enemies = this.enemies.filter(e => e.alive);

        // Camera follow
        this.scrollOffsetX = Math.max(0, Math.min(this.player.x - 400, this.levelWidth - canvas.width));
        this.scrollOffsetY = Math.max(0, Math.min(this.player.y - 300, this.levelHeight - canvas.height));

        // Check goal
        if (this.goal.collidesWith(this.player)) {
            return 'levelComplete';
        }

        return 'playing';
    }

    draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(-this.scrollOffsetX, -this.scrollOffsetY);

        // Draw platforms
        this.platforms.forEach(p => p.draw(ctx));

        // Draw obstacles
        this.obstacles.forEach(o => o.draw(ctx));

        // Draw coins
        this.coins.forEach(c => c.draw(ctx));

        // Draw enemies
        this.enemies.forEach(e => e.draw(ctx));

        // Draw goal
        this.goal.draw(ctx);

        // Draw player
        this.player.draw(ctx);

        ctx.restore();
    }
}

// Level definitions
const LEVELS = {
    1: {
        name: 'Getting Started',
        description: 'Learn to move and jump',
        platforms: [
            { x: 0, y: 550, width: 1000, height: 50 }, // Ground
            { x: 150, y: 450, width: 100, height: 20 },
            { x: 350, y: 400, width: 100, height: 20 },
            { x: 550, y: 350, width: 100, height: 20 },
            { x: 750, y: 300, width: 100, height: 20 },
            { x: 950, y: 250, width: 100, height: 20 },
            { x: 1150, y: 200, width: 100, height: 20 }
        ],
        enemies: [],
        obstacles: [],
        coins: [
            { x: 160, y: 400 }, { x: 360, y: 350 }, { x: 560, y: 300 },
            { x: 760, y: 250 }, { x: 960, y: 200 }
        ],
        goal: { x: 1200, y: 100 }
    },
    2: {
        name: 'Meet the Walkers',
        description: 'Avoid or jump on enemies',
        platforms: [
            { x: 0, y: 550, width: 2000, height: 50 },
            { x: 200, y: 400, width: 150, height: 20 },
            { x: 450, y: 350, width: 150, height: 20 },
            { x: 700, y: 300, width: 150, height: 20 },
            { x: 950, y: 250, width: 150, height: 20 },
            { x: 1200, y: 200, width: 150, height: 20 }
        ],
        enemies: [
            { type: 'walker', x: 250, y: 520 },
            { type: 'walker', x: 500, y: 520 }
        ],
        obstacles: [],
        coins: [
            { x: 225, y: 350 }, { x: 475, y: 300 }, { x: 725, y: 250 },
            { x: 975, y: 200 }, { x: 1225, y: 150 }
        ],
        goal: { x: 1300, y: 100 }
    },
    3: {
        name: 'Spike Hazards',
        description: 'Navigate spike obstacles',
        platforms: [
            { x: 0, y: 550, width: 2000, height: 50 },
            { x: 100, y: 450, width: 100, height: 20 },
            { x: 300, y: 450, width: 100, height: 20 },
            { x: 500, y: 350, width: 100, height: 20 },
            { x: 700, y: 350, width: 100, height: 20 },
            { x: 900, y: 250, width: 100, height: 20 },
            { x: 1100, y: 250, width: 100, height: 20 }
        ],
        enemies: [],
        obstacles: [
            { type: 'spike', x: 200, y: 500 },
            { type: 'spike', x: 400, y: 500 },
            { type: 'spike', x: 600, y: 400 },
            { type: 'spike', x: 800, y: 400 },
            { type: 'spike', x: 1000, y: 300 }
        ],
        coins: [
            { x: 125, y: 400 }, { x: 325, y: 400 }, { x: 525, y: 300 },
            { x: 725, y: 300 }, { x: 925, y: 200 }
        ],
        goal: { x: 1200, y: 150 }
    },
    4: {
        name: 'Moving Platforms',
        description: 'Time your jumps on moving platforms',
        platforms: [
            { x: 0, y: 550, width: 2000, height: 50 },
            { x: 150, y: 450, width: 120, height: 20, type: 'moving' },
            { x: 450, y: 380, width: 120, height: 20, type: 'moving' },
            { x: 750, y: 310, width: 120, height: 20, type: 'moving' },
            { x: 1050, y: 240, width: 120, height: 20, type: 'moving' },
            { x: 1350, y: 170, width: 120, height: 20, type: 'moving' }
        ],
        enemies: [],
        obstacles: [],
        coins: [
            { x: 210, y: 400 }, { x: 510, y: 330 }, { x: 810, y: 260 },
            { x: 1110, y: 190 }, { x: 1410, y: 120 }
        ],
        goal: { x: 1500, y: 70 }
    },
    5: {
        name: 'Disappearing Platforms',
        description: 'Jump quickly on disappearing platforms',
        platforms: [
            { x: 0, y: 550, width: 2000, height: 50 },
            { x: 150, y: 480, width: 100, height: 20, type: 'disappearing' },
            { x: 300, y: 450, width: 100, height: 20, type: 'disappearing' },
            { x: 450, y: 420, width: 100, height: 20, type: 'disappearing' },
            { x: 600, y: 390, width: 100, height: 20, type: 'disappearing' },
            { x: 750, y: 360, width: 100, height: 20, type: 'disappearing' },
            { x: 900, y: 330, width: 100, height: 20, type: 'disappearing' },
            { x: 1050, y: 300, width: 100, height: 20 }
        ],
        enemies: [],
        obstacles: [],
        coins: [
            { x: 160, y: 430 }, { x: 310, y: 400 }, { x: 460, y: 370 },
            { x: 610, y: 340 }, { x: 760, y: 310 }, { x: 910, y: 280 }
        ],
        goal: { x: 1150, y: 220 }
    },
    6: {
        name: 'Flying Enemies',
        description: 'Deal with flying enemies',
        platforms: [
            { x: 0, y: 550, width: 2000, height: 50 },
            { x: 150, y: 450, width: 100, height: 20 },
            { x: 350, y: 400, width: 100, height: 20 },
            { x: 550, y: 350, width: 100, height: 20 },
            { x: 750, y: 300, width: 100, height: 20 },
            { x: 950, y: 250, width: 100, height: 20 }
        ],
        enemies: [
            { type: 'flyer', x: 300, y: 300 },
            { type: 'flyer', x: 600, y: 250 },
            { type: 'flyer', x: 900, y: 200 }
        ],
        obstacles: [],
        coins: [
            { x: 160, y: 400 }, { x: 360, y: 350 }, { x: 560, y: 300 },
            { x: 760, y: 250 }, { x: 960, y: 200 }
        ],
        goal: { x: 1100, y: 150 }
    },
    7: {
        name: 'Lava Lands',
        description: 'Avoid lava pools',
        platforms: [
            { x: 0, y: 550, width: 2000, height: 50 },
            { x: 100, y: 450, width: 80, height: 20 },
            { x: 250, y: 450, width: 80, height: 20 },
            { x: 400, y: 350, width: 80, height: 20 },
            { x: 550, y: 350, width: 80, height: 20 },
            { x: 700, y: 250, width: 80, height: 20 },
            { x: 850, y: 250, width: 80, height: 20 },
            { x: 1000, y: 150, width: 80, height: 20 },
            { x: 1150, y: 150, width: 80, height: 20 }
        ],
        enemies: [],
        obstacles: [
            { type: 'lava', x: 180, y: 480, width: 60, height: 70 },
            { type: 'lava', x: 480, y: 380, width: 60, height: 70 },
            { type: 'lava', x: 780, y: 280, width: 60, height: 70 }
        ],
        coins: [
            { x: 130, y: 400 }, { x: 280, y: 400 }, { x: 430, y: 300 },
            { x: 580, y: 300 }, { x: 730, y: 200 }, { x: 880, y: 200 }
        ],
        goal: { x: 1220, y: 50 }
    },
    8: {
        name: 'Complex Challenge',
        description: 'Combine all learned skills',
        platforms: [
            { x: 0, y: 550, width: 2000, height: 50 },
            { x: 100, y: 450, width: 100, height: 20 },
            { x: 250, y: 400, width: 100, height: 20, type: 'moving' },
            { x: 400, y: 380, width: 100, height: 20 },
            { x: 550, y: 320, width: 100, height: 20, type: 'disappearing' },
            { x: 700, y: 300, width: 100, height: 20 },
            { x: 850, y: 240, width: 100, height: 20, type: 'moving' },
            { x: 1000, y: 220, width: 100, height: 20 },
            { x: 1150, y: 160, width: 100, height: 20 }
        ],
        enemies: [
            { type: 'walker', x: 200, y: 520 },
            { type: 'flyer', x: 600, y: 250 }
        ],
        obstacles: [
            { type: 'spike', x: 150, y: 500 },
            { type: 'lava', x: 475, y: 420, width: 50, height: 50 }
        ],
        coins: [
            { x: 125, y: 400 }, { x: 275, y: 350 }, { x: 425, y: 330 },
            { x: 575, y: 270 }, { x: 725, y: 250 }, { x: 875, y: 190 },
            { x: 1025, y: 170 }, { x: 1175, y: 110 }
        ],
        goal: { x: 1250, y: 60 }
    },
    9: {
        name: 'Precision Jumps',
        description: 'Thin platforms require precision',
        platforms: [
            { x: 0, y: 550, width: 2000, height: 50 },
            { x: 100, y: 480, width: 40, height: 20 },
            { x: 200, y: 420, width: 40, height: 20 },
            { x: 300, y: 380, width: 40, height: 20 },
            { x: 400, y: 340, width: 40, height: 20 },
            { x: 500, y: 300, width: 40, height: 20 },
            { x: 600, y: 260, width: 40, height: 20 },
            { x: 700, y: 220, width: 40, height: 20 },
            { x: 800, y: 180, width: 40, height: 20 },
            { x: 900, y: 200, width: 40, height: 20 },
            { x: 1000, y: 240, width: 40, height: 20 },
            { x: 1100, y: 200, width: 40, height: 20 }
        ],
        enemies: [],
        obstacles: [],
        coins: [
            { x: 105, y: 430 }, { x: 205, y: 370 }, { x: 305, y: 330 },
            { x: 405, y: 290 }, { x: 505, y: 250 }, { x: 605, y: 210 },
            { x: 705, y: 170 }, { x: 805, y: 130 }
        ],
        goal: { x: 1150, y: 100 }
    },
    10: {
        name: 'Enemy Gauntlet',
        description: 'Navigate a crowd of enemies',
        platforms: [
            { x: 0, y: 550, width: 2000, height: 50 },
            { x: 150, y: 450, width: 120, height: 20 },
            { x: 350, y: 400, width: 120, height: 20 },
            { x: 550, y: 380, width: 120, height: 20 },
            { x: 750, y: 340, width: 120, height: 20 },
            { x: 950, y: 300, width: 120, height: 20 },
            { x: 1150, y: 260, width: 120, height: 20 }
        ],
        enemies: [
            { type: 'walker', x: 200, y: 520 },
            { type: 'walker', x: 500, y: 520 },
            { type: 'flyer', x: 400, y: 300 },
            { type: 'walker', x: 800, y: 520 },
            { type: 'flyer', x: 700, y: 250 },
            { type: 'walker', x: 1100, y: 520 }
        ],
        obstacles: [],
        coins: [
            { x: 210, y: 400 }, { x: 410, y: 350 }, { x: 610, y: 330 },
            { x: 810, y: 290 }, { x: 1010, y: 250 }, { x: 1210, y: 210 }
        ],
        goal: { x: 1320, y: 160 }
    },
    11: {
        name: 'Spike Field',
        description: 'Navigate a dangerous spike field',
        platforms: [
            { x: 0, y: 550, width: 2000, height: 50 },
            { x: 100, y: 470, width: 70, height: 20 },
            { x: 250, y: 470, width: 70, height: 20 },
            { x: 400, y: 370, width: 70, height: 20 },
            { x: 550, y: 370, width: 70, height: 20 },
            { x: 700, y: 270, width: 70, height: 20 },
            { x: 850, y: 270, width: 70, height: 20 },
            { x: 1000, y: 170, width: 70, height: 20 },
            { x: 1150, y: 170, width: 70, height: 20 }
        ],
        enemies: [],
        obstacles: [
            { type: 'spike', x: 150, y: 510 },
            { type: 'spike', x: 300, y: 510 },
            { type: 'spike', x: 450, y: 410 },
            { type: 'spike', x: 600, y: 410 },
            { type: 'spike', x: 750, y: 310 },
            { type: 'spike', x: 900, y: 310 },
            { type: 'spike', x: 1050, y: 210 }
        ],
        coins: [
            { x: 125, y: 420 }, { x: 275, y: 420 }, { x: 425, y: 320 },
            { x: 575, y: 320 }, { x: 725, y: 220 }, { x: 875, y: 220 }
        ],
        goal: { x: 1210, y: 70 }
    },
    12: {
        name: 'Vertical Climb',
        description: 'Climb vertically using platforms',
        platforms: [
            { x: 0, y: 550, width: 2000, height: 50 },
            { x: 400, y: 500, width: 200, height: 20 },
            { x: 200, y: 430, width: 150, height: 20, type: 'moving' },
            { x: 600, y: 430, width: 150, height: 20 },
            { x: 300, y: 360, width: 150, height: 20 },
            { x: 700, y: 360, width: 150, height: 20, type: 'moving' },
            { x: 400, y: 290, width: 150, height: 20 },
            { x: 600, y: 220, width: 150, height: 20 },
            { x: 800, y: 160, width: 150, height: 20 }
        ],
        enemies: [
            { type: 'flyer', x: 400, y: 380 }
        ],
        obstacles: [],
        coins: [
            { x: 500, y: 450 }, { x: 275, y: 380 }, { x: 675, y: 380 },
            { x: 375, y: 310 }, { x: 675, y: 310 }, { x: 475, y: 240 },
            { x: 675, y: 170 }, { x: 875, y: 110 }
        ],
        goal: { x: 870, y: 60 }
    },
    13: {
        name: 'Lava Rush',
        description: 'Escape rising lava',
        platforms: [
            { x: 0, y: 550, width: 2000, height: 50 },
            { x: 100, y: 500, width: 100, height: 20 },
            { x: 300, y: 450, width: 100, height: 20 },
            { x: 500, y: 400, width: 100, height: 20 },
            { x: 700, y: 350, width: 100, height: 20 },
            { x: 900, y: 300, width: 100, height: 20 },
            { x: 1100, y: 250, width: 100, height: 20 },
            { x: 1300, y: 200, width: 100, height: 20 }
        ],
        enemies: [],
        obstacles: [
            { type: 'lava', x: 0, y: 520, width: 2000, height: 30 }
        ],
        coins: [
            { x: 150, y: 450 }, { x: 350, y: 400 }, { x: 550, y: 350 },
            { x: 750, y: 300 }, { x: 950, y: 250 }, { x: 1150, y: 200 }
        ],
        goal: { x: 1350, y: 100 }
    },
    14: {
        name: 'Mixed Hazards',
        description: 'Combine spikes, lava, and enemies',
        platforms: [
            { x: 0, y: 550, width: 2000, height: 50 },
            { x: 100, y: 480, width: 100, height: 20 },
            { x: 300, y: 450, width: 100, height: 20, type: 'disappearing' },
            { x: 500, y: 400, width: 100, height: 20 },
            { x: 700, y: 380, width: 100, height: 20, type: 'moving' },
            { x: 900, y: 320, width: 100, height: 20 },
            { x: 1100, y: 280, width: 100, height: 20 },
            { x: 1300, y: 200, width: 100, height: 20 }
        ],
        enemies: [
            { type: 'walker', x: 250, y: 520 },
            { type: 'flyer', x: 700, y: 280 },
            { type: 'walker', x: 1000, y: 520 }
        ],
        obstacles: [
            { type: 'spike', x: 200, y: 500 },
            { type: 'lava', x: 550, y: 420, width: 80, height: 40 },
            { type: 'spike', x: 800, y: 400 },
            { type: 'spike', x: 1050, y: 320 }
        ],
        coins: [
            { x: 150, y: 430 }, { x: 350, y: 400 }, { x: 550, y: 350 },
            { x: 750, y: 330 }, { x: 950, y: 270 }, { x: 1150, y: 230 }
        ],
        goal: { x: 1350, y: 120 }
    },
    15: {
        name: 'Sky Platform',
        description: 'Reach the top platforms',
        platforms: [
            { x: 0, y: 550, width: 400, height: 50 },
            { x: 150, y: 480, width: 100, height: 20, type: 'moving' },
            { x: 350, y: 430, width: 100, height: 20 },
            { x: 550, y: 380, width: 100, height: 20, type: 'moving' },
            { x: 750, y: 340, width: 100, height: 20 },
            { x: 950, y: 290, width: 100, height: 20, type: 'disappearing' },
            { x: 1150, y: 250, width: 100, height: 20 },
            { x: 1350, y: 200, width: 100, height: 20, type: 'moving' },
            { x: 1550, y: 150, width: 100, height: 20 },
            { x: 1700, y: 100, width: 100, height: 20 }
        ],
        enemies: [
            { type: 'flyer', x: 500, y: 350 },
            { type: 'flyer', x: 850, y: 280 }
        ],
        obstacles: [],
        coins: [
            { x: 200, y: 430 }, { x: 400, y: 380 }, { x: 600, y: 330 },
            { x: 800, y: 290 }, { x: 1000, y: 240 }, { x: 1200, y: 200 },
            { x: 1400, y: 150 }, { x: 1600, y: 100 }
        ],
        goal: { x: 1750, y: 20 }
    },
    16: {
        name: 'Dodge Dance',
        description: 'Dodge moving enemies precisely',
        platforms: [
            { x: 0, y: 550, width: 2000, height: 50 },
            { x: 100, y: 480, width: 150, height: 20 },
            { x: 350, y: 450, width: 150, height: 20 },
            { x: 600, y: 420, width: 150, height: 20 },
            { x: 850, y: 390, width: 150, height: 20 },
            { x: 1100, y: 340, width: 150, height: 20 },
            { x: 1350, y: 280, width: 150, height: 20 }
        ],
        enemies: [
            { type: 'walker', x: 175, y: 520 },
            { type: 'flyer', x: 425, y: 380 },
            { type: 'walker', x: 675, y: 520 },
            { type: 'flyer', x: 925, y: 350 },
            { type: 'walker', x: 1175, y: 520 }
        ],
        obstacles: [
            { type: 'spike', x: 300, y: 500 },
            { type: 'spike', x: 800, y: 500 },
            { type: 'spike', x: 1300, y: 500 }
        ],
        coins: [
            { x: 175, y: 430 }, { x: 425, y: 400 }, { x: 675, y: 370 },
            { x: 925, y: 340 }, { x: 1175, y: 290 }, { x: 1425, y: 230 }
        ],
        goal: { x: 1500, y: 120 }
    },
    17: {
        name: 'Chaos Arena',
        description: 'Survive intense hazards',
        platforms: [
            { x: 0, y: 550, width: 2000, height: 50 },
            { x: 100, y: 480, width: 80, height: 20, type: 'moving' },
            { x: 250, y: 450, width: 80, height: 20, type: 'disappearing' },
            { x: 400, y: 420, width: 80, height: 20 },
            { x: 550, y: 380, width: 80, height: 20, type: 'moving' },
            { x: 700, y: 350, width: 80, height: 20, type: 'disappearing' },
            { x: 850, y: 300, width: 80, height: 20 },
            { x: 1000, y: 270, width: 80, height: 20, type: 'moving' },
            { x: 1150, y: 220, width: 80, height: 20 },
            { x: 1300, y: 180, width: 80, height: 20 }
        ],
        enemies: [
            { type: 'walker', x: 200, y: 520 },
            { type: 'flyer', x: 350, y: 350 },
            { type: 'walker', x: 550, y: 520 },
            { type: 'flyer', x: 750, y: 300 },
            { type: 'walker', x: 950, y: 520 },
            { type: 'flyer', x: 1100, y: 220 }
        ],
        obstacles: [
            { type: 'spike', x: 150, y: 500 },
            { type: 'lava', x: 300, y: 460, width: 50, height: 40 },
            { type: 'spike', x: 600, y: 400 },
            { type: 'lava', x: 800, y: 360, width: 50, height: 40 },
            { type: 'spike', x: 1050, y: 290 }
        ],
        coins: [
            { x: 140, y: 430 }, { x: 290, y: 400 }, { x: 440, y: 370 },
            { x: 590, y: 330 }, { x: 740, y: 300 }, { x: 890, y: 250 },
            { x: 1040, y: 220 }, { x: 1190, y: 170 }, { x: 1350, y: 130 }
        ],
        goal: { x: 1370, y: 60 }
    },
    18: {
        name: 'Ultimate Challenge',
        description: 'Master all mechanics',
        platforms: [
            { x: 0, y: 550, width: 2000, height: 50 },
            { x: 80, y: 500, width: 70, height: 20, type: 'moving' },
            { x: 200, y: 470, width: 70, height: 20, type: 'disappearing' },
            { x: 320, y: 450, width: 70, height: 20 },
            { x: 440, y: 410, width: 70, height: 20, type: 'moving' },
            { x: 560, y: 380, width: 70, height: 20, type: 'disappearing' },
            { x: 680, y: 350, width: 70, height: 20 },
            { x: 800, y: 310, width: 70, height: 20, type: 'moving' },
            { x: 920, y: 280, width: 70, height: 20 },
            { x: 1040, y: 240, width: 70, height: 20, type: 'disappearing' },
            { x: 1160, y: 210, width: 70, height: 20 },
            { x: 1280, y: 170, width: 70, height: 20, type: 'moving' },
            { x: 1400, y: 140, width: 70, height: 20 }
        ],
        enemies: [
            { type: 'walker', x: 150, y: 520 },
            { type: 'flyer', x: 350, y: 380 },
            { type: 'walker', x: 550, y: 520 },
            { type: 'flyer', x: 700, y: 300 },
            { type: 'walker', x: 900, y: 520 },
            { type: 'flyer', x: 1100, y: 220 },
            { type: 'walker', x: 1300, y: 520 }
        ],
        obstacles: [
            { type: 'spike', x: 120, y: 520 },
            { type: 'lava', x: 240, y: 480, width: 50, height: 40 },
            { type: 'spike', x: 480, y: 420 },
            { type: 'lava', x: 620, y: 390, width: 50, height: 40 },
            { type: 'spike', x: 840, y: 320 },
            { type: 'lava', x: 980, y: 290, width: 50, height: 40 },
            { type: 'spike', x: 1200, y: 220 }
        ],
        coins: [
            { x: 115, y: 450 }, { x: 235, y: 420 }, { x: 355, y: 400 },
            { x: 475, y: 360 }, { x: 595, y: 330 }, { x: 715, y: 300 },
            { x: 835, y: 260 }, { x: 955, y: 230 }, { x: 1075, y: 190 },
            { x: 1195, y: 160 }, { x: 1315, y: 120 }, { x: 1450, y: 90 }
        ],
        goal: { x: 1480, y: 40 }
    }
};

// Game variables
let currentLevel = null;
const keys = {};

// Input handling
window.addEventListener('keydown', (e) => {
    keys[e.key] = true;

    if (gameState.currentState === 'playing') {
        if (e.key === ' ' || e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
            currentLevel.player.jump();
            e.preventDefault();
        }
        if (e.key === 'Escape') {
            gameState.currentState = 'paused';
            updateUI();
        }
    } else if (gameState.currentState === 'paused') {
        if (e.key === 'Escape') {
            gameState.currentState = 'playing';
            updateUI();
            e.preventDefault();
        }
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Button event listeners
document.getElementById('startButton').addEventListener('click', () => {
    gameState.currentState = 'menu';
    updateUI();
});

document.getElementById('customizeButton').addEventListener('click', () => {
    gameState.currentState = 'customize';
    initializeCustomization();
    updateUI();
    updatePreview();
});

document.getElementById('confirmCustomizeButton').addEventListener('click', () => {
    const nameInput = document.getElementById('playerName');
    if (nameInput.value.trim()) {
        gameState.playerConfig.name = nameInput.value;
    }
    gameState.currentState = 'playing';
    startLevel(gameState.currentLevel);
    updateUI();
});

document.getElementById('backButton').addEventListener('click', () => {
    gameState.currentState = 'title';
    updateUI();
});

document.getElementById('pauseButton').addEventListener('click', () => {
    if (gameState.currentState === 'playing') {
        gameState.currentState = 'paused';
        updateUI();
    }
});

document.getElementById('resumeButton').addEventListener('click', () => {
    gameState.currentState = 'playing';
    updateUI();
});

document.getElementById('restartLevelButton').addEventListener('click', () => {
    gameState.currentState = 'playing';
    currentLevel.resetPlayer();
    updateUI();
});

document.getElementById('restartLevelButton2').addEventListener('click', () => {
    gameState.lives = 3;
    gameState.coins = 0;
    gameState.currentState = 'playing';
    startLevel(gameState.currentLevel);
    updateUI();
});

document.getElementById('levelSelectButton').addEventListener('click', () => {
    gameState.currentState = 'menu';
    updateUI();
});

document.getElementById('levelSelectButton2').addEventListener('click', () => {
    gameState.lives = 3;
    gameState.coins = 0;
    gameState.currentState = 'menu';
    updateUI();
});

document.getElementById('restartGameButton').addEventListener('click', () => {
    gameState.unlockedLevels = 1; // Reset to only level 1 unlocked
    gameState.currentLevel = 1;
    gameState.lives = 3;
    gameState.coins = 0;
    saveGameProgress(); // Save the reset progress
    gameState.currentState = 'menu';
    updateUI();
});

document.getElementById('customizeButtonPause').addEventListener('click', () => {
    gameState.currentState = 'customize';
    initializeCustomization();
    updateUI();
    updatePreview();
});

// Color customization
document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        gameState.playerConfig.color = btn.getAttribute('data-color');
        updatePreview();
    });
});

// Size customization
document.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        gameState.playerConfig.size = btn.getAttribute('data-size');
        updatePreview();
    });
});

// Update preview canvas
function updatePreview() {
    const previewCanvas = document.getElementById('previewCanvas');
    const previewCtx = previewCanvas.getContext('2d');
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

    const sizes = { small: { w: 15, h: 20 }, normal: { w: 20, h: 25 }, large: { w: 30, h: 40 } };
    const size = sizes[gameState.playerConfig.size] || sizes.normal;

    const x = (previewCanvas.width - size.w) / 2;
    const y = (previewCanvas.height - size.h) / 2;

    previewCtx.fillStyle = gameState.playerConfig.color;
    previewCtx.fillRect(x, y, size.w, size.h);

    previewCtx.fillStyle = 'white';
    previewCtx.fillRect(x + 3, y + 6, 3, 3);
    previewCtx.fillRect(x + size.w - 6, y + 6, 3, 3);

    previewCtx.fillStyle = 'black';
    previewCtx.fillRect(x + 3, y + 6, 2, 2);
    previewCtx.fillRect(x + size.w - 6, y + 6, 2, 2);
}

// Start level
function startLevel(levelNumber) {
    gameState.currentLevel = levelNumber;
    currentLevel = new Level(levelNumber, LEVELS[levelNumber] || LEVELS[1]);
    gameState.lives = 3;
}

// Update UI
function updateUI() {
    const titleScreen = document.getElementById('titleScreen');
    const menuPanel = document.getElementById('levelSelectMenu');
    const customizePanel = document.getElementById('customizeMenu');
    const gameUI = document.getElementById('gameUI');
    const pauseMenu = document.getElementById('pauseMenu');
    const gameOverMenu = document.getElementById('gameOverMenu');
    const canvas = document.getElementById('gameCanvas');

    // Hide all
    titleScreen.classList.remove('active');
    menuPanel.classList.remove('active');
    customizePanel.classList.remove('active');
    gameUI.classList.remove('active');
    pauseMenu.classList.remove('active');
    gameOverMenu.classList.remove('active');
    canvas.classList.remove('active');

    if (gameState.currentState === 'title') {
        titleScreen.classList.add('active');
    } else if (gameState.currentState === 'menu') {
        menuPanel.classList.add('active');
        populateLevelButtons();
    } else if (gameState.currentState === 'customize') {
        customizePanel.classList.add('active');
        updatePreview();
    } else if (gameState.currentState === 'playing') {
        gameUI.classList.add('active');
        canvas.classList.add('active');
    } else if (gameState.currentState === 'paused') {
        gameUI.classList.add('active');
        canvas.classList.add('active');
        pauseMenu.classList.add('active');
    } else if (gameState.currentState === 'gameOver') {
        canvas.classList.add('active');
        gameOverMenu.classList.add('active');
    }
}

// Populate level buttons
function populateLevelButtons() {
    const levelGrid = document.getElementById('levelGrid');
    levelGrid.innerHTML = '';

    for (let i = 1; i <= 18; i++) {
        const btn = document.createElement('button');
        btn.className = 'level-btn';
        btn.textContent = i;

        if (i <= gameState.unlockedLevels) {
            btn.addEventListener('click', () => {
                gameState.currentLevel = i;
                startLevel(i);
                gameState.currentState = 'playing';
                updateUI();
            });
        } else {
            btn.classList.add('locked');
            btn.textContent = '🔒';
        }

        levelGrid.appendChild(btn);
    }
}

// Update game UI display
function updateGameUI() {
    document.getElementById('levelNumber').textContent = gameState.currentLevel;
    document.getElementById('lives').textContent = gameState.lives;
    document.getElementById('coins').textContent = gameState.coins;
    document.getElementById('playerDisplay').textContent = gameState.playerConfig.name;
    document.getElementById('levelInfo').textContent = LEVELS[gameState.currentLevel].description;
}

// Game loop
let gameLoopRunning = false;

function gameLoop() {
    if (gameState.currentState !== 'playing') {
        requestAnimationFrame(gameLoop);
        return;
    }
    
    if (!currentLevel) {
        requestAnimationFrame(gameLoop);
        return;
    }

    // Handle input
    if (keys['ArrowLeft']) currentLevel.player.moveLeft();
    if (keys['ArrowRight']) currentLevel.player.moveRight();
    if (keys['a'] || keys['A']) currentLevel.player.moveLeft();
    if (keys['d'] || keys['D']) currentLevel.player.moveRight();

    // Update game
    const result = currentLevel.update();

    if (result === 'levelComplete') {
        if (gameState.currentLevel < 18) {
            gameState.unlockedLevels = Math.min(gameState.currentLevel + 1, 18);
            saveGameProgress(); // Save progress when level is completed
        }
        gameState.currentState = 'gameOver';
        document.getElementById('gameOverTitle').textContent = 'Level Complete!';
        document.getElementById('gameOverMessage').textContent = `Great job! You beat Level ${gameState.currentLevel}.`;
        updateUI();
    } else if (gameState.lives <= 0) {
        gameState.currentState = 'gameOver';
        document.getElementById('gameOverTitle').textContent = 'Game Over';
        document.getElementById('gameOverMessage').textContent = `You ran out of lives on Level ${gameState.currentLevel}.`;
        updateUI();
    }

    // Draw game
    currentLevel.draw();

    // Update UI
    updateGameUI();

    requestAnimationFrame(gameLoop);
}

// Initialize customization
function initializeCustomization() {
    // Set default selections
    document.querySelector('.color-btn[data-color="#FF6B6B"]').classList.add('selected');
    document.querySelector('.size-btn[data-size="normal"]').classList.add('selected');
    document.getElementById('playerName').value = gameState.playerConfig.name;
}

// Start game loop
function startGameLoop() {
    gameLoopRunning = true;
    gameLoop();
}

// Initialize game
loadGameProgress(); // Load saved progress
initializeCustomization();
updateUI();
startGameLoop();
