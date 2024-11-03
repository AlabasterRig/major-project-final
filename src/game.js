import * as THREE from 'three';
import * as YUKA from 'yuka';

// Load shaders
async function loadShader(url) {
    const response = await fetch(url);
    return await response.text();
}

async function init() {
    const heightmapFragmentShader = await loadShader('heightmapFragment.glsl');
    const smoothFragmentShader = await loadShader('smoothFragment.glsl');

    // Set up scene, camera, and renderer
    const scene = new THREE.Scene();
    const aspect = window.innerWidth / window.innerHeight;
    const camera = new THREE.OrthographicCamera(-aspect * 5, aspect * 5, 5, -5, 0.1, 1000);
    camera.position.set(0, 5, 10); 
    camera.lookAt(0, 0, 0); 

    const renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('container').appendChild(renderer.domElement);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    // Yuka setup
    const entityManager = new YUKA.EntityManager();
    const time = new YUKA.Time();

    // Background Plane with Heightmap Shader
    const planeGeometry = new THREE.PlaneGeometry(10, 10);
    const planeMaterial = new THREE.ShaderMaterial({
        fragmentShader: heightmapFragmentShader,
        uniforms: {
            mousePos: { value: new THREE.Vector2(0, 0) },
            mouseSize: { value: 1.0 },
            viscosityConstant: { value: 0.98 },
            waveheightMultiplier: { value: 0.1 },
            resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
        }
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);

    // Player Class
    class Player {
        constructor() {
            this.position = new THREE.Vector3(0, 0, 0);
            this.score = 0;
            this.speed = 0.1; 
            this.mesh = new THREE.Mesh(
                new THREE.SphereGeometry(0.2, 32, 32),
                new THREE.MeshBasicMaterial({ color: 0x00ff00 }) 
            );
            scene.add(this.mesh);
            this.updatePosition();
        }

        move(direction) {
            this.position.add(direction.clone().multiplyScalar(this.speed));
            this.constrainMovement();
            this.updatePosition();
        }

        constrainMovement() {
            const halfWidth = 5 * aspect;
            const halfHeight = 5;
            this.position.x = Math.max(-halfWidth, Math.min(halfWidth, this.position.x));
            this.position.y = Math.max(-halfHeight, Math.min(halfHeight, this.position.y));
        }

        updatePosition() {
            this.mesh.position.copy(this.position);
        }

        collectOrb(orb) {
            this.score += orb.value;
            console.log(`Score updated: ${this.score}`);
            orb.destroy();
            document.getElementById('score').textContent = `Score: ${this.score}`;
            spawnOrb(); // Spawn a new orb
        }
    }

    // Enemy Class
    class Enemy {
        constructor() {
            this.vehicle = new YUKA.Vehicle();
            this.vehicle.position.set(Math.random() * 10 - 5, Math.random() * 10 - 5, 0);
            this.vehicle.maxSpeed = 2;
            entityManager.add(this.vehicle);

            this.mesh = new THREE.Mesh(
                new THREE.SphereGeometry(0.2, 32, 32),
                new THREE.MeshBasicMaterial({ color: 0xff0000 })
            );
            scene.add(this.mesh);

            // Delay the seek behavior by 5 seconds
            setTimeout(() => {
                const seekBehavior = new YUKA.SeekBehavior(player.position);
                this.vehicle.steering.add(seekBehavior);
            }, 5000);
        }

        update() {
            this.mesh.position.copy(this.vehicle.position);
        }
    }

    // Orb Class
    class Orb {
        constructor() {
            this.position = new THREE.Vector3(Math.random() * 10 - 5, Math.random() * 10 - 5, 0);
            this.value = 10;
            this.mesh = new THREE.Mesh(
                new THREE.SphereGeometry(0.1, 32, 32),
                new THREE.MeshBasicMaterial({ color: 0xffff00 })
            );
            this.mesh.position.copy(this.position);
            scene.add(this.mesh);
        }

        destroy() {
            scene.remove(this.mesh);
        }
    }

    const player = new Player();
    const enemies = [new Enemy(), new Enemy(), new Enemy()];
    const orbs = [];

    function spawnOrb() {
        const orb = new Orb();
        orbs.push(orb);
    }

    function initOrbs() {
        for (let i = 0; i < 3; i++) {
            spawnOrb();
        }
    }

    initOrbs();

    // Handle user input
    const keys = {};
    window.addEventListener('keydown', (event) => {
        keys[event.key] = true;
    });
    window.addEventListener('keyup', (event) => {
        keys[event.key] = false;
    });

    function handleInput() {
        const direction = new THREE.Vector3();
        if (keys['w']) direction.y += 1;
        if (keys['s']) direction.y -= 1;
        if (keys['a']) direction.x -= 1;
        if (keys['d']) direction.x += 1;
        player.move(direction);
    }

    // Animation loop
    function animate() {
        const delta = time.update().getDelta();
        entityManager.update(delta);

        handleInput();

        // Update enemies
        enemies.forEach(enemy => enemy.update());

        // Check for collisions with orbs
        orbs.forEach((orb, index) => {
            if (player.position.distanceTo(orb.position) < 0.3) {
                player.collectOrb(orb);
                orbs.splice(index, 1);
            }
        });

        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }

    animate();
}

init();