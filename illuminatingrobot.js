// サーバー接続設定 ------------------------------------------------------------------
// 【重要】サーバーPCのローカルIPアドレスに置き換えてください。
// 例: const LOCAL_PC_IP = '192.168.1.5'; 
const LOCAL_PC_IP = '192.168.1.5'; 
const controlURL = `http://${LOCAL_PC_IP}:5000/api/control`;

// WebSocket接続の初期化（これはDOM要素に依存しないため、DOMContentLoadedの外に残します）
// ※この行はHTMLファイルの<script>タグでsocket.io.jsが読み込まれた後に実行されます
const socket = io(`http://${LOCAL_PC_IP}:5000`);

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
        if (!response.ok) throw new Error(`送信失敗: ${response.status}`);
        console.log(`✅ コマンド送信成功: ${action}, ${value}`);
        return response.json(); 
    })
    .catch(error => console.error('❌ 通信エラー発生:', error));
}
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

function updateTimer(timerDisplay) { // timerDisplayを引数に追加
    if (!isPowerOn) return;
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    if (timerDisplay) { // nullチェック
        timerDisplay.textContent = `経過時間: ${formatTime(elapsedSeconds)}`;
    }
}

function startTimer(timerDisplay) { // timerDisplayを引数に追加
    startTime = Date.now();
    updateTimer(timerDisplay); 
    // updateTimerに引数を渡すため、タイマー関数をラップ
    timerInterval = setInterval(() => updateTimer(timerDisplay), 1000); 
}

function stopTimer(timerDisplay) { // timerDisplayを引数に追加
    clearInterval(timerInterval);
    timerInterval = null;
    if (timerDisplay) { // nullチェック
        timerDisplay.textContent = '経過時間: 00:00:00';
    }
}
// ------------------------------------------------------------------


// ★★★ 履歴管理関数 (Study History Functions) ★★★
const STORAGE_KEY = 'studyTimeHistory';

function getHistory() {
    const json = localStorage.getItem(STORAGE_KEY);
    return json ? JSON.parse(json) : {};
}

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
 * 【重要】要素がnullにならないよう、引数として要素を受け取るように修正
 */
function renderHistory(historyList, noHistoryMessage) {
    if (!historyList || !noHistoryMessage) return; // 要素が取得できていなければ終了

    const history = getHistory();
    const dates = Object.keys(history).sort().reverse(); 

    historyList.innerHTML = ''; 

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


// 2. WebSocketによるデータ受信の初期化 -----------------------------------------------
// 注: socket変数はファイルの先頭で定義されています。

socket.on('disconnect', () => {
    // statusTextはDOM要素なので、DOMContentLoaded内で定義されます。
    // そのため、ここでは直接アクセスせず、DOM要素の準備ができてから設定します。
    // この行はDOMContentLoaded内に移動します。
});

// 'status_update'イベントでデータを受信 (集中度、AI推奨色など)
socket.on('status_update', (data, concentrationDisplay) => { 
    // concentrationDisplayを引数として受け取る、またはグローバル変数として再定義が必要です
    // 今回はDOMContentLoaded内で要素を取得し、スコープ内で処理します。
    
    // 【このブロックはDOMContentLoaded内で定義する必要がありますが、ここでは一旦コメントアウト】
    /* const level = data.concentration_level || 'N/A';
    concentrationDisplay.textContent = level; 
    */
});
// ------------------------------------------------------------------


// ------------------------------------------------------------------
// ★★★ DOMContentLoadedリスナーで、要素取得とイベント設定をラップする（最終修正点） ★★★
// ------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {

    // ★ 1. HTML要素の取得をこのブロック内で行う
    const powerToggle = document.getElementById('power-toggle');
    const statusText = document.getElementById('status-text');
    const visualArea = document.getElementById('active-visual');
    const timerDisplay = document.getElementById('timer-display');
    const concentrationDisplay = document.getElementById('concentration');
    const studyStartTimeDisplay = document.getElementById('study-start-time');
    const historyList = document.getElementById('history-list'); 
    const noHistoryMessage = document.getElementById('no-history-message'); 

    // WebSocketのdisconnectイベントをDOMContentLoaded内で再定義
    socket.on('disconnect', () => {
        statusText.textContent = 'ロボットの状態：切断中';
    });
    
    socket.on('connect', () => {
        statusText.textContent = 'ロボットの状態：接続済み (PCサーバー)';
    });

    // WebSocketのstatus_updateイベントをDOMContentLoaded内で再定義
    socket.on('status_update', (data) => {
        console.log('受信データ:', data);
        const level = data.concentration_level || 'N/A';
        concentrationDisplay.textContent = level;
    });

    // ★ 2. 履歴の初期表示
    renderHistory(historyList, noHistoryMessage); 

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
            
            sendCommand('power_toggle', 'on');
            
            // タイマー開始
            isPowerOn = true;
            startTimer(timerDisplay); // ★修正：timerDisplayを渡す

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

        } else {
            // 電源をオフにする
            powerToggle.setAttribute('data-status', 'off');
            powerToggle.textContent = '電源をオンにする';
            statusText.textContent = 'ロボットの状態：オフライン';
            visualArea.classList.remove('light-on');
            visualArea.classList.add('light-off');

            sendCommand('power_toggle', 'off');

            // タイマー停止
            isPowerOn = false;
            stopTimer(timerDisplay); // ★修正：timerDisplayを渡す
            
            // ★★★ 学習時間の計算と記録ロジック ★★★
            if (startTime !== 0) {
                const studyDurationMs = Date.now() - startTime;
                const studyDurationSeconds = Math.floor(studyDurationMs / 1000);
                
                const startDate = new Date(startTime);
                const year = startDate.getFullYear();
                const month = String(startDate.getMonth() + 1).padStart(2, '0');
                const day = String(startDate.getDate()).padStart(2, '0');
                const dateKey = `${year}-${month}-${day}`; 
                
                if (studyDurationSeconds >= 1) {
                    const history = getHistory();
                    history[dateKey] = (history[dateKey] || 0) + studyDurationSeconds;
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); 
                    // ★修正：historyListとnoHistoryMessageを渡す
                    renderHistory(historyList, noHistoryMessage); 
                }
            }
            startTime = 0; 
        }
    });
    // ------------------------------------------------------------------

    // その他のイベントリスナー (例: アーム移動、明るさ設定などがあればここに追加)

}); // <--- DOMContentLoadedの閉じ括弧
