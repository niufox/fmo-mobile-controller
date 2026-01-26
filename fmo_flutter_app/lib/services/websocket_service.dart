import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:web_socket_channel/status.dart' as status;

class WebSocketService with ChangeNotifier {
  WebSocketChannel? _channel;
  bool _connected = false;
  String _host = '';
  Timer? _reconnectTimer;
  Timer? _updateTimer;

  // Fetching state
  bool _fetchingAll = false;
  List<dynamic> _tempStationList = [];
  int _fetchStart = 0;
  final int _fetchPageSize = 20;

  bool get connected => _connected;

  // Streams for UI
  final _stationListController = StreamController<List<dynamic>>.broadcast();
  Stream<List<dynamic>> get stationList => _stationListController.stream;

  final _currentStationController = StreamController<dynamic>.broadcast();
  Stream<dynamic> get currentStation => _currentStationController.stream;

  final _qsoListController = StreamController<List<dynamic>>.broadcast();
  Stream<List<dynamic>> get qsoList => _qsoListController.stream;

  void connect(String host) {
    _host = host;
    _disconnect();

    try {
      final uri = Uri.parse('ws://$host/ws');
      _channel = WebSocketChannel.connect(uri);
      _connected = true;
      notifyListeners();

      _channel!.stream.listen(
        (message) {
          _handleMessage(message);
        },
        onDone: () {
          _connected = false;
          notifyListeners();
          _scheduleReconnect();
        },
        onError: (error) {
          print('WS Error: $error');
          _connected = false;
          notifyListeners();
          _scheduleReconnect();
        },
      );

      // Start auto-update
      _startAutoUpdate();
      
      // Initial fetch
      fetchList();
      send('station', 'getCurrent');

    } catch (e) {
      print('Connection failed: $e');
      _scheduleReconnect();
    }
  }

  void _disconnect() {
    _channel?.sink.close(status.goingAway);
    _channel = null;
    _connected = false;
    _updateTimer?.cancel();
    notifyListeners();
  }

  void _scheduleReconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 3), () {
      if (_host.isNotEmpty) connect(_host);
    });
  }

  void _startAutoUpdate() {
    _updateTimer?.cancel();
    _updateTimer = Timer.periodic(const Duration(seconds: 30), (timer) {
      if (_connected) {
        fetchList();
      }
    });
  }

  // Fetch complete list (batched)
  void fetchList() {
    if (_fetchingAll) return;
    
    _fetchingAll = true;
    _tempStationList = [];
    _fetchStart = 0;
    
    send('station', 'getListRange', {'start': 0, 'count': _fetchPageSize});
  }

  void send(String type, String subType, [Map<String, dynamic>? data]) {
    if (_channel != null && _connected) {
      final msg = jsonEncode({
        'type': type,
        'subType': subType,
        'data': data ?? {},
      });
      _channel!.sink.add(msg);
    }
  }

  void _handleMessage(String message) {
    try {
      final data = jsonDecode(message);
      if (data['type'] == 'station') {
        switch (data['subType']) {
          case 'getListResponse':
            final newList = (data['data']['list'] as List?) ?? [];
            final start = data['data']['start'];

            if (_fetchingAll) {
              // Verify start order
              if (start != null && start != _fetchStart) {
                print('Fetch order mismatch: expected $_fetchStart, got $start');
                _fetchingAll = false;
                return;
              }

              _tempStationList.addAll(newList);

              if (newList.length < _fetchPageSize) {
                // Done
                print('Fetch complete. Total: ${_tempStationList.length}');
                final filteredList = _tempStationList.where((i) => i != null).toList();
                _stationListController.add(filteredList);
                _fetchingAll = false;
                _tempStationList = [];
              } else {
                // Next page
                _fetchStart += _fetchPageSize;
                print('Fetching next page: start=$_fetchStart');
                send('station', 'getListRange', {'start': _fetchStart, 'count': _fetchPageSize});
              }
            } else {
              // Legacy/Single update support
              if ((start == 0 || start == null) && newList.isNotEmpty) {
                 _stationListController.add(newList);
              }
            }
            break;
          case 'getCurrentResponse':
            _currentStationController.add(data['data']);
            break;
          case 'stationCurrent': // Event pushed from server
             _currentStationController.add(data['data']);
             break;
        }
      } else if (data['type'] == 'qso') {
         if (data['subType'] == 'getListResponse') {
           _qsoListController.add(data['data']['list'] ?? []);
         }
      }
    } catch (e) {
      print('Parse error: $e');
    }
  }

  // Commands
  void setStation(int uid) {
    send('station', 'setCurrent', {'uid': uid});
    // Delay 3000ms before fetching current station to ensure server state update
    Timer(const Duration(seconds: 3), () => send('station', 'getCurrent'));
  }
  
  void nextStation() {
    send('station', 'next');
    Timer(const Duration(seconds: 3), () => send('station', 'getCurrent'));
  }
  
  void prevStation() {
    send('station', 'prev');
    Timer(const Duration(seconds: 3), () => send('station', 'getCurrent'));
  }
  void getQsoList({int page = 0, int pageSize = 20}) {
    send('qso', 'getList', {'page': page, 'pageSize': pageSize});
  }

  @override
  void dispose() {
    _disconnect();
    _reconnectTimer?.cancel();
    _updateTimer?.cancel();
    _stationListController.close();
    _currentStationController.close();
    _qsoListController.close();
    super.dispose();
  }
}
