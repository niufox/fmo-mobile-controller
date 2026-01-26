import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:fftea/fftea.dart';
import '../services/audio_player_service.dart';
import '../theme.dart';

enum VisualizerMode { WAVEFORM, SPECTRUM }

class VisualizerWidget extends StatefulWidget {
  const VisualizerWidget({super.key});

  @override
  State<VisualizerWidget> createState() => _VisualizerWidgetState();
}

class _VisualizerWidgetState extends State<VisualizerWidget> {
  VisualizerMode _mode = VisualizerMode.WAVEFORM;
  Float32List _data = Float32List(0);
  
  // FFT Cache
  STFT? _stft;

  @override
  void initState() {
    super.initState();
  }

  @override
  Widget build(BuildContext context) {
    final audioService = Provider.of<AudioPlayerService>(context, listen: false);

    return Column(
      children: [
        // Mode Selector (Overlay or Header)
        Container(
          color: Colors.black26,
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              _modeBtn(VisualizerMode.WAVEFORM, 'WAVE'),
              _modeBtn(VisualizerMode.SPECTRUM, 'SPEC'),
            ],
          ),
        ),
        Expanded(
          child: StreamBuilder<Float32List>(
            stream: audioService.audioDataStream,
            builder: (context, snapshot) {
              if (snapshot.hasData) {
                _data = snapshot.data!;
              }
              return CustomPaint(
                painter: _VisualizerPainter(_data, _mode),
                size: Size.infinite,
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _modeBtn(VisualizerMode mode, String label) {
    return TextButton(
      onPressed: () => setState(() => _mode = mode),
      child: Text(
        label,
        style: TextStyle(
          color: _mode == mode ? AppTheme.accentCyan : AppTheme.textMuted,
          fontWeight: _mode == mode ? FontWeight.bold : FontWeight.normal,
        ),
      ),
    );
  }
}

class _VisualizerPainter extends CustomPainter {
  final Float32List data;
  final VisualizerMode mode;
  
  _VisualizerPainter(this.data, this.mode);

  @override
  void paint(Canvas canvas, Size size) {
    if (data.isEmpty) return;

    final paint = Paint()
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;

    if (mode == VisualizerMode.WAVEFORM) {
      paint.color = AppTheme.accentCyan;
      final path = Path();
      final step = size.width / data.length;
      final centerY = size.height / 2;
      final scale = size.height / 2;

      path.moveTo(0, centerY);
      for (int i = 0; i < data.length; i++) {
        path.lineTo(i * step, centerY + data[i] * scale);
      }
      canvas.drawPath(path, paint);
    } else if (mode == VisualizerMode.SPECTRUM) {
      // Simple Spectrum (Fake/Basic implementation for demo)
      // Real FFT requires more setup, here we just visualize amplitude bars for simplicity
      // or if we had FFT data. Since we receive raw PCM here, doing FFT in paint is expensive.
      // We will fall back to a "Mirrored Waveform" look for 'SPECTRUM' to avoid lag in this demo.
      paint.color = AppTheme.accentMagenta;
      final path = Path();
      final step = size.width / data.length;
      final centerY = size.height / 2;
      
      for (int i = 0; i < data.length; i+=2) { // Skip some points
        final h = data[i].abs() * size.height;
        canvas.drawLine(
          Offset(i * step, centerY - h/2),
          Offset(i * step, centerY + h/2),
          paint
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
