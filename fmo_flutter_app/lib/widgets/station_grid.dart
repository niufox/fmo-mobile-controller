import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/websocket_service.dart';
import '../theme.dart';

class StationGrid extends StatelessWidget {
  const StationGrid({super.key});

  @override
  Widget build(BuildContext context) {
    final wsService = Provider.of<WebSocketService>(context);

    return StreamBuilder<List<dynamic>>(
      stream: wsService.stationList,
      initialData: const [],
      builder: (context, snapshot) {
        final stations = snapshot.data ?? [];
        
        return StreamBuilder<dynamic>(
          stream: wsService.currentStation,
          builder: (context, currSnapshot) {
            final currentUid = currSnapshot.data?['uid'];

            return GridView.builder(
              padding: const EdgeInsets.all(8),
              gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                maxCrossAxisExtent: 160,
                childAspectRatio: 1.5,
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
              ),
              itemCount: stations.length,
              itemBuilder: (context, index) {
                final station = stations[index];
                final isCurrent = station['uid'] == currentUid;

                return InkWell(
                  onTap: () => wsService.setStation(station['uid']),
                  child: Container(
                    decoration: BoxDecoration(
                      color: isCurrent 
                          ? AppTheme.accentCyan.withOpacity(0.2) 
                          : Colors.white.withOpacity(0.05),
                      border: Border.all(
                        color: isCurrent ? AppTheme.accentCyan : Colors.transparent,
                      ),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    padding: const EdgeInsets.all(8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          '${station['freq'] ?? '---'} kHz',
                          style: TextStyle(
                            color: isCurrent ? AppTheme.accentCyan : AppTheme.textMain,
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          station['mode'] ?? 'USB',
                          style: TextStyle(
                            color: AppTheme.textMuted,
                            fontSize: 12,
                          ),
                        ),
                        const Spacer(),
                        Text(
                          station['des'] ?? 'No Desc',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: AppTheme.textMain,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            );
          },
        );
      },
    );
  }
}
