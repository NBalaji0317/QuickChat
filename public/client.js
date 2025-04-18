const socket = io();
let username = "", room = "", avatar = "";

// DOM Ready
window.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll('#avatar-grid span').forEach(span => {
    span.addEventListener('click', () => {
      document.querySelectorAll('#avatar-grid span').forEach(s => s.classList.remove('selected'));
      span.classList.add('selected');
      avatar = span.textContent;
    });
  });

  document.getElementById('join-btn').addEventListener('click', joinRoom);

  document.getElementById('info-toggle').addEventListener('click', () => {
    document.getElementById('room-info').classList.toggle('hidden');
  });

  document.getElementById('theme-toggle').addEventListener('click', () => {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : current === 'light' ? 'colorful' : 'dark';
    html.setAttribute('data-theme', next);
  });

  const input = document.getElementById('message-input');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  input.addEventListener('input', () => {
    socket.emit('typing', { username });
    clearTimeout(window.typingTimer);
    window.typingTimer = setTimeout(() => socket.emit('typing', { username, status: false }), 1000);
  });

  document.getElementById('file-upload').addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      socket.emit('image-message', { imgData: e.target.result, filename: file.name });
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('capture-btn').addEventListener('click', captureImage);
});

// Join Room
function joinRoom() {
  const urlParts = window.location.pathname.split('/');
  room = urlParts[urlParts.length - 1];
  username = document.getElementById('username').value.trim() || "Guest";
  avatar = avatar || "😄";
  const topic = document.getElementById('topic').value;
  const password = document.getElementById('room-password').value;
  socket.emit('join-room', { room, username, avatar, topic, password });
}

// Send Message
function sendMessage() {
  const input = document.getElementById('message-input');
  const msg = input.value.trim();
  if (msg) {
    socket.emit('chat-message', msg);
    input.value = '';
  }
}

// Open Camera
function openCamera() {
  const video = document.getElementById('camera');
  const captureBtn = document.getElementById('capture-btn');
  video.style.display = 'block';
  captureBtn.style.display = 'inline-block';

  navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
    video.srcObject = stream;
    video.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }).catch(err => alert("Camera error!"));
}

// Capture Image
function captureImage() {
  const video = document.getElementById('camera');
  const canvas = document.getElementById('canvas');
  const captureBtn = document.getElementById('capture-btn');

  if (video.videoWidth === 0 || video.videoHeight === 0) {
    console.warn("Video not ready. Try again in a second.");
    return;
  }

  const context = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const imageData = canvas.toDataURL('image/png');
  socket.emit('image-message', { imgData: imageData, filename: 'camera.png' });

  if (video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
  }
  video.style.display = 'none';
  captureBtn.style.display = 'none';
}

// Update Sidebar User List
function updateUserList(users) {
  const list = document.getElementById('user-list');
  list.innerHTML = '';
  users.forEach(user => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="status-dot online"></span>
      <span class="user-avatar">${user.avatar}</span>
      <span class="user-name">${user.username}</span>
    `;
    list.appendChild(li);
  });

  document.getElementById('participants-count').textContent = `👥 Participants: ${users.length}`;
  document.getElementById('room-users-count').textContent = users.length;
}

// Chat Message Handler
socket.on('chat-message', ({ msg, username, timestamp, color, avatar }) => {
  const messages = document.getElementById('messages');
  const msgElement = document.createElement('div');
  msgElement.className = 'message-wrapper';
  msgElement.dataset.timestamp = timestamp;

  msgElement.innerHTML = `
    <div class="avatar" style="background-color:${color}">${avatar}</div>
    <div class="message-content">
      <div class="name" style="color:${color}">${username}</div>
      <div class="meta">${timestamp}</div>
      <div class="text">${msg}</div>
      <div class="actions">
        <span class="reply" onclick="replyTo('${msg}', '${username}')">↩️</span>
        <span class="delete" onclick="deleteMessage('${timestamp}')">🗑️</span>
      </div>
    </div>
  `;
  messages.appendChild(msgElement);
  messages.scrollTop = messages.scrollHeight;
});

// Image Message Handler
socket.on('image-message', ({ imgData, filename, username, timestamp, color, avatar }) => {
  const isImage = imgData.startsWith('data:image/');
  const messages = document.getElementById('messages');
  const msgElement = document.createElement('div');
  msgElement.className = 'message-wrapper';
  msgElement.dataset.timestamp = timestamp;

  const contentHTML = isImage
    ? `<a href="${imgData}" target="_blank"><img src="${imgData}" style="max-width: 200px; border-radius: 8px;" /></a>`
    : `<a href="${imgData}" download="${filename}">📎 ${filename}</a>`;

  msgElement.innerHTML = `
    <div class="avatar" style="background-color:${color}">${avatar}</div>
    <div class="message-content">
      <div class="name" style="color:${color}">${username}</div>
      <div class="meta">${timestamp}</div>
      ${contentHTML}
      <div class="actions">
        <span class="reply" onclick="replyTo('${filename}', '${username}')">↩️</span>
        <span class="delete" onclick="deleteMessage('${timestamp}')">🗑️</span>
      </div>
    </div>
  `;
  messages.appendChild(msgElement);
  messages.scrollTop = messages.scrollHeight;
});

// System Events
socket.on('room-data', ({ room, topic, isPrivate, users }) => {
  document.getElementById('room-title').textContent = `📍 ${topic} ${isPrivate ? '(Private)' : ''}`;
  document.getElementById('room-topic').textContent = topic;
  document.getElementById('room-privacy').textContent = isPrivate ? 'Private' : 'Public';
  document.getElementById('join-area').style.display = 'none';
  document.getElementById('chat-area').style.display = 'block';
  updateUserList(users);
});

socket.on('update-participants', (users) => updateUserList(users));

socket.on('user-joined', (msg) => addNotification(`🔔 ${msg}`));
socket.on('user-left', (msg) => addNotification(`❌ ${msg}`));

socket.on('typing', ({ username, status }) => {
  document.getElementById('typing-indicator').textContent =
    status === false ? '' : `${username} is typing...`;
});

// Reply & Delete
function replyTo(text, fromUser) {
  const input = document.getElementById('message-input');
  input.value = `@${fromUser}: ${text}\n`;
  input.focus();
}

function deleteMessage(timestamp) {
  const messages = document.querySelectorAll('.message-wrapper');
  messages.forEach(msg => {
    if (msg.dataset.timestamp === timestamp) {
      msg.remove();
    }
  });
}

// Notification helper
function addNotification(text) {
  const messages = document.getElementById('messages');
  const note = document.createElement('div');
  note.className = 'notification';
  note.textContent = text;
  messages.appendChild(note);
}
