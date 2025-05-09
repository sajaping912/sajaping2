// DOM이 로드된 후 실행되도록 모든 코드를 DOMContentLoaded 이벤트 리스너 내에 배치
document.addEventListener('DOMContentLoaded', () => {

// 게임 변수 설정
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const gameUI = document.getElementById('game-ui');
// mobileControls 요소는 HTML에서 제거되어 참조하지 않음
const timerDisplay = document.getElementById('timer');
// finalScoreDisplay 요소는 HTML에서 제거되어 참조하지 않음 
const menuStart = document.getElementById('menu-start');
const menuPause = document.getElementById('menu-pause');
const menuStop = document.getElementById('menu-stop');

// 게임 상태 변수
let gameRunning = false;
let gameWidth;
let gameHeight;
let score = 0;
let lives = 3;
let lastTime = 0;
let enemySpawnTimer = 0;
let enemySpawnInterval = 1000; // 적 생성 간격 (ms)
let bulletCooldown = 0;
let isShooting = false;
let isMovingLeft = false;
let isMovingRight = false;
let isMobile = false;
let gamePaused = false;
let gameTime = 0; // 게임 시간 (초)
let frameTime = 0; // 프레임 시간 누적

// 게임 객체
let player;
let bullets = [];
let enemies = [];
let explosions = [];

// 이미지 로드
const playerImg = new Image();
playerImg.src = 'images/player.png';

const enemy1Img = new Image();
enemy1Img.src = 'images/enemy1.png';

const enemy2Img = new Image();
enemy2Img.src = 'images/enemy2.png';

// 사운드 로드
const backgroundSound = new Audio('sounds/background.mp3');
backgroundSound.loop = true;
backgroundSound.volume = 0.5;

const shootSound = new Audio('sounds/shoot.mp3');
shootSound.volume = 0.4;

const explosionSound = new Audio('sounds/explosion.mp3');
explosionSound.volume = 0.6;

// 모바일 감지
function detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || window.innerWidth <= 800;
}

// 캔버스 크기 설정
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gameWidth = canvas.width;
    gameHeight = canvas.height;
    
    // 플레이어가 이미 존재한다면 위치 재설정
    if (player) {
        player.x = gameWidth / 2 - player.width / 2;
        player.y = gameHeight - player.height - 20;
    }    isMobile = detectMobile();
    // 모바일 컨트롤 사용하지 않음
}

// 플레이어 클래스
class Player {
    constructor() {
        this.width = isMobile ? 50 : 60;
        this.height = isMobile ? 50 : 60;
        this.x = gameWidth / 2 - this.width / 2;
        this.y = gameHeight - this.height - 20;
        this.speed = isMobile ? 5 : 7;
        this.img = playerImg;
    }

    update() {
        // 키보드 이동 로직은 keydown 이벤트에서 처리
        if (isMovingLeft && this.x > 0) {
            this.x -= this.speed;
        }
        if (isMovingRight && this.x + this.width < gameWidth) {
            this.x += this.speed;
        }

        // 화면 경계 확인
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > gameWidth) this.x = gameWidth - this.width;
    }

    draw() {
        ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
    }    shoot() {
        // 쿨다운 체크를 제거하여 호출될 때마다 총알이 발사되도록 함
        bullets.push(new Bullet(this.x + this.width / 2 - 2, this.y));
        shootSound.currentTime = 0;
        shootSound.play().catch(e => console.log("오디오 재생 에러:", e));
        // 쿨다운을 최소화 (터치가 빠르게 여러 번 발생해도 총알이 나가도록)
        bulletCooldown = 10;
    }
}

// 총알 클래스
class Bullet {
    constructor(x, y) {
        this.width = 4;
        this.height = 15;
        this.x = x;
        this.y = y;
        this.speed = 10;
        this.color = '#ffff00';
    }

    update() {
        this.y -= this.speed;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    isOffScreen() {
        return this.y < 0;
    }
}

// 적 클래스
class Enemy {    constructor(x, y, type) {
        this.type = type;
        this.width = type === 1 ? 40 : 50;
        this.height = type === 1 ? 40 : 50;
        this.x = x;
        this.y = y;
        this.speed = (Math.random() * 2 + (type === 1 ? 1 : 0.5)) / 2; // 속도를 절반으로 줄임
        this.img = type === 1 ? enemy1Img : enemy2Img;
        this.movementPattern = Math.floor(Math.random() * 3); // 0: 직선, 1: 지그재그, 2: 곡선
        this.anglePos = 0; // 곡선 이동을 위한 각도 위치
    }

    update() {
        // 이동 패턴에 따른 이동
        switch (this.movementPattern) {
            case 0: // 직선
                this.y += this.speed;
                break;
            case 1: // 지그재그
                this.y += this.speed;
                this.x += Math.sin(this.y * 0.02) * 2;
                break;
            case 2: // 곡선 
                this.y += this.speed;
                this.anglePos += 0.02;
                this.x += Math.sin(this.anglePos) * 1.5;
                break;
        }
    }

    draw() {
        ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
    }

    isOffScreen() {
        return this.y > gameHeight;
    }

    checkCollision(bullet) {
        return (
            bullet.x < this.x + this.width &&
            bullet.x + bullet.width > this.x &&
            bullet.y < this.y + this.height &&
            bullet.y + bullet.height > this.y
        );
    }
}

// 폭발 효과 클래스
class Explosion {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 1;
        this.maxRadius = 30;
        this.speed = 1.5;
        this.alpha = 1;
    }

    update() {
        this.radius += this.speed;
        this.alpha -= 0.02;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 165, 0, ' + this.alpha + ')';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 0, 0, ' + this.alpha + ')';
        ctx.stroke();
        ctx.restore();
    }

    isFinished() {
        return this.alpha <= 0;
    }
}

// 적 생성 함수
function spawnEnemy() {
    const type = Math.random() > 0.3 ? 1 : 2;
    const enemyWidth = type === 1 ? 40 : 50;
    const x = Math.random() * (gameWidth - enemyWidth);
    enemies.push(new Enemy(x, -50, type));
}

// 게임 초기화
function initGame() {    gameRunning = true;
    gamePaused = false;
    score = 0;
    lives = 3;
    gameTime = 0;
    frameTime = 0;
    bullets = [];
    enemies = [];
    explosions = [];    player = new Player();
    timerDisplay.textContent = `60`; // 1분 타이머 표시 (60초)
    timerDisplay.classList.remove('hidden'); // 타이머 표시
      startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    
    backgroundSound.currentTime = 0;
    backgroundSound.play().catch(e => console.log("배경 음악 재생 에러:", e));
    
    requestAnimationFrame(gameLoop);
}

// 게임 종료
function endGame() {
    gameRunning = false;
    gamePaused = false;
    backgroundSound.pause();
      // PAUSE 버튼 텍스트 초기화
    menuPause.textContent = "PAUSE";
    
    // 타이머 숨기기 및 게임 종료 화면 표시 (플레이 버튼만 있는 화면)
    timerDisplay.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
}

// 게임 루프
function gameLoop(timestamp) {
    // 델타 타임 계산
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    
    // 일시정지 상태이면 게임 업데이트 건너뜀
    if (gamePaused) {
        requestAnimationFrame(gameLoop);
        return;
    }
    
    // 배경 지우기
    ctx.clearRect(0, 0, gameWidth, gameHeight);
    
    // 타이머 업데이트 - 1분(60초) 제한
    frameTime += deltaTime;
    if (frameTime >= 1000) { // 1초마다 업데이트
        gameTime += 1;
        const timeLeft = 60 - gameTime; // 60초에서 경과 시간 빼기
        
        if (timeLeft <= 0) {
            // 1분이 지나면 게임 종료
            endGame();
            return;
        }        timerDisplay.textContent = `${timeLeft}`;
        frameTime -= 1000;
    }
    
    // 쿨다운 감소
    if (bulletCooldown > 0) {
        bulletCooldown -= deltaTime;
    }
    
    // 적 생성 타이머
    enemySpawnTimer += deltaTime;
    if (enemySpawnTimer >= enemySpawnInterval) {
        spawnEnemy();
        enemySpawnTimer = 0;
    }    // 플레이어 업데이트 및 그리기
    player.update();
    player.draw();
    
    // 모바일에서는 자동 발사 처리 안함 (터치 시에만 발사)
    
    // 총알 업데이트 및 그리기
    bullets = bullets.filter(bullet => {
        bullet.update();
        bullet.draw();
        return !bullet.isOffScreen();
    });
    
    // 적 업데이트 및 그리기
    enemies = enemies.filter(enemy => {
        enemy.update();
        enemy.draw();
        
    // 플레이어와 적 충돌 검사
        if (
            player.x < enemy.x + enemy.width &&
            player.x + player.width > enemy.x &&
            player.y < enemy.y + enemy.height &&
            player.y + player.height > enemy.y
        ) {
            // 폭발 효과만 생성하고 생명력은 감소시키지 않음
            explosions.push(new Explosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2));
            explosionSound.currentTime = 0;
            explosionSound.play().catch(e => console.log("효과음 재생 에러:", e));
            return false; // 충돌한 적만 제거
        }
        
        return !enemy.isOffScreen();
    });
    
    // 총알과 적 충돌 검사
    bullets = bullets.filter(bullet => {
        let bulletHit = false;
        
        enemies = enemies.filter(enemy => {            if (!bulletHit && enemy.checkCollision(bullet)) {
                score += enemy.type === 1 ? 10 : 20;
                explosions.push(new Explosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2));
                explosionSound.currentTime = 0;
                explosionSound.play().catch(e => console.log("효과음 재생 에러:", e));
                bulletHit = true;
                return false;
            }
            return true;
        });
        
        return !bulletHit;
    });
    
    // 폭발 효과 업데이트 및 그리기
    explosions = explosions.filter(explosion => {
        explosion.update();
        explosion.draw();
        return !explosion.isFinished();
    });
    
    // 게임 루프 계속 실행
    if (gameRunning) {
        requestAnimationFrame(gameLoop);
    }
}

// 이벤트 리스너
document.getElementById('start-button').addEventListener('click', initGame);
document.getElementById('restart-button').addEventListener('click', initGame);

// 메뉴 버튼 이벤트 - 클릭 및 터치 이벤트 모두 처리
function handleMenuStartClick() {
    console.log('START 버튼 클릭됨');
    if (!gameRunning) {
        initGame();
        menuPause.textContent = "PAUSE"; // 새 게임 시작 시 PAUSE 버튼 텍스트 초기화
    } else if (gamePaused) {
        gamePaused = false;
        menuPause.textContent = "PAUSE"; // 게임 재개 시 PAUSE 버튼 텍스트 초기화
        backgroundSound.play().catch(e => console.log("배경 음악 재생 에러:", e));
    }
}

function handleMenuPauseClick() {
    console.log('PAUSE 버튼 클릭됨');
    if (gameRunning) { 
        if (!gamePaused) {
            // 게임 일시 중지
            gamePaused = true;
            backgroundSound.pause();
            menuPause.textContent = "RESUME"; // 버튼 텍스트를 RESUME으로 변경
            console.log('게임 일시 중지됨');
        } else {
            // 게임 재개
            gamePaused = false;
            backgroundSound.play().catch(e => console.log("배경 음악 재생 에러:", e));
            menuPause.textContent = "PAUSE"; // 버튼 텍스트를 다시 PAUSE로 변경
            console.log('게임 재개됨');
        }
    }
}

function handleMenuStopClick() {
    console.log('STOP 버튼 클릭됨');
    if (gameRunning) {
        // 게임 종료 상태로 변경
        gameRunning = false;
        gamePaused = false;
        backgroundSound.pause();
        
        // PAUSE 버튼 텍스트 초기화
        menuPause.textContent = "PAUSE";
        
        // 게임 요소 숨기기
        timerDisplay.classList.add('hidden');
        
        // 게임 오버 화면 대신 시작 화면(플레이 버튼)을 표시
        startScreen.classList.remove('hidden');
        gameOverScreen.classList.add('hidden'); // 게임 오버 화면은 표시하지 않음
        
        // 모든 게임 객체 초기화
        bullets = [];
        enemies = [];
        explosions = [];
    }
}

menuStart.addEventListener('click', handleMenuStartClick);
menuStart.addEventListener('touchstart', function(e) {
    e.preventDefault();
    handleMenuStartClick();
});

menuPause.addEventListener('click', handleMenuPauseClick);
menuPause.addEventListener('touchstart', function(e) {
    e.preventDefault();
    handleMenuPauseClick();
});

menuStop.addEventListener('click', handleMenuStopClick);
menuStop.addEventListener('touchstart', function(e) {
    e.preventDefault();
    handleMenuStopClick();
});

// 키보드 이벤트
window.addEventListener('keydown', (e) => {
    if (!gameRunning) return;
    
    switch (e.key) {
        case 'ArrowLeft':
            isMovingLeft = true;
            break;
        case 'ArrowRight':
            isMovingRight = true;
            break;
        case ' ':
            isShooting = true;
            break;
    }
});

window.addEventListener('keyup', (e) => {
    switch (e.key) {
        case 'ArrowLeft':
            isMovingLeft = false;
            break;
        case 'ArrowRight':
            isMovingRight = false;
            break;
        case ' ':
            isShooting = false;
            break;
    }
});

// 모바일 컨트롤 이벤트 제거 - 대신 터치 기반 컨트롤 사용

// 터치 기반 컨트롤 - 터치한 위치로 이동 및 발사
document.addEventListener('touchstart', (e) => {
    // 시작 버튼 터치는 별도 처리
    if (e.target.id === 'start-button') {
        // 시작 버튼은 기본 클릭 이벤트가 처리하도록 둠
        return;
    }
    
    // 메뉴 버튼 터치는 무시
    if (e.target.id === 'menu-start' || e.target.id === 'menu-pause' || e.target.id === 'menu-stop') {
        e.preventDefault();
        return;
    }    // 게임이 실행 중이고 일시정지 상태가 아닐 때만 처리
    if (gameRunning && !gamePaused) {        // 터치 이벤트에서 X, Y 좌표 계산
        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;        // 플레이어 이동
        if (player) {
            // 플레이어 중앙이 터치 위치보다 22px 위에 오도록 계산
            player.x = touchX - (player.width / 2);
            player.y = touchY - (player.height / 2) - 22; // Y 좌표를 22px 위로 조정
              // 화면 경계 확인
            if (player.x < 0) player.x = 0;
            if (player.x + player.width > gameWidth) player.x = gameWidth - player.width;
            if (player.y < 0) player.y = 0;
            if (player.y + player.height > gameHeight) player.y = gameHeight - player.height;
            
            // 총알 직접 생성 (쿨다운 무시, 터치할 때마다 즉시 발사)
            bullets.push(new Bullet(player.x + player.width / 2 - 2, player.y));
            shootSound.currentTime = 0;
            shootSound.play().catch(e => console.log("오디오 재생 에러:", e));
        }
        
        // 기본 동작 방지 (스크롤 등)
        e.preventDefault();
    }
}, { passive: false });

// 창 크기 변경 시 캔버스 크기 조정
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', resizeCanvas);

// 게임 시작 시 캔버스 크기 설정
window.addEventListener('load', resizeCanvas);

// DOMContentLoaded 이벤트 리스너 닫기
});
