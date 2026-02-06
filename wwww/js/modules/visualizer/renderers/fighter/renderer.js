/**
 * @fileoverview Fighter Renderer Module (Space Fighters + Background Particles)
 */

import { BaseRenderer } from '../../core/base-renderer.js';
import { SpaceFighter } from './fighter.js';
import { MissileSystem } from './missile.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Fighter Renderer
 * Combines background particle effects with 3D Space Fighter simulation
 */
export class FighterRenderer extends BaseRenderer {
    /**
     * @param {CanvasRenderingContext2D} ctx 
     * @param {HTMLCanvasElement} webglCanvas
     */
    constructor(ctx, webglCanvas) {
        super(ctx);
        this.webglCanvas = webglCanvas;
        this.particles = [];
        this.initialized = false;
        
        // Three.js Setup
        if (this.webglCanvas) {
            this.scene = new THREE.Scene();
            // Camera will be set in resize
            this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
            
            this.renderer = new THREE.WebGLRenderer({ 
                canvas: this.webglCanvas, 
                alpha: true, 
                antialias: true 
            });
            
            // Lights
            const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
            this.scene.add(ambientLight);
            
            const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
            dirLight.position.set(5, 10, 7);
            this.scene.add(dirLight);

            this.modelGroup = new THREE.Group();
            this.scene.add(this.modelGroup);

            this.loadModel();
        }

        // 3D Engine State
        // User Request: Tilt 30 degrees Top-Right (Pitch -30, Yaw -30)
        const rad30 = 30 * (Math.PI / 180);
        const pitch = rad30; // Nose Up
        const yaw = rad30;   // Nose Right
        
        this.rotation = { x: pitch, y: yaw, z: 0 }; 
        this.targetRotation = { x: pitch, y: yaw, z: 0 };
        this.isDragging = false;
        this.lastMouse = { x: 0, y: 0 };
        
        // User Request: Magnify 1.5x (was 2.0 -> 0.5)
        this.zoom = 3.0; // Start large (2.0 * 1.5)
        this.targetZoom = 0.75; // Target (0.5 * 1.5)
        this.squadron = [];
        this.model = null; // Legacy reference if needed
        this.missileSystem = new MissileSystem();
        
        this.init3DModel();
        this.bindInteraction();
    }

    /**
     * Handle resize
     * @param {number} w 
     * @param {number} h 
     */
    resize(w, h) {
        super.resize(w, h);
        if (this.renderer && this.camera) {
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w, h, false);
        }
        if (!this.initialized) {
            this.initParticles(w, h);
            this.initialized = true;
        }
    }

    /**
     * Load GLB Model with Progress Bar
     */
    loadModel() {
        const loader = new GLTFLoader();
        
        // UI Elements
        const loaderEl = document.getElementById('model-loader');
        const percentEl = document.getElementById('loader-percent');
        const barFillEl = document.getElementById('loader-bar-fill');
        
        // Show loader
        if (loaderEl) {
            loaderEl.style.display = 'block';
            loaderEl.style.opacity = '1';
        }

        loader.load(
            'modles/fighter/northstar_fighter_ship.glb', 
            (gltf) => {
                // Success
                console.log('Fighter model loaded');
                this.baseModel = gltf.scene;
                
                // Update Progress to 100%
                if (percentEl) percentEl.textContent = '100';
                if (barFillEl) barFillEl.style.width = '100%';

                // Re-create formation with new model
                this.updateFormationModels();
                
                // Hide after short delay for smooth transition
                setTimeout(() => {
                    if (loaderEl) {
                        loaderEl.style.opacity = '0';
                        // Wait for transition to finish before hiding
                        setTimeout(() => {
                            loaderEl.style.display = 'none';
                        }, 500); 
                    }
                }, 800);
            }, 
            (xhr) => {
                // Progress
                if (xhr.total > 0) {
                    const percent = Math.round((xhr.loaded / xhr.total) * 100);
                    if (percentEl) percentEl.textContent = percent;
                    if (barFillEl) barFillEl.style.width = `${percent}%`;
                }
            }, 
            (error) => {
                // Error
                console.error('Error loading fighter model:', error);
                if (percentEl) {
                    percentEl.textContent = 'ERR';
                    percentEl.parentElement.innerHTML = '空间跳跃失败 <span style="color:#ff0055">CONNECTION LOST</span>';
                }
                if (barFillEl) {
                    barFillEl.style.backgroundColor = '#ff0055'; // Error Red
                    barFillEl.style.boxShadow = '0 0 15px #ff0055';
                    barFillEl.style.width = '100%';
                }
                // Keep error visible for a while or indefinitely
                setTimeout(() => {
                    if (loaderEl) {
                         // Optional: Auto hide error after long delay? 
                         // For now, let's keep it visible so user knows something is wrong
                         // or fade out slowly.
                         loaderEl.style.opacity = '0';
                         setTimeout(() => { loaderEl.style.display = 'none'; }, 500);
                    }
                }, 3000);
            }
        );
    }

    /**
     * Update Three.js models for current squadron
     */
    updateFormationModels() {
        if (!this.baseModel || !this.modelGroup) return;
        
        this.modelGroup.clear();
        
        this.squadron.forEach(fighter => {
            const mesh = this.baseModel.clone();
            fighter.mesh = mesh;
            this.modelGroup.add(mesh);
        });
    }

    /**
     * Initialize background particles
     * @param {number} w 
     * @param {number} h 
     */
    initParticles(w, h) {
        this.particles = [];
        for(let i=0; i<150; i++) {
            this.particles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                baseSize: Math.random() * 5 + 3,
                randomSpeed: Math.random() * 0.05 + 0.02,
                colorType: Math.random() > 0.5 ? 'primary' : 'secondary'
            });
        }
    }

    /**
     * Initialize 3D Space Fighter Model
     */
    init3DModel() {
        // High-Fidelity Sci-Fi Fighter Jet Model (Procedural)
        this.squadron = [];
        
        // Check for Performance Test Mode
        // Enable by setting window.test = 'on' in console
        const isTestMode = (typeof window !== 'undefined' && (window.TEST_FIGHTERS || window.test === 'on')) || false;
        
        if (isTestMode) {
             console.log('Initializing Space Fighter Test Mode: 25 Instances');
             this.createFormation(25);
        } else {
             this.createFormation(1);
        }
    }

    /**
     * Create a formation of space fighters
     * @param {number} count Number of fighters (default: 25)
     */
    createFormation(count = 25) {
        this.squadron = [];
        if (count === 1) {
             this.squadron.push(new SpaceFighter(Math.random(), {x:0, y:0, z:0}));
        } else if (count === 5) {
            // Triangle / Pyramid Formation (品字形)
            //     F1 (Top/Lead)
            //  F2    F3 (Wingmen)
            // F4      F5 (Rear)
            const spacingX = 1.5;
            const spacingZ = 1.5;
            const spacingY = 0.5;
            
            // Lead
            this.squadron.push(new SpaceFighter(Math.random(), {x:0, y:0, z:0}));
            // Wingmen
            this.squadron.push(new SpaceFighter(Math.random(), {x:-spacingX, y:-spacingY, z:spacingZ}));
            this.squadron.push(new SpaceFighter(Math.random(), {x:spacingX, y:-spacingY, z:spacingZ}));
            // Rear
            this.squadron.push(new SpaceFighter(Math.random(), {x:-spacingX*2, y:-spacingY*2, z:spacingZ*2}));
            this.squadron.push(new SpaceFighter(Math.random(), {x:spacingX*2, y:-spacingY*2, z:spacingZ*2}));
            
        } else {
             // Grid Formation
             const cols = 5;
             const rows = Math.ceil(count / cols);
             const spacing = 2.5;
             
             for(let i=0; i<count; i++) {
                 const col = i % cols;
                 const row = Math.floor(i / cols);
                 
                 // Center the grid
                 const x = (col - (cols-1)/2) * spacing;
                 const z = row * spacing; // Deep into screen
                 const y = (Math.random() - 0.5) * 2; // Random height variation
                 
                 this.squadron.push(new SpaceFighter(Math.random(), {x, y, z}));
             }
        }

        // Initialize Three.js models
        this.updateFormationModels();
    }

    /**
     * Bind mouse/touch interaction
     */
    bindInteraction() {
        const canvas = this.ctx.canvas;
        if (canvas.getAttribute('data-3d-attached')) return;
        
        const startDrag = (x, y) => {
            this.isDragging = true;
            this.lastMouse = { x, y };
        };
        
        const moveDrag = (x, y) => {
            if (!this.isDragging) return;
            const dx = x - this.lastMouse.x;
            const dy = y - this.lastMouse.y;
            this.targetRotation.y += dx * 0.01;
            this.targetRotation.x += dy * 0.01;
            this.lastMouse = { x, y };
        };
        
        const endDrag = () => { this.isDragging = false; };
        
        canvas.addEventListener('mousedown', e => startDrag(e.clientX, e.clientY));
        window.addEventListener('mousemove', e => moveDrag(e.clientX, e.clientY));
        window.addEventListener('mouseup', endDrag);
        
        canvas.addEventListener('touchstart', e => {
            if (e.touches.length === 1) startDrag(e.touches[0].clientX, e.touches[0].clientY);
        }, {passive: false});
        window.addEventListener('touchmove', e => {
            if (e.touches.length === 1) moveDrag(e.touches[0].clientX, e.touches[0].clientY);
        }, {passive: false});
        window.addEventListener('touchend', endDrag);
        
        canvas.addEventListener('wheel', e => {
            e.preventDefault();
            this.targetZoom += e.deltaY * -0.001;
            this.targetZoom = Math.min(Math.max(0.1, this.targetZoom), 2.0);
        }, {passive: false});
        
        canvas.setAttribute('data-3d-attached', 'true');
    }

    /**
     * Trigger missile launch for a specific callsign
     * @param {string} callsign 
     */
    triggerLaunch(callsign) {
        if (this.squadron.length > 0) {
            // Select a random fighter to launch the missile
            const fighter = this.squadron[Math.floor(Math.random() * this.squadron.length)];
            fighter.triggerLaunch(this.missileSystem, callsign);
        }
    }

    /**
     * Render the 3D squadron
     * @param {number} w 
     * @param {number} h 
     * @param {number} bass 
     * @param {Object} theme 
     * @param {boolean} isSpeaking
     */
    draw3DPlane(w, h, bass, theme, isSpeaking = false) {
        // Smooth Rotation
        this.rotation.x += (this.targetRotation.x - this.rotation.x) * 0.1;
        this.rotation.y += (this.targetRotation.y - this.rotation.y) * 0.1;
        this.rotation.z += (this.targetRotation.z - this.rotation.z) * 0.1;
        
        const time = Date.now() / 1000;
        const swayY = Math.sin(time) * 0.1;

        // Update Three.js Group
        if (this.modelGroup) {
            this.modelGroup.rotation.x = this.rotation.x;
            this.modelGroup.rotation.y = this.rotation.y;
            this.modelGroup.rotation.z = this.rotation.z;
            this.modelGroup.position.y = swayY * 5;
            
            // Ensure matrix is updated for projection
            this.modelGroup.updateMatrixWorld(true);
        }

        // Update Camera Zoom
        if (this.camera && this.zoom > 0.1) {
             this.camera.position.z = 8 / this.zoom;
             this.camera.updateMatrixWorld();
        }

        // Transform Function for 2D Effects (Exhaust, Labels)
        // Maps Local/World coordinates to 2D Canvas coordinates
        const transformFn = (x, y, z) => {
            // 1. Create Vector (Input is in Group Local Space)
            const vec = new THREE.Vector3(x, y, z);
            
            // 2. Local -> World (Apply Group Transform)
            if (this.modelGroup) {
                vec.applyMatrix4(this.modelGroup.matrixWorld);
            }
            
            // 3. Calculate Scale/Perspective before projection
            const dist = this.camera.position.distanceTo(vec);
            const p = 8.0 / Math.max(0.1, dist); // Perspective factor
            
            // 4. World -> NDC
            vec.project(this.camera);
            
            // 5. NDC -> Screen
            const sx = (vec.x + 1) / 2 * w;
            const sy = (-vec.y + 1) / 2 * h;
            
            // 6. Visibility (Clip Space)
            const visible = (Math.abs(vec.z) <= 1);
            
            return { x: sx, y: sy, p: p, visible: visible };
        };

        // Update Fighters
        const dt = 0.016; // Approx 60fps
        
        this.squadron.forEach(fighter => {
            // 1. Update Physics/Logic
            fighter.update(dt, bass, isSpeaking);

            // 2. Sync Three.js Mesh
            if (fighter.mesh) {
                fighter.mesh.position.set(fighter.pos.x, fighter.pos.y, fighter.pos.z);
                
                // Scale
                const s = fighter.scale; 
                fighter.mesh.scale.set(s, s, s);
                
                // Recoil (Rotate mesh locally)
                fighter.mesh.rotation.x = fighter.recoilPitch || 0;
            }
            
            // 3. Draw 2D Effects (Exhaust, Labels) on ctx
            // Note: This draws ON TOP of the 2D background, but BEHIND the 3D canvas?
            // Wait, webgl-canvas is ON TOP.
            // So this draws BEHIND the fighter. Correct for Exhaust.
            // Incorrect for Labels? Labels might be occluded if behind.
            // But since labels are usually "offset", they might be visible.
            if (fighter.drawEffects) {
                 fighter.drawEffects(this.ctx, transformFn, bass);
             }
         });
         
         // Update and Render Missiles
         this.missileSystem.update(dt);
         this.missileSystem.render(this.ctx, transformFn);
 
         // Render Three.js Scene
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    /**
     * Main Render Loop
     * @param {AnalyserNode} analyser 
     * @param {Uint8Array} dataArray 
     * @param {number} bufferLength 
     * @param {Object} theme 
     * @param {Object} extras
     */
    draw(analyser, dataArray, bufferLength, theme, extras) {
        // Entrance Effect Check (Re-entered after >500ms pause)
        const now = Date.now();
        if (this.lastDrawTime && (now - this.lastDrawTime > 500)) {
            this.zoom = 2.0;
        }
        this.lastDrawTime = now;

        // Zoom Interpolation
        this.zoom += (this.targetZoom - this.zoom) * 0.05;

        analyser.getByteFrequencyData(dataArray);
        const { ctx, width: w, height: h } = this;
        
        if (this.particles.length === 0) this.initParticles(w, h);

        let bass = 0;
        for(let i=0; i<20; i++) bass += dataArray[i];
        bass = bass / 20 / 255; 

        const cx = w / 2;
        const cy = h / 2;
        const speedBase = 1 + bass * 8;

        // Render Background Particles
        ctx.globalCompositeOperation = 'lighter'; 

        this.particles.forEach((p) => {
            const oldX = p.x;
            const oldY = p.y;
            
            let dx = p.x - cx;
            let dy = p.y - cy;
            let dist = Math.sqrt(dx*dx + dy*dy);
            let angle = Math.atan2(dy, dx);
            
            const maxDist = Math.max(w, h) * 0.8;
            if (dist < 5 || dist > maxDist) {
                angle = Math.random() * Math.PI * 2;
                dist = 10 + Math.random() * 20;
                p.x = cx + Math.cos(angle) * dist;
                p.y = cy + Math.sin(angle) * dist;
                return;
            }

            angle += 0.01 * p.randomSpeed * (bass > 0.5 ? 2 : 1); 
            dist += speedBase * p.randomSpeed * 5;

            p.x = cx + Math.cos(angle) * dist;
            p.y = cy + Math.sin(angle) * dist;

            const size = p.baseSize * (0.3 + bass * 0.7);
            const alpha = Math.min(1, (dist / (w/3))); 

            ctx.beginPath();
            ctx.moveTo(oldX, oldY);
            ctx.lineTo(p.x, p.y);
            ctx.lineWidth = size;
            ctx.strokeStyle = p.colorType === 'primary' ? theme.primary : theme.secondary;
            ctx.lineCap = 'round';
            ctx.globalAlpha = alpha;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(p.x, p.y, size * 0.6, 0, Math.PI*2);
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = alpha;
            ctx.fill();
        });
        
        ctx.globalCompositeOperation = 'source-over'; 
        ctx.globalAlpha = 1.0;

        // Determine isSpeaking
        const isSpeaking = extras && (extras.opacity > 0.01 || (extras.callsign && extras.callsign.length > 0));

        // Draw 3D Sci-Fi Plane(s)
        this.draw3DPlane(w, h, bass, theme, isSpeaking);

        this.drawTime(theme);
    }
}
