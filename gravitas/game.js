let Game = function (game) {

    // Displayables from level file
    let player,
        walls,
        shockers,
        gravObjects,
        checkpoints,
        exits,
        emitters,
        backgrounds,
        movers,
        tutorialSigns;

    // Player collision shadows
    let playerShadowLeft,
        playerShadowRight,
        playerShadowBottom,
        playerShadowTop;

    let clickedObj;

    // Dynamic displayables
    let pauseGraphics;
    let selectedObjGraphics;
    let gravCirclesTop;
    let gravCirclesBottom;

    let levelLoader;
    let currentLevelNum;

    // State info
    let pauseBtn;
    let selectableGravObjects;
    let currentHighlightedObjIndex;
    let rightKeyWasPressed,
        leftKeyWasPressed;
    let playerHasHitCheckpoint;
    let framesSincePressingDown;
    let framesSincePressingUp;
    let framesHoldingR;
    
    let deathState;
    let exitState;
    let freezeState;
    
    let playerDataList = [];

    // Player movement
    let previous_velocity_y,
        isJumping,
        jumpCount,
        lastTwoJumpFrames;
    // Player start position
    let playerStartX,
        playerStartY,
        playerGrav;

    //Debug
    let skipPressed;
    let lastDzoneRect;

    // Constants
    const jumpFrames = 10;

    // Physics
    const frictionCoef = 0.5;
    const groundAcceleration = 30;
    const airAcceleration = 5;
    const maxHorizontalVelocity = 250;
    const jumpVelocity = 300;
    const millisecondsPerFrame = 100/6;
    const movingObjSpeed = 30;

    // Display
    const blockSize = 30;
    const selectedObjWidth = 8;
    const arrowDist = 8;

    const exitSpeedRatio = 3;
    const exitMaxTick = 30;

    function unpackObjects(loaderObjects) {
        player = loaderObjects.player;
        walls = loaderObjects.walls;
        shockers = loaderObjects.shockers;
        gravObjects = loaderObjects.gravObjects;
        checkpoints = loaderObjects.checkpoints;
        exits = loaderObjects.exits;
        emitters = loaderObjects.emitters;
        playerStartX = loaderObjects.playerStartX;
        playerStartY = loaderObjects.playerStartY;
        playerGrav = loaderObjects.playerGrav;
        backgrounds = loaderObjects.backgrounds;
        movers = loaderObjects.movers;
        tutorialSigns = loaderObjects.tutorialSigns;
    }

    function loadLevel() {
        let levelObjects = levelLoader.loadLevel(currentLevelNum);
        unpackObjects(levelObjects);
        setupGravityObjects();

        game.world.bringToTop(emitters);
        game.world.sendToBack(shockers);
        game.world.sendToBack(gravCirclesBottom);
        game.world.sendToBack(backgrounds);
        game.world.bringToTop(gravCirclesTop);
        game.world.bringToTop(pauseGraphics);
        game.world.bringToTop(selectedObjGraphics);

        freezeState.addArrow(game, player);
        
    }

    function setupPauseButton() {
        pauseBtn = game.input.keyboard.addKey(Phaser.KeyCode.SPACEBAR);
        pauseBtn.onDown.add(function() {
            if (deathState.notCurrentlyDying && exitState.notCurrentlyExiting) {
                shockers.children.forEach(function(ele) {
                    ele.animations.paused = ! ele.animations.paused;
                });
                game.physics.arcade.isPaused = ! game.physics.arcade.isPaused;
                if (! game.physics.arcade.isPaused) {
                    selectableGravObjects.length = 0;
                    freezeState.endFreeze(game);
                    
                } else {
                    mainTheme[0].volume = 0;
                    mainTheme[0].pause();
                    frozenTime.fadeIn(100);
                    game.time.events.pause();
                    handleGravObjSelection();
                    freezeState.startFreeze(game);
                }
            }

        }, null);
    }

    function handleGravObjSelection() {
        // Place all objects currently on the screen into a list
        gravObjects.forEach(function(gravObj) {
            if    ((gravObj.x + 10 < game.camera.x + game.width ) && (gravObj.x - 10 > game.camera.x)
                && (gravObj.y + 10 < game.camera.y + game.height) && (gravObj.y - 10 > game.camera.y)) {
                if(!gravObj.flux && !gravObj.moving) {
                    selectableGravObjects.push(gravObj);
                }
            }
        });

        // Sort the objects from left to right
        selectableGravObjects.sort(function(a, b) {
            if (a.x < b.x) {
                return -1;
            } else {
                return 1;
            }
        });

        // Find the closest object to the player and make it the selected one
        let currentMinObjIndex = 0;
        for(let i = 0; i < selectableGravObjects.length; i++) {
            let gravObj = selectableGravObjects[i];

            let diff_1 = Phaser.Point.subtract(player.position, gravObj.position);
            let r_1 = diff_1.getMagnitude();

            let diff_2 = Phaser.Point.subtract(player.position, selectableGravObjects[currentMinObjIndex].position);
            let r_2 = diff_2.getMagnitude();

            if (r_1 < r_2) {
                currentMinObjIndex = i;
            }
        }
        
        currentHighlightedObjIndex = currentMinObjIndex;
    }


    function preload() {
        // Sprites
        game.load.image('player', 'assets/art/player.png');
        game.load.image('exit', 'assets/art/exit.png');
        game.load.image('wall', 'assets/art/bricks_gray.png');
        game.load.image('grass', 'assets/art/grass.png');
        game.load.image('gravObj', 'assets/art/gravObj.png');
        game.load.image('shadow', 'assets/art/shadow.png');
        game.load.image('checkpoint', 'assets/art/flag_red.png');
        game.load.image('checkpointActivated', 'assets/art/flag_green.png');
        game.load.image('arrow', 'assets/art/arrow.png');
        game.load.image('groundParticle', 'assets/art/groundParticle.png');
        game.load.image('gravParticle', 'assets/art/gravParticle.png');
        game.load.image('circle', 'assets/art/gravCircle.png');

        game.load.image('tutorial_movement', 'assets/art/tutorial/movement.png');
        game.load.image('tutorial_time_freeze', 'assets/art/tutorial/time_freeze_overlay.png');
        game.load.image('tutorial_gravity_change', 'assets/art/tutorial/gravity_change_overlay.png');
        game.load.image('tutorial_gravity_select', 'assets/art/tutorial/gravity_select_overlay.png');

        // Background tile sprites
        for(let i=1; i<=7; i++){
            game.load.image("bg_debug_"+i, "assets/art/bg/bg_debug_"+i+".png");
        }
        for(let i=1; i<=7; i++){
            game.load.image("bg_large_stone_"+i, "assets/art/bg/bg_large_stone_"+i+".png");
        }
        game.load.image("bg_sky_1", "assets/art/bg/bg_sky_1.png");

        // Audio
        game.load.audio('death', ['assets/audio/death.mp3', 'assets/audio/death.ogg']);
        game.load.audio('freeze', 'assets/audio/Freeze.mp3');
        game.load.audio('unfreeze', 'assets/audio/Unfreeze.mp3');
        game.load.audio('jump1', 'assets/audio/Jump.mp3');
        game.load.audio('jump2', 'assets/audio/Jump2.mp3');
        game.load.audio('jump3', 'assets/audio/Jump3.mp3');
        game.load.audio('jump4', 'assets/audio/Jump4.mp3');
        game.load.audio('landing', 'assets/audio/Landing.mp3');
        game.load.audio('checkpointHit', 'assets/audio/checkpoint.mp3');
        game.load.audio('exitSound', 'assets/audio/exit.mp3');

        // Animated sprites
        game.load.spritesheet('shocker', 'assets/art/electricity_sprites.png', 30, 30, 3);

        levelLoader = new LevelLoader(game);
        levelLoader.setup();
    }

    function create() {
        console.log("Starting Game state at Level #"+currentLevelNum);
        game.stage.backgroundColor = '#faebd7';
        game.physics.startSystem(Phaser.Physics.ARCADE);
        game.world.enableBody = true;
        game.canvas.oncontextmenu = function (e) {
            e.preventDefault();
        };
        
        pauseGraphics = game.add.graphics();
        selectedObjGraphics = game.add.graphics();
        
        gravCirclesTop = game.add.group();
        gravCirclesBottom = game.add.group();

        playerHasHitCheckpoint = false;
        deathState = new DeathState();
        exitState = new ExitState();
        freezeState = new FreezeState();

        loadLevel();

        setupPauseButton();

        game.input.keyboard.onUpCallback = function (event) {
            if (event.keyCode === Phaser.Keyboard.RIGHT) {
                rightKeyWasPressed = true;
            }
            if (event.keyCode === Phaser.Keyboard.LEFT) {
                leftKeyWasPressed = true;
            }
        };

        //makeLevelSelector();

        playerShadowLeft = game.add.sprite(player.body.position.x, player.body.position.y, 'shadow');
        playerShadowLeft.anchor.set(.5, .5);
        playerShadowLeft.body.setSize(5, 1, 0, 8);

        playerShadowRight = game.add.sprite(player.body.position.x, player.body.position.y, 'shadow');
        playerShadowRight.anchor.set(.5, .5);
        playerShadowRight.body.setSize(15, 1, 0, 8);

        playerShadowBottom = game.add.sprite(player.body.position.x, player.body.position.y, 'shadow');
        playerShadowBottom.anchor.set(.5, .5);
        playerShadowBottom.body.setSize(15, 1, 0, 14);

        playerShadowTop = game.add.sprite(player.body.position.x, player.body.position.y, 'shadow');
        playerShadowTop.anchor.set(.5, .5);
        playerShadowTop.body.setSize(13, 1, 0, 0);

        notCurrentlyExiting = true;
        exitTick = 0;
        
        notCurrentlyDying = true;
        deathFall = false;
        diedRecently = false;

        rightKeyWasPressed = false;
        leftKeyWasPressed = false;

        selectableGravObjects = [];
        
        lastTwoJumpFrames = [false, false];

        skipPressed = false;
        framesSincePressingDown = 0;
        framesSincePressingUp = 0;
        framesHoldingR = 0;
    }

    function update() {
        // Move the player in a parabolic death animation when dead,
        // Reset the game when the player falls below the game window
        if (deathState.deathFall) {
            deathState.doDeathFallAnimation(game, player, blockSize, onPlayerDeath);
        }
        
        if (exitAnimation) {
            doExitAnimation();
        }
        
        doControlButtons();

        doDebugButtons();

        doCollision();
        doGravityPhysics();

        if (! game.physics.arcade.isPaused){
            doPlayerMovement();
            doObjMovement();
            // When the player hits the ground after jumping, play a you hit the ground particle effect
            doHitGroundAnimation();
            checkWallCollision();
            doJumpPhysics();
            gravObjects.forEach(function(gravObj) {
                gravObj.animateParticles();
            }, null);

            previous_velocity_y = player.body.velocity.y;
            
            lastTwoJumpFrames = [lastTwoJumpFrames[1], isJumping];

            jumpState.update(player);

            rightKeyWasPressed = false;
            leftKeyWasPressed = false;

        } else {
            // If time is frozen, keep the particles in the same state until time is unfrozen
            emitters.forEach(function(emitter) {
                emitter.forEachAlive(function(p) {
                    p.lifespan += millisecondsPerFrame;
                }, null);
            }, null);

            if (deathState.notCurrentlyDying && exitState.notCurrentlyExiting) {
                // Adjust attraction of clicked object
                adjustAttractorsPull();
            }
            
            freezeState.doArrowChange(player);
        }
    }

    function render() {
        
        let drawGravObjCircle = function(circleGroup, gravObj, alpha) {
            // these are heuristic constants which look okay
            const subAmount = 50;
            let diameter = 2 * gravObj.radius;
            let currentAlpha = alpha;
            
            while (diameter > 0) {
                let circle = game.add.sprite(gravObj.x, gravObj.y, 'circle');
                circle.anchor.set(.5, .5);
                circle.alpha = currentAlpha;
                circle.width = diameter;
                circle.height = diameter;
                circleGroup.add(circle);
                gravObj.gravCircles.add(circle);
                diameter -= subAmount;
                currentAlpha -= currentAlpha/14;
            }
        };

        pauseGraphics.clear();
        selectedObjGraphics.clear();    
        
        // TODO: this is super processor intensive
        gravObjects.children.forEach(function(gravObj) {
            if(gravObj.weightHasBeenChanged || gravObj.flux || gravObj.moving) {
                gravObj.gravCircles.removeAll(true);
                drawGravObjCircle(gravCirclesBottom, gravObj, .04);
                drawGravObjCircle(gravCirclesTop, gravObj, .04);
                gravObj.weightHasBeenChanged = false;
            }
        });

        if ((game.physics.arcade.isPaused && deathState.notCurrentlyDying && exitState.notCurrentlyExiting) || freezeState.stopPauseAnimation) {
            freezeState.doPauseGraphics(game, pauseGraphics, player, quadraticEase);
        }

        if (selectableGravObjects.length > 0) {

            let selectedObj = selectableGravObjects[currentHighlightedObjIndex];
            selectedObjGraphics.beginFill(0xffffff, 1);
            
            selectedObjGraphics.drawRect(selectedObj.x - 15, selectedObj.y - 15, selectedObjWidth, 30);
            selectedObjGraphics.drawRect(selectedObj.x - 15, selectedObj.y - 15, 30, selectedObjWidth);
            selectedObjGraphics.drawRect(selectedObj.x - 15, selectedObj.y + 15 - selectedObjWidth, 30, selectedObjWidth);
            selectedObjGraphics.drawRect(selectedObj.x + 15 - selectedObjWidth, selectedObj.y - 15, selectedObjWidth, 30);
            
            selectedObjGraphics.endFill();
        }
    }

    function resetLevel() {
        
        player.destroy();
        freezeState.killArrow();
        player = levelLoader.makePlayer(playerStartX, playerStartY, playerGrav);
        
        gravObjects.children.forEach(function(gravObj) {
            gravObj.resetWeight();
            gravObj.weightHasBeenChanged = true;
        });
        
        movers.forEach(function(obj) {
            obj.x = obj.startingX;
            obj.y = obj.startingY;
            obj.movementIndex = 0;
        });
        
    }
    
    function clearLevel() {
        player.kill();
        walls.destroy();
        shockers.destroy();
        gravObjects.forEach(function(gravObj) {
            if (gravObj.gravParticles !== undefined) {
                gravObj.gravParticles.destroy();
            }
            gravObj.gravCircles.destroy();
        }, null);
        gravObjects.destroy();
        exits.destroy();
        backgrounds.destroy();
        freezeState.killArrow();
        checkpoints.destroy();
        movers.length = 0;
        tutorialSigns.destroy();
    }
    
    function doCollision() {
        game.physics.arcade.collide(emitters, walls);
        game.physics.arcade.collide(player, walls);
        game.physics.arcade.collide(player, gravObjects);

        game.physics.arcade.overlap(player, checkpoints, onCheckpointHit, null, null);

        gravObjects.forEach(function(gravObj) {
            game.physics.arcade.collide(gravObjects, gravObj.gravParticles, function(_, p) {
                    p.life = 0;
            }, null, null);
        }, null);

        player.isTouchingRight = false;
        player.isTouchingLeft = false;
        player.isTouchingBottom = false;
        player.isTouchingTop = false;
        
        playerShadowLeft.body.position.set(player.body.position.x - 2, player.body.position.y);
        playerShadowRight.body.position.set(player.body.position.x + .5, player.body.position.y);
        playerShadowBottom.body.position.set(player.body.position.x - 1, player.body.position.y + 15);
        playerShadowTop.body.position.set(player.body.position.x + 1, player.body.position.y - 17);

        game.physics.arcade.overlap(playerShadowRight, walls, function() {
            player.isTouchingRight = true;
        }, null, null);
        game.physics.arcade.overlap(playerShadowLeft, walls, function() {
            player.isTouchingLeft = true;
        }, null, null);
        game.physics.arcade.overlap(playerShadowBottom, walls, function() {
            player.isTouchingBottom = true;
        }, null, null);
        game.physics.arcade.overlap(playerShadowTop, walls, function() {
            player.isTouchingTop = true;
        }, null, null);
        
        // If the player is not dead, play the death animation on contact with shockers or the exit animation on contact with an exit
        if (deathState.notCurrentlyDying && !deathState.diedRecently && exitState.notCurrentlyExiting) {
            game.physics.arcade.overlap(player, exits, onExit, null, null);
            game.physics.arcade.overlap(player, shockers, function() {deathState.deathAnimation(game, player);}, null, null);
        }
    }

    function adjustAttractorsPull() {

        if (rightKeyWasPressed) {
            currentHighlightedObjIndex = (currentHighlightedObjIndex + 1) % selectableGravObjects.length;
            rightKeyWasPressed = false;
        }
        if (leftKeyWasPressed) {
            currentHighlightedObjIndex = (currentHighlightedObjIndex - 1) % selectableGravObjects.length;
            if (currentHighlightedObjIndex === -1) {
                currentHighlightedObjIndex = selectableGravObjects.length - 1;
            }
            leftKeyWasPressed = false;
        }
        if (game.input.keyboard.isDown(Phaser.KeyCode.UP)) {
            let obj = selectableGravObjects[currentHighlightedObjIndex];
            if (obj) {
                if(framesSincePressingUp < 7 && framesSincePressingUp > 0){
                    let diff = obj.gravMax - obj.gravWeight;
                    obj.gravWeight = Math.min(obj.gravMax, obj.gravWeight + (diff/3));
                } else{
                    obj.gravWeight = Math.min(obj.gravMax, obj.gravWeight + 5000);
                }
                obj.weightHasBeenChanged = true;
            }
            framesSincePressingUp = 0;
        } else {
            framesSincePressingUp ++;
        }
        if (game.input.keyboard.isDown(Phaser.KeyCode.DOWN)) {
            let obj = selectableGravObjects[currentHighlightedObjIndex];
            if (obj) {
                if(framesSincePressingDown < 7 && framesSincePressingDown > 0){
                    obj.gravWeight = obj.gravMin;
                } else {
                    obj.gravWeight = Math.max(obj.gravMin, obj.gravWeight - 5000);
                }
                obj.weightHasBeenChanged = true;
            }
            framesSincePressingDown = 0;
        } else {
            framesSincePressingDown++;
        }
    }
    
    function doControlButtons(){
        if(game.input.keyboard.isDown(Phaser.KeyCode.R)){
            framesHoldingR++;
            if(framesHoldingR > 60) {
                onPlayerDeath();
                framesHoldingR = -30;
                // Immediately resetting again takes 50% longer to avoid accidental double resets
            }
        } else {
            if(framesHoldingR < 0)
                framesHoldingR++;
            framesHoldingR = Math.max(0, framesHoldingR);
        }
    }

    function doPlayerMovement(){
        if (game.input.keyboard.isDown(Phaser.KeyCode.A)) {
            if (player.body.touching.down && !jumpState.recentlyJumped()) {
                player.body.velocity.x = Math.max(-maxHorizontalVelocity, player.body.velocity.x - groundAcceleration);
            } else {
                player.body.velocity.x -= airAcceleration;
            }
        } else if (game.input.keyboard.isDown(Phaser.KeyCode.D)) {
            if (player.body.touching.down && !jumpState.recentlyJumped()) {
                player.body.velocity.x = Math.min(maxHorizontalVelocity, player.body.velocity.x + groundAcceleration);
            } else {
                player.body.velocity.x += airAcceleration;
            }
        } else {
            if (player.body.touching.down && !jumpState.isJumping) {
                player.body.velocity.x = player.body.velocity.x * frictionCoef;
            }
        }

        if (player.body.velocity.x < 0 && player.isTouchingLeft) {
            player.body.velocity.x = 0;
        }
        if (player.body.velocity.x > 0 && player.isTouchingRight) {
            player.body.velocity.x = 0;
        }
    }

    function doObjMovement() {
        movers.forEach(function(obj) {
            moveObjInPattern(obj);
        })
    }
    
    function doDebugButtons() {
        // Button to skip levels
        if(game.input.keyboard.isDown(Phaser.KeyCode.NUMPAD_MULTIPLY)) {
            if(!skipPressed) {
                processExit();
            }
            skipPressed = true;
        } else{
            skipPressed = false;
        }


    }

    function doDebugDisplay(){
        // Draw deadzone rectangle
        if(lastDzoneRect != null)
            lastDzoneRect.kill();
        let dzone = game.camera.deadzone;
        let graphics = game.add.graphics();
        graphics.lineStyle(4, 0x000000, 1);
        lastDzoneRect = graphics.drawRect(dzone.x + game.camera.x, dzone.y+game.camera.y, dzone.width, dzone.height);
        window.graphics = graphics;

    }

    function doHitGroundAnimation() {
        if (jumpState.isJumping && player.isTouchingBottom) {
            // add player.body.velocity.x / 14 so that particles appear where player *will* be next frame
            let emitter = game.add.emitter(player.x + player.body.velocity.x/14, player.bottom + 2);
            let numParticles = Math.max(5, (previous_velocity_y - 220)/40) ;

            emitter.makeParticles('groundParticle', 0, numParticles, true);
            emitter.gravity = 300;
            emitter.width = 20;
            emitter.setYSpeed(-100);
            emitter.start(true, 500, null, numParticles);
            game.time.events.add(1000, function() {
                emitter.destroy(true);
            }, null);
            emitters.add(emitter);
            
            if (!game.input.keyboard.isDown(Phaser.KeyCode.W)) {
                let hitGroundSound = game.add.audio('landing');
                hitGroundSound.volume = 0.1;
                hitGroundSound.allowMultiple = false;
                hitGroundSound.play();
            }
            
        }

        // Fade out the particles over their lifespan
        emitters.forEach(function(emitter) {
            emitter.forEachAlive(function(p) {
                //p.alpha = p.lifespan / emitter.lifespan;
                p.alpha = quadraticEase(p.lifespan, emitter.lifespan);
            }, null);
        }, null);
    }

    function checkWallCollision() {
        //If just landed on top of a block under another, get out of the wall and keep moving
        if ((player.body.touching.down || player.isTouchingBottom) && jumpState.isJumping && (player.isTouchingLeft || player.isTouchingRight)) {
            player.body.velocity.x = player.isTouchingLeft * groundAcceleration - player.isTouchingRight * groundAcceleration;
            player.body.velocity.y = previous_velocity_y;
        }

        //If stuck in a wall, get out of the wall and keep moving
        if ((player.body.touching.down || player.isTouchingBottom) && player.isTouchingTop && jumpState.isJumping) {
            player.body.velocity.x = player.isTouchingLeft * groundAcceleration - player.isTouchingRight * groundAcceleration;
            player.x = player.x + player.isTouchingLeft * ((blockSize/2) - (player.body.left % (blockSize/2))) - player.isTouchingRight * (player.body.right % (blockSize/2));
            if (player.body.velocity.y === 0) {
                player.body.velocity.y = previous_velocity_y;
            }
        }
    }

    function setupGravityObjects() {
        gravObjects.children.forEach(function(gravObj) {
            gravObj.events.onInputDown.add(startGravityClick);
            gravObj.events.onInputUp.add(function() {
                clickedObj = null;
            }, null);
        });
    }

    function doGravityPhysics(){

        gravityEffectsOnObject(player);
        emitters.forEach(function(emitter) {
            emitter.forEachAlive(function(p) {
                gravityEffectsOnObject(p);
            }, null);
        }, null);

        // Gravity object changes

        gravObjects.forEach(function(gravObj) {
            gravObj.gravParticles.forEachAlive(function(p) {
                gravityEffectsOnObject(p);
            }, null);

            if (gravObj.flux) {
                gravObj.gravWeight += 2000 * gravObj.fluxConst;
                if (gravObj.gravWeight >= gravObj.gravMax || gravObj.gravWeight <= gravObj.gravMin) {
                    gravObj.fluxConst *= -1;
                }
            }

        });
    }

    function moveObjInPattern(obj) {
        let loc = obj.body.position;
        let movementList = obj.movementList;
        let movementIndex = obj.movementIndex;
        let movingToX = movementList[movementIndex].split('#')[0] - blockSize/2;
        let movingToY = movementList[movementIndex].split('#')[1] - blockSize/2;

        if (parseInt(loc.x) === movingToX && parseInt(loc.y) === movingToY) {
            obj.movementIndex = (movementIndex + 1) % movementList.length;
        } else {
            obj.body.velocity.x = (loc.x < movingToX) * movingObjSpeed - 
                                  (loc.x > movingToX) * movingObjSpeed;
            obj.body.velocity.y = (loc.y < movingToY) * movingObjSpeed - 
                                  (loc.y > movingToY) * movingObjSpeed;
        }
    }
    
    function gravityEffectsOnObject(obj) {
        let xGravCoef = 0;
        let yGravCoef = 0;

        gravObjects.forEach(function(gravObj) {

            let diff = Phaser.Point.subtract(obj.position, gravObj.position);
            let r = diff.getMagnitude();
            diff.normalize();

            if ( r < gravObj.radius) {
                xGravCoef += gravObj.gravWeight * diff.x / r;
                yGravCoef += gravObj.gravWeight * diff.y / r;
            }
        });

        if (obj.gravConstant !== undefined) {
            xGravCoef *= obj.gravConstant;
            yGravCoef *= obj.gravConstant;
        }

        if (xGravCoef > 0) {
            obj.body.acceleration.x = -xGravCoef * !obj.isTouchingLeft;
        } else {
            obj.body.acceleration.x = -xGravCoef * !obj.isTouchingRight;
        }

        obj.body.acceleration.y = -yGravCoef;

    }
    
    function doArrowChange() {
        let xDelta = player.body.velocity.x + player.body.acceleration.x/14;
        let yDelta = player.body.velocity.y + (player.body.acceleration.y + player.body.gravity.y)/14;

        let theta = Math.atan2(yDelta, xDelta);

        arrow.x = player.x + xDelta/14 + arrowDist * Math.cos(theta);
        arrow.y = player.y + yDelta/14 + arrowDist * Math.sin(theta);

        arrow.rotation = theta;
    }
    

    // Starts the death animation by setting flags. Freezes the player, pauses the game state, shakes the screen, then sets a timer to set the deathFall flag which is run in update
    function deathAnimation() {
        if (!diedRecently) {
            notCurrentlyDying = false;
            game.physics.arcade.isPaused = true;
            player.body.allowGravity = false;
            player.body.velocity = new Phaser.Point(0, 0);
            let deathSound = game.add.audio('death');
            deathSound.volume = 0.01;
            deathSound.play();
            game.time.events.add(0, function() {
                game.camera.shake(.008, deathAnimationTime);
            }, null);
            game.time.events.add(deathAnimationTime + 100, function() {
                deathFall = true;
                deathCounter = 0;
            }, null);
        }
    }
    
    function doDeathFallAnimation() {
        let movement;
        if (Math.abs((Math.pow(deathCounter - deathFallSpeed, 2) - Math.pow(deathFallSpeed, 2))/(blockSize/2)) > blockSize) {
            movement = blockSize;
        } else {
            movement = (Math.pow(deathCounter - deathFallSpeed, 2) - Math.pow(deathFallSpeed, 2))/(blockSize/2)
        }
        player.y += movement;
        if (player.y > game.world.height + 3 * blockSize) {
            onPlayerDeath();
            deathFall = false;
            notCurrentlyDying = true;
            diedRecently = true;
            game.physics.arcade.isPaused = false;
            game.time.events.add(100, function() {
                diedRecently = false;
            });
        }
        deathCounter += 1;
    }
    
    function onPlayerDeath() {
        if(playerHasHitCheckpoint) {
            resetLevel();
        } else {
            clearLevel();
            loadLevel();
        }

    }
    
    function onExit(obj, exit) {
        exitState.onExit(obj, exit, game, processExit);
    }
    
    function processExit() {
        
        updateLocalStorage();

        playerHasHitCheckpoint = false;
        clearLevel();
        
        exitState.reset();
        
        game.physics.arcade.isPaused = false;
        if (currentLevelNum + 1 === levelLoader.getLevelCount()) {
            game.state.start('win');
        } else {
            currentLevelNum++;
            loadLevel();
        }
    }
    
    function updateLocalStorage() {
        let levelList = game.cache.getText('levelList').split('\n');
        playerDataList = localStorage.getItem('user_progress');
        if (playerDataList == null) {
            playerDataList = [0];
            for (let i = 1; i < levelList.length; i++) {
                playerDataList[i] = 1;
            }
            localStorage.setItem('user_progress', playerDataList);
        } else {
            playerDataList = playerDataList.split(',');
            playerDataList[Math.min(levelList.length - 1, currentLevelNum + 1)] = 0;
            localStorage.setItem('user_progress', playerDataList);
        }
    }

    function onCheckpointHit(player, checkpoint) {
        if (! checkpoint.hasBeenHitBefore) {
            checkpoint.hasBeenHitBefore = true;
            playerHasHitCheckpoint = true;
            playerStartX = checkpoint.x;
            playerStartY = checkpoint.y;
            checkpoint.loadTexture('checkpointActivated');
            
            let checkpointSound = game.add.audio('checkpointHit');
            checkpointSound.volume = .1;
            checkpointSound.play();
        }
    }

    function startGravityClick(gravObj) {
        if (game.input.activePointer.rightButton.isDown) {
            if (! gravObj.secondClick) {
                gravObj.secondClick = true;
                game.time.events.add(300, function() {
                    gravObj.secondClick = false;
                }, null);

            } else {
                if (game.physics.arcade.isPaused) {
                    gravObj.gravWeight = 0;
                }
            }
        }

        clickedObj = gravObj;
    }
    
    function checkLastTwoJumpFrames() {
        return (lastTwoJumpFrames[0] || lastTwoJumpFrames[1]);
    }
    
    function quadraticEase(t, tmax) {
        return 1 - Math.pow(tmax - t, 2)/Math.pow(tmax, 2);
    }

    function setLevel(lnum){
        currentLevelNum = lnum;
    }

    return {
        preload: preload,
        create: create,
        update: update,
        render: render,
        setLevel: setLevel
    };
};