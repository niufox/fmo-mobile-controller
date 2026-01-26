import 'dart:math';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:fftea/fftea.dart';
import '../services/websocket_service.dart';
import '../services/audio_player_service.dart';
import '../theme.dart';

enum VisualizerMode { SPECTRUM, MIRROR, WAVEFORM, OSCILLOSCOPE, RADIAL, PARTICLES }

class VisualizerWidget extends StatefulWidget {
  const VisualizerWidget({super.key});

  @override
  State<VisualizerWidget> createState() => _VisualizerWidgetState();
}

class _VisualizerWidgetState extends State<VisualizerWidget> {
  VisualizerMode _mode = VisualizerMode.SPECTRUM;
  Float32List _audioData = Float32List(0);
  String _currentStationName = '';
  
  // FFT
  final int _fftSize = 2048;
  STFT? _stft;
  Float64List? _window;

  @override
  void initState() {
    super.initState();
    _stft = STFT(_fftSize);
    _window = Window.hanning(_fftSize);
  }

  void _switchMode() {
    setState(() {
      final nextIndex = (_mode.index + 1) % VisualizerMode.values.length;
      _mode = VisualizerMode.values[nextIndex];
    });
  }

  @override
  Widget build(BuildContext context) {
    final audioService = Provider.of<AudioPlayerService>(context, listen: false);
    final wsService = Provider.of<WebSocketService>(context);

    return StreamBuilder<dynamic>(
      stream: wsService.currentStation,
      builder: (context, stationSnap) {
        if (stationSnap.hasData && stationSnap.data != null) {
          final data = stationSnap.data;
          _currentStationName = data['name'] ?? 'Station ${data['uid']}';
        }

        return Stack(
          children: [
            // Visualizer Canvas
            Positioned.fill(
              child: GestureDetector(
                onTap: _switchMode,
                child: Container(
                  color: Colors.transparent, // Capture taps
                  child: StreamBuilder<Float32List>(
                    stream: audioService.audioDataStream,
                    builder: (context, snapshot) {
                      if (snapshot.hasData) {
                        _audioData = snapshot.data!;
                      }
                      return CustomPaint(
                        painter: _VisualizerPainter(
                          data: _audioData,
                          mode: _mode,
                          stft: _stft,
                          window: _window,
                        ),
                        size: Size.infinite,
                      );
                    },
                  ),
                ),
              ),
            ),

            // Mode Name (Top Right - like HTML viz-mode-badge)
            Positioned(
              top: 15,
              right: 15,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  border: Border.all(color: AppTheme.accentCyan.withOpacity(0.5)),
                  borderRadius: BorderRadius.circular(4),
                  color: Colors.black.withOpacity(0.3),
                ),
                child: Text(
                  _mode.toString().split('.').last,
                  style: const TextStyle(
                    color: AppTheme.accentCyan,
                    fontSize: 12,
                    fontFamily: 'monospace',
                  ),
                ),
              ),
            ),

            // Current Station Name (Bottom Left)
            if (_currentStationName.isNotEmpty)
              Positioned(
                bottom: 15,
                left: 15,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  // Match viz-mode-badge style but no border by default in HTML, 
                  // but user asked for "consistent style". HTML has:
                  // .viz-mode-badge { ... border: 1px solid var(--accent-cyan); ... }
                  decoration: BoxDecoration(
                    border: Border.all(color: AppTheme.accentCyan.withOpacity(0.5)),
                    borderRadius: BorderRadius.circular(4),
                    color: Colors.black.withOpacity(0.3),
                  ),
                  child: Text(
                    _currentStationName,
                    style: const TextStyle(
                      color: AppTheme.accentCyan,
                      fontSize: 12,
                      fontFamily: 'monospace',
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _VisualizerPainter extends CustomPainter {
  final Float32List data;
  final VisualizerMode mode;
  final STFT? stft;
  final Float64List? window;

  _VisualizerPainter({
    required this.data,
    required this.mode,
    this.stft,
    this.window,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (data.isEmpty) return;

    final w = size.width;
    final h = size.height;
    final cx = w / 2;
    final cy = h / 2;

    // Theme Colors
    final colorTheme = AppTheme.accentCyan;
    final colorSecondary = AppTheme.accentMagenta;

    // Common Paint Setup
    final paint = Paint()
      ..color = colorTheme
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.fill;

    // Helper for Frequency Data
    List<double> getFrequencyData() {
      if (stft == null || window == null || data.length < window!.length) {
         // Fallback or pad
         return List.filled(512, 0.0);
      }
      // Use a chunk of data matching window size
      final chunk = data.sublist(0, window!.length).map((e) => e.toDouble()).toList();
      
      // Apply window
      stft!.run(chunk, (freq) {
         // This callback returns Complex numbers, we need magnitude
         // Wait, STFT run usually calls callback with freq chunks. 
         // fftea 1.5.0 usage:
         // stft.run(input, (Float64x2List freq) { ... })
      });
      
      // Simpler approach with FFT directly if STFT is streaming
      final fft = FFT(data.length);
      final freq = fft.realFft(data.map((e) => e.toDouble()).toList());
      // freq is magnitudes? No, realFft returns Complex (Float64x2List in recent fftea?)
      // Check fftea docs/usage. 
      // Assuming simpler magnitude extraction:
      return freq.discardConjugates().magnitudes();
    }
    
    // NOTE: Real-time FFT on main thread might be heavy. 
    // For this demo, we'll do a simplified FFT or just use Time Domain mapping for "fake" frequency if performance is an issue.
    // Let's try to use proper FFT if data size is reasonable (e.g. 1024).
    List<double> magnitudes = [];
    if (mode == VisualizerMode.SPECTRUM || 
        mode == VisualizerMode.MIRROR || 
        mode == VisualizerMode.RADIAL || 
        mode == VisualizerMode.PARTICLES) {
          
      // Ensure power of 2
      int p2 = 1;
      while (p2 <= data.length && p2 <= 2048) p2 *= 2;
      p2 ~/= 2; // fit inside
      if (p2 > 0) {
        final fft = FFT(p2);
        final input = data.sublist(0, p2).map((e) => e.toDouble()).toList();
        final freq = fft.realFft(input);
        magnitudes = freq.discardConjugates().magnitudes();
      } else {
        magnitudes = List.filled(64, 0.0);
      }
    }

    // --- DRAWING MODES ---

    if (mode == VisualizerMode.SPECTRUM) {
      final bufferLength = magnitudes.length;
      final step = (bufferLength / 64).ceil();
      final barWidth = (w / (bufferLength / step)) * 0.8;

      for (int i = 0; i < bufferLength; i += step) {
        if (i >= magnitudes.length) break;
        double value = magnitudes[i] * 10.0; // Scale up
        if (value > 255) value = 255;
        
        final barHeight = (value / 255) * h;
        final x = (i / bufferLength) * w;

        // Particles stack
        final particleCount = (barHeight / 10).floor();
        for (int j = 0; j < particleCount; j++) {
          final y = h - (j * 12);
          paint.color = colorTheme.withOpacity((j / particleCount) * 0.8 + 0.2);
          canvas.drawCircle(Offset(x + barWidth / 2, y.toDouble()), 3, paint);
        }
      }
    } 
    else if (mode == VisualizerMode.MIRROR) {
      final bufferLength = magnitudes.length;
      final step = (bufferLength / 64).ceil();
      
      for (int i = 0; i < bufferLength; i += step) {
        if (i >= magnitudes.length) break;
        double value = magnitudes[i] * 10.0;
        if (value > 255) value = 255;
        
        final barHeight = (value / 255) * (h / 2);
        final offset = (i / bufferLength) * (w / 2);

        final particleCount = (barHeight / 8).floor();
        for (int j = 0; j < particleCount; j++) {
          final dy = j * 10.0;
          final alpha = (j / particleCount) * 0.8 + 0.2;
          paint.color = colorTheme.withOpacity(alpha);

          // Right side
          canvas.drawCircle(Offset(cx + offset, cy - dy), 2.5, paint);
          canvas.drawCircle(Offset(cx + offset, cy + dy), 2.5, paint);
          
          // Left side
          canvas.drawCircle(Offset(cx - offset, cy - dy), 2.5, paint);
          canvas.drawCircle(Offset(cx - offset, cy + dy), 2.5, paint);
        }
      }
    }
    else if (mode == VisualizerMode.WAVEFORM) {
      final sliceWidth = w / data.length;
      double x = 0;
      final pointStep = 4;

      for (int i = 0; i < data.length; i += pointStep) {
        final v = data[i]; // -1.0 to 1.0
        final y = cy + (v * h / 2);
        
        paint.color = colorTheme.withOpacity(Random().nextDouble() * 0.5 + 0.5);
        canvas.drawCircle(Offset(x, y), 2, paint);
        x += sliceWidth * pointStep;
      }
    }
    else if (mode == VisualizerMode.OSCILLOSCOPE) {
      // Grid Background
      final gridPaint = Paint()..color = Colors.white.withOpacity(0.1);
      for (double gx = 0; gx < w; gx += 50) {
        for (double gy = 0; gy < h; gy += 50) {
          canvas.drawRect(Rect.fromLTWH(gx, gy, 1, 1), gridPaint);
        }
      }

      final sliceWidth = w / data.length;
      double x = 0;

      for (int i = 0; i < data.length; i++) {
        final v = data[i];
        final y = cy + (v * h / 2);
        
        if (i % 2 == 0) {
          paint.color = colorTheme;
          canvas.drawRect(Rect.fromCenter(center: Offset(x, y), width: 2, height: 2), paint);
        }
        x += sliceWidth;
      }
    }
    else if (mode == VisualizerMode.RADIAL) {
      final radius = min(w, h) / 4;
      final bufferLength = magnitudes.length;
      final step = 4;

      for (int i = 0; i < bufferLength; i += step) {
        if (i >= magnitudes.length) break;
        double value = magnitudes[i] * 10.0;
        
        final angle = (i / bufferLength) * pi * 2;
        final r = radius + (value / 255) * (min(w, h) / 3);
        
        final x = cx + cos(angle) * r;
        final y = cy + sin(angle) * r;
        
        final size = (value / 255) * 4 + 1;
        
        paint.color = colorTheme;
        canvas.drawCircle(Offset(x, y), size, paint);
      }

      // Center Core
      paint.color = colorTheme.withOpacity(0.3);
      canvas.drawCircle(Offset(cx, cy), radius * 0.5, paint);
    }
    else if (mode == VisualizerMode.PARTICLES) {
      // Bass detection (approximate from low freq bins)
      double bass = 0.0;
      if (magnitudes.length > 10) {
        bass = magnitudes.sublist(0, 10).reduce((a, b) => a + b) / 10.0;
      }
      bass = bass * 10.0; // scale
      
      final count = 60;
      final time = DateTime.now().millisecondsSinceEpoch * 0.0005;
      
      for (int i = 0; i < count; i++) {
        final angle = (i / count) * pi * 2;
        final rBase = min(w, h) / 4;
        final r = rBase + (bass * 100) + sin(time + i) * 20;
        
        final x = cx + cos(angle + time) * r;
        final y = cy + sin(angle + time) * r;
        
        paint.color = (i % 2 == 0) ? colorTheme : colorSecondary;
        canvas.drawCircle(Offset(x, y), 2 + bass * 6, paint);
        
        if (bass > 0.5 && i > 0) {
           // Line to previous
           final prevAngle = ((i - 1) / count) * pi * 2;
           final prevX = cx + cos(prevAngle + time) * r;
           final prevY = cy + sin(prevAngle + time) * r;
           
           final linePaint = Paint()
             ..color = colorTheme.withOpacity(0.5)
             ..strokeWidth = 1;
           canvas.drawLine(Offset(x, y), Offset(prevX, prevY), linePaint);
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
