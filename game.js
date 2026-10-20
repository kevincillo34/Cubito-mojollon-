const config = {
    type: Phaser.AUTO,
    width: 900,
    height: 950,
    parent: "juego",

    backgroundColor: "#236938",

    physics: {
        default: "arcade",
        arcade: {
            debug: false
        }
    },

    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

let player;
let enemies;
let bullets;
let cursors;
let keys;

let health = 50;
let defeated = 0;
let gameOver = false;

let healthText;
let defeatedText;
let helpText;
let lastDamage = 0;

const WORLD_WIDTH = 1000;
const WORLD_HEIGHT = 1000;


// Cargar el audio
function preload() {
    this.load.audio(
        "nombe_chapulinxd",
        "audios/nombe_chapulinxd.mp3"
    );
}


function create() {
    // Límites del mapa
    this.physics.world.setBounds(
        0, 0, WORLD_WIDTH, WORLD_HEIGHT
    );

    this.cameras.main.setBounds(
        0, 0, WORLD_WIDTH, WORLD_HEIGHT
    );

    // Crear al jugador
    player = this.add.rectangle(
        WORLD_WIDTH / 2,
        WORLD_HEIGHT / 2,
        30, 30,
        0x35b7ff
    );

    this.physics.add.existing(player);

    player.body.setCollideWorldBounds(true);
    player.body.setSize(30, 30);

    // Cámara que sigue al jugador
    this.cameras.main.startFollow(
        player, true, 0.08, 0.08
    );

    // Controles
    cursors = this.input.keyboard.createCursorKeys();

    keys = this.input.keyboard.addKeys("W,A,S,D");

    // Grupos de enemigos y proyectiles
    enemies = this.physics.add.group();
    bullets = this.physics.add.group();

    // Crear enemigos iniciales
    for (let i = 0; i < 12; i++) {
        spawnEnemy.call(this);
    }

    // Crear nuevos enemigos periódicamente
    this.time.addEvent({
        delay: 500,
        callback: spawnEnemy,
        callbackScope: this,
        loop: true
    });

    // Disparos automáticos
    this.time.addEvent({
        delay: 1200,
        callback: shootNearest,
        callbackScope: this,
        loop: true
    });

    // Los proyectiles golpean a los enemigos
    this.physics.add.overlap(
        bullets,
        enemies,
        hitEnemy,
        null,
        this
    );

    // Los enemigos golpean al jugador
    this.physics.add.overlap(
        player,
        enemies,
        touchEnemy,
        null,
        this
    );

    // Interfaz
    healthText = this.add.text(
        15, 15,
        "Vida: 50",
        {
            fontSize: "22px",
            color: "#b50808",
            fontStyle: "bold"
        }
    ).setScrollFactor(0).setDepth(10);

    defeatedText = this.add.text(
        15, 45,
        "Derrotados: 0",
        {
            fontSize: "18px",
            color: "#8cff9a"
        }
    ).setScrollFactor(0).setDepth(10);

    helpText = this.add.text(
        15, 920,
        "Muévete con WASD o las flechas",
        {
            fontSize: "16px",
            color: "#ffffff"
        }
    ).setScrollFactor(0).setDepth(10);
}


function update() {
    if (gameOver) return;

    // Movimiento del jugador
    let velocityX = 0;
    let velocityY = 0;

    if (cursors.left.isDown || keys.A.isDown) {
        velocityX = -1;
    }

    if (cursors.right.isDown || keys.D.isDown) {
        velocityX = 1;
    }

    if (cursors.up.isDown || keys.W.isDown) {
        velocityY = -1;
    }

    if (cursors.down.isDown || keys.S.isDown) {
        velocityY = 1;
    }

    // Evitar movimiento diagonal más rápido
    const length = Math.hypot(velocityX, velocityY);

    if (length > 0) {
        velocityX /= length;
        velocityY /= length;
    }

    const speed = 250;

    player.body.setVelocity(
        velocityX * speed,
        velocityY * speed
    );
}


function spawnEnemy() {
    if (enemies.countActive() >= 35) return;

    let x;
    let y;

    // Aparecer lejos del jugador
    do {
        x = Phaser.Math.Between(40, WORLD_WIDTH - 30);
        y = Phaser.Math.Between(40, WORLD_HEIGHT - 30);
    } while (
        Phaser.Math.Distance.Between(
            x, y, player.x, player.y
        ) < 250
    );

    const enemy = this.add.rectangle(
        x, y, 28, 28, 0xff4545
    );

    this.physics.add.existing(enemy);

    // Permitir que el enemigo se mueva
    enemy.body.setImmovable(false);
    enemy.body.setAllowGravity(false);
    enemy.body.setCollideWorldBounds(true);
    enemy.body.setBounce(1, 1);

    // Agregarlo al grupo una sola vez
    enemies.add(enemy);

    // Dirección y velocidad aleatorias
    const angle = Phaser.Math.FloatBetween(
        0, Math.PI * 2
    );

    const speed = Phaser.Math.Between(200, 750);

    enemy.body.setVelocity(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed
    );

    // Algunos enemigos irán al centro después de 4 segundos
    const goesToCenter = Math.random() < 0.4;

    if (goesToCenter) {
        this.time.delayedCall(4000, () => {
            if (!enemy.active || gameOver) return;

            const centerX = WORLD_WIDTH / 2;
            const centerY = WORLD_HEIGHT / 2;

            const direction = Phaser.Math.Angle.Between(
                enemy.x,
                enemy.y,
                centerX,
                centerY
            );

            const centerSpeed = 90;

            enemy.body.setVelocity(
                Math.cos(direction) * centerSpeed,
                Math.sin(direction) * centerSpeed
            );
        });
    } else {
        // Los demás cambian de dirección aleatoriamente
        this.time.addEvent({
            delay: Phaser.Math.Between(1500, 3500),

            callback: () => {
                if (!enemy.active || gameOver) return;

                const newAngle = Phaser.Math.FloatBetween(
                    0, Math.PI * 2
                );

                const newSpeed = Phaser.Math.Between(
                    200, 350
                );

                enemy.body.setVelocity(
                    Math.cos(newAngle) * newSpeed,
                    Math.sin(newAngle) * newSpeed
                );
            },

            loop: true
        });
    }
}


function shootNearest() {
    if (gameOver) return;

    let nearest = null;
    let shortestDistance = Infinity;

    // Buscar al enemigo más cercano
    enemies.getChildren().forEach(enemy => {
        if (!enemy.active) return;

        const distance = Phaser.Math.Distance.Between(
            player.x, player.y,
            enemy.x, enemy.y
        );

        if (distance < shortestDistance) {
            shortestDistance = distance;
            nearest = enemy;
        }
    });

    if (!nearest) return;

    // Crear el proyectil
    const bullet = this.add.circle(
        player.x, player.y, 6, 0xffe66d
    );

    this.physics.add.existing(bullet);
    bullets.add(bullet);

    // Disparar hacia el enemigo
    const angle = Phaser.Math.Angle.Between(
        player.x, player.y,
        nearest.x, nearest.y
    );

    const bulletSpeed = 500;

    bullet.body.setVelocity(
        Math.cos(angle) * bulletSpeed,
        Math.sin(angle) * bulletSpeed
    );

    // Destruir el proyectil después de un tiempo
    this.time.delayedCall(1800, () => {
        if (bullet.active) bullet.destroy();
    });
}


function hitEnemy(bullet, enemy) {
    if (!bullet.active || !enemy.active) return;

    bullet.destroy();
    enemy.destroy();

    defeated++;

    defeatedText.setText(
        "Derrotados: " + defeated
    );
}


function touchEnemy(playerObject, enemy) {
    if (gameOver || !enemy.active) return;

    const now = this.time.now;

    // Evitar recibir daño en cada fotograma
    if (now - lastDamage < 700) return;

    lastDamage = now;
    health -= 10;

    healthText.setText(
        "Vida: " + Math.max(health, 0)
    );

    // Efecto visual al recibir daño
    player.setFillStyle(0xffffff);

    this.time.delayedCall(120, () => {
        if (player.active && !gameOver) {
            player.setFillStyle(0x35b7ff);
        }
    });

    // Muerte del jugador
    if (health <= 0) {
        health = 0;
        gameOver = true;

        player.body.setVelocity(0, 0);

        // Reproducir el audio si derrotaste 20 enemigos o menos
        if (defeated <= 20) {
            this.sound.play("nombe_chapulinxd");
        }

        // Mostrar GAME OVER
        this.add.text(
            450, 475,
            "¡GAME OVER!\nEnemigos derrotados: " + defeated,
            {
                fontSize: "32px",
                color: "#ff5555",
                align: "center",
                fontStyle: "bold",
                backgroundColor: "#151922",
                padding: { x: 15, y: 15 }
            }
        )
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(20);
    }
}
