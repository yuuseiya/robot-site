// Raspberry PiのIPアドレスをここに設定してください (例: '192.168.1.100')
const raspberryPiIP = 'localhost'; // テスト中はlocalhostでOK
const controlURL = `http://${raspberryPiIP}:5000/api/control`;

// ------------------------------------------------------------------
// 1. サーバーへのコマンド送信 (REST API)
// ------------------------------------------------------------------
function sendCommand(action, value) {
    const data = { action: action, value: value }; 
    
    fetch(controlURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (!response.ok) throw new Error(`送信失敗: ${response.status}`);
        console.log(`✅ コマンド送信成功: ${action}, ${value}`);
        return response.json(); 
    })
    .catch(error => console.error('❌ 通信エラー発生:', error));
}


// ------------------------------------------------------------------
// 2. WebSocketによるデータ受信 (AI/集中度フィードバック)
// ------------------------------------------------------------------
const socket = io(`http://${raspberryPiIP}:5000`);
const concentrationDisplay = document.getElementById('concentration');
const statusText = document.getElementById('status-text');

socket.on('connect', () => {
    statusText.textContent = 'ロボットの状態：接続済み';
});

socket.on('disconnect', () => {
    statusText.textContent = 'ロボットの状態：切断中';
});

// 'status_update'イベントでデータを受信 (集中度、AI推奨色など)
socket.on('status_update', (data) => {
    console.log('受信データ:', data);
    
    // UIの更新
    const level = data.concentration_level || 0; // 集中度 (0-100)
    
    // 集中度スコア表示を更新
    concentrationDisplay.textContent = level;
    
    // （オプション）集中度に応じてUIの背景色を変えるなど、映像の切り替えを追加可能
});


// ------------------------------------------------------------------
// 3. UI操作イベントの割り当て
// ------------------------------------------------------------------
const visualArea = document.getElementById('active-visual');

// 1. 電源トグルボタン
document.getElementById('power-toggle').addEventListener('click', (e) => {
    const button = e.target;
    const isOff = button.dataset.status === 'off'; 
    const newStatus = isOff ? 'on' : 'off';
    
    sendCommand('power_toggle', newStatus); 
    
    // UIと映像を更新 (アニメーションの制御)
    button.dataset.status = newStatus;
    button.textContent = isOff ? '電源をオフにする' : '電源をオンにする';
    visualArea.className = isOff ? 'light-on' : 'light-off'; 
});

// 2. アーム動作ボタン
document.getElementById('arm-move').addEventListener('click', () => {
    sendCommand('move_arm', 'home');
});

// 3. 強弱（明るさ）スライダー
const brightnessSlider = document.getElementById('brightness-slider');
const brightnessValueDisplay = document.getElementById('brightness-value');

brightnessSlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value); 
    brightnessValueDisplay.textContent = value; 
    sendCommand('set_brightness', value); 
});

// 4. 色変更ボタン
document.querySelectorAll('.color-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        const color = e.target.dataset.color;
        sendCommand('set_color', color);
    });
});