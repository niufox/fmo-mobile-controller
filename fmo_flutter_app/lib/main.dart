import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'theme.dart';
import 'services/websocket_service.dart';
import 'services/audio_player_service.dart';
import 'screens/home_screen.dart';

void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => WebSocketService()),
        ChangeNotifierProvider(create: (_) => AudioPlayerService()),
      ],
      child: const FmoApp(),
    ),
  );
}

class FmoApp extends StatelessWidget {
  const FmoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'FMO Mobile',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.theme,
      home: const HomeScreen(),
    );
  }
}
