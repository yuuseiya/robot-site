// サーバー接続設定 ------------------------------------------------------------------
// 【重要】サーバーPCのローカルIPアドレスに置き換えてください。
// 例: const LOCAL_PC_IP = '192.168.1.5'; 
const LOCAL_PC_IP = '192.168.1.5'; 
const controlURL = `http://${LOCAL_PC_IP}:5000/api/control`;

// ------------------------------------------------------------------
// サーバーへのコマンド送信 (REST API) 関数を定義
// ------------------------------------------------------------------
function sendCommand(action, value) {
    const data = { action: action, value: value }; 
    
    fetch(controlURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(response => {
        // サーバー側でレスポンスを返す必要があります
        if (!response.ok) throw new Error(`送信失敗: ${response.status}`);
        console.log(`✅ コマンド送信成功: ${action}, ${value}`);
        return response.json(); 
    })
    .catch(error => console.error('❌ 通信エラー発生:', error));
}
// ------------------------------------------------------------------


// HTML要素の取得
const powerToggle = document.getElementById('power-toggle');
const statusText = document.getElementById('status-text');
const visualArea = document.getElementById('active-visual');
const timerDisplay = document.getElementById('timer-display');
const concentrationDisplay = document.getElementById('concentration'); // 集中度表示要素を追加
const studyStartTimeDisplay = document.getElementById('study-start-time'); // 勉強開始日時表示要素を追加

// ★★★ 履歴表示用の要素を追加 ★★★
const historyList = document.getElementById('history-list'); // 履歴テーブルの tbody
const noHistoryMessage = document.getElementById('no-history-message'); // 「記録なし」メッセージ

// localStorageで履歴を保存するためのキー
const STORAGE_KEY = 'studyTimeHistory';
// ★★★ 履歴要素の取得ここまで ★★★


// 2. WebSocketによるデータ受信の初期化 -----------------------------------------------
const socket = io(`http://${LOCAL_PC_IP}:5000`);

socket.on('connect', () => {
    statusText.textContent = 'ロボットの状態：接続済み (PCサーバー)';
});

socket.on('disconnect', () => {
    statusText.textContent = 'ロボットの状態：切断中';
});

// 'status_update'イベントでデータを受信 (集中度、AI推奨色など)
socket.on('status_update', (data) => {
    console.log('受信データ:', data);
    
    const level = data.concentration_level || 'N/A';
    concentrationDisplay.textContent = level;
    
    // (集中度に応じた映像切り替えロジックなどをここに追加)
});
// ------------------------------------------------------------------


// タイマー関連の変数と関数 -----------------------------------------------
let isPowerOn = false;
let startTime = 0;
let timerInterval = null;

function formatTime(seconds) {
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function updateTimer() {
    if (!isPowerOn) return;
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    timerDisplay.textContent = `経過時間: ${formatTime(elapsedSeconds)}`;
}

function startTimer() {
    startTime = Date.now(); // 開始時刻を記録
    updateTimer(); 
    timerInterval = setInterval(updateTimer, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    timerDisplay.textContent = '経過時間: 00:00:00';
}
// ------------------------------------------------------------------


// ★★★ 履歴管理関数 (Study History Functions) ★★★
/**
 * 学習時間履歴をlocalStorageから取得する
 */
function getHistory() {
    const json = localStorage.getItem(STORAGE_KEY);
    return json ? JSON.parse(json) : {};
}

/**
 * 秒数を 'h時間 m分 s秒' 形式にフォーマットする
 */
function formatTimeDuration(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    
    let parts = [];
    if (h > 0) parts.push(`${h}時間`);
    if (m > 0) parts.push(`${m}分`);
    if (parts.length === 0 || s > 0) parts.push(`${s}秒`); 
    
    return parts.join(' ');
}


/**
 * 履歴データを読み込み、HTMLにレンダリングする
 */
function renderHistory() {
    const history = getHistory();
    const dates = Object.keys(history).sort().reverse(); // 新しい日付を上に

    historyList.innerHTML = ''; // 一旦リストをクリア

    if (dates.length === 0) {
        noHistoryMessage.style.display = 'block';
        return;
    }

    noHistoryMessage.style.display = 'none';

    dates.forEach(date => {
        const seconds = history[date];
        const duration = formatTimeDuration(seconds);

        const row = document.createElement('tr');
        row.innerHTML = `<td>${date}</td><td>${duration}</td>`;
        historyList.appendChild(row);
    });
}
// ★★★ 履歴管理関数ここまで ★★★


// 3. UI操作イベントの割り当て ------------------------------------------------------
// 電源トグルボタンのクリックイベント
powerToggle.addEventListener('click', () => {
    const currentStatus = powerToggle.getAttribute('data-status');
    const isOff = (currentStatus === 'off');

    if (isOff) {
        // 電源をオンにする
        powerToggle.setAttribute('data-status', 'on');
        powerToggle.textContent = '電源をオフにする';
        statusText.textContent = 'ロボットの状態：オンライン (稼働中)';
        visualArea.classList.remove('light-off');
        visualArea.classList.add('light-on');
        
        // ★ サーバーへON信号送信 (REST APIを使用)
        sendCommand('power_toggle', 'on');
        
        // タイマー開始
        isPowerOn = true;
        startTimer(); // ★この中でstartTimeが設定される

        // ★★★ 勉強開始日時を記録するロジック ★★★
        const now = new Date();
        const options = {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        };
        const formattedDate = now.toLocaleString('ja-JP', options);
        
        if (studyStartTimeDisplay) {
            studyStartTimeDisplay.textContent = formattedDate;
        }
        // ★★★ 記録ロジックここまで ★★★

    } else {
        // 電源をオフにする
        powerToggle.setAttribute('data-status', 'off');
        powerToggle.textContent = '電源をオンにする';
        statusText.textContent = 'ロボットの状態：オフライン';
        visualArea.classList.remove('light-on');
        visualArea.classList.add('light-off');

        // ★ サーバーへOFF信号送信 (REST APIを使用)
        sendCommand('power_toggle', 'off');

        // タイマー停止
        isPowerOn = false;
        stopTimer();
        
        // ★★★ 学習時間の計算と記録ロジック ★★★
        if (startTime !== 0) {
            const studyDurationMs = Date.now() - startTime;
            const studyDurationSeconds = Math.floor(studyDurationMs / 1000);
            
            // 開始日を'YYYY-MM-DD'形式で取得
            const startDate = new Date(startTime);
            const year = startDate.getFullYear();
            const month = String(startDate.getMonth() + 1).padStart(2, '0');
            const day = String(startDate.getDate()).padStart(2, '0');
            const dateKey = `${year}-${month}-${day}`; 
            
            // 1秒以上の学習時間がある場合のみ記録する
            if (studyDurationSeconds >= 1) {
                const history = getHistory();
                history[dateKey] = (history[dateKey] || 0) + studyDurationSeconds; // 既存の時間に加算
                localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); // 保存
                renderHistory(); // 履歴リストを更新
            }
        }
        startTime = 0; // 開始時刻をリセット
        // ★★★ 記録ロジックここまで ★★★
    }
});

// アーム動作ボタン
document.getElementById('arm-move').addEventListener('click', () => {
    if (isPowerOn) {
        // ★ サーバーへ信号送信 (REST APIを使用)
        sendCommand('move_arm', 'home');
    } else {
        alert('電源がオフです。電源をオンにしてください。');
    }
});

// 強弱（明るさ）スライダー
const brightnessSlider = document.getElementById('brightness-slider');
const brightnessValue = document.getElementById('brightness-value');
brightnessSlider.addEventListener('input', (event) => {
    const value = parseInt(event.target.value);
    brightnessValue.textContent = value;
    if (isPowerOn) {
        // ★ サーバーへ信号送信 (REST APIを使用)
        sendCommand('set_brightness', value);
    }
});

// 色変更ボタン
document.querySelectorAll('.color-btn').forEach(button => {
    button.addEventListener('click', (event) => {
        const color = event.target.getAttribute('data-color');
        if (isPowerOn) {
            // ★ サーバーへ信号送信 (REST APIを使用)
            sendCommand('set_color', color);
        } else {
            alert('電源がオフです。色設定はできません。');
        }
    });
});
// ------------------------------------------------------------------

// ページの読み込み完了時に履歴を表示する
document.addEventListener('DOMContentLoaded', renderHistory);
