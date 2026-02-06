import socket
import time
import threading
import sys
import re

# ===================== 适配你的Mac环境配置 =====================
ESP32_IP = "192.168.10.73"          # 你的ESP32实际IP
ESP32_PORT = 80                     # AsyncTcpServer监听端口（80端口）
SERIAL_PORT = "/dev/cu.usbmodem2011101"  # Mac下的ESP32串口路径
SERIAL_BAUDRATE = 9600            # 串口波特率（保持默认）
START_CONCURRENT = 30                # 起始并发数（从1开始）
STEP = 2                            # 每次增加1个并发（精准定位）
MAX_CONCURRENT = 150                 # 最大测试并发数（可按需调大）
TEST_DELAY = 5                      # 每个并发数测试持续5秒
REBOOT_DETECT_KEYWORD = "Backtrace" # 触发崩溃的关键词（Backtrace）

# ===================== 全局变量 =====================
crash_concurrent = 0                # 崩溃临界并发数
esp32_alive = True                  # ESP32存活状态
serial_thread_running = True        # 串口线程运行标记

def read_serial_output():
    """Mac下监听ESP32串口，检测Backtrace崩溃关键词"""
    global esp32_alive, serial_thread_running
    import serial
    try:
        # Mac下串口配置（增加超时和重试，适配Mac串口特性）
        ser = serial.Serial(
            port=SERIAL_PORT,
            baudrate=SERIAL_BAUDRATE,
            timeout=1,
            parity=serial.PARITY_NONE,
            stopbits=serial.STOPBITS_ONE,
            bytesize=serial.EIGHTBITS
        )
        time.sleep(2)  # Mac串口初始化延迟更长，需等待
        print(f"[串口监听] 已连接Mac串口 {SERIAL_PORT}，波特率 {SERIAL_BAUDRATE}")
        
        while serial_thread_running:
            if ser.in_waiting > 0:
                try:
                    # Mac下串口输出可能有乱码，忽略解码错误
                    line = ser.readline().decode('utf-8', errors='ignore').strip()
                    if line:
                        print(f"[ESP32串口] {line}")
                        # 检测到Backtrace关键词，标记ESP32崩溃
                        if REBOOT_DETECT_KEYWORD in line:
                            esp32_alive = False
                            print(f"\n[!] 检测到ESP32崩溃（触发Backtrace关键词）！")
                except Exception as e:
                    # 忽略Mac串口偶尔的解码异常
                    pass
        ser.close()
    except serial.SerialException as e:
        print(f"\n[串口错误] 无法连接串口 {SERIAL_PORT}")
        print(f"  可能原因：1. ESP32未连接 2. 串口被其他工具占用 3. 权限不足（需sudo运行）")
        print(f"  解决方法：运行命令 → sudo chmod 777 {SERIAL_PORT}")
        serial_thread_running = False
        sys.exit(1)
    except Exception as e:
        print(f"[串口监听错误] {e}")
        serial_thread_running = False
        sys.exit(1)

def tcp_client(client_id, concurrent):
    """单个TCP客户端（适配80端口，模拟真实HTTP请求）"""
    global esp32_alive
    sock = None
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)  # Mac下网络超时设为5秒（更稳定）
        # 连接ESP32 80端口
        sock.connect((ESP32_IP, ESP32_PORT))
        print(f"[并发{concurrent}] 客户端{client_id} 连接成功（{ESP32_IP}:{ESP32_PORT}）")
        
        # 模拟浏览器发送HTTP请求（更贴近你的AsyncTcpServer实际场景）
        start_time = time.time()
        while time.time() - start_time < TEST_DELAY and esp32_alive:
            # 发送简单HTTP GET请求（适配80端口的Web服务场景）
            http_request = f"GET / HTTP/1.1\r\nHost: {ESP32_IP}\r\nConnection: keep-alive\r\n\r\n"
            sock.sendall(http_request.encode())
            time.sleep(0.5)  # 每0.5秒发一次请求，模拟持续交互
        
        sock.close()
        print(f"[并发{concurrent}] 客户端{client_id} 正常断开")
    except ConnectionRefusedError:
        print(f"[并发{concurrent}] 客户端{client_id} 连接被拒绝（ESP32已崩溃）")
        esp32_alive = False
    except socket.timeout:
        print(f"[并发{concurrent}] 客户端{client_id} 连接超时（ESP32无响应）")
    except Exception as e:
        print(f"[并发{concurrent}] 客户端{client_id} 异常: {e}")
    finally:
        if sock:
            try:
                sock.close()
            except:
                pass

def test_concurrent(concurrent):
    """测试指定并发数"""
    global esp32_alive
    esp32_alive = True  # 重置ESP32状态
    
    print(f"\n========================================")
    print(f"开始测试并发数：{concurrent}")
    print(f"测试持续时间：{TEST_DELAY}秒")
    print("========================================")
    
    # 启动并发客户端（Mac下线程创建需稍作延迟）
    threads = []
    for i in range(concurrent):
        t = threading.Thread(target=tcp_client, args=(i+1, concurrent))
        t.daemon = True
        threads.append(t)
        t.start()
        time.sleep(0.05)  # Mac下更短的连接间隔，模拟真实并发
    
    # 等待测试完成或检测到崩溃
    start_time = time.time()
    while time.time() - start_time < TEST_DELAY and esp32_alive:
        time.sleep(0.1)
    
    # 等待所有线程结束
    for t in threads:
        t.join(timeout=3)
    
    # 返回是否崩溃
    if not esp32_alive:
        return True
    else:
        print(f"\n[√] 并发数{concurrent}测试通过，ESP32未崩溃")
        return False

def main():
    global crash_concurrent, serial_thread_running
    
    # 检查pyserial依赖
    try:
        import serial
    except ImportError:
        print("请先安装pyserial（Mac下运行）：")
        print("  pip3 install pyserial")
        sys.exit(1)
    
    # 启动串口监听线程（Mac下后台运行）
    serial_thread = threading.Thread(target=read_serial_output)
    serial_thread.daemon = True
    serial_thread.start()
    time.sleep(3)  # 等待Mac串口完全就绪
    
    # 检查串口线程是否正常启动
    if not serial_thread_running:
        sys.exit(1)
    
    # 逐步加压测试
    for concurrent in range(START_CONCURRENT, MAX_CONCURRENT + 1, STEP):
        if test_concurrent(concurrent):
            crash_concurrent = concurrent
            break
        # 测试间隙休息，让ESP32恢复（Mac下网络恢复稍慢）
        time.sleep(3)
    
    # 输出测试结果
    print("\n========================================")
    print("              测试结果                  ")
    print("========================================")
    if crash_concurrent > 0:
        print(f"❌ ESP32崩溃阈值：{crash_concurrent} 个并发连接")
        print(f"   建议：将最大并发数限制在 {crash_concurrent - 2} 以内")
    else:
        print(f"✅ 测试完成（最大{MAX_CONCURRENT}并发），ESP32未崩溃")
    print("========================================")
    
    # 停止串口监听
    serial_thread_running = False
    serial_thread.join(timeout=2)
    sys.exit(0)

if __name__ == "__main__":
    # Mac下欢迎信息
    print("========================================")
    print("ESP32 AsyncTcpServer 并发崩溃阈值测试（Mac版）")
    print("========================================")
    print(f"测试配置：")
    print(f"  - ESP32地址：{ESP32_IP}:{ESP32_PORT}")
    print(f"  - Mac串口：{SERIAL_PORT} ({SERIAL_BAUDRATE}bps)")
    print(f"  - 崩溃关键词：{REBOOT_DETECT_KEYWORD}")
    print(f"  - 测试范围：{START_CONCURRENT} ~ {MAX_CONCURRENT} 并发")
    print("========================================")
    input("按回车键开始测试...")
    main()