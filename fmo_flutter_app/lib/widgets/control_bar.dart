import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/websocket_service.dart';
import '../services/audio_player_service.dart';
import '../theme.dart';

class ControlBar extends StatefulWidget {
  const ControlBar({super.key});

  @override
  State<ControlBar> createState() => _ControlBarState();
}

class _ControlBarState extends State<ControlBar> {
  double _volume = 0.8;

  @override
  Widget build(BuildContext context) {
    final wsService = Provider.of<WebSocketService>(context);
    final audioService = Provider.of<AudioPlayerService>(context);

    return Container(
      color: AppTheme.panelBg,
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Volume Slider
          Row(
            children: [
              const Icon(Icons.volume_down, color: AppTheme.textMuted),
              Expanded(
                child: Slider(
                  value: _volume,
                  activeColor: AppTheme.accentCyan,
                  inactiveColor: Colors.grey[800],
                  onChanged: (val) {
                    setState(() => _volume = val);
                    // TODO: Implement volume scaling in AudioPlayerService
                  },
                ),
              ),
              const Icon(Icons.volume_up, color: AppTheme.textMuted),
            ],
          ),
          const SizedBox(height: 16),
          // Buttons
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
               _circleBtn(
                icon: Icons.skip_previous,
                onTap: wsService.prevStation,
              ),
              _circleBtn(
                icon: audioService.connected ? Icons.stop : Icons.play_arrow,
                color: audioService.connected ? Colors.red : AppTheme.accentCyan,
                size: 64,
                onTap: () {
                   // Toggle Audio
                   // Need Host from somewhere. For now assuming WS service has it or stored globally.
                   // We will handle connection in Home Screen for now.
                },
              ),
              _circleBtn(
                icon: Icons.skip_next,
                onTap: wsService.nextStation,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _circleBtn({
    required IconData icon,
    VoidCallback? onTap,
    Color color = AppTheme.textMain,
    double size = 48,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(size/2),
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: color.withOpacity(0.5), width: 2),
          color: color.withOpacity(0.1),
        ),
        child: Icon(icon, color: color),
      ),
    );
  }
}
