import 'package:flutter/material.dart';

class AppTheme {
  static const Color bgColor = Color(0xFF121212);
  static const Color panelBg = Color(0xFF1E1E1E);
  static const Color textMain = Color(0xFFE0E0E0);
  static const Color textMuted = Color(0xFF888888);
  static const Color accentCyan = Color(0xFFFF9800); // Main Orange
  static const Color accentMagenta = Color(0xFFFFB74D); // Secondary Orange
  static const Color accentGreen = Color(0xFF4CAF50);
  static const Color borderColor = Color(0xFF333333);
  static const Color vizBg = Color(0xFF1A1A1A);

  static ThemeData get theme {
    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: bgColor,
      colorScheme: const ColorScheme.dark(
        primary: accentCyan,
        secondary: accentMagenta,
        surface: panelBg,
        background: bgColor,
      ),
      textTheme: const TextTheme(
        bodyLarge: TextStyle(color: textMain),
        bodyMedium: TextStyle(color: textMain),
        bodySmall: TextStyle(color: textMuted),
      ),
      iconTheme: const IconThemeData(color: textMain),
    );
  }
}
