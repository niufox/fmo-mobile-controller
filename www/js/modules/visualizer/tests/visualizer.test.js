/**
 * Simple Unit Test for Visualizer Module
 * 可视化模块的简单单元测试
 * Run this in browser console or via a test runner
 * 在浏览器控制台或通过测试运行器运行此程序
 */

import { Visualizer } from '../index.js';

class MockContext {
    constructor() {
        this.canvas = { clientWidth: 800, clientHeight: 600 };
    }
    clearRect() {}
    beginPath() {}
    moveTo() {}
    lineTo() {}
    stroke() {}
    fill() {}
    save() {}
    restore() {}
    translate() {}
    scale() {}
    rotate() {}
    createLinearGradient() {
        return { addColorStop: () => {} };
    }
    measureText() { return { width: 10 }; }
    fillText() {}
}

class MockCanvas {
    constructor() {
        this.width = 800;
        this.height = 600;
        this.clientWidth = 800;
        this.clientHeight = 600;
        this._listeners = {};
    }
    getContext(type) {
        return new MockContext();
    }
    addEventListener(event, callback) {
        this._listeners[event] = callback;
    }
    getBoundingClientRect() {
        return { left: 0, top: 0, width: 800, height: 600 };
    }
}

class MockAnalyser {
    constructor() {
        this.frequencyBinCount = 128;
    }
    getByteFrequencyData(array) {
        array.fill(100);
    }
    getByteTimeDomainData(array) {
        array.fill(128);
    }
}

// Global mocks for browser APIs
// 浏览器 API 的全局模拟
if (typeof ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
        observe() {}
        disconnect() {}
    };
}

export function runTests() {
    console.log('Running Visualizer Tests...');
    let passed = 0;
    let failed = 0;

    const assert = (condition, message) => {
        if (condition) {
            console.log(`✅ PASS: ${message}`);
            passed++;
        } else {
            console.error(`❌ FAIL: ${message}`);
            failed++;
        }
    };

    try {
        // Test 1: Instantiation
        // 测试 1：实例化
        const canvas = new MockCanvas();
        const analyser = new MockAnalyser();
        const viz = new Visualizer(canvas, analyser);
        assert(viz instanceof Visualizer, 'Visualizer should instantiate correctly');
        assert(viz.mode === 0, 'Initial mode should be 0 (SOLAR)');
        assert(viz.renderers.length === 7, 'Should have 7 renderers initialized');

        // Test 2: Mode Switching
        // 测试 2：模式切换
        const mode1 = viz.switchMode();
        assert(viz.mode === 1, 'Should switch to mode 1');
        assert(mode1 === 'SPECTRUM', 'Mode 1 should be SPECTRUM');

        // Test 3: Formation Creation
        // 测试 3：编队创建
        viz.createFighterFormation(9);
        assert(viz.mode === 6, 'Should switch to PARTICLES mode after formation creation');
        
        // Test 4: Renderer Resize
        // 测试 4：渲染器调整大小
        viz.resize();
        assert(canvas.width === 800, 'Canvas width should be set');

    } catch (e) {
        console.error('Test Suite Error:', e);
        failed++;
    }

    console.log(`Tests Completed. Passed: ${passed}, Failed: ${failed}`);
    return { passed, failed };
}

// Run if in appropriate environment
// 如果在适当的环境中则运行
if (typeof window !== 'undefined') {
    window.runVisualizerTests = runTests;
}
