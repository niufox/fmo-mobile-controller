import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/websocket_service.dart';
import '../services/audio_player_service.dart';
import '../widgets/visualizer.dart';
import '../widgets/station_grid.dart';
import '../widgets/control_bar.dart';
import '../theme.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final TextEditingController _hostController = TextEditingController();
  bool _showSettings = false;

  @override
  void initState() {
    super.initState();
    _loadLastHost();
  }

  Future<void> _loadLastHost() async {
    final prefs = await SharedPreferences.getInstance();
    final host = prefs.getString('last_host') ?? '192.168.1.100:8000';
    _hostController.text = host;
  }

  void _connect() {
    final host = _hostController.text;
    if (host.isEmpty) return;

    // Save
    SharedPreferences.getInstance().then((prefs) {
      prefs.setString('last_host', host);
    });

    // Connect Services
    Provider.of<WebSocketService>(context, listen: false).connect(host);
    Provider.of<AudioPlayerService>(context, listen: false).connect(host);
    
    setState(() => _showSettings = false);
  }

  @override
  Widget build(BuildContext context) {
    final wsConnected = context.select<WebSocketService, bool>((s) => s.connected);
    final audioConnected = context.select<AudioPlayerService, bool>((s) => s.connected);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppTheme.panelBg,
        title: const Text('FMO Mobile'),
        actions: [
          _statusBadge('WS', wsConnected),
          const SizedBox(width: 8),
          _statusBadge('AUDIO', audioConnected),
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () => setState(() => _showSettings = !_showSettings),
          ),
        ],
      ),
      body: Column(
        children: [
          if (_showSettings) _buildSettingsPanel(),
          
          // Visualizer Area
          const Expanded(
            flex: 4,
            child: VisualizerWidget(),
          ),

          // Controls
          const ControlBar(),

          // Station List
          const Expanded(
            flex: 6,
            child: StationGrid(),
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsPanel() {
    return Container(
      color: AppTheme.panelBg,
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          TextField(
            controller: _hostController,
            decoration: const InputDecoration(
              labelText: 'Server Host (IP:Port)',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.computer),
            ),
            style: const TextStyle(color: Colors.white),
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: _connect,
            icon: const Icon(Icons.link),
            label: const Text('CONNECT'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.accentCyan,
              foregroundColor: Colors.black,
            ),
          ),
        ],
      ),
    );
  }

  Widget _statusBadge(String label, bool connected) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: connected ? AppTheme.accentGreen : Colors.red,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white),
      ),
    );
  }
}
