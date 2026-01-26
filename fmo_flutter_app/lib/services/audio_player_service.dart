import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:sound_stream/sound_stream.dart';

class AudioPlayerService with ChangeNotifier {
  WebSocketChannel? _channel;
  bool _connected = false;
  final PlayerStream _player = PlayerStream();
  
  // Stream for Visualizer (Float32 PCM)
  final _audioDataController = StreamController<Float32List>.broadcast();
  Stream<Float32List> get audioDataStream => _audioDataController.stream;

  bool get connected => _connected;

  AudioPlayerService() {
    _initAudio();
  }

  Future<void> _initAudio() async {
    await _player.initialize();
  }

  void connect(String host) {
    if (_connected) return;
    try {
      final uri = Uri.parse('ws://$host/audio');
      _channel = WebSocketChannel.connect(uri);
      _connected = true;
      notifyListeners();
      _player.start();

      _channel!.stream.listen(
        (message) {
          if (message is List<int>) {
            _handlePCM(Uint8List.fromList(message));
          }
        },
        onDone: _disconnect,
        onError: (e) => _disconnect(),
      );
    } catch (e) {
      print('Audio connect failed: $e');
      _disconnect();
    }
  }

  void _disconnect() {
    _channel?.sink.close();
    _channel = null;
    _connected = false;
    _player.stop();
    notifyListeners();
  }

  void _handlePCM(Uint8List data) {
    // 1. Play audio
    _player.writeChunk(data);

    // 2. Convert to Float32 for Visualizer
    // Incoming is Int16LE
    final int16 = Int16List.view(data.buffer);
    final float32 = Float32List(int16.length);
    for (int i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }
    _audioDataController.add(float32);
  }

  @override
  void dispose() {
    _disconnect();
    _player.dispose();
    _audioDataController.close();
    super.dispose();
  }
}
