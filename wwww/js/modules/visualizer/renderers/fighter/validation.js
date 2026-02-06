/**
 * 战机缩放同步功能验证脚本
 * 用于验证模型缩放和尾焰特效同步的正确性
 */

import { SpaceFighter } from './fighter.js';

/**
 * 验证战机编号格式
 * @returns {boolean} 是否所有编号格式正确
 */
export function validateIdFormat() {
    console.log('=== 验证战机编号格式 ===');
    
    const testCount = 10;
    const idPattern = /^XV-\d{3}$/;
    let allValid = true;
    
    for (let i = 0; i < testCount; i++) {
        const fighter = new SpaceFighter(Math.random());
        const isValid = idPattern.test(fighter.id);
        
        console.log(`战机 ${i + 1}: ID = ${fighter.id} ${isValid ? '✓' : '✗'}`);
        
        if (!isValid) {
            allValid = false;
        }
    }
    
    console.log(`编号格式验证: ${allValid ? '✅ 通过' : '❌ 失败'}`);
    return allValid;
}

/**
 * 验证缩放同步功能
 * @returns {boolean} 缩放同步是否正确
 */
export function validateScaleSync() {
    console.log('\n=== 验证缩放同步功能 ===');
    
    const fighter = new SpaceFighter(0.5);
    const testScales = [0.5, 1.0, 1.5, 2.0];
    let allSynced = true;
    
    testScales.forEach(scale => {
        fighter.setScale(scale);
        
        const modelScale = fighter.scale;
        const exhaustScale = fighter.exhaust.fighterScale;
        const isSynced = modelScale === exhaustScale;
        
        console.log(`缩放 ${scale}x: 模型=${modelScale}, 尾焰=${exhaustScale} ${isSynced ? '✓' : '✗'}`);
        
        if (!isSynced) {
            allSynced = false;
        }
    });
    
    console.log(`缩放同步验证: ${allSynced ? '✅ 通过' : '❌ 失败'}`);
    return allSynced;
}

/**
 * 验证边界条件
 * @returns {boolean} 边界条件处理是否正确
 */
export function validateBoundaryConditions() {
    console.log('\n=== 验证边界条件 ===');
    
    const fighter = new SpaceFighter(0.5);
    
    // 测试过小值
    fighter.setScale(0.05);
    const minScale = fighter.scale;
    const minValid = minScale === 0.1;
    console.log(`最小缩放限制: 设置=0.05, 实际=${minScale} ${minValid ? '✓' : '✗'}`);
    
    // 测试过大值
    fighter.setScale(5.0);
    const maxScale = fighter.scale;
    const maxValid = maxScale === 3.0;
    console.log(`最大缩放限制: 设置=5.0, 实际=${maxScale} ${maxValid ? '✓' : '✗'}`);
    
    const allValid = minValid && maxValid;
    console.log(`边界条件验证: ${allValid ? '✅ 通过' : '❌ 失败'}`);
    return allValid;
}

/**
 * 运行所有验证测试
 */
export function runAllTests() {
    console.log('🚀 开始战机缩放同步功能验证\n');
    
    const results = {
        idFormat: validateIdFormat(),
        scaleSync: validateScaleSync(),
        boundaries: validateBoundaryConditions()
    };
    
    console.log('\n=== 验证总结 ===');
    console.log(`编号格式: ${results.idFormat ? '✅' : '❌'}`);
    console.log(`缩放同步: ${results.scaleSync ? '✅' : '❌'}`);
    console.log(`边界条件: ${results.boundaries ? '✅' : '❌'}`);
    
    const allPassed = Object.values(results).every(result => result);
    console.log(`\n总体结果: ${allPassed ? '🎉 所有测试通过!' : '⚠️  部分测试失败'}`);
    
    return allPassed;
}

// 如果直接运行此脚本，执行测试
if (import.meta.url === new URL(import.meta.url).href) {
    runAllTests();
}