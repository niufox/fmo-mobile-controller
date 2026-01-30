export class BaseRenderer {
    constructor(ctx) { 
        this.ctx = ctx; 
        this.width = 0; 
        this.height = 0; 
    }
    
    resize(w, h) { 
        this.width = w; 
        this.height = h; 
    }
    
    draw(analyser, dataArray, bufferLength, theme) {}
}
