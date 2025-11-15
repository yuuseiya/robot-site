// サーバー接続設定 ------------------------------------------------------------------
// 【重要】サーバーPCのローカルIPアドレスに置き換えてください。
// 例: const LOCAL_PC_IP = '192.168.1.5'; 
// 注意: HTML側で '{{ local_ip }}' が定義されている場合は、const LOCAL_PC_IP = '{{ local_ip }}'; を使用してください。
const LOCAL_PC_IP = '192.168.1.5'; 
const controlURL = `http://${LOCAL_PC_IP}:5000/api/control`;

// WebSocket接続の初期化
const socket = io(`http://${LOCAL_PC_IP}:5000`);

// ------------------------------------------------------------------
// サーバーへのコマンド送信 (REST API) 関数を定義
// ------------------------------------------------------------------
function sendCommand(action, value) {
    // move_arm_customの場合、valueはオブジェクトになる
    const data = { action: action, value: value }; 
    
    fetch(controlURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (!response.ok) throw new Error(`送信失敗: ${response.status}`);
        console.log(`✅ コマンド送信成功: ${action},`, value);
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

function updateTimer(timerDisplay) {
    if (!isPowerOn) return;
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    if (timerDisplay) {
        timerDisplay.textContent = `経過時間: ${formatTime(elapsedSeconds)}`;
    }
}

function startTimer(timerDisplay) {
    startTime = Date.now();
    updateTimer(timerDisplay); 
    // updateTimerに引数を渡すため、タイマー関数をラップ
    timerInterval = setInterval(() => updateTimer(timerDisplay), 1000); 
}

function stopTimer(timerDisplay) {
    clearInterval(timerInterval);
    timerInterval = null;
    if (timerDisplay) {
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
 */
function renderHistory(historyList, noHistoryMessage) {
    if (!historyList || !noHistoryMessage) return;

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


// ------------------------------------------------------------------
// ★★★ DOMContentLoadedリスナーで、要素取得とイベント設定をラップする ★★★
// ------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {

    // ★ 1. HTML要素の取得
    const powerToggle = document.getElementById('power-toggle');
    const statusText = document.getElementById('status-text');
    const visualArea = document.getElementById('active-visual');
    const timerDisplay = document.getElementById('timer-display');
    const concentrationDisplay = document.getElementById('concentration');
    const studyStartTimeDisplay = document.getElementById('study-start-time');
    const historyList = document.getElementById('history-list'); 
    const noHistoryMessage = document.getElementById('no-history-message'); 
    
    // モーダル関連要素
    const settingModal = document.getElementById('setting-modal');
    const openSettingsButton = document.getElementById('open-settings-button');
    const robotMoveModal = document.getElementById('robot-move-modal');
    const openRobotMoveButton = document.getElementById('open-robot-move-button');

    // ロボット動作モーダル内の要素
    const armMoveHomeButton = document.getElementById('arm-move-home'); 
    const armMoveCustomButton = document.getElementById('arm-move-custom'); 
    const baseAngleSlider = document.getElementById('base-angle-slider');
    const baseAngleValue = document.getElementById('base-angle-value');
    const shoulderAngleSlider = document.getElementById('shoulder-angle-slider');
    const shoulderAngleValue = document.getElementById('shoulder-angle-value');
    const elbowAngleSlider = document.getElementById('elbow-angle-slider');
    const elbowAngleValue = document.getElementById('elbow-angle-value');

    // 照明設定モーダル内の要素
    const modalBrightnessSlider = document.getElementById('brightness-slider-modal');
    const modalBrightnessValue = document.getElementById('brightness-value-modal');


    // WebSocketイベントの再定義
    socket.on('disconnect', () => {
        statusText.textContent = 'ロボットの状態：切断中';
    });
    
    socket.on('connect', () => {
        statusText.textContent = 'ロボットの状態：接続済み (PCサーバー)';
    });

    socket.on('status_update', (data) => {
        console.log('受信データ:', data);
        const level = data.concentration_level || 'N/A';
        concentrationDisplay.textContent = level;
    });

    // ★ 2. 履歴の初期表示
    renderHistory(historyList, noHistoryMessage); 

    // 3. UI操作イベントの割り当て ------------------------------------------------------
    // 電源トグルボタンのクリックイベント
    if (powerToggle) {
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
                startTimer(timerDisplay); 

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
                stopTimer(timerDisplay); 
                
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
                        renderHistory(historyList, noHistoryMessage); 
                    }
                }
                startTime = 0; 
            }
        });
    }

    // 強弱（明るさ）スライダー
    if (modalBrightnessSlider) {
        modalBrightnessSlider.addEventListener('input', (event) => {
            const value = parseInt(event.target.value);
            if (modalBrightnessValue) modalBrightnessValue.textContent = value;
            if (isPowerOn) {
                sendCommand('set_brightness', value);
            }
        });
    }

    // --- モーダル表示/非表示のロジック ---
    if (openSettingsButton && settingModal && robotMoveModal) {
        openSettingsButton.addEventListener('click', () => {
            settingModal.classList.remove('hidden');
            robotMoveModal.classList.add('hidden');
        });
    }

    if (openRobotMoveButton && robotMoveModal && settingModal) {
        openRobotMoveButton.addEventListener('click', () => {
            robotMoveModal.classList.remove('hidden');
            settingModal.classList.add('hidden');
        });
    }
    
    // モーダルの外側クリックで閉じる
    if (settingModal) {
        settingModal.addEventListener('click', (e) => { if (e.target === settingModal) settingModal.classList.add('hidden'); });
    }
    if (robotMoveModal) {
        robotMoveModal.addEventListener('click', (e) => { if (e.target === robotMoveModal) robotMoveModal.classList.add('hidden'); });
    }
    // ------------------------------------------------------------------

    // --- アーム角度設定のロジック ---
    
    /**
     * スライダーの値を現在の値表示要素に反映
     */
    function setupAngleSlider(slider, valueDisplay) {
        if (slider) {
            valueDisplay.textContent = slider.value;
            slider.addEventListener('input', (event) => {
                valueDisplay.textContent = event.target.value;
            });
        }
    }

    // 各軸のスライダーを設定
    setupAngleSlider(baseAngleSlider, baseAngleValue);
    setupAngleSlider(shoulderAngleSlider, shoulderAngleValue);
    setupAngleSlider(elbowAngleSlider, elbowAngleValue);

    // 「設定角度でアームを動かす」ボタンのイベント
    if (armMoveCustomButton) {
        armMoveCustomButton.addEventListener('click', () => {
            if (!isPowerOn) {
                alert('電源がオフです。電源をオンにしてください。');
                return;
            }
            const angles = {
                base: parseInt(baseAngleSlider.value),
                shoulder: parseInt(shoulderAngleSlider.value),
                elbow: parseInt(elbowAngleSlider.value),
            };
            sendCommand('move_arm_custom', angles);
        });
    }

    // ロボット動作モーダル内の「定位置へ動かす」ボタンのイベント
    if (armMoveHomeButton) {
        armMoveHomeButton.addEventListener('click', () => {
            if (isPowerOn) {
                sendCommand('move_arm', 'home');
            } else {
                alert('電源がオフです。電源をオンにしてください。');
            }
        });
    }
    // ------------------------------------------------------------------

}); // <--- DOMContentLoadedの閉じ括弧（ファイルの終端）
