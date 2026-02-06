export class Scene { add() {} }
export class PerspectiveCamera { 
    constructor() { this.position = { set: () => {} }; this.lookAt = () => {}; }
    updateProjectionMatrix() {} 
}
export class WebGLRenderer { 
    constructor() { this.domElement = {}; }
    setSize() {} 
    render() {} 
    setPixelRatio() {}
    getContext() { return { getExtension: () => {} }; }
    dispose() {}
}
export class AmbientLight {}
export class DirectionalLight { 
    constructor() { this.position = { set: () => {} }; } 
}
export class Group { add() {} }
export const Color = class {};
export const MathUtils = { degToRad: (d) => d * Math.PI / 180 };
export const Vector3 = class { 
    constructor() {} 
    set() { return this; } 
    copy() { return this; } 
    applyMatrix4() { return this; } 
    project() { return this; } 
    add() { return this; } 
    multiplyScalar() { return this; } 
    sub() { return this; } 
    length() { return 0; } 
    normalize() { return this; } 
};
export const Matrix4 = class {};

export class GLTFLoader {
    load(url, onLoad, onProgress, onError) {
        // Expose the callbacks to the test runner
        window.lastLoaderCallbacks = { onLoad, onProgress, onError };
        // Simulate immediate start
        if (onProgress) onProgress({ loaded: 0, total: 100 });
    }
}
